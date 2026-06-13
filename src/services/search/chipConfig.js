/**
 * Zentrale Chip-Definitionen – jeder Chip ist ein steuerbarer Suchparameter.
 */

import { RADIUS_CHIP_OPTIONS } from '../../logic/oneSearchService.js';
import { getLocationDisplayLabel, parseLocationFromText } from '../../logic/advisorLocation.js';
import { getFeatureLabel } from '../../data/features/featureCatalog.js';
import {
  buildMileageSelectOptions,
  buildMileageChipSelectOptions,
  buildDurationChipSelectOptions,
  buildMileageKmValues,
  buildTermMonthValues,
  normalizeCustomerTermMonths,
  shouldShowTermChip,
} from './leasingRangeOptions.js';
import { buildFeaturesFilterPatch } from './featureFilterSync.js';
import { customerFuelLabel } from './customerFuelLabels.js';
import { parseSearchIntent } from './searchIntentParser.js';
import {
  formatLengthLimitLabel,
  formatHeightLimitLabel,
  formatTrunkMinLabel,
  formatIsofixRearLabel,
} from '../cleverData/vehicleDimensions.js';

export {
  TERM_MONTHS_MIN,
  TERM_MONTHS_MAX,
  MILEAGE_KM_MIN,
  MILEAGE_KM_MAX,
  MILEAGE_KM_STEP,
  buildTermMonthValues,
  buildMileageKmValues,
  buildTermSelectOptions,
  buildMileageSelectOptions,
} from './leasingRangeOptions.js';

export const CHIP_TYPES = {
  FUEL: 'fuel',
  PAYMENT: 'payment',
  BUDGET: 'budget',
  CASH_BUDGET: 'cash_budget',
  MILEAGE: 'mileage',
  DURATION: 'duration',
  MODEL: 'model',
  MODEL_REFINE: 'model_refine',
  TRIM: 'trim',
  LOCATION: 'location',
  RADIUS: 'radius',
  AVAILABILITY: 'availability',
  TRANSMISSION: 'transmission',
  BODY_TYPE: 'bodyType',
  FEATURE: 'feature',
  WISH_ADD: 'wish_add',
  POWER: 'power',
};

/** Quick-Chips im „+ Wunsch hinzufügen“-Editor */
export const QUICK_WISH_FEATURE_IDS = [
  'towbar',
  'rear_camera',
  'camera_360',
  'heated_seats',
  'automatic',
  'blind_spot',
  'heat_pump',
  'seats_7',
  'tow_capacity_2000',
  'range_400',
];

export const WISH_ADD_CHIP_ID = '__wish_add__';

export const WISH_ADD_CHIP = {
  id: WISH_ADD_CHIP_ID,
  type: CHIP_TYPES.WISH_ADD,
  label: '+ Wunsch hinzufügen',
  value: WISH_ADD_CHIP_ID,
  editable: true,
};

const FEATURE_EDITOR_MORE_IDS = [
  'rear_camera',
  'blind_spot',
  'towbar',
  'panorama_roof',
  'heat_pump',
  'parking_front',
  'automatic',
  'seats_7',
  'tow_capacity_2000',
  'range_400',
];

/** Typen mit garantiertem Editor-Inhalt */
export const EDITABLE_CHIP_TYPES = new Set([
  CHIP_TYPES.FUEL,
  CHIP_TYPES.PAYMENT,
  CHIP_TYPES.BUDGET,
  CHIP_TYPES.CASH_BUDGET,
  CHIP_TYPES.MILEAGE,
  CHIP_TYPES.DURATION,
  CHIP_TYPES.MODEL,
  CHIP_TYPES.MODEL_REFINE,
  CHIP_TYPES.TRIM,
  CHIP_TYPES.LOCATION,
  CHIP_TYPES.RADIUS,
  CHIP_TYPES.AVAILABILITY,
  CHIP_TYPES.TRANSMISSION,
  CHIP_TYPES.BODY_TYPE,
]);

export const CHIP_CONFIGS = {
  mileage: {
    type: CHIP_TYPES.MILEAGE,
    title: 'Wie viele Kilometer fahren Sie pro Jahr?',
    updateTarget: 'mileagePerYear',
    queryParam: 'mileageYear',
    options: buildMileageChipSelectOptions(),
  },
  duration: {
    type: CHIP_TYPES.DURATION,
    title: 'Welche Laufzeit möchten Sie?',
    updateTarget: 'termMonths',
    queryParam: 'term',
    options: buildDurationChipSelectOptions(),
  },
  wish_features: {
    type: CHIP_TYPES.WISH_ADD,
    title: 'Was soll Ihr Auto noch haben?',
    updateTarget: 'features',
    hint: 'Aktive Wünsche können Sie ab- oder wieder zuschalten.',
  },
  payment: {
    type: CHIP_TYPES.PAYMENT,
    title: 'Wie möchten Sie bezahlen?',
    updateTarget: 'payment',
    queryParam: 'payment',
    options: [
      { label: 'Leasing', value: 'leasing' },
      { label: 'Finanzierung', value: 'finance' },
      { label: 'Kauf', value: 'cash' },
    ],
  },
  fuel: {
    type: CHIP_TYPES.FUEL,
    title: 'Welchen Antrieb suchen Sie?',
    updateTarget: 'fuel',
    queryParam: 'fuel',
    options: [
      { label: 'Elektro', value: 'elektro' },
      { label: 'Benziner', value: 'verbrenner' },
      { label: 'Diesel', value: 'diesel' },
      { label: 'Hybrid', value: 'hybrid' },
      { label: 'Plug-in-Hybrid', value: 'plugin-hybrid' },
      { label: 'Alle Antriebe', value: '' },
    ],
  },
  budget: {
    type: CHIP_TYPES.BUDGET,
    title: 'Welches Budget passt?',
    updateTarget: 'maxRate',
    queryParam: 'maxRate',
    options: [
      { label: 'bis 200 €/Monat', value: 200 },
      { label: 'bis 300 €/Monat', value: 300 },
      { label: 'bis 400 €/Monat', value: 400 },
      { label: 'bis 500 €/Monat', value: 500 },
      { label: 'offen', value: null },
    ],
    customInputLabel: 'Eigenes Budget eingeben',
    customInputPlaceholder: 'z. B. 350',
    customInputSuffix: '€ / Monat',
  },
  cash_budget: {
    type: CHIP_TYPES.CASH_BUDGET,
    title: 'Welches Budget passt?',
    updateTarget: 'maxPrice',
    queryParam: 'maxPrice',
    options: [
      { label: 'bis 15.000 €', value: 15000 },
      { label: 'bis 20.000 €', value: 20000 },
      { label: 'bis 25.000 €', value: 25000 },
      { label: 'bis 30.000 €', value: 30000 },
      { label: 'offen', value: null },
    ],
    customInputLabel: 'Eigenen Kaufpreis eingeben',
    customInputPlaceholder: 'z. B. 22000',
    customInputSuffix: '€',
  },
  model_refine: {
    type: CHIP_TYPES.MODEL_REFINE,
    title: 'Fahrzeugauswahl ändern',
    hint: 'Ihre Suche bleibt offen – Sie grenzen nur ein, was angezeigt wird.',
    options: [
      { label: 'Ähnliche Fahrzeuge anzeigen', value: 'similar', action: 'similar' },
      { label: 'Andere Modelle derselben Marke', value: 'same_brand', action: 'same_brand' },
      { label: 'Alle Marken anzeigen', value: 'open_brands', action: 'open_brands' },
      { label: 'Modell frei eingeben', value: 'custom_model', action: 'custom_model' },
    ],
  },
  model: {
    type: CHIP_TYPES.MODEL,
    title: 'Welches Modell suchen Sie?',
    updateTarget: 'model',
    queryParam: 'model',
    options: [
      { label: 'Sportage', value: 'Sportage' },
      { label: 'EV3', value: 'EV3' },
      { label: 'EV4', value: 'EV4' },
      { label: 'EV5', value: 'EV5' },
      { label: 'Picanto', value: 'Picanto' },
      { label: 'Ceed SW', value: 'Ceed SW' },
      { label: 'Niro EV', value: 'Niro EV' },
    ],
    customInputLabel: 'Modell eingeben',
    customInputPlaceholder: 'z. B. Sorento',
  },
  trim: {
    type: CHIP_TYPES.TRIM,
    title: 'Welche Ausstattung möchten Sie sehen?',
    hint: 'Andere Ausstattung kann Preis und Verfügbarkeit verändern.',
    updateTarget: 'trim',
    queryParam: 'trim',
    options: [
      { label: 'Vision', value: 'Vision' },
      { label: 'Spirit', value: 'Spirit' },
      { label: 'GT-Line', value: 'GT-Line' },
      { label: 'GT-Line AWD', value: 'GT-Line AWD' },
    ],
  },
  transmission: {
    type: CHIP_TYPES.TRANSMISSION,
    title: 'Welches Getriebe bevorzugen Sie?',
    updateTarget: 'transmission',
    queryParam: 'transmission',
    options: [
      { label: 'Automatik', value: 'automatic' },
      { label: 'Schaltgetriebe', value: 'manual' },
      { label: 'Keine Präferenz', value: '' },
    ],
  },
  bodyType: {
    type: CHIP_TYPES.BODY_TYPE,
    title: 'Welche Fahrzeuggröße suchen Sie?',
    updateTarget: 'type',
    queryParam: 'type',
    options: [
      { label: 'Kleinwagen', value: 'kleinwagen' },
      { label: 'SUV', value: 'suv' },
      { label: 'Kombi', value: 'kombi' },
      { label: 'Alle', value: 'all' },
    ],
  },
  availability: {
    type: CHIP_TYPES.AVAILABILITY,
    title: 'Wann soll das Fahrzeug verfügbar sein?',
    updateTarget: 'availability',
    queryParam: 'availability',
    options: [
      { label: 'Sofort verfügbar', value: 'sofort' },
      { label: 'Alle Verfügbarkeiten', value: '' },
    ],
  },
  location: {
    type: CHIP_TYPES.LOCATION,
    title: 'Standort und Umkreis ändern',
    updateTarget: 'location',
  },
  radius: {
    type: CHIP_TYPES.RADIUS,
    title: 'Wie weit dürfen die Händler entfernt sein?',
    updateTarget: 'radius',
    queryParam: 'radius',
    options: RADIUS_CHIP_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
  },
  feature_automatic: {
    type: CHIP_TYPES.FEATURE,
    title: 'Welches Getriebe bevorzugen Sie?',
    updateTarget: 'features',
    options: [
      { label: 'Automatik', value: 'automatic' },
      { label: 'Keine Präferenz', value: 'none' },
    ],
  },
};

const FUEL_LABELS = {
  elektro: 'Elektro',
  hybrid: 'Hybrid',
  verbrenner: 'Benziner',
  diesel: 'Diesel',
  'plugin-hybrid': 'Plug-in-Hybrid',
  plugin_hybrid: 'Plug-in-Hybrid',
};

const POWERTRAIN_BODY_TYPES = new Set([
  'verbrenner', 'elektro', 'diesel', 'hybrid', 'plugin-hybrid', 'plugin_hybrid',
]);

const PAYMENT_LABELS = {
  leasing: 'Leasing',
  finance: 'Finanzierung',
  cash: 'Kauf',
};

function formatKm(n) {
  return `${Number(n).toLocaleString('de-DE')} km/Jahr`;
}

function rebuildQuery(filters, overrides = {}) {
  const model = overrides.model ?? filters.model;
  const trim = overrides.trim ?? filters.trim;
  const parts = [];
  if (model) parts.push(model);
  if (trim) parts.push(trim);
  const fuel = overrides.fuel ?? filters.fuel;
  if (fuel === 'verbrenner') parts.push('Benziner');
  else if (fuel === 'diesel') parts.push('Diesel');
  else if (fuel === 'elektro') parts.push('Elektro');
  else if (fuel === 'hybrid') parts.push('Hybrid');
  else if (fuel === 'plugin-hybrid') parts.push('Plug-in-Hybrid');
  const payment = overrides.payment ?? filters.payment;
  if (payment === 'leasing') parts.push('Leasing');
  if (filters.query && parts.length === 0) return filters.query;
  return parts.join(' ').trim() || filters.query;
}

/** Chip-Typ aus Legacy-Feldern */
export function resolveChipType(chip) {
  if (chip?.type === 'budget' && chip?.id === 'maxPrice') return CHIP_TYPES.CASH_BUDGET;
  if (chip?.type === 'model_refine' || chip?.type === CHIP_TYPES.MODEL_REFINE) {
    return CHIP_TYPES.MODEL_REFINE;
  }
  if (chip?.type) return chip.type;
  const field = chip?.field;
  if (field === 'maxRate') return CHIP_TYPES.BUDGET;
  if (field === 'maxPrice') return CHIP_TYPES.CASH_BUDGET;
  if (field === 'mileagePerYear') return CHIP_TYPES.MILEAGE;
  if (field === 'termMonths') return CHIP_TYPES.DURATION;
  if (field === 'feature' && chip?.id === 'automatic') return CHIP_TYPES.FEATURE;
  if (field === 'transmission') return CHIP_TYPES.TRANSMISSION;
  return field ?? CHIP_TYPES.FEATURE;
}

export function isChipEditable(chip) {
  if (chip?.id === WISH_ADD_CHIP_ID || chip?.type === CHIP_TYPES.WISH_ADD) return true;
  if (chip?.editable === false) return false;
  const type = resolveChipType(chip);
  if (EDITABLE_CHIP_TYPES.has(type)) return true;
  if (type === CHIP_TYPES.FEATURE && chip?.featureId && getFeatureLabel(chip.featureId)) return true;
  if (type === CHIP_TYPES.FEATURE && chip?.id === 'automatic') return true;
  if (type === CHIP_TYPES.LOCATION) return true;
  return false;
}

function makeChip({
  id,
  type,
  label,
  value,
  updateTarget,
  configKey,
  editable = true,
  featureId,
}) {
  const cfg = configKey ? CHIP_CONFIGS[configKey] : null;
  return {
    id,
    type,
    label,
    value,
    currentValue: value,
    updateTarget: updateTarget ?? cfg?.updateTarget,
    possibleValues: cfg?.options?.map((o) => o.value) ?? [],
    editable,
    featureId,
    field: updateTarget ?? cfg?.updateTarget,
  };
}

/**
 * Strukturierte Chips aus Intent (nicht aus Rohtext)
 * @param {object} intent
 * @param {object} [filters]
 */
function userAskedForMileage(intent, filters = {}) {
  if (filters.mileagePerYearExplicit) return true;
  const q = (intent.rawQuery ?? filters.query ?? '').toLowerCase();
  return /\d[\d.\s]*\s*(000\s*)?km|\bkm\/jahr\b|kilometer\s*pro\s*jahr/i.test(q);
}

function userAskedForTerm(intent, filters = {}) {
  if (filters.termMonthsExplicit) return true;
  const q = (intent.rawQuery ?? filters.query ?? '').toLowerCase();
  return /\d+\s*monate|laufzeit|\bmon\.\b/i.test(q);
}

export function userAskedForPayment(intent, filters = {}) {
  if (filters.paymentExplicit) return true;
  if (intent.paymentExplicit) return true;
  const q = (intent.rawQuery ?? filters.query ?? '').toLowerCase();
  return /\bleasing\b|\bfinanzier|\bkauf\b|\bbar\b|\bmonat|\brate\b/i.test(q);
}

function userAskedForLocation(intent, filters = {}) {
  if (intent.location) return true;
  const q = filters.query ?? intent.rawQuery ?? '';
  if (q.trim() && parseLocationFromText(q)) return true;
  return false;
}

export function createEditableChips(intent, filters = {}) {
  const chips = [];
  const payment = intent.payment ?? filters.payment ?? 'leasing';

  if (intent.bodyType && !POWERTRAIN_BODY_TYPES.has(intent.bodyType)) {
    const labels = { kleinwagen: 'Kleinwagen', suv: 'SUV', kombi: 'Kombi' };
    chips.push(makeChip({
      id: 'bodyType',
      type: CHIP_TYPES.BODY_TYPE,
      label: labels[intent.bodyType] ?? intent.bodyType,
      value: intent.bodyType,
      configKey: 'bodyType',
    }));
  }

  if (intent.powerPsTarget) {
    chips.push(makeChip({
      id: 'powerPs',
      type: CHIP_TYPES.POWER,
      label: `ca. ${intent.powerPsTarget} PS`,
      value: intent.powerPsTarget,
      updateTarget: 'powerPsTarget',
      editable: false,
    }));
  }

  const fuelFeatures = intent.features ?? filters.features ?? [];
  const resolvedFuel = intent.fuel
    ?? (filters.fuel === 'elektro' ? 'elektro' : filters.fuel === 'hybrid' ? 'hybrid' : filters.fuel === 'plugin-hybrid' ? 'plugin-hybrid' : filters.fuel || null);
  const fuelLabel = customerFuelLabel(resolvedFuel, fuelFeatures);
  if (fuelLabel && !chips.some((c) => c.type === CHIP_TYPES.FUEL) && !(intent.fuelAlternatives?.length >= 2)) {
    chips.push(makeChip({
      id: 'fuel',
      type: CHIP_TYPES.FUEL,
      label: fuelLabel,
      value: resolvedFuel === 'verbrenner' ? 'verbrenner' : resolvedFuel,
      configKey: 'fuel',
    }));
  }

  if (intent.payment && userAskedForPayment(intent, filters)) {
    chips.push(makeChip({
      id: 'payment',
      type: CHIP_TYPES.PAYMENT,
      label: PAYMENT_LABELS[intent.payment] ?? intent.payment,
      value: intent.payment,
      configKey: 'payment',
    }));
  }

  const USE_CASE_LABELS = {
    city: 'Stadt',
    family: 'Familie',
    long: 'Langstrecke',
    gewerbe: 'Gewerbe',
  };
  if (filters.useCase && USE_CASE_LABELS[filters.useCase]) {
    chips.push(makeChip({
      id: 'useCase',
      type: CHIP_TYPES.FEATURE,
      label: USE_CASE_LABELS[filters.useCase],
      value: filters.useCase,
      editable: false,
    }));
  }

  const maxRate = intent.maxRate ?? filters.maxRate;
  if (maxRate != null && payment !== 'cash') {
    chips.push(makeChip({
      id: 'maxRate',
      type: CHIP_TYPES.BUDGET,
      label: `bis ${maxRate} €/Monat`,
      value: maxRate,
      configKey: 'budget',
    }));
  }

  if (intent.maxPrice != null || filters.maxPrice != null) {
    const price = intent.maxPrice ?? filters.maxPrice;
    chips.push(makeChip({
      id: 'maxPrice',
      type: CHIP_TYPES.CASH_BUDGET,
      label: `bis ${Number(price).toLocaleString('de-DE')} €`,
      value: price,
      configKey: 'cash_budget',
    }));
  }

  const seatsMin = intent.seatsMin ?? filters.seatsMin;
  if (seatsMin != null && seatsMin >= 7 && !chips.some((c) => c.id === 'seats_7')) {
    chips.push(makeChip({
      id: 'seats_7',
      type: CHIP_TYPES.FEATURE,
      label: '7-Sitzer',
      value: seatsMin,
      editable: false,
    }));
  } else if (seatsMin != null && seatsMin < 7 && !chips.some((c) => c.id === 'seatsMin')) {
    chips.push(makeChip({
      id: 'seatsMin',
      type: CHIP_TYPES.FEATURE,
      label: `${seatsMin} Sitze`,
      value: seatsMin,
      editable: false,
    }));
  }

  const rangeKmMin = intent.rangeKmMin ?? filters.rangeKmMin;
  if (rangeKmMin != null && !chips.some((c) => c.id === 'rangeKmMin')) {
    chips.push(makeChip({
      id: 'rangeKmMin',
      type: CHIP_TYPES.FEATURE,
      label: `≥ ${rangeKmMin} km Reichweite`,
      value: rangeKmMin,
      editable: false,
    }));
  }

  const maxLengthMm = intent.maxLengthMm ?? filters.maxLengthMm;
  if (maxLengthMm != null) {
    chips.push(makeChip({
      id: 'maxLengthMm',
      type: CHIP_TYPES.FEATURE,
      label: formatLengthLimitLabel(maxLengthMm),
      value: maxLengthMm,
      editable: false,
    }));
  }

  const maxHeightMm = intent.maxHeightMm ?? filters.maxHeightMm;
  if (maxHeightMm != null) {
    chips.push(makeChip({
      id: 'maxHeightMm',
      type: CHIP_TYPES.FEATURE,
      label: formatHeightLimitLabel(maxHeightMm),
      value: maxHeightMm,
      editable: false,
    }));
  }

  const trunkLMin = intent.trunkLMin ?? filters.trunkLMin;
  if (trunkLMin != null) {
    chips.push(makeChip({
      id: 'trunkLMin',
      type: CHIP_TYPES.FEATURE,
      label: formatTrunkMinLabel(trunkLMin),
      value: trunkLMin,
      editable: false,
    }));
  }

  const isofixRearMin = intent.isofixRearMin ?? filters.isofixRearMin;
  if (isofixRearMin != null) {
    chips.push(makeChip({
      id: 'isofixRearMin',
      type: CHIP_TYPES.FEATURE,
      label: formatIsofixRearLabel(isofixRearMin),
      value: isofixRearMin,
      editable: false,
    }));
  }

  const towCapacityKg = intent.towCapacityKg ?? filters.towCapacityKg;
  if (towCapacityKg != null && !chips.some((c) => c.id === 'tow_braked')) {
    const tons = towCapacityKg / 1000;
    const tonsLabel = Number.isInteger(tons) ? String(tons) : tons.toFixed(1).replace('.', ',');
    chips.push(makeChip({
      id: 'tow_braked',
      type: CHIP_TYPES.FEATURE,
      label: `Anhängelast ≥ ${tonsLabel} t`,
      value: towCapacityKg,
      editable: false,
    }));
  }

  if (intent.fuelAlternatives?.length >= 2) {
    const labels = intent.fuelAlternatives.map((fuel) => {
      if (fuel === 'elektro') return 'Elektro';
      if (fuel === 'hybrid') return 'Hybrid';
      if (fuel === 'plugin-hybrid') return 'Plug-in-Hybrid';
      if (fuel === 'diesel') return 'Diesel';
      if (fuel === 'verbrenner') return 'Benzin';
      return fuel;
    });
    chips.push(makeChip({
      id: 'fuel_alternatives',
      type: CHIP_TYPES.FUEL,
      label: labels.join(' oder '),
      value: intent.fuelAlternatives,
      editable: false,
    }));
  }

  if (intent.existingLead) {
    chips.push(makeChip({
      id: 'existing_lead',
      type: CHIP_TYPES.FEATURE,
      label: 'Bereits Anfrage gestellt',
      value: true,
      editable: false,
    }));
  }

  const modelExplicit = intent.modelExplicit ?? filters.modelExplicit;
  if (modelExplicit && intent.model) {
    chips.push(makeChip({
      id: 'model',
      type: CHIP_TYPES.MODEL_REFINE,
      label: intent.model,
      value: intent.model,
      configKey: 'model_refine',
    }));
  }

  if (modelExplicit && intent.trim) {
    chips.push(makeChip({
      id: 'trim',
      type: CHIP_TYPES.TRIM,
      label: intent.trim,
      value: intent.trim,
      configKey: 'trim',
    }));
  }

  const mileage = intent.mileagePerYear ?? filters.mileagePerYear;
  if (mileage && userAskedForMileage(intent, filters)) {
    chips.push(makeChip({
      id: 'mileagePerYear',
      type: CHIP_TYPES.MILEAGE,
      label: formatKm(mileage),
      value: mileage,
      configKey: 'mileage',
    }));
  }

  const term = normalizeCustomerTermMonths(intent.durationMonths ?? filters.termMonths);
  if (shouldShowTermChip(term) && userAskedForTerm(intent, filters)) {
    chips.push(makeChip({
      id: 'termMonths',
      type: CHIP_TYPES.DURATION,
      label: `${term} Monate`,
      value: term,
      configKey: 'duration',
    }));
  }

  if (intent.availability === 'sofort_verfuegbar' || filters.availability === 'sofort') {
    const queryText = intent.rawQuery ?? filters.query ?? '';
    const zeitnah = /zeitnah/i.test(queryText);
    chips.push(makeChip({
      id: 'availability',
      type: CHIP_TYPES.AVAILABILITY,
      label: zeitnah ? 'Zeitnahe Verfügbarkeit' : 'Sofort verfügbar',
      value: 'sofort',
      configKey: 'availability',
    }));
  }

  if (intent.transmission === 'automatic') {
    chips.push(makeChip({
      id: 'automatic',
      type: CHIP_TYPES.FEATURE,
      label: 'Automatik',
      value: 'automatic',
      configKey: 'feature_automatic',
      featureId: 'automatic',
    }));
  }
  if (intent.transmission === 'manual') {
    chips.push(makeChip({
      id: 'manual',
      type: CHIP_TYPES.TRANSMISSION,
      label: 'Schaltgetriebe',
      value: 'manual',
      configKey: 'transmission',
    }));
  }

  const statedFeatures = [...new Set([...(intent.features ?? []), ...(filters.features ?? [])])];
  for (const fid of statedFeatures) {
    if (['reichweite', 'automatic', 'benzin', 'elektro'].includes(fid)) continue;
    if (fid === 'towbar' && towCapacityKg != null) continue;
    if (fid === 'seats_7' && seatsMin != null && seatsMin >= 7) continue;
    if (intent.fuel === 'verbrenner' && fid === 'benzin') continue;
    if (intent.fuel === 'elektro' && fid === 'elektro') continue;
    if (!getFeatureLabel(fid)) continue;
    chips.push(makeChip({
      id: fid,
      type: CHIP_TYPES.FEATURE,
      label: getFeatureLabel(fid) ?? fid,
      value: fid,
      updateTarget: 'features',
      configKey: 'wish_features',
      editable: true,
      featureId: fid,
    }));
  }

  if (userAskedForLocation(intent, filters)) {
    const locLabel = getLocationDisplayLabel({
      city: filters.city,
      plz: filters.plz,
      label: filters.locLabel ?? intent.location,
    });
    if (locLabel) {
      const radius = filters.radius ?? 25;
      chips.push(makeChip({
        id: 'location',
        type: CHIP_TYPES.LOCATION,
        label: filters.radius != null ? `${locLabel} · ${radius} km` : locLabel,
        value: locLabel,
        configKey: 'location',
      }));
    } else if (intent.location) {
      chips.push(makeChip({
        id: 'location',
        type: CHIP_TYPES.LOCATION,
        label: intent.location,
        value: intent.location,
        configKey: 'location',
      }));
    }
  }

  return chips.slice(0, 12);
}

const STATED_CHIP_EMOJI = {
  fuel: '⚡',
  seats_7: '👨‍👩‍👧‍👦',
  seatsMin: '👥',
  maxLengthMm: '📏',
  maxHeightMm: '🏠',
  trunkLMin: '🧳',
  isofixRearMin: '👶',
  rangeKmMin: '⚡',
  maxPrice: '💰',
  maxRate: '💰',
};

const STATED_CHIP_ORDER = [
  'fuel',
  'fuel_alternatives',
  'tow_braked',
  'availability',
  'existing_lead',
  'seats_7',
  'seatsMin',
  'maxLengthMm',
  'maxHeightMm',
  'trunkLMin',
  'isofixRearMin',
  'bodyType',
  'model',
  'trim',
  'maxRate',
  'maxPrice',
  'payment',
  'mileagePerYear',
  'termMonths',
  'availability',
  'useCase',
  'location',
];

function statedChipSortIndex(chip) {
  const index = STATED_CHIP_ORDER.indexOf(chip.id);
  return index === -1 ? STATED_CHIP_ORDER.length : index;
}

/** Bereich 1: Nur was der Kunde wirklich gesagt hat – keine Defaults, kein inferiertes Leasing/Kauf. */
export function buildCustomerStatedChips(filters = {}, wishes = {}) {
  const intent = parseSearchIntent(filters.query ?? wishes.rawQuery ?? '');
  const chips = createEditableChips(intent, filters);
  return chips
    .map((chip) => ({
      ...chip,
      emoji: STATED_CHIP_EMOJI[chip.id]
        ?? (chip.type === CHIP_TYPES.FUEL ? STATED_CHIP_EMOJI.fuel : null),
      readOnly: true,
    }))
    .sort((a, b) => statedChipSortIndex(a) - statedChipSortIndex(b));
}

/** Bereich 2: Freiwillige Verfeinerung – Zahlungsart, Ausstattung, Verfügbarkeit. */
export function buildSearchRefineChips(filters = {}, statedChips = []) {
  const statedTypes = new Set(statedChips.map((c) => c.type));
  const activeFeatures = new Set(filters.features ?? []);
  const options = [];

  if (!filters.payment && !statedTypes.has(CHIP_TYPES.PAYMENT)) {
    options.push(
      { id: 'refine_cash', label: '+ Kauf', patch: { payment: 'cash', paymentExplicit: true } },
      { id: 'refine_finance', label: '+ Finanzierung', patch: { payment: 'finance', paymentExplicit: true } },
      { id: 'refine_leasing', label: '+ Leasing', patch: { payment: 'leasing', paymentExplicit: true } },
    );
  }

  if (!activeFeatures.has('range_400') && filters.rangeKmMin == null) {
    options.push({
      id: 'refine_range',
      label: '+ Reichweite',
      patch: buildFeaturesFilterPatch(filters, [...(filters.features ?? []), 'range_400']),
    });
  }
  if (!activeFeatures.has('towbar')) {
    options.push({
      id: 'refine_towbar',
      label: '+ Anhängerkupplung',
      patch: buildFeaturesFilterPatch(filters, [...(filters.features ?? []), 'towbar']),
    });
  }
  if (!activeFeatures.has('heat_pump')) {
    options.push({
      id: 'refine_heat_pump',
      label: '+ Wärmepumpe',
      patch: buildFeaturesFilterPatch(filters, [...(filters.features ?? []), 'heat_pump']),
    });
  }
  if (filters.availability !== 'sofort') {
    options.push({
      id: 'refine_sofort',
      label: '+ Sofort verfügbar',
      patch: { availability: 'sofort' },
    });
  }

  return options;
}

/** Bereich 3: Clever fragt nach – nur bei echter Unschärfe, kein Hyperchat. */
export function getCleverAskQuestions(filters = {}, wishes = {}, options = {}) {
  const { excludePayment = false } = options;
  const intent = parseSearchIntent(filters.query ?? wishes.rawQuery ?? '');
  const questions = [];

  const hasBudget = intent.maxPrice != null || filters.maxPrice != null
    || intent.maxRate != null || filters.maxRate != null;

  if (intent.fuelAlternatives?.length >= 2 && !filters.fuel) {
    questions.push({
      id: 'fuel_choice',
      kicker: 'Damit ich genauer empfehlen kann',
      title: 'Welche Antriebsart bevorzugen Sie?',
      options: [
        { id: 'fuel_hybrid', label: 'Hybrid', patch: { fuel: 'hybrid', type: 'hybrid', fuelAlternatives: null } },
        { id: 'fuel_elektro', label: 'Elektro', patch: { fuel: 'elektro', type: 'elektro', fuelAlternatives: null } },
        { id: 'fuel_any', label: 'Beides egal', patch: {} },
      ],
    });
  }

  if (!excludePayment && hasBudget && !userAskedForPayment(intent, filters) && !filters.payment) {
    questions.push({
      id: 'payment',
      kicker: 'Damit ich besser helfen kann',
      title: 'Welche Zahlungsart bevorzugen Sie?',
      options: [
        { id: 'payment_any', label: 'Egal', patch: {} },
        { id: 'payment_cash', label: 'Kauf', patch: { payment: 'cash', paymentExplicit: true } },
        { id: 'payment_finance', label: 'Finanzierung', patch: { payment: 'finance', paymentExplicit: true } },
        { id: 'payment_leasing', label: 'Leasing', patch: { payment: 'leasing', paymentExplicit: true } },
      ],
    });
  }

  return questions;
}

function getConfigForChip(chip) {
  const type = resolveChipType(chip);
  if (type === CHIP_TYPES.MILEAGE) return CHIP_CONFIGS.mileage;
  if (type === CHIP_TYPES.DURATION) return CHIP_CONFIGS.duration;
  if (type === CHIP_TYPES.PAYMENT) return CHIP_CONFIGS.payment;
  if (type === CHIP_TYPES.FUEL) return CHIP_CONFIGS.fuel;
  if (type === CHIP_TYPES.BUDGET) return CHIP_CONFIGS.budget;
  if (type === CHIP_TYPES.CASH_BUDGET) return CHIP_CONFIGS.cash_budget;
  if (type === CHIP_TYPES.MODEL_REFINE) return CHIP_CONFIGS.model_refine;
  if (type === CHIP_TYPES.MODEL) return CHIP_CONFIGS.model;
  if (type === CHIP_TYPES.TRIM) return CHIP_CONFIGS.trim;
  if (type === CHIP_TYPES.TRANSMISSION) return CHIP_CONFIGS.transmission;
  if (type === CHIP_TYPES.BODY_TYPE) return CHIP_CONFIGS.bodyType;
  if (type === CHIP_TYPES.AVAILABILITY) return CHIP_CONFIGS.availability;
  if (type === CHIP_TYPES.RADIUS) return CHIP_CONFIGS.radius;
  if (type === CHIP_TYPES.LOCATION) return CHIP_CONFIGS.location;
  if (type === CHIP_TYPES.FEATURE && chip?.id === 'automatic') return CHIP_CONFIGS.feature_automatic;
  if (type === CHIP_TYPES.FEATURE || type === CHIP_TYPES.WISH_ADD) return CHIP_CONFIGS.wish_features;
  return null;
}

export function buildFeatureEditorConfig(filters) {
  const active = filters.features ?? [];
  const activeSet = new Set(active);
  const activeItems = active
    .filter((id) => getFeatureLabel(id))
    .map((id) => ({
      id,
      label: getFeatureLabel(id),
      isActive: true,
    }));

  const moreIds = [...new Set([...QUICK_WISH_FEATURE_IDS, ...FEATURE_EDITOR_MORE_IDS])]
    .filter((id) => !activeSet.has(id));

  const quickItems = QUICK_WISH_FEATURE_IDS.map((id) => ({
    id,
    label: getFeatureLabel(id) ?? id,
    isActive: activeSet.has(id),
  }));

  const moreItems = moreIds
    .filter((id) => !QUICK_WISH_FEATURE_IDS.includes(id))
    .map((id) => ({
      id,
      label: getFeatureLabel(id) ?? id,
      isActive: false,
    }));

  return {
    activeItems,
    quickItems,
    moreItems,
  };
}

function isFuelActive(filters, value) {
  if (filters.fuel) return filters.fuel === value;
  const q = (filters.query ?? '').toLowerCase();
  if (value === 'verbrenner') return /benzin|benziner|verbrenner/.test(q);
  if (value === 'diesel') return /diesel/.test(q);
  if (value === 'elektro') return /elektro|e-auto|ev\b/.test(q);
  if (value === 'hybrid') return /hybrid/.test(q) && !/plug/.test(q);
  if (value === 'plugin-hybrid') return /plug/.test(q);
  return false;
}

function currentValueForChip(chip, filters) {
  const type = resolveChipType(chip);
  switch (type) {
    case CHIP_TYPES.MILEAGE:
      return filters.mileagePerYear ?? chip.value;
    case CHIP_TYPES.DURATION:
      return filters.termMonths ?? chip.value;
    case CHIP_TYPES.PAYMENT:
      return filters.payment || chip.value || 'leasing';
    case CHIP_TYPES.FUEL:
      return filters.fuel || chip.value;
    case CHIP_TYPES.BUDGET:
      return filters.maxRate ?? chip.value;
    case CHIP_TYPES.CASH_BUDGET:
      return filters.maxPrice ?? chip.value;
    case CHIP_TYPES.MODEL:
      return filters.model || chip.value;
    case CHIP_TYPES.TRIM:
      return filters.trim || chip.value;
    case CHIP_TYPES.TRANSMISSION:
      return filters.transmission || chip.value;
    case CHIP_TYPES.BODY_TYPE:
      return filters.type && filters.type !== 'all' ? filters.type : chip.value;
    case CHIP_TYPES.AVAILABILITY:
      return filters.availability ?? chip.value ?? '';
    case CHIP_TYPES.RADIUS:
      return filters.radius ?? chip.value;
    default:
      return chip?.value;
  }
}

/** Editor-UI-Konfiguration – niemals leer für editierbare Chips */
export function getChipEditorConfig(chip, filters) {
  const type = resolveChipType(chip);
  const cfg = getConfigForChip(chip);
  const current = currentValueForChip(chip, filters);

  if (!cfg || !isChipEditable(chip)) {
    return {
      editable: false,
      title: null,
      hint: null,
      options: [],
      showCustomInput: false,
      showFallback: true,
      fallbackMessage: 'Diese Suche kann aktuell über das Suchfeld geändert werden.',
      fallbackButtonLabel: 'Suche bearbeiten',
    };
  }

  if (type === CHIP_TYPES.FEATURE || type === CHIP_TYPES.WISH_ADD) {
    const featureUi = buildFeatureEditorConfig(filters);
    return {
      editable: true,
      title: type === CHIP_TYPES.WISH_ADD ? 'Was soll Ihr Auto noch haben?' : 'Ausstattung ändern',
      hint: 'Aktive Wünsche',
      options: [],
      showFeatureEditor: true,
      ...featureUi,
      showCustomInput: true,
      customInputLabel: 'Freitext-Wunsch',
      customInputPlaceholder: 'z. B. großer Kofferraum oder mindestens 2 Tonnen Anhängelast',
      showFallback: false,
    };
  }

  if (type === CHIP_TYPES.LOCATION) {
    const locLabel = getLocationDisplayLabel({
      city: filters.city,
      plz: filters.plz,
      label: filters.locLabel,
    });
    return {
      editable: true,
      title: cfg.title,
      hint: locLabel ? `Aktuell: ${locLabel}` : null,
      options: [],
      showLocationActions: true,
      showRadiusSection: true,
      radiusOptions: RADIUS_CHIP_OPTIONS.map((o) => ({
        label: o.label,
        value: o.value,
        isActive: filters.radius === o.value,
      })),
      showCustomInput: true,
      customInputLabel: 'PLZ oder Ort eingeben',
      customInputPlaceholder: 'z. B. 73614 oder Schorndorf',
      showFallback: false,
    };
  }

  const options = (cfg.options ?? []).map((o) => ({
    label: o.label,
    value: o.value,
    isActive: type === CHIP_TYPES.FUEL
      ? isFuelActive(filters, o.value)
      : current === o.value || (o.value == null && (current == null || current === '')),
  }));

  return {
    editable: true,
    title: cfg.title,
    hint: cfg.hint ?? null,
    options,
    showCustomInput: Boolean(cfg.customInputLabel),
    customInputLabel: cfg.customInputLabel,
    customInputPlaceholder: cfg.customInputPlaceholder,
    customInputSuffix: cfg.customInputSuffix,
    showFallback: false,
  };
}

export function buildChipFilterPatch(type, value, filters) {
  switch (type) {
    case CHIP_TYPES.FUEL:
      if (!value) {
        return {
          fuel: '',
          type: filters.type && !POWERTRAIN_BODY_TYPES.has(filters.type) ? filters.type : 'all',
          query: rebuildQuery(filters, { fuel: null }),
        };
      }
      return { fuel: value, type: value === 'elektro' ? 'elektro' : filters.type, query: rebuildQuery(filters, { fuel: value }) };
    case CHIP_TYPES.PAYMENT:
      if (value === 'cash') {
        return { payment: 'cash', paymentExplicit: true, maxRate: null, query: rebuildQuery(filters, { payment: value }) };
      }
      if (value === 'leasing' || value === 'finance') {
        return { payment: value, paymentExplicit: true, maxPrice: null, query: rebuildQuery(filters, { payment: value }) };
      }
      return { payment: value, paymentExplicit: true, query: rebuildQuery(filters, { payment: value }) };
    case CHIP_TYPES.MODEL_REFINE:
      if (value === 'open_brands' || value === 'similar') {
        return { model: '', brand: '', trim: '', modelExplicit: false };
      }
      if (value === 'same_brand' && filters.brand) {
        return { model: '', trim: '', modelExplicit: false, brand: filters.brand };
      }
      if (value === 'custom_model') {
        return {};
      }
      return {};
    case CHIP_TYPES.MODEL:
      return {
        model: value,
        modelExplicit: true,
        query: rebuildQuery({ ...filters, model: value }),
      };
    case CHIP_TYPES.TRIM:
      return { trim: value, query: rebuildQuery({ ...filters, trim: value }) };
    case CHIP_TYPES.BUDGET:
      return { maxRate: value, maxPrice: null };
    case CHIP_TYPES.CASH_BUDGET:
      return { maxPrice: value, maxRate: null, payment: 'cash' };
    case CHIP_TYPES.MILEAGE:
      return { mileagePerYear: value };
    case CHIP_TYPES.DURATION:
      return { termMonths: value };
    case CHIP_TYPES.RADIUS:
      return { radius: value };
    case CHIP_TYPES.AVAILABILITY:
      return { availability: value };
    case CHIP_TYPES.TRANSMISSION:
      return { transmission: value || '' };
    case CHIP_TYPES.BODY_TYPE:
      return { type: value || 'all' };
    case CHIP_TYPES.FEATURE:
    case CHIP_TYPES.WISH_ADD:
      if (Array.isArray(value)) {
        return buildFeaturesFilterPatch(filters, value);
      }
      if (value === 'automatic') {
        const features = [...(filters.features ?? [])];
        if (!features.includes('automatic')) features.push('automatic');
        return { features, transmission: 'automatic', query: `${filters.query ?? ''} Automatik`.trim() };
      }
      if (value === 'none') {
        return {
          features: (filters.features ?? []).filter((f) => f !== 'automatic'),
          transmission: '',
          query: (filters.query ?? '').replace(/\bautomatik\b/gi, '').replace(/\s+/g, ' ').trim(),
        };
      }
      return {};
    default:
      return {};
  }
}

/** @deprecated Alias */
export function getChipEditConfig(chip, filters) {
  const editor = getChipEditorConfig(chip, filters);
  return {
    question: editor.title ?? '',
    hint: editor.hint,
    options: editor.options,
    showCustomInput: editor.showCustomInput,
    customInputLabel: editor.customInputLabel,
    customInputPlaceholder: editor.customInputPlaceholder,
    customInputSuffix: editor.customInputSuffix,
    showLocationActions: editor.showLocationActions,
    showRadiusSection: editor.showRadiusSection,
    radiusOptions: editor.radiusOptions,
    showFallback: editor.showFallback,
    fallbackMessage: editor.fallbackMessage,
    fallbackButtonLabel: editor.fallbackButtonLabel,
    editable: editor.editable,
  };
}
