/**
 * Ausstattungsberatung – aktive Trim-Auswahl
 */
import assert from 'node:assert/strict';
import { resolveActiveEquipmentRecommendation } from './equipmentWishAdvisor.js';

const analysis = {
  hasWishes: true,
  recommendation: {
    trimId: 'core',
    trimName: 'Core',
    label: 'Core + Design Paket',
    packageIds: ['design'],
    packageNames: ['Design Paket'],
    reasons: ['Clever Empfehlung'],
  },
  trimLines: [
    { trimId: 'core', trimName: 'Core', matchPercent: 72, badge: 'Günstigste Rate' },
    { trimId: 'vision', trimName: 'Vision', matchPercent: 88, badge: 'Clever Empfehlung' },
    { trimId: 'gt-line', trimName: 'GT-Line', matchPercent: 65, badge: 'Premium' },
  ],
};

const vision = resolveActiveEquipmentRecommendation(analysis, 'vision');
assert.equal(vision.trimId, 'vision');
assert.equal(vision.trimName, 'Vision');
assert.equal(vision.matchPercent, 88);
assert.equal(vision.packageIds.length, 0);
assert.ok(vision.reasons.some((r) => r.includes('88')));

const gt = resolveActiveEquipmentRecommendation(analysis, 'gt-line');
assert.equal(gt.trimName, 'GT-Line');

const core = resolveActiveEquipmentRecommendation(analysis, 'core');
assert.equal(core.label, 'Core + Design Paket');
assert.deepEqual(core.packageIds, ['design']);

console.log('equipmentWishAdvisor.test.js: ok');
