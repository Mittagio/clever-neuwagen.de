/**
 * node src/services/crm/resolveOfferReference.test.js
 */
import assert from 'node:assert/strict';
import {
  resolveOfferReferenceFromText,
  trackToComposerCard,
} from './resolveOfferReference.js';

const lead = {
  id: 'lead-demo',
  crm: {
    vehicleConfigurations: [
      {
        id: 'vc-sportage',
        model: 'Sportage',
        modelKey: 'sportage',
        trimLabel: 'Vision',
        paymentType: 'leasing',
        updatedAt: '2026-07-31T10:00:00.000Z',
        vehicleTrack: { status: 'open', lastActivityAt: '2026-07-31T10:00:00.000Z' },
      },
      {
        id: 'vc-xceed',
        model: 'XCeed',
        modelKey: 'xceed',
        paymentType: 'leasing',
        updatedAt: '2026-07-30T10:00:00.000Z',
        vehicleTrack: { status: 'favorite', lastActivityAt: '2026-07-30T10:00:00.000Z' },
      },
      {
        id: 'vc-sportage-old',
        model: 'Sportage',
        modelKey: 'sportage',
        trimLabel: 'GT-Line',
        paymentType: 'leasing',
        updatedAt: '2026-07-20T10:00:00.000Z',
        vehicleTrack: { status: 'deferred', lastActivityAt: '2026-07-20T10:00:00.000Z' },
      },
    ],
    vehicleOffers: {
      'vc-sportage': {
        id: 'vo-sportage-new',
        vehicleCardId: 'vc-sportage',
        status: 'prepared',
        monthlyRate: 152.36,
        termMonths: 48,
        mileagePerYear: 10000,
        downPayment: 6000,
        updatedAt: '2026-07-31T10:00:00.000Z',
      },
      'vc-xceed': {
        id: 'vo-xceed',
        vehicleCardId: 'vc-xceed',
        status: 'sent',
        monthlyRate: 347,
        termMonths: 48,
        mileagePerYear: 15000,
        downPayment: 0,
        updatedAt: '2026-07-30T10:00:00.000Z',
      },
      'vc-sportage-old': {
        id: 'vo-sportage-old',
        vehicleCardId: 'vc-sportage-old',
        status: 'sent',
        monthlyRate: 389,
        termMonths: 42,
        mileagePerYear: 15000,
        downPayment: 0,
        updatedAt: '2026-07-20T10:00:00.000Z',
      },
    },
  },
};

const byRate = resolveOfferReferenceFromText(lead, 'Nimm das Angebot mit 152,36 Euro');
assert.equal(byRate.status, 'resolved');
assert.equal(byRate.tracks[0]?.id, 'vc-sportage');

const newest = resolveOfferReferenceFromText(lead, 'Schick ihm das neue Sportage-Angebot');
assert.equal(newest.status, 'resolved');
assert.equal(newest.tracks[0]?.id, 'vc-sportage');

const down = resolveOfferReferenceFromText(lead, 'das Angebot mit 6.000 € Anzahlung');
assert.equal(down.status, 'resolved');
assert.equal(down.tracks[0]?.id, 'vc-sportage');

const ambiguous = resolveOfferReferenceFromText(lead, 'Welches Sportage-Angebot passt?');
assert.ok(ambiguous.status === 'ambiguous' || ambiguous.tracks.length >= 1);

const card = trackToComposerCard(byRate.tracks[0]);
assert.equal(card.id, 'vc-sportage');
assert.equal(card.desiredRate, 152.36);

console.log('resolveOfferReference.test.js: ok');
