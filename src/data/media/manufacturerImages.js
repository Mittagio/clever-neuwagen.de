/**
 * ManufacturerMediaSystem – zentrale Hersteller-Bild-Registry
 *
 * Assets liegen unter: public/images/manufacturers/{brand}/{model}/
 * Produktiv: default.jpg (eine Datei pro Modell → überall sichtbar)
 * Demo: default.svg als Platzhalter bis JPGs hinterlegt sind
 */

const KIA = '/images/manufacturers/kia';

export const MANUFACTURER_MEDIA = {
  kia: {
    sportage: {
      default: `${KIA}/sportage/default.svg`,
      hero: `${KIA}/sportage/hero.jpg`,
      card: `${KIA}/sportage/hero.jpg`,
      side: `${KIA}/sportage/side.svg`,
    },
    ev3: {
      default: `${KIA}/ev3/default.svg`,
      hero: `${KIA}/ev3/hero.jpg`,
      card: `${KIA}/ev3/hero.jpg`,
    },
    ev4: {
      default: `${KIA}/ev4/default.svg`,
      hero: `${KIA}/ev4/hero.jpg`,
      card: `${KIA}/ev4/hero.jpg`,
    },
    niro: {
      default: `${KIA}/niro/default.svg`,
      hero: `${KIA}/niro/default.svg`,
      card: `${KIA}/niro/default.svg`,
    },
    sorento: {
      default: `${KIA}/sorento/default.svg`,
      hero: `${KIA}/sorento/default.svg`,
      card: `${KIA}/sorento/default.svg`,
    },
    ceed: {
      default: `${KIA}/ceed/default.svg`,
      hero: `${KIA}/ceed/default.svg`,
      card: `${KIA}/ceed/default.svg`,
    },
  },
};

/** Unterstützte Kia-Modelle (ManufacturerMediaSystem) */
export const KIA_MEDIA_MODELS = ['ev3', 'ev4', 'sportage', 'niro', 'sorento', 'ceed'];

/** Ziel-Dateiname für Produktiv-Assets */
export const MANUFACTURER_DEFAULT_ASSET = 'default.jpg';

export default MANUFACTURER_MEDIA;
