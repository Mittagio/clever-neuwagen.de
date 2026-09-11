/**
 * Unit-aware Normalisierung für Seller-Dumps.
 * Einheiten haben Vorrang vor bloßen Zahlenmustern – kein modellspezifischer Sonderfall.
 */

import { parseSellerCommercialAliasShorthand } from './sellerAliasRegistry.js';

/**
 * @typedef {{ kind: 'money'|'mileage'|'term_months'|'rate'|'number'|'unknown', value: number, raw: string, unit: string|null, index: number }} SellerUnitToken
 */

function parseDeInt(raw = '') {
  const n = Number(String(raw).replace(/\./g, '').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Alle zahlengebundenen Tokens mit Einheit aus dem Text.
 * @param {string} text
 * @returns {SellerUnitToken[]}
 */
export function extractSellerUnitTokens(text = '') {
  const raw = String(text || '');
  /** @type {SellerUnitToken[]} */
  const tokens = [];

  const patterns = [
    {
      re: /\b(\d{1,3}(?:\.\d{3})+|\d{4,7})\s*(?:€|euro)\b/gi,
      kind: 'money',
      unit: 'eur',
    },
    {
      re: /\b(\d{1,3}(?:\.\d{3})?|\d{3,6})\s*(?:tkm|km|kilometer(?:n)?)(?:\s*(?:\/\s*jahr|\/\s*jahre|\/\s*a|p\.?\s*a\.?|im\s+jahr|pro\s+jahr|jährlich|jaehrlich))?\b/gi,
      kind: 'mileage',
      unit: 'km',
    },
    {
      re: /\b(\d{1,3})\s*(?:monaten|monate|monat|mts?)\b/gi,
      kind: 'term_months',
      unit: 'months',
    },
    {
      re: /\b(\d{1,2})\s*jahre?\b/gi,
      kind: 'term_years',
      unit: 'years',
    },
    {
      re: /\b(\d{2,4})\s*(?:€|euro)?\s*(?:wunsch)?rate\b/gi,
      kind: 'rate',
      unit: 'eur_per_month',
    },
  ];

  for (const { re, kind, unit } of patterns) {
    re.lastIndex = 0;
    let m = re.exec(raw);
    while (m) {
      let value = parseDeInt(m[1]);
      if (value == null) {
        m = re.exec(raw);
        continue;
      }
      if (kind === 'mileage') {
        if (/tkm/i.test(m[0]) && value < 1000) value *= 1000;
        else if (value < 1000 && !/tkm/i.test(m[0])) {
          // „15 tkm“ already handled; bare small km like „500 km“ stays
        }
      }
      if (kind === 'term_years') {
        tokens.push({
          kind: 'term_months',
          value: value * 12,
          raw: m[0],
          unit: 'months',
          index: m.index,
        });
        m = re.exec(raw);
        continue;
      }
      tokens.push({
        kind,
        value,
        raw: m[0],
        unit,
        index: m.index,
      });
      m = re.exec(raw);
    }
  }

  return tokens.sort((a, b) => a.index - b.index);
}

/**
 * Shorthand „48 10.000 km“ / „48 Monate 10.000 km“ im Fahrzeug-/Leasingkontext.
 * @param {string} text
 * @returns {{ termMonths: number|null, annualMileage: number|null }}
 */
export function parseTermAndMileageShorthand(text = '') {
  const raw = String(text || '');
  const explicit = {
    termMonths: null,
    annualMileage: null,
  };

  const termM = raw.match(/\b(\d{1,3})\s*(?:monaten|monate|monat|mts?)\b/i);
  if (termM) explicit.termMonths = Number(termM[1]);

  // „vier Jahre“ / „4 Jahre“ / „für vier Jahre“
  if (explicit.termMonths == null) {
    const WORD_YEARS = {
      einem: 1, eine: 1, ein: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5,
      sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10,
    };
    const yearsNum = raw.match(/\b(?:für\s+|auf\s+)?(\d{1,2})\s*jahre?\b/i);
    const yearsWord = raw.match(
      /\b(?:für\s+|auf\s+)?(einem|eine|ein|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun|zehn)\s+jahre?\b/i,
    );
    if (yearsNum) {
      const y = Number(yearsNum[1]);
      if (y >= 1 && y <= 10) explicit.termMonths = y * 12;
    } else if (yearsWord) {
      const y = WORD_YEARS[String(yearsWord[1]).toLowerCase()];
      if (y) explicit.termMonths = y * 12;
    }
  }

  const kmM = raw.match(
    /\b(\d{1,3}(?:\.\d{3})?|\d{4,6})\s*(?:tkm|km|kilometer(?:n)?)(?:\s*(?:\/\s*jahr|im\s+jahr|pro\s+jahr|jährlich|jaehrlich))?\b/i,
  );
  if (kmM) {
    let v = parseDeInt(kmM[1]);
    if (v != null) {
      if (/tkm/i.test(kmM[0]) && v < 1000) v *= 1000;
      if (v > 0 && v < 1000) {
        // leave as-is for rare short trips; annual shorthand usually >= 5000
      }
      explicit.annualMileage = v < 1000 ? v * 1000 : v;
    }
  }

  // „48 10.000 km“ ohne „Monate“ – nur wenn Fahrzeug-/Konditionskontext
  if (explicit.termMonths == null || explicit.annualMileage == null) {
    const vehicleCue = /\b(?:ev\s*\d|sportage|picanto|xceed|ceed|niro|sorento|leasing|leasen|finanz|gw|ahk|air|vision|elektro|wp|win)\b/i.test(raw);
    const shorthand = raw.match(/\b(\d{2})\s+(\d{1,3}(?:\.\d{3})|\d{4,6})\s*(?:km|kilometer(?:n)?)\b/i);
    if (vehicleCue && shorthand) {
      if (explicit.termMonths == null) {
        const months = Number(shorthand[1]);
        if (months >= 12 && months <= 72) explicit.termMonths = months;
      }
      if (explicit.annualMileage == null) {
        let v = parseDeInt(shorthand[2]);
        if (v != null) explicit.annualMileage = v < 1000 ? v * 1000 : v;
      }
    }
  }

  // Seller-Alias: „48/15“ → 48 Monate · 15.000 km
  if (explicit.termMonths == null || explicit.annualMileage == null) {
    const aliasCommercial = parseSellerCommercialAliasShorthand(raw);
    if (explicit.termMonths == null && aliasCommercial.termMonths != null) {
      explicit.termMonths = aliasCommercial.termMonths;
    }
    if (explicit.annualMileage == null && aliasCommercial.annualMileage != null) {
      explicit.annualMileage = aliasCommercial.annualMileage;
    }
  }

  return explicit;
}

/**
 * True wenn die Zahl im Text als Mileage (km) gebunden ist – nie Kaufpreis.
 * @param {string} text
 * @param {number} value
 */
export function isNumberBoundToMileage(text = '', value) {
  if (value == null) return false;
  const formatted = Number(value).toLocaleString('de-DE');
  const plain = String(value);
  const re = new RegExp(
    `\\b(?:${formatted.replace(/\./g, '\\.')}|${plain})\\s*(?:tkm|km)\\b`,
    'i',
  );
  return re.test(String(text || ''));
}

/**
 * Kaufpreis nur wenn explizit Geld-Einheit oder Kaufpreis-Cue – nie bei km-gebundenen Zahlen.
 * @param {string} text
 * @returns {{ value: number, label: string, confidence: number }|null}
 */
export function extractPurchasePriceUnitAware(text = '') {
  const raw = String(text || '');
  // Anzahlung/Sonderzahlung ist nie Kaufpreis
  if (/\b(?:anzahlung|sonderzahlung|\baz\b)\b/i.test(raw)
    && !/\b(?:kaufpreis|listenpreis|uvp)\b/i.test(raw)) {
    return null;
  }
  const tokens = extractSellerUnitTokens(raw);
  const money = tokens.find((t) => t.kind === 'money' && t.value >= 5000);
  if (money) {
    // „für 48.000 €“ / Kaufpreis
    return {
      value: money.value,
      label: `Kaufpreis: ${money.value.toLocaleString('de-DE')} €`,
      confidence: 0.92,
    };
  }

  // Expliziter Cue ohne € (selten) – aber nicht wenn dieselbe Zahl km-gebunden ist
  const cue = raw.match(
    /\b(?:für|zu|über|kaufpreis|preis)\s*(\d{1,3}(?:\.\d{3})+|\d{4,7})\b/i,
  );
  if (cue) {
    const value = parseDeInt(cue[1]);
    if (value != null && value >= 5000 && !isNumberBoundToMileage(raw, value)) {
      return {
        value,
        label: `Kaufpreis: ${value.toLocaleString('de-DE')} €`,
        confidence: 0.86,
      };
    }
  }

  return null;
}
