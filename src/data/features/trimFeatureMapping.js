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
        standardFeatures: ['blind_spot', 'heated_seats', 'heat_pump', 'elektro', 'family_suv', 'range_400'],
        availableViaPackage: ['camera_360'],
        notAvailable: ['towbar', 'tow_capacity_2000'],
      },
    ],
  },
  ev2: {
    modelLabel: 'Kia EV2',
    baseRate: { air: 239, earth: 259 },
    trims: [
      {
        id: 'air',
        name: 'Air',
        standardFeatures: ['rear_camera', 'parking_rear', 'elektro', 'family_suv'],
        availableViaPackage: ['heated_seats', 'heat_pump'],
        notAvailable: ['camera_360', 'towbar'],
      },
      {
        id: 'earth',
        name: 'Earth',
        standardFeatures: ['heated_seats', 'heat_pump', 'rear_camera', 'parking_front', 'parking_rear', 'elektro', 'family_suv'],
        availableViaPackage: ['camera_360', 'blind_spot'],
        notAvailable: ['towbar'],
      },
    ],
  },
  ev5: {
    modelLabel: 'Kia EV5',
    baseRate: { air: 419, earth: 449, 'gt-line': 499 },
    trims: [
      {
        id: 'air',
        name: 'Air',
        standardFeatures: ['rear_camera', 'parking_rear', 'elektro', 'family_suv', 'range_400'],
        availableViaPackage: ['heated_seats', 'heat_pump'],
        notAvailable: ['camera_360', 'towbar'],
      },
      {
        id: 'earth',
        name: 'Earth',
        standardFeatures: ['heated_seats', 'heat_pump', 'rear_camera', 'parking_front', 'parking_rear', 'elektro', 'family_suv', 'range_400'],
        availableViaPackage: ['camera_360', 'blind_spot', 'towbar'],
        notAvailable: [],
      },
      {
        id: 'gt-line',
        name: 'GT-Line',
        standardFeatures: [
          'heated_seats', 'heat_pump', 'camera_360', 'power_tailgate',
          'blind_spot', 'rear_camera', 'parking_front', 'parking_rear',
          'steering_heat', 'elektro', 'family_suv', 'range_400', 'towbar',
        ],
        availableViaPackage: ['harman_kardon', 'panorama_roof'],
        notAvailable: [],
      },
    ],
  },
  ev6: {
    modelLabel: 'Kia EV6',
    baseRate: { air: 399, earth: 429, 'gt-line': 479 },
    trims: [
      {
        id: 'air',
        name: 'Air',
        standardFeatures: ['rear_camera', 'parking_rear', 'elektro', 'family_suv', 'range_400'],
        availableViaPackage: ['heated_seats', 'heat_pump'],
        notAvailable: ['camera_360'],
      },
      {
        id: 'earth',
        name: 'Earth',
        standardFeatures: ['heated_seats', 'heat_pump', 'rear_camera', 'parking_front', 'parking_rear', 'elektro', 'family_suv', 'range_400'],
        availableViaPackage: ['camera_360', 'blind_spot', 'towbar'],
        notAvailable: [],
      },
      {
        id: 'gt-line',
        name: 'GT-Line',
        standardFeatures: [
          'heated_seats', 'heat_pump', 'camera_360', 'power_tailgate',
          'blind_spot', 'rear_camera', 'parking_front', 'parking_rear',
          'steering_heat', 'elektro', 'family_suv', 'range_400', 'towbar',
        ],
        availableViaPackage: ['harman_kardon', 'head_up_display'],
        notAvailable: [],
      },
    ],
  },
  ev9: {
    modelLabel: 'Kia EV9',
    baseRate: { air: 599, earth: 649, 'gt-line': 699 },
    trims: [
      {
        id: 'air',
        name: 'Air',
        standardFeatures: [
          'heated_seats', 'heat_pump', 'rear_camera', 'parking_rear',
          'elektro', 'family_suv', 'range_400', 'seats_7', 'towbar',
        ],
        availableViaPackage: ['camera_360', 'panorama_roof', 'power_tailgate'],
        notAvailable: [],
      },
      {
        id: 'earth',
        name: 'Earth',
        standardFeatures: [
          'heated_seats', 'heat_pump', 'rear_camera', 'parking_front', 'parking_rear',
          'elektro', 'family_suv', 'range_400', 'seats_7', 'towbar', 'power_tailgate',
        ],
        availableViaPackage: ['camera_360', 'panorama_roof'],
        notAvailable: [],
      },
      {
        id: 'gt-line',
        name: 'GT-Line',
        standardFeatures: [
          'heated_seats', 'heated_rear_seats', 'heat_pump', 'camera_360',
          'power_tailgate', 'blind_spot', 'rear_camera', 'parking_front', 'parking_rear',
          'steering_heat', 'elektro', 'family_suv', 'range_400', 'seats_7', 'towbar',
        ],
        availableViaPackage: ['harman_kardon', 'panorama_roof', 'head_up_display'],
        notAvailable: [],
      },
    ],
  },
  sorento: {
    modelLabel: 'Kia Sorento',
    baseRate: { vision: 525, spirit: 545, 'gt-line': 565 },
    trims: [
      {
        id: 'vision',
        name: 'Vision',
        standardFeatures: ['heated_seats', 'rear_camera', 'parking_rear', 'large_trunk', 'family_suv', 'seats_7'],
        availableViaPackage: ['parking_front', 'blind_spot', 'camera_360', 'panorama_roof', 'towbar'],
        notAvailable: ['head_up_display', 'power_tailgate'],
      },
      {
        id: 'spirit',
        name: 'Spirit',
        standardFeatures: [
          'heated_seats', 'rear_camera', 'parking_front', 'parking_rear', 'blind_spot',
          'large_trunk', 'family_suv', 'seats_7',
        ],
        availableViaPackage: ['camera_360', 'panorama_roof', 'power_tailgate', 'towbar'],
        notAvailable: ['head_up_display'],
      },
      {
        id: 'gt-line',
        name: 'GT-Line',
        standardFeatures: [
          'camera_360', 'blind_spot', 'heated_seats', 'heated_rear_seats', 'rear_camera',
          'parking_front', 'parking_rear', 'power_tailgate', 'steering_heat',
          'large_trunk', 'family_suv', 'seats_7', 'towbar', 'automatic',
        ],
        availableViaPackage: ['panorama_roof', 'harman_kardon', 'ventilated_seats', 'head_up_display'],
        notAvailable: [],
      },
    ],
  },
  'sorento-hybrid': {
    modelLabel: 'Kia Sorento Hybrid',
    baseRate: { vision: 515, spirit: 535, 'gt-line': 555 },
    trims: [
      {
        id: 'vision',
        name: 'Vision',
        standardFeatures: ['heated_seats', 'rear_camera', 'parking_rear', 'large_trunk', 'family_suv', 'seats_7'],
        availableViaPackage: ['parking_front', 'blind_spot', 'camera_360', 'panorama_roof', 'towbar'],
        notAvailable: ['head_up_display', 'power_tailgate'],
      },
      {
        id: 'spirit',
        name: 'Spirit',
        standardFeatures: [
          'heated_seats', 'rear_camera', 'parking_front', 'parking_rear', 'blind_spot',
          'large_trunk', 'family_suv', 'seats_7',
        ],
        availableViaPackage: ['camera_360', 'panorama_roof', 'power_tailgate', 'towbar'],
        notAvailable: ['head_up_display'],
      },
      {
        id: 'gt-line',
        name: 'GT-Line',
        standardFeatures: [
          'camera_360', 'blind_spot', 'heated_seats', 'heated_rear_seats', 'rear_camera',
          'parking_front', 'parking_rear', 'power_tailgate', 'steering_heat',
          'large_trunk', 'family_suv', 'seats_7', 'towbar', 'automatic',
        ],
        availableViaPackage: ['panorama_roof', 'harman_kardon', 'ventilated_seats', 'head_up_display'],
        notAvailable: [],
      },
    ],
  },
  'sportage-hybrid': {
    modelLabel: 'Kia Sportage Hybrid',
    baseRate: { core: 279, vision: 299, spirit: 349, 'gt-line': 389 },
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
        availableViaPackage: ['parking_front', 'blind_spot', 'camera_360', 'panorama_roof'],
        notAvailable: ['head_up_display', 'power_tailgate'],
      },
      {
        id: 'spirit',
        name: 'Spirit',
        standardFeatures: ['parking_front', 'parking_rear', 'blind_spot', 'heated_seats', 'rear_camera', 'large_trunk', 'family_suv'],
        availableViaPackage: ['camera_360', 'panorama_roof', 'towbar'],
        notAvailable: ['head_up_display', 'power_tailgate'],
      },
      {
        id: 'gt-line',
        name: 'GT-Line',
        standardFeatures: [
          'camera_360', 'blind_spot', 'heated_seats', 'parking_front', 'parking_rear',
          'rear_camera', 'power_tailgate', 'steering_heat', 'large_trunk', 'family_suv', 'automatic',
        ],
        availableViaPackage: ['panorama_roof', 'towbar', 'harman_kardon'],
        notAvailable: [],
      },
    ],
  },
  'sorento-phev': {
    modelLabel: 'Kia Sorento PHEV',
    baseRate: { spirit: 489, 'gt-line': 529 },
    trims: [
      {
        id: 'spirit',
        name: 'Spirit',
        standardFeatures: ['heated_seats', 'heat_pump', 'rear_camera', 'large_trunk', 'family_suv', 'seats_7', 'towbar'],
        availableViaPackage: ['camera_360', 'blind_spot'],
        notAvailable: [],
      },
      {
        id: 'gt-line',
        name: 'GT-Line',
        standardFeatures: [
          'heated_seats', 'heat_pump', 'camera_360', 'blind_spot', 'rear_camera',
          'power_tailgate', 'large_trunk', 'family_suv', 'seats_7', 'towbar',
        ],
        availableViaPackage: ['panorama_roof', 'harman_kardon'],
        notAvailable: [],
      },
    ],
  },
  'sportage-phev': {
    modelLabel: 'Kia Sportage PHEV',
    baseRate: { spirit: 349, 'gt-line': 389 },
    trims: [
      {
        id: 'spirit',
        name: 'Spirit',
        standardFeatures: ['heated_seats', 'heat_pump', 'rear_camera', 'large_trunk', 'family_suv', 'towbar'],
        availableViaPackage: ['camera_360', 'blind_spot'],
        notAvailable: [],
      },
      {
        id: 'gt-line',
        name: 'GT-Line',
        standardFeatures: [
          'heated_seats', 'heat_pump', 'camera_360', 'blind_spot', 'rear_camera',
          'power_tailgate', 'large_trunk', 'family_suv', 'towbar',
        ],
        availableViaPackage: ['panorama_roof'],
        notAvailable: [],
      },
    ],
  },
};

export function normalizeModelKey(brand, model) {
  const m = (model ?? '').toLowerCase();
  if (m.includes('sportage') && (m.includes('phev') || m.includes('plug-in'))) return 'sportage-phev';
  if (m.includes('sportage') && m.includes('hybrid')) return 'sportage-hybrid';
  if (m.includes('sportage')) return 'sportage';
  if (m.includes('kuga')) return 'kuga';
  if (m.includes('ev3')) return 'ev3';
  if (m.includes('ev4')) return 'ev4';
  if (m.includes('ev5')) return 'ev5';
  if (m.includes('ev6')) return 'ev6';
  if (m.includes('ev9')) return 'ev9';
  if (m.includes('ev2')) return 'ev2';
  if (m.includes('sorento') && (m.includes('phev') || m.includes('plug-in'))) return 'sorento-phev';
  if (m.includes('sorento') && m.includes('hybrid')) return 'sorento-hybrid';
  if (m.includes('sorento')) return 'sorento';
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
