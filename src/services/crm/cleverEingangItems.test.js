/**
 * Clever Eingang – Queue-Modell (Sources, Gruppen, Status, Filter)
 */
import assert from 'node:assert/strict';
import {
  buildCleverInboxItems,
  buildCleverInboxSummary,
  buildDuplicateReason,
  CLEVER_EINGANG_STATUS,
  filterCleverInboxItems,
  formatInboxRelativeTime,
  leadsAreLikelyDuplicates,
  mapInboxSourceLabel,
  mapInboxSourceShortLabel,
  resolveLeadContactName,
  scoreLeadDuplicateMatch,
  sortCleverInboxItems,
} from './cleverEingangItems.js';

const NOW = Date.parse('2026-08-05T12:00:00.000Z');

// --- Source mapping: nie interne Keys ---
assert.equal(mapInboxSourceLabel('composer_multi_source'), 'Über Clever erfasst');
assert.equal(mapInboxSourceLabel('sales_assistant'), 'Über Verkaufsassistent erfasst');
assert.equal(mapInboxSourceLabel('dealerAi'), 'Über Verkaufsassistent erfasst');
assert.equal(mapInboxSourceLabel('email'), 'Aus E-Mail erkannt');
assert.equal(mapInboxSourceLabel('homepage'), 'Über Händlerhomepage');
assert.equal(mapInboxSourceLabel('landing'), 'Über Händlerhomepage');
assert.equal(mapInboxSourceLabel('document'), 'Aus Dokument erkannt');
assert.equal(mapInboxSourceLabel('seller_note'), 'Aus Gesprächsnotiz');
assert.equal(mapInboxSourceLabel('multi_source_intake'), 'Über Clever erfasst');
assert.equal(mapInboxSourceLabel(''), 'Unbekannte Quelle');
assert.notEqual(mapInboxSourceLabel('composer_multi_source'), 'composer_multi_source');
assert.ok(!mapInboxSourceLabel('some_weird_internal_key').includes('_'));
assert.equal(mapInboxSourceShortLabel('sales_assistant'), 'Verkaufsassistent');
assert.equal(mapInboxSourceShortLabel('composer_multi_source'), 'Clever Composer');

// --- Unbekannter Kunde → Neuer Vorgang ---
assert.equal(resolveLeadContactName({ contact: { name: 'Neuer Kunde' } }), '');
assert.equal(resolveLeadContactName({ contact: { name: 'Kunde (offen)' } }), '');
assert.equal(resolveLeadContactName({ contact: { name: 'Anna Keller' } }), 'Anna Keller');

const incompleteLead = {
  id: 'inc-1',
  status: 'neu',
  source: 'composer_multi_source',
  createdAt: '2026-08-05T11:50:00.000Z',
  contact: { name: 'Neuer Kunde' },
  vehicle: { brand: 'Kia', model: 'EV3', label: 'Kia EV3' },
};

const { items: incompleteItems } = buildCleverInboxItems([incompleteLead], { nowMs: NOW });
assert.equal(incompleteItems.length, 1);
assert.equal(incompleteItems[0].title, 'Neuer Vorgang');
assert.equal(incompleteItems[0].status, CLEVER_EINGANG_STATUS.INCOMPLETE);
assert.equal(incompleteItems[0].contextHint, 'Name oder Kontaktdaten fehlen');
assert.equal(incompleteItems[0].nextAction.label, 'Angaben ergänzen');
assert.equal(incompleteItems[0].sourceLabel, 'Über Clever erfasst');
assert.ok(!String(incompleteItems[0].sourceLabel).includes('composer'));

// --- Dubletten als echte Gruppenkarte ---
const dupA = {
  id: 'dup-a',
  status: 'neu',
  source: 'sales_assistant',
  createdAt: '2026-07-29T11:00:00.000Z',
  contact: { name: 'Thomas Weber', email: 't.weber@firma.de', phone: '01719876543' },
  vehicle: { brand: 'Kia', model: 'Sportage', label: 'Kia Sportage' },
  notes: 'Interessiert an Leasing',
};
const dupB = {
  id: 'dup-b',
  status: 'neu',
  source: 'composer_multi_source',
  createdAt: '2026-07-28T10:30:00.000Z',
  contact: { name: 'Thomas Weber', email: 't.weber@firma.de', phone: '+49 171 9876543' },
  vehicle: { brand: 'Kia', model: 'Sportage', label: 'Sportage Pulse' },
  notes: 'Interessiert an Leasing Variante',
};

assert.ok(scoreLeadDuplicateMatch(dupA, dupB) >= 5);
assert.ok(leadsAreLikelyDuplicates(dupA, dupB));

const readyLead = {
  id: 'ready-1',
  status: 'neu',
  source: 'sales_assistant',
  createdAt: '2026-08-05T11:40:00.000Z',
  contact: { name: 'Sarah Müller', email: 'sarah@mail.de', phone: '01701234567' },
  vehicle: { brand: 'Kia', model: 'EV6', label: 'Kia EV6' },
};

const assignedLead = {
  id: 'asg-1',
  status: 'neu',
  source: 'document',
  customerId: 'cust-existing',
  createdAt: '2026-08-05T09:00:00.000Z',
  contact: { name: 'Lisa Hoffmann', email: 'lisa.h@web.de', phone: '01605554433' },
  vehicle: { brand: 'Kia', model: 'Ceed', label: 'Kia Ceed' },
};

const { items, summary } = buildCleverInboxItems(
  [incompleteLead, dupB, readyLead, dupA, assignedLead],
  { nowMs: NOW },
);

assert.equal(items.length, 4, 'N ähnliche → 1 Gruppenkarte in der Liste');
const dupItem = items.find((item) => item.status === CLEVER_EINGANG_STATUS.DUPLICATE);
assert.ok(dupItem, 'Gruppenkarte für mögliche Dublette vorhanden');
assert.equal(dupItem.memberCount, 2);
assert.equal(dupItem.isGroup, true);
assert.equal(dupItem.statusLabel, 'Mögliche Dublette');
assert.equal(dupItem.contextHint, '2 ähnliche Vorgänge · gleicher Kunde und Sportage');
assert.equal(dupItem.nextAction.label, 'Vorgänge prüfen');
assert.equal(dupItem.title, 'Thomas Weber');
assert.match(dupItem.sourceLabel, /^aus /);
assert.match(dupItem.sourceLabel, /Verkaufsassistent/);
assert.match(dupItem.sourceLabel, /Clever Composer/);

const readyItem = items.find((item) => item.status === CLEVER_EINGANG_STATUS.READY);
assert.ok(readyItem);
assert.equal(readyItem.nextAction.label, 'Übernehmen');
assert.equal(readyItem.sourceLabel, 'Über Verkaufsassistent erfasst');

const assignedItem = items.find((item) => item.status === CLEVER_EINGANG_STATUS.ASSIGNED);
assert.ok(assignedItem);
assert.equal(assignedItem.nextAction.label, 'Zur Kundenakte');
assert.equal(assignedItem.sourceLabel, 'Aus Dokument erkannt');

// --- Sortierung: mögliche Dublette → bereit → unvollständig → zugeordnet ---
assert.equal(items[0].status, CLEVER_EINGANG_STATUS.DUPLICATE);
assert.equal(items[1].status, CLEVER_EINGANG_STATUS.READY);
assert.equal(items[2].status, CLEVER_EINGANG_STATUS.INCOMPLETE);
assert.equal(items[3].status, CLEVER_EINGANG_STATUS.ASSIGNED);

const resort = sortCleverInboxItems([
  { ...assignedItem, sortRank: 4 },
  { ...readyItem, sortRank: 2 },
  { ...dupItem, sortRank: 1 },
  { ...incompleteItems[0], sortRank: 3 },
]);
assert.deepEqual(
  resort.map((item) => item.status),
  [
    CLEVER_EINGANG_STATUS.DUPLICATE,
    CLEVER_EINGANG_STATUS.READY,
    CLEVER_EINGANG_STATUS.INCOMPLETE,
    CLEVER_EINGANG_STATUS.ASSIGNED,
  ],
);

// --- Filter-Counts: Alle = Summe der Kategorien inkl. Zugeordnet ---
assert.equal(summary.total, 4);
assert.equal(summary.duplicates, 1);
assert.equal(summary.duplicateMemberCount, 2);
assert.equal(summary.ready, 1);
assert.equal(summary.incomplete, 1);
assert.equal(summary.assigned, 1);
assert.ok(summary.groupHint);
assert.match(summary.groupHint, /1 Gruppe mit möglichen Dubletten erkannt/);
assert.ok(!summary.groupHint.includes('2 ähnliche'));

const filterAll = summary.filters.find((f) => f.id === 'all');
const filterDup = summary.filters.find((f) => f.id === CLEVER_EINGANG_STATUS.DUPLICATE);
const filterReady = summary.filters.find((f) => f.id === CLEVER_EINGANG_STATUS.READY);
const filterInc = summary.filters.find((f) => f.id === CLEVER_EINGANG_STATUS.INCOMPLETE);
const filterAssigned = summary.filters.find((f) => f.id === CLEVER_EINGANG_STATUS.ASSIGNED);
const categorySum = summary.filters
  .filter((f) => f.id !== 'all')
  .reduce((sum, f) => sum + f.count, 0);
assert.equal(filterAll.count, 4);
assert.equal(filterAll.count, categorySum, 'Alle = Summe der Filter-Counts');
assert.equal(filterDup.label, 'Mögliche Dubletten');
assert.equal(filterDup.count, 1, 'Filter zählt Gruppenkarten, nicht Roh-Einträge');
assert.equal(filterReady.count, 1);
assert.equal(filterInc.count, 1);
assert.ok(filterAssigned, 'Filter Zugeordnet vorhanden');
assert.equal(filterAssigned.count, 1);

assert.equal(filterCleverInboxItems(items, '', CLEVER_EINGANG_STATUS.DUPLICATE).length, 1);
assert.equal(filterCleverInboxItems(items, '', CLEVER_EINGANG_STATUS.READY).length, 1);
assert.equal(filterCleverInboxItems(items, '', CLEVER_EINGANG_STATUS.ASSIGNED).length, 1);
assert.equal(filterCleverInboxItems(items, 'thomas', 'all').length, 1);
assert.equal(buildCleverInboxSummary([]).line, 'Keine neuen Vorgänge');

// --- Ähnlichkeitsgrund: Name + Fahrzeug ---
const nameOnlyA = {
  id: 'name-a',
  status: 'neu',
  source: 'seller_note',
  createdAt: '2026-08-05T11:00:00.000Z',
  contact: { name: 'Eva Air', email: 'eva.air@test.de', phone: '01701110001' },
  vehicle: { brand: 'Kia', model: 'EV4', trim: 'Air', label: 'Kia EV4 Air' },
};
const nameOnlyB = {
  id: 'name-b',
  status: 'neu',
  source: 'composer_multi_source',
  createdAt: '2026-08-04T11:00:00.000Z',
  contact: { name: 'Eva Air', email: 'eva.air@test.de', phone: '01701110001' },
  vehicle: { brand: 'Kia', model: 'EV4', trim: 'Air', label: 'Kia EV4 Air' },
};
assert.equal(
  buildDuplicateReason([nameOnlyA, nameOnlyB], nameOnlyA),
  'gleicher Kunde und EV4 Air',
);

// --- N ähnliche → genau 1 Listen-Item ---
const manySimilar = Array.from({ length: 5 }, (_, i) => ({
  id: `bulk-${i}`,
  status: 'neu',
  source: i % 2 === 0 ? 'sales_assistant' : 'email',
  createdAt: `2026-08-0${1 + i}T10:00:00.000Z`,
  contact: { name: 'Anna Bulk', email: 'anna.bulk@test.de', phone: '01701112233' },
  vehicle: { brand: 'Kia', model: 'EV3', label: 'Kia EV3' },
  notes: 'Leasing Anfrage',
}));
const lonely = {
  id: 'lonely-1',
  status: 'neu',
  source: 'homepage',
  createdAt: '2026-08-05T11:00:00.000Z',
  contact: { name: 'Max Einsam', email: 'max@test.de', phone: '01709998877' },
  vehicle: { brand: 'Kia', model: 'Picanto', label: 'Kia Picanto' },
};
const { items: bulkItems, summary: bulkSummary } = buildCleverInboxItems(
  [...manySimilar, lonely],
  { nowMs: NOW },
);
assert.equal(bulkItems.length, 2, '5 ähnliche + 1 allein → 2 Gruppen in der Liste');
assert.equal(bulkSummary.duplicates, 1);
assert.equal(bulkSummary.duplicateMemberCount, 5);
assert.equal(bulkSummary.filters.find((f) => f.id === CLEVER_EINGANG_STATUS.DUPLICATE).count, 1);
assert.match(bulkItems[0].contextHint, /5 ähnliche Vorgänge · gleicher Kunde und EV3/);

// --- Große Gruppen (7+): ruhige Copy + Quellenzeile ---
const largeGroup = Array.from({ length: 7 }, (_, i) => ({
  id: `large-${i}`,
  status: 'neu',
  source: i % 2 === 0 ? 'composer_multi_source' : 'seller_note',
  createdAt: `2026-08-0${1 + (i % 5)}T10:00:00.000Z`,
  contact: { name: 'Groß Gruppe', email: 'gross@test.de', phone: '01704445566' },
  vehicle: { brand: 'Kia', model: 'EV2', trim: 'GT-Line', label: 'Kia EV2 GT-Line' },
  notes: 'Leasing Anfrage',
}));
const { items: largeItems } = buildCleverInboxItems(largeGroup, { nowMs: NOW });
assert.equal(largeItems.length, 1);
assert.equal(largeItems[0].contextHint, '7 Vorgänge gebündelt');
assert.equal(largeItems[0].statusLabel, 'Mögliche Dublette');
assert.match(largeItems[0].sourceLabel, /^aus Clever Composer \+ Gesprächsnotiz$|^aus Gesprächsnotiz \+ Clever Composer$/);

// --- relatives Alter ---
assert.equal(formatInboxRelativeTime('2026-08-05T11:45:00.000Z', NOW), 'vor 15 Min.');
assert.equal(formatInboxRelativeTime('2026-08-05T10:00:00.000Z', NOW), 'vor 2 Std.');
assert.equal(formatInboxRelativeTime('2026-08-04T12:00:00.000Z', NOW), 'gestern');

// Keine Auto-Merge: Gruppe behält beide IDs
assert.deepEqual(dupItem.memberLeadIds.sort(), ['dup-a', 'dup-b']);

// Vertrag / Review CTAs
const contractLead = {
  id: 'ctr-1',
  status: 'neu',
  source: 'email',
  createdAt: '2026-08-05T11:30:00.000Z',
  contractPending: true,
  contact: { name: 'Vera Vertrag', email: 'vera@test.de', phone: '01705556677' },
  vehicle: { brand: 'Kia', model: 'Niro', label: 'Kia Niro' },
};
const { items: contractItems } = buildCleverInboxItems([contractLead], { nowMs: NOW });
assert.equal(contractItems[0].nextAction.label, 'Vertrag prüfen');

console.log('cleverEingangItems.test.js: OK');
