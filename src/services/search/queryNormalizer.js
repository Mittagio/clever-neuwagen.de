/**
 * Query-Normalisierung vor Intent-Parsing
 */

const UMLAUT_MAP = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
  Ä: 'ae',
  Ö: 'oe',
  Ü: 'ue',
};

export function normalizeUmlauts(text) {
  return String(text).replace(/[äöüÄÖÜß]/g, (ch) => UMLAUT_MAP[ch] ?? ch);
}

export function normalizeQuery(rawInput = '') {
  let t = String(rawInput).trim();
  if (!t) return '';

  t = normalizeUmlauts(t);
  t = t.toLowerCase();
  t = t.replace(/[°]/g, ' grad ');
  t = t.replace(/(\d),(\d)/g, '$1.$2');
  t = t.replace(/(\d)\.(\d{3})\b/g, '$1$2');
  t = t.replace(/[^\w\säöüß€$/-]/gi, ' ');
  t = t.replace(/\s+/g, ' ').trim();

  return t;
}

/** Synonym-Ersetzungen für konsistentes Token-Matching */
export function applyFuelSynonymReplacements(text) {
  let t = text;
  const replacements = [
    [/e-auto/g, 'elektroauto'],
    [/e auto/g, 'elektroauto'],
    [/stromer/g, 'elektroauto'],
    [/bev\b/g, 'elektroauto'],
    [/plug-in hybrid/g, 'plugin-hybrid'],
    [/plugin hybrid/g, 'plugin-hybrid'],
    [/plugin-hybrid/g, 'plugin-hybrid'],
    [/plug-in/g, 'plugin-hybrid'],
  ];
  for (const [re, rep] of replacements) {
    t = t.replace(re, rep);
  }
  return t;
}

export function normalizedSearchText(rawInput) {
  const base = normalizeQuery(rawInput);
  return applyFuelSynonymReplacements(base);
}

/** @deprecated Direkt – nutze typoTolerantSearchText für fehlertolerante Suche */
export function normalizedSearchTextLegacy(rawInput) {
  return normalizedSearchText(rawInput);
}
