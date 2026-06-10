/**
 * Sportage-PDF enthält Benzin, Hybrid und Diesel in einer Datei.
 * Hybrid-Varianten → eigenes sportage-hybrid-Importmodul.
 */

const HYBRID_AWD_PRICES = new Set([43490, 47690, 48400, 51190]);

function isSportageHybridVariant(variant) {
  const engine = String(variant.engine ?? '').toLowerCase();
  return engine.includes('hybrid') && !engine.includes('crdi') && !engine.includes('mild');
}

function enrichHybridVariant(variant) {
  const awd = HYBRID_AWD_PRICES.has(variant.priceGross);
  return {
    ...variant,
    engine: 'Benzin, Hybrid 1.6 T-GDI',
    transmission: 'Automatik (6 Stufen)',
    drive: awd ? 'AWD' : '2WD',
    power: '176 kW (239 PS)',
    consumption: awd ? '6,5' : '5,8',
    co2: awd ? '147' : '132',
    co2Class: awd ? 'E' : 'D',
  };
}

function cloneImport(base, overrides) {
  return {
    ...base,
    ...overrides,
    trims: overrides.trims ?? base.trims,
    variants: overrides.variants ?? base.variants,
    trimPricesFrom: overrides.trimPricesFrom ?? base.trimPricesFrom,
    wltpNotes: overrides.wltpNotes ?? base.wltpNotes,
  };
}

/**
 * @param {object} sportageImport
 * @returns {{ sportage: object, sportageHybrid: object|null }}
 */
export function splitSportagePricelist(sportageImport) {
  if (!sportageImport?.variants?.length) {
    return { sportage: sportageImport, sportageHybrid: null };
  }

  const hybridVariants = sportageImport.variants
    .filter(isSportageHybridVariant)
    .map(enrichHybridVariant);
  const combustionVariants = sportageImport.variants.filter((v) => !isSportageHybridVariant(v));

  const hybridTrims = [...new Map(
    hybridVariants.map((v) => [v.trimId, { id: v.trimId, name: v.trim }]),
  ).values()];

  const sportage = cloneImport(sportageImport, {
    modelKey: 'sportage',
    model: 'Sportage',
    powertrainVariant: 'verbrenner',
    variants: combustionVariants,
    variantCount: combustionVariants.length,
    priceFromGross: combustionVariants.length
      ? Math.min(...combustionVariants.map((v) => v.priceGross))
      : sportageImport.priceFromGross,
  });

  if (!hybridVariants.length) {
    return { sportage, sportageHybrid: null };
  }

  const sportageHybrid = cloneImport(sportageImport, {
    modelKey: 'sportage-hybrid',
    model: 'Sportage Hybrid',
    powertrainVariant: 'hybrid',
    sourceFile: sportageImport.sourceFile,
    sourcePdfPath: sportageImport.sourcePdfPath,
    derivedFrom: 'sportage',
    variants: hybridVariants,
    trims: hybridTrims,
    variantCount: hybridVariants.length,
    priceFromGross: Math.min(...hybridVariants.map((v) => v.priceGross)),
    trimPricesFrom: hybridTrims.map((t) => {
      const v = hybridVariants.find((x) => x.trimId === t.id);
      return v ? { trim: t.name, priceFromGross: v.priceGross } : null;
    }).filter(Boolean),
    wltpNotes: [
      'Kia Sportage Hybrid 1.6 T-GDI 2WD (176 kW/239 PS): Kraftstoffverbrauch kombiniert 5,8 l/100 km. CO₂-Emissionen kombiniert 132 g/km. CO₂-Klasse D.',
      'Kia Sportage Hybrid 1.6 T-GDI AWD (176 kW/239 PS): Kraftstoffverbrauch kombiniert 6,5 l/100 km. CO₂-Emissionen kombiniert 147 g/km. CO₂-Klasse E.',
    ],
  });

  return { sportage, sportageHybrid };
}
