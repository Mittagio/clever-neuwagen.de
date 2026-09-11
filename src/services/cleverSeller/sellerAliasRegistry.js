/**
 * Seller Alias Registry – Verkäufer-Kurzschrift → kanonische Intent-Kandidaten.
 *
 * Produktregel:
 * LLM liest Verkäufer-Slang.
 * Seller Alias Registry normalisiert Fachkürzel.
 * Vehicle Catalog validiert Wahrheit.
 * Apply speichert nur sichere Werte.
 * Unsicherheit bleibt lokal.
 *
 * Alias ≠ Fahrzeugwahrheit. Keine Verfügbarkeit behaupten.
 *
 * @see docs/CLEVER_ZERO_LOSS_INTAKE.md
 * @see docs/CLEVER_OFFER_VEHICLE_IDENTITY_FREEZE.md
 */

/** @typedef {'equipment'|'package'|'propulsion'|'trim'|'color'|'model'} SellerAliasKind */

/**
 * @typedef {{
 *   tokens: string[],
 *   kind: SellerAliasKind,
 *   canonicalId: string|null,
 *   label: string,
 *   field?: string|null,
 *   validatePackage?: boolean,
 *   validateEquipment?: boolean,
 * }} SellerAliasEntry
 */

/** Modell-Tippfehler (aus zeroLossIntake zentralisiert). PV≠EV. */
export const SELLER_MODEL_ALIASES = Object.freeze({
  eq2: 'ev2',
  eq3: 'ev3',
  eq4: 'ev4',
  eq5: 'ev5',
  'e v2': 'ev2',
  'e-v2': 'ev2',
});

/** @type {SellerAliasEntry[]} */
export const SELLER_ALIAS_ENTRIES = Object.freeze([
  // Equipment
  {
    tokens: ['wp', 'wärmep.', 'waermep.', 'heat pump', 'heatpump'],
    kind: 'equipment',
    canonicalId: 'heat_pump',
    label: 'Wärmepumpe',
    validateEquipment: true,
  },
  {
    tokens: ['ahk'],
    kind: 'equipment',
    canonicalId: 'towbar',
    label: 'Anhängerkupplung',
    field: 'towHitchRequired',
  },
  // Winter-Wunsch – Katalog entscheidet Paket; nie Winterräder erfinden
  {
    tokens: ['win'],
    kind: 'package',
    canonicalId: 'winter',
    label: 'Winter',
    validatePackage: true,
  },
  // Range / propulsion
  {
    tokens: ['lr'],
    kind: 'propulsion',
    canonicalId: 'long_range',
    label: 'Long Range',
  },
  {
    tokens: ['sr'],
    kind: 'propulsion',
    canonicalId: 'standard_range',
    label: 'Standard Range',
  },
  {
    tokens: ['awd', '4wd'],
    kind: 'propulsion',
    canonicalId: 'awd',
    label: 'AWD',
  },
  {
    tokens: ['rwd', '2wd'],
    kind: 'propulsion',
    canonicalId: 'rwd',
    label: 'RWD',
  },
  // Trim
  {
    tokens: ['gt-l', 'gtl', 'gt line', 'gt-line'],
    kind: 'trim',
    canonicalId: 'gt-line',
    label: 'GT-Line',
  },
  // Packages – Label-Kandidat; Katalog validiert
  {
    tokens: ['dw', 'drivewise', 'drive wise', 'drive-wise'],
    kind: 'package',
    canonicalId: null,
    label: 'Drive Wise',
    validatePackage: true,
  },
  {
    tokens: ['p1'],
    kind: 'package',
    canonicalId: 'P1',
    label: 'P1',
    validatePackage: true,
  },
  {
    tokens: ['p2'],
    kind: 'package',
    canonicalId: 'P2',
    label: 'P2',
    validatePackage: true,
  },
  {
    tokens: ['p3'],
    kind: 'package',
    canonicalId: 'P3',
    label: 'P3',
    validatePackage: true,
  },
  // Color shorthand
  {
    tokens: ['wei'],
    kind: 'color',
    canonicalId: 'weiß',
    label: 'weiß',
  },
]);

function normalizeAliasKey(raw = '') {
  return String(raw || '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_./-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} rawMention
 * @returns {{ canonical: string|null, ambiguous: boolean, rawExpression: string }}
 */
export function resolveSellerModelAlias(rawMention = '') {
  const rawExpression = String(rawMention || '').trim();
  const key = rawExpression.toLowerCase().replace(/\s+/g, ' ');
  const canonical = SELLER_MODEL_ALIASES[key] || null;
  if (!canonical) {
    return { canonical: null, ambiguous: false, rawExpression };
  }
  return { canonical, ambiguous: false, rawExpression };
}

/**
 * Einzelnes Token gegen Registry (keine Katalog-Wahrheit).
 * @param {string} rawToken
 * @returns {{
 *   ok: boolean,
 *   kind: SellerAliasKind|null,
 *   canonicalId: string|null,
 *   label: string|null,
 *   field: string|null,
 *   validatePackage: boolean,
 *   validateEquipment: boolean,
 *   rawExpression: string,
 * }|null}
 */
export function resolveSellerAliasToken(rawToken = '') {
  const rawExpression = String(rawToken || '').trim();
  if (!rawExpression) return null;
  const key = normalizeAliasKey(rawExpression);
  if (!key) return null;

  for (const entry of SELLER_ALIAS_ENTRIES) {
    for (const token of entry.tokens) {
      if (normalizeAliasKey(token) === key) {
        return {
          ok: true,
          kind: entry.kind,
          canonicalId: entry.canonicalId,
          label: entry.label,
          field: entry.field || null,
          validatePackage: entry.validatePackage === true,
          validateEquipment: entry.validateEquipment === true,
          rawExpression,
        };
      }
    }
  }
  return null;
}

/**
 * Findet Alias-Treffer im Text (längere Tokens zuerst, keine Überlappung).
 * @param {string} text
 * @returns {Array<{
 *   start: number,
 *   end: number,
 *   matched: string,
 *   kind: SellerAliasKind,
 *   canonicalId: string|null,
 *   label: string,
 *   field: string|null,
 *   validatePackage: boolean,
 *   validateEquipment: boolean,
 * }>}
 */
export function findSellerAliasesInText(text = '') {
  const raw = String(text || '');
  if (!raw.trim()) return [];

  /** @type {Array<{ token: string, entry: SellerAliasEntry }>} */
  const flat = [];
  for (const entry of SELLER_ALIAS_ENTRIES) {
    for (const token of entry.tokens) {
      flat.push({ token, entry });
    }
  }
  flat.sort((a, b) => b.token.length - a.token.length);

  const occupied = [];
  const hits = [];

  for (const { token, entry } of flat) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const re = new RegExp(`(?:^|[^A-Za-zÄÖÜäöüß0-9])(${escaped})(?![A-Za-zÄÖÜäöüß0-9])`, 'gi');
    let m = re.exec(raw);
    while (m) {
      const matched = m[1];
      const start = m.index + (m[0].length - matched.length);
      const end = start + matched.length;
      const overlaps = occupied.some((r) => start < r.end && end > r.start);
      if (!overlaps) {
        occupied.push({ start, end });
        hits.push({
          start,
          end,
          matched,
          kind: entry.kind,
          canonicalId: entry.canonicalId,
          label: entry.label,
          field: entry.field || null,
          validatePackage: entry.validatePackage === true,
          validateEquipment: entry.validateEquipment === true,
        });
      }
      m = re.exec(raw);
    }
  }

  return hits.sort((a, b) => a.start - b.start);
}

/**
 * Leistungsangabe „229 PS“ / „168 kW“ aus Text.
 * @param {string} text
 * @returns {Array<{ raw: string, unit: 'ps'|'kw', value: number, start: number, end: number }>}
 */
export function findSellerPowerMentions(text = '') {
  const raw = String(text || '');
  const out = [];
  const re = /\b(\d{2,4}(?:[.,]\d+)?)\s*(ps|kw)\b/gi;
  let m = re.exec(raw);
  while (m) {
    const value = Number(String(m[1]).replace(',', '.'));
    if (Number.isFinite(value) && value > 0) {
      out.push({
        raw: m[0],
        unit: String(m[2]).toLowerCase() === 'kw' ? 'kw' : 'ps',
        value,
        start: m.index,
        end: m.index + m[0].length,
      });
    }
    m = re.exec(raw);
  }
  return out;
}

/**
 * Verkäufer-Commercial-Kurzform: „48/15“ und „3k“.
 * Keine generische Slash-Sprache – nur bekannte Konditions-Shorthand.
 *
 * @param {string} text
 * @returns {{
 *   termMonths: number|null,
 *   annualMileage: number|null,
 *   downPayment: number|null,
 *   evidence: string[],
 * }}
 */
export function parseSellerCommercialAliasShorthand(text = '') {
  const raw = String(text || '');
  const evidence = [];
  let termMonths = null;
  let annualMileage = null;
  let downPayment = null;

  const vehicleCue = /\b(?:ev\s*\d|sportage|picanto|xceed|ceed|niro|sorento|soul|leasing|leasen|finanz|air|earth|vision|gt|elektro|wp|ahk|win)\b/i.test(raw)
    || /\b\d{2,4}\s*ps\b/i.test(raw);

  // „48/15“ oder „48 / 15“ → 48 Monate · 15.000 km (zweite Zahl als Tausender wenn ≤ 80)
  const slash = raw.match(/\b(\d{2})\s*\/\s*(\d{1,2})\b/);
  if (slash && vehicleCue) {
    const months = Number(slash[1]);
    const second = Number(slash[2]);
    if (months >= 12 && months <= 72) {
      termMonths = months;
      evidence.push(slash[0]);
    }
    if (second >= 5 && second <= 80) {
      annualMileage = second * 1000;
      evidence.push(slash[0]);
    }
  }

  // „3k“ / „3K“ → 3000 € AZ-Kandidat (nur mit Fahrzeug-/Konditionskontext, kein Rate-Cue)
  if (vehicleCue && !/\b(?:rate|mtl|monatlich|max|wunschrate)\b/i.test(raw)) {
    const kMatch = raw.match(/\b(\d{1,3})\s*k\b/i);
    if (kMatch) {
      const n = Number(kMatch[1]);
      if (Number.isFinite(n) && n >= 1 && n <= 80) {
        downPayment = n * 1000;
        evidence.push(kMatch[0]);
      }
    }
  }

  return { termMonths, annualMileage, downPayment, evidence };
}
