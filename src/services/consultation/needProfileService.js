/**
 * NeedProfile – Aufbau, Merge, sichtbares Verständnis, Lead-Anbindung.
 */
import { parseSearchIntent } from '../search/searchIntentParser.js';
import { NEED_CONSULTATION_QUESTIONS } from './consultationQuestions.js';
import { getFuelCategory } from './conversationPlanner.js';
import { CLEVER_WORLD } from './consultationWorlds.js';
import { createEmptyNeedProfile } from './needProfileTypes.js';

const FUEL_LABELS = {
  electric: 'Elektro',
  elektro: 'Elektro',
  hybrid: 'Hybrid',
  phev: 'Plug-in-Hybrid',
  benzin: 'Benzin',
  verbrenner: 'Benzin',
  diesel: 'Diesel',
};

const BODY_LABELS = {
  suv: 'SUV',
  kleinwagen: 'Kleinwagen',
  kombi: 'Kombi',
  limousine: 'Limousine',
  van: 'Van',
};

function clampConfidence(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function pushUnique(list, item) {
  if (!item || list.includes(item)) return list;
  return [...list, item];
}

/**
 * @param {object} intent
 */
function fuelFromIntent(intent = {}) {
  if (intent.fuel === 'electric' || intent.fuel === 'elektro') return 'electric';
  if (intent.fuel === 'hybrid' || intent.fuel === 'phev') return intent.fuel;
  if (intent.fuel === 'verbrenner' || intent.fuel === 'benzin' || intent.fuel === 'diesel') {
    return intent.fuel === 'diesel' ? 'diesel' : 'verbrenner';
  }
  return intent.fuel ?? null;
}

/**
 * @param {object} profile
 * @param {object} intent
 */
function applyIntentToNeedProfile(profile, intent = {}) {
  const next = { ...profile };
  let confidence = next.confidence ?? 0;

  const fuel = fuelFromIntent(intent);
  if (fuel) {
    next.fuel = fuel;
    confidence += 12;
  }

  if (intent.bodyType) {
    next.bodyType = intent.bodyType;
    confidence += 10;
  }

  if (intent.seatsMin) {
    next.persons = Math.max(next.persons ?? 0, intent.seatsMin);
    if (intent.seatsMin >= 5) next.priorities = pushUnique(next.priorities, 'family');
    confidence += 10;
  }

  if (intent.familyHint) {
    if (intent.familyHint === 'Zwei Kinder') {
      next.children = 2;
    } else if (intent.familyHint === 'Drei Kinder') {
      next.children = 3;
    } else {
      next.children = next.children ?? true;
    }
    next.priorities = pushUnique(next.priorities, 'family');
    confidence += 8;
  }

  if (intent.dogBoxHint) {
    next.dog = true;
    next.priorities = pushUnique(next.priorities, 'space');
    confidence += 6;
  }

  if (intent.chargingHomeHint != null) {
    next.chargingAtHome = intent.chargingHomeHint ? 'yes' : 'no';
    confidence += 6;
  }

  if (intent.maxRate) {
    next.budget = {
      ...next.budget,
      maxMonthlyRate: intent.maxRate,
      paymentType: next.budget?.paymentType ?? intent.payment ?? 'leasing',
    };
    confidence += 14;
  }

  if (intent.maxPrice) {
    next.budget = {
      ...next.budget,
      maxPrice: intent.maxPrice,
      paymentType: next.budget?.paymentType ?? 'cash',
    };
    confidence += 12;
  }

  if (intent.payment) {
    next.budget = {
      ...next.budget,
      paymentType: intent.payment,
    };
    confidence += 8;
  }

  if (intent.mileagePerYear) {
    next.annualKm = intent.mileagePerYear;
    confidence += 6;
  }

  if (intent.towCapacityKg >= 750 || intent.features?.some((f) => f.includes('tow'))) {
    next.towing = intent.towCapacityKg >= 2000 ? 'heavy' : 'braked';
    next.priorities = pushUnique(next.priorities, 'towing');
    confidence += 8;
  }

  if (intent.model && /^sportage$/i.test(intent.model)) {
    next.modelHint = 'sportage';
    next.bodyType = next.bodyType ?? 'suv';
    confidence += 6;
  }

  if (intent.rangeKmMin >= 400 || intent.rangeRanking) {
    const fuelCat = getFuelCategory({ fuel: fuel ?? next.fuel });
    if (fuelCat === 'electric' || fuelCat === 'phev') {
      next.priorities = pushUnique(next.priorities, 'range');
    }
    next.longDistance = next.longDistance ?? 'sometimes';
    confidence += 6;
  }

  next.confidence = clampConfidence(confidence);
  next.updatedAt = new Date().toISOString();
  return next;
}

/**
 * @param {object} profile
 */
export function buildUnderstoodLabels(profile = {}) {
  const labels = [];

  if (profile.fuel) {
    labels.push(FUEL_LABELS[profile.fuel] ?? profile.fuel);
  }
  if (profile.bodyType) {
    labels.push(BODY_LABELS[profile.bodyType] ?? profile.bodyType);
  }
  if (profile.priorities?.includes('family') || profile.children || (profile.persons ?? 0) >= 5) {
    labels.push('Familie');
  }
  if (profile.children === 2 || profile.children === '2') {
    labels.push('2 Kinder');
  } else if (profile.children) {
    labels.push('Kinder');
  }
  if (profile.dog) labels.push('Hund');
  if (profile.budget?.maxMonthlyRate) {
    labels.push(`Budget ${profile.budget.maxMonthlyRate} €`);
  }
  if (profile.budget?.paymentType === 'leasing') labels.push('Leasing');
  if (profile.budget?.paymentType === 'cash') labels.push('Kauf');
  if (profile.towing && profile.towing !== 'no') labels.push('Anhängelast');
  const fuelCat = getFuelCategory(profile);
  if (profile.priorities?.includes('range') && (fuelCat === 'electric' || fuelCat === 'phev')) {
    labels.push('Reichweite wichtig');
  }
  if (profile.chargingAtHome === 'yes') labels.push('Laden zuhause');
  if (profile.longDistance === 'often') {
    labels.push('Langstrecke');
  } else if (profile.longDistance === 'sometimes' && fuelCat === 'combustion') {
    labels.push('Häufig längere Fahrten');
  }

  return [...new Set(labels)];
}

/**
 * @param {object} profile
 * @param {object} [ctx]
 */
export function computeMissingNeedFields(profile = {}, ctx = {}) {
  const missing = [];
  for (const question of NEED_CONSULTATION_QUESTIONS) {
    if (question.skipIf?.({ ...ctx, needProfile: profile, answers: ctx.answers })) continue;
    if (ctx.answers?.[question.id] != null) continue;
    missing.push(question.id);
  }
  return missing;
}

/**
 * @param {string} text
 * @param {object} [base]
 */
export function mergeTextIntoNeedProfile(text = '', base = null) {
  const trimmed = String(text ?? '').trim();
  let profile = base ?? createEmptyNeedProfile(trimmed);
  if (trimmed && !profile.rawMessages.includes(trimmed)) {
    profile = {
      ...profile,
      rawMessages: [...profile.rawMessages, trimmed],
      initialWish: profile.initialWish || trimmed,
    };
  }
  if (!trimmed) return profile;

  const intent = parseSearchIntent(trimmed);
  profile = applyIntentToNeedProfile(profile, intent);

  if (/\ballrad\b/i.test(trimmed)) {
    profile = {
      ...profile,
      priorities: pushUnique(profile.priorities, 'awd'),
    };
  }

  profile.understoodLabels = buildUnderstoodLabels(profile);
  profile.missingFields = computeMissingNeedFields(profile);
  return profile;
}

/**
 * @param {object} lead
 */
export function getNeedProfileFromLead(lead = {}) {
  if (lead?.crm?.needProfile) return lead.crm.needProfile;
  const initial = lead?.sonderwuensche?.consultation?.consultationProfile?.initialWish
    ?? lead?.inquiryBrief?.searchQuery
    ?? '';
  if (!initial) return null;
  return mergeTextIntoNeedProfile(initial);
}

/**
 * @param {object} lead
 * @param {object} needProfile
 */
export function mergeNeedProfileIntoLead(lead = {}, needProfile = {}) {
  return {
    ...lead,
    crm: {
      ...(lead.crm ?? {}),
      needProfile: {
        ...needProfile,
        understoodLabels: buildUnderstoodLabels(needProfile),
        missingFields: computeMissingNeedFields(needProfile),
        world: needProfile.selectedModelKey
          ? CLEVER_WORLD.VEHICLE_CONSULTATION
          : CLEVER_WORLD.NEED_CONSULTATION,
        updatedAt: new Date().toISOString(),
      },
    },
  };
}

/**
 * @param {object} profile
 * @param {string} modelKey
 */
export function selectModelOnNeedProfile(profile = {}, modelKey = '') {
  if (!modelKey) return profile;
  return {
    ...profile,
    selectedModelKey: modelKey,
    world: CLEVER_WORLD.VEHICLE_CONSULTATION,
    updatedAt: new Date().toISOString(),
  };
}

export { createEmptyNeedProfile };
