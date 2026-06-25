/**
 * Kunden-Beratung – Presentation & Lead
 */
import assert from 'node:assert/strict';
import {
  buildCustomerAssessmentSummary,
  buildCustomerWishPayload,
  CUSTOMER_ADVISOR_COPY,
  presentCustomerTrimLine,
  resolveCustomerTrimRole,
} from './customerAdvisorPresentation.js';
import { createLeadFromCustomerAdvisor } from './customerAdvisorLeadService.js';

assert.ok(CUSTOMER_ADVISOR_COPY.wishesHeadline('EV4').includes('EV4'));
assert.equal(CUSTOMER_ADVISOR_COPY.reserveCta, 'Für Verkäufer vormerken');
assert.ok(!CUSTOMER_ADVISOR_COPY.contactCta.toLowerCase().includes('empfehlung'));

assert.equal(resolveCustomerTrimRole({ trimName: 'Air' }, 0, 3), 'preisbewusste Richtung');
assert.equal(resolveCustomerTrimRole({ trimName: 'Earth' }, 1, 3), 'ausgewogene Richtung');
assert.equal(resolveCustomerTrimRole({ trimName: 'GT-Line' }, 2, 3), 'viel Ausstattung / Design');

const analysis = {
  hasWishes: true,
  trimLines: [
    {
      trimId: 'earth',
      trimName: 'Earth',
      matchPercent: 82,
      fulfilled: ['Wärmepumpe', 'Reichweite'],
      missing: ['Anhängelast'],
      uncertain: [],
    },
    {
      trimId: 'gt-line',
      trimName: 'GT-Line',
      matchPercent: 75,
      fulfilled: ['360° Kamera'],
      missing: [],
      uncertain: ['Paketverfügbarkeit'],
    },
  ],
};

const summary = buildCustomerAssessmentSummary(analysis, 'Kia EV4');
assert.ok(summary.directionLabel.includes('Earth'));
assert.ok(summary.reasons.length > 0);

const presented = presentCustomerTrimLine(analysis.trimLines[0], 1, 3);
assert.equal(presented.roleLabel, 'ausgewogene Richtung');
assert.equal(presented.ctaLabel, 'Für Verkäufer vormerken');
assert.ok(presented.openPoints.length > 0);

const payload = buildCustomerWishPayload({
  modelKey: 'ev4',
  modelLabel: 'Kia EV4',
  selectedChipIds: ['waermepumpe', 'advisor_towbar'],
  searchedFeatures: [{ label: 'Beifahrersitz elektrisch' }],
  analysis,
  reservedTrimId: 'earth',
  reservedTrimName: 'Earth',
});

assert.equal(payload.source, 'customer_advisor');
assert.ok(payload.selectedChips.includes('Wärmepumpe'));
assert.equal(payload.reservedTrim, 'Earth');

const lead = createLeadFromCustomerAdvisor({
  contact: { name: 'Max', email: 'max@test.de', phone: '' },
  customerWish: payload,
  dealerConditions: { dealerId: 'test', dealerName: 'Testhaus' },
});

assert.equal(lead.source, 'customerAdvisor');
assert.equal(lead.customerWish.modelKey, 'ev4');
assert.ok(lead.customerWish.selectedChips.includes('Wärmepumpe'));
assert.equal(lead.advisorStatus, 'Beratung angefragt');

console.log('customerAdvisorPresentation.test.js: ok');
