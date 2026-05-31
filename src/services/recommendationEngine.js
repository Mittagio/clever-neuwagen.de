/**
 * Clever-Neuwagen – Empfehlungsengine (austauschbar)
 *
 * Aktuell: regelbasiert (RuleBasedProvider)
 * Später: OpenAIProvider über createRecommendationEngine('openai')
 */

import { sportage, kiaSportage } from '../data/kiaSportage.js';
import { salesCatalog } from '../data/salesCatalog.js';
import { INVENTORY_TYPES } from '../data/inventoryTypes.js';
import { calcVehiclePricing } from '../logic/salesMatcher.js';
import {
  findMatchingInventory,
  getCustomerAvailabilityLabel,
  resolveAvailability,
} from '../logic/inventoryService.js';

export const PROVIDERS = {
  RULE_BASED: 'rule-based',
  OPENAI: 'openai',
};

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

const FUEL_LABELS = {
  elektro: 'Elektro',
  hybrid: 'Hybrid',
  verbrenner: 'Verbrenner',
  diesel: 'Diesel',
};

const VEHICLE_TYPE_LABELS = {
  egal: 'Alle Typen',
  suv: 'SUV',
  kleinwagen: 'Kleinwagen',
  elektro: 'Elektro',
  kombi: 'Kombi',
  limousine: 'Limousine',
};

/** @typedef {Object} AssistantInput */

function normalizeAssistantInput(input) {
  const prefs = input.preferences ?? [];
  return {
    ...input,
    desiredRate: input.desiredRate ?? input.rate ?? 300,
    budget: input.budget ?? (input.desiredRate ?? input.rate ?? 300) + 50,
    vehicleType: input.vehicleType
      ?? (prefs.includes('suv') ? 'suv'
        : prefs.includes('kombi') ? 'kleinwagen'
          : prefs.includes('elektro') ? 'elektro' : 'egal'),
    fuelPreference: input.fuelPreference
      ?? (prefs.includes('elektro') ? 'elektro'
        : prefs.includes('verbrenner') ? 'verbrenner' : 'egal'),
    family: input.family ?? prefs.includes('familie'),
    automatic: input.automatic ?? true,
  };
}

function getEngineMeta(engineId) {
  if (!engineId) return null;
  return sportage.engines.find((e) => e.id === engineId) ?? null;
}

function getTrimMeta(trimId) {
  if (!trimId) return null;
  return kiaSportage.trims.find((t) => t.id === trimId) ?? null;
}

function isAutomaticEngine(engineId) {
  const engine = getEngineMeta(engineId);
  if (!engine) return true;
  return /DCT|Automatik|e-/i.test(engine.transmission ?? '');
}

function has360Camera(trimId) {
  const trim = getTrimMeta(trimId);
  return trim?.baseEquipment?.includes('feat-rundumsichtkamera') ?? false;
}

function supportsTowing(vehicle) {
  if (vehicle.bodyType === 'suv' && vehicle.model === 'Sportage') return true;
  if (vehicle.towingCapacity) return true;
  return vehicle.bodyType === 'suv' || vehicle.bodyType === 'kombi';
}

function parseDeliveryWeeks(deliveryTime) {
  if (!deliveryTime) return 8;
  if (/sofort|lager/i.test(deliveryTime)) return 0;
  const matches = deliveryTime.match(/(\d+)/g);
  if (!matches?.length) return 6;
  if (matches.length >= 2) {
    return (Number(matches[0]) + Number(matches[1])) / 2;
  }
  return Number(matches[0]);
}

function matchesVehicleType(type, vehicle) {
  if (!type || type === 'egal') return true;
  if (type === 'suv') return vehicle.bodyType === 'suv';
  if (type === 'kleinwagen') {
    return ['kleinwagen', 'limousine', 'kombi'].includes(vehicle.bodyType);
  }
  if (type === 'elektro') return vehicle.fuelCategory === 'elektro';
  return true;
}

function matchesFuelPreference(pref, vehicle) {
  if (!pref || pref === 'egal') return true;
  if (pref === 'elektro') return vehicle.fuelCategory === 'elektro';
  if (pref === 'hybrid') return vehicle.fuelCategory === 'hybrid';
  if (pref === 'verbrenner') {
    return ['verbrenner', 'diesel'].includes(vehicle.fuelCategory);
  }
  return true;
}

function matchesBrand(query, vehicle) {
  const q = query?.trim().toLowerCase();
  if (!q) return true;
  return `${vehicle.brand} ${vehicle.model} ${vehicle.variant}`.toLowerCase().includes(q);
}

function buildCustomerContext(input) {
  return {
    desiredRate: Number(input.desiredRate ?? input.rate) || 300,
    budget: Number(input.budget) || Number(input.desiredRate ?? 300) + 50,
    termMonths: Number(input.termMonths) || 48,
    mileagePerYear: Number(input.mileagePerYear) || 15000,
    downPayment: Number(input.downPayment) || 0,
  };
}

function inventoryBoost(inventoryMatch) {
  if (!inventoryMatch) return 0;
  const priority = INVENTORY_TYPES[inventoryMatch.type]?.priority ?? 4;
  if (priority === 1) return 45;
  if (priority === 2) return 28;
  if (priority === 3) return 12;
  return 0;
}

function scoreCandidate(vehicle, input, customer, pricing, inventoryMatch) {
  let score = 0;
  const rate = pricing.monthlyRate;
  const rateDiff = Math.abs(rate - customer.desiredRate);

  score += Math.max(0, 130 - rateDiff * 2.8);
  if (rate <= customer.budget) score += 40;
  if (rate <= customer.desiredRate) score += 20;
  else score -= Math.min(35, (rate - customer.desiredRate) * 0.8);

  if (matchesVehicleType(input.vehicleType, vehicle)) score += 25;
  else score -= 40;

  if (matchesFuelPreference(input.fuelPreference, vehicle)) score += 22;
  else score -= 50;

  if (input.automatic && vehicle.engineId && !isAutomaticEngine(vehicle.engineId)) {
    score -= 80;
  } else if (input.automatic && isAutomaticEngine(vehicle.engineId)) {
    score += 18;
  }

  if (input.family && vehicle.familyScore >= 4) score += 28;
  if (input.dog && (vehicle.bodyType === 'suv' || vehicle.familyScore >= 4)) score += 15;

  if (input.towingImportant) {
    score += supportsTowing(vehicle) ? 25 : -30;
    if (getEngineMeta(vehicle.engineId)?.drive === 'AWD') score += 10;
  }

  if (input.deliveryImportant) {
    const weeks = inventoryMatch
      ? (inventoryMatch.type === 'lager' ? 0 : parseDeliveryWeeks(pricing.deliveryTime))
      : parseDeliveryWeeks(pricing.deliveryTime);
    score += Math.max(0, 35 - weeks * 3);
  }

  score += inventoryBoost(inventoryMatch);

  if (vehicle.tag === 'Bestseller') score += 8;

  return Math.round(score);
}

function buildReasonBullets(vehicle, input, customer, pricing, inventoryMatch) {
  const bullets = [];
  const rate = pricing.monthlyRate;
  const engine = getEngineMeta(vehicle.engineId);

  if (input.vehicleType && input.vehicleType !== 'egal') {
    const typeLabel = VEHICLE_TYPE_LABELS[input.vehicleType] ?? input.vehicleType;
    if (matchesVehicleType(input.vehicleType, vehicle)) bullets.push(typeLabel);
  } else if (vehicle.bodyType === 'suv') {
    bullets.push('SUV');
  }

  if (input.automatic !== false && (engine ? isAutomaticEngine(engine.id) : true)) {
    bullets.push('Automatik');
  }

  if (input.family && vehicle.familyScore >= 4) bullets.push('Familienfreundlich');
  if (input.dog && vehicle.bodyType === 'suv') bullets.push('Hundfreundlich (Kofferraum)');

  if (rate <= customer.desiredRate) bullets.push('innerhalb Budget');
  else if (rate <= customer.budget) bullets.push('im Budget-Rahmen');
  else bullets.push(`+${Math.round(rate - customer.desiredRate)} € zur Wunschrate`);

  if (vehicle.fuelCategory === 'elektro') bullets.push('niedrige Betriebskosten');
  if (vehicle.fuelCategory === 'hybrid') bullets.push('sparsamer Hybrid');

  if (inventoryMatch?.type === 'lager') bullets.push('Sofort verfügbar (Lager)');
  if (inventoryMatch?.type === 'vorlauf') bullets.push('Vorlauf – kurze Wartezeit');

  if (has360Camera(vehicle.trimId)) bullets.push('360° Kamera möglich');
  if (vehicle.highlights?.length && bullets.length < 5) {
    const extra = vehicle.highlights[0];
    if (!bullets.some((b) => extra.includes(b))) bullets.push(extra);
  }

  return bullets.slice(0, 5);
}

function buildExplanation(vehicle, input, customer, pricing, bullets) {
  const rate = pricing.monthlyRate;
  const vehicleName = `${vehicle.brand} ${vehicle.model} ${vehicle.variant}`;
  const ratePart = rate <= customer.desiredRate
    ? `die gewünschte Rate von ${customer.desiredRate} € erreicht oder unterschreitet`
    : `die Wunschrate von ${customer.desiredRate} € nahezu erreicht wird (${rate} €/Monat)`;

  const typePart = input.vehicleType && input.vehicleType !== 'egal'
    ? ` und als ${VEHICLE_TYPE_LABELS[input.vehicleType] ?? input.vehicleType} zum Fahrzeugwunsch passt`
    : vehicle.bodyType === 'suv'
      ? ' und das Fahrzeug als SUV vielseitig einsetzbar ist'
      : '';

  const familyPart = input.family ? ' – ideal für Familien' : '';
  const deliveryPart = pricing.availability?.label?.includes('Sofort')
    ? ' Zudem ist es sofort verfügbar.'
    : '';

  return `Dieses Fahrzeug passt besonders gut, weil ${ratePart}${typePart}${familyPart}.${deliveryPart}`.replace(/\.\./g, '.');
}

function enrichCandidate(vehicle, input, customer, conditions) {
  const inventory = conditions.inventoryVehicles ?? conditions.inventory ?? [];
  const config = {
    engineId: vehicle.engineId,
    trimId: vehicle.trimId,
    colorId: vehicle.colorId ?? 'carraraweiss',
  };

  const inventoryMatch = vehicle.engineId
    ? findMatchingInventory(config, inventory)
    : null;

  const pricing = calcVehiclePricing(vehicle, customer, conditions);

  if (inventoryMatch) {
    const resolved = resolveAvailability(config, inventory, conditions.deliveryTime);
    pricing.availability = {
      type: inventoryMatch.type,
      label: getCustomerAvailabilityLabel(inventoryMatch),
    };
    pricing.deliveryTime = resolved.deliveryTime ?? getCustomerAvailabilityLabel(inventoryMatch);
    if (inventoryMatch.color) {
      vehicle = { ...vehicle, colorId: inventoryMatch.colorId, inventoryColor: inventoryMatch.color };
    }
  }

  const engine = getEngineMeta(vehicle.engineId);
  const score = scoreCandidate(vehicle, input, customer, pricing, inventoryMatch);
  const reasonBullets = buildReasonBullets(vehicle, input, customer, pricing, inventoryMatch);
  const explanation = buildExplanation(vehicle, input, customer, pricing, reasonBullets);

  return {
    id: inventoryMatch ? `${vehicle.id}-inv-${inventoryMatch.id}` : vehicle.id,
    vehicleId: vehicle.id,
    brand: vehicle.brand,
    model: vehicle.model,
    variant: vehicle.variant,
    label: `${vehicle.model} ${vehicle.variant}`,
    fullLabel: `${vehicle.brand} ${vehicle.model} ${vehicle.variant}`,
    engineId: vehicle.engineId,
    trimId: vehicle.trimId,
    colorId: vehicle.colorId ?? inventoryMatch?.colorId,
    engineName: engine?.name ?? (vehicle.mock ? 'Elektro' : '–'),
    transmission: engine?.transmission ?? 'Automatik',
    fuelLabel: FUEL_LABELS[vehicle.fuelCategory] ?? vehicle.fuelCategory,
    monthlyRate: pricing.monthlyRate,
    hauspreis: pricing.hauspreis,
    deliveryTime: pricing.deliveryTime,
    availabilityLabel: pricing.availability?.label ?? '🟡 Konfigurierbar',
    availabilityType: pricing.availability?.type ?? inventoryMatch?.type ?? 'konfigurierbar',
    highlights: vehicle.highlights ?? getTrimMeta(vehicle.trimId)?.highlights ?? [],
    score,
    diff: Math.abs(pricing.monthlyRate - customer.desiredRate),
    withinBudget: pricing.monthlyRate <= customer.budget,
    reasonBullets,
    explanation,
    inventoryMatch,
    pricing,
    sourceVehicle: vehicle,
  };
}

function expandInventoryCandidates(catalog, conditions) {
  const inventory = conditions.inventoryVehicles ?? conditions.inventory ?? [];
  const extras = [];

  for (const item of inventory) {
    if (!['lager', 'vorlauf'].includes(item.type)) continue;

    const base = catalog.find(
      (v) => v.model === item.model && v.trimId === item.trimId && v.engineId === item.engineId,
    );

    if (base) continue;

    extras.push({
      id: `inv-${item.id}`,
      brand: 'Kia',
      model: item.model ?? 'Sportage',
      variant: item.equipment ?? item.trimId,
      engineId: item.engineId,
      trimId: item.trimId,
      colorId: item.colorId,
      bodyType: 'suv',
      fuelCategory: 'hybrid',
      familyScore: 5,
      highlights: [`${item.color ?? 'Farbe'}`, item.location].filter(Boolean),
      fromInventory: true,
    });
  }

  return extras;
}

/**
 * Regelbasierte Empfehlungsengine
 */
export class RuleBasedRecommendationEngine {
  getRecommendations(input, conditions, catalog = salesCatalog) {
    const customer = buildCustomerContext(input);
    const pool = [...catalog, ...expandInventoryCandidates(catalog, conditions)];

    const candidates = pool
      .filter((v) => matchesVehicleType(input.vehicleType, v))
      .filter((v) => matchesFuelPreference(input.fuelPreference, v))
      .filter((v) => matchesBrand(input.brandModel, v))
      .filter((v) => !input.automatic || !v.engineId || isAutomaticEngine(v.engineId))
      .map((v) => enrichCandidate(v, input, customer, conditions))
      .sort((a, b) => b.score - a.score || a.diff - b.diff);

    const unique = [];
    const seen = new Set();
    for (const c of candidates) {
      const key = `${c.model}-${c.variant}-${c.engineId}-${c.inventoryMatch?.id ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(c);
    }

    const count = Math.min(5, Math.max(3, unique.length >= 3 ? 5 : unique.length));
    return unique.slice(0, count).map((item, index) => ({
      ...item,
      rank: index + 1,
      rankMedal: RANK_MEDALS[index] ?? `#${index + 1}`,
      matchReasons: item.reasonBullets,
    }));
  }

  explainRecommendation(recommendation) {
    return recommendation.explanation ?? '';
  }
}

/**
 * Platzhalter für spätere OpenAI-Integration
 */
export class OpenAIRecommendationEngine {
  constructor() {
    this.fallback = new RuleBasedRecommendationEngine();
  }

  async getRecommendations(input, conditions, catalog) {
    // TODO: OpenAI API – bis dahin Fallback
    return this.fallback.getRecommendations(input, conditions, catalog);
  }

  async explainRecommendation(recommendation, input) {
    // TODO: OpenAI-generierte Begründung
    return this.fallback.explainRecommendation(recommendation);
  }
}

export function createRecommendationEngine(provider = PROVIDERS.RULE_BASED) {
  if (provider === PROVIDERS.OPENAI) {
    return new OpenAIRecommendationEngine();
  }
  return new RuleBasedRecommendationEngine();
}

/** Singleton für UI */
let defaultEngine = createRecommendationEngine(PROVIDERS.RULE_BASED);

export function setRecommendationProvider(provider) {
  defaultEngine = createRecommendationEngine(provider);
  return defaultEngine;
}

export function getRecommendations(input, conditions, catalog) {
  const normalized = normalizeAssistantInput(input);
  return defaultEngine.getRecommendations(normalized, conditions, catalog);
}

export function formatRecommendationRate(value) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

export { VEHICLE_TYPE_LABELS, FUEL_LABELS, RANK_MEDALS };
