/**
 * Clever Journey Manager – Typen & Labels (keine Datenhaltung).
 */

export const JOURNEY_PHASE = {
  NEW_INQUIRY: 'new_inquiry',
  FIRST_CONTACT: 'first_contact',
  NEEDS_ANALYSIS: 'needs_analysis',
  VEHICLE_FOUND: 'vehicle_found',
  OFFER_CREATED: 'offer_created',
  OFFER_SENT: 'offer_sent',
  CUSTOMER_CONSIDERING: 'customer_considering',
  TEST_DRIVE: 'test_drive',
  FINANCING: 'financing',
  DOCUMENTS: 'documents',
  ORDER: 'order',
  DELIVERY: 'delivery',
  HANDOVER: 'handover',
  AFTERCARE: 'aftercare',
  LOST: 'lost',
  CLOSED: 'closed',
};

export const JOURNEY_PHASE_LABEL = {
  [JOURNEY_PHASE.NEW_INQUIRY]: 'Neue Anfrage',
  [JOURNEY_PHASE.FIRST_CONTACT]: 'Erstkontakt',
  [JOURNEY_PHASE.NEEDS_ANALYSIS]: 'Bedarfsanalyse',
  [JOURNEY_PHASE.VEHICLE_FOUND]: 'Fahrzeug gefunden',
  [JOURNEY_PHASE.OFFER_CREATED]: 'Angebot erstellt',
  [JOURNEY_PHASE.OFFER_SENT]: 'Angebot versendet',
  [JOURNEY_PHASE.CUSTOMER_CONSIDERING]: 'Kunde überlegt',
  [JOURNEY_PHASE.TEST_DRIVE]: 'Probefahrt',
  [JOURNEY_PHASE.FINANCING]: 'Finanzierung',
  [JOURNEY_PHASE.DOCUMENTS]: 'Unterlagen',
  [JOURNEY_PHASE.ORDER]: 'Bestellung',
  [JOURNEY_PHASE.DELIVERY]: 'Lieferung',
  [JOURNEY_PHASE.HANDOVER]: 'Auslieferung',
  [JOURNEY_PHASE.AFTERCARE]: 'Nachbetreuung',
  [JOURNEY_PHASE.LOST]: 'Verloren',
  [JOURNEY_PHASE.CLOSED]: 'Abgeschlossen',
};

export const CANONICAL_OFFER_STATE = {
  NONE: 'none',
  DRAFT: 'draft',
  CREATED: 'created',
  SENT: 'sent',
  OPENED: 'opened',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
};

export const CANONICAL_OFFER_STATE_LABEL = {
  [CANONICAL_OFFER_STATE.NONE]: 'Kein Angebot',
  [CANONICAL_OFFER_STATE.DRAFT]: 'Entwurf',
  [CANONICAL_OFFER_STATE.CREATED]: 'Angebot erstellt',
  [CANONICAL_OFFER_STATE.SENT]: 'Versendet',
  [CANONICAL_OFFER_STATE.OPENED]: 'Geöffnet',
  [CANONICAL_OFFER_STATE.ACCEPTED]: 'Angenommen',
  [CANONICAL_OFFER_STATE.REJECTED]: 'Abgelehnt',
};

/** Rangfolge für Kanonisierung über mehrere Angebotsquellen */
export const CANONICAL_OFFER_RANK = {
  [CANONICAL_OFFER_STATE.NONE]: 0,
  [CANONICAL_OFFER_STATE.REJECTED]: 1,
  [CANONICAL_OFFER_STATE.DRAFT]: 2,
  [CANONICAL_OFFER_STATE.CREATED]: 3,
  [CANONICAL_OFFER_STATE.SENT]: 4,
  [CANONICAL_OFFER_STATE.OPENED]: 5,
  [CANONICAL_OFFER_STATE.ACCEPTED]: 6,
};

export const JOURNEY_SCORE_KEYS = [
  'abschlusschance',
  'aktivitaet',
  'dringlichkeit',
  'kaufwahrscheinlichkeit',
  'cleverPotenzial',
];

export function getJourneyPhaseLabel(phase) {
  return JOURNEY_PHASE_LABEL[phase] ?? 'Unbekannt';
}

export function getCanonicalOfferStateLabel(state) {
  return CANONICAL_OFFER_STATE_LABEL[state] ?? 'Unbekannt';
}
