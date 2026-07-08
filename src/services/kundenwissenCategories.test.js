import assert from 'node:assert/strict';
import {
  buildKundenwissenOverview,
  categorizeKundenhelferChip,
  formatKundenwissenDisplayLabel,
  suggestKundenwissenCategory,
} from './kundenwissenCategories.js';

assert.equal(categorizeKundenhelferChip('2 Kinder'), 'familie');
assert.equal(categorizeKundenhelferChip('Kaffee schwarz'), 'vorlieben');
assert.equal(categorizeKundenhelferChip('mag rote Autos'), 'auto');
assert.equal(categorizeKundenhelferChip('bevorzugt WhatsApp'), 'kommunikation');
assert.equal(categorizeKundenhelferChip('Einkommen ca. 3.000 €'), 'geld');
assert.equal(categorizeKundenhelferChip('Finanzierung offen'), 'geld');
assert.equal(suggestKundenwissenCategory('Pferd'), 'hobby');

assert.equal(
  formatKundenwissenDisplayLabel('Einkommen ca. 3.000 €'),
  'Einkommen hinterlegt',
);

const notes = [
  'verheiratet',
  '2 Kinder',
  'Hund',
  'Kaffee schwarz',
  'bevorzugt WhatsApp',
  'Finanzierung offen',
  'mag rote Autos',
  'Einkommen ca. 3.000 €',
].join(', ');

const overview = buildKundenwissenOverview(notes);
assert.ok(overview.length >= 4, 'mehrere Kategorien');
assert.ok(overview.some((cat) => cat.id === 'familie' && cat.count >= 3));
assert.ok(overview.some((cat) => cat.id === 'geld'));
assert.equal(
  overview.find((cat) => cat.id === 'geld')?.items.some((item) => item.display === 'Einkommen hinterlegt'),
  true,
);

const understandingLead = {
  crm: {
    sellerInsights: [{
      id: 'si-1',
      text: 'Hund, 2 Kinder',
      source: 'seller',
      understoodLabels: ['Hund', '2 Kinder'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }],
  },
};
const overviewFromLead = buildKundenwissenOverview('', understandingLead);
assert.ok(
  overviewFromLead.some((cat) => cat.id === 'familie' && cat.count >= 2),
  'Kundenwissen aus Customer Understanding ohne notes',
);

console.log('kundenwissenCategories.test.js: ok');
