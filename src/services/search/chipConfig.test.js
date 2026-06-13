/**
 * Chip-Editor Tests – node src/services/search/chipConfig.test.js
 */

import assert from 'node:assert/strict';
import {
  createEditableChips,
  getChipEditorConfig,
  isChipEditable,
  resolveChipType,
  buildChipFilterPatch,
  buildCustomerStatedChips,
  getCleverAskQuestions,
  CHIP_TYPES,
  CHIP_CONFIGS,
} from './chipConfig.js';
import {
  buildMileageChipSelectOptions,
  buildDurationChipSelectOptions,
  buildMileageKmValues,
  buildTermMonthValues,
  MILEAGE_KM_MIN,
  MILEAGE_KM_MAX,
  TERM_MONTHS_MIN,
  TERM_MONTHS_MAX,
} from './leasingRangeOptions.js';

function editorHasOptions(chip, filters) {
  const cfg = getChipEditorConfig(chip, filters);
  return cfg.editable && (cfg.options?.length > 0 || cfg.showRadiusSection || cfg.showLocationActions);
}

const intent = {
  fuel: 'elektro',
  payment: 'leasing',
  paymentExplicit: true,
  maxRate: 400,
  mileagePerYear: 10000,
  durationMonths: 48,
  rawQuery: 'E-Auto Leasing 48 Monate 10.000 km',
};

const filters = {
  fuel: 'elektro',
  payment: 'leasing',
  paymentExplicit: true,
  maxRate: 400,
  mileagePerYear: 10000,
  termMonths: 48,
  mileagePerYearExplicit: true,
  termMonthsExplicit: true,
  query: 'E-Auto Leasing 48 Monate 10.000 km',
};

assert.equal(buildTermMonthValues()[0], TERM_MONTHS_MIN);
assert.equal(buildTermMonthValues().at(-1), TERM_MONTHS_MAX);
assert.equal(buildMileageKmValues()[0], MILEAGE_KM_MIN);
assert.equal(buildMileageKmValues().at(-1), MILEAGE_KM_MAX);
assert.equal(CHIP_CONFIGS.mileage.options.length, buildMileageChipSelectOptions().length);
assert.equal(CHIP_CONFIGS.duration.options.length, buildDurationChipSelectOptions().length);

const chips = createEditableChips(intent, filters);
assert.ok(chips.length >= 5, 'structured chips');

const mileageChip = chips.find((c) => c.type === CHIP_TYPES.MILEAGE);
assert.ok(mileageChip, 'mileage chip');
assert.equal(resolveChipType(mileageChip), CHIP_TYPES.MILEAGE);
assert.ok(isChipEditable(mileageChip));
assert.ok(editorHasOptions(mileageChip, filters), 'mileage editor has options');

const durationChip = chips.find((c) => c.type === CHIP_TYPES.DURATION);
assert.ok(editorHasOptions(durationChip, filters));

const budgetChip = chips.find((c) => c.id === 'maxRate');
assert.ok(editorHasOptions(budgetChip, filters));

const paymentChip = chips.find((c) => c.type === CHIP_TYPES.PAYMENT);
assert.ok(editorHasOptions(paymentChip, filters));

const fuelChip = chips.find((c) => c.type === CHIP_TYPES.FUEL);
assert.ok(editorHasOptions(fuelChip, filters));

const trimChip = createEditableChips(
  { model: 'Sportage', modelExplicit: true, trim: 'Vision' },
  { model: 'Sportage', modelExplicit: true, trim: 'Vision' },
).find((c) => c.type === CHIP_TYPES.TRIM);
assert.ok(editorHasOptions(trimChip, { trim: 'Vision', modelExplicit: true }));

const featureFilters = {
  ...filters,
  features: ['heated_seats', 'camera_360'],
};
const heatedChip = createEditableChips(
  { features: ['heated_seats', 'camera_360'], payment: 'leasing', mileagePerYear: 10000, durationMonths: 48 },
  featureFilters,
).find((c) => c.id === 'heated_seats');
assert.equal(isChipEditable(heatedChip), true);
const featureCfg = getChipEditorConfig(heatedChip, featureFilters);
assert.ok(featureCfg.showFeatureEditor);
assert.ok(featureCfg.activeItems?.length >= 1);

const patch = buildChipFilterPatch(CHIP_TYPES.PAYMENT, 'cash', { payment: 'leasing', maxRate: 400 });
assert.equal(patch.payment, 'cash');
assert.equal(patch.maxRate, null);

const sportageChips = createEditableChips(
  {
    fuel: 'verbrenner',
    model: 'Sportage',
    trim: 'Vision',
    modelExplicit: true,
    mileagePerYear: 10000,
    durationMonths: 48,
    rawQuery: 'Sportage Vision 48 Monate',
  },
  {
    fuel: 'verbrenner',
    type: 'verbrenner',
    termMonths: 48,
    termMonthsExplicit: true,
    model: 'Sportage',
    trim: 'Vision',
    modelExplicit: true,
    mileagePerYear: 10000,
    query: 'Sportage Vision 48 Monate',
  },
);
assert.equal(sportageChips.filter((c) => c.label === 'verbrenner').length, 0);
assert.equal(sportageChips.filter((c) => c.label === 'Benziner').length, 1);
assert.ok(!sportageChips.some((c) => c.label === '8 Monate'));
assert.ok(sportageChips.some((c) => c.label === '48 Monate'));
assert.ok(sportageChips.some((c) => c.label === 'Sportage'));

const bareElektroChips = createEditableChips(
  { fuel: 'elektro', rawQuery: 'elektro' },
  {
    fuel: 'elektro',
    query: 'elektro',
    mileagePerYear: 10000,
    termMonths: 48,
    city: 'Heilbronn',
    radius: 25,
    locLabel: 'Heilbronn',
  },
);
assert.ok(!bareElektroChips.some((c) => c.type === CHIP_TYPES.MILEAGE), 'Kein km-Chip ohne Kundenwunsch');
assert.ok(!bareElektroChips.some((c) => c.type === CHIP_TYPES.DURATION), 'Kein Laufzeit-Chip ohne Kundenwunsch');
assert.ok(!bareElektroChips.some((c) => c.type === CHIP_TYPES.LOCATION), 'Kein Standort-Chip ohne Kundenwunsch');
assert.ok(bareElektroChips.some((c) => c.type === CHIP_TYPES.FUEL), 'Elektro-Chip bleibt');

const sevenSeaterStated = buildCustomerStatedChips(
  { query: 'Elektro 7-Sitzer bis 50.000 €', maxPrice: 50000, termMonths: 48, mileagePerYear: 10000 },
  { rawQuery: 'Elektro 7-Sitzer bis 50.000 €' },
);
assert.deepEqual(
  sevenSeaterStated.map((c) => c.label),
  ['Elektro', '7 Sitze', 'bis 50.000 €'],
  'Nur Kundenwünsche in Bereich 1 – Elektro · Sitze · Budget',
);
assert.ok(!sevenSeaterStated.some((c) => c.label.includes('Kauf')), 'Kein inferiertes Kauf');
assert.ok(!sevenSeaterStated.some((c) => c.label.includes('km')), 'Keine Default-km');
assert.ok(!sevenSeaterStated.some((c) => c.label.includes('Monate')), 'Keine Default-Laufzeit');

const cleverAsk = getCleverAskQuestions(
  { query: 'Elektro 7-Sitzer bis 50.000 €', maxPrice: 50000 },
  { rawQuery: 'Elektro 7-Sitzer bis 50.000 €' },
);
assert.equal(cleverAsk.length, 1, 'Clever fragt nach Zahlungsart');
assert.equal(cleverAsk[0].id, 'payment');

const advisorAsk = getCleverAskQuestions(
  { query: 'Elektro bis 300 €', maxRate: 300 },
  { rawQuery: 'Elektro bis 300 €' },
  { excludePayment: true },
);
assert.equal(advisorAsk.length, 0, 'Berater-Journey fragt nicht nach Zahlungsart');

console.log('✓ Alle Chip-Config-Tests bestanden.');
