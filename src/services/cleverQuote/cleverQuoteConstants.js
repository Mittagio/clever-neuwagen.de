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

export const CLEVER_QUOTE_TIERS = [
  { min: 95, id: 'perfect', label: 'Perfekter Treffer', dot: 'green' },
  { min: 85, id: 'very_good', label: 'Sehr guter Treffer', dot: 'green' },
  { min: 70, id: 'good', label: 'Guter Treffer', dot: 'yellow' },
  { min: 50, id: 'alternative', label: 'Alternative', dot: 'orange' },
  { min: 0, id: 'limited', label: 'Nur bedingt passend', dot: 'red' },
];

export function getCleverQuoteTier(percent) {
  const p = Math.round(percent ?? 0);
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

export function buildCleverQuoteCountLine(count = 0) {
  if (count === 0) return 'Keine passenden Fahrzeuge';
  if (count === 1) return '1 Fahrzeug für Ihre Wünsche';
  return `${count} Fahrzeuge für Ihre Wünsche · sortiert nach CleverQuote™`;
}

export function hasCleverQuoteWishes(wishes) {
  const ids = [...(wishes?.features ?? [])];
  if (wishes?.vehicleType === 'SUV' && !ids.includes('family_suv')) {
    ids.push('family_suv');
  }
  return ids.length > 0;
}
