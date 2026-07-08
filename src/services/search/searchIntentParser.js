/**
 * Intent-basiertes Parsing – keine naive Volltextsuche auf Modellnamen
 */

import { parseLocationFromText } from '../../logic/advisorLocation.js';
import {
  FEATURE_SYNONYM_GROUPS,
  PROTECTED_NUMBER_CONTEXTS,
  FUEL_SYNONYMS,
  PAYMENT_SYNONYMS,
  AVAILABILITY_SYNONYMS,
  MODEL_CATALOG,
  BRAND_PATTERNS,
  TRIM_PATTERNS,
} from '../../data/search/featureSynonyms.js';
import { normalizeQuery } from './queryNormalizer.js';
import { typoTolerantSearchText } from './typoTolerantNormalize.js';
import { POWER_PS_TOLERANCE } from '../../data/search/searchTermDictionary.js';
import { isModelExplicitlyRequested } from './modelIntent.js';

const EMPTY_INTENT = () => ({
  rawQuery: '',
  normalizedQuery: '',
  payment: null,
  paymentExplicit: false,
  maxRate: null,
  maxPrice: null,
  fuel: null,
  brand: null,
  model: null,
  modelExplicit: false,
  trim: null,
  bodyType: null,
  transmission: null,
  availability: null,
  location: null,
  radiusKm: null,
  mileagePerYear: null,
  durationMonths: null,
  features: [],
  towCapacityKg: null,
  fuelAlternatives: null,
  existingLead: false,
  familyHint: null,
  dogBoxHint: null,
  chargingHomeHint: null,
  financeZeroPercent: false,
  rangeKmMin: null,
  rangeRanking: null,
  maxLengthMm: null,
  maxHeightMm: null,
  trunkLMin: null,
  trunkDepthCmMin: null,
  isofixRearMin: null,
  seatsMin: null,
  powerPsTarget: null,
  powerPsMin: null,
  powerPsMax: null,
  confidence: 0,
  warnings: [],
  possibleCorrections: [],
  ambiguousTerms: [],
  fuzzySuggestions: [],
  corrections: [],
  consumedSpans: [],
});

function markSpan(spans, start, end) {
  spans.push({ start, end });
}

function isSpanConsumed(spans, index) {
  return spans.some((s) => index >= s.start && index < s.end);
}

function findPhrase(text, phrase) {
  const p = phrase.toLowerCase().trim();
  const idx = text.indexOf(p);
  if (idx === -1) return null;
  return { start: idx, end: idx + p.length };
}

function extractFeatures(text, spans) {
  const features = new Set();
  const sorted = [...FEATURE_SYNONYM_GROUPS].sort(
    (a, b) => Math.max(...b.patterns.map((p) => p.length)) - Math.max(...a.patterns.map((p) => p.length)),
  );

  for (const group of sorted) {
    for (const pattern of group.patterns) {
      const span = findPhrase(text, pattern);
      if (span && !isSpanConsumed(spans, span.start)) {
        features.add(group.id);
        markSpan(spans, span.start, span.end);

        if (group.id === 'camera_360' && /\b360\b/.test(text.slice(span.start, span.end + 5))) {
          const m360 = text.match(/\b360\b/);
          if (m360) markSpan(spans, m360.index, m360.index + 3);
        }
        break;
      }
    }
  }

  return [...features];
}

function is360CameraContext(text, matchIndex) {
  const window = text.slice(Math.max(0, matchIndex - 25), matchIndex + 35);
  return /\b(grad|kamera|cam|rundum|view|sensor|surround|bird|park|°)\b/i.test(window);
}

function protectAmbiguousNumbers(text, spans, features, ambiguous) {
  const m360 = [...text.matchAll(/\b360\b/g)];
  for (const match of m360) {
    const idx = match.index;
    if (isSpanConsumed(spans, idx)) continue;
    if (is360CameraContext(text, idx)) {
      if (!features.includes('camera_360')) features.push('camera_360');
      markSpan(spans, idx, idx + 3);
      ambiguous.push({ term: '360', suggestion: 'camera_360', label: '360° Kamera' });
    } else if (/\bferrari\b/.test(text)) {
      ambiguous.push({ term: '360', suggestion: 'model_ferrari_360', label: 'Ferrari 360' });
    } else {
      ambiguous.push({ term: '360', suggestion: 'camera_360', label: '360° Kamera' });
    }
  }
}

function normalizeFuelKey(fuel) {
  if (fuel === 'plugin_hybrid') return 'plugin-hybrid';
  if (fuel === 'verbrenner') return 'verbrenner';
  return fuel;
}

function refineFuelAlternatives(keys = []) {
  const unique = [...new Set(keys)];
  if (unique.includes('plugin-hybrid') && unique.includes('hybrid')) {
    return unique.filter((key) => key !== 'hybrid');
  }
  return unique;
}

function extractMentionedFuels(text) {
  const hits = [];
  for (const [fuel, phrases] of Object.entries(FUEL_SYNONYMS)) {
    for (const phrase of [...phrases].sort((a, b) => b.length - a.length)) {
      const span = findPhrase(text, phrase);
      if (!span) continue;
      hits.push({ key: normalizeFuelKey(fuel), span });
      break;
    }
  }
  hits.sort((a, b) => a.span.start - b.span.start);
  const mentioned = [];
  for (const hit of hits) {
    if (!mentioned.some((entry) => entry.key === hit.key)) mentioned.push(hit);
  }
  return mentioned;
}

function extractFuelPreference(text, spans) {
  const mentioned = extractMentionedFuels(text);
  if (!mentioned.length) return { fuel: null, fuelAlternatives: null };

  const keys = mentioned.map((entry) => entry.key);
  const hasChoice = /\b(oder|\/|beides?\s+egal|egal\s+ob|sowohl)\b/i.test(text);
  const hybridAndElectric = keys.includes('hybrid') && keys.includes('elektro');

  if ((keys.length >= 2 && hasChoice) || hybridAndElectric) {
    for (const entry of mentioned) markSpan(spans, entry.span.start, entry.span.end);
    return {
      fuel: null,
      fuelAlternatives: refineFuelAlternatives(keys),
    };
  }

  const primary = mentioned[0];
  markSpan(spans, primary.span.start, primary.span.end);
  return { fuel: primary.key, fuelAlternatives: null };
}

function extractFinanceZeroPercent(text, spans) {
  const m = text.match(
    /\b0\s*(?:%|prozent)\s*(?:finanzierung|finanzierungszins(?:en)?|zins(?:en)?|effektivzins)?\b/i,
  )
    ?? text.match(
      /\b(?:finanzierung|finanzierungszins(?:en)?|zins(?:en)?|effektivzins)\s*(?:mit\s+|zu\s+|ab\s+)?0\s*(?:%|prozent)\b/i,
    )
    ?? text.match(/\bfinanzierung\s+0\s*(?:%|prozent)\b/i)
    ?? text.match(/\b0\s+finanzierung\b/i)
    ?? text.match(/\b0\s*%\s*finanzierung\b/i)
    ?? text.match(/\bzinsfrei(?:e)?\s+finanzierung\b/i)
    ?? text.match(/\bfinanzierung\s+zinsfrei\b/i);
  if (!m || isSpanConsumed(spans, m.index)) return false;
  markSpan(spans, m.index, m.index + m[0].length);
  return true;
}

function extractPayment(text, spans) {
  for (const [payment, phrases] of Object.entries(PAYMENT_SYNONYMS)) {
    for (const phrase of phrases) {
      const span = findPhrase(text, phrase);
      if (span && !isSpanConsumed(spans, span.start)) {
        markSpan(spans, span.start, span.end);
        return payment === 'finance' ? 'finance' : payment;
      }
    }
  }
  return null;
}

function extractAvailability(text, spans) {
  for (const phrase of AVAILABILITY_SYNONYMS.sofort) {
    const span = findPhrase(text, phrase);
    if (span && !isSpanConsumed(spans, span.start)) {
      markSpan(spans, span.start, span.end);
      return 'sofort_verfuegbar';
    }
  }
  return null;
}

const EURO_AMOUNT = '(?:€|euro)';

function hasRateContext(text) {
  return /leasing|finanzier|monat|rate|mtl|\/\s*monat|pro monat|budget/i.test(text);
}

function hasPriceContext(text) {
  return /kauf|bar|preis|einmal|neupreis/i.test(text);
}

function hasMileageSufficiencyContext(text, nearIndex, matchLen = 3) {
  const window = text.slice(Math.max(0, nearIndex - 10), nearIndex + matchLen + 40);
  return /\b(reichen|reicht|ausreichen|ausreicht|genügen|genuegen|genügt|genuegt)\b/i.test(window);
}

function hasRangeContext(text, nearIndex, matchLen = 3) {
  const window = text.slice(Math.max(0, nearIndex - 20), nearIndex + matchLen + 30);
  if (hasMileageSufficiencyContext(text, nearIndex, matchLen)) return false;
  return /\b(km|kilometer|reichweite|range)\b/i.test(window);
}

function extractMoneyAndRange(text, spans) {
  let maxRate = null;
  let maxPrice = null;
  let rangeKmMin = null;

  const kmBisEuro = text.match(/(\d{2,4})\s*km\s+bis\s+(\d{2,4})\s*€/i);
  if (kmBisEuro) {
    rangeKmMin = Number(kmBisEuro[1]);
    maxRate = Number(kmBisEuro[2]);
    markSpan(spans, kmBisEuro.index, kmBisEuro.index + kmBisEuro[0].length);
  }

  const rangeRe = /(?:über|ueber|ab|mindestens|mehr als)\s*(\d{2,4})\s*km\b/gi;
  let rm;
  while ((rm = rangeRe.exec(text)) !== null) {
    rangeKmMin = Number(rm[1]);
    markSpan(spans, rm.index, rm.index + rm[0].length);
  }

  const kmRe = /(\d{2,4})\s*km\b/gi;
  while ((rm = kmRe.exec(text)) !== null) {
    if (isSpanConsumed(spans, rm.index)) continue;
    if (hasRangeContext(text, rm.index, rm[0].length)) {
      rangeKmMin = Number(rm[1]);
      markSpan(spans, rm.index, rm.index + rm[0].length);
    }
  }

  const maxRatePhrase = text.match(new RegExp(`\\bmaximal\\s+(\\d{2,4})\\s*${EURO_AMOUNT}\\s*(?:monats)?rate\\b`, 'i'))
    ?? text.match(new RegExp(`\\b(?:monats)?rate\\s+(?:bis\\s+|maximal\\s+|unter\\s+|von\\s+)?(\\d{2,4})\\s*${EURO_AMOUNT}\\b`, 'i'))
    ?? text.match(new RegExp(`\\bbudget\\s+(\\d{2,4})\\s*${EURO_AMOUNT}\\b`, 'i'))
    ?? text.match(new RegExp(`\\bunter\\s+(\\d{2,4})\\s*${EURO_AMOUNT}\\s*(?:pro\\s+)?(?:monat|mtl)\\b`, 'i'));
  if (maxRatePhrase && !isSpanConsumed(spans, maxRatePhrase.index)) {
    maxRate = Number(maxRatePhrase[1]);
    markSpan(spans, maxRatePhrase.index, maxRatePhrase.index + maxRatePhrase[0].length);
  }

  const bisEuroRe = new RegExp(`\\bbis\\s+(\\d{2,4})\\s*${EURO_AMOUNT}`, 'gi');
  while ((rm = bisEuroRe.exec(text)) !== null) {
    if (isSpanConsumed(spans, rm.index)) continue;
    maxRate = Number(rm[1]);
    markSpan(spans, rm.index, rm.index + rm[0].length);
  }

  const euroRe = new RegExp(`(?:bis|unter|max\\.?|maximal)?\\s*(\\d{1,3}(?:\\.\\d{3})*|\\d{2,6})\\s*${EURO_AMOUNT}`, 'gi');
  while ((rm = euroRe.exec(text)) !== null) {
    if (isSpanConsumed(spans, rm.index)) continue;
    const raw = rm[1].replace(/\./g, '');
    const val = Number(raw);
    const ctx = text.slice(Math.max(0, rm.index - 30), rm.index + rm[0].length + 10);

    if (hasRangeContext(ctx, 10)) continue;

    if (val >= 5000 || (hasPriceContext(ctx) && !hasRateContext(ctx))) {
      maxPrice = val;
      markSpan(spans, rm.index, rm.index + rm[0].length);
    } else if (hasRateContext(ctx) || val <= 999) {
      maxRate = val;
      markSpan(spans, rm.index, rm.index + rm[0].length);
    } else if (!maxRate && !maxPrice) {
      maxRate = val;
      markSpan(spans, rm.index, rm.index + rm[0].length);
    }
  }

  const bisRe = /\bbis\s+(\d{2,4})\b/gi;
  while ((rm = bisRe.exec(text)) !== null) {
    if (isSpanConsumed(spans, rm.index)) continue;
    const val = Number(rm[1]);
    if (hasRangeContext(text, rm.index + rm[0].length)) {
      rangeKmMin = val;
    } else if (hasRateContext(text) || val <= 800) {
      maxRate = val;
    } else if (hasPriceContext(text)) {
      maxPrice = val;
    } else {
      maxRate = val;
    }
    markSpan(spans, rm.index, rm.index + rm[0].length);
  }

  return { maxRate, maxPrice, rangeKmMin };
}

/** Superlativ: „meiste/höchste Reichweite“ – Ranking, kein km-Schwellwert. */
function extractRangeRanking(text, spans) {
  const patterns = [
    /\b(meiste[nr]?|maximal[e]?|höchste[nr]?|hoechste[nr]?|größte[nr]?|groesste[nr]?|längste[nr]?|laengste[nr]?|beste[nr]?)\s+(?:wltp[-\s]*)?reichweite\b/i,
    /\b(?:reichweite|wltp)\s+(?:am\s+)?(?:meisten|höchsten|hoechsten|größten|groessten|längsten|laengsten)\b/i,
    /\bmit\s+(?:der\s+)?(?:meisten|höchsten|hoechsten|maximalen|längsten|laengsten)\s+reichweite\b/i,
    /\bmeister\s+reichweite\b/i,
    /\bwelche[rs]?\s+(?:e-?auto|elektroauto|auto|fahrzeug).{0,50}(?:meiste|höchste|maximale|längste)\s+reichweite\b/i,
    /\b(?:e-?auto|elektroauto|fahrzeug).{0,30}(?:meiste|höchste|maximale|längste)\s+reichweite\b/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      markSpan(spans, m.index, m.index + m[0].length);
      return 'max';
    }
  }
  return null;
}

function extractTowCapacity(text, spans) {
  const ton = text.match(/(\d+(?:[.,]\d+)?)\s*tonnen?\b/i);
  if (ton && !isSpanConsumed(spans, ton.index)) {
    const t = Number(ton[1].replace(',', '.'));
    markSpan(spans, ton.index, ton.index + ton[0].length);
    return Math.round(t * 1000);
  }
  const ahead = text.match(/anhängelast|anhaengelast/i);
  const kgAfter = text.match(/anhängelast|anhaengelast\s*(?:von|ab|mindestens|mind\.|≥|>=)?\s*(\d{3,5})\s*(?:kg)?/i);
  if (kgAfter && !isSpanConsumed(spans, kgAfter.index)) {
    markSpan(spans, kgAfter.index, kgAfter.index + kgAfter[0].length);
    return Number(kgAfter[1]);
  }
  const kg = text.match(/(\d{3,5})\s*kg\s*(?:anhängelast|anhaengelast|ziehen)?/i);
  if (kg && !isSpanConsumed(spans, kg.index)) {
    markSpan(spans, kg.index, kg.index + kg[0].length);
    return Number(kg[1]);
  }
  if (ahead) {
    const num = text.match(/anhängelast|anhaengelast[^\d]{0,12}(\d{3,5})/i);
    if (num && !isSpanConsumed(spans, num.index)) {
      markSpan(spans, num.index, num.index + num[0].length);
      return Number(num[1]);
    }
  }
  const twoTon = text.match(/\b2\s*tonnen?\b/i);
  if (twoTon && !isSpanConsumed(spans, twoTon.index)) {
    markSpan(spans, twoTon.index, twoTon.index + twoTon[0].length);
    return 2000;
  }
  const oneFiveTon = text.match(/\b1[,.]5\s*tonnen?\b/i);
  if (oneFiveTon && !isSpanConsumed(spans, oneFiveTon.index)) {
    markSpan(spans, oneFiveTon.index, oneFiveTon.index + oneFiveTon[0].length);
    return 1500;
  }
  const oneEightTon = text.match(/\b1[,.]8\s*tonnen?\b/i);
  if (oneEightTon && !isSpanConsumed(spans, oneEightTon.index)) {
    markSpan(spans, oneEightTon.index, oneEightTon.index + oneEightTon[0].length);
    return 1800;
  }
  const caravanTon = text.match(
    /(?:wohnwagen|wohnanhänger|wohnanhaenger|caravan|anhänger|anhaenger)[^\d]{0,20}(\d{1,2}[.,]\d?)\s*(?:t|tonnen?)\b/i,
  ) ?? text.match(
    /\b(\d{1,2}[.,]\d?)\s*(?:t|tonnen?)\s*(?:wohnwagen|wohnanhänger|wohnanhaenger|caravan)\b/i,
  );
  if (caravanTon && !isSpanConsumed(spans, caravanTon.index)) {
    const t = Number(caravanTon[1].replace(',', '.'));
    markSpan(spans, caravanTon.index, caravanTon.index + caravanTon[0].length);
    return Math.round(t * 1000);
  }
  const caravanKg = text.match(
    /(?:wohnwagen|wohnanhänger|wohnanhaenger|caravan)[^\d]{0,20}(\d{3,4})\s*kg\b/i,
  );
  if (caravanKg && !isSpanConsumed(spans, caravanKg.index)) {
    markSpan(spans, caravanKg.index, caravanKg.index + caravanKg[0].length);
    return Number(caravanKg[1]);
  }
  if (/(?:wohnwagen|wohnanhänger|wohnanhaenger|caravan)/i.test(text) && !ahead) {
    const m = text.match(/(?:wohnwagen|wohnanhänger|wohnanhaenger|caravan)/i);
    if (m && !isSpanConsumed(spans, m.index)) {
      markSpan(spans, m.index, m.index + m[0].length);
      return 1800;
    }
  }
  return null;
}

function extractCustomerSignals(text, spans) {
  let existingLead = false;
  let familyHint = null;
  let dogBoxHint = null;

  if (
    /\b(bereits|schon|vorher|nochmal|erneut)\b.{0,60}\b(e-?mail|mail|anfrage|konfigurator|angebot|nachricht)\b/i.test(text)
    || /\b(e-?mail|anfrage|konfigurator|angebot).{0,50}\b(geschickt|gesendet|gestellt|erhalten|abgegeben|übermittelt|uebermittelt)\b/i.test(text)
    || /\bbereits\s+(?:eine\s+)?anfrage\b/i.test(text)
    || /\bhabe\s+(?:schon|bereits)\s+(?:geschrieben|kontaktiert|angerufen)\b/i.test(text)
    || /\bwar\s+schon\s+in\s+kontakt\b/i.test(text)
  ) {
    existingLead = true;
    const m = text.match(/\b(bereits|schon)\b.{0,50}\b(e-?mail|mail|anfrage|konfigurator)\b/i)
      ?? text.match(/\b(e-?mail|anfrage).{0,40}\b(geschickt|gesendet|gestellt)\b/i)
      ?? text.match(/\bhabe\s+(?:schon|bereits)\b/i);
    if (m) markSpan(spans, m.index, m.index + m[0].length);
  }

  if (/\b(drei|3)\s*kinder\b/i.test(text)) {
    familyHint = 'Drei Kinder';
    const m = text.match(/\b(drei|3)\s*kinder\b/i);
    if (m) markSpan(spans, m.index, m.index + m[0].length);
  } else if (/\b(zwei|2)\s*kinder\b/i.test(text)) {
    familyHint = 'Zwei Kinder';
    const m = text.match(/\b(zwei|2)\s*kinder\b/i);
    if (m) markSpan(spans, m.index, m.index + m[0].length);
  } else if (/\bgroße\s+familie|grosse\s+familie\b/i.test(text)) {
    familyHint = 'Große Familie';
    const m = text.match(/\bgroße\s+familie|grosse\s+familie\b/i);
    if (m) markSpan(spans, m.index, m.index + m[0].length);
  } else if (/\b(kinder|kind)\b/i.test(text) && /\b(drei|vier|fünf|3|4|5)\b/i.test(text)) {
    familyHint = 'Familie mit Kindern';
  } else if (/\bkinderwagen\b/i.test(text)) {
    familyHint = 'Kinderwagen geeignet';
    const m = text.match(/\bkinderwagen\b/i);
    if (m) markSpan(spans, m.index, m.index + m[0].length);
  }

  if (/\bhundebox\b/i.test(text)) {
    dogBoxHint = 'Hundebox muss reinpassen';
    const m = text.match(/\bhundebox\b/i);
    if (m) markSpan(spans, m.index, m.index + m[0].length);
  } else if (/\bhund(?:e)?\b/i.test(text) && /\b(platz|reinpassen|kofferraum|transport|box)\b/i.test(text)) {
    dogBoxHint = 'Platz für den Hund';
  }

  let chargingHomeHint = null;
  if (
    /\bwallbox\b/i.test(text)
    || /\bwall\s*box\b/i.test(text)
    || /\bladen\s+zu\s+hause\b/i.test(text)
    || /\bzuhause\s+laden\b/i.test(text)
    || /\b11\s*kw\b/i.test(text)
    || /\bgarage\s+strom\b/i.test(text)
  ) {
    chargingHomeHint = 'Wallbox / Laden zu Hause';
    const m = text.match(/\bwallbox\b|\bwall\s*box\b|\bladen\s+zu\s+hause\b|\bzuhause\s+laden\b|\b11\s*kw\b|\bgarage\s+strom\b/i);
    if (m) markSpan(spans, m.index, m.index + m[0].length);
  }

  return { existingLead, familyHint, dogBoxHint, chargingHomeHint };
}

/** Max. Fahrzeuglänge in mm – „bis 4 Meter Länge“, nicht Reichweite in km. */
function extractMaxLengthMm(text, spans) {
  const patterns = [
    /\bbis\s*(\d(?:[.,]\d+)?)\s*m(?:eter)?(?:\s*l[aä]nge)?/i,
    /\bmax(?:imal)?\.?\s*(\d(?:[.,]\d+)?)\s*m(?:eter)?(?:\s*l[aä]nge)?/i,
    /\bunter\s*(\d(?:[.,]\d+)?)\s*m(?:eter)?(?:\s*l[aä]nge)?/i,
    /\bhöchstens\s*(\d(?:[.,]\d+)?)\s*m(?:eter)?(?:\s*l[aä]nge)?/i,
    /\b(\d(?:[.,]\d+)?)\s*m(?:eter)?\s*l[aä]nge\b/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (!m || isSpanConsumed(spans, m.index)) continue;

    const window = text.slice(Math.max(0, m.index - 20), m.index + m[0].length + 20);
    if (/\b(km|reichweite|wlpt)\b/i.test(window) && !/\bl[aä]nge\b|\blang\b/i.test(window)) {
      continue;
    }

    const meters = parseFloat(m[1].replace(',', '.'));
    if (!Number.isFinite(meters) || meters <= 0 || meters >= 20) continue;

    markSpan(spans, m.index, m.index + m[0].length);
    return Math.round(meters * 1000);
  }

  return null;
}

/** Max. Fahrzeughöhe in mm – Garage, Tiefgarage, Carport. */
function extractMaxHeightMm(text, spans) {
  const heightWord = 'h(?:oe|o)he';
  const patterns = [
    new RegExp(`\\b(?:garage|tiefgarage|carport|stellplatz)\\s*(?:${heightWord})?\\s*(?:bis|max(?:imal)?\\.?|unter)?\\s*(\\d(?:[.,]\\d+)?)\\s*m(?:eter)?`, 'i'),
    new RegExp(`\\b(?:bis|max(?:imal)?\\.?|unter|hoechstens)\\s*(\\d(?:[.,]\\d+)?)\\s*m(?:eter)?\\s*${heightWord}`, 'i'),
    new RegExp(`\\b(\\d(?:[.,]\\d+)?)\\s*m(?:eter)?\\s*(?:fahrzeug)?${heightWord}\\b`, 'i'),
    new RegExp(`\\b${heightWord}\\s*(?:bis|max(?:imal)?\\.?|unter)?\\s*(\\d(?:[.,]\\d+)?)\\s*m(?:eter)?`, 'i'),
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (!m || isSpanConsumed(spans, m.index)) continue;

    const meters = parseFloat(m[1].replace(',', '.'));
    if (!Number.isFinite(meters) || meters <= 0 || meters >= 5) continue;

    markSpan(spans, m.index, m.index + m[0].length);
    return Math.round(meters * 1000);
  }

  if (/\btiefgarage\b/i.test(text) && !/\b\d\s*m\b/i.test(text)) {
    const m = text.match(/\btiefgarage\b/i);
    if (m && !isSpanConsumed(spans, m.index)) {
      markSpan(spans, m.index, m.index + m[0].length);
      return 2000;
    }
  }

  return null;
}

const ISOFIX_WORDS = { ein: 1, eine: 1, zwei: 2, drei: 3, vier: 4 };

function extractIsofixRearMin(text, spans) {
  const numWord = text.match(/\b(ein|eine|zwei|drei|vier|\d)\s*isofix\b/i);
  if (numWord && !isSpanConsumed(spans, numWord.index)) {
    const raw = numWord[1].toLowerCase();
    const count = ISOFIX_WORDS[raw] ?? Number(raw);
    if (count >= 1 && count <= 4) {
      markSpan(spans, numWord.index, numWord.index + numWord[0].length);
      return count;
    }
  }

  if (/\b3\s*kindersitze\b|\bdrei\s*kindersitze\b|\b3\s*isofix\b/i.test(text)) {
    const m = text.match(/\b(3\s*kindersitze|drei\s*kindersitze|3\s*isofix)\b/i);
    if (m && !isSpanConsumed(spans, m.index)) {
      markSpan(spans, m.index, m.index + m[0].length);
      return 3;
    }
  }

  const rearSeats = text.match(/\b(ein|eine|zwei|drei|vier|1|2|3|4)\s*kindersitze?\s+hinten\b/i);
  if (rearSeats && !isSpanConsumed(spans, rearSeats.index)) {
    const raw = rearSeats[1].toLowerCase();
    const count = ISOFIX_WORDS[raw] ?? Number(raw);
    if (count >= 1 && count <= 4) {
      markSpan(spans, rearSeats.index, rearSeats.index + rearSeats[0].length);
      return count;
    }
  }

  if (/\b(zwei|2)\s*kindersitze\b/i.test(text)) {
    const m = text.match(/\b(zwei|2)\s*kindersitze\b/i);
    if (m && !isSpanConsumed(spans, m.index)) {
      markSpan(spans, m.index, m.index + m[0].length);
      return 2;
    }
  }

  const spacedIsofix = text.match(/\b(ein|eine|zwei|drei|vier|\d)\s*iso\s*fix\b/i);
  if (spacedIsofix && !isSpanConsumed(spans, spacedIsofix.index)) {
    const raw = spacedIsofix[1].toLowerCase();
    const count = ISOFIX_WORDS[raw] ?? Number(raw);
    if (count >= 1 && count <= 4) {
      markSpan(spans, spacedIsofix.index, spacedIsofix.index + spacedIsofix[0].length);
      return count;
    }
  }

  if (/\biso\s*fix\b/i.test(text) && !/\bisofix\b/i.test(text)) {
    const m = text.match(/\biso\s*fix\b/i);
    if (m && !isSpanConsumed(spans, m.index)) {
      markSpan(spans, m.index, m.index + m[0].length);
      return 1;
    }
  }

  if (/\bisofix\b/i.test(text) && !isSpanConsumed(spans, text.search(/\bisofix\b/i))) {
    const m = text.match(/\bisofix\b/i);
    if (m) {
      markSpan(spans, m.index, m.index + m[0].length);
      return 1;
    }
  }

  return null;
}

/** Mindest-Kofferraumvolumen in Liter. */
function extractTrunkLMin(text, spans) {
  const explicit = text.match(/(?:mindestens|mind\.|ab|über|ueber)\s*(\d{3,4})\s*l(?:iter)?(?:\s*kofferraum)?/i)
    ?? text.match(/(\d{3,4})\s*l(?:iter)?\s*kofferraum/i);
  if (explicit && !isSpanConsumed(spans, explicit.index)) {
    const liters = Number(explicit[1]);
    if (liters >= 200 && liters <= 3000) {
      markSpan(spans, explicit.index, explicit.index + explicit[0].length);
      return liters;
    }
  }
  return null;
}

/** Kofferraum-Laderaumlänge in cm (in Stammdaten meist nicht verfügbar – Lexikon-Hinweis). */
function extractTrunkDepthCmMin(text, spans) {
  const patterns = [
    /(?:kofferraum|laderaum|ladefläche|ladeflaeche)[^\d]{0,40}(?:länge|laenge|tiefe)[^\d]{0,20}(?:über|ueber|mind\.|mindestens|ab|>)?\s*(\d{2,3})\s*cm/i,
    /(?:länge|laenge|tiefe)[^\d]{0,20}(?:über|ueber|mind\.|mindestens|ab|>)?\s*(\d{2,3})\s*cm[^\n]{0,40}(?:kofferraum|laderaum)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m || isSpanConsumed(spans, m.index)) continue;
    const cm = Number(m[1]);
    if (cm < 50 || cm > 300) continue;
    markSpan(spans, m.index, m.index + m[0].length);
    return cm;
  }
  return null;
}

function extractTransmission(text, spans) {
  if (/\bautomatik\b|\bdsg\b|\bautom\.?\b/i.test(text)) {
    const m = text.match(/\b(automatik|dsg)\b/i);
    if (m) markSpan(spans, m.index, m.index + m[0].length);
    return 'automatic';
  }
  const manualRe = /\b(schaltgetriebe|schalte|handgeschaltet|manuell|schalter|handschalter)\b/i;
  const mm = text.match(manualRe);
  if (mm) {
    markSpan(spans, mm.index, mm.index + mm[0].length);
    return 'manual';
  }
  return null;
}

function extractMileageAndTerm(text, spans) {
  let mileagePerYear = null;
  let durationMonths = null;

  const my = text.match(/(\d{1,2})\.?\s*000\s*km\s*(?:\/|pro)?\s*(?:jahr|j\.?)/i)
    ?? text.match(/(\d{4,5})\s*km\s*(?:\/|pro)?\s*jahr/i)
    ?? text.match(/(\d{1,2})\.(\d{3})\s*km\b/i)
    ?? (/\blaufleistung\b/i.test(text) ? text.match(/(\d{4,5})\s*km\b/i) : null);
  if (my) {
    if (my[2] != null && my[2].length === 3) {
      mileagePerYear = Number(my[1]) * 1000 + Number(my[2]);
    } else {
      mileagePerYear = Number(my[1].replace('.', '')) >= 100
        ? Number(my[1].replace('.', ''))
        : Number(my[1]) * 1000;
    }
    markSpan(spans, my.index, my.index + my[0].length);
  }

  const term = text.match(/(\d{2})\s*monate/i);
  if (term) {
    durationMonths = Number(term[1]);
    markSpan(spans, term.index, term.index + term[0].length);
  }

  if (!mileagePerYear) {
    const annual = text.match(/\b(\d{4,5})\s*km\b/i);
    if (annual && !isSpanConsumed(spans, annual.index)) {
      const val = Number(annual[1]);
      const rangeCtx = /\b(über|ueber|ab|mindestens|mehr als|reichweite|wlpt|range)\b/i.test(text);
      const mileageCtx = /\b(laufleistung|jahr|leasing|kilometer\s*pro)\b/i.test(text);
      if (mileageCtx || (!rangeCtx && val >= 5000 && val <= 50000)) {
        mileagePerYear = val;
        markSpan(spans, annual.index, annual.index + annual[0].length);
      }
    }
  }

  return { mileagePerYear, durationMonths };
}

function extractBrandModelTrim(text, spans, features) {
  let brand = null;
  let model = null;
  let trim = null;
  let bodyType = null;

  for (const bp of BRAND_PATTERNS) {
    for (const p of bp.patterns) {
      const span = findPhrase(text, p);
      if (span && !isSpanConsumed(spans, span.start)) {
        brand = bp.brand;
        markSpan(spans, span.start, span.end);
        break;
      }
    }
    if (brand) break;
  }

  for (const entry of MODEL_CATALOG) {
    if (entry.requireBrand && entry.brand !== brand) continue;
    if (entry.model === '360' && features.includes('camera_360')) continue;

    for (const p of entry.patterns) {
      const span = findPhrase(text, p);
      if (span && !isSpanConsumed(spans, span.start)) {
        if (entry.model === '360' && !/\bferrari\b/.test(text)) continue;
        brand = brand ?? entry.brand;
        model = entry.model;
        markSpan(spans, span.start, span.end);
        break;
      }
    }
    if (model) break;
  }

  for (const tp of TRIM_PATTERNS) {
    for (const p of tp.patterns) {
      const span = findPhrase(text, p.trim());
      if (span && !isSpanConsumed(spans, span.start)) {
        trim = tp.trim;
        markSpan(spans, span.start, span.end);
        break;
      }
    }
    if (trim) break;
  }

  if (/\bsuv\b|geländewagen|gelaendewagen/i.test(text)) bodyType = 'suv';
  if (/\bkombi\b/i.test(text)) bodyType = 'kombi';
  if (/\bkleinwagen\b/i.test(text)) bodyType = 'kleinwagen';
  if (!bodyType && /\bkleines?\s+auto\b/i.test(text)) bodyType = 'kleinwagen';
  if (!bodyType && /\b(kompakt|city\s*auto|stadtauto)\b/i.test(text)) bodyType = 'kleinwagen';

  return { brand, model, trim, bodyType };
}

function extractPowerPs(text, spans) {
  const m = text.match(/\b(?:r)?\s*(\d{2,3})\s*ps\b/i);
  if (!m || isSpanConsumed(spans, m.index)) return null;
  const target = Number(m[1]);
  markSpan(spans, m.index, m.index + m[0].length);
  const approx = /\b(ca\.?|circa|ungefähr|ungefaehr|etwa|rund)\b/i.test(text);
  const minimum = /\b(mindestens|min\.|ab)\b/i.test(text);
  let min = target - POWER_PS_TOLERANCE;
  let max = target + POWER_PS_TOLERANCE;
  if (approx) {
    min = target - 20;
    max = target + 20;
  }
  if (minimum) {
    min = target;
    max = null;
  }
  return {
    powerPsTarget: target,
    powerPsMin: min,
    powerPsMax: max,
  };
}

function computeConfidence(intent) {
  let score = 0.2;
  const fields = [
    intent.fuel, intent.payment, intent.model, intent.brand,
    intent.maxRate, intent.maxPrice, intent.availability,
  ];
  for (const f of fields) if (f) score += 0.1;
  if (intent.features.length) score += 0.08 * intent.features.length;
  if (intent.rangeKmMin) score += 0.1;
  if (intent.towCapacityKg) score += 0.1;
  if (intent.fuelAlternatives?.length) score += 0.08;
  if (intent.existingLead) score += 0.05;
  if (intent.chargingHomeHint) score += 0.05;
  if (intent.financeZeroPercent) score += 0.06;
  if (intent.features.includes('fast_charge')) score += 0.06;
  if (intent.maxHeightMm) score += 0.08;
  if (intent.isofixRearMin) score += 0.08;
  if (intent.trunkLMin) score += 0.06;
  if (intent.location) score += 0.08;
  if (intent.powerPsTarget) score += 0.08;
  return Math.min(1, score);
}

/**
 * @param {string} input
 * @returns {import('./searchIntentTypes.js').SearchIntent}
 */
export function parseSearchIntent(input) {
  const rawQuery = String(input ?? '').trim();
  if (!rawQuery) return EMPTY_INTENT();

  const tolerant = typoTolerantSearchText(rawQuery);
  const text = tolerant.text;
  const spans = [];
  const ambiguousTerms = [];

  let features = extractFeatures(text, spans);
  for (const fid of tolerant.resolvedFeatures ?? []) {
    if (!features.includes(fid)) features.push(fid);
  }
  protectAmbiguousNumbers(text, spans, features, ambiguousTerms);

  const towCapacityKg = extractTowCapacity(text, spans);
  if (towCapacityKg && !features.includes('towbar')) features.push('towbar');

  const rangeRanking = extractRangeRanking(text, spans);
  if (rangeRanking === 'max') {
    if (!features.includes('reichweite')) features.push('reichweite');
    if (!features.includes('elektro')) features.push('elektro');
  }

  const fuelPreference = extractFuelPreference(text, spans);
  let resolvedFuel = fuelPreference.fuel;
  let fuelAlternatives = fuelPreference.fuelAlternatives;
  if (!resolvedFuel && !fuelAlternatives?.length && /\belektro\b/i.test(text)) resolvedFuel = 'elektro';
  if (!resolvedFuel && !fuelAlternatives?.length && features.includes('elektro')) resolvedFuel = 'elektro';
  if (!resolvedFuel && !fuelAlternatives?.length && features.includes('benzin')) resolvedFuel = 'verbrenner';
  if (!resolvedFuel && !fuelAlternatives?.length && rangeRanking === 'max') resolvedFuel = 'elektro';
  const customerSignals = extractCustomerSignals(text, spans);
  const financeZeroPercent = extractFinanceZeroPercent(text, spans);
  let payment = extractPayment(text, spans);
  if (financeZeroPercent && !payment) payment = 'finance';
  const availability = extractAvailability(text, spans);
  const { maxRate, maxPrice, rangeKmMin } = extractMoneyAndRange(text, spans);
  const transmission = extractTransmission(text, spans);
  const { mileagePerYear, durationMonths } = extractMileageAndTerm(text, spans);
  let { brand, model, trim, bodyType } = extractBrandModelTrim(text, spans, features);
  if (!bodyType && tolerant.bodyType) bodyType = tolerant.bodyType;
  let modelExplicit = Boolean(model && isModelExplicitlyRequested(rawQuery, { brand, model }));
  if (!modelExplicit) {
    model = null;
    if (!brand || !/\b(kia|ford|hyundai|mg|ferrari)\b/i.test(rawQuery)) {
      brand = null;
    }
  }

  const power = extractPowerPs(text, spans);

  const locParsed = parseLocationFromText(rawQuery);
  const location = locParsed?.city ?? locParsed?.plz ?? locParsed?.label ?? null;

  let seatsMin = null;
  if (/7\s*-?\s*sitzer|sieben\s*sitz|7\s*pl[aä]tze|7\s*personen/i.test(text)) {
    seatsMin = 7;
    if (!features.includes('seats_7')) features.push('seats_7');
    const span = findPhrase(text, '7-sitzer') ?? findPhrase(text, '7 sitzer') ?? findPhrase(text, 'siebensitzer');
    if (span) markSpan(spans, span.start, span.end);
  }
  const seats = text.match(/(\d)\s*-?\s*sitz/i);
  if (seats) seatsMin = Number(seats[1]);

  if (customerSignals.familyHint === 'Große Familie') {
    seatsMin = 7;
    if (!features.includes('seats_7')) features.push('seats_7');
  } else if (customerSignals.familyHint === 'Drei Kinder') {
    seatsMin = Math.max(seatsMin ?? 0, 5);
  } else if (customerSignals.familyHint === 'Zwei Kinder') {
    seatsMin = Math.max(seatsMin ?? 0, 5);
  }
  if (customerSignals.familyHint === 'Kinderwagen geeignet' && !features.includes('large_trunk')) {
    features.push('large_trunk');
  }

  const maxLengthMm = extractMaxLengthMm(text, spans);
  const maxHeightMm = extractMaxHeightMm(text, spans);
  let isofixRearMin = extractIsofixRearMin(text, spans);
  if (features.includes('isofix') && isofixRearMin == null) {
    isofixRearMin = 1;
  }
  if (isofixRearMin != null && !features.includes('isofix')) {
    features.push('isofix');
  }
  let trunkLMin = extractTrunkLMin(text, spans);
  const trunkDepthCmMin = extractTrunkDepthCmMin(text, spans);
  if (customerSignals.dogBoxHint && trunkLMin == null) {
    trunkLMin = 500;
    if (!features.includes('large_trunk')) features.push('large_trunk');
  }

  const intent = {
    rawQuery,
    normalizedQuery: text,
    payment: payment ?? (maxRate && hasRateContext(text) ? 'leasing' : null),
    maxRate,
    maxPrice,
    fuel: resolvedFuel,
    fuelAlternatives,
    existingLead: customerSignals.existingLead,
    familyHint: customerSignals.familyHint,
    dogBoxHint: customerSignals.dogBoxHint,
    chargingHomeHint: customerSignals.chargingHomeHint,
    financeZeroPercent,
    brand,
    model,
    modelExplicit,
    trim,
    bodyType,
    transmission,
    availability,
    location,
    radiusKm: locParsed?.radiusKm ?? null,
    mileagePerYear,
    durationMonths,
    features: [...new Set(features)],
    towCapacityKg,
    rangeKmMin,
    rangeRanking,
    maxLengthMm,
    maxHeightMm,
    trunkLMin,
    trunkDepthCmMin,
    isofixRearMin,
    seatsMin,
    powerPsTarget: power?.powerPsTarget ?? null,
    powerPsMin: power?.powerPsMin ?? null,
    powerPsMax: power?.powerPsMax ?? null,
    confidence: 0,
    warnings: [],
    possibleCorrections: [],
    ambiguousTerms,
    fuzzySuggestions: tolerant.suggestions ?? [],
    corrections: tolerant.corrections ?? [],
    consumedSpans: spans,
  };

  if (payment) {
    intent.paymentExplicit = true;
  } else if (financeZeroPercent) {
    intent.payment = 'finance';
    intent.paymentExplicit = true;
  }

  intent.confidence = computeConfidence(intent);
  return intent;
}

export function intentToResidualQuery(intent) {
  return intent.rawQuery.length > 0 && intent.confidence < 0.35 ? intent.rawQuery : '';
}
