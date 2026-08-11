import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildCleverEingangDashboardCounts } from '../../services/crm/cleverEingangItems.js';
import {
  buildBackendHomeEingangStats,
  formatCleverEingangHomeStats,
} from '../../logic/backendHomeStats.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tilesSource = readFileSync(join(__dirname, 'BackendMainTiles.jsx'), 'utf8');
const toolsSource = readFileSync(join(__dirname, 'BackendHomeTools.jsx'), 'utf8');
const widgetsSource = readFileSync(join(__dirname, 'BackendHomeWidgets.jsx'), 'utf8');

assert.ok(tilesSource.includes('formatCleverEingangTileMeta'), 'Legacy-Meta bleibt exportiert');
assert.ok(toolsSource.includes('Fahrzeugverwaltung'), 'Werkzeug Fahrzeugverwaltung');
assert.ok(toolsSource.includes('Inseratsgenerator'), 'Werkzeug Inseratsgenerator');
assert.ok(toolsSource.includes('Showroom'), 'Werkzeug Showroom');
assert.ok(toolsSource.includes('Modellwelt'), 'Werkzeug Modellwelt');
assert.ok(widgetsSource.includes('buildBackendHomeEingangStats'), 'Eingang-Stats Helper');
assert.ok(widgetsSource.includes('buildBackendHomeWorkStats'), 'Work-Stats Helper');

function formatCleverEingangTileMeta({ unreadCount = 0, openCount = 0 } = {}) {
  return `${unreadCount} ungelesen · ${openCount} offene Vorgänge`;
}

assert.equal(
  formatCleverEingangTileMeta({ unreadCount: 4, openCount: 37 }),
  '4 ungelesen · 37 offene Vorgänge',
);

const formatted = formatCleverEingangHomeStats({
  openCount: 38,
  summary: { review: 5, duplicates: 0 },
});
assert.equal(formatted.openLabel, '38 offen');
assert.equal(formatted.needsYouLabel, '5 brauchen dich');
assert.equal(formatted.decisionLabel, '5 brauchen dich');

const empty = buildCleverEingangDashboardCounts([]);
assert.equal(empty.unreadCount, 0);
assert.equal(empty.openCount, 0);

const withLeads = buildBackendHomeEingangStats([
  {
    id: 'n1',
    status: 'neu',
    unread: true,
    contact: { name: 'Neu Eins', email: 'a@test.de' },
    createdAt: new Date().toISOString(),
    source: 'email',
  },
  {
    id: 'n2',
    status: 'neu',
    unread: true,
    contact: { name: 'Neu Zwei', phone: '01701111111' },
    createdAt: new Date().toISOString(),
    source: 'homepage',
  },
]);
assert.ok(withLeads.openCount >= 1, 'Offene Vorgänge aus Clever Eingang');
assert.ok(withLeads.openLabel.includes('offen'), 'Home-Label offen');

console.log('BackendMainTiles.test.js: ok');
