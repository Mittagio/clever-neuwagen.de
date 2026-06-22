/**
 * Clever-Kundenhelfer-Chips im Profilkopf
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  PROFILE_KUNDENHELFER_CHIP_LIMIT,
  getProfileKundenhelferChips,
  parseKundenhelferNotes,
} from '../../services/cleverKundenhelfer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const followUpSource = readFileSync(
  join(__dirname, 'DealerAiLeadFollowUp.jsx'),
  'utf8',
);
const headerSource = readFileSync(
  join(__dirname, 'CustomerAkteHeader.jsx'),
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

const parsed = parseKundenhelferNotes(notes);
assert.equal(parsed.length, 7);

const profile = getProfileKundenhelferChips(notes);
assert.equal(PROFILE_KUNDENHELFER_CHIP_LIMIT, 6);
assert.equal(profile.visible.length, 6, 'maximal 6 Chips sichtbar');
assert.equal(profile.moreCount, 1, 'mehr als 6 zeigt „+ X mehr“');

const empty = getProfileKundenhelferChips('');
assert.equal(empty.visible.length, 0);
assert.equal(empty.moreCount, 0);

const sixOnly = getProfileKundenhelferChips(parsed.slice(0, 6).join(', '));
assert.equal(sixOnly.visible.length, 6);
assert.equal(sixOnly.moreCount, 0);

assert.ok(
  headerSource.includes('CustomerAkteKundenhelfer'),
  'CustomerAkteHeader bindet Kundenhelfer-Chips ein',
);
assert.ok(
  headerSource.includes('onOpenKundenhelfer'),
  'CustomerAkteHeader erhält onOpenKundenhelfer',
);

assert.ok(
  !followUpSource.includes('<CustomerAkteKundenhelfer'),
  'alte Kundenhelfer-Sektion wird nicht doppelt gerendert',
);
assert.ok(
  followUpSource.includes('onOpenKundenhelfer'),
  'Follow-up öffnet Kundenhelfer-Sheet über Header',
);

const khSource = readFileSync(
  join(__dirname, 'CustomerAkteKundenhelfer.jsx'),
  'utf8',
);
assert.ok(khSource.includes('onOpenSheet'), 'Klick auf Chip öffnet onOpenSheet');
assert.ok(
  khSource.includes('+ Kundeninfo hinzufügen'),
  'leerer Zustand zeigt „+ Kundeninfo hinzufügen“',
);

console.log('CustomerAkteKundenhelfer.test.js: ok');
