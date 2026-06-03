/**
 * ManufacturerMediaSystem – zentrale Hersteller-Bild-Registry
 * Kia: echte Fotos aus offiziellen Preislisten-PDFs (public/images/manufacturers/kia/)
 */
import { getKiaModelMediaEntry, resolveKiaModelImageKey } from '../kia/kiaModelImages.js';

const DEMO = '/images/demo';

function demo(brand, model) {
  const url = `${DEMO}/${brand}/${model}.jpg`;
  return { default: url, hero: url, card: url, side: url };
}

function buildKiaMedia() {
  /** @type {Record<string, {default:string,hero:string,card:string,side:string}>} */
  const out = {};
  const keys = [
    'picanto', 'stonic', 'xceed', 'k4', 'k4-sportswagon', 'seltos', 'sportage',
    'sorento', 'ev2', 'ev3', 'ev4', 'ev5', 'ev5-gt', 'ev6', 'ev9', 'pv5-passenger',
  ];
  for (const key of keys) {
    const entry = getKiaModelMediaEntry(key);
    if (entry) out[key] = entry;
  }
  out['sportage-phev'] = out.sportage;
  out['sorento-hybrid'] = out.sorento;
  out['sorento-phev'] = out.sorento;
  out.niro = out.sportage ?? demo('kia', 'niro');
  out['niro-ev'] = out.niro;
  out.ceed = out.xceed ?? demo('kia', 'ceed');
  out['ceed-sw'] = out['k4-sportswagon'] ?? out.xceed ?? demo('kia', 'ceed');
  return out;
}

export const MANUFACTURER_MEDIA = {
  kia: buildKiaMedia(),
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
export const KIA_MEDIA_MODELS = [
  'ev3', 'ev4', 'ev5', 'ev5-gt', 'ev6', 'ev9', 'ev2', 'sportage', 'sportage-phev',
  'niro', 'sorento', 'sorento-hybrid', 'sorento-phev', 'ceed', 'picanto', 'stonic',
  'seltos', 'k4', 'k4-sportswagon', 'xceed', 'pv5-passenger',
];

export { resolveKiaModelImageKey };

export const MANUFACTURER_DEFAULT_ASSET = 'default.jpg';

export default MANUFACTURER_MEDIA;
