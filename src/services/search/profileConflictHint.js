/**
 * Konflikte zwischen Chips, Freitext und Suchprofil (sanfte Hinweise, kein harter Filter).
 */

import { mapIntentFuel } from './searchProfile.js';

/** Untere Rate für 7-Sitzer-Elektro im Kia-Angebot (EV9 Air). */
const MIN_SEVEN_ELECTRIC_MONTHLY_RATE = 500;

function queryHasRangeKm(text = '') {
  return /\d+\s*km\b/i.test(text) || /\breichweite\b/i.test(text);
}

/** Budget nur warnen, wenn Rate/€ im Text oder in Filtern explizit steht – nicht aus „400 km“. */
function hasExplicitBudgetSignal(intent, filters, profile) {
  if (intent?.maxRate != null || filters?.maxRate != null) return true;
  const q = intent?.rawQuery ?? profile?.rawQuery ?? filters?.query ?? '';
  if (/(?:bis|unter|max\.?|maximal)\s*\d+\s*€/i.test(q)) return true;
  if (/\d+\s*€\s*(?:\/|pro\s*)?(?:monat|mt)\b/i.test(q)) return true;
  if (/\b(leasing|finanzier|rate|monat)\b/i.test(q) && /\bbis\s+\d{2,4}\b/i.test(q) && !queryHasRangeKm(q)) {
    return true;
  }
  return false;
}

/**
 * @param {import('./searchProfile.js').SearchProfile|null} profile
 * @param {{ intent?: object, filters?: object }} [ctx]
 */
export function detectProfileConflict(profile, { intent = null, filters = {} } = {}) {
  if (!profile) return null;

  const intentFuel = mapIntentFuel(intent?.fuel ?? null);
  const profileFuel = profile.fuel;

  if (intentFuel && profileFuel && intentFuel !== profileFuel) {
    if (intentFuel === 'hybrid' && profileFuel === 'electric') {
      return {
        type: 'fuel_text_chip_mismatch',
        title: 'Antrieb widersprüchlich',
        message:
          'Im Text steht Hybrid – gleichzeitig ist „Elektro“ aktiv. Wir zeigen Elektro-Modelle; Hybrid-Alternativen finden Sie unter „Weitere Modelle“.',
        severity: 'warning',
      };
    }
    if (intentFuel === 'electric' && profileFuel === 'combustion') {
      return {
        type: 'fuel_text_chip_mismatch',
        title: 'Antrieb widersprüchlich',
        message:
          'Im Text steht Elektro – gleichzeitig ist Benziner/Diesel aktiv. Bitte einen Antrieb wählen.',
        severity: 'warning',
      };
    }
    if (intentFuel === 'combustion' && profileFuel === 'electric') {
      return {
        type: 'fuel_text_chip_mismatch',
        title: 'Antrieb widersprüchlich',
        message:
          'Im Text steht Benziner/Diesel – gleichzeitig ist „Elektro“ aktiv. Wir priorisieren Elektro in den Ergebnissen.',
        severity: 'warning',
      };
    }
  }

  const sevenSeater = (profile.seatsMin ?? 0) >= 7;
  const electric = profileFuel === 'electric';
  const budgetRate = profile.maxMonthlyRate;

  if (
    electric
    && sevenSeater
    && budgetRate != null
    && budgetRate < MIN_SEVEN_ELECTRIC_MONTHLY_RATE
    && hasExplicitBudgetSignal(intent, filters, profile)
  ) {
    return {
      type: 'budget_seven_electric',
      title: 'Anspruchsvolle Kombination',
      message: `Ein Elektro-7-Sitzer unter ${budgetRate} €/Monat gibt es bei Kia nicht. Alternativen: Sorento Plug-in-Hybrid (7 Sitze) oder Budget erweitern (z. B. EV9 ab ca. 600 €).`,
      severity: 'info',
      suggestion: 'sorento-phev',
    };
  }

  if (
    electric
    && budgetRate != null
    && budgetRate <= 300
    && (profile.minRangeKm ?? profile.rangeKmMin ?? 0) >= 400
    && sevenSeater
    && hasExplicitBudgetSignal(intent, filters, profile)
  ) {
    return {
      type: 'budget_range_seven',
      title: 'Viele Wünsche gleichzeitig',
      message:
        'Elektro, 7 Sitze, 400 km Reichweite und unter 300 € passen nicht zusammen. Wir zeigen die nächstbeste Stufe – z. B. Sorento PHEV oder 5-Sitzer-Elektro.',
      severity: 'info',
    };
  }

  if (filters.fuel === 'elektro' && intent?.fuel === 'hybrid') {
    return {
      type: 'fuel_text_chip_mismatch',
      title: 'Antrieb widersprüchlich',
      message: 'Hybrid im Text, Elektro-Chip aktiv – Ergebnisse sind elektrisch.',
      severity: 'warning',
    };
  }

  return null;
}

/**
 * @param {object|null} intentConflict
 * @param {object|null} profileConflict
 */
export function pickSearchConflict(intentConflict, profileConflict) {
  return intentConflict ?? profileConflict ?? null;
}
