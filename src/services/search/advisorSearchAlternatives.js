/**
 * Alternativ-Stufen wenn kein exakter Treffer (Händler-Beratung).
 * Rule Engine bleibt Wahrheit – es werden nur Kriterien schrittweise gelockert.
 */

import { runCleverSearch } from './cleverSearchPipeline.js';

const MAX_TIERS = 3;

/**
 * @param {import('./searchProfile.js').SearchProfile} profile
 */
export function buildAlternativeTierPlans(profile) {
  if (!profile) return [];

  const tiers = [];
  const electric = profile.fuel === 'electric';
  const sevenSeater = profile.seatsMin != null && profile.seatsMin >= 7;
  const budgetCap = profile.maxPrice ?? profile.maxMonthlyRate ?? null;

  if (electric && sevenSeater) {
    tiers.push({
      id: 'seven_flexible_fuel',
      title: '7-Sitzer in Ihrer Preisklasse',
      explanation: 'Exakt Elektro mit 7 Sitzen ist selten. Diese Modelle bieten 7 Sitze – auch als Plug-in-Hybrid.',
      profileOverride: {
        ...profile,
        fuel: null,
        seatsMin: 7,
        requiredFeatures: (profile.requiredFeatures ?? []).filter((f) => f !== 'seats_7'),
      },
    });
    tiers.push({
      id: 'elektro_five_seater',
      title: 'Elektro in Ihrer Preisklasse',
      explanation: '5-Sitzer-Elektroautos, die zu Antrieb und Budget passen.',
      profileOverride: {
        ...profile,
        fuel: 'electric',
        seatsMin: null,
        requiredFeatures: (profile.requiredFeatures ?? []).filter((f) => f !== 'seats_7'),
      },
    });
    tiers.push({
      id: 'elektro_seven_premium',
      title: 'Elektro mit 7 Sitzen',
      explanation: '7-Sitzer-Elektro – die Budget-Grenze wurde gelockert.',
      profileOverride: {
        ...profile,
        fuel: 'electric',
        seatsMin: 7,
        maxPrice: null,
        maxMonthlyRate: null,
        requiredFeatures: (profile.requiredFeatures ?? []).filter((f) => f !== 'seats_7'),
      },
    });
  } else if (sevenSeater && budgetCap != null) {
    tiers.push({
      id: 'seven_no_budget',
      title: '7-Sitzer – Budget erweitert',
      explanation: '7-Sitzer im Kia-Angebot, wenn die Preisgrenze gelockert wird.',
      profileOverride: {
        ...profile,
        maxPrice: null,
        maxMonthlyRate: null,
      },
    });
    tiers.push({
      id: 'five_seater_budget',
      title: 'In Ihrer Preisklasse',
      explanation: '5-Sitzer-Modelle, die ins Budget passen.',
      profileOverride: {
        ...profile,
        seatsMin: null,
        requiredFeatures: (profile.requiredFeatures ?? []).filter((f) => f !== 'seats_7'),
      },
    });
  } else if (electric && budgetCap != null) {
    tiers.push({
      id: 'elektro_no_budget',
      title: 'Elektro – Budget erweitert',
      explanation: 'Elektro-Modelle, wenn die Preisgrenze gelockert wird.',
      profileOverride: {
        ...profile,
        maxPrice: null,
        maxMonthlyRate: null,
      },
    });
    tiers.push({
      id: 'hybrid_budget',
      title: 'Hybrid in Ihrer Preisklasse',
      explanation: 'Plug-in-Hybrid oder Hybrid als Alternative zum reinen Elektro.',
      profileOverride: {
        ...profile,
        fuel: 'hybrid',
        requiredFeatures: (profile.requiredFeatures ?? []).filter((f) => f !== 'elektro'),
      },
    });
  } else if (budgetCap != null) {
    tiers.push({
      id: 'budget_relaxed',
      title: 'Nächstbeste Optionen',
      explanation: 'Sortiert nach CleverQuote – Budget-Anforderung gelockert.',
      profileOverride: {
        ...profile,
        maxPrice: null,
        maxMonthlyRate: null,
      },
    });
  }

  if ((profile.requiredFeatures?.length ?? 0) > 0 && !tiers.length) {
    tiers.push({
      id: 'features_relaxed',
      title: 'Ähnliche Modelle',
      explanation: 'Nicht jede Ausstattung ist serienmäßig verfügbar – die besten Gesamttreffer.',
      profileOverride: {
        ...profile,
        requiredFeatures: [],
      },
    });
  }

  return tiers;
}

function tierSignature(groups = []) {
  return groups.map((g) => g.modelLineKey).sort().join('|');
}

/**
 * @param {object} params
 */
export function runAdvisorSearchWithAlternatives({
  query = '',
  intent = null,
  profile = null,
  filters = {},
  wishes = {},
  vehicles = [],
  chipIds = [],
  getDisplayRate,
  limit = 12,
}) {
  const exact = runCleverSearch({
    query,
    intent,
    filters,
    wishes,
    chipIds,
    vehicles,
    getDisplayRate,
    limit,
    profileOverride: profile,
  });

  const guidanceMessage = exact.noExactMatchMessage
    ?? exact.exclusionHint
    ?? (exact.modelLineGroups.length
      ? null
      : 'Exakt passend ist das im Bestand schwierig. Wir zeigen die nächsten sinnvollen Optionen.');

  if (exact.modelLineGroups.length > 0) {
    return {
      exact,
      alternatives: [],
      hasExactMatch: true,
      guidanceMessage: null,
      exclusionHint: exact.exclusionHint,
    };
  }

  const alternatives = [];
  const seen = new Set();

  for (const tier of buildAlternativeTierPlans(exact.profile)) {
    const result = runCleverSearch({
      query,
      intent,
      filters,
      wishes,
      chipIds,
      vehicles,
      getDisplayRate,
      limit,
      profileOverride: tier.profileOverride,
    });

    if (!result.modelLineGroups.length) continue;

    const sig = tierSignature(result.modelLineGroups);
    if (seen.has(sig)) continue;
    seen.add(sig);

    alternatives.push({
      id: tier.id,
      title: tier.title,
      explanation: tier.explanation,
      modelLineGroups: result.modelLineGroups,
      matches: result.matches,
      isAlternative: true,
    });

    if (alternatives.length >= MAX_TIERS) break;
  }

  return {
    exact,
    alternatives,
    hasExactMatch: false,
    guidanceMessage,
    exclusionHint: exact.exclusionHint,
  };
}
