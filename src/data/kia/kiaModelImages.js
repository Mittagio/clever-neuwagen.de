/**
 * Kia Modellbilder – aus offiziellen Preislisten-PDFs extrahiert
 * Generiert via: npm run extract:kia-images
 */
import raw from './kiaModelImages.json' with { type: 'json' };

export const KIA_MODEL_IMAGES = raw;

/** @param {string} modelKey */
export function resolveKiaModelImageKey(modelKey = '') {
  const key = String(modelKey).toLowerCase();
  if (KIA_MODEL_IMAGES[key]) return key;
  if (key.includes('sportage')) return 'sportage';
  if (key.includes('sorento')) return 'sorento';
  if (key === 'ev5-gt' || key.includes('ev5gt')) return 'ev5-gt';
  if (key.startsWith('ev5')) return 'ev5';
  if (key.startsWith('ev4')) return 'ev4';
  if (key.startsWith('ev3')) return 'ev3';
  if (key.startsWith('ev2')) return 'ev2';
  if (key.startsWith('ev6')) return 'ev6';
  if (key.startsWith('ev9')) return 'ev9';
  if (key.includes('sportswagon')) return 'k4-sportswagon';
  if (key === 'k4' || key.includes('k4')) return 'k4';
  if (key.includes('picanto')) return 'picanto';
  if (key.includes('stonic')) return 'stonic';
  if (key.includes('seltos')) return 'seltos';
  if (key.includes('xceed') || key.includes('ceed')) return 'xceed';
  if (key.includes('pv5')) return 'pv5-passenger';
  return key;
}

/** @param {string} modelKey @param {'default'|'hero'|'card'|'side'} view */
export function getKiaModelMediaEntry(modelKey, view = 'default') {
  const resolved = resolveKiaModelImageKey(modelKey);
  const meta = KIA_MODEL_IMAGES[resolved];
  if (!meta) return null;
  const hero = meta.hero;
  const fallback = meta.default ?? hero;
  if (view === 'hero' || view === 'card') return { default: fallback, hero, card: hero, side: fallback };
  return { default: fallback, hero, card: hero, side: fallback };
}

export function listKiaModelImageKeys() {
  return Object.keys(KIA_MODEL_IMAGES);
}
