/** Trim → Feature-Zuordnung pro Modell (Marktplatz-Heuristik, sync mit Kia-Registry) */
export const TRIM_FEATURE_MAP = {
  sportage: {
    modelLabel: 'Kia Sportage',
    baseRate: { core: 279, vision: 299, spirit: 349, 'black-edition': 369, 'gt-line': 389 },
    trims: [
      {
        id: 'core',
        name: 'Core',
        standardFeatures: ['rear_camera', 'parking_rear', 'large_trunk', 'family_suv'],
        availableViaPackage: ['heated_seats', 'parking_front'],
        notAvailable: ['camera_360', 'blind_spot', 'panorama_roof', 'head_up_display'],
      },
      {
        id: 'vision',
        name: 'Vision',
        standardFeatures: ['heated_seats', 'rear_camera', 'parking_rear', 'large_trunk', 'family_suv'],
        availableViaPackage: ['parking_front', 'blind_spot', 'camera_360', 'panorama_roof', 'harman_kardon'],
        notAvailable: ['head_up_display'],
      },
      {
        id: 'spirit',
        name: 'Spirit',
        standardFeatures: ['parking_front', 'parking_rear', 'blind_spot', 'heated_seats', 'rear_camera', 'large_trunk', 'family_suv'],
        availableViaPackage: ['camera_360', 'panorama_roof', 'harman_kardon', 'towbar'],
        notAvailable: ['head_up_display', 'tow_capacity_2000'],
      },
      {
        id: 'black-edition',
        name: 'Black Edition',
        standardFeatures: ['camera_360', 'panorama_roof', 'harman_kardon', 'heated_seats', 'heated_rear_seats', 'large_trunk', 'family_suv'],
        availableViaPackage: ['blind_spot'],
        notAvailable: ['tow_capacity_2000'],
      },
      {
        id: 'gt-line',
        name: 'GT-Line',
        standardFeatures: ['camera_360', 'blind_spot', 'heated_seats', 'parking_front', 'parking_rear', 'rear_camera', 'power_tailgate', 'head_up_display', 'harman_kardon', 'ventilated_seats', 'large_trunk', 'family_suv', 'automatic'],
        availableViaPackage: ['towbar'],
        notAvailable: [],
      },
    ],
  },
  ev3: {
    modelLabel: 'Kia EV3',
    baseRate: { air: 299, earth: 318, 'gt-line': 379 },
    trims: [
      {
        id: 'air',
        name: 'Air',
        standardFeatures: ['rear_camera', 'parking_rear', 'elektro', 'family_suv'],
        availableViaPackage: ['heated_seats', 'power_tailgate'],
        notAvailable: ['camera_360', 'heat_pump', 'blind_spot', 'towbar', 'panorama_roof'],
      },
      {
        id: 'earth',
        name: 'Earth',
        standardFeatures: ['heated_seats', 'heat_pump', 'rear_camera', 'parking_front', 'parking_rear', 'elektro', 'family_suv', 'range_400'],
        availableViaPackage: ['camera_360', 'blind_spot', 'power_tailgate', 'remote_parking'],
        notAvailable: ['panorama_roof', 'head_up_display', 'harman_kardon'],
      },
      {
        id: 'gt-line',
        name: 'GT-Line',
        standardFeatures: [
          'heated_seats', 'heat_pump', 'camera_360', 'power_tailgate',
          'blind_spot', 'rear_camera', 'parking_front', 'parking_rear',
          'steering_heat', 'elektro', 'family_suv', 'range_400',
        ],
        availableViaPackage: ['harman_kardon', 'head_up_display', 'panorama_roof'],
        notAvailable: [],
      },
    ],
  },
  ev4: {
    modelLabel: 'Kia EV4',
    baseRate: { air: 319, earth: 339, 'gt-line': 399 },
    trims: [
      {
        id: 'air',
        name: 'Air',
        standardFeatures: ['rear_camera', 'parking_rear', 'elektro', 'range_400'],
        availableViaPackage: ['heated_seats', 'heat_pump'],
        notAvailable: ['camera_360', 'power_tailgate'],
      },
      {
        id: 'earth',
        name: 'Earth',
        standardFeatures: ['heated_seats', 'heat_pump', 'rear_camera', 'parking_front', 'parking_rear', 'elektro', 'range_400'],
        availableViaPackage: ['camera_360', 'power_tailgate', 'blind_spot'],
        notAvailable: ['panorama_roof'],
      },
      {
        id: 'gt-line',
        name: 'GT-Line',
        standardFeatures: [
          'heated_seats', 'heat_pump', 'camera_360', 'power_tailgate',
          'blind_spot', 'rear_camera', 'parking_front', 'parking_rear',
          'steering_heat', 'elektro', 'range_400',
        ],
        availableViaPackage: ['harman_kardon', 'head_up_display'],
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
  if (m.includes('ev4')) return 'ev4';
  if (m.includes('tucson')) return 'tucson';
  if (m.includes('niro')) return 'niro';
  if (m.includes('ceed')) return 'ceed';
  return m.replace(/\s+/g, '-');
}

export function inferTrimFromTitle(title) {
  const t = (title ?? '').toLowerCase();
  if (t.includes('black edition') || t.includes('black-edition')) return 'black-edition';
  if (t.includes('gt-line') || t.includes('gt line')) return 'gt-line';
  if (t.includes('earth')) return 'earth';
  if (t.includes('air')) return 'air';
  if (t.includes('spirit')) return 'spirit';
  if (t.includes('vision')) return 'vision';
  if (t.includes('core')) return 'core';
  if (t.includes('st-line') || t.includes('st line')) return 'st-line';
  if (t.includes('inspiration')) return 'inspiration';
  return '';
}

export function getModelTrims(modelKey) {
  return TRIM_FEATURE_MAP[modelKey]?.trims ?? [];
}

export function getTrimConfig(modelKey, trimId) {
  const trims = getModelTrims(modelKey);
  return trims.find((tr) => tr.id === trimId) ?? trims[0] ?? null;
}
