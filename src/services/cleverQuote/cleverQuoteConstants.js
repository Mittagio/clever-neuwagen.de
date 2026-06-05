/** Tier-Labels und Hilfsfunktionen ohne Manufacturer-Imports */

export const CLEVER_QUOTE_FEATURE_WEIGHTS = {
  range_400: 40,
  camera_360: 20,
  heat_pump: 15,
  heated_seats: 10,
  rear_camera: 10,
  parking_rear: 5,
  parking_front: 5,
  blind_spot: 5,
  panorama_roof: 8,
  towbar: 10,
  power_tailgate: 5,
  harman_kardon: 5,
  head_up_display: 5,
  steering_heat: 5,
  heated_rear_seats: 5,
  remote_parking: 5,
  ventilated_seats: 5,
  family_suv: 12,
  seats_7: 15,
  elektro: 35,
  benzin: 10,
};

export const CLEVER_QUOTE_UNCERTAIN_TIER = {
  id: 'uncertain',
  label: 'Nicht sicher prüfbar',
  dot: 'gray',
};

export const CLEVER_QUOTE_UNCERTAIN_LABEL = 'Derzeit nicht sicher verfügbar';

export const CLEVER_QUOTE_TIERS = [
  { min: 95, id: 'perfect', label: 'Perfekter Treffer', dot: 'green' },
  { min: 85, id: 'very_good', label: 'Sehr guter Treffer', dot: 'green' },
  { min: 70, id: 'good', label: 'Guter Treffer', dot: 'yellow' },
  { min: 50, id: 'alternative', label: 'Alternative', dot: 'orange' },
  { min: 0, id: 'limited', label: 'Nur bedingt passend', dot: 'red' },
];

export function getCleverQuoteTier(percent) {
  if (percent == null || Number.isNaN(percent)) {
    return CLEVER_QUOTE_UNCERTAIN_TIER;
  }
  const p = Math.round(percent);
  return CLEVER_QUOTE_TIERS.find((t) => p >= t.min) ?? CLEVER_QUOTE_TIERS[CLEVER_QUOTE_TIERS.length - 1];
}

export function sortByCleverQuote(matches) {
  return [...matches].sort((a, b) => {
    const qa = a.cleverQuote?.percent ?? a.score ?? 0;
    const qb = b.cleverQuote?.percent ?? b.score ?? 0;
    if (qb !== qa) return qb - qa;
    return (b.score ?? 0) - (a.score ?? 0);
  });
}

export function buildCleverQuoteResultsHeadline() {
  return {
    title: 'Die besten Fahrzeuge für Ihre Wünsche',
    subtitle: 'Sortiert nach CleverQuote™ – Passung vor Preis und Händler',
  };
}

export function buildCleverQuoteCountLine(count = 0, total = null) {
  if (count === 0) return 'Keine Fahrzeuge geprüft';
  if (total != null && total > count) {
    return `${total} Fahrzeuge geprüft · ${count} passen zu Ihren Wünschen`;
  }
  if (count === 1) return '1 Fahrzeug geprüft · passt zu Ihren Wünschen';
  return `${count} Fahrzeuge geprüft · sortiert nach CleverQuote™`;
}

export function buildCuratedResultsLine(total, shown = 3) {
  if (total === 0) return 'Keine Kia-Modelle geprüft';
  if (total <= shown) {
    if (total === 1) return 'Wir haben passende Kia-Modelle geprüft – hier der beste Treffer';
    return 'Wir haben passende Kia-Modelle geprüft – hier die besten Treffer';
  }
  return `${total} Kia-Modelle geprüft – hier die besten ${shown} Treffer`;
}

export function buildAdvisorDiscoveryResultsLine(count) {
  if (count === 0) return 'Keine Elektro-Modelle gefunden';
  if (count === 1) return '1 Elektro-Modelllinie – sortiert nach CleverQuote™';
  return `${count} Elektro-Modelllinien – sortiert nach CleverQuote™`;
}

export function hasCleverQuoteWishes(wishes) {
  const ids = [...(wishes?.features ?? [])];
  if (wishes?.vehicleType === 'SUV' && !ids.includes('family_suv')) {
    ids.push('family_suv');
  }
  return ids.length > 0;
}
