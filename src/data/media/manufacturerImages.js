/**
 * ManufacturerMediaSystem – zentrale Hersteller-Bild-Registry
 *
 * Demo-Fotos: public/images/manufacturers/ → public/images/demo/{brand}/{model}.jpg
 * (freie Stock-Fotos / Picsum – optisch passend zum Fahrzeugtyp, nicht exakte Modellfotos)
 */

const DEMO = '/images/demo';

function demo(brand, model) {
  const url = `${DEMO}/${brand}/${model}.jpg`;
  return { default: url, hero: url, card: url, side: url };
}

export const MANUFACTURER_MEDIA = {
  kia: {
    sportage: demo('kia', 'sportage'),
    ev3: demo('kia', 'ev3'),
    ev4: demo('kia', 'ev3'),
    niro: demo('kia', 'niro'),
    'niro-ev': demo('kia', 'niro'),
    ceed: demo('kia', 'ceed'),
    'ceed-sw': demo('kia', 'ceed'),
    picanto: demo('kia', 'picanto'),
    sorento: demo('kia', 'sportage'),
  },
  ford: {
    kuga: demo('ford', 'kuga'),
  },
  hyundai: {
    tucson: demo('hyundai', 'tucson'),
    kona: demo('hyundai', 'kona'),
    'kona-elektro': demo('hyundai', 'kona'),
  },
  mg: {
    mg4: demo('mg', 'mg4'),
  },
  dacia: {
    spring: demo('dacia', 'spring'),
    duster: demo('dacia', 'duster'),
  },
  opel: {
    corsa: demo('opel', 'corsa'),
    'corsa-electric': demo('opel', 'corsa'),
  },
  renault: {
    megane: demo('renault', 'megane'),
    'megane-e-tech': demo('renault', 'megane'),
  },
  vw: {
    tiguan: demo('vw', 'tiguan'),
  },
  skoda: {
    karoq: demo('skoda', 'karoq'),
  },
};

/** Unterstützte Kia-Modelle (ManufacturerMediaSystem) */
export const KIA_MEDIA_MODELS = ['ev3', 'ev4', 'sportage', 'niro', 'sorento', 'ceed', 'picanto'];

export const MANUFACTURER_DEFAULT_ASSET = 'default.jpg';

export default MANUFACTURER_MEDIA;
