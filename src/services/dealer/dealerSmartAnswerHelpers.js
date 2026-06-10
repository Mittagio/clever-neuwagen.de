import { buildVehicleLexicon } from '../lexicon/vehicleLexiconService.js';

const ATTRIBUTE_LABELS = {
  range: 'WLTP-Reichweite',
  trunk: 'Kofferraum',
  tow: 'Anhängelast',
  seats: 'Sitzplätze',
  length: 'Länge',
  height: 'Höhe',
  price: 'Preis ab',
};

function formatMmAsM(mm) {
  if (mm == null) return null;
  return `${(mm / 1000).toFixed(2).replace('.', ',')} m`;
}

export function formatAttributeValue(entry, attribute) {
  const f = entry.facts ?? {};
  switch (attribute) {
    case 'range':
      return f.rangeKm != null ? `${f.rangeKm} km WLTP` : null;
    case 'trunk':
      return f.trunkL != null ? `${f.trunkL} Liter` : null;
    case 'tow':
      return f.towBrakedKg != null
        ? `${Math.round(f.towBrakedKg / 100) / 10} Tonnen`
        : null;
    case 'seats':
      return f.seats != null ? `${f.seats} Sitze` : null;
    case 'length':
      return f.lengthMm != null ? formatMmAsM(f.lengthMm) : null;
    case 'height':
      return f.heightMm != null ? formatMmAsM(f.heightMm) : null;
    case 'price':
      return f.priceFromGross != null
        ? `${f.priceFromGross.toLocaleString('de-DE')} €`
        : null;
    default:
      return null;
  }
}

export function pickHighlightDetail(entry, profile = {}) {
  const f = entry.facts ?? {};
  if (profile.rangeRanking === 'max' || profile.rangeKmMin != null || profile.minRangeKm != null) {
    if (f.rangeKm != null) return `${f.rangeKm} km WLTP`;
  }
  if (profile.towCapacityKg != null && f.towBrakedKg != null) {
    return `Anhängelast ${Math.round(f.towBrakedKg / 100) / 10} t`;
  }
  if (profile.seatsMin != null && f.seats != null) return `${f.seats} Sitze`;
  if (profile.trunkLMin != null && f.trunkL != null) return `Kofferraum ${f.trunkL} l`;
  if (profile.maxHeightMm != null && f.heightMm != null) return `Höhe ${formatMmAsM(f.heightMm)}`;
  if (profile.maxLengthMm != null && f.lengthMm != null) return `Länge ${formatMmAsM(f.lengthMm)}`;
  if (profile.isofixRearMin != null && f.isofixRearCount != null) {
    return `${f.isofixRearCount}× Isofix hinten`;
  }
  if (f.rangeKm != null) return `${f.rangeKm} km WLTP`;
  if (f.towBrakedKg != null) return `Anhängelast ${Math.round(f.towBrakedKg / 100) / 10} t`;
  if (f.trunkL != null) return `Kofferraum ${f.trunkL} l`;
  if (f.seats != null) return `${f.seats} Sitze`;
  return entry.factLine ?? null;
}

export function relatedLexiconEntries(lexicon, modelKey) {
  if (modelKey === 'ev9') {
    return lexicon.filter((e) => e.modelKey === 'ev9' || e.modelKey === 'ev9-gt');
  }
  if (modelKey === 'ev6') {
    return lexicon.filter((e) => e.modelKey === 'ev6' || e.modelKey === 'ev6-gt');
  }
  if (modelKey === 'ev5') {
    return lexicon.filter((e) => e.modelKey === 'ev5' || e.modelKey === 'ev5-gt');
  }
  if (modelKey === 'ev4') {
    return lexicon.filter((e) => e.modelKey === 'ev4' || e.modelKey === 'ev4-fastback');
  }
  const exact = lexicon.filter((e) => e.modelKey === modelKey);
  if (exact.length) return exact;
  return lexicon.filter((e) => e.modelKey.startsWith(`${modelKey}-`));
}

export { ATTRIBUTE_LABELS, buildVehicleLexicon };
