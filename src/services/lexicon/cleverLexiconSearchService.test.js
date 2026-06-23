/**
 * Clever-Lexikon – Such-Service Tests
 */
import assert from 'node:assert/strict';
import { registerDefaultEquipmentImports } from '../configuration/equipmentImportLoader.js';
import {
  parseLexiconQuery,
  resolveLexiconModel,
  resolveLexiconIntent,
  searchCleverLexicon,
} from './cleverLexiconSearchService.js';
import { FEATURE_AVAILABILITY_STATUS as S } from '../../data/features/modelEquipmentSchema.js';

registerDefaultEquipmentImports();
// 1. EV4 Batterie – technische Daten
const battery = searchCleverLexicon('EV4 Batterie');
assert.equal(battery.ok, true);
assert.equal(battery.result.intentType, 'technical');
assert.equal(battery.result.modelKey, 'ev4');
assert.equal(battery.result.fieldLabel, 'Batterie');
assert.ok(battery.result.primaryFacts.length > 0);
assert.match(battery.result.primaryFacts[0].value, /kWh/);
assert.ok(battery.result.relatedFacts.length <= 4, 'Nur passende Zusatzdaten');
assert.ok(!battery.result.availabilityByTrim?.length, 'Keine Trim-Tabelle bei Batterie');

// 2. EV4 Wärmepumpe – Feature-Resolver
const heat = searchCleverLexicon('EV4 Wärmepumpe');
assert.equal(heat.ok, true);
assert.match(heat.result.fieldLabel, /Wärmepumpe/i);
assert.ok(heat.result.availabilityByTrim.length >= 2, 'Linien-Verfügbarkeit');
const air = heat.result.availabilityByTrim.find((r) => /air/i.test(r.trim));
const earth = heat.result.availabilityByTrim.find((r) => /earth/i.test(r.trim));
assert.ok(air, 'Air-Linie vorhanden');
assert.ok(earth, 'Earth-Linie vorhanden');
assert.notEqual(heat.result.shortAnswer, 'Bitte im Katalog prüfen');

// 3. EV3 Head-up Display – Paket/Linien (Importdaten)
const hud = searchCleverLexicon('EV3 Head-up Display');
assert.equal(hud.ok, true);
assert.match(hud.result.fieldLabel, /Head-up/i);
assert.ok(hud.result.availabilityByTrim.length >= 2);
const hudPackage = hud.result.availabilityByTrim.some(
  (r) => r.status === S.PACKAGE_REQUIRED || /paket/i.test(r.label),
);
assert.ok(hudPackage, 'Paketbezug erkennbar');

// 4. Sportage Anhängelast – fokussiert, nicht Vollübersicht
const tow = searchCleverLexicon('Sportage Anhängelast');
assert.equal(tow.ok, true);
assert.equal(tow.result.intentType, 'technical');
assert.equal(tow.result.fieldLabel, 'Anhängelast');
assert.match(tow.result.primaryFacts[0].value, /kg/);
const towExtras = tow.result.relatedFacts ?? tow.result.extras ?? [];
assert.ok(towExtras.length < 6, 'Keine pauschale Eckdaten-Liste');

// 5. EV3 V2L – Synonym globalFeatureCatalog
const v2l = searchCleverLexicon('EV3 V2L');
assert.equal(v2l.ok, true);
assert.match(v2l.result.fieldLabel, /V2L|Vehicle-to-Load/i);

// 6. Unbekanntes Feature – sauberer Hinweis
const unknown = searchCleverLexicon('EV4 Flugmodus');
assert.equal(unknown.ok, false);
assert.ok(unknown.error || unknown.result?.shortAnswer);

// 7. Fehlendes Modell
const noModel = searchCleverLexicon('Wärmepumpe');
assert.equal(noModel.ok, false);
assert.match(noModel.error, /Modell/i);

// 8. Unsichere Daten – Warnhinweis bei leerem Feature
const parsedUnknown = parseLexiconQuery('EV4 Flugmodus');
const intentUnknown = resolveLexiconIntent('EV4 Flugmodus', parsedUnknown.model);
if (intentUnknown.type === 'unknown') {
  const res = searchCleverLexicon('EV4 Flugmodus');
  assert.equal(res.ok, false);
}

// 9. Nicht alle technischen Daten bei Ausstattungsfrage
const heatExtras = heat.result.relatedFacts ?? heat.result.extras ?? [];
assert.ok(
  !heatExtras.some((e) => e.label === 'Breite' && e.label === 'Höhe'),
  'Keine generische Maßliste bei Wärmepumpe',
);

// 10. Quelle wird angezeigt
assert.ok(battery.result.source, 'Quelle bei technischer Antwort');
assert.ok(heat.result.source, 'Quelle bei Ausstattungsantwort');

// Intent-Parsing
const model = resolveLexiconModel('kia ev4 fastback batterie');
assert.equal(model?.modelKey, 'ev4-fastback');
const intent = resolveLexiconIntent('EV4 Länge', resolveLexiconModel('EV4 Länge'));
assert.equal(intent.type, 'technical');
assert.equal(intent.topic.id, 'length');

console.log('cleverLexiconSearchService.test.js: ok');
