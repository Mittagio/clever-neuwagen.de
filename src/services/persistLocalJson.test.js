import assert from 'node:assert/strict';
import { persistLocalJson, stripHeavyLocalStorageValue } from './persistLocalJson.js';

const pdf = `data:application/pdf;base64,${'A'.repeat(8_000)}`;

const stripped = stripHeavyLocalStorageValue({
  id: 'lead-1',
  crm: {
    vehicleOffers: {
      a: {
        pdf: { fileName: 'EV3.pdf', dataUrl: pdf },
        source: { originalPdf: { fileName: 'EV3.pdf', dataUrl: pdf } },
      },
    },
  },
  note: 'behalten',
});

assert.equal(stripped.note, 'behalten');
assert.equal(stripped.crm.vehicleOffers.a.pdf.fileName, 'EV3.pdf');
assert.equal(stripped.crm.vehicleOffers.a.pdf.dataUrl, null);
assert.equal(stripped.crm.vehicleOffers.a.source.originalPdf.dataUrl, null);

const store = new Map();
globalThis.localStorage = {
  setItem(key, value) {
    if (value.length > 4_000) {
      const err = new Error("Failed to execute 'setItem' on 'Storage': Setting the value of 'clever-neuwagen-leads' exceeded the quota.");
      err.name = 'QuotaExceededError';
      err.code = 22;
      throw err;
    }
    store.set(key, value);
  },
  getItem(key) {
    return store.get(key) ?? null;
  },
};

const fat = [{
  id: 'lead-inbound-1',
  updatedAt: '2026-09-30T10:00:00.000Z',
  crm: { vehicleOffers: { a: { pdf: { fileName: 'EV3.pdf', dataUrl: pdf } } } },
}];

assert.doesNotThrow(() => persistLocalJson('clever-neuwagen-leads', fat));
const saved = JSON.parse(localStorage.getItem('clever-neuwagen-leads'));
assert.equal(saved[0].id, 'lead-inbound-1');
assert.equal(saved[0].crm.vehicleOffers.a.pdf.fileName, 'EV3.pdf');
assert.equal(saved[0].crm.vehicleOffers.a.pdf.dataUrl, null);

const result = persistLocalJson('clever-neuwagen-leads', fat);
assert.equal(result.ok, true);
