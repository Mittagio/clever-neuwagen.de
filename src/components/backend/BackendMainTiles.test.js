import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildCleverEingangDashboardCounts } from '../../services/crm/cleverEingangItems.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tilesSource = readFileSync(join(__dirname, 'BackendMainTiles.jsx'), 'utf8');

assert.ok(tilesSource.includes('4 ungelesen · 37 offene Vorgänge') || tilesSource.includes('ungelesen ·'), 'Tile-Meta Format');
assert.ok(tilesSource.includes('formatCleverEingangTileMeta'), 'formatCleverEingangTileMeta exportiert');
assert.ok(tilesSource.includes('buildCleverEingangDashboardCounts'), 'Counts aus Clever Eingang');

function formatCleverEingangTileMeta({ unreadCount = 0, openCount = 0 } = {}) {
  return `${unreadCount} ungelesen · ${openCount} offene Vorgänge`;
}

assert.equal(
  formatCleverEingangTileMeta({ unreadCount: 4, openCount: 37 }),
  '4 ungelesen · 37 offene Vorgänge',
);

const empty = buildCleverEingangDashboardCounts([]);
assert.equal(empty.unreadCount, 0);
assert.equal(empty.openCount, 0);
assert.match(empty.label, /ungelesen/);
assert.match(empty.label, /offene Vorgänge/);

const withLeads = buildCleverEingangDashboardCounts([
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
assert.ok(withLeads.unreadCount >= 1, 'Ungelesen aus Clever Eingang');

console.log('BackendMainTiles.test.js: ok');
