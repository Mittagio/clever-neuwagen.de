/**
 * Plausibilitätsprüfung NACH Intent-Parsing, VOR der Fahrzeugsuche.
 * Die KI/der Parser übersetzt – hier wird „Quatsch“ abgefangen.
 */

import { POWER_PS_TOLERANCE } from '../../data/search/searchTermDictionary.js';

const SPORT_CONTEXT = /sport|gti|gt-line|amg|m\d|rs\d|ferrari|porsche|bmw m/i;

/**
 * @param {ReturnType<import('./searchIntentParser.js').parseSearchIntent>} intent
 */
export function checkSearchPlausibility(intent) {
  const warnings = [];
  const possibleCorrections = [];
  const intentPatches = {};

  checkPowerPs(intent, warnings, possibleCorrections);
  checkCashVsLeasing(intent, warnings, possibleCorrections);
  checkRangeVsRate(intent, warnings);
  checkSeatsVsPrice(intent, warnings);
  checkUnrealisticEvCombo(intent, warnings, possibleCorrections);

  return {
    warnings,
    possibleCorrections,
    intentPatches,
    needsUserChoice: possibleCorrections.some((c) => c.requiresChoice),
  };
}

function checkPowerPs(intent, warnings, corrections) {
  const ps = intent.powerPsTarget;
  if (ps == null) return;

  const sportCtx = SPORT_CONTEXT.test(intent.rawQuery) || SPORT_CONTEXT.test(intent.normalizedQuery ?? '');
  const smallCar = intent.bodyType === 'kleinwagen' || (!intent.bodyType && !intent.model);

  if (ps >= 500 && !sportCtx) {
    const suggested = ps >= 100 ? Math.round(ps / 10) : null;
    if (suggested != null && suggested >= 40 && suggested <= 200) {
      warnings.push(`${ps} PS wirkt ungewöhnlich für eine normale Fahrzeugsuche.`);
      corrections.push({
        field: 'powerPsTarget',
        original: `${ps} PS`,
        suggestion: `${suggested} PS`,
        reason: `${ps} PS könnte ein Tippfehler sein (z. B. „r${ps}“ statt „${suggested}“).`,
        requiresChoice: true,
        applyPatch: {
          powerPsTarget: suggested,
          powerPsMin: suggested - POWER_PS_TOLERANCE,
          powerPsMax: suggested + POWER_PS_TOLERANCE,
        },
        labelAccept: `${suggested} PS suchen`,
        labelKeep: `${ps} PS beibehalten`,
      });
    } else {
      warnings.push(`${ps} PS wirkt ungewöhnlich hoch.`);
    }
    return;
  }

  if (ps >= 150 && smallCar && !sportCtx) {
    warnings.push(`${ps} PS ist für einen Kleinwagen eher untypisch.`);
  }
}

function checkCashVsLeasing(intent, warnings, corrections) {
  if (intent.payment !== 'cash') return;
  if (intent.maxPrice == null || intent.maxPrice >= 1000) return;

  warnings.push('Ein Kaufpreis unter 1.000 € ist als Neuwagen unrealistisch.');
  corrections.push({
    field: 'maxPrice',
    original: `${intent.maxPrice} €`,
    suggestion: 'Leasing bis 400 €/Monat',
    reason: 'Meinten Sie eine monatliche Leasingrate statt eines Kaufpreises?',
    requiresChoice: true,
    applyPatch: {
      payment: 'leasing',
      maxRate: intent.maxPrice,
      maxPrice: null,
    },
    labelAccept: 'Leasingrate suchen',
    labelKeep: 'Kaufpreis beibehalten',
  });
}

function checkRangeVsRate(intent, warnings) {
  if (intent.rangeKmMin != null && intent.rangeKmMin >= 800 && intent.maxRate != null && intent.maxRate <= 500) {
    warnings.push('1000 km Reichweite bei einem Budget unter 500 €/Monat ist selten – wir zeigen die besten Alternativen.');
  }
}

function checkSeatsVsPrice(intent, warnings) {
  if (intent.seatsMin >= 8 && intent.maxPrice != null && intent.maxPrice <= 30000) {
    warnings.push('8 Sitze unter 30.000 € sind als Neuwagen selten. Wir zeigen passende 7-Sitzer und größere Fahrzeuge.');
  }
}

function checkUnrealisticEvCombo(intent, warnings, corrections) {
  const q = `${intent.rawQuery} ${intent.normalizedQuery}`.toLowerCase();
  if (/elektro/.test(q) && /diesel/.test(q) && intent.fuel) {
    warnings.push('Elektro und Diesel gleichzeitig passt nicht zusammen.');
    corrections.push({
      field: 'fuel',
      original: 'Elektro + Diesel',
      suggestion: 'Nur Elektro',
      reason: 'Welchen Antrieb meinen Sie?',
      requiresChoice: true,
      applyPatch: { fuel: 'elektro' },
      labelAccept: 'Elektro',
      labelKeep: 'Diesel',
      altPatch: { fuel: 'diesel' },
    });
  }
}

const FUEL_PATCH = {
  elektro: 'elektro',
  diesel: 'diesel',
  hybrid: 'hybrid',
  verbrenner: 'verbrenner',
};

/** Korrektur aus UI → Marketplace-Filter */
export function correctionToFilterPatch(correction, accept = true) {
  if (!accept || !correction?.applyPatch) return {};
  const p = correction.applyPatch;
  const patch = { intentStructured: true };
  if (p.powerPsTarget != null) {
    patch.powerPsTarget = p.powerPsTarget;
    patch.powerPsMin = p.powerPsMin;
    patch.powerPsMax = p.powerPsMax;
  }
  if (p.maxRate != null) patch.maxRate = p.maxRate;
  if (p.maxPrice === null) patch.maxPrice = null;
  if (p.payment) patch.payment = p.payment;
  if (p.fuel) patch.fuel = FUEL_PATCH[p.fuel] ?? p.fuel;
  if (p.transmission) patch.transmission = p.transmission;
  return patch;
}

/** Korrektur aus UI anwenden */
export function applyPlausibilityCorrection(filters, correction, accept = true) {
  if (!accept) return filters;
  return { ...filters, ...correctionToFilterPatch(correction, true) };
}
