import assert from 'node:assert/strict';
import {
  buildModelTypeLine,
  buildPreConsultationSummaryLines,
  buildPreConsultationWishPayload,
  collectPreConsultationChipIds,
} from './customerPreConsultationService.js';
import { PRECONSULT_COPY } from '../../data/dealer/customerPreConsultationSteps.js';

assert.equal(buildModelTypeLine('ev3'), 'Elektro-SUV');
assert.equal(buildModelTypeLine('niro'), 'Hybrid-SUV');

const chipIds = collectPreConsultationChipIds({
  priorityIds: ['range', 'family'],
  usageIds: ['trailer'],
  equipmentIds: ['sitzheizung_vorne'],
});
assert.ok(chipIds.includes('advisor_range_max'));
assert.ok(chipIds.includes('advisor_towbar'));

const summary = buildPreConsultationSummaryLines({
  modelLabel: 'Kia EV3',
  priorityIds: ['range'],
  usageIds: ['family'],
  equipmentIds: ['sitzheizung_vorne'],
});
assert.ok(summary.some((l) => l.includes('EV3')));
assert.ok(summary.some((l) => /Reichweite|reichweite/i.test(l)));

const payload = buildPreConsultationWishPayload({
  modelKey: 'ev3',
  modelLabel: 'Kia EV3',
  priorityIds: ['range'],
  usageIds: ['family'],
  equipmentIds: ['sitzheizung_vorne'],
  brand: 'Kia',
  model: 'EV3',
});
assert.equal(payload.source, 'customer_advisor');
assert.equal(payload.consultationType, 'pre_consultation');
assert.equal(payload.statusHint, 'Beratung angefragt');
assert.equal(payload.nextStepHint, 'Expertenkontakt aufnehmen');
assert.ok(payload.possibleDirection);
assert.ok(PRECONSULT_COPY.contactCta.includes('Experte'));

console.log('customerPreConsultationService.test.js: ok');
