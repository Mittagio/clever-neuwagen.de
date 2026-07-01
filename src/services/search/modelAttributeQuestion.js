/**
 * Modell + Merkmal: „EV9 Reichweite“, „Sportage Kofferraum“ → Informationsfrage.
 */
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';

/** @typedef {'range'|'trunk'|'tow'|'vertical_load'|'seats'|'isofix'|'charging'|'length'|'height'|'price'|'battery'} ModelAttributeId */

/** @type {{ id: ModelAttributeId, patterns: RegExp[] }[]} */
const ATTRIBUTE_DETECTORS = [
  { id: 'battery', patterns: [/\bbatterie\b/i, /\bakku\b/i, /\bkwh\b/i] },
  { id: 'range', patterns: [/\breichweite\b/i, /\bwlpt\b/i, /\bwie\s+weit\b/i] },
  { id: 'trunk', patterns: [/\bkofferraum\b/i, /\bladeraum\b/i, /\bkofferraumvolumen\b/i] },
  { id: 'vertical_load', patterns: [/\bstützlast\b/i, /\bstuetzlast\b/i, /\bvertikale\s+last\b/i] },
  { id: 'tow', patterns: [/\banh[aä]ngelast\b/i, /\banhaengelast\b/i, /\bzuglast\b/i, /\bahk\b/i, /\banhängerkupplung\b/i, /\banhaengerkupplung\b/i, /\bfahrradträger\b/i, /\bwohnwagen\b/i, /\banhänger\b/i, /\banhaenger\b/i] },
  { id: 'seats', patterns: [/\bsitzpl[aä]tze?\b/i, /\bsitze\b/i, /\bsitzer\b/i, /\bplätze\b/i, /\b\d+[\s-]?sitzer\b/i, /\bdritte\s+reihe\b/i] },
  { id: 'isofix', patterns: [/\bisofix\b/i, /\biso\s*fix\b/i, /\bkindersitz\b/i, /\bkindersitze\b/i] },
  { id: 'charging', patterns: [/\bladegeschwindigkeit\b/i, /\bladeleistung\b/i, /\bschnelllad/i, /\bdc[\s-]?lad/i, /\b10[\s–-]+80\b/i, /\bwie\s+schnell\s+l[aä]dt\b/i] },
  { id: 'length', patterns: [/\bl[aä]nge\b/i, /\bwie\s+lang\b/i] },
  { id: 'height', patterns: [/\bh[oö]he\b/i, /\bwie\s+hoch\b/i] },
  { id: 'size', patterns: [/\bwie\s+gro[ßs]\b/i, /\bgro[ßs]e?\s+(?:ist|sind)\b/i] },
  { id: 'price', patterns: [/\bpreis\b/i, /\bwas\s+kostet\b/i, /\bkosten\b/i] },
];

const MODEL_PATTERNS = Object.values(KIA_MODEL_ATTRIBUTES)
  .sort((a, b) => b.modelKey.length - a.modelKey.length)
  .map((attr) => {
    const keyParts = attr.modelKey.split('-');
    const keyRe = keyParts.length > 1
      ? new RegExp(`\\b${keyParts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[-\\s]?')}\\b`, 'i')
      : new RegExp(`\\b${attr.modelKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    const labelRe = new RegExp(
      `\\b${attr.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
      'i',
    );
    return { modelKey: attr.modelKey, label: attr.label, patterns: [keyRe, labelRe] };
  });

/**
 * @param {string} query
 * @returns {ModelAttributeId|null}
 */
export function detectModelAttribute(query) {
  const text = String(query ?? '');
  for (const { id, patterns } of ATTRIBUTE_DETECTORS) {
    if (patterns.some((re) => re.test(text))) return id;
  }
  return null;
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function detectModelKeyInQuery(query) {
  const text = String(query ?? '');
  for (const entry of MODEL_PATTERNS) {
    if (entry.patterns.some((re) => re.test(text))) {
      return entry.modelKey;
    }
  }
  return null;
}

/**
 * @param {string} query
 * @returns {{ modelKey: string, attribute: ModelAttributeId, query: string }|null}
 */
export function parseModelAttributeQuestion(query) {
  const text = String(query ?? '').trim();
  if (!text) return null;

  const attribute = detectModelAttribute(text);
  const modelKey = detectModelKeyInQuery(text);
  if (!attribute || !modelKey) return null;

  return { modelKey, attribute, query: text };
}
