/**
 * Trade-in / GW-Erkennung – allgemein, nicht modellspezifisch.
 * GW + Fahrzeug → Trade-in Candidate, nicht Vehicle Interest.
 *
 * Negation („nicht in Zahlung geben“) ist kein Trade-in-Intent:
 * Bestandfahrzeug bleibt existingVehicle, kein tradeInRequested.
 */

const TRADE_IN_CUE = /\b(?:gw|gebrauchtwagen|in\s*zahlung|inzahlungnahme|nehmen\s+wir\s+in\s+zahlung|nehmen\s+wir\s+mit|aktuelles?\s+fahrzeug|altes?\s+fahrzeug|kommt\s+zurück|rückläufer|ruecklaeufer|vertrag\s+zum\s+bisherigen)\b/i;

/** Positiv-Cue ohne „in Zahlung“-Phrase (Negation trifft diese nicht). */
const TRADE_IN_POSITIVE_CUE = /\b(?:gw|gebrauchtwagen|nehmen\s+wir\s+in\s+zahlung|nehmen\s+wir\s+mit|aktuelles?\s+fahrzeug|altes?\s+fahrzeug|kommt\s+zurück|rückläufer|ruecklaeufer|vertrag\s+zum\s+bisherigen)\b/i;

/**
 * Explizite Ablehnung einer Inzahlungnahme.
 * „möchte diesen aber nicht in Zahlung geben“ / „keine Inzahlungnahme“ / „bleibt bei mir“.
 */
const TRADE_IN_NEGATION = /\b(?:nicht|kein(?:e|en)?)\s+in\s*zahlung(?:nahme)?\b|\bkeine\s+inzahlungnahme\b|\bkein\s+trade[\s-]?in\b|\bnicht\s+in\s*zahlung\s+geben\b|\bbleibt\s+bei\s+mir\b|\bnicht\s+abgeben\b/i;

const MAKE_RE = 'Kia|Ford|VW|Volkswagen|BMW|Mercedes(?:-Benz)?|Audi|Opel|Toyota|Hyundai|Skoda|Škoda|Seat|SEAT|Renault|Peugeot|Suzuki|Dacia|Cupra|Mazda|Nissan|Volvo|Mini|Fiat|Jeep|Smart';

/** Mehrwort-Modelle (Marke optional bereits matchend). */
const MULTIWORD_MODELS = [
  { re: /\b(smart)\s+(fortwo|forfour)\b/i, make: 'Smart', modelFrom: 2 },
  { re: /\b(mercedes(?:-benz)?)\s+(a|b|c|e|s|gla|glb|glc|gle)\s*-?\s*klasse\b/i, make: 'Mercedes', modelFrom: 2 },
];

/**
 * @param {string} text
 */
export function hasTradeInNegation(text = '') {
  return TRADE_IN_NEGATION.test(String(text || ''));
}

/**
 * @param {string} text
 */
export function hasTradeInCue(text = '') {
  const raw = String(text || '');
  if (!TRADE_IN_CUE.test(raw)) return false;
  // Reine Negation („nicht in Zahlung“) ohne positiven GW-/Trade-Cue → kein Trade-in
  if (hasTradeInNegation(raw) && !TRADE_IN_POSITIVE_CUE.test(raw)) return false;
  return true;
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

  // Mehrwort zuerst: „GW Smart fortwo“ / „fährt einen Smart fortwo“
  for (const mw of MULTIWORD_MODELS) {
    const hit = raw.match(mw.re);
    if (!hit) continue;
    const nearCue = hasTradeInCue(raw)
      || /\b(?:fährt|faehrt|fahren|aktuelles?\s+fahrzeug|altes?\s+fahrzeug|gw)\b/i.test(raw);
    if (!nearCue) continue;
    const make = mw.make;
    const modelRaw = String(hit[mw.modelFrom] || hit[2] || '').toLowerCase();
    const model = modelRaw || title(hit[1]);
    if (!isStopModel(model)) {
      out.push({
        make,
        model,
        label: `${make} ${model}`,
        cue: hasTradeInCue(raw) ? 'gw' : 'faehrt',
        span: hit[0],
        ambiguous: false,
      });
    }
  }

  // „GW Kia Picanto“ / „GW: Picanto“ / „Inzahlungnahme Ford Kuga“
  // Negations-Spans („nicht in Zahlung geben“) nicht als Label-Trade-in werten
  const labeled = new RegExp(
    `\\b(?:gw|gebrauchtwagen|in\\s*zahlung(?:nahme)?|aktuelles?\\s+fahrzeug|altes?\\s+fahrzeug)\\s*[:\\-]?\\s*((?:${MAKE_RE})\\s+)?([A-Za-zÄÖÜäöüß0-9-]{2,20})\\b`,
    'gi',
  );
  let m = labeled.exec(raw);
  while (m) {
    if (isNegatedTradeInSpan(raw, m.index)) {
      m = labeled.exec(raw);
      continue;
    }
    // Skip if already captured as multiword (e.g. GW Smart → only "Smart")
    if (out.some((o) => /smart/i.test(o.make || '') && /smart/i.test(m[0]))) {
      m = labeled.exec(raw);
      continue;
    }
    const make = m[1] ? title(m[1].trim()) : inferMakeNear(raw, m.index) || null;
    let model = title(m[2]);
    // „GW Smart fortwo“ wenn Make=Smart und nächstes Token fortwo
    if (/^smart$/i.test(make || m[2] || '') || /^smart$/i.test(m[2] || '')) {
      const after = raw.slice(m.index + m[0].length).match(/^\s*(fortwo|forfour)\b/i);
      if (after) {
        model = after[1].toLowerCase();
        const resolvedMake = make || 'Smart';
        if (!isStopModel(model)) {
          out.push({
            make: resolvedMake,
            model,
            label: `Smart ${model}`,
            cue: m[0].split(/\s+/)[0],
            span: `${m[0]} ${after[1]}`,
            ambiguous: false,
          });
        }
        m = labeled.exec(raw);
        continue;
      }
    }
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
  // Wichtig: split statt /^(.*)$/gim — Zero-Length-Match-Loop bei Leerzeilen (\n\n)
  if (!out.length && hasTradeInCue(raw)) {
    for (const lineText of raw.split(/\r?\n/)) {
      if (!lineText.trim()) continue;
      if (!TRADE_IN_CUE.test(lineText) || isNegatedTradeInSpan(lineText, 0)) continue;
      const veh = lineText.match(new RegExp(`\\b(${MAKE_RE})\\s+([A-Za-zÄÖÜäöüß0-9-]{2,20})\\b`, 'i'));
      if (veh && !isStopModel(veh[2])) {
        out.push({
          make: title(veh[1]),
          model: title(veh[2]),
          label: `${title(veh[1])} ${title(veh[2])}`,
          cue: 'line',
          span: lineText.trim(),
          ambiguous: false,
        });
      }
    }
  }

  // „hat noch einen Sportage von 2021 … in Zahlung“ – Kia-Modell ohne Marke
  if (hasTradeInCue(raw)) {
    const kiaStandalone = new RegExp(
      `\\b(?:einen?|seinen?|ihren?|das|den|die)?\\s*(?:kia\\s+)?(${KIA_STANDALONE_MODELS})\\b(?:\\s+von\\s+(20\\d{2}))?`,
      'gi',
    );
    let sm = kiaStandalone.exec(raw);
    while (sm) {
      const model = normalizeKiaModel(sm[1]);
      if (model && !isStopModel(model) && !isSecondVehicleInterestCue(raw, sm[1])) {
        const before = raw.slice(Math.max(0, sm.index - 28), sm.index);
        const around = raw.slice(Math.max(0, sm.index - 12), sm.index + sm[0].length + 28);
        // Neuwagen-Interesse („interessiere mich für einen Kia EV3“) ≠ Trade-in
        if (isNewVehicleInterestNear(raw, sm.index, sm[1])) {
          sm = kiaStandalone.exec(raw);
          continue;
        }
        const looksLikeTradeVehicle = /\b(?:hat\s+noch|fährt|faehrt|von\s+20\d{2})\b/i.test(around)
          || /^(?:einen?|seinen?|ihren?)\s+/i.test(String(sm[0]).trim())
          || (
            /\b(?:gw|gebrauchtwagen|in\s*zahlung|aktuelles?\s+fahrzeug|altes?\s+fahrzeug)\b/i.test(before)
            && !/\bund\b/i.test(before)
          );
        if (looksLikeTradeVehicle) {
          const year = sm[2] ? Number(sm[2]) : extractNearbyYear(raw, sm.index);
          const already = out.some((o) => String(o.model || '').toLowerCase() === model.toLowerCase());
          if (!already) {
            out.push({
              make: 'Kia',
              model,
              year: Number.isFinite(year) ? year : null,
              label: year ? `Kia ${model} (${year})` : `Kia ${model}`,
              cue: 'trade_in_context',
              span: sm[0],
              ambiguous: false,
            });
          } else if (year) {
            const hit = out.find((o) => String(o.model || '').toLowerCase() === model.toLowerCase());
            if (hit && !hit.year) {
              hit.year = year;
              hit.label = `Kia ${model} (${year})`;
            }
          }
        }
      }
      sm = kiaStandalone.exec(raw);
    }
  }

  // Meta: Jahr / km an Kandidaten anreichern
  const meta = extractTradeInMeta(raw);
  for (const c of out) {
    if (meta.year != null && c.year == null) c.year = meta.year;
    if (meta.mileageKm != null && c.mileageKm == null) {
      c.mileageKm = meta.mileageKm;
      c.mileageApproximate = meta.mileageApproximate;
    }
    if (c.year && c.label && !/\(\d{4}\)/.test(c.label)) {
      c.label = `${c.label} (${c.year})`;
    }
  }

  return dedupe(out);
}

const KIA_STANDALONE_MODELS = 'EV\\s*[2-9]|Sportage|Sorento|Ceed|XCeed|Niro|Picanto|Stonic|Rio|Seltos|Soul|PV5';

function normalizeKiaModel(raw = '') {
  const t = String(raw || '').replace(/\s+/g, '');
  if (/^ev\d$/i.test(t)) return t.toUpperCase();
  return title(raw);
}

function extractNearbyYear(text = '', index = 0) {
  const window = String(text || '').slice(Math.max(0, index - 10), index + 40);
  const m = window.match(/\bvon\s+(20\d{2})\b|\b(20\d{2})\b/);
  if (!m) return null;
  const y = Number(m[1] || m[2]);
  return y >= 1990 && y <= 2100 ? y : null;
}

/**
 * „nicht in Zahlung …“ direkt vor dem Match-Span.
 * @param {string} text
 * @param {number} index
 */
function isNegatedTradeInSpan(text = '', index = 0) {
  const before = String(text || '').slice(Math.max(0, index - 48), index);
  return /\b(?:nicht|kein(?:e|en)?)\s*$/i.test(before)
    || /\b(?:nicht|kein(?:e|en)?)\s+in\s*$/i.test(before)
    || TRADE_IN_NEGATION.test(String(text || '').slice(Math.max(0, index - 24), index + 48));
}

/**
 * Neuwagen-Interesse in der Nähe des Modell-Spans.
 * @param {string} text
 * @param {number} index
 * @param {string} model
 */
function isNewVehicleInterestNear(text = '', index = 0, model = '') {
  const window = String(text || '').slice(Math.max(0, index - 80), index + String(model || '').length + 8);
  return /\b(?:interess(?:iere|iert|e)|anfrage|angebot|leasing|ausstattung|möchte\s+(?:gern(?:e)?\s+)?(?:einen?|die|das)|liebsten\s+hätte)\b/i.test(window);
}

/**
 * Jahr / km im Trade-in-Kontext (ohne als Wunsch-Jahreskilometer zu werten).
 * @param {string} text
 */
export function extractTradeInMeta(text = '') {
  const raw = String(text || '');
  const yearMatch = raw.match(/\bvon\s+(20\d{2})\b/) || raw.match(/\b(20\d{2})\s*(?:er|Baujahr)?\b/);
  let year = null;
  if (yearMatch) {
    const y = Number(yearMatch[1]);
    if (y >= 1990 && y <= 2100) year = y;
  }
  const kmMatch = raw.match(
    /\b((?:ca\.?|circa|ungefähr|ungefaehr|etwa)\s*)?(\d{1,2}(?:\.\d{3})+|\d{4,6})\s*km\b/i,
  );
  let mileageKm = null;
  let mileageApproximate = false;
  if (kmMatch) {
    const n = Number(String(kmMatch[2]).replace(/\./g, ''));
    if (Number.isFinite(n)) {
      mileageKm = n < 1000 ? n * 1000 : n;
      mileageApproximate = Boolean(kmMatch[1]) || /\b(?:ca\.?|circa|ungefähr|ungefaehr|etwa)\b/i.test(raw);
    }
  }
  return { year, mileageKm, mileageApproximate };
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
  return /^(?:mit|und|oder|für|fur|weiss|weiß|schwarz|blau|km|monate?|geben|möchte|moechte|den|der|die|das|er|sie|eventuell|vielleicht|ungefähr|ungefaehr|circa|ca|noch|hat|einen|einem|von|jahr|jahre)$/i.test(model);
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
