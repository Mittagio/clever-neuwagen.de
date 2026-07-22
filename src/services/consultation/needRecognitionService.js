/**
 * Need Recognition – Freitext in semantische Wünsche übersetzen.
 * Erkannte Wünsche landen im NeedProfile und erscheinen als sichtbare Chips.
 */
import { parseSearchIntent } from '../search/searchIntentParser.js';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';

const EQUIPMENT_WISH_IDS = new Set([
  'heat_pump',
  'camera_360',
  'head_up_display',
  'towbar',
  'matrix_led',
  'v2l',
  'tinting',
  'panorama_roof',
  'heated_seats',
  'rear_seat_heat',
  'power_tailgate',
  'large_navi',
  'large_trunk',
]);

const EQUIPMENT_LABELS = {
  heat_pump: 'Wärmepumpe',
  camera_360: '360° Kamera',
  head_up_display: 'Head-up-Display',
  towbar: 'Anhängerkupplung',
  matrix_led: 'Matrix-LED',
  v2l: 'V2L',
  tinting: 'Tönung',
  panorama_roof: 'Panorama',
  heated_seats: 'Sitzheizung',
  rear_seat_heat: 'Sitzheizung hinten',
  power_tailgate: 'Elektrische Heckklappe',
  large_navi: 'Großes Navi',
  large_trunk: 'Kofferraum wichtig',
};

const TRIM_LABELS = {
  spirit: 'Spirit',
  vision: 'Vision',
  'gt-line': 'GT-Line',
  earth: 'Earth',
  air: 'Air',
  platinum: 'Platinum',
};

const COLOR_PATTERNS = [
  { test: /\bgrün\b|\bgruen\b/i, label: 'Grün' },
  { test: /\bwolfsgrau\b/i, label: 'Wolfsgrau' },
  { test: /\bschwarz\b/i, label: 'Schwarz' },
  { test: /\bweiß\b|\bweiss\b/i, label: 'Weiß' },
  { test: /\bblau\b/i, label: 'Blau' },
  { test: /\brot\b/i, label: 'Rot' },
  { test: /\bgrau\b/i, label: 'Grau' },
  { test: /\bsilber\b/i, label: 'Silber' },
];

const MODEL_INTEREST_RULES = [
  { key: 'ev2', pattern: /\bev\s*2\b/i, label: 'EV2' },
  { key: 'ev3', pattern: /\bev\s*3\b/i, label: 'EV3' },
  { key: 'ev4', pattern: /\bev\s*4\b/i, label: 'EV4' },
  { key: 'ev5', pattern: /\bev\s*5\b/i, label: 'EV5' },
  { key: 'ev6', pattern: /\bev\s*6\b/i, label: 'EV6' },
  { key: 'ev9', pattern: /\bev\s*9\b/i, label: 'EV9' },
  { key: 'sportage', pattern: /\bsportage\b/i, label: 'Sportage' },
  { key: 'ceed', pattern: /\bceed\b/i, label: 'Ceed' },
  { key: 'niro', pattern: /\bniro\b/i, label: 'Niro' },
  { key: 'picanto', pattern: /\bpicanto\b/i, label: 'Picanto' },
  { key: 'sorento', pattern: /\bsorento\b/i, label: 'Sorento' },
];

const MONTH_NAMES = [
  'januar', 'februar', 'märz', 'maerz', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'dezember',
];

const SEASON_NAMES = ['frühjahr', 'fruehjahr', 'sommer', 'herbst', 'winter'];

const MODEL_HINT_LABELS = {
  sportage: 'Sportage',
  sorento: 'Sorento',
  ceed: 'Ceed',
  niro: 'Niro',
  picanto: 'Picanto',
  ev2: 'EV2',
  ev3: 'EV3',
  ev4: 'EV4',
  ev5: 'EV5',
  ev6: 'EV6',
  ev9: 'EV9',
};

const BODY_LABELS = {
  suv: 'SUV',
  kleinwagen: 'Kleinwagen',
  kombi: 'Kombi',
  limousine: 'Limousine',
  van: 'Van',
  pickup: 'Pickup',
};

const FUEL_LABELS = {
  electric: 'Elektro',
  elektro: 'Elektro',
  hybrid: 'Hybrid',
  phev: 'Plug-in-Hybrid',
  benzin: 'Benzin',
  verbrenner: 'Benzin',
  diesel: 'Diesel',
};

const USAGE_LABELS = {
  zugfahrzeug: 'Zugfahrzeug',
  zweitwagen: 'Zweitwagen',
  erstwagen: 'Erstwagen',
  stadt: 'Stadt',
  kurzstrecke: 'Kurzstrecke',
  langstrecke: 'Langstrecke',
  urlaub: 'Urlaub',
  wohnwagen: 'Wohnwagen',
  pferdeanhänger: 'Pferdeanhänger',
  boot: 'Boot',
  pendler: 'Pendler',
  dachzelt: 'Dachzelt',
  dachbox: 'Dachbox',
  familie: 'Familie',
  stadtverkehr: 'Stadtverkehr',
};

const DRIVER_LABELS = {
  frau: 'Fahrerin',
  frau_main: 'Hauptfahrerin',
  sohn: 'Sohn',
  tochter: 'Tochter',
};

const PAYMENT_LABELS = {
  leasing: 'Leasing',
  finance: 'Finanzierung',
  cash: 'Kauf',
};

function pushUnique(list = [], item) {
  if (!item || list.includes(item)) return list;
  return [...list, item];
}

function mergeOrderedSections(...sections) {
  const out = [];
  const seen = new Set();
  for (const section of sections) {
    for (const label of section) {
      if (!label || seen.has(label)) continue;
      seen.add(label);
      out.push(label);
    }
  }
  return out;
}

function modelDisplayLabel(modelKey = '') {
  if (!modelKey) return '';
  return KIA_MODEL_ATTRIBUTES[modelKey]?.label ?? modelKey.toUpperCase();
}

function formatTowCapacityLabel(kg) {
  if (!kg || kg <= 0) return null;
  return `Anhängelast ${Number(kg).toLocaleString('de-DE')} kg`;
}

function normalizeModelHint(model) {
  if (!model) return null;
  const key = String(model).toLowerCase().replace(/\s+/g, '');
  if (MODEL_HINT_LABELS[key]) return key;
  if (key.startsWith('sportage')) return 'sportage';
  if (key.startsWith('sorento')) return 'sorento';
  if (key.startsWith('ceed')) return 'ceed';
  if (key.startsWith('niro')) return 'niro';
  if (key.startsWith('picanto')) return 'picanto';
  if (key.startsWith('ev')) return key.replace(/[^a-z0-9]/g, '').slice(0, 3);
  return null;
}

/**
 * Reine Faktfragen sollen keine Wunsch-Chips erzeugen (Fakt ≠ Wunsch).
 * @param {string} text
 */
export function isLikelyFactQuestionNotWish(text = '') {
  const t = String(text ?? '').trim();
  if (!t) return false;
  const lower = t.toLowerCase();

  // Explizite Wunschsprache → kein reiner Fakt
  if (/\b(brauch|möcht|moecht|will|wünsch|wuensch|wichtig|suche|für\s+mich|für\s+uns|hätte\s+gern|haette\s+gern)\b/i.test(lower)) {
    return false;
  }

  const isQuestion = /\?\s*$/.test(t)
    || /^(wie|welche|was|wo|wann|hat|haben|gibt|ist|kann|kommt|wieviel|wie\s+viel)\b/i.test(lower);
  if (!isQuestion) return false;

  return /\b(head[- ]?up|hud|anhängelast|anhaengelast|anhängerkupplung|anhaengerkupplung|\bahk\b|wärmepumpe|waermepumpe|reichweite|wltp|batterie|sitze|laderaum|ladelänge|ladelaenge|kofferraum|dachlast|ladezeit|abmessung|matrix[- ]?led|panorama|360\s*°?\s*kamera)\b/i.test(lower);
}

function collectEquipmentWishes(intent = {}, text = '') {
  const wishes = new Set();
  const lower = String(text).toLowerCase();

  // Faktfrage ≠ Wunsch (z. B. „head up display?“ / „Anhängelast?“)
  if (isLikelyFactQuestionNotWish(text)) {
    return [];
  }

  for (const fid of intent.features ?? []) {
    if (fid === 'towbar') continue;
    if (fid === 'heated_front_seats' || fid === 'heated_seats') {
      wishes.add('heated_seats');
      continue;
    }
    if (fid === 'heated_rear_seats') {
      wishes.add('rear_seat_heat');
      continue;
    }
    if (EQUIPMENT_WISH_IDS.has(fid)) wishes.add(fid);
  }

  if (/\bwärmepumpe\b|\bwaermepumpe\b/i.test(lower)) wishes.add('heat_pump');
  if (/\b360\s*°?\s*(?:grad\s+)?kamera\b|\b360[-\s]?grad/i.test(lower) || /\b360\s*°/i.test(lower)) {
    wishes.add('camera_360');
  }
  if (/\bhead[- ]?up[- ]?display\b|\bhud\b/i.test(lower)) wishes.add('head_up_display');
  if (/\banhängerkupplung\b|\banhaengerkupplung\b|\bahk\b/i.test(lower)) wishes.add('towbar');
  if (/\bmatrix[- ]?led\b|\bmatrixlicht\b/i.test(lower)) wishes.add('matrix_led');
  if (/\bv2l\b|\bvehicle[- ]?to[- ]?load\b/i.test(lower)) wishes.add('v2l');
  if (/\btönung\b|\btoenung\b|\bscheibentönung\b|\bscheibentoenung\b|\btönungscheiben\b|\btoenungscheiben\b/i.test(lower)) wishes.add('tinting');
  if (/\bpanorama(?:dach)?\b|\bglasdach\b|\bschiebedach\b/i.test(lower)) wishes.add('panorama_roof');
  if (/\bsitzheizung\s+hinten\b|\bhinten\s+sitzheizung\b/i.test(lower)) {
    wishes.add('rear_seat_heat');
  } else if (/\bsitzheizung\b|\bbeheizte?\s+sitze\b|\bbeheizbare?\s+sitze\b/i.test(lower)) {
    wishes.add('heated_seats');
  }
  if (/\belektrische?\s+heckklappe\b|\bpower\s*tailgate\b/i.test(lower)) wishes.add('power_tailgate');
  if (/\bgroßes?\s+navi\b|\bgrosses?\s+navi\b|\bnavigationssystem\b/i.test(lower)) wishes.add('large_navi');
  if (/\bkofferraum\b.*\bwichtig\b|\bwichtig\b.*\bkofferraum\b/i.test(lower)) wishes.add('large_trunk');
  if (/\bladeraum\b.*\bwichtig\b|\bwichtig\b.*\bladeraum\b/i.test(lower)) wishes.add('large_trunk');
  if (/\bladelänge\b|\bladelange\b/i.test(lower) && /\b(brauch|wichtig|möcht|moecht|will|benötig|benoetig|transport)/i.test(lower)) {
    wishes.add('large_trunk');
  }
  if (/\b(2|zwei)\s*(m|meter)\b/i.test(lower) && /\b(transport|gegenst|lade|koffer)/i.test(lower)) {
    wishes.add('large_trunk');
  }

  return [...wishes].filter((id) => EQUIPMENT_WISH_IDS.has(id));
}

function detectUsageTags(text = '') {
  const lower = String(text).toLowerCase();
  const tags = [];

  const rules = [
    { test: /\bzugfahrzeug\b/i, tag: 'zugfahrzeug' },
    { test: /\bzweitwagen\b|\bzweit[- ]?auto\b/i, tag: 'zweitwagen' },
    { test: /\berstwagen\b|\berstes\s+auto\b/i, tag: 'erstwagen' },
    { test: /\bstadtfahrzeug\b|\bstadtauto\b|\bstadtverkehr\b|\b(stadt|innerstadt)\b/i, tag: 'stadt' },
    { test: /\bkurzstrecke\b|\bkurze\s+wege\b|\bkurze\s+strecken\b/i, tag: 'kurzstrecke' },
    { test: /\b\d{1,3}\s*km\s*(am\s+tag|pro\s+tag|täglich|taeglich|daily)\b/i, tag: 'kurzstrecke' },
    { test: /\blangstrecke\b|\blangstrecken\b|\bautobahn\b|\bviel\s+pendeln\b/i, tag: 'langstrecke' },
    { test: /\burlaub\b|\burlaubsfahrten\b/i, tag: 'urlaub' },
    { test: /\bwohnwagen\b|\bwohnanhänger\b|\bwohnanhaenger\b|\bcaravan\b/i, tag: 'wohnwagen' },
    { test: /\bpferdeanhänger\b|\bpferdeanhaenger\b|\bpferdetransport\b/i, tag: 'pferdeanhänger' },
    { test: (t) => /\bpferde?\b/i.test(t) && /\banhänger\b|\banhaenger\b/i.test(t), tag: 'pferdeanhänger' },
    { test: /\bboot\b|\bbootstrailer\b|\bbootsanhänger\b|\bbootsanhaenger\b/i, tag: 'boot' },
    { test: /\bpendler\b|\bpendeln\b|\bviel\s+pendeln\b/i, tag: 'pendler' },
    { test: /\bdachzelt\b/i, tag: 'dachzelt' },
    { test: /\bdachbox\b/i, tag: 'dachbox' },
    {
      test: /\burlaub\b.*\b(zweimal|kroatien|italien|regelmäßig|regelmaessig|spanien|österreich|oesterreich)\b|\b(zweimal|kroatien|italien)\b.*\burlaub\b/i,
      tag: 'langstrecke',
    },
    { test: /\bfamilie\b|\bfamilienauto\b/i, tag: 'familie' },
    { test: /\bstadtverkehr\b/i, tag: 'stadtverkehr' },
  ];

  for (const rule of rules) {
    const matches = typeof rule.test === 'function'
      ? rule.test(lower)
      : rule.test.test(lower);
    if (matches) tags.push(rule.tag);
  }

  return tags;
}

function detectDriverHint(text = '') {
  if (/\bdie\s+frau\b[^\n.]{0,50}\b(fährt|faellt|nutzt)\b/i.test(text)
    || /\bfrau\b[^\n.]{0,30}\b(überwiegend|ueberwiegend|hauptsächlich|hauptsaechlich)\b/i.test(text)) {
    return 'frau_main';
  }
  if (/\b(für\s+)?meine\s+frau\b|\b(für\s+)?meiner\s+frau\b|\bfahrerin\b/i.test(text)) {
    return 'frau';
  }
  if (/\b(für\s+)?meinen\s+sohn\b|\bmein\s+sohn\b/i.test(text)) return 'sohn';
  if (/\b(für\s+)?meine\s+tochter\b|\bmeine\s+tochter\b/i.test(text)) return 'tochter';
  return null;
}

function detectChildrenCount(text = '', familyHint = null) {
  if (familyHint === 'Zwei Kinder') return 2;
  if (familyHint === 'Drei Kinder') return 3;
  const m = text.match(/\b(zwei|2|drei|3|vier|4)\s*kinder\b/i);
  if (!m) return null;
  const word = m[1].toLowerCase();
  if (word === 'zwei' || word === '2') return 2;
  if (word === 'drei' || word === '3') return 3;
  if (word === 'vier' || word === '4') return 4;
  return true;
}

function pushExtraLabel(list = [], label) {
  if (!label || list.includes(label)) return list;
  list.push(label);
  return list;
}

function detectTimelineLabel(text = '') {
  const lower = String(text).toLowerCase();

  for (const month of MONTH_NAMES) {
    const monthLabel = month.charAt(0).toUpperCase() + month.slice(1);
    const monthRe = new RegExp(
      `(?:läuft|laeuft|ende|aus|wechsel|leasingende|fahrzeugwechsel|ablauf|rückgabe|rueckgabe)[^.]{0,40}\\b${month}\\b[^.]{0,12}(20\\d{2})`,
      'i',
    );
    const monthMatch = lower.match(monthRe);
    if (monthMatch) {
      return `Fahrzeugwechsel ${monthLabel} ${monthMatch[1]}`;
    }
  }

  for (const season of SEASON_NAMES) {
    const seasonLabel = season.charAt(0).toUpperCase() + season.slice(1);
    const seasonWithYear = new RegExp(
      `(?:fahrzeugwechsel|wechsel|leasing\\s+endet|leasingende)[^.]{0,20}\\b${season}\\b[^.]{0,12}(20\\d{2})`,
      'i',
    );
    const seasonMatch = lower.match(seasonWithYear);
    if (seasonMatch) {
      return `Fahrzeugwechsel ${seasonLabel} ${seasonMatch[1]}`;
    }
    const seasonOnly = new RegExp(
      `(?:leasing\\s+endet|leasingende|fahrzeugwechsel|wechsel)[^.]{0,20}\\b(im\\s+)?${season}\\b`,
      'i',
    );
    if (seasonOnly.test(lower)) {
      return `Fahrzeugwechsel ${seasonLabel}`;
    }
  }

  if (/\bleasing\s+läuft\s+aus\b|\bleasing\s+laeuft\s+aus\b|\bfahrzeug\s+läuft\s+aus\b|\bfahrzeug\s+laeuft\s+aus\b/i.test(lower)) {
    return 'Fahrzeug läuft aus';
  }
  if (/\bfahrzeugwechsel\s+geplant\b|\bwechsel\s+geplant\b/i.test(lower)) {
    return 'Fahrzeugwechsel geplant';
  }
  if (/\baktuell(?:es)?\s+fahrzeug\b.*\bläuft\b|\bläuft\b.*\baktuell(?:es)?\s+fahrzeug\b/i.test(lower)) {
    return 'Aktuelles Fahrzeug läuft aus';
  }

  return null;
}

function formatKgShort(kg) {
  if (kg >= 1000 && kg % 1000 === 0) return `${kg / 1000} t`;
  if (kg >= 1000) {
    const tons = kg / 1000;
    return `${String(tons).replace('.', ',')} t`;
  }
  return `${kg} kg`;
}

/**
 * Range-Angaben zur Anhängelast – Unsicherheit erhalten.
 * @param {string} text
 * @returns {{ minKg: number, maxKg: number, label: string } | null}
 */
export function detectTowCapacityRange(text = '') {
  const lower = String(text ?? '').toLowerCase();
  if (!/anhäng|anhaeng|ziehen|zuglast|kupplung|wohnwagen|wohnanh/i.test(lower)) return null;

  const betweenKg = lower.match(
    /(?:zwischen|irgendwo\s+zwischen)\s*(\d{3,5})\s*(?:kg)?\s*(?:und|bis|-|–)\s*(\d{3,5})\s*kg/,
  );
  if (betweenKg) {
    const minKg = Number(betweenKg[1]);
    const maxKg = Number(betweenKg[2]);
    return {
      minKg,
      maxKg,
      label: `Anhängelast: ca. ${formatKgShort(minKg)}–${formatKgShort(maxKg)}`,
    };
  }

  const betweenMixed = lower.match(
    /(?:zwischen|irgendwo\s+zwischen)\s*(\d{3,5})\s*kg\s*(?:und|bis|-|–)\s*(\d+(?:[.,]\d+)?)\s*(?:t|tonnen?)/,
  );
  if (betweenMixed) {
    const minKg = Number(betweenMixed[1]);
    const maxKg = Math.round(Number(betweenMixed[2].replace(',', '.')) * 1000);
    return {
      minKg,
      maxKg,
      label: `Anhängelast: ca. ${formatKgShort(minKg)}–${formatKgShort(maxKg)}`,
    };
  }

  const kgBisTons = lower.match(
    /(\d{3,5})\s*kg\s*(?:bis|und|-|–)\s*(?:zwei|2)\s*(?:t|tonnen?)/,
  );
  if (kgBisTons) {
    const minKg = Number(kgBisTons[1]);
    return {
      minKg,
      maxKg: 2000,
      label: `Anhängelast: ca. ${formatKgShort(minKg)}–2 t`,
    };
  }

  const tonsRange = lower.match(
    /(\d+(?:[.,]\d+)?)\s*(?:t|tonnen?)\s*(?:bis|und|-|–)\s*(\d+(?:[.,]\d+)?)\s*(?:t|tonnen?)/,
  );
  if (tonsRange) {
    const minKg = Math.round(Number(tonsRange[1].replace(',', '.')) * 1000);
    const maxKg = Math.round(Number(tonsRange[2].replace(',', '.')) * 1000);
    return {
      minKg,
      maxKg,
      label: `Anhängelast: ca. ${formatKgShort(minKg)}–${formatKgShort(maxKg)}`,
    };
  }

  return null;
}

/**
 * Farbalternativen als ein Chip – keine Einzelfarb-Entscheidung.
 * @param {string} text
 */
export function detectColorAlternativeLabel(text = '') {
  const lower = String(text ?? '').toLowerCase();
  const found = [];
  for (const entry of COLOR_PATTERNS) {
    if (entry.test.test(lower)) found.push(entry.label);
  }
  const unique = [...new Set(found)];
  if (unique.length < 2) return null;
  if (!/\boder\b|\baber\b|\bfrau\b|\bpartner(?:in)?\b|\bmann\b|\bbeide\b/i.test(lower)) {
    return null;
  }
  return unique.slice(0, 3).join(' / ');
}

/**
 * Sprachkorrekturen: Wunsch entfernen.
 * @param {string} text
 */
export function detectWishRemovals(text = '') {
  const lower = String(text ?? '').toLowerCase();
  const labels = [];
  const equipmentWishIds = [];

  const neg = /\b(doch\s+)?nicht\b|\bkein(?:e|en)?\b|\bbrauche\s+ich\s+(doch\s+)?nicht\b|\bbrauche\s+ich\s+nicht\b|\bbrauchen\s+wir\s+nicht\b|\bweg\b|\bstreichen\b/i.test(lower);
  if (!neg) return { labels, equipmentWishIds };

  if (/\bhud\b|\bhead[- ]?up/.test(lower)) {
    equipmentWishIds.push('head_up_display');
    labels.push('Head-up-Display');
  }
  if (/\bwärmepumpe\b|\bwaermepumpe\b/.test(lower)) {
    equipmentWishIds.push('heat_pump');
    labels.push('Wärmepumpe');
  }
  if (/\bpanorama\b/.test(lower)) {
    equipmentWishIds.push('panorama_roof');
    labels.push('Panorama');
  }
  if (/\banhängerkupplung\b|\banhaengerkupplung\b|\bahk\b/.test(lower)) {
    equipmentWishIds.push('towbar');
    labels.push('Anhängerkupplung');
  }

  return { labels, equipmentWishIds };
}

/**
 * Verkäufer- und Kundensprache: Alltagsformulierungen in Labels / offene Punkte.
 * @param {string} text
 * @param {object} [intent]
 */
export function detectSellerSpeechPatterns(text = '', intent = null) {
  const trimmed = String(text ?? '').trim();
  const lower = trimmed.toLowerCase();
  const parsed = intent ?? (trimmed ? parseSearchIntent(trimmed) : {});

  const extraLabels = [];
  const openQuestions = [];
  let trimHint = null;
  let colorHint = null;
  let modelHint = null;
  let selectedModelKey = null;
  let leaseDurationMonths = parsed.durationMonths ?? null;
  let annualKm = parsed.mileagePerYear ?? null;
  let residualTakeover = false;
  let purchaseOption = false;
  let takeoverPlanned = false;

  if (/\bspirit\b/i.test(lower)) trimHint = 'spirit';
  if (/\bvision\b/i.test(lower)) trimHint = 'vision';
  if (/\bgt[- ]?line\b/i.test(lower)) trimHint = 'gt-line';
  if (/\bearth\b/i.test(lower)) trimHint = 'earth';
  if (/\bair\b/i.test(lower) && /\bev\b|\bev\d/i.test(lower)) trimHint = 'air';
  if (/\bplatinum\b/i.test(lower)) trimHint = 'platinum';

  const inColorMatch = lower.match(/\bin\s+(grün|gruen|schwarz|weiß|weiss|blau|rot|grau|wolfsgrau|silber)\b/i);
  if (inColorMatch) {
    const raw = inColorMatch[1].toLowerCase();
    colorHint = COLOR_PATTERNS.find((entry) => entry.test.test(raw))?.label ?? null;
  }

  if (!colorHint) {
    for (const color of COLOR_PATTERNS) {
      if (color.test.test(lower) && (/\bfarbe\b|\bbevorzugt\b|\btraumfarbe\b/i.test(lower))) {
        colorHint = color.label;
        break;
      }
    }
  }
  if (!colorHint) {
    for (const color of COLOR_PATTERNS) {
      if (color.test.test(lower) && /\b(in|farbe|lack)\b/i.test(lower)) {
        colorHint = color.label;
        break;
      }
    }
  }

  const timelineLabel = detectTimelineLabel(trimmed);

  const interestCtx = /\binteressiert\b|\bmöchte\b|\bmoechte\b|\bwill\b|\bwünscht\b|\bwuenscht\b|\bdenkt\s+an\b|\bfavorit\b|\boffen\s+für\b|\bnotwendig\b|\bwichtig\b/i;
  const hasStrongModelCue = interestCtx.test(lower) || parsed.modelExplicit || trimHint || colorHint;
  for (const rule of MODEL_INTEREST_RULES) {
    if (rule.pattern.test(lower) && hasStrongModelCue) {
      modelHint = rule.key;
      if (rule.key.startsWith('ev')) selectedModelKey = rule.key;
      break;
    }
  }
  if (!modelHint) {
    for (const rule of MODEL_INTEREST_RULES) {
      if (rule.pattern.test(lower)) {
        modelHint = rule.key;
        if (rule.key.startsWith('ev')) selectedModelKey = rule.key;
        break;
      }
    }
  }

  if (/\bgroße\s+batterie\b|\bgrosse\s+batterie\b|\blangstrecken[- ]?batterie\b/i.test(lower)) {
    pushExtraLabel(extraLabels, 'Große Batterie bevorzugt');
  }
  if (/\bkleine\s+batterie\b/i.test(lower) && /\bausreichend\b|\breicht\b/i.test(lower)) {
    pushExtraLabel(extraLabels, 'Kleine Batterie ausreichend');
  }

  if (/\bsportlich(?:es)?\s+design\b/i.test(lower) && /\bwichtig\b/i.test(lower)) {
    pushExtraLabel(extraLabels, 'Sportliches Design wichtig');
  }
  if ((/\boptik\b/i.test(lower) || /\bdesign\b/i.test(lower)) && /\bwichtiger\b/i.test(lower) && /\bausstattung\b/i.test(lower)) {
    pushExtraLabel(extraLabels, 'Design wichtiger als Ausstattung');
  }
  if (/\bdesign\b/i.test(lower) && /\bwichtig\b/i.test(lower)) {
    pushExtraLabel(extraLabels, 'Design wichtig');
  }
  if (/\blieferzeit\b/i.test(lower) && /\bwichtiger\b/i.test(lower) && /\brate\b/i.test(lower)) {
    pushExtraLabel(extraLabels, 'Lieferzeit wichtiger als Rate');
  }
  if (/\bpreis\b/i.test(lower) && /\bwichtiger\b/i.test(lower) && /\bausstattung\b/i.test(lower)) {
    pushExtraLabel(extraLabels, 'Preis wichtiger als Ausstattung');
  }
  if (/\brate\b/i.test(lower) && /\bwichtiger\b/i.test(lower) && /\bausstattung\b/i.test(lower)) {
    pushExtraLabel(extraLabels, 'Rate wichtiger als Ausstattung');
  }
  if (/\breichweite\b/i.test(lower) && /\bwichtig\b/i.test(lower)) {
    pushExtraLabel(extraLabels, 'Reichweite wichtig');
  }
  if (/\bsicherheit\b/i.test(lower) && /\bwichtig\b/i.test(lower)) {
    pushExtraLabel(extraLabels, 'Sicherheit wichtig');
  }
  if (/\bkomfort\b/i.test(lower) && /\bwichtig\b/i.test(lower)) {
    pushExtraLabel(extraLabels, 'Komfort wichtig');
  }
  if (/\bpreis\b/i.test(lower) && /\bwichtig\b|\bsehr\s+wichtig\b/i.test(lower)) {
    pushExtraLabel(extraLabels, 'Preis wichtig');
  }
  if (/\bbetriebskosten\b/i.test(lower) && /\bwichtig\b|\bniedrig\b/i.test(lower)) {
    pushExtraLabel(extraLabels, 'Niedrige Betriebskosten wichtig');
  }
  if (/\bwertstabilität\b|\bwertstabilitaet\b/i.test(lower) && /\bwichtig\b/i.test(lower)) {
    pushExtraLabel(extraLabels, 'Wertstabilität wichtig');
  }
  if (/\bschnell\s+verfügbar\b|\bsofort\s+verfügbar\b|\bsofort\s+verfuegbar\b/i.test(lower)) {
    pushExtraLabel(extraLabels, 'Schnell verfügbar wichtig');
  }
  if (/\burlaub\b/i.test(lower) && /\bsorgen\b|\bangst\b|\bunsicher\b/i.test(lower)) {
    openQuestions.push('Reichweitenbedenken');
  }

  if (/\bdachbox\b/i.test(lower) && /\bwichtig\b|\bnötig\b|\bnotwendig\b|\bwäre\b|\bwaere\b/i.test(lower)) {
    pushExtraLabel(extraLabels, 'Dachbox wichtig');
  }
  if (/\bsportage\b/i.test(lower) && /\bgefällt\b|\bgfaellt\b|\bbevorzugt\b|\bfavorit\b/i.test(lower)) {
    pushExtraLabel(extraLabels, 'Sportage bevorzugt');
    modelHint = modelHint ?? 'sportage';
  }
  if (/\bgt[- ]?line\b/i.test(lower) && /\bzu\s+sportlich\b/i.test(lower)) {
    pushExtraLabel(extraLabels, 'GT-Line eher nicht passend');
  }
  if (/\bspirit\b/i.test(lower) && /\breicht\b|\bausreichend\b|\bvöllig\b|\bvoellig\b/i.test(lower)) {
    pushExtraLabel(extraLabels, 'Spirit bevorzugt');
    trimHint = trimHint ?? 'spirit';
  }
  if (/\bkofferraum\b/i.test(lower) && /\bgrößer\b|\bgroesser\b|\bpositiv\b|\büberzeugt\b|\bueberzeugt\b/i.test(lower)) {
    pushExtraLabel(extraLabels, 'Kofferraum positiv bewertet');
  }
  if (/\b(ca\.?\s*)?(2|zwei)\s*(m|meter)\b/i.test(lower)
    && /\b(lade|koffer|raum|transport|lang|gegenst)/i.test(lower)) {
    pushExtraLabel(extraLabels, 'ca. 2 m Ladelänge');
  }
  if (/\b(7|sieben)\s*sitz/i.test(lower) && /\bgelegentlich\b/i.test(lower)) {
    pushExtraLabel(extraLabels, '7 Sitze gelegentlich');
  }
  if (/\bdritte\s+sitzreihe\b/i.test(lower) && /\bgelegentlich\b/i.test(lower)) {
    pushExtraLabel(extraLabels, '7 Sitze gelegentlich');
  }
  if (/\bkuga\b/i.test(lower) && (/\bläuft\b|\blaeuft\b|\baus\b|\bendet\b/i.test(lower))) {
    pushExtraLabel(extraLabels, 'Ford Kuga aktuell');
  }
  if (/\bkuga\b/i.test(lower)
    && (/\bläuft\b|\blaeuft\b|\baus\b|\bendet\b/i.test(lower))
    && (/\brestwert\b|\bübernahme\b|\buebernahme\b/i.test(lower))) {
    pushExtraLabel(extraLabels, 'Anschlussmobilität relevant');
  }

  if (/\bhybrid\b.*\belektro\b|\belektro\b.*\bhybrid\b/i.test(lower)
    && /\boffen\b|\bunsicher\b|\bschwankt\b|\bnoch\s+nicht\s+sicher\b/i.test(lower)) {
    openQuestions.push('Hybrid oder Elektro offen');
  }
  if (/\bverbrenner\b.*\belektro\b|\belektro\b.*\bverbrenner\b/i.test(lower)
    && /\boffen\b|\bunsicher\b|\bschwankt\b/i.test(lower)) {
    openQuestions.push('Verbrenner oder Elektro offen');
  }
  if ((/\bbatteriegröße\b|\bbatteriegroesse\b/i.test(lower) || /\b(kleine|große|grosse)\s+batterie\b/i.test(lower))
    && /\boffen\b|\bunklar\b|\bunsicher\b/i.test(lower)) {
    openQuestions.push('Batteriegröße offen');
  }
  if (/\bleasing\b.*\bfinanzierung\b|\bfinanzierung\b.*\bleasing\b/i.test(lower) && /\boffen\b|\bunsicher\b/i.test(lower)) {
    openQuestions.push('Leasing oder Finanzierung offen');
  }
  if (/\bev\s*3\b.*\bev\s*4\b|\bev\s*4\b.*\bev\s*3\b/i.test(lower)
    && (/\boffen\b|\bunsicher\b|\bnoch\b|\bschwankt\b|\boder\b|\bzwischen\b/i.test(lower))) {
    openQuestions.push('EV3 oder EV4 offen');
    pushExtraLabel(extraLabels, 'EV3');
    pushExtraLabel(extraLabels, 'EV4');
    modelHint = null;
    selectedModelKey = null;
  }
  if (/\bev\s*3\b.*\bev\s*6\b|\bev\s*6\b.*\bev\s*3\b/i.test(lower)
    && (/\boffen\b|\bunsicher\b|\bnoch\b|\bschwankt\b|\boder\b|\bzwischen\b/i.test(lower))) {
    openQuestions.push('EV3 oder EV6 offen');
    pushExtraLabel(extraLabels, 'EV3');
    pushExtraLabel(extraLabels, 'EV6');
    modelHint = null;
    selectedModelKey = null;
  }

  // Anhängelast-Range: Unsicherheit erhalten, kein Einzelwert erzwingen
  const towRange = detectTowCapacityRange(trimmed);
  if (towRange) {
    pushExtraLabel(extraLabels, towRange.label);
  }

  // Mehrere Farben / Alternativen
  const colorAlt = detectColorAlternativeLabel(trimmed);
  if (colorAlt) {
    pushExtraLabel(extraLabels, colorAlt);
    colorHint = null;
  }

  // Leasing-Nuance ohne harte Entscheidung
  if (/\bleasing\b/i.test(lower)
    && /\bwahrscheinlich\b|\beher\b|\bvielleicht\b|\bwäre\b|\bwaere\b|\bkönnte\b|\bkoennte\b/i.test(lower)) {
    pushExtraLabel(extraLabels, 'Leasing wahrscheinlich');
  }

  // Sprachkorrektur-Signale (werden in applyNeedRecognition angewendet)
  const removals = detectWishRemovals(trimmed);
  if (/\blieferzeit\b/i.test(lower) && /\bwichtiger\b/i.test(lower) && /\brate\b/i.test(lower)) {
    pushExtraLabel(extraLabels, 'Preis zweitrangig');
  }
  if (/\bkaufzeitpunkt\b/i.test(lower) && /\boffen\b|\bunklar\b/i.test(lower)) {
    openQuestions.push('Kaufzeitpunkt offen');
  }

  if (/\brestwertübernahme\b|\brestwertuebernahme\b|\brestwert[- ]?übernahme\b/i.test(lower)) {
    residualTakeover = true;
  }
  if (/\bkaufoption\b/i.test(lower) && /\bwünscht\b|\bgewünscht\b|\bwill\b|\boffen\b/i.test(lower)) {
    purchaseOption = true;
  }
  if (/\bübernahme\s+geplant\b|\buebernahme\s+geplant\b/i.test(lower)) {
    takeoverPlanned = true;
  }
  if (/\bbarzahlung\b|\bbar\s+zahlen\b/i.test(lower)) {
    pushExtraLabel(extraLabels, 'Barzahlung');
  }

  const termMatch = lower.match(/\b(24|36|48|60)\s*monate\b/);
  if (termMatch) leaseDurationMonths = Number(termMatch[1]);

  const kmMatch = lower.match(/\b(\d{1,2})[\.\s]?(\d{3})\s*km\b/);
  if (kmMatch) {
    const km = Number(kmMatch[1]) * 1000 + Number(kmMatch[2]);
    if (km >= 5000 && km <= 50000) annualKm = km;
  } else {
    const kmSimple = lower.match(/\b(10|15|20)\s?000\s*km\b/);
    if (kmSimple) annualKm = Number(kmSimple[1]) * 1000;
  }

  return {
    extraLabels,
    openQuestions,
    trimHint,
    colorHint,
    modelHint,
    selectedModelKey,
    leaseDurationMonths,
    annualKm,
    residualTakeover,
    purchaseOption,
    takeoverPlanned,
    timelineLabel,
    towRangePreserved: Boolean(towRange),
    softLeasing: /\bleasing\b/i.test(lower)
      && /\bwahrscheinlich\b|\beher\b|\bvielleicht\b|\bwäre\b|\bwaere\b|\bkönnte\b|\bkoennte\b/i.test(lower),
    removals,
  };
}

/**
 * @param {string} text
 * @param {object} [intent]
 */
export function recognizeWishesFromText(text = '', intent = null) {
  const trimmed = String(text ?? '').trim();
  const parsed = intent ?? (trimmed ? parseSearchIntent(trimmed) : { features: [] });
  const lower = trimmed.toLowerCase();

  const factOnly = isLikelyFactQuestionNotWish(trimmed);

  const recognized = {
    drive: null,
    allradNeed: null,
    towbar: false,
    towing: null,
    towCapacityKg: factOnly ? null : (parsed.towCapacityKg ?? null),
    equipmentWishes: [],
    transmission: parsed.transmission ?? null,
    bodyType: parsed.bodyType ?? null,
    modelHint: null,
    selectedModelKey: null,
    usageTags: factOnly ? [] : detectUsageTags(trimmed),
    driverHint: factOnly ? null : detectDriverHint(trimmed),
    childrenCount: factOnly ? null : detectChildrenCount(trimmed, parsed.familyHint),
    hasDog: factOnly ? false : /\bhund(?:e)?\b/i.test(lower),
    hasStroller: factOnly ? false : /\bkinderwagen\b/i.test(lower),
    topics: [],
  };

  if (/\ballrad\b|\b4x4\b|\bawd\b/i.test(lower)) {
    recognized.drive = 'awd';
    recognized.allradNeed = 'yes';
    recognized.topics.push('awd');
  }

  if (/\bpick[- ]?up\b/i.test(lower)) {
    recognized.bodyType = 'pickup';
    recognized.topics.push('pickup');
  }

  if (/\bsuv\b/i.test(lower) && !recognized.bodyType) {
    recognized.bodyType = 'suv';
  }

  if (/\bkombi\b/i.test(lower) && !recognized.bodyType) {
    recognized.bodyType = 'kombi';
  }

  if (/\bkleinwagen\b/i.test(lower) && !recognized.bodyType) {
    recognized.bodyType = 'kleinwagen';
  }

  if (/\bvan\b|\bbus\b/i.test(lower) && !recognized.bodyType) {
    recognized.bodyType = 'van';
  }

  if (parsed.transmission === 'automatic' || /\bautomatik\b/i.test(lower)) {
    recognized.transmission = 'automatic';
    recognized.topics.push('automatic');
  }

  if (parsed.transmission === 'manual' || /\bschalter\b|\bschaltgetriebe\b/i.test(lower)) {
    recognized.transmission = 'manual';
    recognized.topics.push('manual');
  }

  const equipmentWishes = collectEquipmentWishes(parsed, trimmed);
  if (equipmentWishes.length) {
    recognized.equipmentWishes = equipmentWishes;
    for (const wish of equipmentWishes) recognized.topics.push(wish);
  }

  if (equipmentWishes.includes('towbar')) {
    recognized.towbar = true;
    recognized.towing = recognized.towing ?? 'braked';
    recognized.topics.push('towbar');
  }

  if (recognized.usageTags.includes('zugfahrzeug') && !recognized.towing) {
    recognized.towing = recognized.towCapacityKg >= 2000 ? 'heavy' : 'braked';
    recognized.topics.push('towing');
  }

  const modelHint = normalizeModelHint(parsed.model);
  if (modelHint && parsed.modelExplicit) {
    recognized.modelHint = modelHint;
    recognized.topics.push(`model:${modelHint}`);
    if (modelHint.startsWith('ev')) {
      recognized.selectedModelKey = modelHint;
    }
  }

  if (recognized.childrenCount != null) {
    recognized.topics.push('family');
  }

  if (recognized.hasDog) recognized.topics.push('dog');
  if (recognized.hasStroller) recognized.topics.push('stroller');

  for (const tag of recognized.usageTags) {
    recognized.topics.push(`usage:${tag}`);
  }

  if (recognized.driverHint) {
    recognized.topics.push(`driver:${recognized.driverHint}`);
  }

  const speech = detectSellerSpeechPatterns(trimmed, parsed);
  if (speech.trimHint) recognized.trimHint = speech.trimHint;
  if (speech.colorHint) recognized.colorHint = speech.colorHint;
  if (speech.modelHint && !recognized.modelHint) {
    recognized.modelHint = speech.modelHint;
    if (speech.selectedModelKey) recognized.selectedModelKey = speech.selectedModelKey;
  }
  recognized.sellerSpeech = speech;

  return recognized;
}

/**
 * @param {object} profile
 * @param {string} text
 * @param {object} [intent]
 */
export function applyNeedRecognition(profile = {}, text = '', intent = null) {
  const recognition = recognizeWishesFromText(text, intent);
  const speech = recognition.sellerSpeech ?? detectSellerSpeechPatterns(text, intent);
  const next = { ...profile };

  if (recognition.drive) {
    next.drive = recognition.drive;
    next.allradNeed = recognition.allradNeed ?? next.allradNeed;
    next.priorities = pushUnique(next.priorities ?? [], 'awd');
  }

  if (recognition.bodyType) {
    next.bodyType = recognition.bodyType;
  }

  if (recognition.transmission) {
    next.transmission = recognition.transmission;
  }

  if (recognition.towbar) {
    next.towbar = true;
    next.priorities = pushUnique(next.priorities ?? [], 'towbar');
    if (!next.towing) next.towing = recognition.towing ?? 'braked';
  }

  if (recognition.towing && !next.towing) {
    next.towing = recognition.towing;
    next.priorities = pushUnique(next.priorities ?? [], 'towing');
  }

  if (speech.towRangePreserved) {
    // Range bleibt als extraLabel – kein künstlicher Mindestwert
    next.towbar = true;
    next.priorities = pushUnique(next.priorities ?? [], 'towing');
    if (!next.towing) next.towing = 'braked';
    next.towCapacityKg = null;
  } else if (recognition.towCapacityKg) {
    next.towCapacityKg = Math.max(next.towCapacityKg ?? 0, recognition.towCapacityKg);
    next.towing = next.towCapacityKg >= 2000 ? 'heavy' : (next.towing ?? 'braked');
    next.priorities = pushUnique(next.priorities ?? [], 'towing');
  }

  if (recognition.equipmentWishes.length) {
    const merged = new Set([...(next.equipmentWishes ?? []), ...recognition.equipmentWishes]);
    next.equipmentWishes = [...merged];
    if (recognition.equipmentWishes.includes('heat_pump')) {
      next.priorities = pushUnique(next.priorities ?? [], 'technology');
    }
  }

  const hasModelAlternative = (speech.openQuestions ?? []).some((q) => /EV\d oder EV\d/i.test(q));
  if (recognition.modelHint && !hasModelAlternative) {
    next.modelHint = recognition.modelHint;
    if (recognition.selectedModelKey) {
      next.selectedModelKey = recognition.selectedModelKey;
    }
  }
  if (hasModelAlternative) {
    next.selectedModelKey = null;
    next.modelHint = null;
  }

  if (recognition.usageTags.length) {
    next.usage = recognition.usageTags.reduce(
      (list, tag) => pushUnique(list, tag),
      next.usage ?? [],
    );
    if (recognition.usageTags.includes('zweitwagen') && next.bodyType === 'kleinwagen') {
      next.bodyType = null;
    }
  }

  if (recognition.driverHint) {
    next.driverHint = recognition.driverHint;
  }

  if (recognition.childrenCount != null) {
    next.children = recognition.childrenCount;
    next.priorities = pushUnique(next.priorities ?? [], 'family');
  }

  if (recognition.usageTags.includes('familie')) {
    next.priorities = pushUnique(next.priorities ?? [], 'family');
  }

  if (recognition.hasDog) {
    next.dog = true;
    next.priorities = pushUnique(next.priorities ?? [], 'space');
  }

  if (recognition.hasStroller) {
    next.priorities = pushUnique(next.priorities ?? [], 'family');
    next.usage = pushUnique(next.usage ?? [], 'kinderwagen');
  }

  // Langstrecke nur als Wunsch (usage/Label) – keine automatische Antriebs-/Nutzungsentscheidung.

  if (speech.extraLabels?.length) {
    next.extraLabels = speech.extraLabels.reduce(
      (list, label) => pushUnique(list, label),
      next.extraLabels ?? [],
    );
  }
  if (speech.openQuestions?.length) {
    next.openQuestions = speech.openQuestions.reduce(
      (list, question) => pushUnique(list, question),
      next.openQuestions ?? [],
    );
  }
  if (speech.trimHint) next.trimHint = speech.trimHint;
  if (speech.colorHint && !speech.extraLabels?.some((l) => / \/ /.test(l))) {
    next.colorHint = speech.colorHint;
  }
  if (speech.modelHint && !next.modelHint && !hasModelAlternative) {
    next.modelHint = speech.modelHint;
    if (speech.selectedModelKey) next.selectedModelKey = speech.selectedModelKey;
  }
  if (speech.leaseDurationMonths) next.leaseDurationMonths = speech.leaseDurationMonths;
  if (speech.annualKm) next.annualKm = Math.max(next.annualKm ?? 0, speech.annualKm);
  if (speech.residualTakeover) next.residualTakeover = true;
  if (speech.purchaseOption) next.purchaseOption = true;
  if (speech.takeoverPlanned) next.takeoverPlanned = true;
  if (speech.timelineLabel) next.timelineLabel = speech.timelineLabel;

  if (speech.softLeasing) {
    // Nuance als Chip – keine harte paymentExplicit-Entscheidung erzwingen
    if (next.budget?.paymentExplicit && next.budget?.paymentType === 'leasing') {
      /* behalten wenn schon explizit gesetzt */
    }
  }

  // Korrekturen: Wünsche entfernen
  if (speech.removals?.equipmentWishIds?.length) {
    next.equipmentWishes = (next.equipmentWishes ?? [])
      .filter((id) => !speech.removals.equipmentWishIds.includes(id));
  }
  if (speech.removals?.labels?.length) {
    const removeSet = new Set(speech.removals.labels.map((l) => String(l).toLowerCase()));
    next.extraLabels = (next.extraLabels ?? [])
      .filter((label) => !removeSet.has(String(label).toLowerCase()));
  }

  if (speech.extraLabels?.includes('7 Sitze gelegentlich') && (next.persons ?? 0) < 7) {
    next.persons = 7;
    next.priorities = pushUnique(next.priorities ?? [], 'family');
  }
  if (speech.extraLabels?.some((label) => /2\s*m Ladelänge|ladelänge/i.test(label))) {
    next.equipmentWishes = pushUnique(next.equipmentWishes ?? [], 'large_trunk');
    next.priorities = pushUnique(next.priorities ?? [], 'space');
  }

  if (speech.extraLabels?.includes('Sportliches Design wichtig')) {
    next.priorities = pushUnique(next.priorities ?? [], 'design');
  }
  if (speech.extraLabels?.some((label) => /lieferzeit|schnell verfügbar/i.test(label))) {
    next.priorities = pushUnique(next.priorities ?? [], 'availability');
  }
  if (speech.extraLabels?.some((label) => /preis|betriebskosten|rate wichtiger/i.test(label))) {
    next.priorities = pushUnique(next.priorities ?? [], 'budget');
  }

  next.recognizedTopics = recognition.topics.reduce(
    (list, topic) => pushUnique(list, topic),
    next.recognizedTopics ?? [],
  );

  return next;
}

export function hasEquipmentWish(profile = {}, wishId) {
  return (profile.equipmentWishes ?? []).includes(wishId);
}

export function isAwdRecognized(profile = {}) {
  return profile.drive === 'awd' || profile.allradNeed === 'yes' || profile.priorities?.includes('awd');
}

export function isTowbarRecognized(profile = {}) {
  return profile.towbar === true
    || hasEquipmentWish(profile, 'towbar')
    || profile.priorities?.includes('towbar');
}

function buildModelLabels(profile = {}) {
  const labels = [];
  if (profile.selectedModelKey) {
    const base = modelDisplayLabel(profile.selectedModelKey).replace(/^Kia\s+/i, '');
    labels.push(`${base} interessant`);
  } else if (profile.modelHint) {
    const base = MODEL_HINT_LABELS[profile.modelHint] ?? profile.modelHint;
    labels.push(`${base} interessant`);
  }
  if (profile.trimHint && TRIM_LABELS[profile.trimHint]) {
    labels.push(TRIM_LABELS[profile.trimHint]);
  }
  if (profile.colorHint) labels.push(profile.colorHint);
  return labels;
}

function buildFuelLabels(profile = {}) {
  if (!profile.fuel) return [];
  return [FUEL_LABELS[profile.fuel] ?? profile.fuel];
}

function buildVehicleTypeLabels(profile = {}) {
  const labels = [];
  const hasExplicitModel = Boolean(profile.selectedModelKey || profile.modelHint);

  if (profile.bodyType && !(hasExplicitModel && profile.bodyType === 'suv')) {
    labels.push(BODY_LABELS[profile.bodyType] ?? profile.bodyType);
  }
  if (isAwdRecognized(profile)) labels.push('Allrad');
  if (profile.transmission === 'automatic') labels.push('Automatik');
  if (profile.transmission === 'manual') labels.push('Schalter');
  return labels;
}

function buildUsageLabels(profile = {}) {
  const labels = [];

  const hasFamily = profile.priorities?.includes('family')
    || profile.children
    || (profile.persons ?? 0) >= 5;

  if (hasFamily) labels.push('Familie');

  const hasOccasional7 = (profile.extraLabels ?? []).some((label) => /7 Sitze gelegentlich/i.test(label));
  if (hasOccasional7) {
    /* Chip kommt aus extraLabels – kein doppeltes „7 Sitze“ */
  } else if ((profile.persons ?? 0) >= 7) {
    labels.push('7 Sitze');
  } else if ((profile.persons ?? 0) >= 5 && !labels.includes('Familie')) {
    labels.push(`${profile.persons} Sitze`);
  }

  if (profile.children === 2 || profile.children === '2') labels.push('2 Kinder');
  else if (profile.children === 3 || profile.children === '3') labels.push('3 Kinder');
  else if (profile.children === 4 || profile.children === '4') labels.push('4 Kinder');
  else if (profile.children && profile.children !== true) labels.push('Kinder');
  else if (profile.children === true) labels.push('Kinder');

  const primaryUsage = ['zweitwagen', 'erstwagen', 'zugfahrzeug'];
  const usage = profile.usage ?? [];

  for (const tag of usage) {
    if (primaryUsage.includes(tag) && USAGE_LABELS[tag]) {
      labels.push(USAGE_LABELS[tag]);
    }
  }

  if (profile.driverHint && DRIVER_LABELS[profile.driverHint]) {
    labels.push(DRIVER_LABELS[profile.driverHint]);
  }

  for (const tag of usage) {
    if (primaryUsage.includes(tag)) continue;
    if (tag === 'kinderwagen') {
      labels.push('Kinderwagen');
    } else if (USAGE_LABELS[tag]) {
      labels.push(USAGE_LABELS[tag]);
    }
  }

  if (!usage.includes('langstrecke') && profile.longDistance === 'often') labels.push('Langstrecke');
  else if (!usage.includes('langstrecke') && profile.longDistance === 'sometimes') labels.push('Langstrecke');

  if (profile.priorities?.includes('range')
    && ['electric', 'phev', 'hybrid', 'elektro'].includes(profile.fuel)) {
    labels.push('Reichweite wichtig');
  }

  return labels;
}

function buildEquipmentLabels(profile = {}) {
  const labels = [];

  if (profile.dog) labels.push('Hund');

  if (isTowbarRecognized(profile)) labels.push('Anhängerkupplung');

  const hasTowRangeLabel = (profile.extraLabels ?? []).some((label) => /Anhängelast:\s*ca\./i.test(label));
  const towLabel = hasTowRangeLabel ? null : formatTowCapacityLabel(profile.towCapacityKg);
  if (towLabel) labels.push(towLabel);

  const hasCargoLengthLabel = (profile.extraLabels ?? []).some((label) => /ladelänge|2\s*m/i.test(label));

  for (const wishId of [
    'heat_pump', 'camera_360', 'head_up_display', 'matrix_led', 'v2l',
    'tinting', 'panorama_roof', 'heated_seats', 'rear_seat_heat', 'power_tailgate', 'large_navi', 'large_trunk',
  ]) {
    if (wishId === 'large_trunk' && hasCargoLengthLabel) continue;
    if (hasEquipmentWish(profile, wishId)) {
      labels.push(EQUIPMENT_LABELS[wishId]);
    }
  }

  if (profile.chargingAtHome === 'yes') labels.push('Laden zuhause');

  return labels;
}

function formatBudgetAmount(amount) {
  return Number(amount).toLocaleString('de-DE');
}

/**
 * Monatsbudget: „Budget 500 €“ = exakt, „bis/unter 400 €“ = Obergrenze.
 * @param {string} text
 */
export function detectMonthlyBudgetStyle(text = '') {
  if (/\bbudget\s+\d{2,4}\b/i.test(String(text))) return 'exact';
  return 'cap';
}

function buildBudgetLabels(profile = {}) {
  const labels = [];
  const budget = profile.budget ?? {};
  const payment = budget.paymentType;

  if (budget.paymentExplicit && payment && PAYMENT_LABELS[payment]) {
    labels.push(PAYMENT_LABELS[payment]);
  }

  if (budget.maxMonthlyRate) {
    const amount = formatBudgetAmount(budget.maxMonthlyRate);
    if (budget.monthlyBudgetStyle === 'exact') {
      labels.push(`Budget ${amount} €/Monat`);
    } else {
      labels.push(`Budget bis ${amount} €/Monat`);
    }
  } else if (budget.maxPrice) {
    labels.push(`Budget bis ${formatBudgetAmount(budget.maxPrice)} €`);
  }

  return labels;
}

function buildAcquisitionLabels(profile = {}) {
  const labels = [];
  if (profile.leaseDurationMonths) {
    labels.push(`${profile.leaseDurationMonths} Monate`);
  }
  if (profile.annualKm) {
    labels.push(`${Number(profile.annualKm).toLocaleString('de-DE')} km`);
  }
  if (profile.residualTakeover) labels.push('Restwertübernahme gewünscht');
  if (profile.purchaseOption) labels.push('Kaufoption gewünscht');
  if (profile.takeoverPlanned) labels.push('Übernahme geplant');
  if (profile.timelineLabel) labels.push(profile.timelineLabel);
  return labels;
}

function buildExtraLabels(profile = {}) {
  return [...(profile.extraLabels ?? [])];
}

function buildUncertaintyLabels(profile = {}) {
  return [...(profile.openQuestions ?? [])];
}

/**
 * Sichtbare Chips in Kundensprache – geordnet nach Wichtigkeit.
 * @param {object} profile
 */
export function buildRecognitionLabels(profile = {}) {
  return mergeOrderedSections(
    buildModelLabels(profile),
    buildFuelLabels(profile),
    buildVehicleTypeLabels(profile),
    buildUsageLabels(profile),
    buildEquipmentLabels(profile),
    buildBudgetLabels(profile),
    buildAcquisitionLabels(profile),
    buildExtraLabels(profile),
    buildUncertaintyLabels(profile),
  );
}

/**
 * Planner-Hilfe: Welche Fragen sind durch Erkennung bereits beantwortet?
 * @param {object} profile
 */
export function getRecognitionQuestionBlocks(profile = {}) {
  const blocks = new Set();
  if (isAwdRecognized(profile)) blocks.add('allradNeed');
  if (isTowbarRecognized(profile) || profile.towing != null || profile.towCapacityKg) {
    blocks.add('towCapacity');
  }
  if (hasEquipmentWish(profile, 'heat_pump')) blocks.add('heatPump');
  if (hasEquipmentWish(profile, 'head_up_display')) blocks.add('hud');
  if (hasEquipmentWish(profile, 'camera_360')) blocks.add('camera360');
  if (hasEquipmentWish(profile, 'towbar')) blocks.add('towbar');
  return blocks;
}

export function shouldSkipEv3EquipmentQuestion(profile = {}) {
  const blocks = getRecognitionQuestionBlocks(profile);
  return blocks.has('heatPump')
    || blocks.has('hud')
    || blocks.has('camera360')
    || blocks.has('towbar');
}

export function equipmentLabelsFromProfile(profile = {}) {
  return buildEquipmentLabels(profile);
}
