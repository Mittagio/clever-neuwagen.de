/**
 * node server/stammdatenStore.test.js
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  loadStammdatenOverrides,
  patchStammdatenOverride,
  addOpenCustomerQuestion,
  listOpenCustomerQuestions,
  updateOpenCustomerQuestion,
} from './stammdatenStore.js';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cn-stammdaten-'));
process.env.PILOT_DATA_DIR = tmpDir;

assert.deepEqual(loadStammdatenOverrides(), {});

patchStammdatenOverride('ev5', { towing: { roofLoadKg: 85 } });
const overrides = loadStammdatenOverrides();
assert.equal(overrides.ev5.towing.roofLoadKg, 85);

const q = addOpenCustomerQuestion({
  id: 'ocq-test-1',
  query: 'EV5 Dachlast',
  modelKey: 'ev5',
  field: 'roofLoad',
  status: 'open',
  createdAt: new Date().toISOString(),
});
assert.equal(q.id, 'ocq-test-1');

assert.equal(listOpenCustomerQuestions({ status: 'open' }).length, 1);

const resolved = updateOpenCustomerQuestion('ocq-test-1', {
  status: 'resolved',
  adminAnswer: 85,
});
assert.equal(resolved.status, 'resolved');

fs.rmSync(tmpDir, { recursive: true, force: true });
delete process.env.PILOT_DATA_DIR;

console.log('stammdatenStore.test.js: ok');
