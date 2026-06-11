import assert from 'node:assert/strict';
import { recommendTrimForWishes } from './trimWishRecommendation.js';

const rec = recommendTrimForWishes('ev4', ['heat_pump', 'camera_360'], null);
assert.equal(rec.primary?.trimId, 'earth');
assert.equal(rec.vehicleTitle, 'Kia EV4');
assert.ok(rec.vehicleFitReasons.length >= 1);
assert.ok(rec.primary?.includedLines?.some((r) => /Wärmepumpe/i.test(r)));
assert.ok(rec.alternatives.some((a) => a.trimId === 'air' && a.tagline === 'günstiger'));

const gtRec = recommendTrimForWishes('ev4', [
  'heat_pump', 'camera_360', 'blind_spot', 'head_up_display', 'steering_heat',
], null);
assert.equal(gtRec.primary?.trimId, 'gt-line');

console.log('trimWishRecommendation.test.js: ok');
