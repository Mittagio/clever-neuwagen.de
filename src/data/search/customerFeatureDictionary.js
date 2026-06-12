/**
 * Feature-Wörterbuch: Kundenbegriff → interne Feature-ID.
 * OpenAI und lokaler Parser mappen nur hierhin – keine Fahrzeugauswahl.
 *
 * Canonical API-IDs (heated_front_seats, electric_tailgate) werden
 * über canonicalFeatureIds.js auf interne IDs normalisiert.
 */

/** @type {Record<string, string[]>} */
export const CUSTOMER_FEATURE_DICTIONARY = {
  camera_360: [
    '360 kamera',
    '360° kamera',
    '360-grad-kamera',
    '360 grad kamera',
    '360-grad-kamera',
    '360 grad',
    '360°',
    'rundumsicht',
    'rundumsichtkamera',
    'rundum kamera',
    'kameras rundum',
    'surround view',
    'around view',
    'bird view',
    'kamera rundum',
  ],
  heat_pump: [
    'wärmepumpe',
    'waermepumpe',
    'winterpaket',
    'vorkonditionierung',
    'wp',
  ],
  heated_front_seats: [
    'sitzheizung',
    'sitzheizung vorne',
    'sitzheizungen',
    'beheizbare sitze',
    'beheizte sitze',
    'warme sitze',
    'sitzklima',
    'heated front seats',
  ],
  electric_tailgate: [
    'elektrische heckklappe',
    'elektr. heckklappe',
    'automatische heckklappe',
    'power tailgate',
    'elektrische kofferraumklappe',
  ],
  rear_camera: [
    'rückfahrkamera',
    'rückkamera',
    'heckkamera',
    'kamera hinten',
  ],
  blind_spot: [
    'totwinkelassistent',
    'totwinkel',
    'blind spot',
    'spurwechselassistent',
  ],
  towbar: [
    'anhängerkupplung',
    'anhaengerkupplung',
    'ahk',
    'anhängelast',
  ],
  panorama_roof: [
    'panoramadach',
    'panorama dach',
    'schiebedach',
  ],
  head_up_display: [
    'head-up display',
    'head up display',
    'hud',
  ],
  steering_heat: [
    'lenkradheizung',
    'beheiztes lenkrad',
  ],
  parking_front: [
    'parksensoren vorne',
    'pdc vorne',
    'einparkhilfe vorne',
  ],
  parking_rear: [
    'parksensoren hinten',
    'pdc hinten',
  ],
  large_trunk: [
    'grosser kofferraum',
    'großer kofferraum',
    'grosser stauraum',
    'viel platz',
    'viel gepaeck',
    'viel gepäck',
    'grosses gepaeck',
  ],
  isofix: [
    'isofix',
    'i-size',
    'i size',
    'kindersitz isofix',
    'isofix kindersitz',
    'isofix hinten',
  ],
};

/** Für Intent-Parser: längere Phrasen zuerst */
export function buildFeatureSynonymGroupsFromDictionary() {
  return Object.entries(CUSTOMER_FEATURE_DICTIONARY).map(([id, patterns]) => ({
    id,
    patterns: [...patterns].sort((a, b) => b.length - a.length),
    contextWords: id === 'camera_360'
      ? ['grad', 'kamera', 'cam', 'rundum', 'view', 'sensor', 'park', 'surround', 'bird']
      : [],
  }));
}
