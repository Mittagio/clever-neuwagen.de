/**
 * Verkäufer-Abkürzungen für Ausstattung → kanonische Feature-Keys.
 * OpenAI liefert nur Hinweise; Clever prüft gegen TRIM_FEATURE_MAP.
 */
import { TRIM_FEATURE_MAP } from '../../data/features/trimFeatureMapping.js';

const EQUIPMENT_ALIASES = [
  {
    key: 'heat_pump',
    label: 'Wärmepumpe',
    patterns: [
      /\bw(?:ä|ae)?rmepumpe\b/i,
      /\bwarmepumpe\b/i,
      /\bheat\s*pump\b/i,
      /(^|[^a-z])wp([^a-z]|$)/i,
    ],
  },
  {
    key: 'towbar',
    label: 'Anhängerkupplung',
    patterns: [/\bahk\b/i, /\banhänger(?:kupplung)?\b/i, /\btow\s*bar\b/i],
  },
  {
    key: 'panorama_roof',
    label: 'Panoramadach',
    patterns: [/\bpanorama(?:dach)?\b/i, /\bschiebedach\b/i],
  },
];

/**
 * @param {string} rawText
 * @param {{ modelKey?: string|null, trimId?: string|null }} vehicle
 */
export function resolveSellerEquipmentMentions(rawText = '', vehicle = {}) {
  const text = String(rawText || '');
  if (!text.trim()) return [];

  const modelKey = String(vehicle.modelKey || '')
    .toLowerCase()
    .replace(/\s+/g, '');
  const trimId = String(vehicle.trimId || vehicle.trim || '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/gt.?line/, 'gt-line');

  const mapping = TRIM_FEATURE_MAP[modelKey] || null;
  const trim = mapping?.trims?.find((t) => t.id === trimId) || null;

  const found = [];
  for (const alias of EQUIPMENT_ALIASES) {
    const matched = alias.patterns.some((re) => re.test(text));
    if (!matched) continue;

    let availability = 'unknown';
    let confidence = 0.55;
    let ambiguity = null;

    if (trim) {
      if ((trim.standardFeatures || []).includes(alias.key)) {
        availability = 'standard';
        confidence = 0.95;
      } else if ((trim.availableViaPackage || []).includes(alias.key)) {
        availability = 'package';
        confidence = 0.9;
      } else if ((trim.notAvailable || []).includes(alias.key)) {
        availability = 'unavailable';
        confidence = 0.9;
        ambiguity = `${alias.label} ist für ${mapping.modelLabel || modelKey} ${trim.name || trimId} nicht verfügbar.`;
      } else {
        availability = 'unknown';
        confidence = 0.5;
        ambiguity = `Mit „${alias.key === 'heat_pump' ? 'WP' : alias.label}“ meinst du ${alias.label}, richtig?`;
      }
    } else if (alias.key === 'heat_pump' && /(^|[^a-z])wp([^a-z]|$)/i.test(text)) {
      // Fahrzeugkontext: WP → Wärmepumpe-Kandidat, aber ohne Trim nicht final
      ambiguity = 'Mit WP meinst du die Wärmepumpe, richtig?';
      confidence = 0.7;
    }

    found.push({
      key: alias.key,
      label: alias.label,
      rawExpression: alias.key === 'heat_pump' && /(^|[^a-z])wp([^a-z]|$)/i.test(text)
        ? 'WP'
        : alias.label,
      availability,
      confidence,
      ambiguity,
      source: 'verified_registry',
    });
  }

  return found;
}

/**
 * Farbe aus Messy-Text (weiss/weiß/white).
 */
export function resolveSellerColorMention(rawText = '') {
  const blob = String(rawText || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!blob.trim()) return null;

  if (/snow\s*white|schneeweiss/.test(blob)) {
    return {
      rawValue: 'weiß',
      canonicalValue: 'snowwhitepearl',
      label: 'Snow White Pearl',
      confidence: 0.9,
      source: 'color_alias',
    };
  }
  if (/clear\s*white|klarweiss/.test(blob)) {
    return {
      rawValue: 'weiß',
      canonicalValue: 'clearwhite',
      label: 'Clear White',
      confidence: 0.9,
      source: 'color_alias',
    };
  }
  if (/(?:^|[^a-z])(weiss|weiß|white)(?:[^a-z]|$)/i.test(blob)) {
    return {
      rawValue: 'weiß',
      canonicalValue: 'white',
      label: 'Weiß',
      confidence: 0.85,
      source: 'color_alias',
      ambiguity: null,
    };
  }
  return null;
}
