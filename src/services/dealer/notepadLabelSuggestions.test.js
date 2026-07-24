/**
 * notepadLabelSuggestions – Stichwort-Vorschläge & Anfrage-Organisation
 */
import assert from 'node:assert/strict';
import {
  extractLastNotepadKeyword,
  organizeInquiryText,
  suggestNotepadLabels,
  scanEquipmentLabelsInText,
} from './notepadLabelSuggestions.js';

assert.equal(extractLastNotepadKeyword('Sitzh'), 'Sitzh');
assert.equal(extractLastNotepadKeyword('wichtig: Parksenso'), 'Parksenso');
assert.equal(extractLastNotepadKeyword('Heckkl'), 'Heckkl');

const sitz = suggestNotepadLabels('Sitzh');
assert.ok(sitz.includes('Sitzheizung'), `Sitzh → ${sitz.join(', ')}`);

const park = suggestNotepadLabels('Parksenso');
assert.ok(park.includes('Parksensoren vorne'), `Parksenso vorne: ${park.join(', ')}`);
assert.ok(park.includes('Parksensoren hinten'), `Parksenso hinten: ${park.join(', ')}`);

const heck = suggestNotepadLabels('Heckkl');
assert.ok(
  heck.some((label) => /heckklappe/i.test(label)),
  `Heckkl → ${heck.join(', ')}`,
);

const soft = organizeInquiryText(
  'E-Auto Leasing, maximal 250 Euro monatlich, 15.000 km, 48 Monate, 0 Euro Anzahlung, Gebrauchtwagen OK, ohne BAFA.',
);
assert.ok(soft.some((label) => /250/i.test(label)), `Budget: ${soft.join(', ')}`);
assert.ok(soft.some((label) => /0\s*€\s*Anzahlung/i.test(label)), `Anzahlung: ${soft.join(', ')}`);
assert.ok(soft.some((label) => /BAFA/i.test(label)), `BAFA: ${soft.join(', ')}`);

const schlayerLike = organizeInquiryText(
  'EV3 AIR November 2026 LEASING 48 10.000 km 2000 € Anzahlung',
);
assert.ok(!schlayerLike.some((label) => /^0\s*€\s*Anzahlung$/i.test(label)), `kein 0€ aus 2000: ${schlayerLike.join(', ')}`);
assert.ok(
  !schlayerLike.some((label) => /Budget bis\s*2\.?000/i.test(label)),
  `Anzahlung nicht als Rate: ${schlayerLike.join(', ')}`,
);

const hard = organizeInquiryText(
  'Kia EV3 GT-Line, Sitzheizung, Parksensoren vorne und hinten, elektrische Heckklappe, Firmenzulassung.',
);
assert.ok(hard.includes('Sitzheizung'), `Sitzheizung: ${hard.join(', ')}`);
assert.ok(hard.includes('Parksensoren vorne'), `PDC v: ${hard.join(', ')}`);
assert.ok(hard.includes('Parksensoren hinten'), `PDC h: ${hard.join(', ')}`);
assert.ok(hard.some((label) => /Heckklappe/i.test(label)), `Heck: ${hard.join(', ')}`);
assert.ok(hard.includes('Firmenzulassung'), `Firma: ${hard.join(', ')}`);

const scanned = scanEquipmentLabelsInText('Braucht Lenkradheizung und Panoramadach');
assert.ok(scanned.includes('Lenkradheizung'));
assert.ok(scanned.includes('Panoramadach'));

console.log('notepadLabelSuggestions.test.js: ok');
