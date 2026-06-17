/**
 * Clever Unterlagen – Slots, Status, Summary
 */
import assert from 'node:assert/strict';
import {
  computeUnterlagenSummary,
  getUnterlagenSlotsForLead,
  getUnterlagenSubline,
  isAcceptedUnterlagenFile,
  isGewerbeLead,
  shouldElevateUnterlagen,
  UNTERLAGEN_STATUS,
} from './cleverUnterlagen.js';

const leasingSlots = getUnterlagenSlotsForLead({ paymentType: 'leasing' });
assert.ok(leasingSlots.some((s) => s.id === 'ausweis'));
assert.ok(leasingSlots.some((s) => s.id === 'gehaltsnachweis'));
assert.equal(leasingSlots.length, 5);

const cashSlots = getUnterlagenSlotsForLead({ paymentType: 'cash' });
assert.ok(cashSlots.some((s) => s.id === 'zulassungsvollmacht'));
assert.ok(!cashSlots.some((s) => s.id === 'selbstauskunft'));

const threeWay = getUnterlagenSlotsForLead({ paymentType: 'threeWayFinancing' });
assert.ok(threeWay.some((s) => s.id === 'schlussrate'));

const gewerbeSlots = getUnterlagenSlotsForLead(
  { paymentType: 'leasing', wish: { customerGroup: 'gewerbe' } },
);
assert.ok(isGewerbeLead({ wish: { customerGroup: 'gewerbe' } }));
assert.ok(gewerbeSlots.some((s) => s.id === 'gewerbenachweis'));

assert.equal(getUnterlagenSubline('cash'), 'Unterlagen für Kauf und Zulassung vorbereiten.');
assert.match(getUnterlagenSubline('leasing'), /Bank, Leasing/);

const emptySummary = computeUnterlagenSummary({ paymentType: 'leasing' });
assert.equal(emptySummary.headline, 'Noch keine Unterlagen');

const partialLead = {
  paymentType: 'leasing',
  crm: {
    cleverUnterlagen: {
      items: {
        ausweis: { status: UNTERLAGEN_STATUS.uploaded.id },
        selbstauskunft: { status: UNTERLAGEN_STATUS.uploaded.id },
      },
    },
  },
};
const partialSummary = computeUnterlagenSummary(partialLead);
assert.equal(partialSummary.headline, '2 von 5 vorbereitet');

const almostLead = {
  paymentType: 'leasing',
  crm: {
    cleverUnterlagen: {
      items: {
        ausweis: { status: 'uploaded' },
        selbstauskunft: { status: 'uploaded' },
        gehaltsnachweis: { status: 'uploaded' },
        bankverbindung: { status: 'uploaded' },
      },
    },
  },
};
assert.equal(computeUnterlagenSummary(almostLead).headline, 'Fast startklar');

assert.equal(isAcceptedUnterlagenFile({ name: 'doc.pdf', type: 'application/pdf' }), true);
assert.equal(isAcceptedUnterlagenFile({ name: 'foto.jpg', type: 'image/jpeg' }), true);
assert.equal(isAcceptedUnterlagenFile({ name: 'notes.txt', type: 'text/plain' }), false);

assert.equal(shouldElevateUnterlagen([{ offer: { status: 'sent' } }]), true);
assert.equal(shouldElevateUnterlagen([{ offer: { status: 'draft' } }]), false);

console.log('cleverUnterlagen.test.js: ok');
