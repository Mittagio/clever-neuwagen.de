/**
 * Verifizierte Fahrzeug-Optionen für Live-Edit (Modell-Korrektur).
 * Nutzt Kia-Preislisten-Katalog – kein Blind-Freitext als Wahrheit.
 */
import kiaCatalog from '../../data/kia/pricelist-imports/catalog.js';
import { normalizeVehicleDisplayLabel } from './normalizeVehicleDisplayLabel.js';
import { resolveSellerModelAlias } from './zeroLossIntake.js';

function catalogEntries() {
  return Object.values(kiaCatalog || {}).filter((m) => m?.modelKey && m?.model);
}

/**
 * @param {string} query
 * @param {{ limit?: number }} [opts]
 * @returns {{ id: string, label: string, make: string, model: string, modelKey: string, trim: string|null, value: object }[]}
 */
export function searchVerifiedVehicleOptions(query = '', opts = {}) {
  const limit = Math.max(1, Number(opts.limit) || 8);
  const raw = String(query || '').trim();
  const alias = resolveSellerModelAlias(raw);
  const q = (alias.canonical || raw).toLowerCase().replace(/\s+/g, ' ');
  if (!q) {
    return catalogEntries().slice(0, 4).flatMap((entry) => {
      const trims = Array.isArray(entry.trims) ? entry.trims : [];
      if (!trims.length) {
        return [toOption(entry, null)];
      }
      return trims.slice(0, 2).map((t) => toOption(entry, t));
    }).slice(0, limit);
  }

  const hits = [];
  for (const entry of catalogEntries()) {
    const modelKey = String(entry.modelKey || '').toLowerCase();
    const model = String(entry.model || '').toLowerCase();
    const brand = String(entry.brand || 'Kia').toLowerCase();
    const modelMatch = modelKey.includes(q)
      || model.includes(q)
      || q.includes(modelKey)
      || q.includes(model)
      || `${brand} ${model}`.includes(q);

    const trims = Array.isArray(entry.trims) ? entry.trims : [];
    if (!trims.length && modelMatch) {
      hits.push(toOption(entry, null));
      continue;
    }
    for (const trim of trims) {
      const trimName = String(trim?.name || '').toLowerCase();
      const labelMatch = `${brand} ${model} ${trimName}`.includes(q)
        || `${model} ${trimName}`.includes(q)
        || (modelMatch && (!q.replace(modelKey, '').replace(model, '').trim() || trimName.includes(q.split(/\s+/).slice(-1)[0])));
      if (modelMatch || labelMatch) {
        hits.push(toOption(entry, trim));
      }
    }
  }

  // Prefer exact model+trim when query ends with a trim name
  hits.sort((a, b) => {
    const aExact = a.label.toLowerCase() === normalizeVehicleDisplayLabel(raw)?.toLowerCase() ? 0 : 1;
    const bExact = b.label.toLowerCase() === normalizeVehicleDisplayLabel(raw)?.toLowerCase() ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    return a.label.localeCompare(b.label, 'de');
  });

  const seen = new Set();
  const unique = [];
  for (const hit of hits) {
    if (seen.has(hit.id)) continue;
    seen.add(hit.id);
    unique.push(hit);
    if (unique.length >= limit) break;
  }
  return unique;
}

function toOption(entry, trim) {
  const trimName = trim?.name || null;
  const label = normalizeVehicleDisplayLabel({
    make: entry.brand || 'Kia',
    model: entry.model,
    trim: trimName,
  }) || [entry.brand || 'Kia', entry.model, trimName].filter(Boolean).join(' ');
  return {
    id: `${entry.modelKey}:${trim?.id || 'base'}`,
    label,
    make: entry.brand || 'Kia',
    model: entry.model,
    modelKey: entry.modelKey,
    trim: trimName,
    value: {
      make: entry.brand || 'Kia',
      model: entry.model,
      modelKey: entry.modelKey,
      trim: trimName,
      label,
      verified: true,
    },
  };
}

/**
 * @param {string|object} selection
 * @returns {{ label: string, value: object }|null}
 */
export function resolveVerifiedVehicleSelection(selection) {
  if (!selection) return null;
  if (typeof selection === 'object' && selection.value) {
    const label = normalizeVehicleDisplayLabel(selection.label || selection.value)
      || String(selection.label || '').trim();
    if (!label) return null;
    return {
      label,
      value: {
        ...(selection.value || {}),
        label,
        verified: true,
      },
    };
  }
  const text = String(selection || '').trim();
  if (!text) return null;
  const hits = searchVerifiedVehicleOptions(text, { limit: 1 });
  if (hits[0] && (
    hits[0].label.toLowerCase() === normalizeVehicleDisplayLabel(text)?.toLowerCase()
    || hits[0].modelKey === resolveSellerModelAlias(text).canonical
    || text.toLowerCase().includes(String(hits[0].model || '').toLowerCase())
  )) {
    return { label: hits[0].label, value: hits[0].value };
  }
  // Unverifiziert: trotzdem speichern, aber needsConfirmation
  const label = normalizeVehicleDisplayLabel(text) || text;
  return {
    label,
    value: { label, verified: false },
    needsConfirmation: true,
  };
}
