/**
 * extractTowingFromPdfText – Tests
 */
import assert from 'node:assert/strict';
import {
  extractTowingFromPdfText,
  parseGermanKgNumber,
} from './extractTowingFromPdfText.js';

assert.equal(parseGermanKgNumber('1.200'), 1200);
assert.equal(parseGermanKgNumber('75011'), 750);
assert.equal(parseGermanKgNumber('keine'), null);

const ev5 = extractTowingFromPdfText(`
Zulässige Stützlast 100
Anhängelast (gebremst) 1.200 1.800
Anhängelast (ungebremst) 750
`);
assert.deepEqual(ev5.brakedKg, [1200, 1800]);
assert.equal(ev5.noseWeightKg, 100);

const sportage = extractTowingFromPdfText(`
Gebremst: 1.650 1.510 1.950 1.650
Ungebremst: 750
`);
assert.deepEqual(sportage.brakedKg, [1650, 1510, 1950, 1650]);

const picanto = extractTowingFromPdfText('ulässige Anhängelast: keine');
assert.equal(picanto.notPermitted, true);

console.log('extractTowingFromPdfText.test.js: ok');
