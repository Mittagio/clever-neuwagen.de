/**
 * Erkennen widersprüchlicher Ausstattungslinien (z. B. EV2 Air vs GT-Line).
 * Kein stilles Mergen – Freigabe blockieren bis geklärt.
 */
import {
  normalizeTrimToken,
  normalizeVehicleDisplayLabel,
  parseVehicleLabelParts,
} from './normalizeVehicleDisplayLabel.js';

/**
 * @param {Array<{
 *   model?: string|null,
 *   trim?: string|null,
 *   label?: string|null,
 *   source?: string|null,
 * }|string|null>} sources
 * @returns {{
 *   conflict: boolean,
 *   model: string|null,
 *   options: Array<{ id: string, trim: string, label: string, actionLabel: string }>,
 *   warning: string|null,
 * }}
 */
export function detectVehicleTrimConflict(sources = []) {
  const byModel = new Map();

  for (const src of sources) {
    if (!src) continue;
    const parsed = typeof src === 'string'
      ? parseVehicleLabelParts(src)
      : {
        model: src.model || parseVehicleLabelParts(src.label || '').model,
        trim: normalizeTrimToken(src.trim) || parseVehicleLabelParts(src.label || '').trim,
        label: src.label || null,
      };
    const model = parsed.model
      ? String(parsed.model).replace(/\s+/g, '').toUpperCase()
      : null;
    const trim = normalizeTrimToken(parsed.trim);
    if (!model || !trim) continue;
    if (!byModel.has(model)) byModel.set(model, new Map());
    const trims = byModel.get(model);
    if (!trims.has(trim)) {
      const label = normalizeVehicleDisplayLabel({
        make: 'Kia',
        model: /^EV\d$/i.test(model) ? model : model.charAt(0) + model.slice(1).toLowerCase(),
        trim,
      });
      trims.set(trim, {
        id: `trim_${model}_${trim}`.replace(/\s+/g, '_'),
        trim,
        label,
        actionLabel: `${String(label || '').replace(/^Kia\s+/i, '')} verwenden`,
        source: typeof src === 'object' ? src.source || null : null,
      });
    }
  }

  for (const [model, trims] of byModel.entries()) {
    if (trims.size < 2) continue;
    const options = [...trims.values()];
    const displayModel = /^EV\d$/i.test(model)
      ? model
      : model.charAt(0) + model.slice(1).toLowerCase();
    return {
      conflict: true,
      model: displayModel,
      options,
      warning: `Fahrzeugvariante unklar: ${options.map((o) => o.trim).join(' oder ')} – bitte festlegen.`,
    };
  }

  return {
    conflict: false,
    model: null,
    options: [],
    warning: null,
  };
}

/**
 * Same-model multi-interest hits → Konflikt statt „Air / GT-Line“-Merge.
 * @param {Array<{ modelKey?: string, trim?: string|null, label?: string }>} interestHits
 */
export function detectInterestTrimConflict(interestHits = []) {
  return detectVehicleTrimConflict(
    interestHits.map((h) => ({
      model: h.modelKey || h.model,
      trim: h.trim,
      label: h.label,
      source: 'seller_input',
    })),
  );
}
