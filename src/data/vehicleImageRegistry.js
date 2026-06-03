/**
 * Fahrzeugbilder-Registry (Dealer + KI-Render)
 *
 * Herstellerbilder: src/data/media/manufacturerImages.js (ManufacturerMediaSystem)
 * Priorität in vehicleImageService:
 * 1 Händlerbild → 2 Herstellerbild → 3 Placeholder → 4 KI-Render
 */

export const IMAGE_SOURCES = {
  dealer: { id: 'dealer', label: 'Händlerbild', priority: 1 },
  manufacturer: { id: 'manufacturer', label: 'Herstellerbild', priority: 2 },
  placeholder: { id: 'placeholder', label: 'Placeholder', priority: 3 },
  aiRender: { id: 'ai-render', label: 'KI-Render', priority: 4 },
};

const DEMO = '/images/demo';

function dealerSet(brand, model) {
  const url = `${DEMO}/${brand}/${model}.jpg`;
  return { default: url, hero: url, card: url };
}

/**
 * Händler-eigene Fotos (Priorität 1) – Demo: echte Fotos aus /images/demo/
 */
export const DEALER_VEHICLE_IMAGES = {
  'autohaus-trinkle': {
    'kia|sportage': dealerSet('kia', 'sportage'),
    'kia|sportage|spirit': dealerSet('kia', 'sportage'),
    'kia|sportage|vision': dealerSet('kia', 'sportage'),
    'kia|ceed': dealerSet('kia', 'ceed'),
    'kia|ceed-sw': dealerSet('kia', 'ceed'),
    'kia|picanto': dealerSet('kia', 'picanto'),
  },
  'autohaus-mueller': {
    'kia|ev3': dealerSet('kia', 'ev3'),
  },
  'autohaus-esslingen': {
    'ford|kuga': dealerSet('ford', 'kuga'),
    'dacia|spring': dealerSet('dacia', 'spring'),
  },
  'mg-heilbronn': {
    'mg|mg4': dealerSet('mg', 'mg4'),
  },
  'autohaus-stuttgart': {
    'hyundai|tucson': dealerSet('hyundai', 'tucson'),
    'hyundai|kona': dealerSet('hyundai', 'kona'),
    'hyundai|kona-elektro': dealerSet('hyundai', 'kona'),
  },
  'vw-stuttgart': {
    'vw|tiguan': dealerSet('vw', 'tiguan'),
  },
  'skoda-goeppingen': {
    'skoda|karoq': dealerSet('skoda', 'karoq'),
  },
  'dacia-heilbronn': {
    'dacia|duster': dealerSet('dacia', 'duster'),
  },
};

/** KI-Render – später befüllt (Priorität 4) */
export const AI_RENDER_IMAGES = {};
