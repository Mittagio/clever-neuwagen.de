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
 * Mehrere Modellinteressen in einem Turn (Telefon-Capture) → Spuren anlegen.
 * Kein Fokus-Steal: bestehende ACTIVE/FAVORITE bleiben; neue Spuren OPEN
 * (erste wird ACTIVE nur wenn noch keine aktive Spur existiert).
 * Shared Requirements (AHK, …) landen auf allen betroffenen Spuren.
 *
 * @param {object} lead
 * @param {Array<{ modelKey?: string, model?: string, trim?: string, make?: string, label?: string }|string>} interests
 * @param {{ sharedRequirements?: string[] }} [options]
 * @returns {{ lead: object, trackIds: string[], createdCount: number }}
 */
export function ensureMultiVehicleInterestTracksOnLead(lead = {}, interests = [], options = {}) {
  const sharedRequirements = Array.isArray(options.sharedRequirements)
    ? options.sharedRequirements.filter(Boolean)
    : [];
  const entries = (Array.isArray(interests) ? interests : [])
    .map((entry) => {
      if (typeof entry === 'string') {
        const key = String(entry).toLowerCase().replace(/^kia\s+/i, '').trim();
        if (!key) return null;
        const modelLabel = /^ev\d$/i.test(key) ? key.toUpperCase() : key;
        return {
          modelKey: key,
          model: modelLabel,
          trim: null,
          make: 'Kia',
          label: `Kia ${modelLabel}`,
        };
      }
      const key = String(entry?.modelKey || entry?.model || '')
        .toLowerCase()
        .replace(/^kia\s+/i, '')
        .trim();
      if (!key) return null;
      const modelLabel = /^ev\d$/i.test(key)
        ? key.toUpperCase()
        : (entry.model || key);
      return {
        modelKey: key,
        model: modelLabel,
        trim: entry.trim || null,
        color: entry.color || entry.preferredColor || null,
        package: entry.package || entry.equipmentPackage || null,
        make: entry.make || 'Kia',
        label: entry.label
          || [entry.make || 'Kia', modelLabel, entry.trim].filter(Boolean).join(' '),
      };
    })
    .filter(Boolean);

  if (!entries.length) {
    return { lead, trackIds: [], createdCount: 0 };
  }

  let next = lead;
  const trackIds = [];
  let createdCount = 0;
  const existingTracks = listCustomerVehicleTracks(next);
  const hasActive = existingTracks.some((t) => (
    t.status === VEHICLE_TRACK_STATUS.ACTIVE
    || t.status === VEHICLE_TRACK_STATUS.FAVORITE
  ));

  entries.forEach((interest, index) => {
    const vehicleKey = buildVehicleKey({
      brand: 'kia',
      model: interest.model,
      modelKey: interest.modelKey,
    });
    const ensured = ensureVehicleTrack(next, {
      vehicleKey,
      displayName: interest.label,
      model: interest.model,
      modelKey: interest.modelKey,
      trimLabel: interest.trim || '',
    });
    next = ensured.lead;
    if (ensured.created) createdCount += 1;
    trackIds.push(ensured.trackId);

    const shouldActivate = !hasActive && index === 0;
    const meta = getVehicleTrackMeta(
      (next.crm?.vehicleConfigurations || []).find((c) => c?.id === ensured.trackId) || {},
    );
    const reqs = new Set([
      ...(meta.customerRequirements || []),
      ...sharedRequirements,
      ...(interest.package ? [interest.package] : []),
    ]);
    next = patchVehicleTrackOnLead(next, ensured.trackId, {
      status: shouldActivate ? VEHICLE_TRACK_STATUS.ACTIVE : (
        meta.status === VEHICLE_TRACK_STATUS.FAVORITE
        || meta.status === VEHICLE_TRACK_STATUS.ACTIVE
          ? meta.status
          : VEHICLE_TRACK_STATUS.OPEN
      ),
      customerRequirements: [...reqs],
      ...(interest.color ? { preferredColor: interest.color } : {}),
      lastActivityAt: new Date().toISOString(),
    });
    if (interest.color) {
      const configs = next.crm?.vehicleConfigurations || [];
      next = {
        ...next,
        crm: {
          ...(next.crm || {}),
          vehicleConfigurations: configs.map((config) => (
            config?.id === ensured.trackId
              ? {
                ...config,
                colorLabel: interest.color,
                updatedAt: new Date().toISOString(),
              }
              : config
          )),
        },
      };
    }
  });

  const firstId = trackIds[0] || null;
  const first = entries[0];
  const focusId = next.crm?.focusedVehicleTrackId
    || (hasActive
      ? existingTracks.find((t) => (
        t.status === VEHICLE_TRACK_STATUS.ACTIVE
        || t.status === VEHICLE_TRACK_STATUS.FAVORITE
      ))?.id
      : firstId);

  if (first && firstId) {
    const modelLabel = first.model;
    next = {
      ...next,
      // Nur setzen wenn bisher kein Fokus-Fahrzeug – sonst Multi-Capture klebt nicht um
      vehicle: next.vehicle?.modelKey && hasActive
        ? next.vehicle
        : {
          ...(next.vehicle || {}),
          brand: first.make || 'Kia',
          model: modelLabel,
          trim: first.trim || next.vehicle?.trim || '',
          modelKey: first.modelKey,
          label: first.label,
        },
      crm: {
        ...(next.crm || {}),
        focusedVehicleTrackId: focusId || firstId,
        needProfile: {
          ...(next.crm?.needProfile || {}),
          modelCandidates: [
            ...new Set([
              ...(next.crm?.needProfile?.modelCandidates || []),
              ...entries.map((e) => e.modelKey),
            ]),
          ],
          ...(!hasActive ? {
            selectedModelKey: first.modelKey,
            modelHint: first.modelKey,
            ...(String(first.modelKey).startsWith('ev') ? { fuel: 'electric' } : {}),
          } : {}),
        },
      },
    };
  }

  return { lead: next, trackIds, createdCount };
}

/**
 * Explizites Modellinteresse → Spur anlegen/fokussieren + lead.vehicle setzen.
 * Demoted andere ACTIVE/FAVORITE auf OPEN (kein Löschen).
 */
export function focusVehicleInterestOnLead(lead = {}, {
  modelKey,
  model = null,
  trim = null,
  make = 'Kia',
  label = null,
  status = VEHICLE_TRACK_STATUS.ACTIVE,
} = {}) {
  const key = String(modelKey || model || '')
    .toLowerCase()
    .replace(/^kia\s+/i, '')
    .trim();
  if (!key) return { lead, trackId: null, created: false };

  const modelLabel = /^ev\d$/i.test(key)
    ? key.toUpperCase()
    : (model || key);
  const displayName = label
    || [make, modelLabel, trim].filter(Boolean).join(' ');
  const vehicleKey = buildVehicleKey({
    brand: 'kia',
    model: modelLabel,
    modelKey: key,
  });

  const ensured = ensureVehicleTrack(lead, {
    vehicleKey,
    displayName,
    model: modelLabel,
    modelKey: key,
    trimLabel: trim || '',
  });
  let next = ensured.lead;
  const trackId = ensured.trackId;

  const configs = next?.crm?.vehicleConfigurations ?? [];
  for (const config of configs) {
    if (!config?.id || config.id === trackId) continue;
    const meta = getVehicleTrackMeta(config);
    if (
      meta.status === VEHICLE_TRACK_STATUS.FAVORITE
      || meta.status === VEHICLE_TRACK_STATUS.ACTIVE
    ) {
      next = patchVehicleTrackOnLead(next, config.id, {
        status: VEHICLE_TRACK_STATUS.OPEN,
      });
    }
  }

  next = patchVehicleTrackOnLead(next, trackId, {
    status: status === VEHICLE_TRACK_STATUS.FAVORITE
      ? VEHICLE_TRACK_STATUS.FAVORITE
      : VEHICLE_TRACK_STATUS.ACTIVE,
    lastActivityAt: new Date().toISOString(),
  });

  // Fokussierte Spur nach vorne – primaryCard / Header / CleverEmpfiehlt folgen dem Modell.
  const ordered = [...(next.crm?.vehicleConfigurations ?? [])].sort((a, b) => {
    if (a.id === trackId) return -1;
    if (b.id === trackId) return 1;
    return 0;
  });

  const openOrders = Array.isArray(next.crm?.openOfferOrders)
    ? next.crm.openOfferOrders
    : [];
  const focusedOrder = {
    id: `oor-focus-${trackId}`,
    offerId: null,
    trackId,
    model: modelLabel,
    trim: trim || null,
    status: 'prepared',
    label: `Angebotsauftrag ${displayName}`,
    createdAt: new Date().toISOString(),
    source: 'vehicle_interest_focus',
  };
  const nextOrders = [
    focusedOrder,
    ...openOrders.filter((o) => o?.trackId !== trackId),
  ];

  next = {
    ...next,
    vehicle: {
      ...(next.vehicle || {}),
      brand: make || 'Kia',
      model: modelLabel,
      trim: trim || next.vehicle?.trim || '',
      modelKey: key,
      label: displayName,
    },
    crm: {
      ...(next.crm || {}),
      vehicleConfigurations: ordered,
      openOfferOrders: nextOrders,
      focusedVehicleTrackId: trackId,
      needProfile: {
        ...(next.crm?.needProfile || {}),
        selectedModelKey: key,
        modelHint: key,
        ...(key.startsWith('ev') ? { fuel: 'electric' } : {}),
      },
    },
  };

  return { lead: next, trackId, created: ensured.created };
}

/**
 * Aktives Seller-/Akte-Modell (Fokus-Spur → ACTIVE/FAVORITE → Need-Profile → lead.vehicle).
 * @param {object} [lead]
 * @returns {{ modelKey: string, model: string, label: string, trim: string|null }|null}
 */
export function resolveActiveSellerModelInterest(lead = {}) {
  const normalizeKey = (raw) => String(raw || '')
    .toLowerCase()
    .replace(/^kia\s+/i, '')
    .replace(/\s+/g, '')
    .trim();

  const fromConfig = (config) => {
    if (!config) return null;
    const key = normalizeKey(config.modelKey || config.model);
    if (!key) return null;
    const model = /^ev\d$/i.test(key)
      ? key.toUpperCase()
      : String(config.model || key).replace(/^kia\s+/i, '');
    return {
      modelKey: key,
      model,
      trim: config.trimLabel || null,
      label: buildTrackDisplayName(config),
    };
  };

  const configs = lead?.crm?.vehicleConfigurations ?? [];
  const focusedId = lead?.crm?.focusedVehicleTrackId;
  if (focusedId) {
    const focused = fromConfig(configs.find((c) => c?.id === focusedId));
    if (focused) return focused;
  }

  const tracks = listCustomerVehicleTracks(lead);
  const active = tracks.find((t) => (
    t.status === VEHICLE_TRACK_STATUS.ACTIVE
    || t.status === VEHICLE_TRACK_STATUS.FAVORITE
  ));
  if (active) {
    const key = normalizeKey(active.modelKey || active.modelLabel || active.vehicleKey?.replace(/^kia-/, ''));
    if (key) {
      return {
        modelKey: key,
        model: /^ev\d$/i.test(key) ? key.toUpperCase() : String(active.modelLabel || key),
        trim: active.trimLabel || null,
        label: active.displayName || active.modelLabel || key,
      };
    }
  }

  const profile = lead?.crm?.needProfile || {};
  const profileKey = normalizeKey(profile.selectedModelKey || profile.modelHint);
  if (profileKey) {
    const model = /^ev\d$/i.test(profileKey) ? profileKey.toUpperCase() : profileKey;
    return {
      modelKey: profileKey,
      model,
      trim: null,
      label: `Kia ${model}`,
    };
  }

  const vehicleKey = normalizeKey(lead?.vehicle?.modelKey || lead?.vehicle?.model);
  if (vehicleKey) {
    const model = /^ev\d$/i.test(vehicleKey)
      ? vehicleKey.toUpperCase()
      : String(lead.vehicle.model || vehicleKey).replace(/^kia\s+/i, '');
    return {
      modelKey: vehicleKey,
      model,
      trim: lead.vehicle.trim || null,
      label: lead.vehicle.label || [lead.vehicle.brand || 'Kia', model].filter(Boolean).join(' '),
    };
  }

  return null;
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
