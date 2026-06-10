import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { splitSportagePricelist } from './splitSportagePricelist.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const sportage = JSON.parse(readFileSync(path.join(dir, 'pricelist-imports/sportage.json'), 'utf8'));
const hybrid = JSON.parse(readFileSync(path.join(dir, 'pricelist-imports/sportage-hybrid.json'), 'utf8'));

assert.equal(sportage.variantCount, 14, 'Benzin + Diesel');
assert.equal(hybrid.variantCount, 9, 'Hybrid 2WD + AWD');
assert.equal(hybrid.priceFromGross, 38990);
assert.ok(hybrid.variants.some((v) => v.trimId === 'core' && v.priceGross === 38990 && v.drive === '2WD'));
assert.ok(hybrid.variants.some((v) => v.trimId === 'spirit' && v.priceGross === 47690 && v.drive === 'AWD'));
assert.ok(sportage.variants.every((v) => !String(v.engine).toLowerCase().startsWith('hybrid')));

const resplit = splitSportagePricelist({ ...sportage, variants: [...sportage.variants, ...hybrid.variants] });
assert.equal(resplit.sportageHybrid.variantCount, 9);

console.log('splitSportagePricelist.test.js: ok');
