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
]);

const EQUIPMENT_LABELS = {
  heat_pump: 'Wärmepumpe',
  camera_360: '360° Kamera',
  head_up_display: 'Head-up-Display',
  towbar: 'Anhängerkupplung',
  matrix_led: 'Matrix-LED',
  v2l: 'V2L',
};

const MODEL_HINT_LABELS = {
  sportage: 'Sportage',
  sorento: 'Sorento',
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
};

const DRIVER_LABELS = {
  frau: 'Fahrerin',
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
  return null;
}

function collectEquipmentWishes(intent = {}, text = '') {
  const wishes = new Set();
  const lower = String(text).toLowerCase();

  for (const fid of intent.features ?? []) {
    if (fid === 'towbar') continue;
    if (EQUIPMENT_WISH_IDS.has(fid)) wishes.add(fid);
  }

  if (/\bwärmepumpe\b|\bwaermepumpe\b/i.test(lower)) wishes.add('heat_pump');
  if (/\b360\s*°?\s*kamera\b|\b360-grad/i.test(lower) || /\b360\s*°/i.test(lower)) {
    wishes.add('camera_360');
  }
  if (/\bhead[- ]?up[- ]?display\b|\bhud\b/i.test(lower)) wishes.add('head_up_display');
  if (/\banhängerkupplung\b|\banhaengerkupplung\b|\bahk\b/i.test(lower)) wishes.add('towbar');
  if (/\bmatrix[- ]?led\b|\bmatrixlicht\b/i.test(lower)) wishes.add('matrix_led');
  if (/\bv2l\b|\bvehicle[- ]?to[- ]?load\b/i.test(lower)) wishes.add('v2l');

  return [...wishes].filter((id) => EQUIPMENT_WISH_IDS.has(id));
}

function detectUsageTags(text = '') {
  const lower = String(text).toLowerCase();
  const tags = [];

  const rules = [
    { test: /\bzugfahrzeug\b/i, tag: 'zugfahrzeug' },
    { test: /\bzweitwagen\b|\bzweit[- ]?auto\b/i, tag: 'zweitwagen' },
    { test: /\berstwagen\b|\berstes\s+auto\b/i, tag: 'erstwagen' },
    { test: /\bstadtfahrzeug\b|\bstadtauto\b|\b(stadt|innerstadt)\b/i, tag: 'stadt' },
    { test: /\bkurzstrecke\b|\bkurze\s+wege\b|\bkurze\s+strecken\b/i, tag: 'kurzstrecke' },
    { test: /\b\d{1,3}\s*km\s*(am\s+tag|pro\s+tag|täglich|taeglich|daily)\b/i, tag: 'kurzstrecke' },
    { test: /\blangstrecke\b|\blangstrecken\b|\bautobahn\b|\bviel\s+pendeln\b/i, tag: 'langstrecke' },
    { test: /\burlaub\b|\burlaubsfahrten\b/i, tag: 'urlaub' },
    { test: /\bwohnwagen\b|\bwohnanhänger\b|\bwohnanhaenger\b|\bcaravan\b/i, tag: 'wohnwagen' },
    { test: /\bpferdeanhänger\b|\bpferdeanhaenger\b|\bpferdetransport\b/i, tag: 'pferdeanhänger' },
    { test: (t) => /\bpferde?\b/i.test(t) && /\banhänger\b|\banhaenger\b/i.test(t), tag: 'pferdeanhänger' },
    { test: /\bboot\b|\bbootstrailer\b|\bbootsanhänger\b|\bbootsanhaenger\b/i, tag: 'boot' },
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

/**
 * @param {string} text
 * @param {object} [intent]
 */
export function recognizeWishesFromText(text = '', intent = null) {
  const trimmed = String(text ?? '').trim();
  const parsed = intent ?? (trimmed ? parseSearchIntent(trimmed) : { features: [] });
  const lower = trimmed.toLowerCase();

  const recognized = {
    drive: null,
    allradNeed: null,
    towbar: false,
    towing: null,
    towCapacityKg: parsed.towCapacityKg ?? null,
    equipmentWishes: [],
    transmission: parsed.transmission ?? null,
    bodyType: parsed.bodyType ?? null,
    modelHint: null,
    selectedModelKey: null,
    usageTags: detectUsageTags(trimmed),
    driverHint: detectDriverHint(trimmed),
    childrenCount: detectChildrenCount(trimmed, parsed.familyHint),
    hasDog: /\bhund(?:e)?\b/i.test(lower),
    hasStroller: /\bkinderwagen\b/i.test(lower),
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

  return recognized;
}

/**
 * @param {object} profile
 * @param {string} text
 * @param {object} [intent]
 */
export function applyNeedRecognition(profile = {}, text = '', intent = null) {
  const recognition = recognizeWishesFromText(text, intent);
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

  if (recognition.towCapacityKg) {
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

  if (recognition.modelHint) {
    next.modelHint = recognition.modelHint;
    if (recognition.selectedModelKey) {
      next.selectedModelKey = recognition.selectedModelKey;
    }
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

  if (recognition.hasDog) {
    next.dog = true;
    next.priorities = pushUnique(next.priorities ?? [], 'space');
  }

  if (recognition.hasStroller) {
    next.priorities = pushUnique(next.priorities ?? [], 'family');
    next.usage = pushUnique(next.usage ?? [], 'kinderwagen');
  }

  if (recognition.usageTags.includes('langstrecke')) {
    next.longDistance = 'often';
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
    labels.push(modelDisplayLabel(profile.selectedModelKey));
  } else if (profile.modelHint) {
    labels.push(MODEL_HINT_LABELS[profile.modelHint] ?? profile.modelHint);
  }
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

  if (profile.longDistance === 'often') labels.push('Langstrecke');
  else if (profile.longDistance === 'sometimes') labels.push('Langstrecke');

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

  const towLabel = formatTowCapacityLabel(profile.towCapacityKg);
  if (towLabel) labels.push(towLabel);

  for (const wishId of ['heat_pump', 'camera_360', 'head_up_display', 'matrix_led', 'v2l']) {
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
