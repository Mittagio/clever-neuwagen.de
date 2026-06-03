/**
 * Fehlertolerante Normalisierung + Fuzzy-Auflösung vor Intent-Parsing
 */

import { TYPO_REPLACEMENTS, FUZZY_SEARCH_TERMS } from '../../data/search/searchTermDictionary.js';
import { normalizeQuery, normalizeUmlauts, applyFuelSynonymReplacements } from './queryNormalizer.js';
import { fuzzyMatchToken } from './fuzzyMatcher.js';
import { logUnknownSearchTerm } from './unknownTermsLog.js';

const STOP_WORDS = new Set([
  'ich', 'suche', 'sucheh', 'ein', 'einen', 'eine', 'einem', 'mit', 'und', 'unnd',
  'der', 'die', 'das', 'den', 'dem', 'des', 'für', 'fur', 'in', 'im', 'am', 'zu',
  'von', 'auf', 'als', 'auch', 'noch', 'mal', 'bitte', 'möchte', 'moechte', 'will',
  'auto', 'fahrzeug', 'wagen', 'neuwagen', 'benötige', 'benoetige', 'haette', 'hätte',
]);

/** Nur führende Doppelbuchstaben (z. B. kklein) – nicht „tonnen“ → „tonen“ */
function collapseLeadingDoubleLetters(word) {
  if (word.length < 4) return word;
  return word.replace(/^(.)\1+/, '$1');
}

function applyTypoMap(text) {
  let t = ` ${text} `;
  const sorted = [...TYPO_REPLACEMENTS].sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of sorted) {
    const re = new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    t = t.replace(re, ` ${to} `);
  }
  return t.replace(/\s+/g, ' ').trim();
}

function tokenize(text) {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

/**
 * Fuzzy-Match pro Token; ersetzt bei hoher Ähnlichkeit
 */
export function applyFuzzyTermResolution(text, { logLearning = true } = {}) {
  const tokens = tokenize(text);
  const suggestions = [];
  const resolvedFeatures = new Set();
  let bodyType = null;
  const replaced = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const raw = tokens[i];
    if (STOP_WORDS.has(raw) || /^\d+$/.test(raw)) continue;

    const collapsed = collapseLeadingDoubleLetters(raw);
    const candidates = FUZZY_SEARCH_TERMS;
    const match = fuzzyMatchToken(collapsed, candidates, { highThreshold: 0.8, mediumThreshold: 0.62 })
      ?? fuzzyMatchToken(raw, candidates, { highThreshold: 0.8, mediumThreshold: 0.62 });

    if (!match) {
      if (collapsed.length >= 5 && logLearning) {
        logUnknownSearchTerm({ raw, confidence: 'low' });
      }
      continue;
    }

    if (match.confidence === 'medium') {
      suggestions.push({
        raw,
        label: match.label ?? match.replace,
        id: match.id,
        prompt: `Meinten Sie ${match.label ?? match.replace}?`,
      });
      if (logLearning) {
        logUnknownSearchTerm({
          raw,
          suggestedId: match.id,
          suggestedLabel: match.label,
          confidence: 'medium',
        });
      }
    }

    tokens[i] = match.replace.split(/\s+/)[0] ?? match.replace;
    replaced.push({ from: raw, to: match.replace, id: match.id });

    if (match.id.startsWith('body_')) {
      bodyType = match.replace;
    } else if (match.id !== 'automatic') {
      resolvedFeatures.add(match.id);
    }
  }

  return {
    text: tokens.join(' '),
    suggestions,
    resolvedFeatures: [...resolvedFeatures],
    bodyType,
    replaced,
  };
}

/**
 * Vollständige fehlertolerante Vorverarbeitung
 */
export function typoTolerantSearchText(rawInput, options = {}) {
  const raw = String(rawInput ?? '').trim();
  if (!raw) {
    return { text: '', corrections: [], suggestions: [], resolvedFeatures: [], bodyType: null };
  }

  let text = normalizeQuery(raw);
  text = applyTypoMap(text);
  text = tokenize(text).map(collapseLeadingDoubleLetters).join(' ');
  text = applyTypoMap(text);
  text = applyFuelSynonymReplacements(text);

  const fuzzy = applyFuzzyTermResolution(text, options);
  text = fuzzy.text;
  text = applyFuelSynonymReplacements(text);

  return {
    text,
    normalizedRaw: text,
    corrections: fuzzy.replaced,
    suggestions: fuzzy.suggestions,
    resolvedFeatures: fuzzy.resolvedFeatures,
    bodyType: fuzzy.bodyType,
  };
}

export { normalizeUmlauts };
