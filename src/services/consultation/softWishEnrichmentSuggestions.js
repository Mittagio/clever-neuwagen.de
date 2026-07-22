/**
 * Soft Wish Enrichment – Vorschläge vor der Identifikation.
 * Keine persistierten Kundenwünsche – erst nach aktiver Auswahl.
 */
import { HANDOFF_EQUIPMENT_CHIPS } from './wishHandoffEquipment.js';

const MAX_SOFT_SUGGESTIONS = 6;

/** Modell-/Antriebskontext → priorisierte Chip-IDs aus wishHandoffEquipment */
const MODEL_SOFT_POOLS = {
  ev9: ['hud', 'towbar', 'bigTrunk', 'seatHeating', 'adaptiveCruise', 'panoramicRoof'],
  ev2: ['seatHeating', 'heatPump', 'rearCamera', 'bigTrunk', 'frontParkingSensors', 'navi'],
  ev3: ['hud', 'seatHeating', 'rearCamera', 'bigTrunk', 'towbar', 'heatPump'],
  ev5: ['hud', 'seatHeating', 'camera360', 'bigTrunk', 'towbar', 'panoramicRoof'],
  ev6: ['hud', 'seatHeating', 'camera360', 'towbar', 'matrixLed', 'panoramicRoof'],
  sportage: ['towbar', 'camera360', 'seatHeating', 'panoramicRoof', 'bigTrunk', 'blindSpot'],
  sorento: ['towbar', 'bigTrunk', 'seatHeating', 'camera360', 'panoramicRoof', 'adaptiveCruise'],
  default: ['seatHeating', 'hud', 'towbar', 'rearCamera', 'bigTrunk', 'panoramicRoof'],
};

/** Soft-Chips ohne Equipment-ID (Prioritäten / Nutzung) */
const CONTEXT_SOFT_CHIPS = [
  {
    id: 'range_important',
    label: 'Reichweite wichtig',
    icon: '🔋',
    match: /elektro|ev\d|reichweite|wltp/,
    skipIf: /reichweite wichtig|wltp|km wltp/,
  },
  {
    id: 'seat_comfort',
    label: 'Sitzkomfort',
    icon: '💺',
    match: /ev9|sorento|familie|7\s*sitz/,
    skipIf: /sitzkomfort|sitzheizung|memory/,
  },
  {
    id: 'safety_systems',
    label: 'Sicherheitssysteme',
    icon: '🛡',
    match: /ev9|familie|kinder/,
    skipIf: /sicherheit|totwinkel|spurhalte|abstand/,
  },
  {
    id: 'compact_size',
    label: 'kompakte Größe',
    icon: '🚗',
    match: /ev2|kleinwagen|stadt/,
    skipIf: /kompakt|kleinwagen/,
  },
  {
    id: 'affordable_rate',
    label: 'günstige Rate',
    icon: '💶',
    match: /ev2|leasing|finanz|rate|budget/,
    skipIf: /rate|budget|€\/monat|monatsrate/,
  },
  {
    id: 'awd',
    label: 'Allrad',
    icon: '⛰',
    match: /sportage|sorento|allrad|ahk|anhäng/,
    skipIf: /allrad|awd|4wd/,
  },
];

const EQUIPMENT_ICONS = {
  seatHeating: '🔥',
  hud: '🖥',
  towbar: '🪝',
  bigTrunk: '📦',
  rearCamera: '📷',
  camera360: '📷',
  panoramicRoof: '☀',
  heatPump: '🌡',
  adaptiveCruise: '🛡',
  blindSpot: '🛡',
  matrixLed: '💡',
  navi: '🗺',
  frontParkingSensors: '📍',
};

function normalizeBlob(labels = [], needProfile = {}) {
  return [
    ...(labels ?? []),
    ...(needProfile.understoodLabels ?? []),
    ...(needProfile.equipmentWishes ?? []),
    ...(needProfile.equipmentWishIds ?? []),
    needProfile.selectedModelKey,
    needProfile.modelHint,
    needProfile.fuel,
    needProfile.bodyType,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function resolveModelKey(needProfile = {}, notepadLabels = []) {
  const key = String(needProfile.selectedModelKey || needProfile.modelHint || '').toLowerCase();
  if (key) return key.replace(/^kia-/, '');
  const fromLabel = (notepadLabels ?? []).find((label) => /^EV\d/i.test(String(label))
    || /^(Sportage|Sorento)$/i.test(String(label)));
  if (!fromLabel) return null;
  return String(fromLabel).toLowerCase().replace(/\s+interessant$/i, '');
}

function labelAlreadyPresent(blob, label) {
  const needle = String(label ?? '').toLowerCase();
  if (!needle) return true;
  return blob.includes(needle);
}

/**
 * Deterministische Soft-Opt-in-Vorschläge (AI-Fallback / Standard).
 * @param {{ needProfile?: object, notepadLabels?: string[], max?: number }} ctx
 * @returns {{ id: string, label: string, icon: string, equipmentWishId: string|null, customerNoteValue: string }[]}
 */
export function buildSoftWishEnrichmentSuggestions(ctx = {}) {
  const needProfile = ctx.needProfile ?? {};
  const notepadLabels = ctx.notepadLabels ?? [];
  const max = Math.min(MAX_SOFT_SUGGESTIONS, Math.max(4, Number(ctx.max) || MAX_SOFT_SUGGESTIONS));
  const blob = normalizeBlob(notepadLabels, needProfile);
  const modelKey = resolveModelKey(needProfile, notepadLabels) || 'default';
  const pool = MODEL_SOFT_POOLS[modelKey] || MODEL_SOFT_POOLS.default;

  const out = [];
  const seen = new Set();

  const push = (item) => {
    if (!item?.label || seen.has(item.label.toLowerCase())) return;
    if (labelAlreadyPresent(blob, item.label)) return;
    seen.add(item.label.toLowerCase());
    out.push(item);
  };

  for (const equipmentId of pool) {
    if (out.length >= max) break;
    // heatPump is not always in HANDOFF_EQUIPMENT_CHIPS – map if missing
    let chip = HANDOFF_EQUIPMENT_CHIPS.find((c) => c.id === equipmentId);
    if (!chip && equipmentId === 'heatPump') {
      chip = { id: 'heatPump', label: 'Wärmepumpe', category: 'comfort' };
    }
    if (!chip) continue;
    push({
      id: `equip_${chip.id}`,
      label: chip.label,
      icon: EQUIPMENT_ICONS[chip.id] || '·',
      equipmentWishId: chip.id === 'heatPump' ? null : chip.id,
      customerNoteValue: chip.label,
      category: chip.category || 'soft',
    });
  }

  for (const soft of CONTEXT_SOFT_CHIPS) {
    if (out.length >= max) break;
    if (soft.match && !soft.match.test(blob) && modelKey === 'default') continue;
    if (soft.match && modelKey !== 'default' && !soft.match.test(`${blob} ${modelKey}`)) {
      // still allow if model pool didn't fill enough
      if (out.length >= 4) continue;
    }
    if (soft.skipIf?.test(blob)) continue;
    push({
      id: soft.id,
      label: soft.label,
      icon: soft.icon,
      equipmentWishId: null,
      customerNoteValue: soft.label,
      category: 'soft',
    });
  }

  return out.slice(0, max);
}

/**
 * AI-Vorschläge sanitizen – nur erlaubte Form, keine Auto-Persistenz.
 * @param {unknown} suggestions
 * @param {{ needProfile?: object, notepadLabels?: string[], max?: number }} ctx
 */
export function sanitizeSoftWishSuggestions(suggestions, ctx = {}) {
  const max = Math.min(MAX_SOFT_SUGGESTIONS, Number(ctx.max) || MAX_SOFT_SUGGESTIONS);
  const blob = normalizeBlob(ctx.notepadLabels, ctx.needProfile);
  if (!Array.isArray(suggestions) || !suggestions.length) {
    return buildSoftWishEnrichmentSuggestions(ctx);
  }

  const out = [];
  const seen = new Set();
  for (const raw of suggestions) {
    if (!raw || typeof raw !== 'object') continue;
    const label = String(raw.label ?? raw.customerNoteValue ?? '').trim().slice(0, 40);
    if (!label || seen.has(label.toLowerCase())) continue;
    if (labelAlreadyPresent(blob, label)) continue;
    seen.add(label.toLowerCase());
    const equipmentWishId = HANDOFF_EQUIPMENT_CHIPS.find(
      (c) => c.label.toLowerCase() === label.toLowerCase() || c.id === raw.id,
    )?.id ?? null;
    out.push({
      id: String(raw.id ?? label).trim().slice(0, 48) || `soft_${out.length}`,
      label,
      icon: EQUIPMENT_ICONS[equipmentWishId] || '·',
      equipmentWishId,
      customerNoteValue: String(raw.customerNoteValue ?? label).trim().slice(0, 80),
      category: String(raw.category ?? 'soft').slice(0, 32),
    });
    if (out.length >= max) break;
  }

  if (out.length < 4) {
    const fallback = buildSoftWishEnrichmentSuggestions(ctx);
    for (const item of fallback) {
      if (out.length >= max) break;
      if (seen.has(item.label.toLowerCase())) continue;
      seen.add(item.label.toLowerCase());
      out.push(item);
    }
  }

  return out.slice(0, max);
}

export { MAX_SOFT_SUGGESTIONS };
