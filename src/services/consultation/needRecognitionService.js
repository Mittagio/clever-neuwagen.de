/**
 * Need Recognition – Freitext in semantische Wünsche übersetzen.
 * Erkannte Wünsche landen im NeedProfile und blockieren doppelte Planner-Fragen.
 */
import { parseSearchIntent } from '../search/searchIntentParser.js';

const EQUIPMENT_WISH_IDS = new Set([
  'heat_pump',
  'camera_360',
  'head_up_display',
  'towbar',
]);

const EQUIPMENT_LABELS = {
  heat_pump: 'Wärmepumpe',
  camera_360: '360° Kamera',
  head_up_display: 'Head-up-Display',
  towbar: 'Anhängerkupplung',
};

const MODEL_HINT_LABELS = {
  sportage: 'Sportage',
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

function pushUnique(list = [], item) {
  if (!item || list.includes(item)) return list;
  return [...list, item];
}

function normalizeModelHint(model) {
  if (!model) return null;
  const key = String(model).toLowerCase().replace(/\s+/g, '');
  if (key === 'ev3' || key === 'ev4' || key === 'ev5' || key === 'ev6' || key === 'ev9') return key;
  if (key === 'sportage') return 'sportage';
  return null;
}

function collectEquipmentWishes(intent = {}, text = '') {
  const wishes = new Set(intent.features ?? []);
  const lower = String(text).toLowerCase();

  if (/\bwärmepumpe\b|\bwaermepumpe\b/i.test(lower)) wishes.add('heat_pump');
  if (/\b360\s*°?\s*kamera\b|\b360-grad/i.test(lower) || /\b360\s*°/i.test(lower)) {
    wishes.add('camera_360');
  }
  if (/\bhead[- ]?up[- ]?display\b|\bhud\b/i.test(lower)) wishes.add('head_up_display');
  if (/\banhängerkupplung\b|\banhaengerkupplung\b|\bahk\b/i.test(lower)) wishes.add('towbar');

  return [...wishes].filter((id) => EQUIPMENT_WISH_IDS.has(id));
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
    equipmentWishes: [],
    transmission: parsed.transmission ?? null,
    bodyType: parsed.bodyType ?? null,
    modelHint: null,
    selectedModelKey: null,
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

  if (parsed.transmission === 'automatic') {
    recognized.topics.push('automatic');
  }

  const equipmentWishes = collectEquipmentWishes(parsed, trimmed);
  if (equipmentWishes.length) {
    recognized.equipmentWishes = equipmentWishes;
    for (const wish of equipmentWishes) recognized.topics.push(wish);
  }

  if (equipmentWishes.includes('towbar') || parsed.features?.includes('towbar')) {
    recognized.towbar = true;
    recognized.towing = recognized.towing ?? 'braked';
    recognized.topics.push('towbar');
  }

  const modelHint = normalizeModelHint(parsed.model);
  if (modelHint && parsed.modelExplicit) {
    recognized.modelHint = modelHint;
    recognized.topics.push(`model:${modelHint}`);
    if (modelHint.startsWith('ev')) {
      recognized.selectedModelKey = modelHint;
    }
    if (modelHint === 'sportage') {
      recognized.bodyType = recognized.bodyType ?? 'suv';
    }
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

/**
 * Labels aus semantisch erkannten Feldern – Reihenfolge für Chip-Leiste.
 * @param {object} profile
 */
export function buildRecognitionLabels(profile = {}) {
  const labels = [];

  if (profile.fuel) labels.push(FUEL_LABELS[profile.fuel] ?? profile.fuel);
  if (profile.bodyType) labels.push(BODY_LABELS[profile.bodyType] ?? profile.bodyType);
  if (profile.modelHint) labels.push(MODEL_HINT_LABELS[profile.modelHint] ?? profile.modelHint);
  if (profile.transmission === 'automatic') labels.push('Automatik');

  if (profile.priorities?.includes('family') || profile.children || (profile.persons ?? 0) >= 5) {
    labels.push('Familie');
  }
  if (profile.children === 2 || profile.children === '2') labels.push('2 Kinder');
  else if (profile.children) labels.push('Kinder');

  if (profile.budget?.maxMonthlyRate) labels.push(`Budget ${profile.budget.maxMonthlyRate} €`);
  if (profile.budget?.maxPrice) labels.push(`bis ${profile.budget.maxPrice.toLocaleString('de-DE')} €`);
  if (profile.budget?.paymentType === 'leasing') labels.push('Leasing');
  if (profile.budget?.paymentType === 'cash') labels.push('Kauf');

  if (isAwdRecognized(profile)) labels.push('Allrad');
  if (isTowbarRecognized(profile)) labels.push('Anhängerkupplung');
  else if (profile.towing && profile.towing !== 'no') labels.push('Anhängelast');

  for (const wishId of ['heat_pump', 'camera_360', 'head_up_display']) {
    if (hasEquipmentWish(profile, wishId)) {
      labels.push(EQUIPMENT_LABELS[wishId]);
    }
  }

  if (profile.chargingAtHome === 'yes') labels.push('Laden zuhause');
  if (profile.longDistance === 'often') labels.push('Langstrecke');

  return [...new Set(labels)];
}

/**
 * Planner-Hilfe: Welche Fragen sind durch Erkennung bereits beantwortet?
 * @param {object} profile
 */
export function getRecognitionQuestionBlocks(profile = {}) {
  const blocks = new Set();
  if (isAwdRecognized(profile)) blocks.add('allradNeed');
  if (isTowbarRecognized(profile) || profile.towing != null) blocks.add('towCapacity');
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
  const labels = [];
  if (hasEquipmentWish(profile, 'heat_pump')) labels.push('Wärmepumpe');
  if (hasEquipmentWish(profile, 'head_up_display')) labels.push('Head-up-Display');
  if (hasEquipmentWish(profile, 'camera_360')) labels.push('360° Kamera');
  if (isTowbarRecognized(profile)) labels.push('Anhängerkupplung');
  return labels;
}
