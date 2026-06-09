/**
 * Modelllinien-Gruppierung
 * node src/services/search/modelLineGroups.test.js
 */

import assert from 'node:assert/strict';
import {
  buildModelLineGroups,
  dedupeMatchesByModelLine,
  flattenModelLineGroups,
  findModelLineGroup,
} from './modelLineGroups.js';

function makeMatch(modelKey, trimId, slug, score = 80) {
  return {
    slug,
    score,
    vehicle: {
      modelKey,
      trimId,
      trim: trimId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      slug,
      model: modelKey.toUpperCase(),
    },
    cleverQuote: { percent: score },
  };
}

const ev3Air = makeMatch('ev3', 'air', 'ev3-air-a', 88);
const ev3AirDup = makeMatch('ev3', 'air', 'ev3-air-b', 84);
const ev3Earth = makeMatch('ev3', 'earth', 'ev3-earth-a', 92);
const ev3EarthDup = makeMatch('ev3', 'earth', 'ev3-earth-b', 86);
const ev3Gt = makeMatch('ev3', 'gt-line', 'ev3-gt-a', 85);
const ev2 = makeMatch('ev2', 'air', 'ev2-air', 78);

const allMatches = [ev3Air, ev3AirDup, ev3Earth, ev3EarthDup, ev3Gt, ev2];
const primaryMatches = [ev3Earth, ev2];

const groups = buildModelLineGroups(allMatches, primaryMatches);

assert.equal(groups.length, 2, 'Zwei Modelllinien');

const ev3Group = groups.find((g) => g.modelLineKey === 'ev3');
assert.ok(ev3Group, 'EV3-Gruppe vorhanden');
assert.equal(ev3Group.primaryMatch.slug, 'ev3-earth-a', 'Bester EV3 als Primary');
assert.equal(ev3Group.variantCount, 3, 'Drei Ausstattungen (Air, Earth, GT-Line)');
assert.equal(ev3Group.variants.length, 2, 'Zwei Alternativen unter Primary');
assert.equal(ev3Group.trimVariants.length, 3, 'trimVariants enthält alle Ausstattungen');
assert.deepEqual(
  ev3Group.trimVariants.map((t) => t.trimKey).sort(),
  ['air', 'earth', 'gt-line'],
  'Trim-Keys dedupliziert',
);
assert.equal(ev3Group.trimVariants.find((t) => t.isPrimary)?.trimLabel, 'Earth');

const ev2Group = groups.find((g) => g.modelLineKey === 'ev2');
assert.equal(ev2Group.variants.length, 0, 'Einzelvariante → keine Alternativen');
assert.equal(!ev2Group.hasMultipleVariants, true, 'Kein Multi-Variant-Flag');

assert.equal(flattenModelLineGroups(groups).length, 2, 'Flatten liefert Primary-Matches');
assert.equal(findModelLineGroup(groups, ev3Gt)?.modelLineKey, 'ev3');

const picantoCore = makeMatch('picanto', 'core', 'picanto-core', 70);
const picantoVision = makeMatch('picanto', 'vision', 'picanto-vision', 90);
const picantoSpirit = makeMatch('picanto', 'spirit', 'picanto-spirit', 85);
const duplicatedPrimaries = [picantoCore, picantoVision, picantoSpirit, ev2];
const deduped = dedupeMatchesByModelLine(duplicatedPrimaries);
assert.equal(deduped.length, 2, 'Nur ein Picanto in der Modellliste');
assert.equal(deduped[0].slug, 'picanto-vision', 'Bester Picanto an erster Listenposition');
const picantoGroups = buildModelLineGroups(
  [picantoCore, picantoVision, picantoSpirit],
  duplicatedPrimaries,
);
assert.equal(picantoGroups.filter((g) => g.modelLineKey === 'picanto').length, 1, 'Picanto nur einmal gruppiert');

console.log('modelLineGroups tests OK');
