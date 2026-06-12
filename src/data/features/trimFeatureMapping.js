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
  ceed: {
    modelLabel: 'Kia Ceed',
    baseRate: { vision: 239, spirit: 259, 'gt-line': 279 },
    trims: [
      {
        id: 'vision',
        name: 'Vision',
        standardFeatures: ['rear_camera', 'parking_rear'],
        availableViaPackage: ['heated_seats'],
        notAvailable: ['camera_360', 'towbar'],
      },
      {
        id: 'spirit',
        name: 'Spirit',
        standardFeatures: ['heated_seats', 'steering_heat', 'rear_camera', 'parking_rear'],
        availableViaPackage: ['blind_spot', 'camera_360'],
        notAvailable: ['towbar'],
      },
      {
        id: 'gt-line',
        name: 'GT-Line',
        standardFeatures: ['heated_seats', 'steering_heat', 'rear_camera', 'parking_rear', 'blind_spot'],
        availableViaPackage: ['camera_360', 'harman_kardon'],
        notAvailable: ['towbar'],
      },
    ],
  },
  stonic: {
    modelLabel: 'Kia Stonic',
    baseRate: { vision: 219, spirit: 249, 'gt-line': 269 },
    trims: [
      {
        id: 'vision',
        name: 'Vision',
        standardFeatures: ['rear_camera', 'parking_rear'],
        availableViaPackage: ['heated_seats'],
        notAvailable: ['camera_360', 'towbar'],
      },
      {
        id: 'spirit',
        name: 'Spirit',
        standardFeatures: ['heated_seats', 'rear_camera', 'parking_rear'],
        availableViaPackage: ['blind_spot', 'camera_360'],
        notAvailable: ['towbar'],
      },
      {
        id: 'gt-line',
        name: 'GT-Line',
        standardFeatures: ['heated_seats', 'rear_camera', 'parking_rear', 'blind_spot'],
        availableViaPackage: ['camera_360'],
        notAvailable: ['towbar'],
      },
    ],
  },
  'pv5-passenger': {
    modelLabel: 'Kia PV5 Passenger',
    baseRate: { r: 339, earth: 368, elite: 397 },
    trims: [
      {
        id: 'r',
        name: 'R',
        standardFeatures: ['heated_seats', 'rear_camera', 'elektro', 'large_trunk'],
        availableViaPackage: [],
        notAvailable: ['power_sliding_doors', 'heat_pump', 'power_tailgate', 'camera_360'],
      },
      {
        id: 'earth',
        name: 'Earth',
        standardFeatures: ['heated_seats', 'heat_pump', 'rear_camera', 'elektro', 'large_trunk'],
        availableViaPackage: ['camera_360'],
        notAvailable: ['power_sliding_doors', 'power_tailgate'],
      },
      {
        id: 'elite',
        name: 'Elite',
        standardFeatures: [
          'heated_seats', 'heat_pump', 'camera_360', 'power_sliding_doors',
          'power_tailgate', 'rear_camera', 'elektro', 'large_trunk',
        ],
        availableViaPackage: [],
        notAvailable: [],
      },
    ],
  },
  'pv5-cargo-l2h1': {
    modelLabel: 'Kia PV5 Cargo',
    baseRate: { plus: 387 },
    trims: [
      {
        id: 'plus',
        name: 'Plus',
        standardFeatures: ['rear_camera', 'large_trunk'],
        availableViaPackage: ['towbar'],
        notAvailable: ['heat_pump', 'camera_360', 'seats_7', 'heated_seats'],
      },
    ],
  },
  'pv5-chassis-cab': {
    modelLabel: 'Kia PV5 Chassis Cab',
    baseRate: { plus: 339 },
    trims: [
      {
        id: 'plus',
        name: 'Plus',
        standardFeatures: ['rear_camera'],
        availableViaPackage: ['towbar'],
        notAvailable: ['heat_pump', 'camera_360', 'seats_7', 'heated_seats', 'large_trunk'],
      },
    ],
  },
  'pv5-crew': {
    modelLabel: 'Kia PV5 Crew',
    baseRate: { plus: 339 },
    trims: [
      {
        id: 'plus',
        name: 'Plus',
        standardFeatures: ['rear_camera', 'large_trunk'],
        availableViaPackage: ['towbar'],
        notAvailable: ['heat_pump', 'camera_360', 'seats_7'],
      },
    ],
  },
  'ev6-gt': {
    modelLabel: 'Kia EV6 GT',
    baseRate: { gt: 693 },
    trims: [
      {
        id: 'gt',
        name: 'GT',
        standardFeatures: ['heated_seats', 'heat_pump', 'camera_360', 'blind_spot', 'rear_camera', 'large_trunk', 'towbar'],
        availableViaPackage: ['panorama_roof', 'harman_kardon'],
        notAvailable: [],
      },
    ],
  },
  'ev9-gt': {
    modelLabel: 'Kia EV9 GT',
    baseRate: { gt: 1082 },
    trims: [
      {
        id: 'gt',
        name: 'GT',
        standardFeatures: ['heated_seats', 'heat_pump', 'camera_360', 'blind_spot', 'rear_camera', 'large_trunk', 'seats_7', 'towbar'],
        availableViaPackage: ['panorama_roof'],
        notAvailable: [],
      },
    ],
  },
  'ev4-fastback': {
    modelLabel: 'Kia EV4 Fastback',
    baseRate: { earth: 425, 'gt-line': 455 },
    trims: [
      {
        id: 'earth',
        name: 'Earth',
        standardFeatures: ['heated_seats', 'heat_pump', 'rear_camera', 'large_trunk'],
        availableViaPackage: ['camera_360', 'blind_spot', 'towbar'],
        notAvailable: [],
      },
      {
        id: 'gt-line',
        name: 'GT-Line',
        standardFeatures: ['heated_seats', 'heat_pump', 'camera_360', 'blind_spot', 'rear_camera', 'large_trunk'],
        availableViaPackage: ['towbar', 'panorama_roof'],
        notAvailable: [],
      },
    ],
  },
  'sportage-hybrid': {
    modelLabel: 'Kia Sportage Hybrid',
    baseRate: { spirit: 245, 'gt-line': 285 },
    trims: [
      {
        id: 'spirit',
        name: 'Spirit',
        standardFeatures: ['heated_seats', 'rear_camera', 'large_trunk', 'family_suv', 'towbar'],
        availableViaPackage: ['camera_360', 'blind_spot'],
        notAvailable: ['heat_pump'],
      },
      {
        id: 'gt-line',
        name: 'GT-Line',
        standardFeatures: ['heated_seats', 'rear_camera', 'parking_rear', 'blind_spot', 'large_trunk', 'family_suv', 'towbar'],
        availableViaPackage: ['camera_360', 'panorama_roof'],
        notAvailable: ['heat_pump'],
      },
    ],
  },
  picanto: {
    modelLabel: 'Kia Picanto',
    baseRate: { core: 139, vision: 149, spirit: 169, 'gt-line': 179 },
    trims: [
      {
        id: 'core',
        name: 'Core',
        standardFeatures: ['rear_camera', 'parking_rear'],
        availableViaPackage: [],
        notAvailable: ['heated_seats', 'camera_360', 'towbar', 'heat_pump'],
      },
      {
        id: 'vision',
        name: 'Vision',
        standardFeatures: ['heated_seats', 'steering_heat', 'rear_camera', 'parking_rear'],
        availableViaPackage: [],
        notAvailable: ['camera_360', 'towbar', 'heat_pump'],
      },
      {
        id: 'spirit',
        name: 'Spirit',
        standardFeatures: ['heated_seats', 'steering_heat', 'rear_camera', 'parking_rear'],
        availableViaPackage: ['blind_spot'],
        notAvailable: ['camera_360', 'towbar'],
      },
      {
        id: 'gt-line',
        name: 'GT-Line',
        standardFeatures: ['heated_seats', 'steering_heat', 'rear_camera', 'parking_rear'],
        availableViaPackage: ['blind_spot'],
        notAvailable: ['camera_360', 'towbar'],
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
  if (m.includes('ev4') && m.includes('fastback')) return 'ev4-fastback';
  if (m.includes('ev4')) return 'ev4';
  if (m.includes('ev5')) return 'ev5';
  if (m.includes('ev6') && m.includes('gt')) return 'ev6-gt';
  if (m.includes('ev6')) return 'ev6';
  if (m.includes('ev9') && m.includes('gt')) return 'ev9-gt';
  if (m.includes('ev9')) return 'ev9';
  if (m.includes('ev2')) return 'ev2';
  if (m.includes('sorento') && (m.includes('phev') || m.includes('plug-in'))) return 'sorento-phev';
  if (m.includes('sorento') && m.includes('hybrid')) return 'sorento-hybrid';
  if (m.includes('sorento')) return 'sorento';
  if (m.includes('tucson')) return 'tucson';
  if (m.includes('niro')) return 'niro';
  if (m.includes('ceed')) return 'ceed';
  if (m.includes('picanto')) return 'picanto';
  if (m.includes('stonic')) return 'stonic';
  if (m.includes('pv5')) {
    if (m.includes('cargo')) return 'pv5-cargo-l2h1';
    if (m.includes('chassis')) return 'pv5-chassis-cab';
    if (m.includes('crew')) return 'pv5-crew';
    return 'pv5-passenger';
  }
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
  if (t.includes('plus')) return 'plus';
  return '';
}

export function getModelTrims(modelKey) {
  return TRIM_FEATURE_MAP[modelKey]?.trims ?? [];
}

export function getTrimConfig(modelKey, trimId) {
  const trims = getModelTrims(modelKey);
  return trims.find((tr) => tr.id === trimId) ?? trims[0] ?? null;
}
