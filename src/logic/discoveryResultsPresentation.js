import { getAvailabilityMeta } from './marketplaceService.js';
import { getFeatureLabel } from '../data/features/featureCatalog.js';
import { DEALER_PROFILES } from '../data/dealers/dealerProfiles.js';
const FUEL_LABELS = {
  elektro: 'Elektro',
  hybrid: 'Hybrid',
  verbrenner: 'Benziner',
  'plugin-hybrid': 'Plug-in Hybrid',
};

const PAYMENT_LABELS = {
  leasing: 'Leasingangebot',
  finance: 'Finanzierungsangebot',
  cash: 'Kaufangebot',
};

/** Elegante ✓-Chips: „Wir haben verstanden“ */
export function buildUnderstoodSearchChips(filters, wishes, topMatch) {
  const chips = [];
  const v = topMatch?.vehicle;
  const brand = v?.brand ?? wishes.brand ?? 'Kia';
  const model = wishes.model ?? filters.model ?? v?.model;
  const trim = wishes.trim ?? filters.trim ?? topMatch?.bestTrim;

  if (model) {
    chips.push({ id: 'model', label: `${brand} ${model}`, field: 'model' });
  }
  if (trim) {
    chips.push({ id: 'trim', label: trim, field: 'trim' });
  }

  const fuel = filters.fuel;
  if (fuel && FUEL_LABELS[fuel]) {
    chips.push({ id: 'fuel', label: FUEL_LABELS[fuel], field: 'fuel' });
  } else if (wishes.features.includes('benzin')) {
    chips.push({ id: 'fuel', label: 'Benziner', field: 'fuel' });
  } else if (wishes.features.includes('elektro')) {
    chips.push({ id: 'fuel', label: 'Elektro', field: 'fuel' });
  } else if (v?.powertrain === 'verbrenner') {
    chips.push({ id: 'fuel', label: 'Benziner', field: 'fuel' });
  } else if (v?.powertrain === 'hybrid') {
    chips.push({ id: 'fuel', label: 'Hybrid', field: 'fuel' });
  } else if (v?.powertrain === 'plugin-hybrid') {
    chips.push({ id: 'fuel', label: 'Plug-in Hybrid', field: 'fuel' });
  }

  const radius = filters.radius ?? wishes.location?.radiusKm ?? 25;
  if (filters.city || filters.plz || filters.locLabel || wishes.location) {
    chips.push({
      id: 'location',
      label: `Händler im Umkreis ${radius} km`,
      field: 'location',
    });
  } else if (filters.radius == null) {
    chips.push({ id: 'location', label: 'Deutschlandweit', field: 'location' });
  }

  const avail = topMatch?.vehicle?.availability ?? filters.availability;
  if (avail === 'sofort' || filters.availability === 'sofort') {
    chips.push({ id: 'availability', label: 'Sofort verfügbar', field: 'availability' });
  }

  const payment = filters.payment || wishes.budget?.type || 'leasing';
  chips.push({
    id: 'payment',
    label: PAYMENT_LABELS[payment] ?? 'Leasingangebot',
    field: 'payment',
  });

  if (filters.maxRate) {
    chips.push({ id: 'maxRate', label: `bis ${filters.maxRate} €/Monat`, field: 'maxRate' });
  }

  for (const fid of wishes.features) {
    if (['benzin', 'elektro', 'family_suv'].includes(fid)) continue;
    chips.push({ id: fid, label: getFeatureLabel(fid), field: 'feature', featureId: fid });
  }

  if (wishes.vehicleType === 'SUV') {
    chips.push({ id: 'suv', label: 'SUV', field: 'type' });
  }

  return chips.slice(0, 10);
}

export function getDealerProfile(dealerSlug) {
  return DEALER_PROFILES[dealerSlug] ?? null;
}

export function buildLocalAvailabilityMessage(match, dealerCount) {
  const km = match?.bestOffer?.distanceKm ?? match?.vehicle?.distanceKm ?? '—';
  const dealers = dealerCount ?? 1;
  if (dealers === 1) {
    return {
      title: '📍 Fahrzeug bei einem Händler',
      subtitle: `${km} km von Ihnen entfernt verfügbar`,
    };
  }
  return {
    title: `📍 Fahrzeug bei ${dealers} Händlern`,
    subtitle: `Bestes Angebot ${km} km von Ihnen entfernt`,
  };
}

export function pickDiscoveryAlternatives(topMatch, restMatches, limit = 6) {
  const topSlug = topMatch?.vehicle?.slug;
  const brand = topMatch?.vehicle?.brand;
  const model = topMatch?.vehicle?.model;

  const scored = restMatches
    .filter((m) => m.vehicle.slug !== topSlug)
    .map((m) => {
      let priority = 0;
      if (m.vehicle.brand === brand && m.vehicle.model === model) priority += 3;
      else if (m.vehicle.brand === brand) priority += 2;
      else if (m.vehicle.bodyType === topMatch?.vehicle?.bodyType) priority += 1;
      return { match: m, priority };
    })
    .sort((a, b) => b.priority - a.priority || b.match.score - a.match.score);

  return scored.slice(0, limit).map((s) => s.match);
}

export function getAvailabilityLabelPlain(vehicle) {
  return getAvailabilityMeta(vehicle?.availability)?.label?.replace(/^.\s*/, '') ?? 'Verfügbar';
}
