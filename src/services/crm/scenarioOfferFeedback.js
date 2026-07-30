/**
 * Kundenfeedback je Angebotsvariante (commercialScenario / Offer).
 * Bindet Reaktion an commercialScenarioId – nicht als vage Spur-Notiz.
 * Keine zweite Customer-Truth-Welt; lebt unter crm.customerTruth.scenarioOfferFeedback.
 */

import {
  formatCommercialScenarioTypeLabel,
  getCommercialScenarioById,
  listCommercialScenarios,
} from './commercialScenarios.js';
import { getOfferByCommercialScenarioId } from '../vehicleOffer.js';

export const SCENARIO_FEEDBACK_REASON = {
  PREFERRED: 'preferred',
  BALLOON_TOO_HIGH: 'balloon_too_high',
  DIFFERENT_TERM: 'different_term',
  RATE_TOO_HIGH: 'rate_too_high',
  TOO_EXPENSIVE: 'too_expensive',
  MORE_INFO: 'more_info',
  CALL_REQUESTED: 'call_requested',
  OTHER: 'other',
};

export const SCENARIO_FEEDBACK_SENTIMENT = {
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  CHANGE: 'change',
  NEUTRAL: 'neutral',
};

export const SCENARIO_FEEDBACK_SOURCE = {
  PORTAL: 'portal',
  SELLER: 'seller',
};

const REASON_LABEL = {
  [SCENARIO_FEEDBACK_REASON.PREFERRED]: 'gefällt besser',
  [SCENARIO_FEEDBACK_REASON.BALLOON_TOO_HIGH]: 'Schlussrate zu hoch',
  [SCENARIO_FEEDBACK_REASON.DIFFERENT_TERM]: 'andere Laufzeit gewünscht',
  [SCENARIO_FEEDBACK_REASON.RATE_TOO_HIGH]: 'Rate zu hoch',
  [SCENARIO_FEEDBACK_REASON.TOO_EXPENSIVE]: 'zu teuer',
  [SCENARIO_FEEDBACK_REASON.MORE_INFO]: 'mehr Infos',
  [SCENARIO_FEEDBACK_REASON.CALL_REQUESTED]: 'Rückruf gewünscht',
  [SCENARIO_FEEDBACK_REASON.OTHER]: 'Rückmeldung',
};

/**
 * @param {object} raw
 * @returns {object|null}
 */
export function normalizeScenarioOfferFeedback(raw = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const commercialScenarioId = String(raw.commercialScenarioId ?? '').trim();
  if (!commercialScenarioId) return null;

  const reason = normalizeFeedbackReason(raw.reason);
  const sentiment = normalizeSentiment(raw.sentiment)
    || sentimentFromReason(reason, raw.reactionStatus);

  return {
    id: String(raw.id || `sof-${commercialScenarioId}`).trim(),
    commercialScenarioId,
    offerId: raw.offerId ?? null,
    vehicleTrackId: raw.vehicleTrackId ?? null,
    reactionStatus: raw.reactionStatus ?? null,
    reason,
    freeText: raw.freeText ? String(raw.freeText).trim() : null,
    label: raw.label ? String(raw.label).trim() : null,
    sentiment,
    source: raw.source || SCENARIO_FEEDBACK_SOURCE.SELLER,
    reactedAt: raw.reactedAt ?? null,
  };
}

export function normalizeFeedbackReason(value) {
  const v = String(value ?? '').toLowerCase().trim();
  if (Object.values(SCENARIO_FEEDBACK_REASON).includes(v)) return v;
  if (v === 'interested' || v === 'gefällt' || v === 'gefaellt') {
    return SCENARIO_FEEDBACK_REASON.PREFERRED;
  }
  if (/schlussrate|balloon|restwert/.test(v)) {
    return SCENARIO_FEEDBACK_REASON.BALLOON_TOO_HIGH;
  }
  if (/laufzeit|term/.test(v)) return SCENARIO_FEEDBACK_REASON.DIFFERENT_TERM;
  if (/rate/.test(v) && /hoch|teuer/.test(v)) return SCENARIO_FEEDBACK_REASON.RATE_TOO_HIGH;
  if (/teuer|expensive/.test(v)) return SCENARIO_FEEDBACK_REASON.TOO_EXPENSIVE;
  if (/rückruf|rueckruf|call/.test(v)) return SCENARIO_FEEDBACK_REASON.CALL_REQUESTED;
  if (/info|frage/.test(v)) return SCENARIO_FEEDBACK_REASON.MORE_INFO;
  return SCENARIO_FEEDBACK_REASON.OTHER;
}

function normalizeSentiment(value) {
  const v = String(value ?? '').toLowerCase().trim();
  if (Object.values(SCENARIO_FEEDBACK_SENTIMENT).includes(v)) return v;
  return null;
}

function sentimentFromReason(reason, reactionStatus) {
  if (
    reason === SCENARIO_FEEDBACK_REASON.PREFERRED
    || reactionStatus === 'interested'
  ) {
    return SCENARIO_FEEDBACK_SENTIMENT.POSITIVE;
  }
  if (
    reason === SCENARIO_FEEDBACK_REASON.DIFFERENT_TERM
    || reactionStatus === 'change_requested'
  ) {
    return SCENARIO_FEEDBACK_SENTIMENT.CHANGE;
  }
  if (
    reactionStatus === 'call_requested'
    || reactionStatus === 'more_info'
  ) {
    return SCENARIO_FEEDBACK_SENTIMENT.NEUTRAL;
  }
  if (
    reason === SCENARIO_FEEDBACK_REASON.BALLOON_TOO_HIGH
    || reason === SCENARIO_FEEDBACK_REASON.RATE_TOO_HIGH
    || reason === SCENARIO_FEEDBACK_REASON.TOO_EXPENSIVE
    || reactionStatus === 'declined'
  ) {
    return SCENARIO_FEEDBACK_SENTIMENT.NEGATIVE;
  }
  return SCENARIO_FEEDBACK_SENTIMENT.NEUTRAL;
}

/**
 * Chip-Label: „Leasing · gefällt besser“ / „Finanzierung · Schlussrate zu hoch“
 */
export function formatScenarioOfferFeedbackChip(feedback = {}, lead = {}) {
  if (feedback.label) return String(feedback.label);
  const scenario = getCommercialScenarioById(lead, feedback.commercialScenarioId);
  const typeLabel = scenario
    ? formatCommercialScenarioTypeLabel(scenario.type)
    : 'Angebot';
  const reasonLabel = REASON_LABEL[feedback.reason] || REASON_LABEL.other;
  if (feedback.freeText) {
    return `${typeLabel} · ${feedback.freeText}`;
  }
  return `${typeLabel} · ${reasonLabel}`;
}

export function listScenarioOfferFeedback(lead = {}) {
  const raw = lead?.crm?.customerTruth?.scenarioOfferFeedback;
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeScenarioOfferFeedback).filter(Boolean);
}

export function getScenarioOfferFeedback(lead = {}, commercialScenarioId) {
  if (!commercialScenarioId) return null;
  return listScenarioOfferFeedback(lead)
    .find((f) => f.commercialScenarioId === commercialScenarioId) ?? null;
}

/**
 * Upsert feedback by commercialScenarioId (immutable).
 */
export function upsertScenarioOfferFeedbackOnLead(lead = {}, feedbackInput = {}) {
  const entry = normalizeScenarioOfferFeedback({
    ...feedbackInput,
    reactedAt: feedbackInput.reactedAt || new Date().toISOString(),
    label: feedbackInput.label
      || formatScenarioOfferFeedbackChip(feedbackInput, lead),
  });
  if (!entry) return lead;

  const prev = listScenarioOfferFeedback(lead);
  const nextList = [
    ...prev.filter((f) => f.commercialScenarioId !== entry.commercialScenarioId),
    entry,
  ];

  let next = {
    ...lead,
    crm: {
      ...(lead.crm ?? {}),
      customerTruth: {
        ...(lead.crm?.customerTruth ?? {}),
        scenarioOfferFeedback: nextList,
      },
    },
  };

  // Spiegel auf Offer-Objekt (kein zweiter Store – Lesekomfort)
  if (entry.offerId || entry.commercialScenarioId) {
    const offers = { ...(next.crm.vehicleOffers ?? {}) };
    let offerKey = entry.offerId;
    if (!offerKey || !offers[offerKey]) {
      const offer = getOfferByCommercialScenarioId(
        next,
        entry.commercialScenarioId,
        entry.vehicleTrackId,
      );
      offerKey = offer?.id ?? null;
    }
    if (offerKey && offers[offerKey]) {
      offers[offerKey] = {
        ...offers[offerKey],
        customerFeedback: {
          commercialScenarioId: entry.commercialScenarioId,
          reason: entry.reason,
          freeText: entry.freeText,
          label: entry.label,
          sentiment: entry.sentiment,
          reactionStatus: entry.reactionStatus,
          reactedAt: entry.reactedAt,
          source: entry.source,
        },
      };
      next = {
        ...next,
        crm: {
          ...next.crm,
          vehicleOffers: offers,
        },
      };
    }
  }

  return next;
}

/**
 * Apply several feedback facts (from seller / portal mapper).
 */
export function applyScenarioOfferFeedbackFacts(lead = {}, facts = []) {
  let next = lead;
  for (const fact of facts) {
    if (!fact?.commercialScenarioId) continue;
    next = upsertScenarioOfferFeedbackOnLead(next, fact);
  }
  return next;
}

/**
 * Map portal declineReason / change dimension → structured reason.
 */
export function reasonFromPortalReaction({
  reactionStatus = null,
  declineReason = null,
  changeDimension = null,
  declineNote = null,
  questionText = null,
} = {}) {
  const note = `${declineNote || ''} ${questionText || ''}`.toLowerCase();

  if (reactionStatus === 'interested') return SCENARIO_FEEDBACK_REASON.PREFERRED;
  if (reactionStatus === 'call_requested') return SCENARIO_FEEDBACK_REASON.CALL_REQUESTED;
  if (reactionStatus === 'more_info') return SCENARIO_FEEDBACK_REASON.MORE_INFO;

  if (
    changeDimension === 'term'
    || /laufzeit/.test(note)
  ) {
    return SCENARIO_FEEDBACK_REASON.DIFFERENT_TERM;
  }

  if (/schlussrate|balloon|restwert|schlusszahlung/.test(note)) {
    return SCENARIO_FEEDBACK_REASON.BALLOON_TOO_HIGH;
  }

  if (/rate\s+zu\s+hoch/.test(note)) {
    return SCENARIO_FEEDBACK_REASON.RATE_TOO_HIGH;
  }

  if (declineReason === 'too_expensive') {
    return SCENARIO_FEEDBACK_REASON.TOO_EXPENSIVE;
  }

  if (reactionStatus === 'change_requested') {
    return SCENARIO_FEEDBACK_REASON.OTHER;
  }

  if (reactionStatus === 'declined') {
    return SCENARIO_FEEDBACK_REASON.OTHER;
  }
  return SCENARIO_FEEDBACK_REASON.OTHER;
}

/**
 * Seller-Text → Feedback-Facts je Variante (Dual-Szenario).
 * Beispiele:
 * - „Leasing gefällt besser“
 * - „Finanzierung zu hohe Schlussrate“
 * - „andere Laufzeit gewünscht“ / „Finanzierung andere Laufzeit“
 *
 * @returns {object[]} raw feedback entries (commercialScenarioId gebunden)
 */
export function parseScenarioOfferFeedbackFromText(text = '', lead = {}) {
  const t = String(text || '').toLowerCase().normalize('NFC');
  if (!t.trim()) return [];

  const scenarios = listCommercialScenarios(lead)
    .filter((s) => s.source !== 'legacy');
  if (scenarios.length < 1) return [];

  const byType = (type) => scenarios.find((s) => s.type === type) ?? null;
  const leasing = byType('leasing');
  const financing = byType('financing');
  const results = [];

  function pushFor(scenario, reason, freeText = null, label = null) {
    if (!scenario) return;
    const offer = getOfferByCommercialScenarioId(lead, scenario.id, scenario.vehicleTrackId);
    results.push({
      commercialScenarioId: scenario.id,
      offerId: offer?.id ?? null,
      vehicleTrackId: scenario.vehicleTrackId
        || offer?.vehicleTrackId
        || offer?.vehicleCardId
        || null,
      reason,
      freeText,
      label,
      reactionStatus: reason === SCENARIO_FEEDBACK_REASON.PREFERRED
        ? 'interested'
        : (reason === SCENARIO_FEEDBACK_REASON.DIFFERENT_TERM
          ? 'change_requested'
          : 'declined'),
      source: SCENARIO_FEEDBACK_SOURCE.SELLER,
    });
  }

  // „Leasing gefällt besser / Favorit / mag …“
  if (
    leasing
    && /\bleasing\b/.test(t)
    && /gefällt\s+besser|gefaellt\s+besser|favorit|lieber|mag\s+(?:er|sie|kunde)/.test(t)
  ) {
    pushFor(
      leasing,
      SCENARIO_FEEDBACK_REASON.PREFERRED,
      null,
      'Leasing · gefällt besser',
    );
  }

  // „Finanzierung gefällt besser“
  if (
    financing
    && /\bfinanzierung\b/.test(t)
    && /gefällt\s+besser|gefaellt\s+besser|favorit|lieber/.test(t)
  ) {
    pushFor(
      financing,
      SCENARIO_FEEDBACK_REASON.PREFERRED,
      null,
      'Finanzierung · gefällt besser',
    );
  }

  // „Finanzierung … Schlussrate zu hoch / zu hohe Schlussrate“
  if (
    financing
    && (
      (/\bfinanzierung\b/.test(t) && /schlussrate|restwert|schlusszahlung/.test(t))
      || /zu\s+hohe\s+schlussrate|schlussrate\s+zu\s+hoch/.test(t)
    )
  ) {
    pushFor(
      financing,
      SCENARIO_FEEDBACK_REASON.BALLOON_TOO_HIGH,
      null,
      'Finanzierung · Schlussrate zu hoch',
    );
  }

  // „andere Laufzeit“ – optional typgebunden
  if (/andere\s+laufzeit|laufzeit\s+(?:ändern|aendern|anders|kürzer|kuerzer|länger|laenger)/.test(t)) {
    const target = /\bfinanzierung\b/.test(t)
      ? financing
      : (/\bleasing\b/.test(t) ? leasing : (financing || leasing));
    if (target) {
      const typeLabel = formatCommercialScenarioTypeLabel(target.type);
      pushFor(
        target,
        SCENARIO_FEEDBACK_REASON.DIFFERENT_TERM,
        null,
        `${typeLabel} · andere Laufzeit gewünscht`,
      );
    }
  }

  // „Leasing Rate zu hoch“ / „Finanzierung zu teuer“
  if (leasing && /\bleasing\b/.test(t) && /(?:rate\s+)?zu\s+(?:hoch|teuer)/.test(t)
    && !/gefällt|gefaellt/.test(t)) {
    const rate = /rate/.test(t);
    pushFor(
      leasing,
      rate ? SCENARIO_FEEDBACK_REASON.RATE_TOO_HIGH : SCENARIO_FEEDBACK_REASON.TOO_EXPENSIVE,
    );
  }
  if (
    financing
    && /\bfinanzierung\b/.test(t)
    && /(?:rate\s+)?zu\s+(?:hoch|teuer)/.test(t)
    && !/schlussrate|restwert|gefällt|gefaellt/.test(t)
  ) {
    const rate = /rate/.test(t);
    pushFor(
      financing,
      rate ? SCENARIO_FEEDBACK_REASON.RATE_TOO_HIGH : SCENARIO_FEEDBACK_REASON.TOO_EXPENSIVE,
    );
  }

  // Dedup by scenario (last wins within parse)
  const byId = new Map();
  for (const entry of results) {
    byId.set(entry.commercialScenarioId, entry);
  }
  return [...byId.values()];
}
