/**
 * Notizzettel in der Kundenakte – Chips statt Kategorie-Kacheln
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildKundenwissenOverview,
  countKundenwissenItems,
  buildUnterlagenKundenwissenItems,
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
assert.ok(overview.length >= 4, 'Kategorien für Sheet/Fallback');
assert.ok(!overview.some((cat) => cat.label === 'Kaffee mit Milch'));
assert.equal(countKundenwissenItems(notes), 7);

const withoutSlots = buildKundenwissenOverview(notes, null, {}, { includeUnterlagen: false });
assert.ok(!withoutSlots.some((cat) => cat.items.some((i) => i.fromUnterlagen)));

const khSource = readFileSync(
  join(__dirname, 'CustomerAkteKundenhelfer.jsx'),
  'utf8',
);
assert.ok(khSource.includes('Notizzettel'), 'Profil zeigt Notizzettel');
assert.ok(khSource.includes('cust-akte-kw__chip'), 'Wunsch-Chips');
assert.ok(khSource.includes('buildAttributedWishChips'), 'Attributed Chips');
assert.ok(khSource.includes('filterNotepadChipsExcludingKonditionen'), 'Konditionen nicht doppelt am Notizzettel');
assert.ok(khSource.includes('CustomerAkteNotepadCapture'), 'Memo/Scan am Notizzettel');
assert.ok(!khSource.includes('cust-akte-kw__cat'), 'keine Kategorie-Kacheln mehr im Profil');

assert.ok(
  followUpSource.includes('<CustomerAkteKundenhelfer'),
  'Kundenhelfer wird in der Kundenakte gerendert',
);
assert.ok(
  followUpSource.includes('onCaptureCommit'),
  'Follow-up verdrahtet Memo/Scan',
);
assert.ok(
  followUpSource.includes('openKundenhelferSheet'),
  'Follow-up öffnet Kundenhelfer',
);
assert.ok(
  followUpSource.includes('hideWishChips'),
  'Doppelte Wunschchips im Kundenbild ausgeblendet',
);

const empfiehltSource = readFileSync(
  join(__dirname, 'CleverEmpfiehltCard.jsx'),
  'utf8',
);
assert.ok(empfiehltSource.includes('Mehr Details'), 'Clever sagt kompakt mit Details');
assert.ok(empfiehltSource.includes('clever-empfiehlt--compact'), 'Compact-Klasse');

assert.ok(typeof buildUnterlagenKundenwissenItems === 'function');

console.log('CustomerAkteKundenhelfer.test.js: ok');
