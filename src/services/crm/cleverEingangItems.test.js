/**
 * Clever Eingang – Queue-Modell (Sources, Dubletten, Status, Sortierung)
 */
import assert from 'node:assert/strict';
import {
  buildCleverInboxItems,
  buildCleverInboxSummary,
  CLEVER_EINGANG_STATUS,
  formatInboxRelativeTime,
  leadsAreLikelyDuplicates,
  mapInboxSourceLabel,
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
assert.equal(incompleteItems[0].nextAction.label, 'Angaben prüfen');
assert.equal(incompleteItems[0].sourceLabel, 'Über Clever erfasst');
assert.ok(!String(incompleteItems[0].sourceLabel).includes('composer'));

// --- Dubletten gruppieren ---
const dupA = {
  id: 'dup-a',
  status: 'neu',
  source: 'email',
  createdAt: '2026-08-05T11:00:00.000Z',
  contact: { name: 'Thomas Weber', email: 't.weber@firma.de', phone: '01719876543' },
  vehicle: { brand: 'Kia', model: 'Sportage', label: 'Kia Sportage' },
  notes: 'Interessiert an Leasing',
};
const dupB = {
  id: 'dup-b',
  status: 'neu',
  source: 'homepage',
  createdAt: '2026-08-05T10:30:00.000Z',
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

assert.equal(items.length, 4, 'Dubletten als eine Karte, keine N Einzelkarten');
const dupItem = items.find((item) => item.status === CLEVER_EINGANG_STATUS.DUPLICATE);
assert.ok(dupItem, 'Dubletten-Gruppe vorhanden');
assert.equal(dupItem.memberCount, 2);
assert.match(dupItem.contextHint, /2 ähnliche Eingänge/);
assert.equal(dupItem.nextAction.label, 'Zusammenführen und prüfen');
assert.equal(dupItem.title, 'Thomas Weber');

const readyItem = items.find((item) => item.status === CLEVER_EINGANG_STATUS.READY);
assert.ok(readyItem);
assert.equal(readyItem.nextAction.label, 'Zur Kundenakte');
assert.equal(readyItem.sourceLabel, 'Über Verkaufsassistent erfasst');

const assignedItem = items.find((item) => item.status === CLEVER_EINGANG_STATUS.ASSIGNED);
assert.ok(assignedItem);
assert.equal(assignedItem.nextAction.label, 'Akte prüfen');
assert.equal(assignedItem.sourceLabel, 'Aus Dokument erkannt');

// --- Sortierung: Konflikte/Dubletten → bereit → unvollständig → zugeordnet ---
assert.equal(items[0].status, CLEVER_EINGANG_STATUS.DUPLICATE);
assert.equal(items[1].status, CLEVER_EINGANG_STATUS.READY);
assert.equal(items[2].status, CLEVER_EINGANG_STATUS.INCOMPLETE);
assert.equal(items[3].status, CLEVER_EINGANG_STATUS.ASSIGNED);

const resorted = sortCleverInboxItems([
  { ...assignedItem, sortRank: 4 },
  { ...readyItem, sortRank: 2 },
  { ...dupItem, sortRank: 1 },
  { ...incompleteItems[0], sortRank: 3 },
]);
assert.deepEqual(
  resorted.map((item) => item.status),
  [
    CLEVER_EINGANG_STATUS.DUPLICATE,
    CLEVER_EINGANG_STATUS.READY,
    CLEVER_EINGANG_STATUS.INCOMPLETE,
    CLEVER_EINGANG_STATUS.ASSIGNED,
  ],
);

// --- Summary ohne Fake-%-Scores ---
assert.match(summary.line, /4 neue Vorgänge/);
assert.match(summary.line, /1 Dublette/);
assert.match(summary.line, /1 bereit/);
assert.match(summary.line, /1 unvollständig/);
assert.ok(!/%/.test(summary.line));
assert.equal(buildCleverInboxSummary([]).line, 'Keine neuen Vorgänge');

// --- relatives Alter ---
assert.equal(formatInboxRelativeTime('2026-08-05T11:45:00.000Z', NOW), 'vor 15 Min.');
assert.equal(formatInboxRelativeTime('2026-08-05T10:00:00.000Z', NOW), 'vor 2 Std.');
assert.equal(formatInboxRelativeTime('2026-08-04T12:00:00.000Z', NOW), 'gestern');

// Keine Auto-Merge: Gruppe behält beide IDs
assert.deepEqual(dupItem.memberLeadIds.sort(), ['dup-a', 'dup-b']);

console.log('cleverEingangItems.test.js: OK');
