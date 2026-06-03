/**
 * Quick-Wunsch-Chips auf der Fahrzeugdetailseite (modellspezifisch)
 */
export const EV3_DETAIL_WISH_CHIPS = [
  'heated_seats',
  'rear_camera',
  'parking_rear',
  'parking_front',
  'camera_360',
  'power_tailgate',
  'heat_pump',
  'towbar',
  'blind_spot',
];

export const DEFAULT_DETAIL_WISH_CHIPS = [
  'heated_seats',
  'rear_camera',
  'camera_360',
  'power_tailgate',
  'heat_pump',
  'towbar',
  'blind_spot',
];

export function getDetailWishChips(brand, model) {
  const m = (model ?? '').toLowerCase();
  if (m.includes('ev3')) return EV3_DETAIL_WISH_CHIPS;
  return DEFAULT_DETAIL_WISH_CHIPS;
}

/** Alternativen wenn Wunsch am Modell nicht erfüllbar ist */
export const WISH_UNAVAILABLE_ALTERNATIVES = {
  tow_capacity_2000: [
    { brand: 'Kia', model: 'Sportage', label: 'Kia Sportage' },
    { brand: 'Hyundai', model: 'Tucson', label: 'Hyundai Tucson' },
    { brand: 'Ford', model: 'Kuga', label: 'Ford Kuga' },
    { brand: 'Dacia', model: 'Duster', label: 'Dacia Duster' },
  ],
  seats_7: [
    { brand: 'Kia', model: 'Sorento', label: 'Kia Sorento' },
    { brand: 'Hyundai', model: 'Santa Fe', label: 'Hyundai Santa Fe' },
  ],
};
