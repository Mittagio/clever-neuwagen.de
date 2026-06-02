/**
 * Brücke: Kunden-Feature-IDs ↔ Hersteller-Equipment-IDs
 */
export const CUSTOMER_TO_MANUFACTURER = {
  camera_360: ['feat-rundumsichtkamera', 'ev3-360-kamera'],
  parking_front: ['feat-parksensoren-vorn-hinten', 'ev3-parksensoren-vorn'],
  parking_rear: ['feat-parksensoren-hinten', 'feat-rueckfahrkamera', 'ev3-rueckfahrkamera'],
  blind_spot: ['feat-totwinkelassistent', 'ev3-totwinkel'],
  heated_seats: ['feat-sitzheizung-vorn', 'ev3-sitzheizung'],
  steering_heat: ['feat-lenkradheizung', 'ev3-lenkradheizung'],
  head_up_display: ['feat-head-up-display', 'ev3-hud'],
  harman_kardon: ['feat-harman-kardon', 'ev3-harman'],
  towbar: ['acc-anhaenger', 'ev3-anhaenger'],
  remote_parking: ['feat-remote-parken', 'ev3-remote-parken'],
  ventilated_seats: ['feat-sitzventilation-vorn', 'ev3-sitzbelueftung'],
  panorama_roof: ['feat-panoramadach', 'ev3-panorama'],
  power_tailgate: ['feat-elektrische-heckklappe', 'ev3-heckklappe'],
  heat_pump: ['ev3-waermepumpe'],
  automatic: ['ev3-automatik'],
};

export function getManufacturerFeatureIds(customerFeatureId) {
  return CUSTOMER_TO_MANUFACTURER[customerFeatureId] ?? [];
}

export function customerFeatureFromManufacturerId(mfgId) {
  for (const [customerId, mfgIds] of Object.entries(CUSTOMER_TO_MANUFACTURER)) {
    if (mfgIds.includes(mfgId)) return customerId;
  }
  return null;
}
