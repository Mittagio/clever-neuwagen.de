/**
 * ManufacturerMediaSystem – zentrale Hersteller-Bild-Registry
 * Kia: echte Fotos aus offiziellen Preislisten-PDFs (public/images/manufacturers/kia/)
 */
import {
  KIA_MODEL_IMAGES,
  getKiaModelMediaEntry,
  resolveKiaModelImageKey,
} from '../kia/kiaModelImages.js';

const DEMO = '/images/demo';

function demo(brand, model) {
  const url = `${DEMO}/${brand}/${model}.jpg`;
  return { default: url, hero: url, card: url, side: url };
}

function buildKiaMedia() {
  /** @type {Record<string, {default:string,hero:string,card:string,side:string}>} */
  const out = {};
  for (const key of Object.keys(KIA_MODEL_IMAGES)) {
    const entry = getKiaModelMediaEntry(key);
    if (entry) out[key] = entry;
  }
  if (!out['sportage-phev'] && out.sportage) out['sportage-phev'] = out.sportage;
  if (!out['sorento-hybrid'] && out.sorento) out['sorento-hybrid'] = out.sorento;
  if (!out['sorento-phev'] && out.sorento) out['sorento-phev'] = out.sorento;
  if (!out.niro && out.sportage) out.niro = out.sportage;
  if (!out.ceed && out.xceed) out.ceed = out.xceed;
  out['niro-ev'] = out.niro;
  out['ceed-sw'] = out['k4-sportswagon'] ?? out.ceed ?? out.xceed;
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
  'seltos', 'k4', 'k4-sportswagon', 'xceed',
  'pv5-passenger', 'pv5-cargo-l2h1', 'pv5-chassis-cab', 'pv5-crew',
];

export { resolveKiaModelImageKey };

export const MANUFACTURER_DEFAULT_ASSET = 'default.jpg';

export default MANUFACTURER_MEDIA;
