/**
 * Kia PDF-Preislisten – zentraler Import-Registry
 * Generiert via: npm run parse:kia-pdf
 * Quelle: Kia-Germany-*-Preisliste.pdf (Desktop/clever-neuwagen.de)
 */
import catalog from './pricelist-imports/catalog.js';

const importIndex = {
  importedAt: catalog.ev3?.importedAt ?? '2026-05-29',
  modelCount: Object.keys(catalog).length,
  sourceDirectory: 'Desktop/clever-neuwagen.de',
  models: Object.entries(catalog).map(([modelKey, data]) => ({
    modelKey,
    model: data.model,
    variantCount: data.variantCount ?? data.variants?.length ?? 0,
    priceFromGross: data.priceFromGross,
    file: `${modelKey}.json`,
  })),
};
import { getKiaOfficialModel } from './kiaOfficialPriceList.js';

/** @typedef {import('./pricelist-imports/ev3.json')} KiaPriceListImport */

export const KIA_PDF_IMPORT_META = {
  importedAt: importIndex.importedAt,
  modelCount: importIndex.modelCount,
  sourceDirectory: importIndex.sourceDirectory,
};

/**
 * @param {string} modelKey
 * @returns {KiaPriceListImport|null}
 */
export function getKiaPdfPriceList(modelKey) {
  return catalog[modelKey] ?? null;
}

export function listKiaPdfPriceLists() {
  return importIndex.models.map((m) => ({
    ...m,
    import: catalog[m.modelKey] ?? null,
    official: getKiaOfficialModel(m.modelKey),
  }));
}

export function getKiaPdfVariants(modelKey) {
  return getKiaPdfPriceList(modelKey)?.variants ?? [];
}

export function getKiaPdfTrims(modelKey) {
  return getKiaPdfPriceList(modelKey)?.trims ?? [];
}

export function getKiaPdfPriceFrom(modelKey) {
  const imp = getKiaPdfPriceList(modelKey);
  if (imp?.priceFromGross) return imp.priceFromGross;
  return getKiaOfficialModel(modelKey)?.priceFromGross ?? null;
}

/** Registry-Key für CleverQuote (sportage, ev3, …) */
export function resolveRegistryKey(modelKey) {
  const imp = getKiaPdfPriceList(modelKey);
  if (!imp) return modelKey;
  if (modelKey.startsWith('sportage')) return 'sportage';
  if (modelKey.startsWith('sorento')) return 'sorento';
  if (modelKey.startsWith('ev')) return modelKey.replace('-gt', '').replace('-fastback', '');
  return modelKey;
}

export function buildVariantsForRegistry(modelKey) {
  const variants = getKiaPdfVariants(modelKey);
  return variants.map((v, i) => ({
    id: `${modelKey}-${v.trimId}-${i}`,
    trimId: v.trimId,
    engineId: slugEngine(v.engine) || 'default',
    priceGross: v.priceGross,
    priceNet: v.priceNet ?? Math.round(v.priceGross / 1.19),
    available: true,
    deliveryTypeDefault: 'konfigurierbar',
    engineLabel: v.engine,
    transmission: v.transmission,
    drive: v.drive,
    power: v.power,
  }));
}

function slugEngine(engine = '') {
  const e = String(engine).toLowerCase();
  if (e.includes('58,3') || e.includes('58.3')) return 'ev-std';
  if (e.includes('81,4') || e.includes('81.4')) return 'ev-long';
  if (e.includes('hybrid')) return 'hybrid';
  if (e.includes('plug-in') || e.includes('phev')) return 'phev';
  if (e.includes('diesel') || e.includes('crdi')) return 'diesel';
  if (e.includes('t-gdi') || e.includes('gdi')) return 'benzin';
  return '';
}

export function getKiaPdfImportStats() {
  const models = listKiaPdfPriceLists();
  return {
    total: models.length,
    withVariants: models.filter((m) => (m.import?.variantCount ?? 0) > 0).length,
    pendingOcr: models.filter((m) => m.import?.importNote).length,
    totalVariants: models.reduce((s, m) => s + (m.import?.variantCount ?? 0), 0),
  };
}
