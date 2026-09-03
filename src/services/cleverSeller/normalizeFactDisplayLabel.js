/**
 * Fact-Labels immer als lesbarer String – nie `[object Object]`.
 */
import { normalizeVehicleDisplayLabel } from './normalizeVehicleDisplayLabel.js';

function cleanString(raw) {
  const text = String(raw ?? '').trim();
  if (!text || text === '[object Object]') return '';
  return text;
}

function labelFromPlainObject(obj = {}) {
  if (!obj || typeof obj !== 'object') return '';
  const vehicle = normalizeVehicleDisplayLabel({
    make: obj.make || obj.brand || null,
    model: obj.model
      || (obj.modelKey ? (/^ev\d$/i.test(String(obj.modelKey))
        ? String(obj.modelKey).toUpperCase()
        : String(obj.modelKey)) : null),
    trim: obj.trim || obj.trimLabel || null,
    color: obj.color || obj.preferredColor || null,
    label: typeof obj.label === 'string' ? obj.label : (obj.displayName || null),
  });
  if (vehicle) return vehicle;
  const named = cleanString(obj.displayName)
    || cleanString(typeof obj.label === 'string' ? obj.label : '')
    || cleanString(obj.text)
    || cleanString(obj.name)
    || cleanString(obj.title);
  if (named) return named;
  // Farbe / Ausstattung ohne Modell
  const colorOnly = cleanString(obj.color || obj.preferredColor);
  if (colorOnly) {
    return colorOnly.charAt(0).toUpperCase() + colorOnly.slice(1);
  }
  const equip = cleanString(obj.equipmentPackage || obj.package || obj.id);
  if (equip && (obj.priority || obj.equipmentPackage || obj.package)) {
    return equip;
  }
  return '';
}

/**
 * @param {unknown} label
 * @param {unknown} [value]
 * @returns {string}
 */
export function normalizeFactDisplayLabel(label, value = null) {
  if (typeof label === 'string') {
    const fromLabel = cleanString(label);
    if (fromLabel) return fromLabel;
  } else if (label != null && typeof label === 'object') {
    const fromObj = labelFromPlainObject(label);
    if (fromObj) return fromObj;
  }

  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    const fromValue = labelFromPlainObject(value);
    if (fromValue) return fromValue;
  }

  if (value != null && typeof value !== 'object') {
    return cleanString(value);
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => (
        typeof entry === 'string'
          ? cleanString(entry)
          : labelFromPlainObject(entry)
      ))
      .filter(Boolean);
    if (parts.length) return parts.join(' / ');
  }

  return '';
}

/**
 * Snapshot-/Chip-Label defensiv (UI + Soft-Pipeline).
 * @param {unknown} label
 * @returns {string}
 */
export function safeSnapshotFactLabel(label) {
  if (label == null) return '';
  if (typeof label === 'string') return cleanString(label);
  if (typeof label === 'object') {
    return labelFromPlainObject(label) || '';
  }
  return cleanString(label);
}
