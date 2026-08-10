import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  addCustomKundenhelferChip,
  getCustomKundenhelferChips,
  parseKundenhelferNotes,
  replaceKundenhelferChip,
  setExclusiveChipInGroup,
} from './cleverKundenhelfer.js';

const TIMING_FIXTURE = [
  'Sobald wie möglich',
  'Innerhalb 1 Monat',
  'In 2–3 Monaten',
  'Noch unklar',
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const sheetSource = readFileSync(
  join(__dirname, '../components/dealer-ai/CleverKundenhelferSheet.jsx'),
  'utf8',
);

assert.deepEqual(getCustomKundenhelferChips('Hund, Gebrauchtwagen BMW'), [
  'Gebrauchtwagen BMW',
]);

assert.deepEqual(
  parseKundenhelferNotes(addCustomKundenhelferChip('Hund', 'Gebrauchtwagen BMW')),
  ['Hund', 'Gebrauchtwagen BMW'],
);

assert.equal(
  addCustomKundenhelferChip('Hund', '  '),
  'Hund',
);

assert.deepEqual(
  parseKundenhelferNotes(
    replaceKundenhelferChip('Gebrauchtwagen BMW, Hund', 'Gebrauchtwagen BMW', 'BMW X3 gebraucht'),
  ),
  ['BMW X3 gebraucht', 'Hund'],
);

assert.equal(
  replaceKundenhelferChip('Gebrauchtwagen BMW', 'Gebrauchtwagen BMW', ''),
  '',
);

assert.ok(sheetSource.includes('+ Info hinzufügen'), 'Sheet zeigt + Info hinzufügen');
assert.ok(sheetSource.includes('dai-kh-hub'), 'Soft-Wish-Hub statt reines Kategorie-Grid');
assert.ok(sheetSource.includes('Leben & Alltag'), 'Kundenhelfer-Kategorien gebündelt');
assert.ok(sheetSource.includes('Ausstattungswünsche'), 'Soft-Wish Ausstattungswünsche');
assert.ok(sheetSource.includes('beim Fahrzeug wichtig'), 'Ausstattung-Picker Subtitle');
assert.ok(sheetSource.includes('Verfügbarkeit'), 'Soft-Wish Verfügbarkeit');
assert.ok(!sheetSource.includes("label: 'Anschaffung'"), 'Anschaffung nur in Konditionen');
assert.ok(sheetSource.includes('Übernehmen'), 'Akte-Footer wie Konditionen');
assert.ok(sheetSource.includes('Mehr Notizen'), 'Gespräch/Sprache eingeklappt (nicht im Equipment-Picker)');
assert.ok(sheetSource.includes('!isEquipmentPicker'), 'Mehr Notizen im Ausstattung-Picker ausgeblendet');
assert.ok(sheetSource.includes('dai-kh-cat-grid'), 'Leben-&-Alltag behält Kategorie-Grid');
assert.ok(!sheetSource.includes('Kleine Details fürs nächste Gespräch'), 'alte Chip-Wand entfernt');
assert.ok(sheetSource.includes('resolveKundenhelferSheetNotes'), 'lokaler notes-State gewinnt beim Editieren');
assert.ok(sheetSource.includes('HANDOFF_EQUIPMENT_CATEGORIES'), 'Ausstattung-Kategorien mit Icons');
assert.ok(sheetSource.includes('EQUIPMENT_AREA_ICONS'), 'Line-Icons statt Emoji');
assert.ok(sheetSource.includes('chip.selected'), 'Equipment-Toggle nutzt chip.selected');
assert.ok(sheetSource.includes('dai-kh-chip__check'), 'ausgewählte Chips mit Check-Mark');
assert.ok(sheetSource.includes('setExclusiveChipInGroup'), 'exklusive Soft-Wish-Gruppen');

const sheetCss = readFileSync(
  join(__dirname, '../components/dealer-ai/CleverKundenhelferSheet.css'),
  'utf8',
);
assert.ok(
  /dai-kh-chip\.is-active[\s\S]*color-clever|#6d5bb8|rgba\(109,\s*91,\s*184/i.test(sheetCss),
  'aktive Ausstattungs-Chips mit starkem Lila-Feedback',
);

assert.deepEqual(
  parseKundenhelferNotes(
    setExclusiveChipInGroup('Hund, Innerhalb 1 Monat', TIMING_FIXTURE, 'Sobald wie möglich'),
  ),
  ['Hund', 'Sobald wie möglich'],
);

assert.deepEqual(
  parseKundenhelferNotes(
    setExclusiveChipInGroup('Hund, Sobald wie möglich', TIMING_FIXTURE, 'Sobald wie möglich'),
  ),
  ['Hund'],
);

console.log('cleverKundenhelfer.test.js: ok');
