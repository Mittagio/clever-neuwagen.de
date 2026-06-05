/**
 * Brücke: Kunden-Feature-IDs ↔ Hersteller-Equipment-IDs
 */
export const CUSTOMER_TO_MANUFACTURER = {
  camera_360: ['feat-rundumsichtkamera', 'ev3-360-kamera', 'ev4-360-kamera', 'picanto-360-kamera', 'niro-360-kamera', 'ceed-360-kamera'],
  parking_front: ['feat-parksensoren-vorn-hinten', 'ev3-parksensoren-vorn', 'ev4-parksensoren-vorn'],
  parking_rear: ['feat-parksensoren-hinten', 'ev3-parksensoren-hinten', 'ev4-parksensoren-hinten', 'picanto-parksensoren-hinten'],
  rear_camera: ['feat-rueckfahrkamera', 'ev3-rueckfahrkamera', 'ev4-rueckfahrkamera', 'picanto-rueckfahrkamera', 'niro-rueckfahrkamera', 'ceed-rueckfahrkamera'],
  blind_spot: ['feat-totwinkelassistent', 'ev3-totwinkel', 'ev4-totwinkel', 'picanto-totwinkel'],
  heated_seats: ['feat-sitzheizung-vorn', 'ev3-sitzheizung', 'ev4-sitzheizung', 'picanto-sitzheizung', 'niro-sitzheizung', 'ceed-sitzheizung'],
  heated_rear_seats: ['feat-sitzheizung-hinten', 'ev3-sitzheizung-hinten', 'ev4-sitzheizung-hinten'],
  steering_heat: ['feat-lenkradheizung', 'ev3-lenkradheizung', 'ev4-lenkradheizung', 'picanto-lenkradheizung', 'niro-lenkradheizung', 'ceed-lenkradheizung'],
  head_up_display: ['feat-head-up-display', 'ev3-hud', 'ev4-hud'],
  harman_kardon: ['feat-harman-kardon', 'ev3-harman', 'ev4-harman'],
  towbar: ['acc-anhaenger', 'ev3-anhaenger', 'ev4-anhaenger', 'picanto-anhaenger'],
  remote_parking: ['feat-remote-parken', 'ev3-remote-parken', 'ev4-remote-parken'],
  ventilated_seats: ['feat-sitzventilation-vorn', 'ev3-sitzbelueftung', 'ev4-sitzbelueftung'],
  panorama_roof: ['feat-panoramadach', 'ev3-panorama', 'ev4-panorama'],
  power_tailgate: ['feat-elektrische-heckklappe', 'ev3-heckklappe', 'ev4-heckklappe'],
  heat_pump: ['ev3-waermepumpe', 'ev4-waermepumpe', 'niro-waermepumpe', 'picanto-waermepumpe'],
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
