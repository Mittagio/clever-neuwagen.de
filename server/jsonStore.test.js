/**
 * node server/jsonStore.test.js
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createJsonStore,
  ensureDataDir,
  getAdvisorStorageStatus,
} from './jsonStore.js';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cn-json-store-'));
process.env.PILOT_DATA_DIR = tmpDir;

const store = createJsonStore({
  fileName: 'test-store.json',
  createEmpty: () => ({ items: [] }),
  logTag: 'test',
});

assert.deepEqual(store.load(), { items: [] });

store.save({ items: [{ id: 'a' }], lastUpdated: '2026-01-01' });
const loaded = store.load();
assert.equal(loaded.items.length, 1);

const stat = store.stat();
assert.ok(stat.exists);
assert.ok(stat.bytes > 0);

const status = getAdvisorStorageStatus();
assert.equal(status.dataDir, tmpDir);
assert.ok(status.customDir);
assert.equal(status.backend, 'json-file');

fs.rmSync(tmpDir, { recursive: true, force: true });
delete process.env.PILOT_DATA_DIR;

console.log('jsonStore tests OK');
