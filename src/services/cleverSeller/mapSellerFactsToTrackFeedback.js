/**
 * Bestätigte Seller-Facts → Vehicle-Track-Feedback (Brandes-Fall)
 * + Dual-Szenario: preferred Variante → Favorit auf derselben Spur (Epic 4).
 * Nur Mapping; Persistenz über applyTrackFeedbackFacts nach Review-Accept.
 */
import {
  REJECTION_REASON,
  VEHICLE_TRACK_STATUS,
} from '../crm/vehicleTrack.js';
import { SELLER_FACT_CLASS } from './sellerFactTypes.js';
import {
  SCENARIO_FEEDBACK_REASON,
} from '../crm/scenarioOfferFeedback.js';

function normalizeModelKey(raw = '') {
  return String(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Finde Config-ID anhand modelKey / Modellname.
 */
export function resolveTrackIdForModel(lead = {}, modelKeyOrLabel = '') {
  const needle = normalizeModelKey(modelKeyOrLabel);
  if (!needle) return null;
  const configs = lead?.crm?.vehicleConfigurations ?? [];
  for (const config of configs) {
    const keys = [
      config.id,
      config.modelKey,
      config.model,
      config.vehicleKey,
    ].filter(Boolean).map(normalizeModelKey);
    if (keys.some((k) => k === needle || k.includes(needle) || needle.includes(k))) {
      return config.id;
    }
  }
  return null;
}

/**
 * @param {object[]} facts – bestätigte Facts (needsConfirmation bereits geklärt)
 * @param {object} lead
 * @returns {object[]} Feedback-Patches für applyTrackFeedbackFacts
 */
export function mapSellerFactsToTrackFeedback(facts = [], lead = {}) {
  const byTrack = new Map();
  const hasScenarioFeedback = facts.some(
    (f) => f?.field === 'scenarioOfferFeedback' && f.value?.commercialScenarioId && !f.needsConfirmation,
  );

  function ensure(trackId) {
    if (!trackId) return null;
    if (!byTrack.has(trackId)) {
      byTrack.set(trackId, { trackId });
    }
    return byTrack.get(trackId);
  }

  for (const fact of facts) {
    if (!fact || fact.needsConfirmation) continue;

    // Epic 4: Varianten-preferred → Spur Favorit (ohne zweite Spur)
    if (fact.field === 'scenarioOfferFeedback' && fact.value?.commercialScenarioId) {
      const trackId = fact.value.vehicleTrackId
        || resolveTrackIdForModel(lead, lead?.vehicle?.model || 'sportage');
      if (
        fact.value.reason === SCENARIO_FEEDBACK_REASON.PREFERRED
        && trackId
      ) {
        const entry = ensure(trackId);
        if (entry) entry.status = VEHICLE_TRACK_STATUS.FAVORITE;
      }
      continue;
    }

    if (fact.field === 'vehicleTrackFeedback' && fact.value) {
      const modelKey = fact.value.modelKey || fact.value.model || '';
      const trackId = fact.value.trackId
        || resolveTrackIdForModel(lead, modelKey);
      const entry = ensure(trackId);
      if (!entry) continue;
      // Dual: kein deferred aus Modell-Feedback wenn Varianten-Feedback vorliegt
      if (fact.value.status === VEHICLE_TRACK_STATUS.DEFERRED && hasScenarioFeedback) {
        continue;
      }
      if (fact.value.status) entry.status = fact.value.status;
      if (fact.value.rejectionReason) {
        entry.rejectionReason = fact.value.rejectionReason;
      }
      if (fact.value.preferredColor) {
        entry.preferredColor = fact.value.preferredColor;
      }
      if (fact.value.deliveryTimeImportance != null) {
        entry.deliveryTimeImportance = fact.value.deliveryTimeImportance;
      }
      if (Array.isArray(fact.value.customerRequirements)) {
        entry.customerRequirements = [
          ...(entry.customerRequirements ?? []),
          ...fact.value.customerRequirements,
        ];
      }
      if (fact.value.addRequirement) {
        entry.addRequirement = fact.value.addRequirement;
      }
      continue;
    }

    // Explizites Modellinteresse → Spur fokussieren (Favorit nur bei Favorit-Cue)
    if (fact.field === 'vehicleInterest' && fact.value?.modelKey) {
      const trackId = resolveTrackIdForModel(lead, fact.value.modelKey);
      const entry = ensure(trackId);
      if (entry) {
        const favoritCue = /favorit|gefällt|gefaellt|lieblings/i.test(String(fact.label || ''));
        entry.status = favoritCue
          ? VEHICLE_TRACK_STATUS.FAVORITE
          : VEHICLE_TRACK_STATUS.ACTIVE;
      }
    }
  }

  // Requirements / Farbe / Lieferzeit dem Favoriten (oder einzigen Feedback-Track) zuordnen
  const favoriteEntry = [...byTrack.values()].find(
    (e) => e.status === VEHICLE_TRACK_STATUS.FAVORITE,
  ) ?? [...byTrack.values()][0] ?? null;

  if (favoriteEntry) {
    const reqs = new Set(favoriteEntry.customerRequirements ?? []);
    for (const fact of facts) {
      if (!fact || fact.needsConfirmation) continue;
      if (fact.field === 'towHitchRequired' && fact.value) {
        reqs.add('AHK wichtig');
      }
      if (fact.field === 'colorPreference' && (fact.value || fact.label)) {
        const color = String(fact.value || fact.label);
        favoriteEntry.preferredColor = color;
        reqs.add(color.charAt(0).toUpperCase() + color.slice(1));
      }
      if (
        (fact.field === 'deliveryDeadline' && fact.value?.important)
        || (fact.field === 'deliveryEstimateMonths' && /wichtig/i.test(String(fact.label || '')))
        || fact.field === 'deliveryTimeImportance'
        || (fact.factClass === SELLER_FACT_CLASS.CUSTOMER_NEED && /lieferzeit/i.test(String(fact.label || '')))
      ) {
        favoriteEntry.deliveryTimeImportance = 'high';
        reqs.add('Lieferzeit wichtig');
      }
      if (fact.field === 'sunroofRequired' && fact.value) {
        reqs.add('Schiebedach');
      }
    }
    if (reqs.size) {
      favoriteEntry.customerRequirements = [...reqs];
    }
  }

  return [...byTrack.values()];
}

export { REJECTION_REASON, VEHICLE_TRACK_STATUS };
