/**
 * Trade-in / GW-Erkennung – allgemein, nicht modellspezifisch.
 * GW + Fahrzeug → Trade-in Candidate, nicht Vehicle Interest.
 */

const TRADE_IN_CUE = /\b(?:gw|gebrauchtwagen|in\s*zahlung|inzahlungnahme|nehmen\s+wir\s+in\s+zahlung|nehmen\s+wir\s+mit|aktuelles?\s+fahrzeug|altes?\s+fahrzeug|kommt\s+zurück|rückläufer|ruecklaeufer|vertrag\s+zum\s+bisherigen)\b/i;

const MAKE_RE = 'Kia|Ford|VW|Volkswagen|BMW|Mercedes(?:-Benz)?|Audi|Opel|Toyota|Hyundai|Skoda|Škoda|Seat|SEAT|Renault|Peugeot|Suzuki|Dacia|Cupra|Mazda|Nissan|Volvo|Mini|Fiat|Jeep';

/**
 * @param {string} text
 */
export function hasTradeInCue(text = '') {
  return TRADE_IN_CUE.test(String(text || ''));
}

/**
 * Extrahiert Trade-in-Kandidaten aus Seller-Dump.
 * „GW Kia Picanto“ → { make, model }
 * „Interessiert sich außerdem für Picanto“ ohne Cue → kein Trade-in (Caller entscheidet Interest).
 *
 * @param {string} text
 * @returns {{ make: string|null, model: string|null, label: string, cue: string|null, span: string, ambiguous: boolean }[]}
 */
export function extractTradeInCandidates(text = '') {
  const raw = String(text || '');
  if (!raw.trim()) return [];

  /** @type {{ make: string|null, model: string|null, label: string, cue: string|null, span: string, ambiguous: boolean }[]} */
  const out = [];

  // „GW Kia Picanto“ / „GW: Picanto“ / „Inzahlungnahme Ford Kuga“
  const labeled = new RegExp(
    `\\b(?:gw|gebrauchtwagen|in\\s*zahlung(?:nahme)?|aktuelles?\\s+fahrzeug|altes?\\s+fahrzeug)\\s*[:\\-]?\\s*((?:${MAKE_RE})\\s+)?([A-Za-zÄÖÜäöüß0-9-]{2,20})\\b`,
    'gi',
  );
  let m = labeled.exec(raw);
  while (m) {
    const make = m[1] ? title(m[1].trim()) : inferMakeNear(raw, m.index) || null;
    const model = title(m[2]);
    if (!isStopModel(model)) {
      out.push({
        make,
        model,
        label: [make, model].filter(Boolean).join(' '),
        cue: m[0].split(/\s+/)[0],
        span: m[0],
        ambiguous: !make,
      });
    }
    m = labeled.exec(raw);
  }

  // Fallback: Cue irgendwo + Fahrzeug in derselben Zeile
  if (!out.length && hasTradeInCue(raw)) {
    const lineRe = /^(.*)$/gim;
    let line = lineRe.exec(raw);
    while (line) {
      const lineText = line[1];
      if (!TRADE_IN_CUE.test(lineText)) {
        line = lineRe.exec(raw);
        continue;
      }
      const veh = lineText.match(new RegExp(`\\b(${MAKE_RE})\\s+([A-Za-zÄÖÜäöüß0-9-]{2,20})\\b`, 'i'));
      if (veh) {
        out.push({
          make: title(veh[1]),
          model: title(veh[2]),
          label: `${title(veh[1])} ${title(veh[2])}`,
          cue: 'line',
          span: lineText.trim(),
          ambiguous: false,
        });
      }
      line = lineRe.exec(raw);
    }
  }

  return dedupe(out);
}

/**
 * Modelle, die im Text als Trade-in markiert sind (für Interest-Filter).
 * @param {string} text
 * @returns {Set<string>} lowercase model keys
 */
export function tradeInModelKeys(text = '') {
  return new Set(
    extractTradeInCandidates(text).map((c) => String(c.model || '').toLowerCase()).filter(Boolean),
  );
}

/**
 * „Interessiert sich außerdem für X“ → zweites Interesse, kein Trade-in.
 * @param {string} text
 * @param {string} model
 */
export function isSecondVehicleInterestCue(text = '', model = '') {
  const t = String(text || '');
  const m = String(model || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!m) return false;
  return new RegExp(
    `\\b(?:außerdem|ausserdem|auch|zusätzlich|zusaetzlich|interessiert\\s+sich(?:\\s+außerdem)?\\s+für)\\b[^.]{0,40}\\b${m}\\b`,
    'i',
  ).test(t);
}

function title(s = '') {
  const t = String(s || '').trim();
  if (!t) return t;
  if (/^ev\d$/i.test(t)) return t.toUpperCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function inferMakeNear(raw, index) {
  const window = raw.slice(Math.max(0, index - 40), index + 60);
  const m = window.match(new RegExp(`\\b(${MAKE_RE})\\b`, 'i'));
  return m ? title(m[1]) : null;
}

function isStopModel(model = '') {
  return /^(mit|und|oder|für|fur|weiss|weiß|schwarz|blau|km|monate)$/i.test(model);
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((c) => {
    const key = `${c.make || ''}|${c.model || ''}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
