/**
 * Clever-Kundenhelfer – Kategorien im Profilkopf
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
assert.ok(khSource.includes('Kundenwissen'), 'Profil zeigt Kundenwissen-Titel');
assert.ok(khSource.includes('cust-akte-kw__cat'), 'Kategorie-Chips statt Detailchips');
assert.ok(khSource.includes('onOpenSheet?.(category.id)'), 'Klick öffnet Kategorie');

assert.ok(
  followUpSource.includes('<CustomerAkteKundenhelfer'),
  'Kundenhelfer wird in der Kundenakte gerendert',
);
assert.ok(
  followUpSource.includes('openKundenhelferSheet'),
  'Follow-up öffnet Kundenhelfer mit Kategorie',
);
assert.ok(
  khSource.includes('+ Info hinzufügen'),
  'leerer Zustand zeigt „+ Info hinzufügen“',
);

const sheetSource = readFileSync(
  join(__dirname, 'CleverKundenhelferSheet.jsx'),
  'utf8',
);
assert.ok(sheetSource.includes('Wählen Sie einen Bereich'), 'Sheet startet mit Kategorien');
assert.ok(sheetSource.includes('dai-kh-cat-grid'), 'Kategorie-Kacheln im Sheet');

console.log('CustomerAkteKundenhelfer.test.js: ok');
