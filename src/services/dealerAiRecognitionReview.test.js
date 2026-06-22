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

const pageSource = readFileSync(
  join(__dirname, '../pages/DealerAIPage.jsx'),
  'utf8',
);
assert.ok(pageSource.includes('recognition-animate'), 'KI-Check nutzt Analyse-Animation');
assert.ok(pageSource.includes('recognition-review'), 'KI-Check nutzt Bestätigungsseite');
assert.ok(pageSource.includes('setPhase(\'recognition-animate\')'), 'runAnalysis startet Analyse-Animation');

console.log('dealerAiRecognitionReview.test.js: ok');
