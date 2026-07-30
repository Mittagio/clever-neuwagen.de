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
assert.ok(activitiesSource.includes('Aktivität'), 'Aktivitäten zeigen Anzahl');
assert.ok(activitiesSource.includes('onOpenHistory'), 'Aktivitäten öffnen Verlauf');

assert.ok(followUpSource.includes('CustomerAkteCleverNotepad'), 'Notizzettel auf Clever-Seite');
assert.ok(followUpSource.includes('CustomerAkteSharedWorkspace'), 'Feed + Composer auf Clever-Seite');
assert.ok(followUpSource.includes('CustomerAkteMoreSheet'), 'Weitere Infos über Mehr-Menü');
assert.ok(followUpSource.includes("openSheet(SHEETS.customer)"), 'Name öffnet schlanke Kundendaten');
assert.ok(!followUpSource.includes('CustomerAkteContactInfoSheet'), 'Kein Kontakt-Hub am Namen');
assert.ok(followUpSource.includes('cust-akte--feed'), 'Feed-Layout');
assert.ok(followUpSource.includes('CustomerAkteActivityTimeline'), 'Timeline-Sheet');
assert.ok(followUpSource.includes('CustomerAkteFileNav'), 'Bottom-Nav in der Kundenakte');
assert.ok(followUpSource.includes('withBottomNav'), 'WorkspaceShell mit Bottom-Nav');
assert.ok(!followUpSource.includes('Mit E-Mail ist das Angebot'), 'Keine Tipps im Kunden-Sheet');
assert.ok(!followUpSource.includes('label="Notiz"'), 'Keine Notiz im Kunden-Sheet');

const hintSource = readFileSync(
  join(__dirname, '../components/dealer-ai/CustomerAkteActivityHint.jsx'),
  'utf8',
);
assert.ok(hintSource.includes('Letzte Kundenaktivität'), 'Hinweisbox für letzte Aktivität');

console.log('customerAkteHistory.test.js: ok');
