/**
 * Clever-Kundenhelfer – Kategorien im Profilkopf / Werkzeug-Einstieg
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildKundenwissenOverview,
  countKundenwissenItems,
} from '../../services/kundenwissenCategories.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const followUpSource = readFileSync(
  join(__dirname, 'DealerAiLeadFollowUp.jsx'),
  'utf8',
);

const notes = [
  'Kaffee mit Milch',
  'Preis sehr wichtig',
  'mag dunkle Autos',
  'Inzahlungnahme vorhanden',
  'Hund',
  '2 Kinder',
  'bevorzugt WhatsApp',
].join(', ');

const overview = buildKundenwissenOverview(notes);
assert.ok(overview.length >= 4, 'Kategorien statt Einzelchips');
assert.ok(!overview.some((cat) => cat.label === 'Kaffee mit Milch'));
assert.equal(countKundenwissenItems(notes), 7);

const khSource = readFileSync(
  join(__dirname, 'CustomerAkteKundenhelfer.jsx'),
  'utf8',
);
assert.ok(khSource.includes('Kundenwissen'), 'Profil zeigt Kundenwissen-Titel im Legacy-Pfad');
assert.ok(khSource.includes('cust-akte-kw__cat'), 'Kategorie-Chips im Legacy-Pfad');
assert.ok(khSource.includes('onOpenSheet?.(category.id)'), 'Klick öffnet Kategorie im Legacy-Pfad');
assert.ok(khSource.includes('hasCustomerUnderstanding'), 'unterstützt Understanding-Werkzeug-Modus');
assert.ok(khSource.includes('Verkaufsnotizen'), 'Werkzeug-Modus zeigt Verkaufsnotizen');
assert.ok(khSource.includes('Sprachmemos'), 'Werkzeug-Modus zeigt Sprachmemos');
assert.ok(khSource.includes('cust-akte-kw--tool'), 'Werkzeug-Modus eigene Darstellung');

assert.ok(
  followUpSource.includes('<CustomerAkteKundenhelfer'),
  'Kundenhelfer wird in der Kundenakte gerendert',
);
assert.ok(
  followUpSource.includes('openKundenhelferSheet'),
  'Follow-up öffnet Kundenhelfer mit Kategorie',
);
assert.ok(
  followUpSource.includes('hasCustomerUnderstanding={hasSellerCustomerPicture}'),
  'Understanding schaltet Werkzeug-Modus',
);
assert.ok(
  followUpSource.includes('voiceMemos={kundenhelferMemos}'),
  'Sprachmemos werden für Zähler übergeben',
);
assert.ok(
  khSource.includes('+ Info hinzufügen'),
  'leerer Legacy-Zustand zeigt „+ Info hinzufügen“',
);

const kundenbildIndex = followUpSource.indexOf('CustomerAkteCleverBeratung');
const kundenhelferIndex = followUpSource.indexOf('<CustomerAkteKundenhelfer');
assert.ok(kundenbildIndex > 0 && kundenhelferIndex > kundenbildIndex, 'Kundenbild vor Kundenhelfer');

const sheetSource = readFileSync(
  join(__dirname, 'CleverKundenhelferSheet.jsx'),
  'utf8',
);
assert.ok(sheetSource.includes('Wählen Sie einen Bereich'), 'Sheet startet mit Kategorien');
assert.ok(sheetSource.includes('dai-kh-cat-grid'), 'Kategorie-Kacheln im Sheet');
assert.ok(sheetSource.includes('CustomerAkteConversationNotes'), 'conversationNotes im Sheet');
assert.ok(sheetSource.includes('VoiceMemoRecorder'), 'voiceMemos im Sheet');

console.log('CustomerAkteKundenhelfer.test.js: ok');
