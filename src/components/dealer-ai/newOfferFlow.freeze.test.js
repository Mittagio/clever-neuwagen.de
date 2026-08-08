/**
 * Flow-Freeze: + Neues Angebot bleibt in der Kundenakte.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const followUp = readFileSync(join(__dirname, 'DealerAiLeadFollowUp.jsx'), 'utf8');
const sheet = readFileSync(join(__dirname, 'CustomerAkteAddProposalSheet.jsx'), 'utf8');

assert.ok(sheet.includes("id: 'other_vehicle'"), 'Anderes Fahrzeug');
assert.ok(sheet.includes("id: 'vary_offer'"), 'Angebot variieren');
assert.ok(sheet.includes("id: 'pdf_import'"), 'PDF einlesen');
assert.ok(sheet.includes('bestehendes Angebot bleibt'), 'EV9 bleibt erhalten');
assert.ok(sheet.includes('Was möchtest du'), 'Sheet fragt Absicht');

assert.ok(followUp.includes('+ Neues Angebot'), 'Footer-CTA umbenannt');
assert.ok(!followUp.includes('Klassisches Angebotsboard'), 'Klassisches Board entfernt');
assert.ok(followUp.includes("openSheet(SHEETS.addProposal)"), '+ Neues Angebot öffnet Sheet');
assert.ok(followUp.includes("optionId === 'other_vehicle'"), 'Anderes Fahrzeug in-Akte');
assert.ok(followUp.includes("optionId === 'vary_offer'"), 'Variieren in-Akte');
assert.ok(followUp.includes("optionId === 'pdf_import'"), 'PDF in-Akte');
assert.ok(
  followUp.includes('Flow-Freeze: bleibt in der Akte'),
  'kein Verkaufsassistent-Sprung als Einstieg',
);

console.log('newOfferFlow.freeze.test.js: ok');
