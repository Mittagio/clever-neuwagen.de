/**
 * Sprint 25 – Nordstern: „Was passt zu mir – und was gibt es in meiner Nähe?“
 */

import { hasLocalizedSearch } from './oneSearchService.js';
import { parseSearchIntent } from '../services/search/searchIntentParser.js';
import { createEditableChips, WISH_ADD_CHIP } from '../services/search/chipConfig.js';

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

/** Kompakte Chips – klein, elegant, keine Filteroptik */
export function buildCompactSearchChips(filters, wishes) {
  const intent = enrichIntentFromFilters(parseSearchIntent(filters.query ?? ''), filters, wishes);
  const structuredChips = createEditableChips(intent, filters);
  if (structuredChips.length > 0) {
    return [...structuredChips, WISH_ADD_CHIP];
  }

  const chips = [];
  const q = (filters.query ?? '').toLowerCase();

  if (filters.modelExplicit && (filters.trim || wishes.trim)) {
    const trim = wishes.trim ?? filters.trim;
    chips.push({ id: 'trim', label: trim, type: 'trim', field: 'trim' });
  }

  if (filters.fuel && FUEL_LABELS[filters.fuel]) {
    chips.push({ id: 'fuel', label: FUEL_LABELS[filters.fuel], type: 'fuel', field: 'fuel' });
  } else if (wishes.features.includes('elektro') || /elektro|e-auto|ev\b/.test(q)) {
    chips.push({ id: 'fuel', label: 'E-Auto', type: 'fuel', field: 'fuel' });
  } else if (wishes.features.includes('benzin') || /benzin|benziner/.test(q)) {
    chips.push({ id: 'fuel', label: 'Benziner', type: 'fuel', field: 'fuel' });
  }

  const payment = filters.payment || wishes.budget?.type || 'leasing';
  if (payment && PAYMENT_LABELS[payment]) {
    chips.push({ id: 'payment', label: PAYMENT_LABELS[payment], type: 'payment', field: 'payment' });
  }

  if (filters.maxRate) {
    chips.push({
      id: 'maxRate',
      label: `bis ${filters.maxRate} €`,
      type: 'budget',
      field: 'maxRate',
    });
  }

  if (hasLocalizedSearch(filters)) {
    const loc = filters.locLabel || filters.city || filters.plz;
    if (loc) {
      chips.push({ id: 'location', label: loc, type: 'location', field: 'location' });
    }
    if (filters.radius != null) {
      chips.push({ id: 'radius', label: `${filters.radius} km`, type: 'radius', field: 'radius' });
    }
  }

  if (/automatik/.test(q)) {
    chips.push({ id: 'automatic', label: 'Automatik', type: 'feature', field: 'feature' });
  }
  if (filters.availability === 'sofort' || /sofort/.test(q)) {
    chips.push({
      id: 'availability',
      label: 'Sofort verfügbar',
      type: 'availability',
      field: 'availability',
    });
  }

  return [...chips.slice(0, 8), WISH_ADD_CHIP];
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
