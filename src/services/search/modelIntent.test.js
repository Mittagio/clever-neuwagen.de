import assert from 'node:assert/strict';
import { parseSearchIntent } from './searchIntentParser.js';
import { isModelExplicitlyRequested, shouldApplyModelFilter } from './modelIntent.js';

assert.equal(
  isModelExplicitlyRequested('E-Auto bis 400 €', { model: 'EV3', brand: 'Kia' }),
  false,
);

const open = parseSearchIntent('E-Auto bis 400 €');
assert.equal(open.model, null);
assert.equal(open.modelExplicit, false);
assert.equal(open.fuel, 'elektro');
assert.equal(open.maxRate, 400);

const specific = parseSearchIntent('Kia EV3 bis 400 €');
assert.equal(specific.model, 'EV3');
assert.equal(specific.modelExplicit, true);
assert.equal(specific.brand, 'Kia');

assert.equal(
  shouldApplyModelFilter({ modelExplicit: false, model: 'EV3' }),
  false,
);
assert.equal(
  shouldApplyModelFilter({ modelExplicit: true, model: 'EV3' }),
  true,
);

console.log('✓ Modell-Intent-Tests bestanden.');
