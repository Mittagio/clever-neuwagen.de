import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { spawn } from 'node:child_process';
import {
  buildKiaTechnicalSyncReport,
} from '../src/data/technical/kiaPricelistSyncService.js';
import { formatKiaSyncReportForAdmin } from '../src/services/admin/technicalSyncPresenter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXTRACT_DIR = path.join(ROOT, 'scripts', 'pdf-extract');
const OUT_DIR = path.join(ROOT, 'data', 'technical', 'generated');
const REPORT_PATH = path.join(OUT_DIR, 'kia-pricelist-sync-report.json');
const MANIFEST_PATH = path.join(OUT_DIR, 'kia-pricelist-manifest.json');
const SYNC_SCRIPT = path.join(ROOT, 'scripts', 'sync-kia-pricelists.mjs');

const router = express.Router();

async function readJsonSafe(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

async function loadLocalSyncInputs() {
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
  const manifest = await readJsonSafe(MANIFEST_PATH, {});
  return { textByFile, manifest };
}

async function resolveKiaSyncReport() {
  const cached = await readJsonSafe(REPORT_PATH, null);
  if (cached?.generatedAt) return cached;
  const { textByFile, manifest } = await loadLocalSyncInputs();
  return buildKiaTechnicalSyncReport(textByFile, manifest);
}

function runKiaSyncScript({ offline = false } = {}) {
  return new Promise((resolve, reject) => {
    const args = [SYNC_SCRIPT];
    if (offline) args.push('--offline');
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ ok: true, stdout, stderr });
        return;
      }
      reject(new Error(stderr || stdout || `sync exited with ${code}`));
    });
  });
}

router.get('/admin/technical-sync/kia', async (_req, res) => {
  try {
    const report = await resolveKiaSyncReport();
    res.json({
      ok: true,
      report: formatKiaSyncReportForAdmin(report),
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Sync-Report konnte nicht geladen werden',
    });
  }
});

router.post('/admin/technical-sync/kia/run', express.json({ limit: '8kb' }), async (req, res) => {
  const offline = req.body?.offline === true;
  try {
    await runKiaSyncScript({ offline });
    const report = await readJsonSafe(REPORT_PATH, null) ?? await resolveKiaSyncReport();
    res.json({
      ok: true,
      report: formatKiaSyncReportForAdmin(report),
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Sync fehlgeschlagen',
    });
  }
});

export default router;
