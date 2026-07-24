/**
 * Stichwort-Vorschläge & Anfrage-Organisation für den Akten-Notizzettel.
 * Labels bleiben Darstellung – Wahrheit weiter über sellerInsights / needProfile.
 */
import { HANDOFF_EQUIPMENT_CHIPS } from '../consultation/wishHandoffEquipment.js';
import { proposeSellerInsightLabels } from './sellerInsights.js';

/** Extra-Aliase für Tippen (Sitzh → Sitzheizung). */
const KEYWORD_ALIASES = [
  { aliases: ['sitzh', 'sitzheiz'], labels: ['Sitzheizung'] },
  { aliases: ['sitzheizung hint'], labels: ['Sitzheizung hinten'] },
  { aliases: ['parksenso', 'parksensor', 'pdc'], labels: ['Parksensoren vorne', 'Parksensoren hinten'] },
  { aliases: ['heckkl', 'heckklappe', 'power tailgate'], labels: ['Elektrische Heckklappe'] },
  { aliases: ['lenkradh', 'lenkradheiz'], labels: ['Lenkradheizung'] },
  { aliases: ['rueckfahr', 'rückfahr', 'kamera hint'], labels: ['Rückfahrkamera'] },
  { aliases: ['360', 'rundumsicht'], labels: ['360° Kamera'] },
  { aliases: ['ahk', 'anhaenger', 'anhänger'], labels: ['Anhängerkupplung'] },
  { aliases: ['panorama', 'schiebedach'], labels: ['Panoramadach'] },
  { aliases: ['keyless', 'smartkey', 'smart-key'], labels: ['Keyless'] },
  { aliases: ['waermepumpe', 'wärmepumpe'], labels: ['Wärmepumpe'] },
  { aliases: ['hud', 'head-up', 'headup'], labels: ['Head-up-Display'] },
  { aliases: ['totwinkel', 'blindspot'], labels: ['Totwinkelassistent'] },
  { aliases: ['spurhalt', 'lane'], labels: ['Spurhalteassistent'] },
  { aliases: ['abstandstemp', 'acc'], labels: ['Abstandstempomat'] },
];

/** Häufige Konditionen / Kontext aus E-Mail-Anfragen. */
const INQUIRY_PATTERNS = [
  {
    re: /(?:max(?:imal)?|bis(?:\s+zu)?|unter)\s*(\d{2,4})\s*(?:€|euro)\s*(?:\/\s*monat|im\s+monat|monatlich)/i,
    label: (m) => `Budget bis ${m[1]} €`,
  },
  {
    re: /(\d{2,4})\s*(?:€|euro)\s*(?:\/\s*monat|im\s+monat|monatlich)/i,
    label: (m) => `Budget bis ${m[1]} €`,
  },
  {
    re: /(?:^|[^\d])0\s*(?:€|euro)?\s*anzahlung\b|ohne\s+anzahlung|keine\s+anzahlung/i,
    label: () => '0 € Anzahlung',
  },
  {
    re: /ohne\s+(?:bafa|foerderung|förderung)|keine\s+(?:bafa|foerderung|förderung)/i,
    label: () => 'Ohne BAFA',
  },
  {
    re: /\bgebrauchtwagen\b|\bvorführwagen\b|\bvorfuehrwagen\b|\bjahreswagen\b|gebraucht(?:wagen)?\s+(?:wäre|waere|ok|möglich|moeglich)/i,
    label: () => 'Gebraucht / Vorführ OK',
  },
  {
    re: /firmen(?:zulassung|wagen)|gewerbe|geschäftlich|geschaeftlich/i,
    label: () => 'Firmenzulassung',
  },
  {
    re: /parksensor(?:en)?\s+(?:vorne\s+und\s+hinten|vorn\s+und\s+hinten|v\/h)/i,
    labels: () => ['Parksensoren vorne', 'Parksensoren hinten'],
  },
  {
    re: /parksensor(?:en)?\s+vorne|pdc\s+vorne/i,
    label: () => 'Parksensoren vorne',
  },
  {
    re: /parksensor(?:en)?\s+hinten|pdc\s+hinten/i,
    label: () => 'Parksensoren hinten',
  },
];

function normalizeKey(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9°]+/g, ' ')
    .trim();
}

function catalogEntries() {
  const fromChips = HANDOFF_EQUIPMENT_CHIPS.map((chip) => ({
    label: chip.label,
    keys: [normalizeKey(chip.label)],
  }));

  const fromAliases = KEYWORD_ALIASES.flatMap((entry) => entry.labels.map((label) => ({
    label,
    keys: entry.aliases.map(normalizeKey),
  })));

  const byLabel = new Map();
  for (const entry of [...fromChips, ...fromAliases]) {
    const prev = byLabel.get(entry.label) ?? { label: entry.label, keys: [] };
    prev.keys = [...new Set([...prev.keys, ...entry.keys])];
    byLabel.set(entry.label, prev);
  }
  return [...byLabel.values()];
}

const CATALOG = catalogEntries();

/**
 * Letztes Stichwort im Entwurf (nach Leerzeichen / Komma / Zeile).
 * @param {string} text
 * @returns {string}
 */
export function extractLastNotepadKeyword(text = '') {
  const trimmed = String(text ?? '');
  const match = trimmed.match(/(?:^|[\s,;/\n\r(])([^\s,;/\n\r)]+)$/);
  return String(match?.[1] ?? '').trim();
}

/**
 * Stichwort → Vorschläge (Sitzh → Sitzheizung).
 * @param {string} query
 * @param {{ limit?: number, exclude?: string[] }} [options]
 * @returns {string[]}
 */
export function suggestNotepadLabels(query = '', options = {}) {
  const q = normalizeKey(query);
  if (q.length < 3) return [];

  const exclude = new Set((options.exclude ?? []).map((label) => normalizeKey(label)));
  const limit = Math.max(1, Math.min(12, Number(options.limit) || 6));
  const scored = [];

  for (const entry of CATALOG) {
    if (exclude.has(normalizeKey(entry.label))) continue;
    let score = 0;
    for (const key of entry.keys) {
      if (!key) continue;
      if (key === q) score = Math.max(score, 100);
      else if (key.startsWith(q)) score = Math.max(score, 80 - Math.min(20, key.length - q.length));
      else if (q.length >= 4 && key.includes(q)) score = Math.max(score, 40);
      else {
        const words = key.split(' ');
        if (words.some((word) => word.startsWith(q))) {
          score = Math.max(score, 70);
        }
      }
    }
    if (score > 0) scored.push({ label: entry.label, score });
  }

  // Alias-Gruppen: bei „parksenso“ beide Sensor-Labels hoch priorisieren
  for (const aliasEntry of KEYWORD_ALIASES) {
    const hit = aliasEntry.aliases.some((alias) => {
      const key = normalizeKey(alias);
      return key.startsWith(q) || q.startsWith(key) || (q.length >= 4 && key.includes(q));
    });
    if (!hit) continue;
    for (const label of aliasEntry.labels) {
      if (exclude.has(normalizeKey(label))) continue;
      const existing = scored.find((item) => item.label === label);
      if (existing) existing.score = Math.max(existing.score, 95);
      else scored.push({ label, score: 95 });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'de'))
    .slice(0, limit)
    .map((item) => item.label);
}

function pushUnique(list, label) {
  const trimmed = String(label ?? '').trim();
  if (!trimmed) return;
  const key = normalizeKey(trimmed);
  if (list.some((item) => normalizeKey(item) === key)) return;
  list.push(trimmed);
}

/**
 * Anzahlung nicht als Monatsbudget lesen; 0-€-Anzahlung nicht aus „2000 €“.
 * @param {string} text
 * @param {string[]} labels
 */
function refineOrganizedLabels(text, labels) {
  const raw = String(text ?? '');
  const hasMonthlyCue = /monatlich|€\s*\/\s*monat|euro\s*(?:im\s+)?monat|wunschrate|rate\s+bis/i.test(raw);
  const downMatch = raw.match(/(\d{1,3}(?:\.\d{3})+|\d{3,5})\s*(?:€|euro)\s*anzahlung/i);
  const downAmount = downMatch
    ? Number(String(downMatch[1]).replace(/\./g, ''))
    : null;

  return labels.filter((label) => {
    const budgetMatch = label.match(/^Budget bis\s+([\d.]+)\s*€(?:\/Monat)?$/i);
    if (budgetMatch) {
      const amount = Number(String(budgetMatch[1]).replace(/\./g, ''));
      if (!hasMonthlyCue && downAmount != null && amount === downAmount) return false;
      if (!hasMonthlyCue && /\/\s*Monat/i.test(label) && downAmount != null) return false;
    }
    if (/^0\s*€\s*Anzahlung$/i.test(label) && downAmount != null && downAmount > 0) return false;
    return true;
  });
}

/**
 * Ausstattung aus Freitext (volle Labels / Teilworte).
 * @param {string} text
 * @returns {string[]}
 */
export function scanEquipmentLabelsInText(text = '') {
  const blob = normalizeKey(text);
  if (!blob) return [];
  const found = [];
  for (const entry of CATALOG) {
    const labelKey = normalizeKey(entry.label);
    if (labelKey && blob.includes(labelKey)) {
      pushUnique(found, entry.label);
      continue;
    }
    // mind. ein signifikantes Wort (≥5) aus dem Label
    const words = labelKey.split(' ').filter((word) => word.length >= 5);
    if (words.length && words.every((word) => blob.includes(word))) {
      pushUnique(found, entry.label);
    }
  }
  return found;
}

/**
 * E-Mail / Anfrage → organisierte Chip-Vorschläge (VK bestätigt).
 * @param {string} text
 * @returns {string[]}
 */
export function organizeInquiryText(text = '') {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return [];

  const labels = [];
  for (const label of proposeSellerInsightLabels(trimmed)) {
    pushUnique(labels, label);
  }
  for (const label of scanEquipmentLabelsInText(trimmed)) {
    pushUnique(labels, label);
  }
  for (const pattern of INQUIRY_PATTERNS) {
    const match = trimmed.match(pattern.re);
    if (!match) continue;
    if (typeof pattern.labels === 'function') {
      for (const label of pattern.labels(match)) pushUnique(labels, label);
    } else if (typeof pattern.label === 'function') {
      pushUnique(labels, pattern.label(match));
    }
  }
  return refineOrganizedLabels(trimmed, labels);
}
