/**
 * Verified Technical Data Registry – Tests
 */
import assert from 'node:assert/strict';
import {
  getVerifiedTechnicalProfile,
  listAllVerifiedModelKeys,
  listRegisteredBrands,
  listTechnicalDataGapsForModel,
  matchVerifiedVariants,
} from '../../data/technical/verifiedTechnicalDataRegistry.js';

// Kia: alle PDF-Profile
const kiaKeys = listAllVerifiedModelKeys();
assert.ok(kiaKeys.length >= 24, `Mindestens 24 Kia-Profile, got ${kiaKeys.length}`);
assert.ok(kiaKeys.includes('ev5'));
assert.ok(kiaKeys.includes('sorento'));
assert.ok(kiaKeys.includes('k4-sportswagon'));
assert.ok(kiaKeys.includes('sportage-hybrid'));

// Nur Kia aktiv
const brands = listRegisteredBrands();
assert.equal(brands.length, 1);
assert.equal(brands[0].key, 'kia');
assert.ok(brands[0].modelCount >= 24);

// EV5 204 PS – Mismatch
const ev5mismatch = matchVerifiedVariants('ev5', { powerPs: 204, driveType: null });
assert.equal(ev5mismatch.powerPsMismatch, true);
assert.equal(ev5mismatch.matched.length, 0);

// EV5 218 PS – FWD 1200
const ev5match = matchVerifiedVariants('ev5', { powerPs: 218, driveType: null });
assert.equal(ev5match.matched.length, 1);
assert.equal(ev5match.matched[0].towing.brakedKg, 1200);

// Sorento – Profil vorhanden
const sorento = getVerifiedTechnicalProfile('sorento');
assert.ok(sorento);
assert.equal(sorento.variants[0].towing.brakedKg, 2500);

// Ceed – noch keine PDF
const ceedGaps = listTechnicalDataGapsForModel('ceed');
assert.equal(ceedGaps[0].status, 'needs_review');

// Picanto – keine Anhängelast (verified)
const picanto = getVerifiedTechnicalProfile('picanto');
assert.ok(picanto);
assert.equal(picanto.variants[0].towing.permitted, false);

console.log('verifiedTechnicalDataRegistry.test.js: ok');
