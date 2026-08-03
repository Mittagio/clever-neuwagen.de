/**
 * Fahrzeugspuren (Vehicle Tracks) – Verkaufsspur pro Modell bei einem Kunden.
 * Keine zweite Wahrheit: lebt auf vehicleConfigurations (+ Verweise auf vehicleOffers).
 * Eine Spur kann mehrere commercialScenario-gebundene Angebote haben.
 */

import {
  formatCommercialScenarioChip,
  formatCommercialScenarioConditionsLine,
  formatCommercialScenarioTypeLabel,
  listCommercialScenariosForTrack,
} from './commercialScenarios.js';
import {
  formatScenarioOfferFeedbackChip,
  getScenarioOfferFeedback,
} from './scenarioOfferFeedback.js';
import {
  getOfferByCommercialScenarioId,
  isScenarioOfferReady,
  listOffersForVehicleTrack,
} from '../vehicleOffer.js';

export const VEHICLE_TRACK_STATUS = {
  OPEN: 'open',
  ACTIVE: 'active',
  FAVORITE: 'favorite',
  DEFERRED: 'deferred',
  WON: 'won',
  LOST: 'lost',
};

export const VEHICLE_TRACK_STATUS_UI = {
  [VEHICLE_TRACK_STATUS.OPEN]: { label: 'OFFEN', tone: 'open' },
  [VEHICLE_TRACK_STATUS.ACTIVE]: { label: 'AKTIV', tone: 'active' },
  [VEHICLE_TRACK_STATUS.FAVORITE]: { label: 'FAVORIT', tone: 'favorite' },
  [VEHICLE_TRACK_STATUS.DEFERRED]: { label: 'ZURÜCKGESTELLT', tone: 'deferred' },
  [VEHICLE_TRACK_STATUS.WON]: { label: 'GEWONNEN', tone: 'won' },
  [VEHICLE_TRACK_STATUS.LOST]: { label: 'VERLOREN', tone: 'lost' },
};

export const REJECTION_REASON = {
  PRICE_TOO_HIGH: 'price_too_high',
  RATE_TOO_HIGH: 'rate_too_high',
  DOWN_PAYMENT_TOO_HIGH: 'down_payment_too_high',
  OTHER: 'other',
};

export const REJECTION_REASON_LABEL = {
  [REJECTION_REASON.PRICE_TOO_HIGH]: 'zu teuer',
  [REJECTION_REASON.RATE_TOO_HIGH]: 'Rate zu hoch',
  [REJECTION_REASON.DOWN_PAYMENT_TOO_HIGH]: 'Sonderzahlung zu hoch',
  [REJECTION_REASON.OTHER]: 'passt nicht',
};

function slugify(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * @param {object} config vehicleConfiguration
 * @returns {object} track meta (defaults merged)
 */
export function getVehicleTrackMeta(config = {}) {
  const track = config.vehicleTrack && typeof config.vehicleTrack === 'object'
    ? config.vehicleTrack
    : {};
  const status = Object.values(VEHICLE_TRACK_STATUS).includes(track.status)
    ? track.status
    : VEHICLE_TRACK_STATUS.OPEN;

  return {
    status,
    interestState: track.interestState ?? null,
    rejectionReason: track.rejectionReason ?? null,
    rejectionReasonLabel: track.rejectionReasonLabel
      ?? (track.rejectionReason ? REJECTION_REASON_LABEL[track.rejectionReason] : null),
    customerRequirements: Array.isArray(track.customerRequirements)
      ? track.customerRequirements
      : [],
    activeOfferId: track.activeOfferId ?? null,
    offerIds: Array.isArray(track.offerIds) ? track.offerIds : [],
    lastCustomerReaction: track.lastCustomerReaction ?? null,
    lastActivityAt: track.lastActivityAt ?? null,
    preferredColor: track.preferredColor ?? null,
    deliveryTimeImportance: track.deliveryTimeImportance ?? null,
    /** Nachfolgeangebot nach Propose→Confirm vorbereitet (noch nicht gesendet) */
    successionOfferPreparedAt: track.successionOfferPreparedAt ?? null,
  };
}

/**
 * Stable vehicle key for matching PDFs / feedback to a track.
 */
export function buildVehicleKey({ brand = 'kia', model = '', modelKey = '' } = {}) {
  const raw = modelKey || model || 'fahrzeug';
  return slugify(`${brand}-${raw}`) || 'fahrzeug';
}

export function buildTrackDisplayName(config = {}) {
  const model = String(config.model || config.modelKey || 'Fahrzeug').replace(/^kia\s*/i, '');
  const trim = config.trimLabel ? String(config.trimLabel).trim() : '';
  return trim ? `${model} ${trim}` : model;
}

/**
 * @param {object} lead
 * @returns {object[]} track view models for UI
 */
export function listCustomerVehicleTracks(lead = {}) {
  const configs = lead?.crm?.vehicleConfigurations ?? [];
  const offers = lead?.crm?.vehicleOffers ?? {};

  return configs.filter(Boolean).map((config) => {
    const meta = getVehicleTrackMeta(config);
    const cardId = config.id;
    const trackOffers = listOffersForVehicleTrack(lead, cardId);
    const vehicleOffer = trackOffers[0]
      ?? offers[cardId]
      ?? null;
    const payment = resolveTrackPayment(config, vehicleOffer);
    const statusUi = VEHICLE_TRACK_STATUS_UI[meta.status] ?? VEHICLE_TRACK_STATUS_UI.open;
    const requirementLabels = buildRequirementLabels(meta);
    const scenarioSlots = listScenarioOfferSlots(lead, cardId);
    const offerIds = meta.offerIds.length
      ? meta.offerIds
      : trackOffers.map((o) => o.id).filter(Boolean);

    return {
      id: cardId,
      customerId: lead?.id ?? null,
      vehicleKey: buildVehicleKey({
        brand: config.brand || 'kia',
        model: config.model,
        modelKey: config.modelKey,
      }),
      displayName: buildTrackDisplayName(config),
      modelLabel: String(config.model || config.modelKey || '').replace(/^kia\s*/i, '') || 'Fahrzeug',
      status: meta.status,
      statusLabel: statusUi.label,
      statusTone: statusUi.tone,
      interestState: meta.interestState,
      rejectionReason: meta.rejectionReason,
      rejectionReasonLabel: meta.rejectionReasonLabel,
      customerRequirements: meta.customerRequirements,
      requirementLabels,
      activeOfferId: meta.activeOfferId ?? (vehicleOffer?.id ?? null),
      offerIds: offerIds.length
        ? offerIds
        : (vehicleOffer ? [vehicleOffer.id] : []),
      lastCustomerReaction: meta.lastCustomerReaction,
      lastActivityAt: meta.lastActivityAt
        ?? vehicleOffer?.updatedAt
        ?? config.updatedAt
        ?? null,
      monthlyRate: payment.monthlyRate,
      termMonths: payment.termMonths,
      annualMileage: payment.annualMileage,
      downPayment: payment.downPayment,
      offerStatus: vehicleOffer?.status ?? null,
      successionOfferPreparedAt: meta.successionOfferPreparedAt ?? null,
      offerVersion: vehicleOffer?.version ?? 1,
      sourcePdfName: vehicleOffer?.pdf?.name ?? vehicleOffer?.pdf?.fileName ?? null,
      openedAt: vehicleOffer?.tracking?.firstOpenedAt
        ?? vehicleOffer?.tracking?.lastOpenedAt
        ?? null,
      sentAt: vehicleOffer?.sentAt ?? null,
      config,
      vehicleOffer,
      trackOffers,
      scenarioSlots,
      hasMultipleScenarios: scenarioSlots.length > 1,
    };
  });
}

/**
 * Seller Angebotsbereich: ein Slot pro commercialScenario an der Spur.
 */
export function listScenarioOfferSlots(lead = {}, trackId) {
  const scenarios = listCommercialScenariosForTrack(lead, trackId);
  if (!scenarios.length) return [];

  return scenarios.map((scenario) => {
    const offer = getOfferByCommercialScenarioId(lead, scenario.id, trackId);
    const monthlyRate = offer?.monthlyRate
      ?? offer?.boardOffer?.payment?.monthlyRate
      ?? null;
    const balloonPayment = offer?.balloonPayment
      ?? offer?.boardOffer?.payment?.balloonPayment
      ?? null;
    const ready = isScenarioOfferReady(offer);
    const checked = Boolean(offer?.checked || offer?.verified || ready);
    const feedback = getScenarioOfferFeedback(lead, scenario.id)
      || offer?.customerFeedback
      || null;
    const feedbackLabel = feedback
      ? formatScenarioOfferFeedbackChip(feedback, lead)
      : null;

    return {
      scenarioId: scenario.id,
      scenario,
      offer,
      offerId: offer?.id ?? null,
      type: scenario.type,
      typeLabel: formatCommercialScenarioTypeLabel(scenario.type),
      chipLabel: formatCommercialScenarioChip(scenario),
      conditionsLine: formatCommercialScenarioConditionsLine(scenario),
      monthlyRate,
      balloonPayment,
      ready,
      checked,
      statusLabel: ready ? 'Bereit' : 'Noch zu erstellen',
      pdf: offer?.pdf ?? null,
      customerFeedback: feedback,
      feedbackLabel,
      feedbackReason: feedback?.reason ?? null,
      feedbackSentiment: feedback?.sentiment ?? null,
    };
  });
}

function resolveTrackPayment(config = {}, vehicleOffer = null) {
  const board = config.boardOffer?.payment
    ?? vehicleOffer?.boardOffer?.payment
    ?? null;
  if (board) {
    return {
      monthlyRate: board.monthlyRate ?? vehicleOffer?.monthlyRate ?? null,
      termMonths: board.termMonths ?? vehicleOffer?.termMonths ?? null,
      annualMileage: board.mileagePerYear ?? board.annualMileage ?? vehicleOffer?.mileagePerYear ?? null,
      downPayment: board.downPayment ?? vehicleOffer?.downPayment ?? 0,
    };
  }
  if (vehicleOffer?.monthlyRate != null || vehicleOffer?.termMonths != null) {
    return {
      monthlyRate: vehicleOffer.monthlyRate ?? null,
      termMonths: vehicleOffer.termMonths ?? null,
      annualMileage: vehicleOffer.mileagePerYear ?? null,
      downPayment: vehicleOffer.downPayment ?? 0,
    };
  }
  const leasing = config.leasingData ?? {};
  return {
    monthlyRate: leasing.calculatedRate ?? config.monthlyRate ?? null,
    termMonths: leasing.termMonths ?? config.termMonths ?? null,
    annualMileage: leasing.mileagePerYear ?? config.mileagePerYear ?? null,
    downPayment: leasing.downPayment ?? config.downPayment ?? 0,
  };
}

function buildRequirementLabels(meta = {}) {
  const labels = [];
  for (const req of meta.customerRequirements ?? []) {
    if (typeof req === 'string' && req.trim()) labels.push(req.trim());
    else if (req?.label) labels.push(String(req.label));
  }
  if (meta.preferredColor) {
    const color = String(meta.preferredColor);
    if (!labels.some((l) => l.toLowerCase() === color.toLowerCase())) {
      labels.push(color.charAt(0).toUpperCase() + color.slice(1));
    }
  }
  if (meta.deliveryTimeImportance === 'high' || meta.deliveryTimeImportance === true) {
    if (!labels.some((l) => /lieferzeit/i.test(l))) labels.push('Lieferzeit wichtig');
  }
  return labels;
}

/**
 * Patch track meta on a configuration (immutable lead patch helper).
 */
export function patchVehicleTrackOnLead(lead = {}, configId, trackPatch = {}) {
  const configs = lead?.crm?.vehicleConfigurations ?? [];
  const nextConfigs = configs.map((config) => {
    if (config.id !== configId) return config;
    const prev = getVehicleTrackMeta(config);
    return {
      ...config,
      vehicleTrack: {
        ...prev,
        ...trackPatch,
        customerRequirements: trackPatch.customerRequirements !== undefined
          ? trackPatch.customerRequirements
          : prev.customerRequirements,
        offerIds: trackPatch.offerIds !== undefined
          ? trackPatch.offerIds
          : prev.offerIds,
        lastActivityAt: trackPatch.lastActivityAt ?? new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };
  });
  return {
    ...lead,
    crm: {
      ...(lead.crm ?? {}),
      vehicleConfigurations: nextConfigs,
    },
  };
}

/**
 * Ensure a track exists for a vehicle key; create config shell if missing.
 * Does not invent offer numbers – only structural track.
 */
export function ensureVehicleTrack(lead = {}, {
  vehicleKey,
  displayName,
  model,
  modelKey,
  trimLabel = '',
} = {}) {
  const tracks = listCustomerVehicleTracks(lead);
  const existing = tracks.find((t) => t.vehicleKey === vehicleKey
    || slugify(t.modelLabel) === slugify(model || modelKey || ''));
  if (existing) {
    return { lead, trackId: existing.id, created: false };
  }

  const id = `vc-track-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const config = {
    id,
    brand: 'Kia',
    model: model || displayName || modelKey,
    modelKey: modelKey || slugify(model || displayName || 'fahrzeug'),
    trimLabel,
    vehicleTrack: {
      status: VEHICLE_TRACK_STATUS.OPEN,
      interestState: null,
      rejectionReason: null,
      customerRequirements: [],
      activeOfferId: null,
      offerIds: [],
      lastCustomerReaction: null,
      lastActivityAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    lead: {
      ...lead,
      crm: {
        ...(lead.crm ?? {}),
        vehicleConfigurations: [...(lead.crm?.vehicleConfigurations ?? []), config],
      },
    },
    trackId: id,
    created: true,
  };
}

/**
 * Filter tracks for Angebote-Tab: all | active | deferred.
 */
export function filterTracksByStatus(tracks = [], filter = 'all') {
  if (filter === 'active') {
    return tracks.filter((t) => (
      t.status === VEHICLE_TRACK_STATUS.FAVORITE
      || t.status === VEHICLE_TRACK_STATUS.ACTIVE
      || t.status === VEHICLE_TRACK_STATUS.OPEN
    ));
  }
  if (filter === 'deferred') {
    return tracks.filter((t) => t.status === VEHICLE_TRACK_STATUS.DEFERRED);
  }
  return tracks;
}

/**
 * Sort tracks for Clever overview: favorite → active → open → deferred → rest.
 */
export function sortTracksForOverview(tracks = []) {
  const rank = {
    [VEHICLE_TRACK_STATUS.FAVORITE]: 0,
    [VEHICLE_TRACK_STATUS.ACTIVE]: 1,
    [VEHICLE_TRACK_STATUS.OPEN]: 2,
    [VEHICLE_TRACK_STATUS.WON]: 3,
    [VEHICLE_TRACK_STATUS.DEFERRED]: 4,
    [VEHICLE_TRACK_STATUS.LOST]: 5,
  };
  return [...tracks].sort((a, b) => {
    const ra = rank[a.status] ?? 9;
    const rb = rank[b.status] ?? 9;
    if (ra !== rb) return ra - rb;
    return String(a.displayName).localeCompare(String(b.displayName), 'de');
  });
}

/**
 * Apply multi-vehicle seller feedback (Brandes case) without deleting tracks.
 */
export function applyTrackFeedbackFacts(lead = {}, facts = []) {
  let next = lead;
  for (const fact of facts) {
    const trackId = fact.trackId || fact.vehicleTrackId || fact.configId;
    if (!trackId) continue;
    const patch = {};
    if (fact.status) patch.status = fact.status;
    if (fact.rejectionReason) {
      patch.rejectionReason = fact.rejectionReason;
      patch.rejectionReasonLabel = fact.rejectionReasonLabel
        ?? REJECTION_REASON_LABEL[fact.rejectionReason]
        ?? null;
    }
    if (fact.preferredColor) patch.preferredColor = fact.preferredColor;
    if (fact.deliveryTimeImportance != null) {
      patch.deliveryTimeImportance = fact.deliveryTimeImportance;
    }
    if (Array.isArray(fact.customerRequirements)) {
      patch.customerRequirements = fact.customerRequirements;
    } else if (fact.addRequirement) {
      const prev = getVehicleTrackMeta(
        (next.crm?.vehicleConfigurations ?? []).find((c) => c.id === trackId),
      );
      const labels = new Set(prev.customerRequirements.map((r) => (
        typeof r === 'string' ? r : r?.label
      )).filter(Boolean));
      labels.add(fact.addRequirement);
      patch.customerRequirements = [...labels];
    }
    if (fact.lastCustomerReaction) patch.lastCustomerReaction = fact.lastCustomerReaction;
    next = patchVehicleTrackOnLead(next, trackId, patch);
  }
  return next;
}
