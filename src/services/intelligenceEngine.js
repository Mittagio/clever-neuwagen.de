/**
 * Clever Intelligence – Markt- & Entscheidungs-Analytics
 * Mock-Daten heute · Architektur für echte Events aus Berater, Leads, Angebote, Verkäufe
 */

import { getAdvisorAnalytics } from './advisorAnalytics.js';
import { getAssistantAnalytics } from './assistantAnalytics.js';
import {
  hasLiveIntelligenceData,
  getLiveSearchBehavior,
  getLiveRecommendationStats,
  getLiveComparisonRanking,
  getLiveLeasingTrends,
  getLiveOffersIntelligence,
  getLiveSalesIntelligence,
  getLiveEquipmentDemand,
  getLiveOverviewKpis,
  getLiveFamilyIndex,
  getLiveElectroIndex,
  getLiveDeliveryMonitor,
  getLiveBestDeals,
  recordIntelligenceSearch as persistSearchEvent,
  recordIntelligenceComparison as persistComparisonEvent,
  recordIntelligenceSale as persistSaleEvent,
} from './intelligenceAnalytics.js';
import { generateIntelligenceTrendPages, getMockTrendPages } from './intelligenceTrendPages.js';
import { CLEVER_SCORE_WEIGHTS, calculateCleverScore, updateCleverScoreWeights } from './cleverScore.js';

export { CLEVER_SCORE_WEIGHTS, calculateCleverScore, updateCleverScoreWeights };

export const TIME_PERIODS = [
  { id: 'today', label: 'Heute' },
  { id: '7d', label: '7 Tage' },
  { id: '30d', label: '30 Tage' },
];

export const INTELLIGENCE_SECTIONS = [
  { id: 'overview', label: 'Übersicht' },
  { id: 'search', label: 'Suchverhalten' },
  { id: 'recommendations', label: 'Empfehlungen' },
  { id: 'comparisons', label: 'Vergleiche' },
  { id: 'offers', label: 'Angebote' },
  { id: 'sales', label: 'Verkäufe' },
  { id: 'trends', label: 'Trends' },
];

const PERIOD_MULTIPLIERS = { today: 0.08, '7d': 1, '30d': 3.6 };

const MOCK_SEARCH_QUERIES = [
  { query: 'Familienauto', base: 142 },
  { query: 'SUV', base: 118 },
  { query: 'Elektroauto', base: 96 },
  { query: 'Anhängerkupplung', base: 74 },
  { query: '350 € Rate', base: 68 },
  { query: '400 € Rate', base: 61 },
  { query: 'Hybrid', base: 54 },
  { query: 'Leasing', base: 49 },
  { query: 'Firmenwagen', base: 41 },
  { query: 'Kombi', base: 38 },
];

const MOCK_RECOMMENDATIONS = [
  { vehicleId: 'ev3-long-range', label: 'Kia EV3 Long Range', recommended: 312, offerRequests: 89, closed: 14 },
  { vehicleId: 'sportage-hybrid-vision', label: 'Kia Sportage Hybrid Vision', recommended: 287, offerRequests: 102, closed: 19 },
  { vehicleId: 'ev4-earth', label: 'Kia EV4 Earth', recommended: 241, offerRequests: 67, closed: 11 },
  { vehicleId: 'ev3-air', label: 'Kia EV3 Air', recommended: 198, offerRequests: 54, closed: 8 },
  { vehicleId: 'sportage-plug-in', label: 'Kia Sportage Plug-in Hybrid', recommended: 176, offerRequests: 48, closed: 7 },
  { vehicleId: 'ev5-long-range', label: 'Kia EV5 Long Range', recommended: 134, offerRequests: 31, closed: 4 },
];

const MOCK_COMPARISONS = [
  { pair: 'EV3 vs EV4', vehicleA: 'Kia EV3', vehicleB: 'Kia EV4', count: 186 },
  { pair: 'Sportage vs Tiguan', vehicleA: 'Kia Sportage', vehicleB: 'VW Tiguan', count: 154 },
  { pair: 'EV4 vs Model Y', vehicleA: 'Kia EV4', vehicleB: 'Tesla Model Y', count: 121 },
  { pair: 'EV3 vs Sportage Hybrid', vehicleA: 'Kia EV3', vehicleB: 'Sportage Hybrid', count: 98 },
  { pair: 'Sportage vs RAV4', vehicleA: 'Kia Sportage', vehicleB: 'Toyota RAV4', count: 76 },
  { pair: 'EV3 vs ID.4', vehicleA: 'Kia EV3', vehicleB: 'VW ID.4', count: 64 },
];

const MOCK_LEASING_RATES = [
  { rate: 299, count: 89 },
  { rate: 349, count: 142 },
  { rate: 399, count: 178 },
  { rate: 449, count: 96 },
  { rate: 499, count: 54 },
];

const MOCK_LEASING_TERMS = [
  { months: 36, count: 124 },
  { months: 48, count: 198 },
  { months: 60, count: 87 },
  { months: 24, count: 42 },
];

const MOCK_MILEAGES = [
  { km: 10000, count: 98 },
  { km: 15000, count: 156 },
  { km: 20000, count: 134 },
  { km: 25000, count: 72 },
];

const MOCK_FAMILY_INDEX = [
  { rank: 1, label: 'Kia EV3 Long Range', rate: 349, deliveryWeeks: 5, score: 92, demand: 94 },
  { rank: 2, label: 'Kia Sportage Hybrid Vision', rate: 379, deliveryWeeks: 4, score: 89, demand: 91 },
  { rank: 3, label: 'Kia Sportage 1.6 T-GDI Vision', rate: 329, deliveryWeeks: 3, score: 86, demand: 78 },
  { rank: 4, label: 'Kia EV4 Earth', rate: 399, deliveryWeeks: 8, score: 84, demand: 82 },
  { rank: 5, label: 'Kia Sportage Plug-in Hybrid', rate: 429, deliveryWeeks: 6, score: 81, demand: 74 },
  { rank: 6, label: 'Kia Sorento Hybrid', rate: 489, deliveryWeeks: 7, score: 79, demand: 68 },
  { rank: 7, label: 'Kia Ceed SW', rate: 279, deliveryWeeks: 4, score: 76, demand: 61 },
  { rank: 8, label: 'Kia Niro Hybrid', rate: 319, deliveryWeeks: 5, score: 74, demand: 58 },
  { rank: 9, label: 'Kia EV5 Long Range', rate: 449, deliveryWeeks: 10, score: 72, demand: 55 },
  { rank: 10, label: 'Kia Sportage Mild Hybrid', rate: 299, deliveryWeeks: 2, score: 70, demand: 52 },
];

const MOCK_ELECTRO_INDEX = [
  { rank: 1, label: 'Kia EV3 Long Range', rangeKm: 600, rate: 349, deliveryWeeks: 5, demand: 96 },
  { rank: 2, label: 'Kia EV4 Earth', rangeKm: 625, rate: 399, deliveryWeeks: 8, demand: 88 },
  { rank: 3, label: 'Kia EV3 Air', rangeKm: 436, rate: 299, deliveryWeeks: 4, demand: 82 },
  { rank: 4, label: 'Kia EV5 Long Range', rangeKm: 720, rate: 449, deliveryWeeks: 10, demand: 71 },
  { rank: 5, label: 'Kia EV6 GT-Line', rangeKm: 528, rate: 479, deliveryWeeks: 6, demand: 64 },
  { rank: 6, label: 'Kia EV9 Earth', rangeKm: 512, rate: 699, deliveryWeeks: 12, demand: 48 },
  { rank: 7, label: 'Kia EV4 Air', rangeKm: 490, rate: 359, deliveryWeeks: 7, demand: 45 },
  { rank: 8, label: 'Kia EV3 GT-Line', rangeKm: 560, rate: 419, deliveryWeeks: 6, demand: 41 },
  { rank: 9, label: 'Kia Niro EV', rangeKm: 460, rate: 389, deliveryWeeks: 5, demand: 38 },
  { rank: 10, label: 'Kia Soul EV', rangeKm: 452, rate: 369, deliveryWeeks: 8, demand: 29 },
];

const MOCK_DELIVERY = [
  { model: 'Sportage Mild Hybrid', minWeeks: 2, maxWeeks: 4, avgWeeks: 3 },
  { model: 'Sportage 1.6 T-GDI', minWeeks: 3, maxWeeks: 5, avgWeeks: 4 },
  { model: 'EV3 Air', minWeeks: 4, maxWeeks: 6, avgWeeks: 5 },
  { model: 'EV3 Long Range', minWeeks: 4, maxWeeks: 8, avgWeeks: 5 },
  { model: 'Sportage Hybrid', minWeeks: 4, maxWeeks: 6, avgWeeks: 5 },
  { model: 'EV4 Earth', minWeeks: 6, maxWeeks: 12, avgWeeks: 8 },
  { model: 'EV5 Long Range', minWeeks: 8, maxWeeks: 14, avgWeeks: 10 },
  { model: 'EV9 Earth', minWeeks: 10, maxWeeks: 16, avgWeeks: 12 },
];

const MOCK_BEST_DEALS = [
  {
    vehicleId: 'ev3-air',
    label: 'Kia EV3 Air',
    cleverScore: 95,
    discount: 12,
    rate: 279,
    deliveryWeeks: 4,
    equipmentHighlight: 'Heat Pump · 360° Kamera',
  },
  {
    vehicleId: 'sportage-hybrid-vision',
    label: 'Kia Sportage Hybrid Vision',
    cleverScore: 91,
    discount: 10,
    rate: 349,
    deliveryWeeks: 3,
    equipmentHighlight: 'Panorama · Anhängerkupplung',
  },
  {
    vehicleId: 'ev3-long-range',
    label: 'Kia EV3 Long Range',
    cleverScore: 88,
    discount: 8,
    rate: 329,
    deliveryWeeks: 5,
    equipmentHighlight: '600 km WLTP · V2L',
  },
  {
    vehicleId: 'ev4-earth',
    label: 'Kia EV4 Earth',
    cleverScore: 84,
    discount: 9,
    rate: 379,
    deliveryWeeks: 7,
    equipmentHighlight: '625 km · Premium Audio',
  },
];


const MOCK_OFFERS = {
  created: 342,
  sent: 298,
  viewed: 241,
  accepted: 67,
  topModels: [
    { label: 'Sportage Hybrid Vision', count: 89 },
    { label: 'EV3 Long Range', count: 76 },
    { label: 'EV4 Earth', count: 54 },
  ],
};

const MOCK_SALES = {
  closed: 42,
  pipeline: 89,
  revenue: 1842000,
  avgDaysToClose: 11,
  topModels: [
    { label: 'Sportage Hybrid Vision', count: 12, avgRate: 379 },
    { label: 'EV3 Long Range', count: 9, avgRate: 349 },
    { label: 'EV3 Air', count: 7, avgRate: 299 },
  ],
};

const MOCK_EQUIPMENT_DEMAND = [
  { feature: 'Anhängerkupplung', count: 186 },
  { feature: 'Panorama-Glasdach', count: 142 },
  { feature: '360° Kamera', count: 128 },
  { feature: 'Sitzbelüftung', count: 96 },
  { feature: 'Heat Pump', count: 87 },
  { feature: 'Allrad', count: 74 },
];

function resolveDataMode() {
  return hasLiveIntelligenceData() ? 'live' : 'mock';
}

function scaleCount(base, period) {
  const m = PERIOD_MULTIPLIERS[period] ?? 1;
  return Math.max(1, Math.round(base * m * (0.92 + Math.random() * 0.16)));
}

/** Live-Daten aus vorhandenen Analytics (wenn vorhanden) mit Mock mergen */
function mergeLiveSearchHints(period) {
  const advisor = getAdvisorAnalytics();
  const assistant = getAssistantAnalytics();
  const live = [];

  for (const r of advisor.topDesiredRates ?? []) {
    if (r.label) live.push({ query: `${r.label} € Rate`, count: r.count, source: 'advisor' });
  }
  for (const r of assistant.topDesiredRates ?? []) {
    if (r.label) live.push({ query: `${r.label} € Rate`, count: r.count, source: 'assistant' });
  }
  for (const b of advisor.topBodyTypes ?? []) {
    if (b.label && b.label !== 'egal') {
      live.push({ query: b.label, count: b.count, source: 'advisor' });
    }
  }

  const mult = PERIOD_MULTIPLIERS[period] ?? 1;
  return live.map((item) => ({ ...item, count: Math.round(item.count * mult) }));
}

export function getSearchBehavior(period = '7d') {
  if (hasLiveIntelligenceData()) {
    const live = getLiveSearchBehavior(period);
    if (live.length > 0) {
      return live.map((item, i) => ({ ...item, rank: i + 1, source: 'live' }));
    }
  }

  const mock = MOCK_SEARCH_QUERIES.map((item, i) => ({
    rank: i + 1,
    query: item.query,
    count: scaleCount(item.base, period),
    source: 'mock',
  }));

  const live = mergeLiveSearchHints(period);
  const merged = [...mock];
  for (const liveItem of live) {
    const existing = merged.find((m) => m.query.toLowerCase() === liveItem.query.toLowerCase());
    if (existing) {
      existing.count += liveItem.count;
      existing.source = 'mixed';
    } else {
      merged.push({ rank: 0, query: liveItem.query, count: liveItem.count, source: liveItem.source });
    }
  }

  merged.sort((a, b) => b.count - a.count);
  return merged.slice(0, 12).map((item, i) => ({ ...item, rank: i + 1 }));
}

export function getRecommendationStats(period = '7d') {
  if (hasLiveIntelligenceData()) {
    const live = getLiveRecommendationStats(period);
    if (live.length > 0) return live;
  }

  const mult = PERIOD_MULTIPLIERS[period] ?? 1;
  return MOCK_RECOMMENDATIONS.map((item) => ({
    ...item,
    recommended: Math.round(item.recommended * mult),
    offerRequests: Math.round(item.offerRequests * mult),
    closed: Math.round(item.closed * mult),
    conversionRate: item.recommended
      ? Math.round((item.closed / item.recommended) * 1000) / 10
      : 0,
  }));
}

export function getComparisonRanking(period = '7d') {
  if (hasLiveIntelligenceData()) {
    const live = getLiveComparisonRanking(period);
    if (live.length > 0) return live;
  }

  const mult = PERIOD_MULTIPLIERS[period] ?? 1;
  return MOCK_COMPARISONS.map((item, i) => ({
    rank: i + 1,
    ...item,
    count: scaleCount(item.count, mult),
  }));
}

export function getLeasingTrends(period = '7d') {
  if (hasLiveIntelligenceData()) {
    const live = getLiveLeasingTrends(period);
    if (live.desiredRates.length > 0 || live.terms.length > 0) return live;
  }

  const mult = PERIOD_MULTIPLIERS[period] ?? 1;
  return {
    desiredRates: MOCK_LEASING_RATES.map((r) => ({
      ...r,
      count: scaleCount(r.count, mult),
      label: `${r.rate} €`,
    })),
    terms: MOCK_LEASING_TERMS.map((t) => ({
      ...t,
      count: scaleCount(t.count, mult),
      label: `${t.months} Monate`,
    })),
    mileages: MOCK_MILEAGES.map((m) => ({
      ...m,
      count: scaleCount(m.count, mult),
      label: `${m.km.toLocaleString('de-DE')} km/Jahr`,
    })),
  };
}

export function getFamilyIndex(period = '7d') {
  if (hasLiveIntelligenceData()) {
    const live = getLiveFamilyIndex(period);
    if (live.length > 0) return live;
  }

  return MOCK_FAMILY_INDEX.map((item) => ({
    ...item,
    cleverScore: calculateCleverScore({
      priceValue: 1 - item.rate / 700,
      leasingRate: 1 - item.rate / 700,
      deliveryTime: 1 - item.deliveryWeeks / 16,
      demand: item.demand / 100,
      familyFriendly: item.score / 100,
      equipment: 0.75,
      range: 0.6,
    }),
  }));
}

export function getElectroIndex(period = '7d') {
  if (hasLiveIntelligenceData()) {
    const live = getLiveElectroIndex(period);
    if (live.length > 0) return live;
  }

  return MOCK_ELECTRO_INDEX.map((item) => ({
    ...item,
    cleverScore: calculateCleverScore({
      range: item.rangeKm / 800,
      leasingRate: 1 - item.rate / 800,
      deliveryTime: 1 - item.deliveryWeeks / 16,
      demand: item.demand / 100,
      priceValue: 0.7,
      equipment: 0.65,
      familyFriendly: 0.55,
    }),
  }));
}

export function getDeliveryMonitor(period = '7d') {
  if (hasLiveIntelligenceData()) {
    const live = getLiveDeliveryMonitor(period);
    if (live.all.length > 0) return live;
  }

  const sorted = [...MOCK_DELIVERY].sort((a, b) => a.avgWeeks - b.avgWeeks);
  return {
    fastest: sorted.slice(0, 3),
    slowest: [...sorted].reverse().slice(0, 3),
    all: sorted,
    source: 'mock',
  };
}

export function getBestDeals(period = '7d') {
  if (hasLiveIntelligenceData()) {
    const live = getLiveBestDeals(period);
    if (live.length > 0) return live;
  }

  return MOCK_BEST_DEALS.map((deal) => ({
    ...deal,
    cleverScore: deal.cleverScore ?? calculateCleverScore({
      priceValue: deal.discount / 15,
      leasingRate: 1 - deal.rate / 600,
      deliveryTime: 1 - deal.deliveryWeeks / 14,
      demand: 0.85,
      equipment: 0.8,
      range: 0.7,
      familyFriendly: 0.65,
    }),
  }));
}

export function getTrendPageDrafts(period = '7d') {
  if (hasLiveIntelligenceData()) {
    return generateIntelligenceTrendPages(period, true);
  }
  return getMockTrendPages();
}

export function getOffersIntelligence(period = '7d') {
  if (hasLiveIntelligenceData()) {
    const live = getLiveOffersIntelligence(period);
    if (live.created > 0) return live;
  }

  const mult = PERIOD_MULTIPLIERS[period] ?? 1;
  return {
    created: Math.round(MOCK_OFFERS.created * mult),
    sent: Math.round(MOCK_OFFERS.sent * mult),
    viewed: Math.round(MOCK_OFFERS.viewed * mult),
    accepted: Math.round(MOCK_OFFERS.accepted * mult),
    acceptanceRate: Math.round((MOCK_OFFERS.accepted / MOCK_OFFERS.sent) * 100),
    topModels: MOCK_OFFERS.topModels.map((m) => ({
      ...m,
      count: scaleCount(m.count, mult),
    })),
  };
}

export function getSalesIntelligence(period = '7d') {
  if (hasLiveIntelligenceData()) {
    const live = getLiveSalesIntelligence(period);
    if (live.closed > 0) return live;
  }

  const mult = PERIOD_MULTIPLIERS[period] ?? 1;
  return {
    closed: Math.round(MOCK_SALES.closed * mult),
    pipeline: Math.round(MOCK_SALES.pipeline * mult),
    revenue: Math.round(MOCK_SALES.revenue * mult),
    avgDaysToClose: MOCK_SALES.avgDaysToClose,
    topModels: MOCK_SALES.topModels.map((m) => ({
      ...m,
      count: scaleCount(m.count, mult),
    })),
  };
}

export function getEquipmentDemand(period = '7d') {
  if (hasLiveIntelligenceData()) {
    const live = getLiveEquipmentDemand(period);
    if (live.length > 0) return live;
  }

  const mult = PERIOD_MULTIPLIERS[period] ?? 1;
  return MOCK_EQUIPMENT_DEMAND.map((item, i) => ({
    rank: i + 1,
    ...item,
    count: scaleCount(item.count, mult),
  }));
}

export function getIntelligenceOverview(period = '7d') {
  const search = getSearchBehavior(period);
  const recommendations = getRecommendationStats(period);
  const comparisons = getComparisonRanking(period);
  const offers = getOffersIntelligence(period);
  const sales = getSalesIntelligence(period);
  const leasing = getLeasingTrends(period);
  const liveKpis = hasLiveIntelligenceData() ? getLiveOverviewKpis(period) : null;

  return {
    period,
    generatedAt: new Date().toISOString(),
    dataMode: resolveDataMode(),
    kpis: liveKpis ? {
      searches: liveKpis.searches,
      advisorSessions: liveKpis.advisorSessions,
      comparisons: liveKpis.comparisons,
      offersCreated: liveKpis.offersCreated,
      salesClosed: liveKpis.salesClosed,
      topDesiredRate: leasing.desiredRates.sort((a, b) => b.count - a.count)[0]?.label ?? '–',
    } : {
      searches: search.reduce((s, q) => s + q.count, 0),
      advisorSessions: recommendations.reduce((s, r) => s + r.recommended, 0),
      comparisons: comparisons.reduce((s, c) => s + c.count, 0),
      offersCreated: offers.created,
      salesClosed: sales.closed,
      topDesiredRate: leasing.desiredRates.sort((a, b) => b.count - a.count)[0]?.label ?? '–',
    },
    topSearch: search[0] ?? null,
    topRecommendation: recommendations[0] ?? null,
    topComparison: comparisons[0] ?? null,
    bestDeal: getBestDeals(period)[0] ?? null,
  };
}

/** Gesamtes Dashboard – ein Aufruf für die Page */
export function getIntelligenceDashboard(period = '7d') {
  return {
    overview: getIntelligenceOverview(period),
    search: getSearchBehavior(period),
    recommendations: getRecommendationStats(period),
    comparisons: getComparisonRanking(period),
    offers: getOffersIntelligence(period),
    sales: getSalesIntelligence(period),
    leasing: getLeasingTrends(period),
    familyIndex: getFamilyIndex(period),
    electroIndex: getElectroIndex(period),
    delivery: getDeliveryMonitor(period),
    bestDeals: getBestDeals(period),
    trendPages: getTrendPageDrafts(period),
    equipmentDemand: getEquipmentDemand(period),
    scoreWeights: { ...CLEVER_SCORE_WEIGHTS },
  };
}

/** Zukünftige Event-Ingestion – delegiert an intelligenceAnalytics */
export function ingestSearchEvent(query, meta = {}) {
  return persistSearchEvent(query, meta);
}

export function ingestComparisonEvent(vehicleA, vehicleB, meta = {}) {
  return persistComparisonEvent([vehicleA, vehicleB], meta);
}

export function ingestSaleEvent(leadOrVehicle, meta = {}) {
  return persistSaleEvent(
    typeof leadOrVehicle === 'object' ? leadOrVehicle : { vehicle: { label: leadOrVehicle } },
    meta,
  );
}
