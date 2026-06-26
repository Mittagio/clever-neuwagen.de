import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { KPI_TILES } from '../../logic/backendKpiNavigation.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const homeSource = readFileSync(join(__dirname, 'BackendHome.jsx'), 'utf8');
const todaySource = readFileSync(join(__dirname, 'BackendHomeToday.jsx'), 'utf8');
const searchSource = readFileSync(join(__dirname, 'BackendCustomerSearch.jsx'), 'utf8');
const recentSource = readFileSync(join(__dirname, 'BackendRecentCustomers.jsx'), 'utf8');

assert.ok(homeSource.includes('Verkaufsassistent starten'), 'Dashboard zeigt Verkaufsassistent starten');
assert.ok(homeSource.includes('BackendCustomerSearch'), 'Dashboard bindet Kundensuche ein');
assert.ok(searchSource.includes('Kundenakte finden'), 'Dashboard zeigt Kundenakte finden');
assert.ok(homeSource.includes('BackendRecentCustomers'), 'Dashboard bindet Zuletzt geöffnet ein');
assert.ok(recentSource.includes('Zuletzt geöffnet'), 'Dashboard zeigt Zuletzt geöffnet');
assert.ok(todaySource.includes('Heute im Autohaus'), 'Dashboard zeigt Heute im Autohaus');
assert.ok(todaySource.includes('BackendCleverInboxTile'), 'Dashboard bindet Clever Eingang ein');
assert.ok(!homeSource.includes('Text / E-Mail einfügen'), 'Text / E-Mail einfügen nicht auf Dashboard');
assert.ok(!homeSource.includes('focusText'), 'Kein E-Mail-Einstieg über Dashboard-State');
assert.ok(homeSource.includes('resolveCustomerOpenAction'), 'Öffnen nutzt bestehende Akte-Logik');
assert.ok(homeSource.includes('recordRecentCustomerOpen'), 'Öffnen speichert zuletzt geöffnet');
assert.ok(homeSource.includes('buildKundenaktePath'), 'Navigation zur Kundenakte');

const renderBlock = homeSource.slice(homeSource.indexOf('return ('));
const heroIndex = renderBlock.indexOf('backend-home__advisor-hero');
const recentIndex = renderBlock.indexOf('<BackendRecentCustomers');
const todayIndex = renderBlock.indexOf('<BackendHomeToday');
assert.ok(heroIndex < recentIndex && recentIndex < todayIndex, 'Reihenfolge: Hero → Zuletzt → Heute');

const kpiLabels = KPI_TILES.map((tile) => tile.dashboardLabel ?? tile.label);
assert.deepEqual(kpiLabels, [
  'Angebote heiß',
  'Nachfassen',
  'Angebote geöffnet',
  'Neue Anfragen',
], 'KPI-Reihenfolge im Dashboard');

console.log('BackendHome.test.js: ok');
