#!/usr/bin/env node
/**
 * Kia-Preislisten online laden, Text extrahieren, Anhängelast mit Registry abgleichen.
 *
 * Nutzung:
 *   npm run sync:kia-pricelists
 *   npm run sync:kia-pricelists -- --offline
 *   npm run sync:kia-pricelists -- --download
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { KIA_PDF_SOURCE_CATALOG, KIA_MODELS_PENDING_PDF } from '../src/data/technical/brands/kia/pdfSourceCatalog.js';
import { buildKiaTechnicalSyncReport, summarizeKiaSyncReport } from '../src/data/technical/kiaPricelistSyncService.js';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXTRACT_DIR = path.join(ROOT, 'scripts', 'pdf-extract');
const PDF_CACHE_DIR = path.join(ROOT, 'data', 'technical', 'generated', 'kia-pdf-cache');
const OUT_DIR = path.join(ROOT, 'data', 'technical', 'generated');
const MANIFEST_PATH = path.join(OUT_DIR, 'kia-pricelist-manifest.json');
const REPORT_PATH = path.join(OUT_DIR, 'kia-pricelist-sync-report.json');

const args = new Set(process.argv.slice(2));
const offline = args.has('--offline');
const download = args.has('--download') || !offline;

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

async function downloadPdf(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Clever-Neuwagen/1.0 (kia-pricelist-sync)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function extractPdfText(buffer) {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text;
}

async function loadLocalTexts() {
  /** @type {Record<string, string>} */
  const textByFile = {};
  for (const entry of KIA_PDF_SOURCE_CATALOG) {
    try {
      textByFile[entry.file] = await fs.readFile(path.join(EXTRACT_DIR, entry.file), 'utf8');
    } catch {
      textByFile[entry.file] = '';
    }
  }
  return textByFile;
}

async function syncOnline(manifest) {
  await fs.mkdir(EXTRACT_DIR, { recursive: true });
  await fs.mkdir(PDF_CACHE_DIR, { recursive: true });

  /** @type {Record<string, { hash: string, previousHash?: string, downloadedAt: string, error?: string }>} */
  const nextManifest = { ...manifest };

  for (const entry of KIA_PDF_SOURCE_CATALOG) {
    const previous = manifest[entry.stem] ?? {};
    try {
      const buffer = await downloadPdf(entry.downloadUrl);
      const hash = sha256(buffer);
      const changed = previous.hash && previous.hash !== hash;

      await fs.writeFile(path.join(PDF_CACHE_DIR, entry.pdfFile), buffer);
      const text = await extractPdfText(buffer);
      await fs.writeFile(path.join(EXTRACT_DIR, entry.file), text, 'utf8');

      nextManifest[entry.stem] = {
        hash,
        previousHash: changed ? previous.hash : previous.previousHash ?? previous.hash ?? null,
        downloadedAt: new Date().toISOString(),
      };
      console.log(`✓ ${entry.modelKey}${changed ? ' (Quelle geändert)' : ''}`);
    } catch (err) {
      nextManifest[entry.stem] = {
        ...previous,
        error: err instanceof Error ? err.message : String(err),
        downloadedAt: previous.downloadedAt ?? null,
      };
      console.warn(`✗ ${entry.modelKey}: ${nextManifest[entry.stem].error}`);
    }
  }

  for (const pending of KIA_MODELS_PENDING_PDF) {
    if (!pending.downloadUrl || !pending.stem) continue;
    const previous = manifest[pending.stem] ?? {};
    try {
      const buffer = await downloadPdf(pending.downloadUrl);
      const hash = sha256(buffer);
      const pdfFile = `${pending.stem}.pdf`;
      const txtFile = `${pending.stem}.txt`;
      await fs.writeFile(path.join(PDF_CACHE_DIR, pdfFile), buffer);
      const text = await extractPdfText(buffer);
      await fs.writeFile(path.join(EXTRACT_DIR, txtFile), text, 'utf8');
      nextManifest[pending.stem] = {
        hash,
        previousHash: previous.hash && previous.hash !== hash ? previous.hash : previous.previousHash ?? previous.hash ?? null,
        downloadedAt: new Date().toISOString(),
        pendingProfile: true,
      };
      console.log(`✓ ${pending.modelKey} (pending profile)`);
    } catch (err) {
      console.warn(`✗ ${pending.modelKey}: ${err instanceof Error ? err.message : err}`);
    }
  }

  return nextManifest;
}

async function main() {
  let manifest = await readJson(MANIFEST_PATH, {});

  if (download) {
    console.log('=== Kia Preislisten Sync (online) ===');
    manifest = await syncOnline(manifest);
    await fs.mkdir(OUT_DIR, { recursive: true });
    await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  } else {
    console.log('=== Kia Preislisten Sync (offline) ===');
  }

  const textByFile = await loadLocalTexts();
  const report = buildKiaTechnicalSyncReport(textByFile, manifest);
  const headline = summarizeKiaSyncReport(report);

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(headline.headline);
  console.log(`OK: ${report.summary.ok} | Abweichung: ${report.summary.mismatch} | Fehlend: ${report.summary.missing}`);
  console.log(`Report: ${REPORT_PATH}`);

  const mismatches = report.rows.filter((r) => r.status === 'mismatch');
  if (mismatches.length) {
    console.log('\nAbweichungen (PDF vs Registry):');
    for (const row of mismatches) {
      console.log(`  ${row.modelKey}: PDF [${row.extracted?.brakedKg?.join(', ') ?? '-'}] vs Profil [${row.profileBrakedKg.join(', ')}]`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
