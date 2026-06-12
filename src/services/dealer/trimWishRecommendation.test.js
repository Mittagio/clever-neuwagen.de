import assert from 'node:assert/strict';
import { buildUpgradePitch, recommendTrimForWishes } from './trimWishRecommendation.js';

const rec = recommendTrimForWishes('ev4', ['heat_pump', 'camera_360'], null);
assert.equal(rec.primary?.trimId, 'earth');
assert.equal(rec.vehicleTitle, 'Kia EV4');
assert.ok(rec.vehicleFitReasons.length >= 1);
assert.ok(rec.primary?.includedLines?.some((r) => /Wärmepumpe/i.test(r)));
assert.ok(rec.alternatives.some((a) => a.trimId === 'air' && a.tagline === 'günstiger'));
assert.ok(rec.recommendationWhy.length >= 1);

const gtRec = recommendTrimForWishes('ev4', [
  'heat_pump', 'camera_360', 'blind_spot', 'head_up_display', 'steering_heat',
], null);
assert.equal(gtRec.primary?.trimId, 'gt-line');

const pv5 = recommendTrimForWishes(
  'pv5-passenger',
  ['heated_seats', 'heat_pump', 'power_sliding_doors'],
  null,
  null,
  ['heated_seats', 'heat_pump', 'sliding_doors'],
);
assert.equal(pv5.primary?.trimId, 'earth');
assert.equal(pv5.allTrims.length, 3);
const earthPick = pv5.allTrims.find((trim) => trim.trimId === 'earth');
const elitePick = pv5.allTrims.find((trim) => trim.trimId === 'elite');
assert.ok(earthPick.cleverQuotePercent < elitePick.cleverQuotePercent);
assert.ok(earthPick.wishChipLines.missing.includes('Elektrische Schiebetüren'));

const upgrade = buildUpgradePitch(pv5, 'earth', ['heated_seats', 'heat_pump', 'sliding_doors']);
assert.equal(upgrade?.toTrimId, 'elite');
assert.ok(upgrade.extras.some((line) => /Schiebetüren/i.test(line)));

console.log('trimWishRecommendation.test.js: ok');
