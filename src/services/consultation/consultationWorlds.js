/**
 * Clever – drei getrennte Welten (Need → Fahrzeug → Angebot).
 */
import { QUERY_TYPES } from '../clever/customerQueryTypes.js';

export const CLEVER_WORLD = {
  /** Welt 1 – noch kein Fahrzeug, keine Trim/Rate */
  NEED_CONSULTATION: 'need_consultation',
  /** Welt 2 – Modell gewählt, Ausstattung & Fahrzeugwissen */
  VEHICLE_CONSULTATION: 'vehicle_consultation',
  /** Welt 3 – Autohaus: Angebot, Portal, Journey */
  OFFER: 'offer',
};

export const CLEVER_WORLD_LABEL = {
  [CLEVER_WORLD.NEED_CONSULTATION]: 'Clever Beratung',
  [CLEVER_WORLD.VEHICLE_CONSULTATION]: 'Fahrzeugberatung',
  [CLEVER_WORLD.OFFER]: 'Angebot',
};

const VEHICLE_WORLD_QUERY_TYPES = new Set([
  QUERY_TYPES.MODEL_EQUIPMENT_QUESTION,
  QUERY_TYPES.SPECIAL_CHECK_QUESTION,
]);

/**
 * @param {object} classification
 */
export function requiresVehicleConsultationWorld(classification = {}) {
  if (!classification?.queryType) return false;
  if (VEHICLE_WORLD_QUERY_TYPES.has(classification.queryType)) return true;
  if (classification.queryType === QUERY_TYPES.COMPARISON_QUESTION
    && classification.topic === 'trim') {
    return true;
  }
  return false;
}

/**
 * @param {object} ctx
 */
export function getActiveCleverWorld({
  needProfile = null,
  lead = null,
  sessionContext = null,
  hasOffer = false,
} = {}) {
  if (hasOffer || lead?.crm?.vehicleOffers && Object.keys(lead.crm.vehicleOffers).length > 0) {
    return CLEVER_WORLD.OFFER;
  }
  const modelKey = needProfile?.selectedModelKey
    ?? sessionContext?.modelKey
    ?? sessionContext?.modelsInFocus?.[0]
    ?? lead?.crm?.needProfile?.selectedModelKey
    ?? lead?.sonderwuensche?.consultation?.cleverRecommendation?.modelKey
    ?? null;
  if (modelKey) return CLEVER_WORLD.VEHICLE_CONSULTATION;
  return CLEVER_WORLD.NEED_CONSULTATION;
}

/**
 * @param {object} classification
 */
export function buildWorldGateRedirect(classification = {}) {
  const modelLabel = classification.modelLabel ?? classification.modelKey ?? 'dieses Modell';
  return {
    ok: true,
    worldGate: CLEVER_WORLD.NEED_CONSULTATION,
    classification,
    ui: {
      component: 'need_world_gate',
      title: 'Zuerst die passende Richtung finden',
      body: `Fragen zu Ausstattung wie Wärmepumpe oder GT-Line beantworten wir, sobald Sie sich für ein Modell entschieden haben – zum Beispiel den ${modelLabel}.`,
      ctaLabel: 'Beratung fortsetzen',
    },
    followUps: [],
    dataConfidence: 'general',
  };
}

/**
 * @param {string} world
 */
export function isNeedConsultationWorld(world) {
  return world === CLEVER_WORLD.NEED_CONSULTATION;
}

/**
 * @param {string} world
 */
export function isVehicleConsultationWorld(world) {
  return world === CLEVER_WORLD.VEHICLE_CONSULTATION;
}

/**
 * @param {string} world
 */
export function isOfferWorld(world) {
  return world === CLEVER_WORLD.OFFER;
}
