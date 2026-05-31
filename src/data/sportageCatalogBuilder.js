/**
 * Generiert Berater-/Sales-Katalogeinträge aus dem zentralen Sportage-Modell.
 * 1 Modell · alle Varianten · 100 % konsistent mit kiaSportage.
 */
import { kiaSportage } from './models/kia/sportage.js';

function fuelCategory(engine) {
  if (!engine) return 'verbrenner';
  if (engine.fuelType === 'Hybrid') return 'hybrid';
  if (engine.fuelType === 'Elektro') return 'elektro';
  return 'verbrenner';
}

function operatingCostLevel(engine) {
  if (!engine) return 3;
  if (engine.fuelType === 'Hybrid') return 2;
  if (engine.fuelType === 'Diesel') return 3;
  return 3;
}

function buildFeatures(trim, engine) {
  const features = {
    'viel-platz': true,
    anhaenger: trim.id !== 'core',
    allrad: engine?.drive === 'AWD',
    kamera360: ['black-edition', 'gt-line'].includes(trim.id),
    panorama: trim.id === 'black-edition' || trim.highlights?.some((h) => /panorama/i.test(h)),
    sitzbelueftung: trim.id === 'gt-line',
    'niedrige-kosten': engine?.fuelType === 'Hybrid',
    reichweite: engine?.fuelType === 'Diesel',
    gewerblich: engine?.fuelType === 'Diesel',
    'schnelle-lieferung': false,
  };
  return features;
}

function variantLabel(trim, engine) {
  const fuelShort = engine?.fuelType === 'Hybrid'
    ? 'Hybrid'
    : engine?.fuelType === 'Diesel'
      ? 'Diesel'
      : engine?.drive === 'AWD'
        ? 'AWD'
        : '';
  return fuelShort ? `${trim.name} ${fuelShort}` : trim.name;
}

export function buildSportageAdvisorEntries() {
  const { engines, trims, variants } = kiaSportage;

  return variants
    .filter((v) => v.available !== false)
    .map((variant) => {
      const engine = engines.find((e) => e.id === variant.engineId);
      const trim = trims.find((t) => t.id === variant.trimId);
      if (!engine || !trim) return null;

      const label = variantLabel(trim, engine);

      return {
        id: variant.id,
        brand: kiaSportage.brand,
        model: kiaSportage.model,
        variant: label,
        variantId: variant.id,
        engineId: variant.engineId,
        trimId: variant.trimId,
        colorId: 'carraraweiss',
        bodyType: 'suv',
        fuelCategory: fuelCategory(engine),
        familyScore: trim.id === 'core' ? 3 : trim.id === 'vision' || trim.id === 'spirit' ? 5 : 4,
        rangeKm: null,
        operatingCostLevel: operatingCostLevel(engine),
        features: buildFeatures(trim, engine),
        highlights: [
          engine.name,
          ...trim.highlights.slice(0, 2),
        ],
        priceGross: variant.priceGross,
        deliveryTypeDefault: variant.deliveryTypeDefault,
      };
    })
    .filter(Boolean);
}

export function buildSportageSalesEntries() {
  return buildSportageAdvisorEntries().map((entry) => ({
    id: entry.id,
    brand: entry.brand,
    model: entry.model,
    variant: entry.variant,
    engineId: entry.engineId,
    trimId: entry.trimId,
    colorId: entry.colorId,
    bodyType: entry.bodyType,
    fuelCategory: entry.fuelCategory,
    highlights: entry.highlights,
  }));
}
