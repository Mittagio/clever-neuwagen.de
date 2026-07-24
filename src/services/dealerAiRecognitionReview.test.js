import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseDealerAiInput } from './dealerAiParser.js';
import {
  RECOGNITION_SAMPLE_TEXT,
  applyRecognitionInsightToParsed,
  buildCustomerRecognitionInsight,
  extractCustomerHelperNotes,
  hasMeaningfulVehicleWish,
  resolvePhaseAfterRecognitionConfirm,
} from './dealerAiRecognitionInsight.js';
import { joinKundenhelferNotes } from './cleverKundenhelfer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SAMPLE = RECOGNITION_SAMPLE_TEXT;
const parsed = parseDealerAiInput(SAMPLE);
assert.equal(parsed.ok, true, 'Beispieltext wird geparst');

const insight = buildCustomerRecognitionInsight(SAMPLE, parsed);
const notes = insight.customerHelperNotes;

assert.ok(notes.includes('2 Kinder'), 'Freitext mit 2 Kindern erzeugt Chip 2 Kinder');
assert.ok(
  notes.some((n) => /fährt aktuell.*golf/i.test(n)),
  'VW Golf alt erzeugt Kundenhelfer-Chip fährt aktuell VW Golf',
);
assert.equal(insight.vehicleWish.trailerLoadMinKg, 1200, 'Anhängelast 1200 kg als Fahrzeugwunsch');
assert.ok(
  insight.vehicleWish.fuelTypes.includes('Hybrid'),
  'Hybrid wird als Antriebswunsch erkannt',
);
assert.ok(
  insight.vehicleWish.fuelTypes.includes('Plug-in-Hybrid'),
  'Plug-in-Hybrid wird als Antriebswunsch erkannt',
);
assert.equal(insight.vehicleWish.usageProfile, 'Urlaub / Langstrecke', 'Südtirol als Langstrecke');
assert.equal(insight.vehicleWish.colorPreference, 'schwarz', 'schwarzes Auto als Farbpräferenz');

assert.equal(insight.customer.displayName, 'Stefan Wiens', 'Kundenname erkannt');

const phaseBeforeLead = resolvePhaseAfterRecognitionConfirm(insight, parsed);
assert.notEqual(phaseBeforeLead, 'followup', 'Vor Bestätigung keine Kundenakte-Phase');
assert.equal(phaseBeforeLead, 'advice', 'Bei Bedarf ohne konkretes Kia-Modell → Beratung');

const merged = applyRecognitionInsightToParsed(parsed, insight);
assert.ok(
  joinKundenhelferNotes(merged.customerHelperNotes).includes('2 Kinder'),
  'Nach Bestätigung Kundenhelfer-Chips im Parsed-Objekt',
);

const sportageParsed = parseDealerAiInput('Kia Sportage Hybrid Earth schwarz, Leasing 48 Monate');
const sportageInsight = buildCustomerRecognitionInsight(
  'Kia Sportage Hybrid Earth schwarz, Leasing 48 Monate',
  sportageParsed,
);
const sportageMerged = applyRecognitionInsightToParsed(sportageParsed, sportageInsight);
assert.equal(
  resolvePhaseAfterRecognitionConfirm(sportageInsight, sportageMerged),
  'configure',
  'Bei konkretem Modell nach Bestätigung → Konfigurator',
);

const infoOnlyParsed = parseDealerAiInput('Kunde hat Hund und trinkt Kaffee schwarz');
const infoOnlyInsight = buildCustomerRecognitionInsight(
  'Kunde hat Hund und trinkt Kaffee schwarz',
  infoOnlyParsed,
);
assert.equal(
  resolvePhaseAfterRecognitionConfirm(infoOnlyInsight, infoOnlyParsed),
  'akte',
  'Nur Kundeninfo → Kundenakte',
);
assert.equal(hasMeaningfulVehicleWish(infoOnlyInsight), false);

const helperOnly = extractCustomerHelperNotes('hat 2 Kinder und fährt oft nach Südtirol');
assert.ok(helperOnly.includes('2 Kinder'));

const softMail = [
  'Guten Tag,',
  'ich interessiere mich für ein E-Auto im Leasing.',
  'Maximal 250 Euro monatlich, 15.000 km/Jahr, 48 Monate, 0 Euro Anzahlung.',
  'Gebrauchtwagen wäre auch ok. Ohne BAFA.',
  'Viele Grüße Patrick',
].join('\n');
const softParsed = parseDealerAiInput(softMail);
assert.equal(softParsed.ok, true);
const softInsight = buildCustomerRecognitionInsight(softMail, softParsed);
assert.ok(softInsight.customerHelperNotes.some((n) => /250|Budget/i.test(n)), `Soft-Mail Budget notiert: ${softInsight.customerHelperNotes.join(', ')}`);
assert.ok(softInsight.customerHelperNotes.some((n) => /BAFA/i.test(n)), `Soft-Mail BAFA: ${softInsight.customerHelperNotes.join(', ')}`);
assert.ok(!softInsight.customerHelperNotes.some((n) => /^0\s*€\s*Anzahlung$/i.test(n) && /2000/.test(softMail)), 'kein falsches 0€');
assert.equal(softInsight.paymentWish.paymentType, 'leasing');
assert.equal(softInsight.paymentWish.desiredRate, 250);
assert.ok(softInsight.organizedLabels?.length >= 1, 'organizedLabels aus Anfrage einfügen');

const hardMail = [
  'Bitte Angebot Kia EV3 GT-Line,',
  'Sitzheizung, Parksensoren vorne und hinten, elektrische Heckklappe, Firmenzulassung.',
].join(' ');
const hardParsed = parseDealerAiInput(hardMail);
const hardInsight = buildCustomerRecognitionInsight(hardMail, hardParsed);
assert.ok(hardInsight.customerHelperNotes.includes('Sitzheizung'), 'Hard-Mail Sitzheizung');
assert.ok(hardInsight.customerHelperNotes.includes('Parksensoren vorne'), 'Hard-Mail PDC v');
assert.ok(hardInsight.customerHelperNotes.some((n) => /Heckklappe/i.test(n)), 'Hard-Mail Heckklappe');

const pageSource = readFileSync(
  join(__dirname, '../pages/DealerAIPage.jsx'),
  'utf8',
);
assert.ok(pageSource.includes('recognition-animate'), 'KI-Check nutzt Analyse-Animation');
assert.ok(pageSource.includes('handleApplyDirectCustomerAkte'), 'KI-Check öffnet direkt Kundenakte');
assert.ok(pageSource.includes("setPhase('followup')"), 'Nach KI-Check Phase followup');
assert.ok(!pageSource.includes("setPhase('recognition-review')"), 'Kein Pflicht-Zwischenschritt recognition-review');

console.log('dealerAiRecognitionReview.test.js: ok');
