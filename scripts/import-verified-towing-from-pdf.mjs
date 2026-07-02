#!/usr/bin/env node
/**
 * Extrahiert Anhängelast aus PDF-Texten und validiert gegen geprüfte Profile.
 *
 * Nutzung:
 *   node scripts/import-verified-towing-from-pdf.mjs
 *   node scripts/import-verified-towing-from-pdf.mjs --write-report
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KIA_MODELS_PENDING_PDF } from '../src/data/technical/brands/kia/pdfSourceCatalog.js';
import { buildKiaTechnicalSyncReport } from '../src/data/technical/kiaPricelistSyncService.js';
import { VERIFIED_TECHNICAL_BRAND_REGISTRIES } from '../src/data/technical/brands/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXTRACT_DIR = path.join(ROOT, 'scripts', 'pdf-extract');
const OUT_DIR = path.join(ROOT, 'data', 'technical', 'generated');

const writeReport = process.argv.includes('--write-report');

async function loadLocalTexts() {
  const { KIA_PDF_SOURCE_CATALOG } = await import('../src/data/technical/brands/kia/pdfSourceCatalog.js');
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

async function main() {
  const textByFile = await loadLocalTexts();
  const report = buildKiaTechnicalSyncReport(textByFile);
  const legacyReport = {
    generatedAt: report.generatedAt,
    brands: { kia: report.rows },
    pending: { kia: report.pending },
    summary: {
      ok: report.summary.ok,
      mismatch: report.summary.mismatch,
      missing: report.summary.missing,
      noProfile: report.summary.noProfile,
    },
    brandsRegistered: Object.fromEntries(
      Object.entries(VERIFIED_TECHNICAL_BRAND_REGISTRIES).map(([key, val]) => [key, val.profiles.length]),
    ),
  };

  console.log('=== Verified Towing Import ===');
  console.log(`Kia PDFs: ${report.rows.length}`);
  console.log(`OK: ${report.summary.ok} | Mismatch: ${report.summary.mismatch} | Missing file: ${report.summary.missing}`);
  console.log(`Marken: ${JSON.stringify(legacyReport.brandsRegistered)}`);
  console.log(`Kia ausstehend (ohne Profil): ${KIA_MODELS_PENDING_PDF.map((m) => m.modelKey).join(', ')}`);

  const mismatches = report.rows.filter((r) => r.status === 'mismatch');
  if (mismatches.length) {
    console.log('\nMismatch (PDF vs Profil):');
    for (const m of mismatches) {
      console.log(`  ${m.modelKey}: PDF [${m.extracted?.brakedKg?.join(', ') ?? '-'}] vs Profil [${m.profileBrakedKg.join(', ')}]`);
    }
  }

  if (writeReport) {
    await fs.mkdir(OUT_DIR, { recursive: true });
    const outPath = path.join(OUT_DIR, 'towing-extract-report.json');
    await fs.writeFile(outPath, `${JSON.stringify(legacyReport, null, 2)}\n`, 'utf8');
    await fs.writeFile(
      path.join(OUT_DIR, 'kia-pricelist-sync-report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    );
    console.log(`\nReport: ${outPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
