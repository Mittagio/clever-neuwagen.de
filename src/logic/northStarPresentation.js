/**
 * Sprint 25 – Nordstern: „Was passt zu mir – und was gibt es in meiner Nähe?“
 */

import { hasLocalizedSearch } from './oneSearchService.js';
import { buildCustomerStatedChips } from '../services/search/chipConfig.js';

const FUEL_LABELS = {
  elektro: 'E-Auto',
  hybrid: 'Hybrid',
  verbrenner: 'Benziner',
  diesel: 'Diesel',
  'plugin-hybrid': 'Plug-in Hybrid',
};

/** URL-type=verbrenner ist Antrieb, kein Karosserie-Chip */
const POWERTRAIN_BODY_TYPES = new Set([
  'verbrenner', 'elektro', 'diesel', 'hybrid', 'plugin-hybrid', 'plugin_hybrid',
]);

const PAYMENT_LABELS = {
  leasing: 'Leasing',
  finance: 'Finanzierung',
  cash: 'Kauf',
};

function enrichIntentFromFilters(intent, filters, wishes) {
  return {
    ...intent,
    fuel: intent.fuel ?? (filters.fuel === 'verbrenner' ? 'verbrenner' : filters.fuel) ?? null,
    payment: intent.payment ?? filters.payment ?? null,
    maxRate: filters.maxRate ?? intent.maxRate,
    maxPrice: filters.maxPrice ?? intent.maxPrice,
    model: filters.modelExplicit
      ? (filters.model || intent.model || wishes.model)
      : null,
    trim: filters.modelExplicit ? (filters.trim || intent.trim || wishes.trim) : null,
    brand: filters.modelExplicit ? (filters.brand || intent.brand) : null,
    modelExplicit: filters.modelExplicit || intent.modelExplicit,
    availability: filters.availability === 'sofort' ? 'sofort_verfuegbar' : intent.availability,
    rangeKmMin: filters.rangeKmMin ?? intent.rangeKmMin,
    towCapacityKg: filters.towCapacityKg ?? intent.towCapacityKg,
    features: filters.features?.length ? filters.features : intent.features,
    mileagePerYear: filters.mileagePerYear ?? intent.mileagePerYear,
    durationMonths: filters.termMonths ?? intent.durationMonths,
    bodyType: (() => {
      const t = filters.type;
      if (t && t !== 'all' && !POWERTRAIN_BODY_TYPES.has(t)) return t;
      return intent.bodyType;
    })(),
    powerPsTarget: filters.powerPsTarget ?? intent.powerPsTarget,
    transmission: filters.transmission || intent.transmission,
  };
}

/** Kompakte Chips – nur Kundenwünsche (Bereich 1), keine System-Defaults. */
export function buildCompactSearchChips(filters, wishes) {
  return buildCustomerStatedChips(filters, wishes);
}

function formatPriceShort(n) {
  if (n >= 1000) return `${Math.round(n / 1000)}.000 €`;
  return `${n} €`;
}

function describeVehicleType(filters, wishes) {
  const q = (filters.query ?? '').toLowerCase();
  if (filters.fuel === 'elektro' || wishes.features.includes('elektro') || /elektro|e-auto/.test(q)) {
    return 'E-Autos';
  }
  if (filters.fuel === 'verbrenner' || wishes.features.includes('benzin')) return 'Fahrzeuge mit Benziner';
  if (filters.type === 'suv' || wishes.vehicleType === 'SUV') return 'SUVs';
  if (filters.model || wishes.model) return `passende ${wishes.model ?? filters.model}-Angebote`;
  return 'passende Fahrzeuge';
}

function fuelLabelFor(filters, wishes) {
  const q = (filters.query ?? '').toLowerCase();
  if (filters.fuel && FUEL_LABELS[filters.fuel]) return FUEL_LABELS[filters.fuel];
  if (wishes.features.includes('elektro') || /elektro|e-auto/.test(q)) return 'Elektro';
  if (wishes.features.includes('benzin') || /benzin|benziner/.test(q)) return 'Benziner';
  return null;
}

/** Sprint 26 – Headline wie Antwort, nicht wie Liste */
export function buildResultsHeadline(topMatch, filters, wishes, { offerCount = 0, dealerCount = 0 } = {}) {
  const model = wishes.model ?? filters.model ?? topMatch?.model?.replace(/^Kia\s+/i, '')?.trim();
  const localized = hasLocalizedSearch(filters);
  const radius = filters.radius ?? 25;
  const count = offerCount;

  if (count === 0) {
    return {
      title: 'Keine exakten Treffer gefunden',
      subtitle: 'Passen Sie Ihre Suche an – wir helfen mit Alternativen.',
    };
  }

  if (model && count === 1) {
    const trim = wishes.trim ?? filters.trim ?? topMatch?.bestTrim;
    const fuel = fuelLabelFor(filters, wishes);
    const dealer = topMatch?.bestOffer?.dealer ?? topMatch?.vehicle?.dealerName;
    const km = topMatch?.bestOffer?.distanceKm ?? topMatch?.vehicle?.distanceKm;
    const parts = [
      topMatch?.model ?? `Kia ${model}`,
      trim,
      fuel,
      dealer && km != null ? `${dealer} · ${km} km entfernt` : null,
    ].filter(Boolean);
    return {
      title: `Wir haben Ihren ${model} gefunden`,
      subtitle: parts.join(' · '),
    };
  }

  if (model && count > 1) {
    return {
      title: `${count} passende ${model}-Angebote${localized ? ' in Ihrer Nähe' : ''}`,
      subtitle: localized
        ? `Im Umkreis von ${radius} km · ${dealerCount} Händler`
        : 'Mit Ihrem Standort zeigen wir Händler in Ihrer Nähe.',
      dealerCount,
    };
  }

  const typeLabel = describeVehicleType(filters, wishes);
  let budgetPart = '';
  if (filters.maxRate) budgetPart = ` bis ${filters.maxRate} €`;

  if (localized) {
    return {
      title: `${count} passende ${typeLabel}${budgetPart} in Ihrer Nähe`,
      subtitle: `Im Umkreis von ${radius} km gefunden`,
      dealerCount,
    };
  }

  return {
    title: `${count} passende ${typeLabel}${budgetPart} gefunden`,
    subtitle: 'Mit Ihrem Standort zeigen wir Händler in Ihrer Nähe.',
    dealerCount,
  };
}

/** @deprecated – Nutze buildResultsHeadline */
export function buildResultsAnswerText(filters, wishes, opts = {}) {
  const h = buildResultsHeadline(null, filters, wishes, opts);
  return h.subtitle ? `${h.title}. ${h.subtitle}` : h.title;
}

export const NORTH_STAR_TAGLINE =
  'Clever-Neuwagen findet passende Neuwagenangebote bei Händlern in deiner Nähe – auch wenn du noch nicht genau weißt, welches Auto du suchst.';
