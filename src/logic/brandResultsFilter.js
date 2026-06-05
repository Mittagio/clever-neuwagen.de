/**
 * Marken & Modelle aus aktuellen Suchergebnissen – kein fester Katalog
 */

import { getModelLineKey, getModelLineLabel } from '../services/sales/advisorRanking.js';

export function brandToFilterId(brand) {
  return String(brand ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/** Stabile Modell-ID für URL/State – eine ID pro Modelllinie (nicht pro Variante) */
export function vehicleToModelFilterId(vehicle) {
  const lineKey = getModelLineKey(vehicle);
  if (lineKey && lineKey !== 'unknown') {
    const brand = brandToFilterId(vehicle?.brand);
    return brand ? `${brand}-${lineKey}` : lineKey;
  }
  if (vehicle?.slug) return String(vehicle.slug);
  const brand = brandToFilterId(vehicle?.brand);
  const model = String(vehicle?.model ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  return brand && model ? `${brand}-${model}` : model || vehicle?.id || '';
}

export function parseExcludedBrandsParam(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(brandToFilterId).filter(Boolean);
  return String(value)
    .split(',')
    .map((s) => brandToFilterId(s.trim()))
    .filter(Boolean);
}

export function parseExcludedModelsParam(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((s) => String(s).trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** @deprecated Nutze extractResultCatalogFromVehicles */
export function extractBrandsFromVehicles(vehicles = []) {
  return extractResultCatalogFromVehicles(vehicles).brands;
}

/**
 * Katalog aus Treffer-Fahrzeugen
 * @returns {{ brands: Array<{ id, label, count, models }> }}
 */
export function extractResultCatalogFromVehicles(vehicles = []) {
  const brandMap = new Map();

  for (const v of vehicles) {
    const brandId = brandToFilterId(v.brand);
    if (!brandId) continue;

    if (!brandMap.has(brandId)) {
      brandMap.set(brandId, {
        id: brandId,
        label: v.brand,
        count: 0,
        models: new Map(),
      });
    }

    const entry = brandMap.get(brandId);
    entry.count += 1;

    const modelId = vehicleToModelFilterId(v);
    if (!entry.models.has(modelId)) {
      entry.models.set(modelId, {
        id: modelId,
        label: getModelLineLabel(v) || v.model,
        slug: v.slug,
        count: 0,
      });
    }
    entry.models.get(modelId).count += 1;
  }

  const brands = [...brandMap.values()]
    .map((b) => ({
      id: b.id,
      label: b.label,
      count: b.count,
      models: [...b.models.values()].sort(
        (a, c) => c.count - a.count || a.label.localeCompare(c.label, 'de'),
      ),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'de'));

  return { brands };
}

export function vehiclePassesBrandExclusion(vehicle, excludedBrands = []) {
  if (!excludedBrands?.length) return true;
  return !excludedBrands.includes(brandToFilterId(vehicle.brand));
}

export function vehiclePassesModelExclusion(vehicle, excludedModels = []) {
  if (!excludedModels?.length) return true;
  const modelId = vehicleToModelFilterId(vehicle);
  return !excludedModels.includes(modelId)
    && !excludedModels.includes(vehicle.slug)
    && !excludedModels.includes(vehicle.id);
}

export function isBrandActive(brandId, excludedBrands = []) {
  return !excludedBrands.includes(brandToFilterId(brandId));
}

export function isModelActive(modelId, excludedModels = [], excludedBrands = [], brandId) {
  if (!isBrandActive(brandId, excludedBrands)) return false;
  return !excludedModels.includes(modelId);
}

export function toggleExcludedBrand(excludedBrands, brandId) {
  const id = brandToFilterId(brandId);
  const set = new Set(excludedBrands ?? []);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return [...set];
}

export function toggleExcludedModel(excludedModels, modelId) {
  const id = String(modelId ?? '').trim();
  const set = new Set(excludedModels ?? []);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return [...set];
}

export function excludeBrand(excludedBrands, brandId) {
  const id = brandToFilterId(brandId);
  return [...new Set([...(excludedBrands ?? []), id])];
}

export function includeBrand(excludedBrands, brandId) {
  const id = brandToFilterId(brandId);
  return (excludedBrands ?? []).filter((b) => b !== id);
}

/** Kompakte Mobile-Zeile */
export function buildBrandSummaryLine(brands, excludedBrands, maxNames = 4) {
  const active = brands.filter((b) => isBrandActive(b.id, excludedBrands));
  if (!active.length) return 'Keine Marken aktiv';
  const names = active.slice(0, maxNames).map((b) => b.label);
  const rest = active.length - names.length;
  return rest > 0 ? `${names.join(', ')} + ${rest} weitere` : names.join(', ');
}

export function flattenCatalogModels(catalog) {
  const brands = catalog?.brands ?? [];
  return brands.flatMap((b) =>
    (b.models ?? []).map((m) => ({
      ...m,
      brandId: b.id,
      brandLabel: b.label,
    })),
  );
}

export function isAllBrandsExcluded(catalog, excludedBrands = []) {
  const brands = catalog?.brands ?? [];
  if (!brands.length) return false;
  return brands.every((b) => !isBrandActive(b.id, excludedBrands));
}

export function computeOfferStats(poolVehicles = [], excludedBrands = [], excludedModels = []) {
  const total = poolVehicles.length;
  const visible = poolVehicles.filter(
    (v) => vehiclePassesBrandExclusion(v, excludedBrands)
      && vehiclePassesModelExclusion(v, excludedModels),
  ).length;
  return {
    total,
    visible,
    hidden: Math.max(0, total - visible),
  };
}

/** Kurze Ergebniszeile unter der Auswahlkarte */
export function buildOfferCountLine({ visible, hidden, total = null }) {
  if (visible === 0) return total != null ? `${total} geprüft · keine sichtbar` : 'Keine Angebote sichtbar';
  if (hidden === 0) {
    if (total != null && total > visible) {
      return `${total} Fahrzeuge geprüft · ${visible} passen`;
    }
    return visible === 1 ? '1 Fahrzeug geprüft' : `${visible} Fahrzeuge geprüft`;
  }
  const main = total != null
    ? `${total} geprüft · ${visible} passen`
    : (visible === 1 ? '1 Angebot' : `${visible} Angebote`);
  return `${main} · ${hidden} ausgeblendet`;
}

export function collectVehiclesFromResults(results) {
  const seen = new Set();
  const out = [];
  const add = (match) => {
    const v = match?.vehicle;
    if (!v?.id || seen.has(v.id)) return;
    seen.add(v.id);
    out.push(v);
  };
  add(results?.topMatch);
  (results?.restMatches ?? []).forEach(add);
  (results?.alternativeMatches ?? []).forEach(add);
  (results?.popularMatches ?? []).forEach(add);
  return out;
}
