/**
 * node src/services/crm/composerWorkingContext.test.js
 */
import assert from 'node:assert/strict';
import {
  WORKING_CONTEXT_KINDS,
  buildDocumentWorkingContextItem,
  buildOfferWorkingContextItem,
  findOfferWorkingContext,
  listAttachableAkteDocuments,
  removeWorkingContextItem,
  toCurrentOfferContext,
  upsertWorkingContextItem,
} from './composerWorkingContext.js';

const card = {
  id: 'vc-ev4',
  modelName: 'Kia EV4',
  modelKey: 'ev4',
  trimLabel: 'GT-Line',
  termMonths: 48,
  mileagePerYear: 20000,
  desiredRate: 349,
  paymentType: 'leasing',
  downPayment: 0,
};

const item = buildOfferWorkingContextItem(card);
assert.equal(item.kind, WORKING_CONTEXT_KINDS.OFFER);
assert.equal(item.offerId, 'vc-ev4');
assert.match(item.label, /EV4/i);
assert.match(item.shortLabel, /48 M/i);
assert.match(item.shortLabel, /20\.000 km|20000/i);
assert.match(item.shortLabel, /0 € AZ/i);

const ctx = toCurrentOfferContext(item);
assert.equal(ctx.offerId, 'vc-ev4');
assert.equal(ctx.termMonths, 48);
assert.equal(ctx.mileagePerYear, 20000);

let list = upsertWorkingContextItem([], item);
assert.equal(list.length, 1);

const other = buildOfferWorkingContextItem({
  ...card,
  id: 'vc-ev3',
  modelName: 'Kia EV3',
  modelKey: 'ev3',
  desiredRate: 319,
});
list = upsertWorkingContextItem(list, other);
assert.equal(list.length, 1, 'zweites Angebot ersetzt das erste');
assert.equal(list[0].offerId, 'vc-ev3');

list = upsertWorkingContextItem(list, {
  id: 'doc:1',
  kind: WORKING_CONTEXT_KINDS.DOCUMENT,
  label: 'Preisliste',
});
assert.equal(list.length, 2);
assert.equal(findOfferWorkingContext(list)?.offerId, 'vc-ev3');

const docItem = buildDocumentWorkingContextItem({
  id: 'slot:ausweis',
  slotId: 'ausweis',
  label: 'Ausweis',
  fileName: 'ausweis.pdf',
});
assert.equal(docItem.kind, WORKING_CONTEXT_KINDS.DOCUMENT);
assert.match(docItem.shortLabel, /Ausweis/i);

const attachable = listAttachableAkteDocuments({
  crm: {
    cleverUnterlagen: {
      items: {
        ausweis: { status: 'uploaded', fileName: 'ausweis.pdf' },
      },
      documents: [{ id: 'd1', label: 'DAT', fileName: 'dat.pdf' }],
    },
  },
}, {
  slots: [{ id: 'ausweis', label: 'Ausweis' }],
  items: { ausweis: { status: 'uploaded', fileName: 'ausweis.pdf' } },
});
assert.ok(attachable.some((d) => d.slotId === 'ausweis'));
assert.ok(attachable.some((d) => /DAT/i.test(d.label)));

list = removeWorkingContextItem(list, 'doc:1');
assert.equal(list.length, 1);

console.log('composerWorkingContext.test.js: OK');
