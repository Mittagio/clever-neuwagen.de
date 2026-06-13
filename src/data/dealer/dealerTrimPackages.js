/**
 * Verfügbare Pakete pro Modell – Phase 5 (nach Serienausstattung, nicht Konfigurator-Einstieg).
 * @typedef {{ id: string, label: string, emoji?: string, priceGross: number, trimIds: string[], highlights: string[], features: string[] }} DealerTrimPackage
 */

/** @type {Record<string, DealerTrimPackage[]>} */
export const DEALER_TRIM_PACKAGES = {
  ev5: [
    {
      id: 'ev5-komfort',
      label: 'Komfort-Paket',
      emoji: '📦',
      priceGross: 450,
      trimIds: ['air', 'earth'],
      highlights: ['Elektrische Sitze', 'Memoryfunktion'],
      features: ['ventilated_seats', 'heated_seats'],
    },
    {
      id: 'ev5-tech',
      label: 'Technologie-Paket',
      emoji: '📦',
      priceGross: 1290,
      trimIds: ['earth'],
      highlights: ['360° Kamera', 'Totwinkelassistent', 'Head-Up Display'],
      features: ['camera_360', 'blind_spot', 'head_up_display'],
    },
  ],
  ev6: [
    {
      id: 'ev6-tech',
      label: 'Technologie-Paket',
      emoji: '📦',
      priceGross: 1190,
      trimIds: ['earth'],
      highlights: ['360° Kamera', 'Totwinkelassistent'],
      features: ['camera_360', 'blind_spot'],
    },
    {
      id: 'ev6-premium',
      label: 'Premium-Paket',
      emoji: '📦',
      priceGross: 890,
      trimIds: ['gt-line'],
      highlights: ['Harman Kardon', 'Head-Up Display'],
      features: ['harman_kardon', 'head_up_display'],
    },
  ],
  'sportage-hybrid': [
    {
      id: 'sportage-tech',
      label: 'Technologie-Paket',
      emoji: '📦',
      priceGross: 990,
      trimIds: ['spirit', 'gt-line'],
      highlights: ['360° Kamera', 'Totwinkelassistent'],
      features: ['camera_360', 'blind_spot'],
    },
  ],
};

/**
 * @param {string} modelKey
 * @param {string} trimId
 */
export function getPackagesForTrim(modelKey, trimId) {
  const key = String(modelKey ?? '').toLowerCase();
  const list = DEALER_TRIM_PACKAGES[key] ?? [];
  return list.filter((pkg) => pkg.trimIds.includes(trimId));
}

/**
 * @param {string} modelKey
 * @param {string[]} packageIds
 */
export function resolvePackageFeatureIds(modelKey, packageIds = []) {
  const key = String(modelKey ?? '').toLowerCase();
  const list = DEALER_TRIM_PACKAGES[key] ?? [];
  const features = new Set();
  for (const pkg of list) {
    if (!packageIds.includes(pkg.id)) continue;
    for (const featureId of pkg.features) features.add(featureId);
  }
  return [...features];
}
