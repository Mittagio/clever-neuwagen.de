import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  getCommunicationSummary,
  getHistoryEntryCount,
  isCustomerContactEntry,
  isSystemHistoryEntry,
} from './customerAkteHistory.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const commSource = readFileSync(
  join(__dirname, '../components/dealer-ai/CustomerAkteCommunication.jsx'),
  'utf8',
);
const activitiesSource = readFileSync(
  join(__dirname, '../components/dealer-ai/CustomerAkteActivities.jsx'),
  'utf8',
);
const unterlagenSource = readFileSync(
  join(__dirname, '../components/dealer-ai/CustomerAkteUnterlagen.jsx'),
  'utf8',
);
const followUpSource = readFileSync(
  join(__dirname, '../components/dealer-ai/DealerAiLeadFollowUp.jsx'),
  'utf8',
);
assert.ok(!unterlagenSource.includes('useState'), 'Unterlagen ohne Inline-Aufklappung');
assert.ok(unterlagenSource.includes('onOpen'), 'Unterlagen öffnet Sheet');

const history = [
  { id: '1', at: '2026-06-17T14:00:00.000Z', type: 'note', text: 'Clever Kundenhelfer aktualisiert' },
  { id: '2', at: '2026-06-17T15:00:00.000Z', type: 'note', text: 'Clever empfahl: Angebot senden' },
  { id: '3', at: '2026-06-17T16:00:00.000Z', type: 'communication', text: 'WhatsApp-Nachricht erstellt', channel: 'whatsapp' },
];

assert.equal(isSystemHistoryEntry(history[0]), true);
assert.equal(isSystemHistoryEntry(history[1]), true);
assert.equal(isCustomerContactEntry(history[2]), true);
assert.equal(isCustomerContactEntry(history[0]), false);

const summary = getCommunicationSummary(history);
assert.ok(summary?.line.includes('WhatsApp'), 'Kommunikation zeigt echten Kontakt');
assert.ok(summary?.line.includes('Letzte Aktion'), 'Kommunikation nutzt Aktionszeile');
assert.equal(getHistoryEntryCount(history), 3);

assert.ok(!commSource.includes('cust-akte-comm__text'), 'Kein langer Text in Kommunikation');
assert.ok(commSource.includes('Verlauf anzeigen'), 'Kommunikation verlinkt Verlauf');
assert.ok(activitiesSource.includes('expanded'), 'Aktivitäten sind einklappbar');
assert.ok(activitiesSource.includes('Einträge'), 'Aktivitäten zeigen Anzahl');
assert.ok(!activitiesSource.includes('history.slice(0, 4)'), 'Keine offene Vorschau-Liste');

const renderBlock = followUpSource.slice(followUpSource.indexOf('return ('));
const tailIndex = renderBlock.indexOf('cust-akte-tail');
const commIndex = renderBlock.indexOf('<CustomerAkteCommunication');
const unterlagenIndex = renderBlock.indexOf('{unterlagenBlock}');
const activitiesIndex = renderBlock.indexOf('<CustomerAkteActivities');
assert.ok(tailIndex > -1, 'Kompakte Bereiche in cust-akte-tail');
assert.ok(commIndex < unterlagenIndex && unterlagenIndex < activitiesIndex, 'Reihenfolge: Kommunikation → Unterlagen → Aktivitäten');

console.log('customerAkteHistory.test.js: ok');
