import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  addCustomKundenhelferChip,
  getCustomKundenhelferChips,
  parseKundenhelferNotes,
  replaceKundenhelferChip,
} from './cleverKundenhelfer.js';

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
assert.ok(sheetSource.includes('dai-kh-cat-grid'), 'Kategorie-Grid statt Chip-Wand');
assert.ok(!sheetSource.includes('Kleine Details fürs nächste Gespräch'), 'alte Chip-Wand entfernt');

console.log('cleverKundenhelfer.test.js: ok');
