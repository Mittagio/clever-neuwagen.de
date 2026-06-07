/**
 * Kia Partner Hub – zentrale Blaupause für Clever-Neuwagen
 * Verkaufsmodus, Gesprächsmodus und Händler-Dashboard: nur Kia.
 * Weitere Marken werden erst nach Kia-Perfektion angebunden.
 */
import { MARKETPLACE_VEHICLES } from '../marketplaceVehicles.js';
import {
  MANUFACTURER_MODELS,
  listManufacturerModels,
  getManufacturerTrims,
  getManufacturerPackages,
  getManufacturerEquipment,
} from '../manufacturer/manufacturerRegistry.js';
import { FEATURE_CATALOG, getFeatureLabel } from '../features/featureCatalog.js';
import {
  KIA_PRICE_LIST_META,
  listKiaOfficialModels,
  getKiaOfficialModel,
  formatKiaPriceFrom,
  formatKiaMonthlyRate,
} from './kiaOfficialPriceList.js';
import {
  getKiaPdfPriceList,
  getKiaPdfImportStats,
  listKiaPdfPriceLists,
} from './kiaPriceListRegistry.js';
import { getKiaTrinklePilotStock } from './kiaTrinkleStock.js';
import { isPilotLiveMode, PILOT_DEALER_ID } from '../../config/pilotLive.js';

export const KIA_PARTNER = {
  brand: 'Kia',
  partnerId: 'kia',
  tagline: 'Kia Blaupause – Clever-Neuwagen Partner',
  sellerModeOnly: true,
  priceListSource: KIA_PRICE_LIST_META.sourceUrl,
  priceListValidUntil: KIA_PRICE_LIST_META.validUntil,
};

/** Registry-Modelle mit voller Paket-/CleverQuote-Auflösung */
export const KIA_REGISTRY_MODEL_KEYS = ['sportage', 'ev3', 'ev4', 'picanto', 'niro', 'ceed'];

/** Alle Kia-Modell-IDs im Händlerkatalog (synchron mit KIA_OFFICIAL_MODELS + Ceed) */
export const KIA_DEALER_MODEL_IDS = [
  'picanto', 'stonic', 'xceed', 'k4', 'k4-sportswagon', 'ceed',
  'ev2', 'niro-hybrid', 'seltos',
  'sportage', 'sportage-hybrid', 'sportage-phev',
  'ev3', 'ev4', 'ev4-fastback', 'ev5', 'ev5-gt', 'ev6', 'ev6-gt',
  'sorento', 'sorento-hybrid', 'sorento-phev',
  'ev9', 'ev9-gt',
  'pv5-passenger', 'pv5-cargo-l2h1', 'pv5-chassis-cab', 'pv5-crew',
];

function normalizeModelToken(model = '') {
  return String(model).toLowerCase().replace(/\s+/g, '-');
}

export function isKiaVehicle(vehicle) {
  return String(vehicle?.brand ?? '').trim().toLowerCase() === 'kia';
}

export function vehicleMatchesKiaModelId(vehicle, modelId) {
  if (!vehicle || !modelId) return false;
  const id = normalizeModelToken(modelId);
  if (vehicle.modelKey && normalizeModelToken(vehicle.modelKey) === id) return true;
  const m = normalizeModelToken(vehicle.model);
  if (id === 'sportage') return m.includes('sportage');
  if (id === 'ev3') return m.includes('ev3');
  if (id === 'ev4') return m.includes('ev4');
  if (id === 'picanto') return m.includes('picanto');
  if (id === 'niro') return m.includes('niro');
  if (id === 'ceed') return m.includes('ceed');
  if (id === 'sorento') return m.includes('sorento');
  if (id === 'ev5') return m.includes('ev5') && !m.includes('ev50');
  if (id === 'ev6') return m.includes('ev6') && !m.includes('ev60');
  if (id === 'ev9') return m.includes('ev9');
  const official = getKiaOfficialModel(id);
  if (official) {
    return m.includes(official.name.toLowerCase().replace(/\s+/g, '-'))
      || m.includes(official.name.toLowerCase());
  }
  return m.includes(id);
}

export function getKiaMarketplaceVehicles(source = MARKETPLACE_VEHICLES) {
  return source.filter(isKiaVehicle);
}

/**
 * Verkaufs-Pool: nur Kia, optional auf aktive Händler-Modelle eingeschränkt
 */
export function getKiaSalesVehiclePool({
  source = MARKETPLACE_VEHICLES,
  activeModelIds = null,
  dealerSlug = null,
} = {}) {
  const trinkleDealer = dealerSlug === 'autohaus-trinkle'
    || (isPilotLiveMode() && (dealerSlug ?? PILOT_DEALER_ID) === 'autohaus-trinkle');

  let pool = trinkleDealer
    ? getKiaTrinklePilotStock()
    : getKiaMarketplaceVehicles(source);

  if (dealerSlug && !trinkleDealer) {
    pool = pool.filter((v) => (v.dealerSlug ?? PILOT_DEALER_ID) === dealerSlug);
  }

  if (Array.isArray(activeModelIds) && activeModelIds.length > 0) {
    pool = pool.filter((v) =>
      activeModelIds.some((id) => vehicleMatchesKiaModelId(v, id)),
    );
  }
  return pool;
}

export function hasRegistryCleverQuote(vehicle) {
  const key = normalizeModelToken(vehicle?.model);
  if (key.includes('sportage')) return !!MANUFACTURER_MODELS.sportage;
  if (key.includes('ev3')) return !!MANUFACTURER_MODELS.ev3;
  if (key.includes('ev4')) return !!MANUFACTURER_MODELS.ev4;
  if (key.includes('picanto')) return !!MANUFACTURER_MODELS.picanto;
  if (key.includes('niro')) return !!MANUFACTURER_MODELS.niro;
  if (key.includes('ceed')) return !!MANUFACTURER_MODELS.ceed;
  return false;
}

/** Ausstattungslinien aus Registry */
export function getKiaTrimLines(modelKey) {
  return getManufacturerTrims(modelKey).map((trim) => ({
    id: trim.id,
    name: trim.name,
    modelKey,
  }));
}

/** Pakete aus Registry */
export function getKiaPackages(modelKey) {
  return getManufacturerPackages(modelKey).map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    rateDelta: pkg.rateDelta,
    priceGross: pkg.priceGross,
    modelKey,
  }));
}

/** Feature-Library: Kunden-Features + Registry-Equipment */
export function getKiaFeatureLibrary() {
  const catalog = FEATURE_CATALOG.map((f) => ({
    id: f.id,
    label: f.label,
    category: f.category,
    source: 'catalog',
  }));

  const registryFeatures = [];
  for (const key of KIA_REGISTRY_MODEL_KEYS) {
    for (const eq of getManufacturerEquipment(key)) {
      registryFeatures.push({
        id: eq.id,
        label: eq.name,
        category: 'registry',
        modelKey: key,
        source: 'registry',
      });
    }
  }

  return { catalog, registryFeatures };
}

/** Übersicht für Dashboard / Verkäufer */
export function getKiaModelOverview() {
  const registry = listManufacturerModels().map((m) => ({
    key: m.key,
    label: m.label,
    trims: getKiaTrimLines(m.key),
    packages: getKiaPackages(m.key),
    cleverQuoteFull: true,
    official: getKiaOfficialModelSummary(m.key),
  }));

  const officialOnly = listKiaOfficialModels()
    .filter((m) => !m.registryKey || !KIA_REGISTRY_MODEL_KEYS.includes(m.registryKey))
    .map((m) => ({
      id: m.id,
      label: m.fullName,
      segment: m.segment,
      priceFromGross: m.priceFromGross,
      monthlyRateFrom: m.monthlyRateFrom,
      cleverQuoteFull: false,
      note: m.registryKey
        ? 'CleverQuote über Ausstattungs-Mapping (Pakete folgen mit Registry)'
        : 'Offizielle UPE ab – Registry folgt',
    }));

  const marketplaceOnly = getKiaMarketplaceVehicles()
    .filter((v) => !hasRegistryCleverQuote(v))
    .reduce((acc, v) => {
      const token = normalizeModelToken(v.model);
      if (!acc.find((x) => x.model === v.model)) {
        acc.push({
          model: v.model,
          label: `Kia ${v.model}`,
          cleverQuoteFull: false,
          note: 'CleverQuote über Ausstattungs-Mapping (Pakete folgen mit Registry)',
        });
      }
      return acc;
    }, []);

  return { registry, officialOnly, marketplaceOnly, meta: KIA_PRICE_LIST_META, pdfImports: getKiaPdfImportStats() };
}

export function getActiveKiaModelIdsFromConditions(conditions) {
  const fromCatalog = conditions?.activeModels
    ?.filter((m) => m.active && String(m.brand).toLowerCase() === 'kia')
    .map((m) => m.id) ?? [];
  if (fromCatalog.length) return fromCatalog;
  return ['sportage', 'ev3'];
}

export function buildKiaSellerHeadline(customerName) {
  if (customerName?.trim()) {
    return `Beste Kia-Modelle für ${customerName.trim()}`;
  }
  return 'Beste Kia-Modelle für Ihren Kunden';
}

export function enrichMatchWithKiaMeta(match) {
  const v = match?.vehicle;
  if (!v || !isKiaVehicle(v)) return match;
  const modelToken = normalizeModelToken(v.model);
  const registryKey = modelToken.includes('sportage')
    ? 'sportage'
    : modelToken.includes('ev3')
      ? 'ev3'
      : modelToken.includes('ev4')
        ? 'ev4'
        : modelToken.includes('picanto')
          ? 'picanto'
          : modelToken.includes('niro')
            ? 'niro'
            : modelToken.includes('ceed')
              ? 'ceed'
              : null;
  return {
    ...match,
    kiaMeta: {
      registryKey,
      fullCleverQuote: !!registryKey,
      trimLines: registryKey ? getKiaTrimLines(registryKey) : [],
    },
  };
}

export function getKiaWishLabel(wishId) {
  return getFeatureLabel(wishId);
}

/** Offizielle Kia-Preislisten laut kia.com/de/broschuere/ */
export function getKiaOfficialPriceList() {
  return listKiaOfficialModels();
}

export function getKiaOfficialPriceListMeta() {
  return KIA_PRICE_LIST_META;
}

export function getKiaOfficialModelSummary(modelId) {
  const entry = getKiaOfficialModel(modelId);
  const pdf = getKiaPdfPriceList(modelId);
  if (!entry && !pdf) return null;
  return {
    ...(entry ?? {}),
    ...(pdf ? {
      pdfVariants: pdf.variantCount,
      pdfSource: pdf.sourceFile,
      importNote: pdf.importNote,
    } : {}),
    priceFromLabel: formatKiaPriceFrom(pdf?.priceFromGross ?? entry?.priceFromGross),
    monthlyRateLabel: formatKiaMonthlyRate(entry?.monthlyRateFrom),
  };
}

export function listKiaPdfCatalog() {
  return listKiaPdfPriceLists();
}
