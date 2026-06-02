/** Trim → Feature-Zuordnung pro Modell */
export const TRIM_FEATURE_MAP = {
  sportage: {
    modelLabel: 'Kia Sportage',
    baseRate: { vision: 299, spirit: 349, 'gt-line': 389 },
    trims: [
      {
        id: 'vision',
        name: 'Vision',
        standardFeatures: ['parking_rear', 'heated_seats', 'large_trunk', 'family_suv'],
        availableViaPackage: ['parking_front', 'blind_spot', 'towbar'],
        notAvailable: ['camera_360', 'tow_capacity_2000'],
      },
      {
        id: 'spirit',
        name: 'Spirit',
        standardFeatures: ['parking_front', 'parking_rear', 'blind_spot', 'heated_seats', 'towbar', 'large_trunk', 'family_suv'],
        availableViaPackage: ['camera_360'],
        notAvailable: ['tow_capacity_2000'],
      },
      {
        id: 'gt-line',
        name: 'GT-Line',
        standardFeatures: ['camera_360', 'blind_spot', 'heated_seats', 'parking_front', 'parking_rear', 'towbar', 'large_trunk', 'family_suv', 'automatic'],
        availableViaPackage: [],
        notAvailable: [],
      },
    ],
  },
  kuga: {
    modelLabel: 'Ford Kuga',
    baseRate: { 'st-line': 329 },
    trims: [
      {
        id: 'st-line',
        name: 'ST-Line',
        standardFeatures: ['blind_spot', 'parking_rear', 'heated_seats', 'towbar', 'large_trunk', 'family_suv'],
        availableViaPackage: ['camera_360', 'parking_front'],
        notAvailable: ['tow_capacity_2000'],
      },
    ],
  },
  ev3: {
    modelLabel: 'Kia EV3',
    baseRate: { 'gt-line': 349 },
    trims: [
      {
        id: 'gt-line',
        name: 'GT-line',
        standardFeatures: ['camera_360', 'heated_seats', 'blind_spot', 'elektro', 'family_suv'],
        availableViaPackage: [],
        notAvailable: ['towbar', 'tow_capacity_2000'],
      },
    ],
  },
  tucson: {
    modelLabel: 'Hyundai Tucson',
    baseRate: { inspiration: 379 },
    trims: [
      {
        id: 'inspiration',
        name: 'Inspiration',
        standardFeatures: ['camera_360', 'blind_spot', 'heated_seats', 'parking_front', 'towbar', 'large_trunk', 'family_suv'],
        availableViaPackage: [],
        notAvailable: [],
      },
    ],
  },
  niro: {
    modelLabel: 'Kia Niro EV',
    baseRate: { inspiration: 389 },
    trims: [
      {
        id: 'inspiration',
        name: 'Inspiration',
        standardFeatures: ['blind_spot', 'heated_seats', 'elektro', 'family_suv'],
        availableViaPackage: ['camera_360'],
        notAvailable: ['towbar', 'tow_capacity_2000'],
      },
    ],
  },
};

export function normalizeModelKey(brand, model) {
  const m = (model ?? '').toLowerCase();
  if (m.includes('sportage')) return 'sportage';
  if (m.includes('kuga')) return 'kuga';
  if (m.includes('ev3')) return 'ev3';
  if (m.includes('tucson')) return 'tucson';
  if (m.includes('niro')) return 'niro';
  if (m.includes('ceed')) return 'ceed';
  return m.replace(/\s+/g, '-');
}

export function inferTrimFromTitle(title) {
  const t = (title ?? '').toLowerCase();
  if (t.includes('gt-line') || t.includes('gt line')) return 'gt-line';
  if (t.includes('spirit')) return 'spirit';
  if (t.includes('vision')) return 'vision';
  if (t.includes('st-line') || t.includes('st line')) return 'st-line';
  if (t.includes('inspiration')) return 'inspiration';
  return '';
}

export function getModelTrims(modelKey) {
  return TRIM_FEATURE_MAP[modelKey]?.trims ?? [];
}

export function getTrimConfig(modelKey, trimId) {
  const trims = getModelTrims(modelKey);
  return trims.find((t) => t.id === trimId) ?? trims[0] ?? null;
}
