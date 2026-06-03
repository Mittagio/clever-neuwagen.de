/** Kundensichtbare Kraftstoff-Labels – intern bleibt verbrenner/diesel/… */

export const CUSTOMER_FUEL_LABELS = {
  elektro: 'Elektro',
  hybrid: 'Hybrid',
  'plugin-hybrid': 'Plug-in-Hybrid',
  plugin_hybrid: 'Plug-in-Hybrid',
  diesel: 'Diesel',
  verbrenner: 'Benziner',
  benzin: 'Benziner',
};

export function customerFuelLabel(fuel, features = []) {
  if (features?.includes('elektro') || fuel === 'elektro') return 'Elektro';
  if (fuel && CUSTOMER_FUEL_LABELS[fuel]) return CUSTOMER_FUEL_LABELS[fuel];
  if (features?.includes('benzin')) return 'Benziner';
  return null;
}
