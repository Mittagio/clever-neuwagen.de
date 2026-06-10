import assert from 'node:assert/strict';
import {
  buildModelFitRecommendation,
  enrichFitGroups,
} from './modelFitRecommendation.js';

const ev2 = buildModelFitRecommendation('ev2');
assert.ok(ev2);
assert.match(ev2, /Stadt|Pendeln|Kompakt/i);

const ev9 = buildModelFitRecommendation('ev9');
assert.ok(ev9);
assert.match(ev9, /Familie|lang|Anhänger|Geräumig/i);

const groups = enrichFitGroups([
  { modelLineKey: 'ev2', primaryMatch: { vehicle: { modelKey: 'ev2' } } },
]);
assert.ok(groups[0].fitRecommendation);

console.log('modelFitRecommendation.test.js: ok');
