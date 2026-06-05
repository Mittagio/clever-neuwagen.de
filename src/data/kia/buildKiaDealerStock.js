/**
 * Baut Händler-Bestand aus PDF-Preislisten + Registry + technischen Stammdaten.
 */
import { listKiaPdfPriceLists, resolveRegistryKey } from './kiaPriceListRegistry.js';
import { getKiaOfficialModel } from './kiaOfficialPriceList.js';
import { getKiaTechnicalSpec } from './kiaTechnicalSpecs.js';
import { getKiaModelMediaEntry } from './kiaModelImages.js';
import { enrichVehicleWithModelAttributes } from './kiaModelAttributes.js';
import { kiaNiro } from '../manufacturer/kia/niro.js';
import { kiaCeed } from '../manufacturer/kia/ceed.js';

const TRINKLE_DEALER = {
  dealerName: 'Autohaus Trinkle',
  dealerSlug: 'autohaus-trinkle',
  city: 'Heilbronn',
  plz: '74072',
  distanceKm: 12,
  contactName: 'Mike Quach',
  contactPhone: '+49 7131 12345',
};

const BODY_FROM_CATEGORIES = {
  kleinwagen: 'kleinwagen',
  kompakt: 'limousine',
  suv: 'suv',
  familie: 'suv',
  pbv: 'nutzfahrzeug',
  gt: 'suv',
};

function slugify(...parts) {
  return parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function inferPowertrain(modelKey, variant, importData) {
  const engine = String(variant.engine ?? '').toLowerCase();
  if (engine.includes('plug-in') || engine.includes('phev') || importData?.powertrainVariant === 'phev') {
    return 'plugin-hybrid';
  }
  if (engine.includes('hybrid') || importData?.powertrainVariant === 'hybrid') {
    return 'hybrid';
  }
  if (
    importData?.powertrainVariant === 'elektro'
    || modelKey.startsWith('ev')
    || engine.includes('kwh')
    || engine.includes('elektro')
  ) {
    return 'elektro';
  }
  if (importData?.powertrainVariant === 'nutzfahrzeug' || modelKey.startsWith('pv5')) {
    return 'nutzfahrzeug';
  }
  const official = getKiaOfficialModel(modelKey);
  return official?.powertrain ?? 'verbrenner';
}

function resolveOfficialForVariant(modelKey, variant) {
  const engine = String(variant.engine ?? '').toLowerCase();
  if (modelKey === 'sportage') {
    if (engine.includes('plug-in') || engine.includes('phev')) return getKiaOfficialModel('sportage-phev');
    if (engine.includes('hybrid')) return getKiaOfficialModel('sportage-hybrid');
    return getKiaOfficialModel('sportage');
  }
  if (modelKey === 'sorento') {
    if (engine.includes('plug-in') || engine.includes('phev')) return getKiaOfficialModel('sorento-phev');
    if (engine.includes('hybrid')) return getKiaOfficialModel('sorento-hybrid');
    return getKiaOfficialModel('sorento');
  }
  return getKiaOfficialModel(modelKey);
}

function inferBodyType(modelKey, official) {
  if (official?.categories) {
    for (const cat of ['kleinwagen', 'kompakt', 'suv', 'pbv']) {
      if (official.categories.includes(cat)) return BODY_FROM_CATEGORIES[cat];
    }
  }
  if (modelKey.includes('sportswagon') || modelKey === 'xceed') return 'kombi';
  if (modelKey === 'picanto' || modelKey === 'ev2') return 'kleinwagen';
  if (modelKey.startsWith('ev4')) return 'limousine';
  if (modelKey.startsWith('pv5')) return 'nutzfahrzeug';
  return 'suv';
}

function parseEngineMeta(engine = '') {
  const text = String(engine);
  const batteryMatch = text.match(/(\d+[,.]?\d*)\s*-?\s*kWh/i);
  const powerMatch = text.match(/(\d+)\s*kW\s*\((\d+)\s*PS\)/i);
  const consumptionMatch = text.match(/(\d+[,.]?\d*)\s*(?:\(|kWh)/i);
  const rangeMatch = text.match(/(\d{3,4})\s*(?:\(|$|\s)/);

  let drive = '';
  if (/allrad|awd/i.test(text)) drive = 'AWD';
  else if (/frontantrieb|2wd/i.test(text)) drive = 'FWD';
  else if (/heckantrieb/i.test(text)) drive = 'RWD';

  return {
    batteryKwh: batteryMatch ? parseFloat(batteryMatch[1].replace(',', '.')) : null,
    powerKw: powerMatch ? Number(powerMatch[1]) : null,
    powerPs: powerMatch ? Number(powerMatch[2]) : null,
    consumptionKwh: text.toLowerCase().includes('kwh') && consumptionMatch
      ? parseFloat(consumptionMatch[1].replace(',', '.'))
      : null,
    electricRangeKm: text.toLowerCase().includes('kwh') && rangeMatch
      ? Number(rangeMatch[1])
      : null,
    drive,
  };
}

function pickWltpForTrim(wltpNotes = [], trimName = '') {
  if (!wltpNotes.length) return null;
  const trim = String(trimName).toLowerCase();
  const match = wltpNotes.find((n) => n.toLowerCase().includes(trim));
  return match ?? wltpNotes[0];
}

function estimateMonthlyRate(priceGross, official) {
  if (official?.monthlyRateAvailable && official.monthlyRateFrom > 0 && official.priceFromGross > 0) {
    const ratio = priceGross / official.priceFromGross;
    return Math.max(99, Math.round(official.monthlyRateFrom * ratio));
  }
  return Math.max(99, Math.round(priceGross * 0.007));
}

function defaultDiscount(modelKey, trimId) {
  if (modelKey === 'sportage' && trimId === 'spirit') return 23;
  if (modelKey.startsWith('ev')) return 18;
  return 16;
}

function buildEquipment(trimName, engineLabel, registryKey) {
  const items = [trimName];
  if (engineLabel) items.push(engineLabel);
  if (registryKey === 'sportage') items.push('Assistenzpaket');
  if (registryKey === 'ev3' || registryKey === 'ev4') items.push('Wärmepumpe', 'Rückfahrkamera');
  if (registryKey === 'picanto') items.push('Parksensoren hinten');
  return items;
}

function buildTechnicalSpecs(modelKey, variant, importData, official) {
  const base = getKiaTechnicalSpec(modelKey) ?? {};
  const engineMeta = parseEngineMeta(variant.engine);
  const wltpNote = pickWltpForTrim(importData?.wltpNotes, variant.trim);
  const consumption = variant.consumption
    || (engineMeta.consumptionKwh ? `${engineMeta.consumptionKwh} kWh/100 km` : null);
  const co2 = variant.co2 || (official?.powertrain === 'elektro' ? '0 g/km' : null);

  return {
    lengthMm: base.lengthMm ?? null,
    widthMm: base.widthMm ?? null,
    heightMm: base.heightMm ?? null,
    wheelbaseMm: base.wheelbaseMm ?? null,
    trunkL: base.trunkL ?? null,
    engine: variant.engine || null,
    transmission: variant.transmission || null,
    drive: variant.drive || engineMeta.drive || null,
    power: variant.power || (engineMeta.powerKw ? `${engineMeta.powerKw} kW (${engineMeta.powerPs} PS)` : null),
    batteryKwh: engineMeta.batteryKwh,
    consumption: consumption || null,
    co2: co2 || null,
    co2Class: variant.co2Class || official?.co2Class || null,
    electricRangeKm: engineMeta.electricRangeKm ?? base.electricRangeKm ?? null,
    wltpText: wltpNote || official?.wltpText || null,
    segment: official?.segment || null,
  };
}

function attachPricelistImages(entry, modelKey) {
  const media = getKiaModelMediaEntry(modelKey, 'hero');
  return {
    ...entry,
    imageModel: modelKey,
    heroImage: media?.hero ?? media?.default ?? null,
    defaultImage: media?.default ?? media?.hero ?? null,
  };
}

function buildTitle(modelName, trimName, engineLabel) {
  const shortEngine = String(engineLabel ?? '')
    .replace(/\d+[,.]?\d*-kWh-Batterie,?\s*/i, '')
    .replace(/Frontantrieb|Allradantrieb/gi, '')
    .trim();
  if (!shortEngine || shortEngine.length > 40) {
    return `Kia ${modelName} ${trimName}`.trim();
  }
  return `Kia ${modelName} ${trimName} ${shortEngine}`.replace(/\s+/g, ' ').trim();
}

function stockFromPdfVariant(modelKey, importData, variant, index) {
  const official = resolveOfficialForVariant(modelKey, variant);
  const powertrain = inferPowertrain(modelKey, variant, importData);
  const registryKey = resolveRegistryKey(modelKey);
  const priceGross = variant.priceGross;
  const monthlyRate = estimateMonthlyRate(priceGross, official);
  const discountPercent = defaultDiscount(modelKey, variant.trimId);
  const technicalSpecs = buildTechnicalSpecs(modelKey, variant, importData, official);
  const trimLabel = variant.trim || variant.trimId;
  const engineLabel = variant.engine || '';

  return enrichVehicleWithModelAttributes(attachPricelistImages({
    id: `trinkle-${slugify(modelKey, variant.trimId, index)}`,
    slug: slugify('kia', modelKey, variant.trimId, index),
    title: buildTitle(importData.model, trimLabel, engineLabel),
    brand: 'Kia',
    model: importData.model,
    modelKey,
    registryKey,
    bodyType: inferBodyType(modelKey, official),
    powertrain,
    trim: trimLabel,
    trimId: variant.trimId,
    monthlyRate,
    financeRate: Math.round(monthlyRate * 1.08),
    cashPrice: Math.round(priceGross * (1 - discountPercent / 100)),
    listPriceGross: priceGross,
    discountPercent,
    deliveryTime: official?.id?.startsWith('ev') ? '6–8 Wochen' : '4–6 Wochen',
    availability: modelKey === 'sportage' && variant.trimId === 'spirit' && powertrain === 'hybrid'
      ? 'sofort'
      : 'vorlauf',
    stockStatus: modelKey === 'sportage' && variant.trimId === 'spirit' && powertrain === 'hybrid'
      ? 'lager'
      : 'vorlauf',
    equipment: buildEquipment(trimLabel, engineLabel, registryKey),
    electricRangeKm: technicalSpecs.electricRangeKm,
    rangeKm: technicalSpecs.electricRangeKm,
    technicalSpecs,
    priceListSource: importData.priceListSource,
    ...TRINKLE_DEALER,
  }, modelKey));
}

function stockFromRegistryVariant(registry, variant) {
  const trim = registry.trims.find((t) => t.id === variant.trimId);
  const engine = registry.engines?.find((e) => e.id === variant.engineId);
  const official = getKiaOfficialModel(registry.modelKey === 'niro' ? 'niro-hybrid' : registry.modelKey);
  const technicalSpecs = buildTechnicalSpecs(
    registry.modelKey,
    { engine: engine?.name, trim: trim?.name, trimId: variant.trimId },
    {},
    official,
  );

  return enrichVehicleWithModelAttributes(attachPricelistImages({
    id: `trinkle-${slugify(registry.modelKey, variant.trimId)}`,
    slug: slugify('kia', registry.modelKey, variant.trimId),
    title: `Kia ${registry.model} ${trim?.name ?? variant.trimId}`,
    brand: registry.brand,
    model: registry.model,
    modelKey: registry.modelKey,
    registryKey: registry.modelKey,
    bodyType: registry.modelKey === 'ceed' ? 'kombi' : 'suv',
    powertrain: registry.modelKey === 'niro' ? 'hybrid' : 'verbrenner',
    trim: trim?.name ?? variant.trimId,
    trimId: variant.trimId,
    monthlyRate: variant.baseLeasingRate,
    financeRate: Math.round(variant.baseLeasingRate * 1.08),
    cashPrice: Math.round(variant.priceGross * 0.84),
    listPriceGross: variant.priceGross,
    discountPercent: 16,
    deliveryTime: '4–6 Wochen',
    availability: 'vorlauf',
    stockStatus: 'vorlauf',
    equipment: buildEquipment(trim?.name ?? '', engine?.name ?? '', registry.modelKey),
    electricRangeKm: null,
    rangeKm: null,
    technicalSpecs,
    priceListSource: registry.admin?.priceListSource,
    ...TRINKLE_DEALER,
  }, registry.modelKey));
}

/**
 * @param {{ dealer?: Partial<typeof TRINKLE_DEALER> }} [options]
 */
export function buildKiaDealerStock(options = {}) {
  const dealer = { ...TRINKLE_DEALER, ...options.dealer };
  const entries = [];

  for (const { modelKey, import: importData } of listKiaPdfPriceLists()) {
    if (!importData?.variants?.length) continue;
    importData.variants.forEach((variant, index) => {
      entries.push({
        ...stockFromPdfVariant(modelKey, importData, variant, index),
        ...dealer,
      });
    });
  }

  for (const registry of [kiaNiro, kiaCeed]) {
    for (const variant of registry.variants) {
      entries.push({
        ...stockFromRegistryVariant(registry, variant),
        ...dealer,
      });
    }
  }

  return entries;
}

export function getKiaDealerStockStats(stock = buildKiaDealerStock()) {
  const modelKeys = new Set(stock.map((v) => v.modelKey));
  const byPowertrain = stock.reduce((acc, v) => {
    acc[v.powertrain] = (acc[v.powertrain] ?? 0) + 1;
    return acc;
  }, {});
  return {
    total: stock.length,
    modelLineCount: modelKeys.size,
    modelKeys: [...modelKeys].sort(),
    byPowertrain,
  };
}
