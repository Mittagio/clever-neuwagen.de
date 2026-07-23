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
assert.ok(sheetSource.includes('Ausstattung'), 'Soft-Wish Ausstattung');
assert.ok(sheetSource.includes('Verfügbarkeit'), 'Soft-Wish Verfügbarkeit');
assert.ok(!sheetSource.includes("label: 'Anschaffung'"), 'Anschaffung nur in Konditionen');
assert.ok(sheetSource.includes('Übernehmen'), 'Akte-Footer wie Konditionen');
assert.ok(sheetSource.includes('Mehr Notizen'), 'Gespräch/Sprache eingeklappt');
assert.ok(sheetSource.includes('dai-kh-cat-grid'), 'Leben-&-Alltag behält Kategorie-Grid');
assert.ok(!sheetSource.includes('Kleine Details fürs nächste Gespräch'), 'alte Chip-Wand entfernt');
assert.ok(sheetSource.includes('buildKundenhelferDisplayNotes'), 'Chips aus sellerInsights/Understanding');
assert.ok(sheetSource.includes('buildCustomerUnderstanding'), 'Understanding statt notes als Wahrheit');
assert.ok(sheetSource.includes('setExclusiveChipInGroup'), 'exklusive Soft-Wish-Gruppen');

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
