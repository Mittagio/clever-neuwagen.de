/**
 * Sprint 27 – Intent, Plausibilität, strukturierte Suche
 * Ausführen: node src/services/search/sprint27.test.js
 */

import assert from 'node:assert/strict';
import { parseSearchIntent } from './searchIntentParser.js';
import { checkSearchPlausibility, applyPlausibilityCorrection } from './plausibilityChecker.js';
import { mergeUrlFiltersWithPipeline } from './searchPipeline.js';
import { filterVehiclesStructured } from './structuredSearchEngine.js';
import { MARKETPLACE_VEHICLES } from '../../data/marketplaceVehicles.js';

function parseAndCheck(input) {
  const intent = parseSearchIntent(input);
  const plausibility = checkSearchPlausibility(intent);
  return { intent, plausibility };
}

// Test 1
{
  const { intent, plausibility } = parseAndCheck(
    'Brauche sitzheizugn, kamerea hinten, schalte r780 ps',
  );
  assert.ok(intent.features.includes('heated_seats'), 'heated_seats');
  assert.ok(
    intent.features.includes('rear_camera') || intent.features.includes('parking_rear'),
    'rear camera feature',
  );
  assert.equal(intent.transmission, 'manual', 'manual transmission');
  assert.equal(intent.powerPsTarget, 780, 'powerPsTarget 780');
  const psFix = plausibility.possibleCorrections.find((c) => c.field === 'powerPsTarget');
  assert.ok(psFix, 'PS correction suggested');
  assert.match(psFix.suggestion, /78/, 'suggest 78 PS');
  console.log('✓ Test 1: Tippfehler + 780 PS Warnung');
}

// Test 2
{
  const intent = parseSearchIntent('Kleinwagen mit Sitzheizung und Automatik 70 PS');
  assert.equal(intent.bodyType, 'kleinwagen');
  assert.ok(intent.features.includes('heated_seats'));
  assert.equal(intent.transmission, 'automatic');
  assert.equal(intent.powerPsTarget, 70);
  assert.equal(intent.powerPsMin, 55);
  assert.equal(intent.powerPsMax, 85);
  console.log('✓ Test 2: Kleinwagen + PS-Toleranz');
}

// Test 3
{
  const intent = parseSearchIntent('360 Grad Kamera');
  assert.deepEqual(intent.features, ['camera_360']);
  assert.equal(intent.model, null);
  console.log('✓ Test 3: 360° Kamera, kein Ferrari');
}

// Test 4
{
  const intent = parseSearchIntent('E-Auto 400 km bis 400 € Leasing');
  assert.equal(intent.fuel, 'elektro');
  assert.equal(intent.rangeKmMin, 400);
  assert.equal(intent.payment, 'leasing');
  assert.equal(intent.maxRate, 400);
  console.log('✓ Test 4: Reichweite km vs Leasingrate');
}

// Test 5
{
  const { plausibility } = parseAndCheck('Kauf unter 400 €');
  const leasingHint = plausibility.possibleCorrections.find((c) => c.field === 'maxPrice');
  assert.ok(leasingHint, 'leasing hint');
  assert.match(leasingHint.reason, /Leasing|Monatsrate/i);
  console.log('✓ Test 5: Kauf unter 400 € → Leasing-Hinweis');
}

// Test 6
{
  const intent = parseSearchIntent('Sportage Benziner Automatik sofort verfügbar');
  assert.equal(intent.model, 'Sportage');
  assert.equal(intent.fuel, 'verbrenner');
  assert.equal(intent.transmission, 'automatic');
  assert.equal(intent.availability, 'sofort_verfuegbar');
  console.log('✓ Test 6: Sportage + Verfügbarkeit');
}

// Strukturierte Suche liefert bei 78 PS Treffer (nicht leer)
{
  const filters = mergeUrlFiltersWithPipeline({
    query: 'Brauche sitzheizugn, kamerea hinten, schalte r780 ps',
  });
  const corrected = applyPlausibilityCorrection(
    filters,
    filters.searchCorrections.find((c) => c.field === 'powerPsTarget'),
    true,
  );
  const hits = filterVehiclesStructured(MARKETPLACE_VEHICLES, corrected);
  assert.ok(hits.length > 0, 'never empty after 78 PS correction');
  console.log('✓ Strukturierte Suche: Treffer nach 78-PS-Korrektur');
}

console.log('\nAlle Sprint-27-Tests bestanden.');
