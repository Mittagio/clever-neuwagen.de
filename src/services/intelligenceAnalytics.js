/**
 * Clever Intelligence – Event-Tracking (localStorage)
 * Sammelt Suchanfragen, Empfehlungen, Vergleiche, Angebote und Verkäufe.
 */

import {
  ADVISOR_BODY_OPTIONS,
  ADVISOR_FUEL_OPTIONS,
  ADVISOR_HOUSEHOLD_OPTIONS,
  ADVISOR_WISHES,
} from '../data/advisorCatalog.js';
import { calculateCleverScore } from './cleverScore.js';
import {
  resolveIntelligenceVehicle,
  normalizeVehicleId,
  parseDeliveryWeeks,
  isFamilyVehicle,
  isElectroVehicle,
  vehicleDisplayLabel,
  catalogDefaultRate,
  catalogDefaultRange,
  catalogDefaultDeliveryWeeks,
  getAllCatalogVehicles,
} from './intelligenceVehicleRegistry.js';

import {
  loadIntelligenceStore,
  saveIntelligenceStore,
} from './intelligenceStorageAdapter.js';
import { INTELLIGENCE_MAX_EVENTS } from './intelligenceEventMerge.js';

const MAX_EVENTS = INTELLIGENCE_MAX_EVENTS;

export const INTELLIGENCE_EVENT = {
  SEARCH: 'search',
  RECOMMENDATION: 'recommendation',
  COMPARISON: 'comparison',
  OFFER_CREATED: 'offer_created',
  OFFER_VIEWED: 'offer_viewed',
  SALE_CLOSED: 'sale_closed',
  EQUIPMENT: 'equipment',
  LEASING_RATE: 'leasing_rate',
  LEASING_TERM: 'leasing_term',
  MILEAGE: 'mileage',
};

function emptyStore() {
  return { events: [], lastUpdated: null };
}

function load() {
  return loadIntelligenceStore();
}

function save(data) {
  const trimmed = {
    ...data,
    events: data.events.slice(-MAX_EVENTS),
    lastUpdated: new Date().toISOString(),
  };
  saveIntelligenceStore(trimmed);
  return trimmed;
}

function syncEventToServer(event) {
  if (typeof fetch === 'undefined') return;
  fetch('/api/v1/intelligence/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event }),
  }).catch(() => { /* offline */ });
}

function newEventId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function appendEvent(type, payload = {}) {
  const event = {
    id: newEventId(),
    type,
    at: new Date().toISOString(),
    ...payload,
  };
  const data = load();
  data.events.push(event);
  save(data);
  syncEventToServer(event);
  return data;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function filterEventsByPeriod(events, period = '7d') {
  const now = Date.now();
  const todayStart = startOfToday().getTime();

  return events.filter((event) => {
    const t = new Date(event.at).getTime();
    if (period === 'today') return t >= todayStart;
    if (period === '7d') return now - t <= 7 * 86400000;
    if (period === '30d') return now - t <= 30 * 86400000;
    return true;
  });
}

function countByKey(events, keyFn) {
  const map = {};
  for (const event of events) {
    const key = keyFn(event);
    if (!key) continue;
    map[key] = (map[key] ?? 0) + 1;
  }
  return map;
}

function topFromMap(map, labelKey = 'label', limit = 12) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count], i) => ({ rank: i + 1, [labelKey]: label, count, label, query: label, feature: label, pair: label }));
}

function vehicleLabel(vehicle) {
  if (!vehicle) return null;
  return vehicle.fullLabel ?? vehicle.label ?? [vehicle.brand, vehicle.model, vehicle.variant].filter(Boolean).join(' ');
}

function shortVehicleName(vehicle) {
  if (!vehicle) return '';
  const brand = vehicle.brand ?? '';
  const model = vehicle.model ?? vehicle.fullLabel ?? vehicle.label ?? '';
  return `${brand} ${model}`.trim();
}

function comparisonPairKey(a, b) {
  const names = [shortVehicleName(a), shortVehicleName(b)].sort();
  return {
    pair: `${names[0]} vs ${names[1]}`,
    vehicleA: names[0],
    vehicleB: names[1],
  };
}

function extractSearchQueriesFromProfile(profile) {
  const queries = [];

  if (profile.household === 'family' || profile.household === 'family-dog') {
    queries.push('Familienauto');
  }

  const body = ADVISOR_BODY_OPTIONS.find((o) => o.id === profile.bodyType);
  if (body && body.id !== 'egal') queries.push(body.label);

  const fuel = ADVISOR_FUEL_OPTIONS.find((o) => o.id === profile.fuelPreference);
  if (fuel && fuel.id !== 'egal') {
    queries.push(fuel.id === 'elektro' ? 'Elektroauto' : fuel.label);
  }

  if (profile.desiredRate) {
    queries.push(`${profile.desiredRate} € Rate`);
  }

  for (const wishId of profile.wishes ?? []) {
    const wish = ADVISOR_WISHES.find((w) => w.id === wishId);
    if (wish) queries.push(wish.label);
  }

  const household = ADVISOR_HOUSEHOLD_OPTIONS.find((o) => o.id === profile.household);
  if (household && !queries.includes('Familienauto') && (household.id === 'family' || household.id === 'family-dog')) {
    queries.push('Familienauto');
  }

  return [...new Set(queries)];
}

/** ─── Recording ─── */

export function recordIntelligenceSearch(query, meta = {}) {
  return appendEvent(INTELLIGENCE_EVENT.SEARCH, { query, ...meta });
}

export function recordIntelligenceAdvisorSession(profile, recommendations = [], meta = {}) {
  const queries = extractSearchQueriesFromProfile(profile);
  for (const query of queries) {
    appendEvent(INTELLIGENCE_EVENT.SEARCH, { query, source: 'advisor', ...meta });
  }

  if (profile.desiredRate) {
    appendEvent(INTELLIGENCE_EVENT.LEASING_RATE, {
      rate: Number(profile.desiredRate),
      source: 'advisor',
    });
  }

  if (profile.mileage) {
    appendEvent(INTELLIGENCE_EVENT.MILEAGE, { mileageId: profile.mileage, source: 'advisor' });
  }

  if (meta.termMonths) {
    appendEvent(INTELLIGENCE_EVENT.LEASING_TERM, { months: meta.termMonths, source: 'advisor' });
  }

  for (const rec of recommendations.slice(0, 5)) {
    appendEvent(INTELLIGENCE_EVENT.RECOMMENDATION, {
      ...vehicleEventMeta(rec),
      source: meta.source ?? 'advisor',
    });
  }

  return load();
}

export function recordIntelligenceComparison(vehicles = [], meta = {}) {
  if (vehicles.length < 2) return load();

  for (let i = 0; i < vehicles.length; i += 1) {
    for (let j = i + 1; j < vehicles.length; j += 1) {
      const pair = comparisonPairKey(vehicles[i], vehicles[j]);
      appendEvent(INTELLIGENCE_EVENT.COMPARISON, { ...pair, source: meta.source ?? 'advisor' });
    }
  }
  return load();
}

export function recordIntelligenceOfferCreated(offer, meta = {}) {
  return appendEvent(INTELLIGENCE_EVENT.OFFER_CREATED, {
    code: offer?.code,
    status: offer?.status,
    source: offer?.source ?? meta.source,
    ...offerEventMeta(offer),
  });
}

export function recordIntelligenceOfferViewed(offer) {
  return appendEvent(INTELLIGENCE_EVENT.OFFER_VIEWED, {
    code: offer?.code,
    vehicleLabel: offer?.vehicle?.label,
    source: offer?.source,
  });
}

export function recordIntelligenceSale(lead, meta = {}) {
  const catalog = resolveIntelligenceVehicle(null, lead?.vehicle?.label);
  return appendEvent(INTELLIGENCE_EVENT.SALE_CLOSED, {
    leadId: lead?.id,
    vehicleLabel: lead?.vehicle?.label ?? vehicleDisplayLabel(catalog),
    vehicleId: catalog?.id,
    fuelCategory: catalog?.fuelCategory,
    familyScore: catalog?.familyScore,
    rangeKm: catalog?.rangeKm,
    rate: lead?.currentRate ?? lead?.desiredRate,
    status: lead?.status,
    source: lead?.source ?? meta.source,
  });
}

export function recordIntelligenceEquipment(features = [], meta = {}) {
  for (const feature of features) {
    appendEvent(INTELLIGENCE_EVENT.EQUIPMENT, {
      feature: typeof feature === 'string' ? feature : feature.label,
      source: meta.source ?? 'equipment_advisor',
    });
  }
  return load();
}

/** ─── Aggregation ─── */

export function getIntelligenceEventCount() {
  return load().events.length;
}

export function hasLiveIntelligenceData() {
  return getIntelligenceEventCount() > 0;
}

export function getLiveSearchBehavior(period = '7d') {
  const events = filterEventsByPeriod(load().events, period)
    .filter((e) => e.type === INTELLIGENCE_EVENT.SEARCH);
  return topFromMap(countByKey(events, (e) => e.query), 'query');
}

export function getLiveRecommendationStats(period = '7d') {
  const events = filterEventsByPeriod(load().events, period);
  const recs = events.filter((e) => e.type === INTELLIGENCE_EVENT.RECOMMENDATION);
  const offers = events.filter((e) => e.type === INTELLIGENCE_EVENT.OFFER_CREATED);
  const closed = events.filter((e) => e.type === INTELLIGENCE_EVENT.SALE_CLOSED);

  const byVehicle = {};

  function ensure(label, vehicleId) {
    if (!byVehicle[label]) {
      byVehicle[label] = { vehicleId, label, recommended: 0, offerRequests: 0, closed: 0 };
    }
  }

  for (const e of recs) {
    ensure(e.label, e.vehicleId);
    byVehicle[e.label].recommended += 1;
  }
  for (const e of offers) {
    const label = e.vehicleLabel ?? e.label;
    if (!label) continue;
    ensure(label, e.vehicleId);
    byVehicle[label].offerRequests += 1;
  }
  for (const e of closed) {
    const label = e.vehicleLabel ?? e.label;
    if (!label) continue;
    ensure(label);
    byVehicle[label].closed += 1;
  }

  return Object.values(byVehicle)
    .sort((a, b) => b.recommended - a.recommended)
    .map((item) => ({
      ...item,
      conversionRate: item.recommended
        ? Math.round((item.closed / item.recommended) * 1000) / 10
        : 0,
    }));
}

export function getLiveComparisonRanking(period = '7d') {
  const events = filterEventsByPeriod(load().events, period)
    .filter((e) => e.type === INTELLIGENCE_EVENT.COMPARISON);
  const map = countByKey(events, (e) => e.pair);
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([pair, count], i) => {
      const sample = events.find((e) => e.pair === pair);
      return {
        rank: i + 1,
        pair,
        vehicleA: sample?.vehicleA ?? pair.split(' vs ')[0],
        vehicleB: sample?.vehicleB ?? pair.split(' vs ')[1],
        count,
      };
    });
}

export function getLiveLeasingTrends(period = '7d') {
  const events = filterEventsByPeriod(load().events, period);

  const rates = countByKey(
    events.filter((e) => e.type === INTELLIGENCE_EVENT.LEASING_RATE),
    (e) => String(e.rate),
  );
  const terms = countByKey(
    events.filter((e) => e.type === INTELLIGENCE_EVENT.LEASING_TERM),
    (e) => String(e.months),
  );
  const mileages = countByKey(
    events.filter((e) => e.type === INTELLIGENCE_EVENT.MILEAGE),
    (e) => e.mileageId,
  );

  return {
    desiredRates: Object.entries(rates)
      .sort((a, b) => b[1] - a[1])
      .map(([rate, count]) => ({ rate: Number(rate), count, label: `${rate} €` })),
    terms: Object.entries(terms)
      .sort((a, b) => b[1] - a[1])
      .map(([months, count]) => ({ months: Number(months), count, label: `${months} Monate` })),
    mileages: Object.entries(mileages)
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({ mileageId: id, count, label: id })),
  };
}

export function getLiveOffersIntelligence(period = '7d') {
  const events = filterEventsByPeriod(load().events, period);
  const created = events.filter((e) => e.type === INTELLIGENCE_EVENT.OFFER_CREATED);
  const viewed = events.filter((e) => e.type === INTELLIGENCE_EVENT.OFFER_VIEWED);
  const sent = created.filter((e) => e.status && e.status !== 'entwurf');

  const byModel = countByKey(created, (e) => e.vehicleLabel);

  return {
    created: created.length,
    sent: sent.length,
    viewed: viewed.length,
    accepted: 0,
    acceptanceRate: sent.length ? Math.round((0 / sent.length) * 100) : 0,
    topModels: topFromMap(byModel, 'label', 5),
  };
}

export function getLiveSalesIntelligence(period = '7d') {
  const events = filterEventsByPeriod(load().events, period)
    .filter((e) => e.type === INTELLIGENCE_EVENT.SALE_CLOSED);

  const byModel = countByKey(events, (e) => e.vehicleLabel);

  return {
    closed: events.length,
    pipeline: 0,
    revenue: events.reduce((s, e) => s + (Number(e.rate) || 0) * 48, 0),
    avgDaysToClose: 0,
    topModels: Object.entries(byModel)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({
        label,
        count,
        avgRate: events.find((e) => e.vehicleLabel === label)?.rate ?? 0,
      })),
  };
}

export function getLiveEquipmentDemand(period = '7d') {
  const events = filterEventsByPeriod(load().events, period)
    .filter((e) => e.type === INTELLIGENCE_EVENT.EQUIPMENT);
  return topFromMap(countByKey(events, (e) => e.feature), 'feature');
}

function vehicleEventMeta(rec) {
  const catalog = resolveIntelligenceVehicle(rec.id ?? rec.vehicleId, vehicleLabel(rec));
  return {
    vehicleId: normalizeVehicleId(rec.id ?? rec.vehicleId),
    label: vehicleLabel(rec),
    fuelCategory: rec.fuelCategory ?? catalog?.fuelCategory,
    familyScore: rec.familyScore ?? catalog?.familyScore,
    rangeKm: rec.rangeKm ?? catalog?.rangeKm ?? null,
    bodyType: rec.bodyType ?? catalog?.bodyType,
    rate: rec.monthlyRate ?? rec.mockRate ?? catalogDefaultRate(catalog),
    deliveryTime: rec.deliveryTime ?? catalog?.mockDeliveryTime,
  };
}

function offerEventMeta(offer) {
  const catalog = resolveIntelligenceVehicle(offer?.vehicle?.id, offer?.vehicle?.label);
  return {
    vehicleId: normalizeVehicleId(offer?.vehicle?.id),
    vehicleLabel: offer?.vehicle?.label ?? vehicleDisplayLabel(catalog),
    fuelCategory: catalog?.fuelCategory,
    familyScore: catalog?.familyScore,
    rangeKm: catalog?.rangeKm ?? null,
    bodyType: catalog?.bodyType,
    rate: offer?.pricing?.rate ?? offer?.pricing?.leasingRate ?? catalogDefaultRate(catalog),
    deliveryTime: offer?.deliveryTime ?? catalog?.mockDeliveryTime,
  };
}

const DEMAND_WEIGHTS = {
  [INTELLIGENCE_EVENT.RECOMMENDATION]: 3,
  [INTELLIGENCE_EVENT.OFFER_CREATED]: 5,
  [INTELLIGENCE_EVENT.SALE_CLOSED]: 10,
  [INTELLIGENCE_EVENT.COMPARISON]: 2,
};

function aggregateVehicleDemand(events) {
  const buckets = {};

  function touch(key, vehicleId, label) {
    if (!buckets[key]) {
      buckets[key] = {
        key,
        vehicleId,
        label,
        demandScore: 0,
        rates: [],
        deliveryWeeks: [],
      };
    }
    return buckets[key];
  }

  function addFromMeta(meta, weight) {
    const catalog = resolveIntelligenceVehicle(meta.vehicleId, meta.label ?? meta.vehicleLabel);
    const label = meta.label ?? meta.vehicleLabel ?? vehicleDisplayLabel(catalog);
    const key = normalizeVehicleId(meta.vehicleId) ?? label.toLowerCase();
    const bucket = touch(key, normalizeVehicleId(meta.vehicleId), label);
    bucket.demandScore += weight;
    bucket.catalog = catalog ?? bucket.catalog;
    bucket.fuelCategory = meta.fuelCategory ?? bucket.fuelCategory ?? catalog?.fuelCategory;
    bucket.familyScore = meta.familyScore ?? bucket.familyScore ?? catalog?.familyScore;
    bucket.bodyType = meta.bodyType ?? bucket.bodyType ?? catalog?.bodyType;
    if (meta.rate) bucket.rates.push(Number(meta.rate));
    if (meta.deliveryTime) bucket.deliveryWeeks.push(parseDeliveryWeeks(meta.deliveryTime));
  }

  for (const event of events) {
    if (event.type === INTELLIGENCE_EVENT.RECOMMENDATION) {
      addFromMeta(event, DEMAND_WEIGHTS[INTELLIGENCE_EVENT.RECOMMENDATION]);
    }
    if (event.type === INTELLIGENCE_EVENT.OFFER_CREATED) {
      addFromMeta(event, DEMAND_WEIGHTS[INTELLIGENCE_EVENT.OFFER_CREATED]);
    }
    if (event.type === INTELLIGENCE_EVENT.SALE_CLOSED) {
      addFromMeta(event, DEMAND_WEIGHTS[INTELLIGENCE_EVENT.SALE_CLOSED]);
    }
    if (event.type === INTELLIGENCE_EVENT.COMPARISON) {
      for (const name of [event.vehicleA, event.vehicleB]) {
        if (!name) continue;
        const catalog = resolveIntelligenceVehicle(null, name);
        addFromMeta(
          { vehicleId: catalog?.id, label: vehicleDisplayLabel(catalog, name) },
          DEMAND_WEIGHTS[INTELLIGENCE_EVENT.COMPARISON],
        );
      }
    }
  }

  return Object.values(buckets);
}

function avg(nums, fallback) {
  if (!nums.length) return fallback;
  return Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
}

function buildLiveIndex(entries, { filterFn, scoreFactors }) {
  const filtered = entries.filter((entry) => filterFn(entry));
  if (!filtered.length) return [];

  const maxDemand = Math.max(...filtered.map((e) => e.demandScore), 1);

  return filtered
    .sort((a, b) => b.demandScore - a.demandScore)
    .slice(0, 10)
    .map((entry, i) => {
      const catalog = entry.catalog;
      const rate = avg(entry.rates, catalogDefaultRate(catalog) ?? 0);
      const deliveryWeeks = avg(entry.deliveryWeeks, catalogDefaultDeliveryWeeks(catalog));
      const demandPct = Math.round((entry.demandScore / maxDemand) * 100);
      const rangeKm = catalogDefaultRange(catalog) ?? 0;

      const cleverScore = calculateCleverScore(scoreFactors({
        catalog,
        rate,
        deliveryWeeks,
        demandPct,
        rangeKm,
      }));

      return {
        rank: i + 1,
        vehicleId: entry.vehicleId ?? catalog?.id,
        label: entry.label,
        rate,
        deliveryWeeks,
        score: catalog?.familyScore ? catalog.familyScore * 20 : cleverScore,
        demand: demandPct,
        rangeKm,
        cleverScore,
        demandScore: entry.demandScore,
        source: 'live',
      };
    });
}

export function getLiveFamilyIndex(period = '7d') {
  const events = filterEventsByPeriod(load().events, period);
  const entries = aggregateVehicleDemand(events);
  return buildLiveIndex(entries, {
    filterFn: (entry) => isFamilyVehicle(entry.catalog)
      || (entry.familyScore ?? 0) >= 3
      || ['suv', 'kombi'].includes(entry.bodyType),
    scoreFactors: ({ catalog, rate, deliveryWeeks, demandPct }) => ({
      priceValue: rate ? 1 - rate / 700 : 0.5,
      leasingRate: rate ? 1 - rate / 700 : 0.5,
      deliveryTime: 1 - deliveryWeeks / 16,
      demand: demandPct / 100,
      familyFriendly: (catalog?.familyScore ?? 3) / 5,
      equipment: 0.7,
      range: (catalog?.rangeKm ?? 400) / 800,
    }),
  });
}

export function getLiveElectroIndex(period = '7d') {
  const events = filterEventsByPeriod(load().events, period);
  const entries = aggregateVehicleDemand(events);
  return buildLiveIndex(entries, {
    filterFn: (entry) => isElectroVehicle(entry.catalog) || entry.fuelCategory === 'elektro',
    scoreFactors: ({ catalog, rate, deliveryWeeks, demandPct, rangeKm }) => ({
      range: rangeKm / 800,
      leasingRate: rate ? 1 - rate / 800 : 0.5,
      deliveryTime: 1 - deliveryWeeks / 16,
      demand: demandPct / 100,
      priceValue: 0.7,
      equipment: 0.65,
      familyFriendly: (catalog?.familyScore ?? 3) / 5,
    }),
  });
}

function modelGroupKey(catalog, label) {
  if (catalog) return `${catalog.brand} ${catalog.model}`.trim();
  const resolved = resolveIntelligenceVehicle(null, label);
  if (resolved) return `${resolved.brand} ${resolved.model}`.trim();
  return label ?? null;
}

export function getLiveDeliveryMonitor(period = '7d') {
  const events = filterEventsByPeriod(load().events, period);
  const relevant = events.filter((e) =>
    [INTELLIGENCE_EVENT.RECOMMENDATION, INTELLIGENCE_EVENT.OFFER_CREATED, INTELLIGENCE_EVENT.SALE_CLOSED]
      .includes(e.type),
  );

  const byModel = {};

  function addWeeks(modelKey, weeks, live = true) {
    if (!modelKey || weeks == null) return;
    if (!byModel[modelKey]) {
      byModel[modelKey] = { model: modelKey, weeks: [], liveSamples: 0 };
    }
    byModel[modelKey].weeks.push(weeks);
    if (live) byModel[modelKey].liveSamples += 1;
  }

  for (const event of relevant) {
    const catalog = resolveIntelligenceVehicle(event.vehicleId, event.label ?? event.vehicleLabel);
    const key = modelGroupKey(catalog, event.label ?? event.vehicleLabel);
    const weeks = event.deliveryWeeks ?? parseDeliveryWeeks(event.deliveryTime);
    addWeeks(key, weeks, true);
  }

  const demandEntries = aggregateVehicleDemand(events);
  for (const entry of demandEntries) {
    const key = modelGroupKey(entry.catalog, entry.label);
    if (key && !byModel[key]) {
      const weeks = catalogDefaultDeliveryWeeks(entry.catalog);
      addWeeks(key, weeks, false);
    }
  }

  if (!Object.keys(byModel).length) {
    for (const vehicle of getAllCatalogVehicles().slice(0, 12)) {
      const key = `${vehicle.brand} ${vehicle.model}`;
      if (!byModel[key]) {
        addWeeks(key, catalogDefaultDeliveryWeeks(vehicle), false);
      }
    }
  }

  const all = Object.values(byModel)
    .map((entry) => ({
      model: entry.model,
      minWeeks: Math.min(...entry.weeks),
      maxWeeks: Math.max(...entry.weeks),
      avgWeeks: Math.round(entry.weeks.reduce((s, w) => s + w, 0) / entry.weeks.length),
      samples: entry.weeks.length,
      liveSamples: entry.liveSamples,
      source: entry.liveSamples > 0 ? 'live' : 'catalog',
    }))
    .sort((a, b) => a.avgWeeks - b.avgWeeks);

  return {
    fastest: all.slice(0, 5),
    slowest: [...all].reverse().slice(0, 5),
    all,
    source: all.some((r) => r.source === 'live') ? 'live' : 'catalog',
  };
}

export function getLiveBestDeals(period = '7d') {
  const events = filterEventsByPeriod(load().events, period);
  const entries = aggregateVehicleDemand(events).filter((e) => e.catalog && e.demandScore > 0);

  const maxDemand = Math.max(...entries.map((e) => e.demandScore), 1);

  return entries
    .map((entry) => {
      const catalog = entry.catalog;
      const rate = avg(entry.rates, catalogDefaultRate(catalog) ?? 399);
      const deliveryWeeks = avg(entry.deliveryWeeks, catalogDefaultDeliveryWeeks(catalog));
      const catalogRate = catalogDefaultRate(catalog) ?? rate;
      const savingsPct = catalogRate > rate
        ? Math.round(((catalogRate - rate) / catalogRate) * 100)
        : Math.min(12, Math.round(entry.demandScore * 1.5));
      const demandPct = Math.round((entry.demandScore / maxDemand) * 100);
      const rangeKm = catalogDefaultRange(catalog) ?? 0;

      const cleverScore = calculateCleverScore({
        priceValue: savingsPct / 15,
        leasingRate: rate ? 1 - rate / 650 : 0.5,
        deliveryTime: 1 - deliveryWeeks / 16,
        demand: demandPct / 100,
        equipment: (catalog.highlights?.length ?? 0) / 5,
        range: rangeKm / 800,
        familyFriendly: (catalog.familyScore ?? 3) / 5,
      });

      return {
        vehicleId: catalog.id,
        label: vehicleDisplayLabel(catalog, entry.label),
        cleverScore,
        discount: Math.max(0, Math.min(20, savingsPct)),
        rate,
        deliveryWeeks,
        equipmentHighlight: catalog.highlights?.slice(0, 2).join(' · ') ?? 'Aktuelle Händlerkondition',
        demand: demandPct,
        demandScore: entry.demandScore,
        source: 'live',
      };
    })
    .sort((a, b) => b.cleverScore - a.cleverScore || b.demandScore - a.demandScore)
    .slice(0, 4);
}

export function getLiveOverviewKpis(period = '7d') {
  const events = filterEventsByPeriod(load().events, period);
  return {
    searches: events.filter((e) => e.type === INTELLIGENCE_EVENT.SEARCH).length,
    advisorSessions: events.filter((e) => e.type === INTELLIGENCE_EVENT.RECOMMENDATION).length,
    comparisons: events.filter((e) => e.type === INTELLIGENCE_EVENT.COMPARISON).length,
    offersCreated: events.filter((e) => e.type === INTELLIGENCE_EVENT.OFFER_CREATED).length,
    salesClosed: events.filter((e) => e.type === INTELLIGENCE_EVENT.SALE_CLOSED).length,
  };
}

export function resetIntelligenceAnalytics() {
  saveIntelligenceStore(emptyStore());
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('clever-intelligence-update'));
  }
}
