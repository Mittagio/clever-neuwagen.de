/**
 * Generiert CleverVehicleRecords für alle Kia-Modelllinien (kia.com DE).
 * Quellen: KIA_OFFICIAL_MODELS, kiaModelAttributes, kiaTechnicalSpecs
 */
import { KIA_OFFICIAL_MODELS } from '../kia/kiaOfficialPriceList.js';
import { KIA_MODEL_ATTRIBUTES } from '../kia/kiaModelAttributes.js';
import { getKiaTechnicalSpec } from '../kia/kiaTechnicalSpecs.js';
import { CLEVER_FEATURE_STATUS as S } from './cleverVehicleRecord.js';
import { KIA_CLEVER_RECORD_OVERRIDES } from './kiaCleverRecordOverrides.js';
import { getKiaFamilySpec } from '../kia/kiaFamilySpecs.js';
import { getKiaDeliveryWeeks, getKiaLeatherStatus } from '../kia/kiaModelMarketSpecs.js';
import { getKiaPerformanceSpec, KIA_WARRANTY_DEFAULT } from '../kia/kiaPerformanceSpecs.js';

/** Offizielle ID → Attribut-/Spec-Key */
const MODEL_KEY_ALIASES = {
  'niro-hybrid': 'niro-hybrid',
  'pv5-cargo-l2h1': 'pv5-cargo',
};

/** Anhängelast gebremst (kg) – Kia DE Referenz, sonst null */
const TOWING_BRAKED_KG = {
  picanto: 750,
  stonic: 1100,
  xceed: 1400,
  k4: 1400,
  'k4-sportswagon': 1400,
  ceed: 1400,
  seltos: 1600,
  'niro-hybrid': 1300,
  niro: 1300,
  sportage: 1900,
  'sportage-hybrid': 1600,
  'sportage-phev': 1600,
  sorento: 2500,
  'sorento-hybrid': 2000,
  'sorento-phev': 2500,
  ev2: null,
  ev3: 1000,
  ev4: 1500,
  'ev4-fastback': 1500,
  ev5: 1800,
  'ev5-gt': 1800,
  ev6: 1600,
  'ev6-gt': 1600,
  ev9: 2500,
  'ev9-gt': 2500,
  'pv5-passenger': 1500,
  'pv5-cargo': 1500,
  'pv5-chassis-cab': 1500,
  'pv5-crew': 1500,
};

function resolveModelKey(officialId) {
  return MODEL_KEY_ALIASES[officialId] ?? officialId;
}

function getAttributes(modelKey) {
  if (KIA_MODEL_ATTRIBUTES[modelKey]) return KIA_MODEL_ATTRIBUTES[modelKey];
  if (modelKey === 'niro-hybrid' && KIA_MODEL_ATTRIBUTES.niro) {
    return { ...KIA_MODEL_ATTRIBUTES.niro, modelKey: 'niro-hybrid', label: 'Niro Hybrid' };
  }
  return null;
}

function inferCleverScores(attrs, official, towingKg, rangeKm) {
  const seats = attrs?.seats ?? 5;
  const body = attrs?.bodyClass ?? 'compact_suv';
  const pt = official.powertrain;
  const isElectric = pt === 'elektro' || pt === 'nutzfahrzeug';
  const isPhev = pt === 'plugin-hybrid';
  const isHybrid = pt === 'hybrid';
  const isLarge = body === 'large_suv' || body === 'family_suv';
  const isSmall = body === 'kleinwagen' || body === 'compact';
  const tow = towingKg ?? 0;
  const range = rangeKm ?? 0;

  const familyVehicle = seats >= 7 ? 9 : isLarge ? 7 : isSmall ? 4 : 6;
  const dogFriendly = body === 'kombi' || isLarge ? 8 : isSmall ? 5 : 7;
  const caravanReady = tow >= 2500 ? 9 : tow >= 1800 ? 7 : tow >= 1200 ? 5 : tow > 0 ? 3 : 1;
  const longDistance = isElectric && range >= 500 ? 9
    : isElectric && range >= 400 ? 7
    : isPhev ? 7
    : isHybrid ? 6
    : isElectric ? 5
    : 5;
  const commuter = isSmall && isElectric ? 9 : isElectric ? 7 : isHybrid || isPhev ? 7 : isSmall ? 8 : 6;
  const seniorFriendly = isLarge ? 8 : isSmall ? 6 : 7;
  const fieldSales = body === 'commercial' || body === 'kombi' ? 8 : isLarge ? 7 : 5;
  const cityCar = isSmall ? 9 : body === 'compact_suv' ? 7 : 5;
  const price = official.priceFromGross ?? 99999;
  const valuePick = price <= 28000 ? 9 : price <= 40000 ? 7 : price <= 55000 ? 6 : 5;

  return {
    familyVehicle,
    dogFriendly,
    caravanReady,
    longDistance,
    commuter,
    seniorFriendly,
    fieldSales,
    cityCar,
    valuePick,
  };
}

/** Wärmepumpe – Kia EV ab Earth/GT und PHEV Sorento/Sportage typisch serienmäßig. */
function inferHeatPumpDefault(officialId, powertrain) {
  if (powertrain === 'plugin-hybrid') {
    return ['sorento-phev', 'sportage-phev'].includes(officialId) ? true : null;
  }
  if (powertrain !== 'elektro' && powertrain !== 'nutzfahrzeug') return null;
  const withHeatPump = new Set([
    'ev2', 'ev3', 'ev4', 'ev4-fastback', 'ev5', 'ev5-gt', 'ev6', 'ev6-gt', 'ev9', 'ev9-gt',
    'niro', 'pv5-passenger', 'pv5-cargo', 'pv5-crew', 'pv5-chassis-cab',
  ]);
  return withHeatPump.has(officialId) ? true : null;
}

function buildElectricBlock(official, attrs, spec) {
  const pt = official.powertrain;
  if (pt !== 'elektro' && pt !== 'plugin-hybrid' && pt !== 'nutzfahrzeug') return undefined;

  const rangeKm = spec?.electricRangeKm ?? attrs?.typicalRangeKm ?? null;
  const is800V = ['ev6', 'ev6-gt', 'ev9', 'ev9-gt'].includes(official.id);

  const heatPump = inferHeatPumpDefault(official.id, pt);

  return {
    batteryGrossKwh: null,
    batteryNetKwh: null,
    wltpRangeKm: rangeKm,
    realRangeSummerKm: rangeKm ? Math.round(rangeKm * 0.88) : null,
    realRangeWinterKm: rangeKm ? Math.round(rangeKm * 0.72) : null,
    acKw: pt === 'plugin-hybrid' ? 3.6 : 11,
    dcKw: pt === 'elektro' || pt === 'nutzfahrzeug' ? null : null,
    has800V: is800V,
    heatPump,
    v2l: pt === 'elektro' ? null : false,
    v2h: false,
    v2g: false,
  };
}

function buildFamilyBlock(modelKey, attrs, spec) {
  const familySpec = getKiaFamilySpec(modelKey);
  const isofixRearCount = familySpec?.isofixRearCount ?? null;
  return {
    seats: familySpec?.seats ?? attrs?.seats ?? 5,
    isofixRearCount,
    isofixRear: familySpec?.isofixRear ?? (isofixRearCount != null ? isofixRearCount >= 1 : null),
    isofixPassenger: familySpec?.isofixPassenger ?? null,
    trunkL: spec?.trunkL ?? null,
    frunkL: familySpec?.frunkL ?? null,
    slidingDoors: false,
  };
}

function buildComfortDefaults(modelKey) {
  return {
    heatedSeats: S.UNKNOWN,
    steeringHeat: S.UNKNOWN,
    ventilatedSeats: S.UNKNOWN,
    powerTailgate: S.UNKNOWN,
    camera360: S.UNKNOWN,
    hud: S.UNKNOWN,
    matrixLed: S.UNKNOWN,
    panoramaRoof: S.UNKNOWN,
    memorySeats: S.UNKNOWN,
    leather: getKiaLeatherStatus(modelKey),
  };
}

/**
 * @param {import('../kia/kiaOfficialPriceList.js').KiaOfficialModel} official
 * @returns {import('./cleverVehicleRecord.js').CleverVehicleRecord}
 */
export function buildCleverRecordFromOfficial(official) {
  const modelKey = resolveModelKey(official.id);
  const attrs = getAttributes(modelKey);
  const spec = getKiaTechnicalSpec(modelKey) ?? getKiaTechnicalSpec(official.id);
  const familySpec = getKiaFamilySpec(modelKey);
  const towingKg = familySpec?.towCapacityKg
    ?? attrs?.towCapacityKg
    ?? TOWING_BRAKED_KG[modelKey]
    ?? TOWING_BRAKED_KG[official.id]
    ?? null;
  const rangeKm = spec?.electricRangeKm ?? attrs?.typicalRangeKm ?? null;
  const pt = official.powertrain === 'nutzfahrzeug' ? 'elektro' : official.powertrain;
  const isElectric = pt === 'elektro' || pt === 'plugin-hybrid';
  const performance = getKiaPerformanceSpec(modelKey) ?? getKiaPerformanceSpec(official.id);

  return {
    id: `kia-${official.id}`,
    brand: 'Kia',
    model: official.name,
    modelKey,
    basis: {
      powertrain: pt,
      listPriceGross: official.priceFromGross,
      leasingRate: official.monthlyRateFrom,
      financeRate: official.monthlyRateAvailable ? official.monthlyRateFrom : null,
      deliveryWeeks: getKiaDeliveryWeeks(modelKey) ?? getKiaDeliveryWeeks(official.id),
      inStock: false,
      warrantyYears: KIA_WARRANTY_DEFAULT.vehicleYears,
      warrantyKm: KIA_WARRANTY_DEFAULT.vehicleKm,
      batteryWarrantyYears: isElectric ? KIA_WARRANTY_DEFAULT.batteryYears : undefined,
    },
    performance: performance ?? undefined,
    electric: buildElectricBlock(official, attrs, spec),
    family: buildFamilyBlock(modelKey, attrs, spec),
    towing: towingKg != null ? {
      brakedKg: towingKg,
      unbrakedKg: towingKg >= 2000 ? 750 : 500,
      roofLoadKg: null,
      noseWeightKg: null,
    } : undefined,
    dimensions: spec ? {
      lengthMm: spec.lengthMm,
      widthMm: spec.widthMm,
      heightMm: spec.heightMm,
      wheelbaseMm: spec.wheelbaseMm,
      turningCircleM: null,
    } : undefined,
    comfort: buildComfortDefaults(modelKey),
    cleverScores: inferCleverScores(attrs, official, towingKg, rangeKm),
    popularityScore: official.sortOrder <= 120 ? 7 : 6,
  };
}

function deepMergeRecord(base, override) {
  return {
    ...base,
    ...override,
    basis: { ...base.basis, ...override.basis },
    performance: override.performance
      ? { ...(base.performance ?? {}), ...override.performance }
      : base.performance,
    electric: override.electric
      ? { ...(base.electric ?? {}), ...override.electric }
      : base.electric,
    family: { ...base.family, ...override.family },
    towing: override.towing
      ? { ...(base.towing ?? {}), ...override.towing }
      : base.towing,
    dimensions: override.dimensions
      ? { ...(base.dimensions ?? {}), ...override.dimensions }
      : base.dimensions,
    comfort: { ...base.comfort, ...override.comfort },
    cleverScores: { ...base.cleverScores, ...override.cleverScores },
  };
}

/** Alle Kia Clever Records: generiert + Trim-Overrides */
export function buildAllKiaCleverRecords() {
  const generated = KIA_OFFICIAL_MODELS.map(buildCleverRecordFromOfficial);
  const byModelKey = new Map(generated.map((r) => [r.modelKey, r]));

  const records = [...generated];

  for (const override of KIA_CLEVER_RECORD_OVERRIDES) {
    const base = byModelKey.get(override.modelKey);
    const merged = base ? deepMergeRecord(base, override) : override;
    const idx = records.findIndex((r) => r.id === merged.id);
    if (idx >= 0) {
      records[idx] = merged;
    } else {
      records.push(merged);
    }
  }

  return records.sort((a, b) => {
    const ao = KIA_OFFICIAL_MODELS.find((m) => m.id === a.id.replace(/^kia-/, '') || resolveModelKey(m.id) === a.modelKey);
    const bo = KIA_OFFICIAL_MODELS.find((m) => m.id === b.id.replace(/^kia-/, '') || resolveModelKey(m.id) === b.modelKey);
    return (ao?.sortOrder ?? 999) - (bo?.sortOrder ?? 999);
  });
}

export function listOfficialModelKeysWithRecords() {
  return KIA_OFFICIAL_MODELS.map((m) => resolveModelKey(m.id));
}
