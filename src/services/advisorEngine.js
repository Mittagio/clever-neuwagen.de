/**
 * Clever-Neuwagen – KI-Kaufberater Engine (austauschbar)
 * Regelbasiert · später OpenAI / Claude / Gemini
 */

import { sportage, kiaSportage } from '../data/kiaSportage.js';
import { advisorCatalog, ADVISOR_MILEAGE_OPTIONS } from '../data/advisorCatalog.js';
import { INVENTORY_TYPES } from '../data/inventoryTypes.js';
import { calcVehiclePricing } from '../logic/salesMatcher.js';
import {
  findMatchingInventory,
  getCustomerAvailabilityLabel,
  resolveAvailability,
} from '../logic/inventoryService.js';
import { resolveVehicleImageForDealer } from './vehicle/vehicleImageService.js';

export const ADVISOR_PROVIDERS = {
  RULE_BASED: 'rule-based',
  OPENAI: 'openai',
  CLAUDE: 'claude',
  GEMINI: 'gemini',
};

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

function getTrimMeta(trimId) {
  return kiaSportage.trims.find((t) => t.id === trimId) ?? null;
}

function getEngineMeta(engineId) {
  return sportage.engines.find((e) => e.id === engineId) ?? null;
}

function parseDeliveryWeeks(text) {
  if (!text) return 8;
  if (/sofort|lager/i.test(text)) return 0;
  const nums = text.match(/(\d+)/g);
  if (!nums?.length) return 6;
  return nums.length >= 2 ? (Number(nums[0]) + Number(nums[1])) / 2 : Number(nums[0]);
}

function resolveMileage(profile) {
  const opt = ADVISOR_MILEAGE_OPTIONS.find((o) => o.id === profile.mileage);
  return opt?.value ?? profile.mileagePerYear ?? 12500;
}

function buildPricingContext(profile) {
  return {
    desiredRate: Number(profile.desiredRate) || 350,
    termMonths: profile.termMonths ?? 48,
    mileagePerYear: resolveMileage(profile),
    downPayment: profile.downPayment ?? 0,
  };
}

function matchesBodyType(bodyPref, vehicle) {
  if (!bodyPref || bodyPref === 'egal') return true;
  if (bodyPref === 'kompakt') {
    return vehicle.bodyType === 'kompakt' || vehicle.bodyType === 'kleinwagen';
  }
  if (bodyPref === 'kleinwagen') {
    return vehicle.bodyType === 'kleinwagen' || vehicle.bodyType === 'kompakt';
  }
  return vehicle.bodyType === bodyPref;
}

function matchesFuel(fuelPref, vehicle) {
  if (!fuelPref || fuelPref === 'egal') return true;
  if (fuelPref === 'hybrid') return vehicle.fuelCategory === 'hybrid';
  if (fuelPref === 'elektro') return vehicle.fuelCategory === 'elektro';
  if (fuelPref === 'verbrenner') {
    return ['verbrenner', 'diesel'].includes(vehicle.fuelCategory);
  }
  return true;
}

function householdNeedsFamily(profile) {
  return profile.household === 'family' || profile.household === 'family-dog';
}

function householdNeedsSpace(profile) {
  return ['family', 'family-dog', 'couple'].includes(profile.household);
}

function scoreWishMatch(wishId, vehicle) {
  return vehicle.features?.[wishId] ? 22 : -8;
}

function scoreVehicle(vehicle, profile, pricing, inventoryMatch) {
  let score = 0;
  const rate = pricing.monthlyRate;
  const desired = Number(profile.desiredRate) || 350;
  const diff = Math.abs(rate - desired);

  score += Math.max(0, 140 - diff * 3);
  if (rate <= desired) score += 25;
  if (rate <= desired + 30) score += 12;

  if (matchesBodyType(profile.bodyType, vehicle)) score += 30;
  else score -= 45;

  if (matchesFuel(profile.fuelPreference, vehicle)) score += 28;
  else score -= 55;

  if (householdNeedsFamily(profile) && vehicle.familyScore >= 4) score += 30;
  if (profile.household === 'family-dog' && vehicle.bodyType === 'suv') score += 15;
  if (profile.household === 'single' && vehicle.bodyType === 'limousine') score += 8;

  const mileage = resolveMileage(profile);
  if (mileage > 18000 && vehicle.fuelCategory === 'elektro') score -= 15;
  if (mileage > 18000 && vehicle.fuelCategory === 'verbrenner') score += 10;
  if (mileage <= 12000 && vehicle.fuelCategory === 'elektro') score += 15;

  for (const wish of profile.wishes ?? []) {
    score += scoreWishMatch(wish, vehicle);
  }

  if (profile.wishes?.includes('niedrige-kosten') && vehicle.operatingCostLevel <= 2) score += 20;
  if (profile.wishes?.includes('reichweite') && (vehicle.rangeKm >= 500 || vehicle.fuelCategory !== 'elektro')) score += 18;
  if (profile.wishes?.includes('allrad') && getEngineMeta(vehicle.engineId)?.drive === 'AWD') score += 25;
  if (profile.wishes?.includes('panorama') && vehicle.features?.panorama) score += 20;
  if (profile.wishes?.includes('kamera360') && (vehicle.features?.kamera360 || getTrimMeta(vehicle.trimId)?.baseEquipment?.includes('feat-rundumsichtkamera'))) score += 20;

  if (inventoryMatch) {
    const p = INVENTORY_TYPES[inventoryMatch.type]?.priority ?? 4;
    if (p === 1) score += 50;
    if (p === 2) score += 32;
  }

  if (profile.wishes?.includes('schnelle-lieferung')) {
    const weeks = inventoryMatch?.type === 'lager' ? 0 : parseDeliveryWeeks(pricing.deliveryTime);
    score += Math.max(0, 30 - weeks * 4);
  }

  return Math.round(score);
}

function buildReasonBullets(vehicle, profile, pricing, inventoryMatch) {
  const bullets = [];
  const rate = pricing.monthlyRate;
  const desired = Number(profile.desiredRate) || 350;
  const mileage = resolveMileage(profile);

  if (rate <= desired) bullets.push('passt zur Wunschrate');
  else if (rate <= desired + 40) bullets.push('nahe an der Wunschrate');
  else bullets.push(`+${Math.round(rate - desired)} € zur Wunschrate`);

  if (mileage >= 15000) bullets.push(`geeignet für ${mileage.toLocaleString('de-DE')} km/Jahr`);
  if (householdNeedsFamily(profile) && vehicle.familyScore >= 4) bullets.push('Familienfreundlich');
  if (profile.household === 'family-dog') bullets.push('Hund & Kofferraum');

  if (inventoryMatch?.type === 'lager') bullets.push('aktuell kurze Lieferzeit');
  else if (parseDeliveryWeeks(pricing.deliveryTime) <= 6) bullets.push('schnelle Lieferung möglich');

  if (vehicle.rangeKm >= 500) bullets.push('hohe Reichweite');
  if (vehicle.fuelCategory === 'elektro' && profile.wishes?.includes('niedrige-kosten')) {
    bullets.push('niedrige Betriebskosten');
  }
  if (vehicle.features?.anhaenger) bullets.push('Anhängerkupplung möglich');
  if (vehicle.fuelCategory === 'hybrid') bullets.push('keine Wallbox nötig');
  if (vehicle.bodyType === 'suv' && householdNeedsFamily(profile)) bullets.push('Familien-SUV');
  if (vehicle.promoLabel) bullets.push(`aktuelle ${vehicle.promoLabel}`);
  if (vehicle.highlights?.[0] && bullets.length < 6) bullets.push(vehicle.highlights[0]);

  return bullets.slice(0, 6);
}

function buildExplanation(vehicle, profile, pricing, bullets) {
  const rate = pricing.monthlyRate;
  const desired = Number(profile.desiredRate) || 350;
  const vehicleName = `${vehicle.brand} ${vehicle.model} ${vehicle.variant}`;

  const rateText = rate <= desired
    ? `die Wunschrate von ${desired} € erreicht`
    : `die Wunschrate von ${desired} € nahezu erreicht wird (${rate} €/Monat)`;

  const useText = householdNeedsFamily(profile)
    ? ' und das Fahrzeug für Familien gut geeignet ist'
    : profile.fuelPreference === 'elektro'
      ? ' und Elektromobilität zu Ihrem Antriebswunsch passt'
      : '';

  const deliveryText = pricing.availability?.label?.includes('Sofort')
    ? ' Zudem ist es aktuell schnell verfügbar.'
    : '';

  return `Der ${vehicleName} passt besonders gut, weil ${rateText}${useText}.${deliveryText}`.replace(/\.\./g, '.');
}

function isHotDeal(vehicle, profile, pricing, inventoryMatch, score) {
  let hotScore = 0;
  const desired = Number(profile.desiredRate) || 350;

  if (inventoryMatch?.type === 'lager') hotScore += 2;
  if (inventoryMatch?.type === 'vorlauf') hotScore += 1;
  if (pricing.monthlyRate <= desired - 20) hotScore += 2;
  if (parseDeliveryWeeks(pricing.deliveryTime) <= 4) hotScore += 1;
  if (vehicle.promoLabel) hotScore += 2;
  if (score >= 120) hotScore += 1;

  return hotScore >= 3;
}

function enrichCandidate(vehicle, profile, conditions) {
  const customer = buildPricingContext(profile);
  const inventory = conditions.inventoryVehicles ?? conditions.inventory ?? [];
  const config = {
    engineId: vehicle.engineId,
    trimId: vehicle.trimId,
    colorId: vehicle.colorId ?? 'carraraweiss',
  };

  const inventoryMatch = vehicle.engineId
    ? findMatchingInventory(config, inventory)
    : null;

  let pricing = calcVehiclePricing(vehicle, customer, conditions);

  if (inventoryMatch) {
    const resolved = resolveAvailability(config, inventory, conditions.deliveryTime);
    pricing = {
      ...pricing,
      availability: { type: inventoryMatch.type, label: getCustomerAvailabilityLabel(inventoryMatch) },
      deliveryTime: resolved.deliveryTime ?? getCustomerAvailabilityLabel(inventoryMatch),
    };
  }

  const engine = getEngineMeta(vehicle.engineId);
  const score = scoreVehicle(vehicle, profile, pricing, inventoryMatch);
  const reasonBullets = buildReasonBullets(vehicle, profile, pricing, inventoryMatch);

  const imageResolved = resolveVehicleImageForDealer({
    brand: vehicle.brand,
    model: vehicle.model,
    trim: vehicle.trimId ?? vehicle.variant,
    bodyType: vehicle.bodyType,
    variant: 'card',
    dealerImageUrl: inventoryMatch?.image,
  }, conditions);

  return {
    id: inventoryMatch ? `${vehicle.id}-inv-${inventoryMatch.id}` : vehicle.id,
    vehicleId: vehicle.id,
    brand: vehicle.brand,
    model: vehicle.model,
    variant: vehicle.variant,
    fullLabel: `${vehicle.brand} ${vehicle.model} ${vehicle.variant}`,
    label: `${vehicle.model} ${vehicle.variant}`,
    engineName: engine?.name ?? (vehicle.fuelCategory === 'elektro' ? 'Elektro' : '–'),
    fuelLabel: vehicle.fuelCategory === 'elektro' ? 'Elektro' : vehicle.fuelCategory === 'hybrid' ? 'Hybrid' : 'Verbrenner',
    bodyType: vehicle.bodyType,
    imageSource: imageResolved.source,
    monthlyRate: pricing.monthlyRate,
    hauspreis: pricing.hauspreis,
    deliveryTime: pricing.deliveryTime,
    availabilityLabel: pricing.availability?.label ?? '🟡 Konfigurierbar',
    availabilityType: pricing.availability?.type ?? inventoryMatch?.type ?? 'konfigurierbar',
    rangeKm: vehicle.rangeKm,
    operatingCostLevel: vehicle.operatingCostLevel,
    highlights: vehicle.highlights ?? [],
    reasonBullets,
    explanation: buildExplanation(vehicle, profile, pricing, reasonBullets),
    isHotDeal: isHotDeal(vehicle, profile, pricing, inventoryMatch, score),
    score,
    diff: Math.abs(pricing.monthlyRate - customer.desiredRate),
    inventoryMatch,
    pricing,
    sourceVehicle: vehicle,
    engineId: vehicle.engineId,
    trimId: vehicle.trimId,
    colorId: vehicle.colorId,
  };
}

export class RuleBasedAdvisorEngine {
  getRecommendations(profile, conditions, catalog = advisorCatalog) {
    const candidates = catalog
      .filter((v) => matchesBodyType(profile.bodyType, v))
      .filter((v) => matchesFuel(profile.fuelPreference, v))
      .map((v) => enrichCandidate(v, profile, conditions))
      .sort((a, b) => b.score - a.score || a.diff - b.diff);

    const unique = [];
    const seen = new Set();
    for (const c of candidates) {
      const key = `${c.model}-${c.variant}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(c);
    }

    return unique.slice(0, 5).map((item, index) => ({
      ...item,
      rank: index + 1,
      rankMedal: RANK_MEDALS[index] ?? `#${index + 1}`,
    }));
  }
}

export class LLMAdvisorEngine {
  constructor(provider = 'openai') {
    this.provider = provider;
    this.fallback = new RuleBasedAdvisorEngine();
  }

  async getRecommendations(profile, conditions, catalog) {
    // TODO: ${this.provider} API – bis dahin Fallback mit echten Händlerdaten
    return this.fallback.getRecommendations(profile, conditions, catalog);
  }
}

export function createAdvisorEngine(provider = ADVISOR_PROVIDERS.RULE_BASED) {
  if ([ADVISOR_PROVIDERS.OPENAI, ADVISOR_PROVIDERS.CLAUDE, ADVISOR_PROVIDERS.GEMINI].includes(provider)) {
    return new LLMAdvisorEngine(provider);
  }
  return new RuleBasedAdvisorEngine();
}

let defaultEngine = createAdvisorEngine(ADVISOR_PROVIDERS.RULE_BASED);

export function setAdvisorProvider(provider) {
  defaultEngine = createAdvisorEngine(provider);
  return defaultEngine;
}

export function getAdvisorRecommendations(profile, conditions, catalog) {
  return defaultEngine.getRecommendations(profile, conditions, catalog);
}

export function formatAdvisorRate(value) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

export function buildAdvisorWhatsAppMessage(rec, dealerName) {
  return [
    `Hallo, ich interessiere mich für den ${rec.fullLabel}.`,
    '',
    `Leasingrate: ${rec.monthlyRate} €/Monat`,
    `Lieferzeit: ${rec.deliveryTime}`,
    '',
    `Bitte senden Sie mir ein unverbindliches Angebot.`,
    dealerName ? `\n${dealerName}` : '',
  ].filter(Boolean).join('\n');
}

export function buildAdvisorMailto(rec, dealerEmail, dealerName) {
  const subject = `Angebotsanfrage: ${rec.fullLabel}`;
  const body = buildAdvisorWhatsAppMessage(rec, dealerName);
  return `mailto:${dealerEmail || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export { RANK_MEDALS };
