/**
 * Dashboard-Empfehlungen: Dedup nach Kunde, keine Score-Sortierung.
 */
import assert from 'node:assert/strict';
import {
  buildDashboardTodayRecommendations,
  customerDedupeKey,
  dedupeRecommendationsByCustomer,
} from './buildDashboardTodayRecommendations.js';
import { VEHICLE_OFFER_STATUS } from '../vehicleOffer.js';

const MS_DAY = 86400000;
const now = new Date();

function openedLead(id, name, phone, extras = {}) {
  return {
    id,
    status: 'inBearbeitung',
    name,
    contact: { name, phone, email: extras.email || '' },
    crm: {
      cleverUnterlagen: { items: {} },
      followUpAt: extras.followUpAt || now.toISOString(),
      nextStepLabel: extras.nextStepLabel || 'Heute nachfassen',
      vehicleOffers: {
        [`vc-${id}`]: {
          status: VEHICLE_OFFER_STATUS.OPENED,
          sentAt: new Date(Date.now() - 2 * MS_DAY).toISOString(),
          tracking: { lastOpenedAt: new Date(Date.now() - 25 * 3600000).toISOString() },
        },
      },
      vehicleConfigurations: [{
        id: `vc-${id}`,
        model: 'EV4',
        trimLabel: 'Earth',
        paymentType: 'leasing',
      }],
    },
  };
}

const brandesA = openedLead('brandes-a', 'Herr Brandes', '01701112233');
const brandesB = openedLead('brandes-b', 'Herr Brandes', '0170 1112233', {
  email: 'brandes@example.com',
});
const other = openedLead('other-1', 'Frau Maier', '01709876543');

assert.equal(
  customerDedupeKey(brandesA),
  customerDedupeKey(brandesB),
  'Brandes-Duplikate teilen denselben Dedup-Key (Telefon)',
);

const items = buildDashboardTodayRecommendations([brandesA, brandesB, other], { maxItems: 10 });
const brandesHits = items.filter((i) => /brandes/i.test(i.customerName));
assert.equal(brandesHits.length, 1, 'Ein Kunde Brandes nur einmal');
assert.ok(items.some((i) => /maier/i.test(i.customerName)), 'Anderer Kunde bleibt');

for (const item of items) {
  assert.equal(item.stars, undefined, 'Keine Sterne im Dashboard-Item');
  assert.equal(item.closureChance, undefined, 'Keine Abschluss-% im Dashboard-Item');
  assert.ok(item.ctaLabel, 'CTA vorhanden');
  assert.ok(item.whySummary || item.reasons?.length, 'Nachvollziehbarer Grund');
}

const deduped = dedupeRecommendationsByCustomer([
  { leadId: 'brandes-a', customerName: 'Herr Brandes', priority: 80, whySummary: 'A' },
  { leadId: 'brandes-b', customerName: 'Herr Brandes', priority: 60, whySummary: 'B' },
], [brandesA, brandesB]);
assert.equal(deduped.length, 1);
assert.equal(deduped[0].leadId, 'brandes-b', 'Niedrigere Priority gewinnt');

console.log('buildDashboardTodayRecommendations.test.js: ok');
