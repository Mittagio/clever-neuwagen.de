import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const homeSource = readFileSync(join(__dirname, 'BackendHome.jsx'), 'utf8');
const tilesSource = readFileSync(join(__dirname, 'BackendMainTiles.jsx'), 'utf8');
const sellSource = readFileSync(join(__dirname, 'BackendVerkaufenHub.jsx'), 'utf8');
const heroSource = readFileSync(join(__dirname, 'BackendAdvisorHero.jsx'), 'utf8');
const searchSource = readFileSync(join(__dirname, 'BackendCustomerSearch.jsx'), 'utf8');
const headerSource = readFileSync(join(__dirname, '../layout/Header.jsx'), 'utf8');
const backendPageSource = readFileSync(join(__dirname, '../../pages/BackendPage.jsx'), 'utf8');

assert.ok(tilesSource.includes('Clever Eingang'), 'Kachel Clever Eingang');
assert.ok(tilesSource.includes('Fahrzeugverwaltung'), 'Kachel Fahrzeugverwaltung');
assert.ok(tilesSource.includes('Verkaufen'), 'Kachel Verkaufen');
assert.ok(tilesSource.includes('Inseratsgenerator'), 'Kachel Inseratsgenerator');
assert.ok(!tilesSource.includes("title: 'Verwaltung'"), 'Keine Verwaltungs-Kachel');
assert.ok(tilesSource.indexOf('Clever Eingang') < tilesSource.indexOf('Fahrzeugverwaltung'), 'Clever Eingang links oben');
assert.ok(tilesSource.indexOf('Verkaufen') > tilesSource.indexOf('Fahrzeugverwaltung'), 'Verkaufen unten links');
assert.ok(tilesSource.indexOf('Inseratsgenerator') > tilesSource.indexOf('Verkaufen'), 'Inseratsgenerator unten rechts');

assert.ok(sellSource.includes('Showroom Modus'), 'Verkaufen-Seite Showroom');
assert.ok(sellSource.includes('Modell wählen'), 'Verkaufen-Seite Modell');
assert.ok(sellSource.includes('Clever-Lexikon'), 'Verkaufen-Seite Lexikon');
assert.ok(sellSource.includes('Clever Beratung'), 'Verkaufen-Seite Beratung');
assert.ok(!homeSource.includes('Showroom Modus'), 'Showroom nicht auf Dashboard');
assert.ok(!homeSource.includes('Clever-Lexikon'), 'Lexikon nicht auf Dashboard');

assert.ok(headerSource.includes('header-settings'), 'Header Zahnrad');
assert.ok(headerSource.includes('/backend/verwaltung'), 'Zahnrad öffnet Verwaltung');
assert.ok(backendPageSource.includes('BackendVerkaufenHub'), 'Backend bindet Verkaufen-Seite ein');

assert.ok(homeSource.includes('BackendAdvisorHero'), 'Clever-Beratung-Hero auf Dashboard');
assert.ok(homeSource.includes('BackendCustomerSearch'), 'Kundensuche auf Dashboard');

const renderBlock = homeSource.slice(homeSource.indexOf('return ('));
assert.ok(
  renderBlock.indexOf('<BackendMainTiles') < renderBlock.indexOf('<BackendAdvisorHero')
  && renderBlock.indexOf('<BackendAdvisorHero') < renderBlock.indexOf('<BackendCustomerSearch'),
  'Reihenfolge: Kacheln → Hero → Suche',
);

console.log('BackendHome.test.js: ok');
