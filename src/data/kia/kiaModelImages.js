/**
 * Kia Modellbilder – aus offiziellen Preislisten-PDFs extrahiert
 * Generiert via: npm run extract:kia-images (Titelseite der Kia-Preisliste, Sorento-Stil)
 */
import raw from './kiaModelImages.json' with { type: 'json' };
import { canonicalizeKiaColorSlug } from './kiaColorSlugAliases.js';

export const KIA_MODEL_IMAGES = raw;

/** @param {string} color */
export function slugKiaColorId(color) {
  return String(color ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/** @param {string} modelKey @param {string} [colorId] */
export function resolveKiaColorImageUrl(modelKey, colorId) {
  if (!colorId) return null;
  const resolved = resolveKiaModelImageKey(modelKey);
  const colors = KIA_MODEL_IMAGES[resolved]?.colors;
  if (!colors) return null;
  const slug = slugKiaColorId(colorId);
  if (colors[slug]) return colors[slug];
  const canonical = canonicalizeKiaColorSlug(slug);
  if (canonical && colors[canonical]) return colors[canonical];
  return colors[colorId] ?? null;
}

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
  if (key.includes('xceed')) return 'xceed';
  if (key === 'ceed') return 'ceed';
  if (key.includes('niro')) return 'niro';
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
  const colors = meta.colors ?? null;
  if (view === 'hero' || view === 'card') {
    return { default: fallback, hero, card: hero, side: fallback, colors };
  }
  return { default: fallback, hero, card: hero, side: fallback, colors };
}

export function listKiaModelImageKeys() {
  return Object.keys(KIA_MODEL_IMAGES);
}
