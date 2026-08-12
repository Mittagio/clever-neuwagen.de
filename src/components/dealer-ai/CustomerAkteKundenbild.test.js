/**
 * Kundenwissen Hybrid: Summary-Chips light + Themenpanel, Provenance Desktop/Mobile.
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
assert.ok(jsx.includes('buildKnowledgeChipProvenanceTitle'), 'Hover-Provenance');
assert.ok(jsx.includes('ProvenanceFact'), 'Provenance-Fakt-Komponente');
assert.ok(jsx.includes('SummaryChipLight'), 'Summary-Chips light');
assert.ok(jsx.includes('resolveCollapsedSummaryTokens'), 'Token-Fallback aus chips/groups');
assert.ok(jsx.includes('buildSnapshotSummary'), 'Summary-Builder als Fallback');
assert.ok(!jsx.includes('LONG_PRESS_MS'), 'kein Long-Press in Summary');

assert.ok(!jsx.includes('cust-kundenbild__chip--source-customer'), 'keine Source-Optik in Soft');
assert.ok(!jsx.includes('cust-kundenbild__chip-sparkle'), 'kein Clever-Sparkle in Soft');
assert.ok(!jsx.includes('SoftKnowledgeGroup'), 'keine Soft-Bucket-Boxen');
assert.ok(!jsx.includes('GroupCategoryIcon'), 'keine Kategorie-Icons im Soft-Panel');
assert.ok(!jsx.includes('contactChips'), 'kein Kontakt-Fallback in Kundenwissen');
assert.ok(!jsx.includes('is-empty-scaffold'), 'kein leeres Soft-Gerüst');
assert.ok(!jsx.includes('cust-kundenbild__chevron-btn'), 'kein Chevron als Primary');

assert.ok(jsx.includes('cust-kundenbild__summary-chips'), 'Summary-Chips-Container');
assert.ok(jsx.includes('cust-kundenbild__summary-chip'), 'Summary-Chip light Klasse');
assert.ok(jsx.includes('summaryOverflow'), 'Overflow +N verdrahtet');
assert.ok(jsx.includes('Alles anzeigen'), 'Link Alles anzeigen');
assert.ok(jsx.includes('Bearbeiten'), 'Link Bearbeiten wenn leer');
assert.ok(jsx.includes('SoftTopicLine'), 'Themenzeilen im Panel');
assert.ok(jsx.includes('buildSoftPanelTopics'), 'Panel-Topics');
assert.ok(jsx.includes('cust-kundenbild__topic-list'), 'Einzelliste im Themenpanel');
assert.ok(jsx.includes('showProvenanceMeta'), 'Provenance-Meta im Expanded');
assert.ok(jsx.includes('+ Wissen ergänzen'), 'Wissen ergänzen CTA');
assert.ok(jsx.includes('onMerken'), 'Merken/Composer verdrahtet');
assert.ok(jsx.includes('SoftKnowledgeEmptyState'), 'Leerer Soft-Zustand');
assert.ok(jsx.includes('data-kundenwissen-empty'), 'Leerzustand markiert');
assert.ok(jsx.includes('leanHeaderActive'), 'Lean-Header unterdrückt nur Kern-Chips');
assert.ok(jsx.includes('cust-kundenbild__title'), 'Kundenwissen-Titel sichtbar');
assert.ok(jsx.includes('showPanel && expanded'), 'Expanded Panel');
assert.ok(jsx.includes('handleSummaryChipActivate'), 'Chip-Klick expandiert');
assert.ok(jsx.includes('handleExpandFromRow'), 'Zeilen-Klick expandiert');
assert.ok(jsx.includes('is-expandable'), 'Collapsed-Zeile als Expand-Hit');

assert.ok(css.includes('cust-kundenbild__summary-chips'), 'Summary-Chips-Styles');
assert.ok(css.includes('cust-kundenbild__summary-chip'), 'Summary-Chip light Styles');
assert.ok(css.includes('cust-kundenbild__summary-chip--overflow'), 'Overflow-Chip light');
assert.ok(css.includes('flex-wrap: nowrap'), 'Collapsed Summary-Chips in einer Zeile');
assert.ok(css.includes('cust-kundenbild__topic'), 'Topic-Styles');
assert.ok(css.includes('cust-kundenbild__fact-meta'), 'Provenance-Meta Styles');
assert.ok(css.includes('cust-kundenbild__wissen-add'), 'Wissen-ergänzen-Styles');
assert.ok(css.includes('cust-kundenbild__soft-link'), 'Ruhiger Link');
assert.ok(css.includes('min-height: min-content'), 'Open-Collapse Inner nicht Höhe-0');
assert.ok(!css.includes('cust-kundenbild__fact-tip'), 'kein Long-Press-Tooltip-Chrome');

assert.equal(normalizeKnowledgeChipSource('portal'), 'customer');
assert.equal(normalizeKnowledgeChipSource('seller'), 'seller');
assert.equal(normalizeKnowledgeChipSource('clever'), 'clever');
assert.equal(normalizeKnowledgeChipSource('openai_interpretation'), 'clever');
assert.equal(normalizeKnowledgeChipSource('customer_message'), 'clever');

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
assert.match(title, /Vom Kunden angegeben · \d{2}\.\d{2}\.\d{4}/);
assert.ok(!/Quelle:\s*Kunde/.test(title), 'kein altes Quellen-Badge-Wording');

const cleverTitle = buildKnowledgeChipProvenanceTitle({ source: 'clever' });
assert.match(cleverTitle, /Von Clever erkannt · noch nicht bestätigt/);

const cleverConfirmed = buildKnowledgeChipProvenanceTitle({
  source: 'clever',
  confirmed: true,
  createdAt: '2026-05-28T12:00:00.000Z',
});
assert.match(cleverConfirmed, /Von Clever aus Gespräch erkannt · \d{2}\.\d{2}\.\d{4}/);

console.log('CustomerAkteKundenbild.test.js: ok');
