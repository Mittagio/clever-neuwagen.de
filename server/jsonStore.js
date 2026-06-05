/**
 * Einheitliche JSON-Persistenz für Pilot/Produktion.
 * Env: PILOT_DATA_DIR – absoluter Pfad außerhalb von dist/ (VPS: z. B. /var/lib/clever-neuwagen/data)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = path.join(__dirname, '..', 'data');

export function resolvePilotDataDir() {
  const custom = process.env.PILOT_DATA_DIR?.trim();
  if (custom) return path.resolve(custom);
  return DEFAULT_DATA_DIR;
}

export function ensureDataDir(dir = resolvePilotDataDir()) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * @param {object} options
 * @param {string} options.fileName – z. B. pilot-leads.json
 * @param {() => object} options.createEmpty
 * @param {string} [options.logTag]
 */
export function createJsonStore({ fileName, createEmpty, logTag = 'json-store' }) {
  function filePath() {
    return path.join(ensureDataDir(), fileName);
  }

  function load() {
    ensureDataDir();
    const fp = filePath();
    try {
      if (fs.existsSync(fp)) {
        return JSON.parse(fs.readFileSync(fp, 'utf8'));
      }
    } catch (err) {
      console.warn(`[${logTag}] load failed (${fp}):`, err.message);
    }
    return createEmpty();
  }

  function save(data) {
    ensureDataDir();
    const fp = filePath();
    const tmp = `${fp}.${process.pid}.tmp`;
    const payload = JSON.stringify(data, null, 2);
    fs.writeFileSync(tmp, payload, 'utf8');
    fs.renameSync(tmp, fp);
    return data;
  }

  function stat() {
    const fp = filePath();
    try {
      if (!fs.existsSync(fp)) {
        return { fileName, path: fp, exists: false, bytes: 0, mtime: null };
      }
      const s = fs.statSync(fp);
      return {
        fileName,
        path: fp,
        exists: true,
        bytes: s.size,
        mtime: s.mtime.toISOString(),
      };
    } catch {
      return { fileName, path: fp, exists: false, bytes: 0, mtime: null };
    }
  }

  return { load, save, filePath, stat };
}

/** Berater-relevante Stores für Health/Diagnose */
export const ADVISOR_JSON_STORES = [
  'advisor-share-sessions.json',
  'pilot-leads.json',
  'customer-records.json',
];

export function getAdvisorStorageStatus() {
  const dataDir = resolvePilotDataDir();
  ensureDataDir();
  const files = ADVISOR_JSON_STORES.map((fileName) => {
    const fp = path.join(dataDir, fileName);
    try {
      if (!fs.existsSync(fp)) {
        return { fileName, exists: false, bytes: 0 };
      }
      const s = fs.statSync(fp);
      return { fileName, exists: true, bytes: s.size, mtime: s.mtime.toISOString() };
    } catch {
      return { fileName, exists: false, bytes: 0 };
    }
  });
  return {
    backend: 'json-file',
    dataDir,
    customDir: Boolean(process.env.PILOT_DATA_DIR?.trim()),
    files,
  };
}
