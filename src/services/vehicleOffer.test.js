/**
 * Fahrzeug-Angebot – Status & Hilfen
 */
import assert from 'node:assert/strict';
import {
  VEHICLE_OFFER_STATUS,
  buildOnlineOfferUrl,
  createOnlineLinkForOffer,
  createVehicleOfferFromCard,
  enrichCardWithVehicleOffer,
  formatOpenedTracking,
  formatUploadWhen,
  markOfferSent,
  mergeVehicleOffersPatch,
  recordOfferOpened,
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

console.log('vehicleOffer.test.js: OK');
