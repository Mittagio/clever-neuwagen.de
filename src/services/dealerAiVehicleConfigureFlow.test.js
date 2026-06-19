/**
 * Tests: Verkaufsassistent – Fahrzeug konfigurieren
 */
import assert from 'node:assert/strict';
import { parseDealerAiInput, parseBatteryKwhFromText } from './dealerAiParser.js';
import {
  buildBudgetComparison,
  buildConfigureDraft,
  buildOfferPreview,
  buildRecognizedWishFramework,
  buildRecognizedWishLines,
  buildSensibleAlternatives,
  enrichVariantsWithRates,
  extractOfferVariants,
  fieldsFromConfigureDraft,
  isVehicleUniquelyRecognized,
  pickRecommendedVariantIndex,
  resolvePhaseAfterAnalysis,
} from './dealerAiVehicleConfigureFlow.js';
import { getDealerSeed } from '../data/dealers/index.js';

import { mergeConfigureCustomerContext, applyCustomerContextToFields } from './dealerAiCustomerContext.js';

const sampleText = 'Kia EV4 Earth 81 kWh, Leasing, 48 Monate, 15.000 km, Budget bis 790 €';
const parsed = parseDealerAiInput(sampleText);

assert.ok(parsed.ok, 'Parser sollte EV4-Wunsch erkennen');
assert.equal(parsed.fields.modelId, 'ev4');
assert.equal(parsed.fields.trimLabel, 'Earth');
assert.equal(parsed.fields.termMonths, 48);
assert.equal(parsed.fields.mileagePerYear, 15000);
assert.equal(parseBatteryKwhFromText(sampleText), 81);
assert.equal(parsed.fields.batteryLabel, '81 kWh');
assert.equal(parsed.fields.desiredRate, 790);

const mailText = [
  'Michael Kübler',
  '0173 1855152',
  'emerka@icloud.com',
  'Kia EV4 Earth 81 kWh, Leasing, 48 Monate, 15.000 km',
  'Leasingende August 2026, Fahrzeugwechsel',
].join('\n');
const mailParsed = parseDealerAiInput(mailText);
assert.equal(mailParsed.fields.customerPhone, '0173 1855152');
assert.equal(mailParsed.fields.customerEmail, 'emerka@icloud.com');
assert.equal(mailParsed.fields.leasingEndDate, 'August 2026');
assert.ok(mailParsed.fields.vehicleChangeIntent);

const crmContext = mergeConfigureCustomerContext({
  parsedFields: mailParsed.fields,
  carryCustomer: {
    contact: { name: 'Michael Kübler', phone: '0173 1855152', email: 'emerka@icloud.com' },
  },
});
assert.equal(crmContext.name, 'Michael Kübler');
assert.equal(crmContext.phone, '0173 1855152');

assert.ok(isVehicleUniquelyRecognized(parsed), 'EV4 sollte eindeutig erkannt sein');
assert.equal(resolvePhaseAfterAnalysis(parsed), 'configure');

const ambiguous = parseDealerAiInput('Elektro SUV, Leasing, 48 Monate, 15.000 km');
assert.ok(ambiguous.ok);
assert.equal(isVehicleUniquelyRecognized(ambiguous), false);
assert.equal(resolvePhaseAfterAnalysis(ambiguous), 'review');

const conditions = getDealerSeed('autohaus-trinkle');
const draft = buildConfigureDraft(parsed, conditions);
assert.equal(draft.modelKey, 'ev4');
assert.equal(draft.trimId, 'earth');
assert.equal(draft.engineId, 'ev-long');
assert.equal(draft.termMonths, 48);
assert.equal(draft.mileagePerYear, 15000);

const wishLines = buildRecognizedWishLines(draft, parsed.fields);
assert.ok(wishLines.some((l) => l.includes('Budget')));
assert.ok(wishLines.some((l) => l.includes('Wunschlieferdatum')));

const framework = buildRecognizedWishFramework(draft, parsed.fields);
assert.ok(framework.conditions.includes('Leasing'));
assert.ok(framework.what.includes('EV4'));

const mergedCustomer = applyCustomerContextToFields(parsed.fields, crmContext);
assert.equal(mergedCustomer.customerName, 'Michael Kübler');

const multiScenarioText = [
  'Kia EV4 Earth 81 kWh, Leasing, 48 Monate',
  '15.000 km, 0 € Anzahlung',
  'oder 3.000 € Anzahlung',
  'oder 20.000 km',
].join(', ');
const multiParsed = parseDealerAiInput(multiScenarioText);
const multiDraft = buildConfigureDraft(multiParsed, conditions);
const variants = enrichVariantsWithRates(
  extractOfferVariants(multiScenarioText, multiParsed.fields, multiDraft),
  multiDraft,
  conditions,
);
assert.ok(variants.length >= 2, 'Mehrere Szenarien sollen Varianten erzeugen');
const recommended = pickRecommendedVariantIndex(variants, multiParsed.fields);
assert.ok(recommended >= 0);

const merged = fieldsFromConfigureDraft(draft, parsed.fields);
assert.equal(merged.modelId, 'ev4');
assert.equal(merged.trimLabel, 'Earth');
assert.equal(merged.engineId, 'ev-long');

const preview = buildOfferPreview(draft, conditions, parsed.fields);
assert.ok(preview.vehicleTitle.includes('EV4'));
assert.ok(preview.vehicleTitle.includes('Earth'));
assert.equal(preview.termMonths, 48);
assert.equal(preview.mileagePerYear, 15000);
assert.equal(preview.downPayment, 0);
assert.ok(preview.monthlyRate != null, 'Rate soll nach Erkennung berechnet werden');
assert.equal(preview.budget.status, 'ok', 'Budget 790 € soll bei EV4-Wunsch erfüllt sein');

const overBudgetDraft = { ...draft, desiredRate: 500 };
const overPreview = buildOfferPreview(overBudgetDraft, conditions, { desiredRate: 500 });
assert.equal(overPreview.budget.status, 'over');
assert.ok(overPreview.budget.label.includes('überschritten'));

const alts = buildSensibleAlternatives(draft, conditions, parsed.fields);
assert.equal(alts.length, 3, 'Standard-EV4-Wunsch soll drei sinnvolle Alternativen haben');
assert.ok(alts.some((a) => a.headline.includes('20.000 km')));
assert.ok(alts.some((a) => a.headline.includes('3.000 € Anzahlung')));
assert.ok(alts.some((a) => a.headline.includes('36 Monate')));
assert.ok(alts.every((a) => a.monthlyRate != null));

const noAltDraft = { ...draft, mileagePerYear: 20000, downPayment: 3000, termMonths: 36 };
const noAlts = buildSensibleAlternatives(noAltDraft, conditions, parsed.fields);
assert.ok(noAlts.length < 3, 'Bei bereits optimierten Werten weniger Alternativen');

assert.equal(buildBudgetComparison(null, 790, 'leasing').status, 'open');
assert.equal(buildBudgetComparison(700, null, 'leasing').status, 'open');
assert.equal(buildBudgetComparison(700, 790, 'leasing').status, 'ok');
assert.equal(buildBudgetComparison(819, 790, 'leasing').status, 'over');
assert.ok(buildBudgetComparison(819, 790, 'leasing').label.includes('29'));

console.log('dealerAiVehicleConfigureFlow tests OK');
