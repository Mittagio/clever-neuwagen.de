/**
 * Zentraler Fahrzeugkatalog – Runtime-Overlay nach Preislisten-Freigabe
 * Single Source of Truth für Import-Updates (localStorage)
 */

import { kiaSportage } from './kiaSportage.js';

export const CATALOG_STORAGE_KEY = 'clever-neuwagen-vehicle-catalog';
export const DEALER_SYNC_KEY = 'clever-neuwagen-catalog-dealer-sync';

function loadCatalog() {
  try {
    const raw = localStorage.getItem(CATALOG_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* Fallback */
  }
  return { models: {}, changeCenterEntries: [] };
}

function saveCatalog(data) {
  localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(data));
}

export function getCatalogState() {
  return loadCatalog();
}

export function modelKey(brandId, modelSlug) {
  return `${brandId}-${modelSlug}`;
}

function slugifyModel(name) {
  return (name ?? '').toLowerCase().trim().replace(/\s+/g, '-');
}

export function resolveBrandId(brandLabel) {
  const map = {
    kia: 'kia',
    hyundai: 'hyundai',
    toyota: 'toyota',
    vw: 'vw',
    bmw: 'bmw',
    mercedes: 'mercedes',
  };
  const key = (brandLabel ?? '').toLowerCase().trim();
  return map[key] ?? key;
}

export function getModelOverlay(brandId, modelSlug) {
  const catalog = loadCatalog();
  return catalog.models[modelKey(brandId, modelSlug)] ?? null;
}

export function getUpeOverride(brandId, modelSlug, trimId) {
  const overlay = getModelOverlay(brandId, modelSlug);
  if (!overlay?.upeByTrim) return null;
  const id = (trimId ?? '').toLowerCase();
  if (overlay.upeByTrim[id] != null) return overlay.upeByTrim[id];
  const trim = kiaSportage.trims.find((t) => t.id === id || t.name.toLowerCase() === id);
  if (trim && overlay.upeByTrim[trim.id] != null) return overlay.upeByTrim[trim.id];
  const byName = Object.entries(overlay.upeByTrim).find(
    ([k]) => k.toLowerCase() === id || trim?.name?.toLowerCase() === k.toLowerCase(),
  );
  return byName ? byName[1] : null;
}

export function getCatalogAdminMeta(brandId, modelSlug) {
  const overlay = getModelOverlay(brandId, modelSlug);
  if (overlay?.admin) return overlay.admin;
  if (brandId === 'kia' && modelSlug === 'sportage') {
    return { ...kiaSportage.admin };
  }
  return null;
}

export function getExtendedChangeCenter() {
  const catalog = loadCatalog();
  return catalog.changeCenterEntries ?? [];
}

export function getDealerSyncInfo() {
  try {
    const raw = localStorage.getItem(DEALER_SYNC_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* Fallback */
  }
  return { lastAt: null, dealerCount: 0, models: [] };
}

function parseEuro(value) {
  if (typeof value === 'number') return value;
  const n = String(value).replace(/[^\d]/g, '');
  return n ? Number(n) : null;
}

function trimNameToId(name) {
  const n = (name ?? '').toLowerCase().trim();
  const found = kiaSportage.trims.find(
    (t) => t.id === n || t.name.toLowerCase() === n,
  );
  return found?.id ?? n.replace(/\s+/g, '-');
}

/**
 * Wendet freigegebene Import-Änderungen auf den Katalog an.
 * @param {import('./priceListImport.js').PriceListImport} importRecord
 */
export function applyCatalogChanges(importRecord) {
  const brandId = resolveBrandId(importRecord.brand);
  const modelSlug = slugifyModel(importRecord.model);
  const key = modelKey(brandId, modelSlug);
  const catalog = loadCatalog();
  const existing = catalog.models[key] ?? {
    brandId,
    modelSlug,
    brand: importRecord.brand,
    model: importRecord.model,
    upeByTrim: {},
    colors: [],
    packages: [],
    wltp: [],
  };

  for (const ch of importRecord.changes ?? []) {
    if (ch.type === 'price') {
      const trimId = trimNameToId(ch.field);
      const price = parseEuro(ch.newValue);
      if (price != null) existing.upeByTrim[trimId] = price;
    }
    if (ch.type === 'color' && ch.newValue) {
      existing.colors.push({
        name: ch.newValue,
        addedAt: importRecord.approvedAt ?? new Date().toISOString(),
      });
    }
    if (ch.type === 'package' && ch.newValue) {
      existing.packages.push({ name: ch.newValue, previous: ch.oldValue });
    }
    if (ch.type === 'wltp') {
      existing.wltp.push({ field: ch.field, value: ch.newValue, previous: ch.oldValue });
    }
    if (ch.type === 'engine') {
      existing.engines = existing.engines ?? [];
      existing.engines.push({ label: ch.newValue, detail: ch.oldValue });
    }
  }

  existing.admin = {
    lastUpdated: (importRecord.approvedAt ?? new Date().toISOString()).slice(0, 10),
    updatedBy: 'Preislisten-Import',
    priceListDate: importRecord.version,
    priceListSource: importRecord.sourceFile?.name ?? 'Import',
    status: 'complete',
  };

  catalog.models[key] = existing;

  const ccEntry = {
    id: `cc-imp-${importRecord.id}`,
    type: 'price',
    date: (importRecord.approvedAt ?? new Date().toISOString()).slice(0, 10),
    title: `${importRecord.brand} ${importRecord.model} – Preisliste ${importRecord.version} übernommen`,
    detail: `${importRecord.changes?.length ?? 0} Änderungen für alle Händler aktiv`,
    brand: brandId,
    model: modelSlug,
    status: 'published',
    importId: importRecord.id,
  };
  catalog.changeCenterEntries = [ccEntry, ...(catalog.changeCenterEntries ?? [])];

  saveCatalog(catalog);

  const dealerSync = {
    lastAt: new Date().toISOString(),
    dealerCount: 12,
    models: [...new Set([...(getDealerSyncInfo().models ?? []), key])],
    importId: importRecord.id,
    label: `${importRecord.brand} ${importRecord.model}`,
  };
  localStorage.setItem(DEALER_SYNC_KEY, JSON.stringify(dealerSync));

  return { catalog, dealerSync };
}

export function getCurrentPriceSnapshot(brandId, modelSlug) {
  if (brandId === 'kia' && modelSlug === 'sportage') {
    const snapshot = {};
    for (const trim of kiaSportage.trims) {
      const override = getUpeOverride('kia', 'sportage', trim.id);
      const variant = kiaSportage.variants?.find((v) => v.trimId === trim.id);
      const price = override ?? variant?.priceGross;
      if (price != null) {
        snapshot[trim.name] = `${Number(price).toLocaleString('de-DE')} €`;
      }
    }
    return snapshot;
  }
  const overlay = getModelOverlay(brandId, modelSlug);
  if (overlay?.upeByTrim) {
    return Object.fromEntries(
      Object.entries(overlay.upeByTrim).map(([k, v]) => [
        k,
        `${Number(v).toLocaleString('de-DE')} €`,
      ]),
    );
  }
  return {};
}
