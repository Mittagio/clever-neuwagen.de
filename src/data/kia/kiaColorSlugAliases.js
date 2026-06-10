/**
 * Kia-Farb-Slugs bereinigen – Trunkierungen & Paint-Codes aus KMC-Import.
 */

/** @param {string} color */
function slugKiaColorId(color) {
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

/** @type {Record<string, string>} */
export const KIA_COLOR_SLUG_ALIASES = {
  // Trunkierungen (fehlerhafter Prefix-Strip)
  ckpearl: 'blackpearl',
  lackpearl: 'blackpearl',
  mared: 'magmared',
  ninghaze: 'morninghaze',
  stblue: 'frostblue',
  tametal: 'pentametal',
  uxewhite: 'deluxewhite',
  sawhite: 'cassawhite',
  asawhite: 'cassawhite',
  asawhiteblack: 'cassawhiteblack',
  rysilvermatte: 'ivorysilvermatte',
  illablossom: 'vanillablossom',
  fgray: 'wolfgray',
  wolfgrey: 'wolfgray',
  fgrey: 'wolfgrey',
  orablackpearl: 'aurorablackpearl',
  wwhitepearl: 'snowwhitepearl',
  arwhite: 'clearwhite',
  nturinegreen: 'aventurinegreen',
  racotta: 'terracotta',
  legrey: 'shalegrey',
  rysilver: 'ivorysilver',
  eflame: 'blueflame',
  wayred: 'runwayred',
  flarered: 'lavaflarered',
  abpaurorablackpearl: 'aurorablackpearl',
  swpsnowwhitepearl: 'snowwhitepearl',
  isgivorysilver: 'ivorysilver',
  dfgpebblegray: 'pebblegray',
  c7rflarered: 'lavaflarered',
  ha6blueflameblack: 'blueflameblack',
  ha8blueflameblack: 'blueflameblack',
  b3lblueflame: 'blueflame',
  b3lblueflameblack: 'blueflameblack',
  exgexperiencegreen: 'experiencegreen',
  exgexperiencegreenblack: 'experiencegreenblack',
  csslunarsilver: 'lunarsilver',
  csslunarsilverblack: 'lunarsilverblack',
  h8gpentametal: 'pentametal',
  h8gpentametalblack: 'pentametalblack',
  hw2deluxewhite: 'deluxewhite',
  hw2deluxewhiteblack: 'deluxewhiteblack',
  wafwolfgray: 'wolfgray',
  wafwolfgrayblack: 'wolfgrayblack',
  wdcasawhite: 'cassawhite',
  wdcasawhiteblack: 'cassawhiteblack',
  ardmagmared: 'magmared',
  ardmagmaredblack: 'magmaredblack',
  '1kblackpearl': 'blackpearl',
};

const JUNK_SLUG_RE = /mobile|my25|my26|v01$|^ss$|^gloss$|^mobile$/i;

/**
 * Kia-Paint-Code am Slug-Anfang – nur wenn der Code eine Ziffer enthält
 * (z. B. hw2deluxewhite → deluxewhite, nicht blackpearl → ckpearl).
 * @param {string} slug
 */
export function stripKiaPaintCodePrefix(slug) {
  const m = String(slug ?? '').toLowerCase().match(/^([a-z0-9]{2,3})([a-z].{3,})$/i);
  if (!m) return slug;
  const [, code, rest] = m;
  if (!/\d/.test(code)) return slug;
  return rest;
}

/**
 * @param {string} slug
 * @returns {string|null} kanonischer Slug oder null wenn Müll
 */
export function canonicalizeKiaColorSlug(slug) {
  let s = slugKiaColorId(slug);
  if (!s || JUNK_SLUG_RE.test(s)) return null;

  for (let i = 0; i < 6; i += 1) {
    if (KIA_COLOR_SLUG_ALIASES[s]) {
      s = KIA_COLOR_SLUG_ALIASES[s];
      continue;
    }
    const stripped = stripKiaPaintCodePrefix(s);
    if (stripped !== s) {
      s = stripped;
      continue;
    }
    break;
  }

  if (KIA_COLOR_SLUG_ALIASES[s]) s = KIA_COLOR_SLUG_ALIASES[s];
  if (!s || JUNK_SLUG_RE.test(s)) return null;
  return s;
}
