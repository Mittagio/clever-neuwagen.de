import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'published-trends.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function emptyStore() {
  return { pages: [], lastUpdated: null };
}

export function createPublishedTrendsAdapter() {
  return {
    load() {
      ensureDataDir();
      try {
        if (fs.existsSync(DATA_FILE)) {
          return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
      } catch (err) {
        console.warn('[published-trends] load failed:', err.message);
      }
      return emptyStore();
    },
    save(data) {
      ensureDataDir();
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    },
  };
}

export function replacePublishedTrends(pages) {
  const adapter = createPublishedTrendsAdapter();
  const data = {
    pages: Array.isArray(pages) ? pages : [],
    lastUpdated: new Date().toISOString(),
  };
  adapter.save(data);
  return data;
}

export function getPublishedTrendsFilePath() {
  return DATA_FILE;
}
