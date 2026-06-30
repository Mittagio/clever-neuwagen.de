/**
 * Modell-Detail- und Spezialberatungsantworten für den geführten Flow.
 */
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { KIA_CLEVER_RECORDS } from '../../data/clever/kiaCleverRecords.js';

function findRecord(modelKey) {
  return KIA_CLEVER_RECORDS.find((r) => r.modelKey === modelKey && !r.trimId)
    ?? KIA_CLEVER_RECORDS.find((r) => r.modelKey === modelKey)
    ?? null;
}

function modelLabel(modelKey) {
  const attr = KIA_MODEL_ATTRIBUTES[modelKey];
  return attr ? `Kia ${attr.label}` : modelKey;
}

/**
 * @param {string} modelKey
 */
export function buildModelDetailFacts(modelKey) {
  const attr = KIA_MODEL_ATTRIBUTES[modelKey];
  const record = findRecord(modelKey);
  if (!attr) return null;

  const bullets = [];
  if (attr.fuel === 'electric') bullets.push('Vollelektrisches Antriebskonzept');
  if (attr.isSevenSeater) bullets.push(`Bis zu ${attr.seats} Sitze – gut für Familien`);
  else bullets.push(`${attr.seats} Sitze`);
  if (attr.typicalRangeKm) bullets.push(`WLTP-Reichweite bis ca. ${attr.typicalRangeKm} km`);
  if (attr.towCapacityKg) bullets.push(`Anhängelast bis ca. ${attr.towCapacityKg} kg`);
  if (record?.dimensions?.lengthMm) {
    bullets.push(`Länge ca. ${Math.round(record.dimensions.lengthMm / 10)} cm`);
  }
  if (record?.family?.trunkVolumeL) {
    bullets.push(`Kofferraum bis ca. ${record.family.trunkVolumeL} Liter`);
  }

  const strengths = [];
  if (attr.isSevenSeater) strengths.push('Viel Platz für Familie und Gepäck');
  if (attr.bodyClass === 'large_suv') strengths.push('Großes SUV mit hohem Komfort');
  if (attr.fuel === 'electric' && attr.typicalRangeKm >= 500) {
    strengths.push('Hohe Reichweite für Langstrecken');
  }
  if (attr.towCapacityKg >= 2000) strengths.push('Starke Anhängelast für Urlaub und Transport');

  const watchOut = [];
  if (attr.fuel === 'electric') watchOut.push('Ladeplanung bei Langstrecken und Anhänger');
  if (attr.isSevenSeater) watchOut.push('7-Sitzer vs. 6-Sitzer und Kofferraum prüfen');
  if (attr.bodyClass === 'large_suv') watchOut.push('Größe im Alltagsverkehr und Parken bedenken');

  const fits = [];
  if (attr.isSevenSeater) fits.push('Familien mit mehreren Kindern');
  if (attr.fuel === 'electric') fits.push('Vielfahrer mit Lademöglichkeit');
  if (attr.towCapacityKg >= 2000) fits.push('Urlaub mit Anhänger oder Wohnwagen');

  return {
    kind: 'model_detail',
    modelKey,
    modelLabel: modelLabel(modelKey),
    headline: `${modelLabel(modelKey)} – Überblick`,
    shortAnswer: `${modelLabel(modelKey)} ist ein ${attr.bodyClass === 'large_suv' ? 'großes Elektro-SUV' : attr.bodyType} von Kia${attr.isSevenSeater ? ' mit bis zu 7 Sitzen' : ''}.`,
    bullets,
    strengths,
    watchOut,
    fits,
    sources: ['kiaModelAttributes', 'kiaCleverRecords'],
  };
}

/**
 * @param {string} modelKey
 */
export function buildFamilyVariantFacts(modelKey) {
  const attr = KIA_MODEL_ATTRIBUTES[modelKey];
  if (!attr) return null;

  const label = modelLabel(modelKey);
  const usefulWhen = [];
  if (attr.isSevenSeater) {
    usefulWhen.push('6- oder 7-Sitzer je nach Bedarf – 7 Sitze bringen Flexibilität, 6 Sitze oft mehr Kofferraum');
    usefulWhen.push('ISOFIX und Sitzkonfiguration im Showroom prüfen');
  } else {
    usefulWhen.push('Kofferraumvolumen und Kindersitze praktisch testen');
  }
  usefulWhen.push('RWD reicht oft im Alltag – AWD bei Schnee und Steigung');
  usefulWhen.push('Reichweite mit Familien-Gepäck realistisch einplanen');

  return {
    kind: 'family_variant_advice',
    modelKey,
    modelLabel: label,
    headline: `Beste ${attr.label}-Variante für Familie`,
    shortAnswer: `Für Familien zählt beim ${label} vor allem Platz, Sitzkonfiguration und Alltagstauglichkeit – nicht nur die Top-Ausstattung.`,
    usefulWhen,
    dealerChecks: [
      '6- vs. 7-Sitzer Verfügbarkeit',
      'Kofferraum mit Kinderwagen',
      'Ausstattungslinie für Familie',
      'Rate / Leasing',
    ],
    dealerCheckHint: 'Ihr Autohaus zeigt die passende Variante im Bestand oder Showroom.',
    sources: ['kiaModelAttributes', 'family_advice'],
  };
}

/**
 * Ambiguous „größtes Elektroauto“ – Klärung statt sofortiges Ranking.
 */
export function buildAmbiguousLargestEvFacts() {
  return {
    kind: 'clarification_largest_ev',
    headline: 'Was meinen Sie mit „größtes“?',
    shortAnswer: '„Größtes Elektroauto“ kann Außenmaße, Kofferraum oder Sitzplätze meinen – je nachdem, was Ihnen wichtig ist.',
    orientation: [
      { label: 'Außenmaße', hint: 'Große SUV und Vans wie EV9' },
      { label: 'Kofferraum', hint: 'EV9, große SUVs und Kombis je nach Datenstand' },
      { label: 'Sitzplätze', hint: 'EV9 und große Vans mit bis zu 7 Sitzen' },
    ],
    sources: ['clarification'],
  };
}

/**
 * @param {string[]} comparisonModels
 */
export function buildContextualComparisonTitle(comparisonModels = []) {
  const labels = comparisonModels.map((k) => KIA_MODEL_ATTRIBUTES[k]?.label ?? k.toUpperCase());
  if (labels.length < 2) return 'Modellvergleich';
  return `${labels[1]} vs. ${labels[0]}: Was passt besser?`;
}
