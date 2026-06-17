/**
 * Clever Selbstauskunft – Tests
 */
import assert from 'node:assert/strict';
import {
  needsSelbstauskunft,
  createSelbstauskunftLink,
  formatSelbstauskunftSummary,
  getSelbstauskunftStatusUi,
  SELBSTAUSKUNFT_STATUS,
  getCustomerUploadSlots,
} from './cleverSelbstauskunft.js';
import {
  buildSelfDisclosureUrl,
  createSelfDisclosureSession,
  getSelfDisclosureByToken,
  markSelfDisclosureOpened,
  submitSelfDisclosure,
} from '../logic/selfDisclosureService.js';

assert.equal(needsSelbstauskunft('leasing'), true);
assert.equal(needsSelbstauskunft('financing'), true);
assert.equal(needsSelbstauskunft('threeWayFinancing'), true);
assert.equal(needsSelbstauskunft('cash'), false);

const lead = {
  id: 'lead-sa-1',
  paymentType: 'leasing',
  contact: { name: 'Max Müller', email: 'max@test.de' },
  referenceCode: 'REF-1',
};

const unterlagen = createSelbstauskunftLink({ items: {} }, lead, {
  paymentType: 'leasing',
  vehicleTitle: 'Kia EV3',
  vehicleConditions: '48 Monate · 10.000 km',
});

assert.ok(unterlagen.selbstauskunft?.link?.url?.includes('/customer/self-disclosure/'));
assert.equal(unterlagen.selbstauskunft.status, SELBSTAUSKUNFT_STATUS.link_sent.id);

const token = unterlagen.selbstauskunft.link.token;
const session = getSelfDisclosureByToken(token);
assert.ok(session);
assert.equal(session.vehicleTitle, 'Kia EV3');

const opened = markSelfDisclosureOpened(token);
assert.equal(opened.status, 'opened');

const submitted = submitSelfDisclosure(token, { personal: { name: 'Max' } });
assert.equal(submitted.status, 'completed');

assert.equal(
  formatSelbstauskunftSummary({ status: 'completed' }, 3),
  'Ausgefüllt · 3 Unterlagen hochgeladen',
);
assert.equal(getSelbstauskunftStatusUi('in_progress').label, 'In Bearbeitung');

assert.equal(getCustomerUploadSlots(false).length, 6);
assert.ok(getCustomerUploadSlots(true).some((s) => s.id === 'gewerbenachweis'));

console.log('cleverSelbstauskunft.test.js: ok');
