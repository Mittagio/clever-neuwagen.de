/**
 * Fahrzeug-Lexikon – faktenbasierte Antworten aus Clever Records + Bestand.
 * Keine KI-Schätzungen: Parser → SearchProfile → CleverVehicleRecord.
 */
import { KIA_CLEVER_RECORDS } from '../../data/clever/kiaCleverRecords.js';
import { enrichVehicleWithCleverRecord } from '../../data/clever/cleverDataRegistry.js';
import { parseSearchIntent } from '../search/searchIntentParser.js';
import { buildSearchProfile } from '../search/searchProfile.js';
import { passesHardRules } from '../search/hardExclusionRules.js';
import { evaluateVehicleForProfile } from '../cleverData/cleverDataEngine.js';
import { dedupeMatchesByModelLine } from '../search/modelLineGroups.js';
import { getQuestionById, CUSTOMER_QUESTION_CATEGORIES } from '../../data/search/customerQuestionCatalog.js';
import { resolveModelAttributeKey } from '../../data/kia/kiaModelAttributes.js';

/** @typedef {{
 *   modelKey: string,
 *   label: string,
 *   powertrain: string|null,
 *   facts: {
 *     trunkL: number|null,
 *     lengthMm: number|null,
 *     heightMm: number|null,
 *     widthMm: number|null,
 *     seats: number|null,
 *     rangeKm: number|null,
 *     towBrakedKg: number|null,
 *     isofixRearCount: number|null,
 *     priceFromGross: number|null,
 *   },
 * }} LexiconEntry */

/**
 * Stammdaten-Lexikon je Kia-Modelllinie (ohne Trim-Duplikate).
 * @returns {LexiconEntry[]}
 */
export function buildVehicleLexicon() {
  const byKey = new Map();

  for (const record of KIA_CLEVER_RECORDS) {
    if (byKey.has(record.modelKey)) continue;
    byKey.set(record.modelKey, {
      modelKey: record.modelKey,
      label: `Kia ${record.model}`,
      powertrain: record.basis?.powertrain ?? null,
      facts: {
        trunkL: record.family?.trunkL ?? null,
        lengthMm: record.dimensions?.lengthMm ?? null,
        heightMm: record.dimensions?.heightMm ?? null,
        widthMm: record.dimensions?.widthMm ?? null,
        seats: record.family?.seats ?? null,
        rangeKm: record.electric?.wltpRangeKm ?? null,
        towBrakedKg: record.towing?.brakedKg ?? null,
        isofixRearCount: record.family?.isofixRearCount ?? null,
        priceFromGross: record.basis?.listPriceGross ?? null,
      },
    });
  }

  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label, 'de'));
}

function formatMmAsM(mm) {
  if (mm == null) return null;
  const m = mm / 1000;
  return `${m.toFixed(2).replace('.', ',')} m`;
}

function findLexiconEntry(lexicon, vehicle = {}) {
  const attrKey = resolveModelAttributeKey(vehicle);
  const modelKey = vehicle.modelKey ?? vehicle.cleverRecord?.modelKey ?? attrKey;
  if (!modelKey) return null;
  return lexicon.find((e) => e.modelKey === modelKey)
    ?? (attrKey ? lexicon.find((e) => e.modelKey === attrKey) : null)
    ?? null;
}

function formatFactLine(entry) {
  const parts = [];
  const f = entry.facts;
  if (f.trunkL != null) parts.push(`Kofferraum ${f.trunkL} l`);
  if (f.lengthMm != null) parts.push(`Länge ${formatMmAsM(f.lengthMm)}`);
  if (f.heightMm != null) parts.push(`Höhe ${formatMmAsM(f.heightMm)}`);
  if (f.seats != null) parts.push(`${f.seats} Sitze`);
  if (f.rangeKm != null) parts.push(`${f.rangeKm} km WLTP`);
  if (f.towBrakedKg != null) parts.push(`AHK ${Math.round(f.towBrakedKg / 100) / 10} t`);
  return parts.join(' · ');
}

function profileSummary(profile) {
  const parts = [];
  if (profile.trunkLMin != null) parts.push(`Kofferraum ≥ ${profile.trunkLMin} l`);
  if (profile.trunkDepthCmMin != null) parts.push(`Laderaumlänge ≥ ${profile.trunkDepthCmMin} cm`);
  if (profile.maxLengthMm != null) parts.push(`Länge ≤ ${formatMmAsM(profile.maxLengthMm)}`);
  if (profile.maxHeightMm != null) parts.push(`Höhe ≤ ${formatMmAsM(profile.maxHeightMm)}`);
  if (profile.seatsMin != null) parts.push(`≥ ${profile.seatsMin} Sitze`);
  if (profile.rangeKmMin != null) parts.push(`Reichweite ≥ ${profile.rangeKmMin} km`);
  if (profile.towCapacityKg != null) parts.push(`Anhängelast ≥ ${profile.towCapacityKg} kg`);
  if (profile.fuel === 'elektro') parts.push('Elektro');
  return parts.join(' · ') || 'allgemeine Suche';
}

/**
 * @param {object} profile
 * @param {LexiconEntry[]} lexicon
 */
/**
 * @param {LexiconEntry[]} lexicon
 * @param {object[]} vehicles
 */
function answerMaxRangeRanking(lexicon, vehicles = []) {
  const rankedAll = lexicon
    .filter((e) => e.facts.rangeKm != null)
    .sort((a, b) => b.facts.rangeKm - a.facts.rangeKm);

  let ranked = rankedAll;
  if (vehicles.length) {
    const stockKeys = new Set(
      vehicles
        .map((v) => enrichVehicleWithCleverRecord(v))
        .map((v) => v.modelKey ?? v.cleverRecord?.modelKey)
        .filter(Boolean),
    );
    const inStock = rankedAll.filter((e) => stockKeys.has(e.modelKey));
    if (inStock.length) ranked = inStock;
  }

  const top = ranked.slice(0, 8);
  const leader = top[0];

  return {
    kind: 'ranking',
    ranking: 'max_range',
    queryInterpretation: 'Längste WLTP-Reichweite (Elektro)',
    headline: leader
      ? `${leader.label} führt mit ${leader.facts.rangeKm} km WLTP`
      : 'Keine Reichweitenangaben in den Kia-Stammdaten',
    matches: top.map((entry, index) => ({
      modelKey: entry.modelKey,
      label: entry.label,
      rank: index + 1,
      facts: entry.facts,
      factLine: formatFactLine(entry),
    })),
    lexiconSize: lexicon.length,
  };
}

function answerTrunkDepthGap(profile, lexicon) {
  const minCm = profile.trunkDepthCmMin;
  const withVolume = lexicon
    .filter((e) => e.facts.trunkL != null)
    .sort((a, b) => b.facts.trunkL - a.facts.trunkL);

  return {
    kind: 'data_gap',
    queryInterpretation: `Kofferraum-Laderaumlänge ≥ ${minCm} cm`,
    headline: 'Laderaumlänge in cm ist in den Kia-Stammdaten nicht hinterlegt',
    explanation:
      'Clever nutzt offizielle Kia-Angaben: Kofferraumvolumen in Litern, Fahrzeuglänge/-höhe in mm. '
      + 'Die tiefe Ladefläche in Zentimetern steht in den Preislisten nicht zur Verfügung.',
    suggestion: 'Fragen Sie z. B. nach „Kofferraum mindestens 500 Liter“ oder „großer Kofferraum“.',
    topByVolume: withVolume.slice(0, 6).map((e) => ({
      modelKey: e.modelKey,
      label: e.label,
      detail: formatFactLine(e),
    })),
    catalogQuestionId: 'trunk_depth_cm',
  };
}

/**
 * @param {string} query
 * @param {object[]} [vehicles] – Bestand (z. B. Trinkle); sonst Lexikon-Ebene
 */
export function answerVehicleLexiconQuery(query, vehicles = []) {
  const intent = parseSearchIntent(query);
  const profile = buildSearchProfile({ intent, query });
  const lexicon = buildVehicleLexicon();

  if (profile.rangeRanking === 'max' || intent.rangeRanking === 'max') {
    return answerMaxRangeRanking(lexicon, vehicles);
  }

  if (profile.trunkDepthCmMin != null) {
    return answerTrunkDepthGap(profile, lexicon);
  }

  const pool = vehicles.length
    ? vehicles.map((v) => enrichVehicleWithCleverRecord(v))
    : lexicon.map((entry) => enrichVehicleWithCleverRecord({
      brand: 'Kia',
      model: entry.label.replace(/^Kia\s+/, ''),
      modelKey: entry.modelKey,
      powertrain: entry.powertrain,
    }));

  const scored = pool
    .map((vehicle) => ({
      vehicle,
      evaluation: evaluateVehicleForProfile(profile, vehicle),
    }))
    .filter((row) => passesHardRules(row.vehicle, profile));

  const deduped = dedupeMatchesByModelLine(
    scored.map((row) => ({
      vehicle: row.vehicle,
      wishPercent: row.evaluation.cleverQuotePercent ?? row.evaluation.wishPercent ?? 0,
      evaluation: row.evaluation,
    })),
  );

  const matches = deduped
    .sort((a, b) => (b.wishPercent ?? 0) - (a.wishPercent ?? 0))
    .slice(0, 8)
    .map((row) => {
      const lex = findLexiconEntry(lexicon, row.vehicle);
      const key = row.vehicle.modelKey ?? lex?.modelKey ?? row.vehicle.cleverRecord?.modelKey;
      return {
        modelKey: key,
        label: lex?.label ?? `Kia ${row.vehicle.model ?? key}`,
        wishPercent: row.wishPercent,
        facts: lex?.facts ?? null,
        factLine: lex ? formatFactLine(lex) : null,
      };
    });

  return {
    kind: 'matches',
    queryInterpretation: profileSummary(profile),
    headline: matches.length
      ? `${matches.length} Modelllinie${matches.length === 1 ? '' : 'n'} passen zu Ihrer Frage`
      : 'Kein Modell erfüllt alle Kriterien',
    matches,
    lexiconSize: lexicon.length,
    categories: CUSTOMER_QUESTION_CATEGORIES,
    matchedQuestion: profile.trunkLMin != null ? getQuestionById('trunk_large') : null,
  };
}

export { buildVehicleLexicon as buildKiaVehicleLexicon };
