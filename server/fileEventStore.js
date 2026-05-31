import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeIntelligenceStores, INTELLIGENCE_MAX_EVENTS } from '../src/services/intelligenceEventMerge.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'intelligence-events.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function emptyStore() {
  return { events: [], lastUpdated: null };
}

export function createFileStorageAdapter() {
  return {
    load() {
      ensureDataDir();
      try {
        if (fs.existsSync(DATA_FILE)) {
          const raw = fs.readFileSync(DATA_FILE, 'utf8');
          return JSON.parse(raw);
        }
      } catch (err) {
        console.warn('[intelligence-store] load failed:', err.message);
      }
      return emptyStore();
    },
    save(data) {
      ensureDataDir();
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    },
  };
}

export function appendEventToFile(event, maxEvents = INTELLIGENCE_MAX_EVENTS) {
  const adapter = createFileStorageAdapter();
  const data = adapter.load();
  const merged = mergeIntelligenceStores(data, { events: [event], lastUpdated: null });
  merged.events = merged.events.slice(-maxEvents);
  adapter.save(merged);
  return merged;
}

export function replaceEventsInFile(events, maxEvents = INTELLIGENCE_MAX_EVENTS) {
  const adapter = createFileStorageAdapter();
  const data = {
    events: events.slice(-maxEvents),
    lastUpdated: new Date().toISOString(),
  };
  adapter.save(data);
  return data;
}

export function mergeEventsInFile(events, maxEvents = INTELLIGENCE_MAX_EVENTS) {
  const adapter = createFileStorageAdapter();
  const merged = mergeIntelligenceStores(adapter.load(), { events, lastUpdated: null });
  merged.events = merged.events.slice(-maxEvents);
  adapter.save(merged);
  return merged;
}

export function getDataFilePath() {
  return DATA_FILE;
}
