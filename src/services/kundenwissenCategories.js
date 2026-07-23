import { parseKundenhelferNotes } from './cleverKundenhelfer.js';
import { computeUnterlagenSummary } from './cleverUnterlagen.js';
import { buildCustomerUnderstanding } from './dealer/customerUnderstanding.js';

export const KUNDENWISSEN_CATEGORY_ORDER = [
  'familie',
  'auto',
  'geld',
  'kommunikation',
  'vorlieben',
  'hobby',
  'unterlagen',
  'sonstiges',
];

export const KUNDENWISSEN_CATEGORIES = {
  familie: {
    id: 'familie',
    label: 'Familie',
    icon: '👨‍👩‍👧',
    keywords: [
      'kinder', 'kind', 'hund', 'partner', 'verheiratet', 'ehefrau', 'familie',
      'isofix', 'kindersitz', 'ehemann', 'katze', 'haustier',
    ],
  },
  auto: {
    id: 'auto',
    label: 'Auto',
    icon: '🚗',
    keywords: [
      'auto', 'fährt', 'xceed', 'ev2', 'ev3', 'ev4', 'ev5', 'ev6', 'ev9', 'sportage',
      'elektro', 'benziner', 'diesel', 'wohnwagen', 'anhänger', 'ahk', 'stützlast',
      'kofferraum', 'rote autos', 'reichweite', 'probefahrt', 'ersatzfahrzeug',
      'unfall', 'inzahlungnahme', 'gebrauchtwagen', 'fahrzeug',
    ],
  },
  geld: {
    id: 'geld',
    label: 'Geld',
    icon: '💶',
    keywords: [
      'budget', 'rate', 'einkommen', 'verdient', 'finanzierung', 'leasing', 'bar',
      'anzahlung', 'kredit', 'bonität', 'gewerbekunde', 'preis', '€', 'gehalt',
    ],
  },
  kommunikation: {
    id: 'kommunikation',
    label: 'Kommunikation',
    icon: '💬',
    keywords: [
      'whatsapp', 'telefon', 'rückruf', 'e-mail', 'email', 'erreichbar', 'später',
      'vormittags', 'nachmittags', 'melden', 'bevorzugt', 'anruf', 'kontakt',
    ],
  },
  vorlieben: {
    id: 'vorlieben',
    label: 'Vorlieben',
    icon: '☕',
    keywords: [
      'kaffee', 'wasser', 'farbe', 'mag', 'bevorzugt', 'lieblingsfarbe', 'komfort',
      'dunkle autos', 'milch', 'getränk',
    ],
  },
  hobby: {
    id: 'hobby',
    label: 'Hobby',
    icon: '⛳',
    keywords: [
      'musik', 'pferd', 'golf', 'camping', 'fahrrad', 'sport', 'reisen', 'motorrad',
      'wohnmobil', 'angeln', 'tennis',
    ],
  },
  unterlagen: {
    id: 'unterlagen',
    label: 'Unterlagen',
    icon: '📄',
    keywords: [
      'ausweis', 'gehalt', 'gehaltsnachweis', 'selbstauskunft', 'bank', 'führerschein',
      'zulassung', 'dokument', 'unterlagen', 'iban', 'sepa',
    ],
  },
  sonstiges: {
    id: 'sonstiges',
    label: 'Sonstiges',
    icon: '···',
    keywords: [],
  },
};

const UNTERLAGEN_DONE = new Set(['uploaded', 'checked', 'replaced', 'not_needed']);

const SENSITIVE_PATTERNS = [
  /einkommen/i,
  /verdient/i,
  /gehalt/i,
  /bonität/i,
  /\d[\d.,\s]*€/,
];

export function isSensitiveKundenwissenChip(chip = '') {
  const text = String(chip).trim();
  if (!text) return false;
  if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(text))) {
    if (/budget/i.test(text) && !/\d/.test(text)) return false;
    return true;
  }
  return false;
}

export function formatKundenwissenDisplayLabel(chip = '', { maskSensitive = true } = {}) {
  const text = String(chip).trim();
  if (!text) return '';
  if (maskSensitive && isSensitiveKundenwissenChip(text)) {
    if (/einkommen|verdient|gehalt/i.test(text)) return 'Einkommen hinterlegt';
    if (/bonität/i.test(text)) return 'Bonität hinterlegt';
    return 'Finanzinfo hinterlegt';
  }
  return text;
}

export function categorizeKundenhelferChip(chip = '', chipCategories = {}) {
  const text = String(chip).trim();
  if (chipCategories[text]) return chipCategories[text];

  const lower = text.toLowerCase();
  if (!lower) return 'sonstiges';

  let bestId = 'sonstiges';
  let bestScore = 0;

  for (const catId of KUNDENWISSEN_CATEGORY_ORDER) {
    if (catId === 'sonstiges') continue;
    const keywords = KUNDENWISSEN_CATEGORIES[catId].keywords;
    for (const keyword of keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        const score = keyword.length;
        if (score > bestScore) {
          bestScore = score;
          bestId = catId;
        }
      }
    }
  }

  return bestId;
}

export function suggestKundenwissenCategory(text = '') {
  return categorizeKundenhelferChip(text);
}

export function buildUnterlagenKundenwissenItems(lead = null) {
  if (!lead) return [];
  const paymentType = lead.paymentType ?? lead.wish?.paymentType ?? 'leasing';
  const summary = computeUnterlagenSummary(lead, paymentType);
  const items = [];

  for (const slot of summary.slots) {
    if (slot.optional && summary.items[slot.id]?.status === 'not_needed') continue;
    const status = summary.items[slot.id]?.status ?? 'open';
    if (UNTERLAGEN_DONE.has(status)) continue;
    items.push({
      raw: `unterlagen:${slot.id}`,
      display: `${slot.label} offen`,
      fromUnterlagen: true,
      readOnly: true,
    });
  }

  return items;
}

function emptyGroups() {
  return Object.fromEntries(
    KUNDENWISSEN_CATEGORY_ORDER.map((id) => [id, []]),
  );
}

/**
 * Gruppiert Kundenhelfer-Chips.
 * Offene Unterlagen-Slots erscheinen hier nicht mehr (Ordner in der Action-Bar).
 * @param {string} notes
 * @param {object|null} lead
 * @param {object} chipCategories
 * @param {{ includeUnterlagen?: boolean }} [options] – nur noch für Legacy-Tests; Standard ohne Unterlagen-Slots
 * @returns {Array<{ id, label, icon, count, items }>}
 */
export function buildKundenwissenOverview(notes = '', lead = null, chipCategories = {}, options = {}) {
  const includeUnterlagen = options.includeUnterlagen === true;
  const groups = emptyGroups();
  const understanding = lead ? buildCustomerUnderstanding(lead) : null;
  const chips = understanding?.verstaendnis?.labels?.length
    ? [...understanding.verstaendnis.labels]
    : parseKundenhelferNotes(notes);

  for (const chip of chips) {
    const categoryId = categorizeKundenhelferChip(chip, chipCategories);
    groups[categoryId].push({
      raw: chip,
      display: formatKundenwissenDisplayLabel(chip),
      sensitive: isSensitiveKundenwissenChip(chip),
      fromUnterlagen: false,
      readOnly: false,
    });
  }

  if (includeUnterlagen) {
    for (const item of buildUnterlagenKundenwissenItems(lead)) {
      const exists = groups.unterlagen.some((entry) => entry.raw === item.raw);
      if (!exists) groups.unterlagen.push(item);
    }
  }

  return KUNDENWISSEN_CATEGORY_ORDER
    .map((id) => ({
      ...KUNDENWISSEN_CATEGORIES[id],
      count: groups[id].length,
      items: groups[id],
    }))
    .filter((category) => category.count > 0);
}

export function getKundenwissenCategory(categoryId) {
  return KUNDENWISSEN_CATEGORIES[categoryId] ?? KUNDENWISSEN_CATEGORIES.sonstiges;
}

export function getPredefinedChipsForCategory(categoryId, predefinedChips = []) {
  return predefinedChips.filter(
    (chip) => categorizeKundenhelferChip(chip) === categoryId,
  );
}

export function countKundenwissenItems(notes = '', lead = null, chipCategories = {}) {
  return buildKundenwissenOverview(notes, lead, chipCategories).reduce(
    (sum, cat) => sum + cat.count,
    0,
  );
}

export function sanitizeKundenhelferChipCategories(categories = {}, notes = '') {
  const chips = new Set(parseKundenhelferNotes(notes));
  const next = {};
  for (const [chip, categoryId] of Object.entries(categories ?? {})) {
    if (!chips.has(chip)) continue;
    if (KUNDENWISSEN_CATEGORIES[categoryId]) next[chip] = categoryId;
  }
  return next;
}
