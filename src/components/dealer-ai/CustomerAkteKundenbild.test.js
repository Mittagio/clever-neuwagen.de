/**
 * Kundenbild-Chips: Quelle über Optik, kein Prioritäts-Badge-Text.
 * node src/components/dealer-ai/CustomerAkteKundenbild.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildKnowledgeChipProvenanceTitle,
  formatEquipmentWishLabel,
  EQUIPMENT_WISH_PRIORITY,
  normalizeKnowledgeChipSource,
  stripEquipmentPrioritySuffix,
} from '../../services/dealer/buildCustomerSnapshotModel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsx = readFileSync(join(__dirname, 'CustomerAkteKundenbild.jsx'), 'utf8');
const css = readFileSync(join(__dirname, 'CustomerAkteKundenbild.css'), 'utf8');

assert.ok(!jsx.includes('cust-kundenbild__chip-prio'), 'kein Prio-Badge-Markup');
assert.ok(!jsx.includes('priority.label'), 'kein sichtbarer Prioritäts-Text');
assert.ok(jsx.includes('stripEquipmentPrioritySuffix'), 'Anzeige strippt Equipment-Suffix');
assert.ok(jsx.includes('chipSourceClass'), 'Source-CSS-Klasse');
assert.ok(jsx.includes('cust-kundenbild__chip--source-customer'), 'Customer-Source-Klasse');
assert.ok(jsx.includes('cust-kundenbild__chip--source-seller'), 'Seller-Source-Klasse');
assert.ok(jsx.includes('buildKnowledgeChipProvenanceTitle'), 'Hover-Provenance');

assert.ok(css.includes('.cust-kundenbild__chip--source-customer'), 'Customer-Optik in CSS');
assert.ok(css.includes('.cust-kundenbild__chip--source-seller'), 'Seller-Optik in CSS');
assert.ok(!css.includes('.cust-kundenbild__chip-prio'), 'Prio-Badge-Styles entfernt');

assert.equal(normalizeKnowledgeChipSource('portal'), 'customer');
assert.equal(normalizeKnowledgeChipSource('seller'), 'seller');

const display = stripEquipmentPrioritySuffix(
  formatEquipmentWishLabel('Sitzheizung', EQUIPMENT_WISH_PRIORITY.PREFERRED, {
    explicitPreferred: true,
  }),
);
assert.equal(display, 'Sitzheizung');
assert.ok(!/\b(muss|wichtig|wunsch)\b/i.test(display), 'kein Prio-Wort in Display-Label');

const title = buildKnowledgeChipProvenanceTitle({
  source: 'customer',
  sourceChannel: 'Landingpage',
  createdAt: '2026-05-28T12:00:00.000Z',
});
assert.match(title, /Vom Kunden angegeben/);
assert.ok(!/Quelle:\s*Kunde/.test(title), 'kein altes Quellen-Badge-Wording');

console.log('CustomerAkteKundenbild.test.js: ok');
