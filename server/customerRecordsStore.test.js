/**
 * Kundenakten Store
 * node server/customerRecordsStore.test.js
 */

import assert from 'node:assert/strict';
import {
  upsertCustomerRecord,
  listCustomerRecords,
  getCustomerRecordById,
  patchCustomerRecord,
} from './customerRecordsStore.js';
import { customerRecordIdForShareToken } from '../src/services/sales/customerRecordModel.js';

const id = customerRecordIdForShareToken('TEST-RECORD-001');

upsertCustomerRecord({
  id,
  shareToken: 'TEST-RECORD-001',
  customer: { name: 'Tom Test', email: 'tom@test.de' },
  wishLabels: ['Elektro'],
  selectedVehicles: [{ title: 'Kia EV3', slug: 'kia-ev3-air-0', cleverQuote: 88 }],
  nextStep: 'Angebot versenden',
  dealerSlug: 'autohaus-trinkle',
});

const loaded = getCustomerRecordById(id);
assert.ok(loaded, 'Record gespeichert');
assert.equal(loaded.customer.name, 'Tom Test');

patchCustomerRecord(id, {
  nextStep: 'Kunde hat Anfrage bestätigt',
  inquiryConfirmed: true,
});

const patched = getCustomerRecordById(id);
assert.equal(patched.inquiryConfirmed, true);
assert.equal(patched.nextStep, 'Kunde hat Anfrage bestätigt');

const list = listCustomerRecords('autohaus-trinkle');
assert.ok(list.records.some((r) => r.id === id));

console.log('customerRecordsStore tests OK');
