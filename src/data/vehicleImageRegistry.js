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

/**
 * Händler-eigene Fotos (Priorität 1) – lokale Assets unter /public/images/dealers/
 * Key: dealerId → modelKey (brand|model|trim?) → variant
 */
export const DEALER_VEHICLE_IMAGES = {
  'autohaus-trinkle': {
    'kia|sportage|spirit': {
      default: '/images/dealers/autohaus-trinkle/sportage-spirit.svg',
      hero: '/images/dealers/autohaus-trinkle/sportage-spirit.svg',
      card: '/images/dealers/autohaus-trinkle/sportage-spirit.svg',
    },
  },
};

/** KI-Render – später befüllt (Priorität 4) */
export const AI_RENDER_IMAGES = {};
