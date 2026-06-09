import { computeCleverQuote } from '../cleverQuote/cleverQuoteService.js';
import { compareWishTruthMatches } from '../search/wishMatchRanking.js';
import { getSalesChipById } from '../../data/salesAdvisorChips.js';
import { formatMatchDeliveryLabel } from '../../logic/discoveryDisplay.js';

export const ADVISOR_CLARIFICATION_OPTIONS = [
  { id: 'daily_city', label: 'Stadt', emoji: '🏙' },
  { id: 'daily_family', label: 'Familie', emoji: '👨‍👩‍👧' },
  { id: 'daily_long', label: 'Langstrecke', emoji: '🛣' },
  { id: 'daily_gewerbe', label: 'Gewerbe', emoji: '🏢' },
];

const MODEL_LINE_LABELS = {
  ev2: 'EV2',
  ev3: 'EV3',
  ev4: 'EV4',
  ev5: 'EV5',
  ev6: 'EV6',
  ev9: 'EV9',
  niro: 'Niro EV',
  'pv5-passenger': 'PV5',
  'pv5-cargo': 'PV5 Cargo',
};

const PERIPHERAL_CHIP_PREFIXES = ['fuel_', 'km_', 'avail_'];
const PERIPHERAL_CHIP_IDS = new Set(['mileage_default']);

function isPeripheralChip(chipId) {
  if (PERIPHERAL_CHIP_IDS.has(chipId)) return true;
  return PERIPHERAL_CHIP_PREFIXES.some((p) => chipId.startsWith(p));
}

function hasConcreteContext(chipIds = []) {
  return chipIds.some((id) => {
    if (id.startsWith('daily_') || id.startsWith('type_') || id.startsWith('budget_')) return true;
    const chip = getSalesChipById(id);
    if (!chip) return false;
    if (chip.bodyType || chip.budgetMax != null) return true;
    const metaFeatures = new Set(['elektro', 'benzin', 'family_suv']);
    if (chip.features?.some((f) => !metaFeatures.has(f))) return true;
    return false;
  });
}

/** Nur Antrieb (z. B. „Elektro“) – noch kein Einsatzkontext → nachfragen. */
export function needsWishClarification(chipIds = []) {
  if (!chipIds.length) return false;
  if (!chipIds.some((id) => id.startsWith('fuel_'))) return false;
  if (hasConcreteContext(chipIds)) return false;
  return chipIds.every(isPeripheralChip);
}

export function getModelLineKey(vehicle = {}) {
  const key = String(vehicle.modelKey ?? vehicle.imageModel ?? '').toLowerCase();
  if (key.startsWith('ev5')) return 'ev5';
  if (key.startsWith('ev4')) return 'ev4';
  if (key.startsWith('pv5')) return key.includes('cargo') ? 'pv5-cargo' : 'pv5-passenger';
  return key || String(vehicle.model ?? 'unknown').toLowerCase();
}

export function getModelLineLabel(vehicle = {}) {
  const key = getModelLineKey(vehicle);
  return MODEL_LINE_LABELS[key] ?? vehicle.model ?? key.toUpperCase();
}

export function getClarificationAntriebLabel(chipIds = []) {
  const fuelChip = chipIds.find((id) => id.startsWith('fuel_'));
  const chip = fuelChip ? getSalesChipById(fuelChip) : null;
  return chip?.label ?? 'Ihr Antriebswunsch';
}

export function pickBestVariantPerModelLine(matches = []) {
  const byLine = new Map();
  for (const match of matches) {
    const line = getModelLineKey(match.vehicle);
    const existing = byLine.get(line);
    const score = match._advisorRaw ?? match.score ?? 0;
    const existingScore = existing?._advisorRaw ?? existing?.score ?? 0;
    if (!existing || score > existingScore) {
      byLine.set(line, match);
    }
  }
  return [...byLine.values()];
}

function useCaseBonus(modelKey, chipIds = []) {
  let bonus = 0;
  if (chipIds.includes('daily_city')) {
    if (modelKey === 'ev2' || modelKey === 'picanto') bonus += 15;
    if (modelKey === 'ev6' || modelKey === 'ev9') bonus -= 5;
  }
  if (chipIds.includes('daily_family') || chipIds.includes('type_familie')) {
    if (['ev3', 'ev5', 'ev5-gt'].includes(modelKey)) bonus += 12;
    if (modelKey === 'ev4') bonus += 5;
    if (modelKey === 'ev2') bonus -= 8;
  }
  if (chipIds.includes('daily_long')) {
    if (['ev6', 'ev9'].includes(modelKey)) bonus += 15;
    if (modelKey === 'ev4') bonus += 12;
    if (modelKey === 'ev3') bonus += 8;
  }
  if (chipIds.includes('daily_gewerbe')) {
    if (modelKey.startsWith('pv5')) bonus += 15;
    if (modelKey === 'ev5' || modelKey.startsWith('ev5')) bonus += 8;
  }
  return bonus;
}

export function computeAdvisorRawScore(match, { wishes, chipIds = [] } = {}) {
  const v = match?.vehicle ?? {};
  const modelKey = v.modelKey ?? '';
  let score = typeof match?.score === 'number' ? match.score : 50;

  const range = Number(v.rangeKm ?? v.wltpRange) || 0;
  if (range > 0) score += Math.min(15, range / 35);

  const rate = match.displayRate ?? match.bestOffer?.monthlyRate ?? v.monthlyRate;
  const budgetMax = wishes?.budget?.maxMonthlyRate;
  if (budgetMax != null && rate != null) {
    if (rate <= budgetMax) score += 10 + Math.min(5, (budgetMax - rate) / 20);
    else score -= Math.min(25, (rate - budgetMax) / 10);
  } else if (rate != null) {
    score += Math.max(0, 8 - Math.max(0, rate - 250) / 30);
  }

  if (v.availability === 'sofort') score += 5;

  const matched = match.matchedFeatures?.length ?? 0;
  const missing = match.missingFeatures?.length ?? 0;
  score += matched * 3 - missing * 4;

  score += useCaseBonus(modelKey, chipIds);

  if (wishes?.powertrain === 'elektro' && v.powertrain === 'elektro' && !chipIds.some((id) => id.startsWith('daily_'))) {
    if (modelKey === 'ev3') score += 3;
    if (modelKey === 'ev2') score += 2;
    if (modelKey === 'ev4') score += 1;
  }

  return score;
}

function spreadAdvisorCleverQuotes(matches = []) {
  if (!matches.length) return [];
  const sorted = [...matches].sort((a, b) => {
    if (a.evaluation || b.evaluation || a.cleverQuote?.unknownCount != null) {
      return compareWishTruthMatches(a, b);
    }
    return (b._advisorRaw ?? 0) - (a._advisorRaw ?? 0);
  });

  return sorted.map((match, index) => ({
    ...match,
    cleverQuote: {
      ...(match.cleverQuote ?? {}),
      advisorMode: true,
      trustNote: index === 0 && sorted.length > 1
        ? 'Beste CleverQuote aller geprüften Modelllinien'
        : match.cleverQuote?.trustNote,
    },
  }));
}

/**
 * Berater-Pipeline: pro Modelllinie bester Treffer → differenzierte CleverQuote → sortiert.
 */
export function finalizeAdvisorMatches(rankedMatches = [], { wishes, chipIds = [], limit = 12 } = {}) {
  if (!rankedMatches.length) return [];

  const withRaw = rankedMatches.map((match) => ({
    ...match,
    _advisorRaw: computeAdvisorRawScore(match, { wishes, chipIds }),
  }));

  const diversified = pickBestVariantPerModelLine(withRaw);

  const withQuote = diversified.map((match) => ({
    ...match,
    cleverQuote: computeCleverQuote({
      vehicle: match.vehicle,
      wishes,
      match,
      trimId: match.bestTrimId,
    }),
  }));

  const rescored = withQuote.map((match) => ({
    ...match,
    _advisorRaw: computeAdvisorRawScore(match, { wishes, chipIds }),
  }));

  const spread = spreadAdvisorCleverQuotes(rescored);

  if (spread.length > 0) {
    spread[0] = {
      ...spread[0],
      cleverQuote: {
        ...spread[0].cleverQuote,
        trustNote: spread.length > 1
          ? 'Beste CleverQuote aller geprüften Modelllinien'
          : spread[0].cleverQuote?.trustNote,
      },
    };
  }

  return spread.slice(0, limit);
}

export function shouldApplyAdvisorRanking(filters = {}, wishes = {}) {
  return filters.fuel === 'elektro'
    || wishes.features?.includes('elektro')
    || wishes.powertrain === 'elektro';
}

export function deriveAdvisorChipIds(filters = {}, wishes = {}) {
  const chipIds = [];
  const fuel = filters.fuel;
  if (fuel === 'elektro' || wishes.features?.includes('elektro')) chipIds.push('fuel_elektro');
  else if (fuel === 'hybrid') chipIds.push('fuel_hybrid');
  else if (fuel === 'plugin-hybrid' || fuel === 'plugin_hybrid') chipIds.push('fuel_phev');
  else if (fuel === 'diesel') chipIds.push('fuel_diesel');
  else if (fuel === 'verbrenner' || fuel === 'benzin') chipIds.push('fuel_benzin');

  if (filters.maxRate != null) {
    const tiers = [250, 300, 400, 500, 600];
    const tier = tiers.find((t) => t >= filters.maxRate) ?? tiers[tiers.length - 1];
    chipIds.push(`budget_${tier}`);
  }

  const useCase = filters.useCase;
  if (useCase === 'city' || useCase === 'stadt') chipIds.push('daily_city');
  if (useCase === 'family' || useCase === 'familie') chipIds.push('daily_family');
  if (useCase === 'long' || useCase === 'langstrecke') chipIds.push('daily_long');
  if (useCase === 'gewerbe') chipIds.push('daily_gewerbe');

  if (wishes.usage?.includes('family')) chipIds.push('daily_family');

  const q = (wishes.rawQuery ?? filters.query ?? '').toLowerCase();
  if (!chipIds.some((id) => id.startsWith('daily_'))) {
    if (/stadt|city|pendel/i.test(q)) chipIds.push('daily_city');
    if (/familie|kinder|family/i.test(q)) chipIds.push('daily_family');
    if (/langstrecke|autobahn|lange\s*strecke/i.test(q)) chipIds.push('daily_long');
    if (/gewerbe|firma|flotte|nutzfahrzeug/i.test(q)) chipIds.push('daily_gewerbe');
  }

  if (filters.type === 'suv' || wishes.vehicleType === 'SUV') chipIds.push('type_suv');
  if (filters.type === 'kleinwagen') chipIds.push('type_kleinwagen');

  return chipIds;
}

/** Fahrzeugsuche: nur „Elektro“ ohne Kontext → Einsatz nachfragen. */
export function needsDiscoveryClarification(filters = {}, wishes = {}) {
  if (filters.useCase) return false;
  if (!shouldApplyAdvisorRanking(filters, wishes)) return false;
  if (filters.model || filters.modelExplicit) return false;
  if (filters.maxRate != null || wishes.budget?.maxMonthlyRate) return false;
  if (wishes.usage?.length) return false;
  if (wishes.vehicleType) return false;
  if (filters.type && filters.type !== 'all' && filters.type !== 'elektro') return false;

  const extraFeatures = (wishes.features ?? []).filter(
    (f) => !['elektro', 'benzin', 'reichweite'].includes(f),
  );
  if (extraFeatures.length) return false;

  const q = (filters.query ?? '').trim();
  if (!q) return false;
  if (/familie|stadt|lang|gewerbe|budget|unter|suv|kombi|van|familien/i.test(q)) return false;

  const tokens = q.toLowerCase().replace(/[^a-zäöüß0-9\s-]/gi, ' ').split(/\s+/).filter(Boolean);
  const elektroTokens = new Set(['elektro', 'elektroauto', 'e-auto', 'eauto', 'ev', 'stromer', 'bev']);
  return tokens.length <= 3 && tokens.every((t) => elektroTokens.has(t) || t.length <= 2);
}

export function rankAdvisorDiscoveryMatches(matches = [], { wishes, filters, chipIds = [], limit = 12 } = {}) {
  if (!shouldApplyAdvisorRanking(filters, wishes) || !matches.length) {
    return matches.slice(0, limit);
  }
  const ids = chipIds.length ? chipIds : deriveAdvisorChipIds(filters, wishes);
  return finalizeAdvisorMatches(matches, { wishes, chipIds: ids, limit });
}

export function buildAdvisorWhyBullets(match, {
  wishes,
  allMatches = [],
  maxReasons = 5,
  chipIds = [],
} = {}) {
  const bullets = [];
  const seen = new Set();
  const vehicle = match?.vehicle ?? {};
  const modelKey = vehicle.modelKey ?? '';
  const lineLabel = getModelLineLabel(vehicle);

  function push(text) {
    const key = text.toLowerCase();
    if (!text || seen.has(key)) return;
    seen.add(key);
    bullets.push(text);
  }

  const rank = allMatches.findIndex((m) => m.slug === match.slug);
  if (rank === 0 && allMatches.length > 1) {
    push('Beste CleverQuote aller geprüften Modelle');
  }

  if (chipIds.includes('daily_family') || chipIds.includes('type_familie')) {
    const hasEv2 = allMatches.some((m) => getModelLineKey(m.vehicle) === 'ev2');
    if (hasEv2 && modelKey === 'ev3') {
      push('Familienfreundlicher als EV2');
    }
    if (['ev3', 'ev5', 'ev5-gt', 'ev6'].includes(modelKey)) {
      push('Mehr Platz für Familie als Kompakt-Modelle');
    }
  }

  if (chipIds.includes('daily_city') && (modelKey === 'ev2' || modelKey === 'picanto')) {
    push('Kompakt und wendig für die Stadt');
  }

  if (chipIds.includes('daily_long')) {
    const myRange = Number(vehicle.rangeKm ?? vehicle.wltpRange) || 0;
    if (myRange >= 450) push('Ideal für lange Strecken');
  }

  const myRange = Number(vehicle.rangeKm ?? vehicle.wltpRange) || 0;
  if (myRange > 0) {
    for (const other of allMatches) {
      if (other.slug === match.slug) continue;
      const otherRange = Number(other.vehicle?.rangeKm ?? other.vehicle?.wltpRange) || 0;
      if (otherRange > 0 && myRange > otherRange + 25) {
        push(`Mehr Reichweite als ${getModelLineLabel(other.vehicle)}`);
        break;
      }
    }
  }

  const budgetMax = wishes?.budget?.maxMonthlyRate;
  const rate = match.displayRate ?? match.bestOffer?.monthlyRate ?? vehicle.monthlyRate;
  if (budgetMax != null && rate != null && rate <= budgetMax) {
    push(`Unter Ihrem Budget von ${budgetMax} €`);
  }

  const delivery = formatMatchDeliveryLabel(match);
  if (delivery) {
    if (/sofort/i.test(delivery)) {
      push('Sofort verfügbar');
    } else if (/^Lieferbar/i.test(delivery)) {
      push(delivery);
    } else if (/\d+\s*Woche/i.test(delivery)) {
      const cleaned = delivery.replace(/^Lieferzeit\s*/i, '').trim();
      push(`Lieferbar in ${cleaned}`);
    } else {
      push(delivery);
    }
  }

  if (vehicle.powertrain === 'elektro' && wishes?.powertrain === 'elektro') {
    push('100 % elektrisch');
  }

  if (bullets.length < maxReasons && lineLabel) {
    const cheaper = allMatches.find((m) => {
      if (m.slug === match.slug) return false;
      const otherRate = m.displayRate ?? m.bestOffer?.monthlyRate ?? m.vehicle?.monthlyRate;
      return rate != null && otherRate != null && rate < otherRate - 15;
    });
    if (cheaper && rank === 0) {
      push(`Ausgewogenes Gesamtpaket trotz höherer Rate als ${getModelLineLabel(cheaper.vehicle)}`);
    }
  }

  return bullets.slice(0, maxReasons);
}
