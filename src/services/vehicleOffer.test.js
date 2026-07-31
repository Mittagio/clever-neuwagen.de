/**
 * Fahrzeug-Angebot – Status & Hilfen
 */
import assert from 'node:assert/strict';
import {
  VEHICLE_OFFER_STATUS,
  VEHICLE_OFFER_STATUS_UI,
  buildOnlineOfferUrl,
  createNextOfferVersion,
  createOnlineLinkForOffer,
  createVehicleOfferFromCard,
  enrichCardWithVehicleOffer,
  formatOpenedTracking,
  formatUploadWhen,
  isScenarioOfferReady,
  markOfferPrepared,
  markOfferSent,
  mergeVehicleOffersPatch,
  recordOfferOpened,
  shouldBumpOfferVersionOnSave,
} from './vehicleOffer.js';
import {
  buildVehicleOpportunityCards,
} from './customerAkte.js';

const url = buildOnlineOfferUrl({
  modelName: 'Kia EV3 Earth',
  customerName: 'Max Müller',
  leadId: 'lead-99',
  vehicleCardId: 'card-1',
});
assert.ok(url.includes('/angebot/online/'));
assert.ok(url.includes('ev3-earth'));
assert.ok(url.includes('max-muller'));
assert.ok(url.includes('leadId=lead-99'));
assert.ok(url.includes('cardId=card-1'));

const card = { id: 'ev3-1', modelName: 'Kia EV3', paymentType: 'leasing' };
const offer = createVehicleOfferFromCard(card);
assert.equal(offer.status, VEHICLE_OFFER_STATUS.DRAFT);
assert.equal(offer.vehicleCardId, 'ev3-1');

assert.equal(VEHICLE_OFFER_STATUS.PREPARED, 'prepared');
assert.equal(VEHICLE_OFFER_STATUS_UI.prepared.badge, 'Vorbereitet');

const prepared = markOfferPrepared(offer);
assert.equal(prepared.status, VEHICLE_OFFER_STATUS.PREPARED);
assert.ok(prepared.preparedAt);
assert.equal(isScenarioOfferReady(prepared), true);

const withLink = createOnlineLinkForOffer(
  { ...offer, pdf: { fileName: 'test.pdf', uploadedAt: new Date().toISOString() } },
  { modelName: 'Kia EV3', customerName: 'Max' },
);
assert.equal(withLink.status, VEHICLE_OFFER_STATUS.LINK_READY);
assert.ok(withLink.onlineLink?.url);

const sent = markOfferSent(withLink, 'whatsapp');
assert.equal(sent.status, VEHICLE_OFFER_STATUS.SENT);
assert.equal(sent.sentVia, 'whatsapp');

const opened = recordOfferOpened(sent);
assert.equal(opened.status, VEHICLE_OFFER_STATUS.OPENED);
assert.equal(opened.tracking.openCount, 1);

assert.equal(formatOpenedTracking({ openCount: 0 }), 'Noch nicht geöffnet');
assert.ok(formatOpenedTracking(opened.tracking).includes('geöffnet'));

const merged = mergeVehicleOffersPatch({ crm: {} }, 'ev3-1', opened);
assert.ok(merged['ev3-1']?.onlineLink?.url);

const enriched = enrichCardWithVehicleOffer(card, merged);
assert.equal(enriched.offer.status, VEHICLE_OFFER_STATUS.OPENED);

const cards = buildVehicleOpportunityCards({
  lead: {
    id: 'lead-1',
    crm: { vehicleOffers: merged },
  },
  wishFields: {
    model: 'EV3',
    trimLabel: 'Earth',
    paymentType: 'leasing',
    termMonths: 48,
    mileagePerYear: 10000,
    desiredRate: 399,
  },
  reservedModels: [{ id: 'ev3-1', name: 'EV3', modelKey: 'ev3', trimLabel: 'Earth' }],
  offers: [],
});

assert.equal(cards[0].vehicleOffer?.status, VEHICLE_OFFER_STATUS.OPENED);

const when = formatUploadWhen(new Date().toISOString());
assert.ok(when.startsWith('Heute'));

// Version bump behält PDF im Snapshot
{
  const v1 = createVehicleOfferFromCard({ id: 'ev3-pdf' }, {
    id: 'vo-ev3-pdf',
    vehicleCardId: 'ev3-pdf',
    status: VEHICLE_OFFER_STATUS.PREPARED,
    version: 1,
    monthlyRate: 399,
    pdf: { fileName: 'EV3_v1.pdf', dataUrl: 'data:application/pdf;base64,AAA' },
    source: {
      createdFrom: 'magic_offer_pdf',
      originalPdf: { fileName: 'EV3_v1.pdf', dataUrl: 'data:application/pdf;base64,AAA' },
    },
    preparedAt: '2026-07-30T10:00:00.000Z',
  });
  assert.equal(shouldBumpOfferVersionOnSave(v1), true);
  const v2 = createNextOfferVersion(v1, {
    monthlyRate: 379,
    pdf: { fileName: 'EV3_v2.pdf', dataUrl: 'data:application/pdf;base64,BBB' },
    source: {
      createdFrom: 'magic_offer_pdf',
      originalPdf: { fileName: 'EV3_v2.pdf', dataUrl: 'data:application/pdf;base64,BBB' },
    },
  });
  assert.equal(v2.version, 2);
  assert.equal(v2.versions.length, 1);
  assert.equal(v2.versions[0].pdf?.fileName, 'EV3_v1.pdf');
  assert.equal(v2.versions[0].originalPdf?.fileName, 'EV3_v1.pdf');
  assert.ok(v2.versions[0].pdf?.dataUrl);
  const preparedV2 = markOfferPrepared(v2);
  assert.equal(preparedV2.status, VEHICLE_OFFER_STATUS.PREPARED);
  assert.equal(preparedV2.pdf?.fileName, 'EV3_v2.pdf');
}

console.log('vehicleOffer.test.js: OK');
