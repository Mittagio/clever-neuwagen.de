/**
 * Kunden-UI: technische Fact-Keys → lesbare Fact-Chips.
 * Keine needProfile-/Understanding-Änderungen – nur Darstellung.
 */

const FACT_META = {
  seats: { icon: '💺', label: 'Sitze' },
  wltpRange: { icon: '🔋', label: 'WLTP' },
  batteryCapacity: { icon: '🔋', label: 'Batterie' },
  towingCapacity: { icon: '🪝', label: 'Anhängelast' },
  driveType: { icon: '⚡', label: 'Antrieb' },
  powertrain: { icon: '⚡', label: 'Antrieb' },
  charging: { icon: '🔌', label: 'Laden' },
  dimensions: { icon: '📏', label: 'Maße' },
  trunkVolume: { icon: '📦', label: 'Kofferraum' },
  cargoLength: { icon: '📦', label: 'Laderaum' },
};

const TECHNICAL_KEY_PATTERN = /^(seats|wltpRange|batteryCapacity|towingCapacity|driveType|powertrain|modelKey|variantKey|factId)$/i;

/**
 * @param {string} key
 * @param {*} value
 * @param {string|null} unit
 */
export function formatHumanFactChip(key, value, unit = null) {
  const meta = FACT_META[key] ?? { icon: '·', label: null };
  if (value == null || value === '') return null;

  let text;
  if (key === 'seats') {
    text = `${value} Sitze`;
  } else if (key === 'wltpRange') {
    const n = Number(value);
    text = Number.isFinite(n) ? `${n.toLocaleString('de-DE')} km WLTP` : `${value} km WLTP`;
  } else if (key === 'towingCapacity') {
    const n = Number(value);
    text = Number.isFinite(n) ? `${n.toLocaleString('de-DE')} kg Anhängelast` : String(value);
  } else if (key === 'batteryCapacity') {
    text = unit ? `${value} ${unit}` : `${value} kWh`;
  } else if (typeof value === 'object') {
    return null;
  } else if (unit) {
    text = `${value} ${unit}`;
  } else if (meta.label) {
    text = `${value} ${meta.label}`;
  } else {
    text = String(value);
  }

  const chip = `${meta.icon} ${text}`.trim();
  if (TECHNICAL_KEY_PATTERN.test(String(text)) || /modelKey|variantKey|factId/i.test(chip)) {
    return null;
  }
  return {
    key,
    icon: meta.icon,
    text,
    chip,
    label: text,
    value: text,
  };
}

/**
 * Entfernt technische Reste aus bereits gebauten Labels.
 * @param {string} label
 * @param {string} value
 */
export function sanitizeFactPair(label = '', value = '') {
  const blob = `${label} ${value}`;
  if (looksTechnicalFactLabel(label) || looksTechnicalFactLabel(blob)) {
    return null;
  }
  if (/modelKey|variantKey|factId/i.test(blob)) {
    return null;
  }
  return { label: String(label).trim(), value: String(value).trim() };
}

export function looksTechnicalFactLabel(label = '') {
  const text = String(label ?? '');
  return /\b(wltpRange|towingCapacity|batteryCapacity|modelKey|variantKey|factId)\b/i.test(text)
    || /\b(EV\d|Kia)\s+(seats|wltpRange|towingCapacity|batteryCapacity)\b/i.test(text)
    || /:\s*(seats|wltpRange|towingCapacity)\b/i.test(text)
    || /\bseats\b/i.test(text) && /\bEV\d\b/i.test(text);
}
