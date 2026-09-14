/**
 * Concept Offer Draft → VehicleOffer (bestehender Calculator/Handoff-Pfad).
 *
 * Trigger: autoritative Rate (PDF / Calculator) am Draft.
 * Idempotent über sourceOfferDraftId / offerDraftId.
 * Keine neue Offer-Architektur.
 */
import { magicPreparationToConfigurePatch } from '../dealer/magicOfferService.js';
import { buildConfigureDraft } from '../dealerAiVehicleConfigureFlow.js';
import {
  buildOfferDraft,
  finalizeLeadWithOfferDraft,
  offerDraftToVehicleCard,
  offerDraftToVehicleConfiguration,
} from '../dealerAiOfferCreate.js';
import {
  listStoredVehicleOffers,
  resolveSourceOfferDraftId,
  attachSourceOfferDraftId,
  VEHICLE_OFFER_STATUS,
} from '../vehicleOffer.js';
import { listCommercialScenarios } from '../crm/commercialScenarios.js';
import { resolvePortfolioChangeRequestForOfferDraft } from '../crm/customerOfferPortfolioService.js';
import {
  buildHandoffFromOfferDraftId,
  getOfferDraftById,
  getCleverWorkingState,
} from './cleverWorkingDraft.js';
import { RATE_AUTHORITY } from './captureThenOffer.js';

function asPositiveRate(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isAuthoritativeDraftRate(draft = {}) {
  const auth = draft.rateAuthority;
  if (auth === RATE_AUTHORITY.STALE || auth === RATE_AUTHORITY.NON_AUTHORITATIVE) {
    return false;
  }
  if (auth === RATE_AUTHORITY.AUTHORITATIVE || auth === 'bank_pdf') {
    return true;
  }
  // PDF-Merge-Marker ohne explizites Enum
  return Boolean(draft.pdfSource?.mergedAt) && asPositiveRate(draft.rate) != null;
}

/**
 * Draft ausreichend für echtes VehicleOffer?
 * Lokale Capture-Refinements (trimCandidate / packageCandidates) blockieren nicht.
 */
export function isOfferDraftReadyForVehicleOffer(draft = null) {
  if (!draft?.offerDraftId) return false;
  const identity = draft.vehicleIdentityDraft || {};
  const modelKey = identity.modelKey
    || identity.model?.canonical
    || identity.model?.raw
    || null;
  if (!modelKey) return false;

  const commercial = draft.commercialScenario || {};
  const paymentType = String(commercial.paymentType || commercial.type || 'leasing')
    .toLowerCase()
    .trim();
  if (paymentType && paymentType !== 'leasing' && paymentType !== 'financing') {
    return false;
  }
  if (commercial.termMonths == null && commercial.durationMonths == null) return false;
  const km = commercial.annualMileage ?? commercial.mileagePerYear;
  if (km == null) return false;
  if (commercial.downPayment == null) return false;

  const rate = asPositiveRate(draft.rate ?? draft.monthlyRate);
  if (rate == null) return false;
  if (!isAuthoritativeDraftRate(draft)) return false;
  if (draft.invalidateVehicleRate === true) return false;
  return true;
}

export function findVehicleOfferBySourceOfferDraftId(lead = {}, offerDraftId = null) {
  if (!offerDraftId) return null;
  return (listStoredVehicleOffers(lead) || []).find((o) => (
    resolveSourceOfferDraftId(o) === offerDraftId
  )) || null;
}

/**
 * Concept-Drafts ohne materialisiertes VehicleOffer (Multi-Offer Restarbeit).
 */
export function listOfferDraftsMissingVehicleOffer(lead = {}) {
  const state = getCleverWorkingState(lead);
  const draftIds = Object.keys(state.offerDrafts || {});
  return draftIds
    .map((id) => getOfferDraftById(lead, id))
    .filter((d) => {
      if (!d?.offerDraftId) return false;
      const identity = d.vehicleIdentityDraft || {};
      const modelKey = identity.modelKey || identity.model?.canonical || identity.model?.raw;
      if (!modelKey) return false;
      return !findVehicleOfferBySourceOfferDraftId(lead, d.offerDraftId);
    });
}

function stableCardIdForDraft(draft, existingOffer = null) {
  if (existingOffer?.vehicleCardId) return existingOffer.vehicleCardId;
  // Bestehende Track-Config aktualisieren (kein zweites vc-ofd_* neben vc-track-*)
  if (draft.vehicleTrackId) return draft.vehicleTrackId;
  if (existingOffer?.id && String(existingOffer.id).startsWith('vo-')) {
    const stripped = String(existingOffer.id).replace(/^vo-/, '').replace(/-v\d+$/, '');
    if (stripped) return stripped;
  }
  return `vc-${draft.offerDraftId}`;
}

function dedupeVehicleConfigurationsById(configs = []) {
  const map = new Map();
  for (const config of configs) {
    if (!config?.id) continue;
    map.set(config.id, config);
  }
  return [...map.values()];
}

function dedupeReservedByConfigurationId(reserved = []) {
  const map = new Map();
  for (const item of reserved) {
    const key = item?.configurationId || item?.id;
    if (!key) continue;
    map.set(key, item);
  }
  return [...map.values()];
}

function pickContactName(...candidates) {
  for (const c of candidates) {
    const t = String(c || '').trim();
    if (t) return t;
  }
  return null;
}

/**
 * Materialisiert / aktualisiert genau EIN VehicleOffer für offerDraftId.
 *
 * @returns {{ ok: boolean, lead, offer?: object, created?: boolean, reason?: string }}
 */
export function materializeVehicleOfferFromOfferDraft(lead, offerDraftId, extras = {}) {
  if (!lead || !offerDraftId) {
    return { ok: false, lead, reason: 'missing_args' };
  }
  const draft = getOfferDraftById(lead, offerDraftId);
  if (!draft) {
    return { ok: false, lead, reason: 'offer_draft_not_found' };
  }
  if (!isOfferDraftReadyForVehicleOffer(draft)) {
    return { ok: false, lead, reason: 'draft_not_ready' };
  }

  const rate = asPositiveRate(draft.rate ?? draft.monthlyRate);
  const existing = findVehicleOfferBySourceOfferDraftId(lead, offerDraftId);
  const cardId = stableCardIdForDraft(draft, existing);

  const handoff = buildHandoffFromOfferDraftId(lead, offerDraftId, {
    sellerInput: extras.sellerInput || draft.sellerInput || '',
  });
  if (!handoff.ok) {
    return { ok: false, lead, reason: handoff.error || 'handoff_failed' };
  }

  const patch = magicPreparationToConfigurePatch(handoff.magic);
  if (!patch?.modelKey && !patch?.model) {
    return { ok: false, lead, reason: 'configure_patch_incomplete' };
  }

  const commercial = draft.commercialScenario || {};
  const paymentType = String(
    commercial.paymentType || commercial.type || patch.paymentType || 'leasing',
  ).toLowerCase();

  const configureDraft = {
    ...buildConfigureDraft({ fields: {} }, {}),
    ...patch,
    modelKey: patch.modelKey || draft.vehicleIdentityDraft?.modelKey || null,
    model: patch.model
      || draft.vehicleIdentityDraft?.model?.canonical
      || String(patch.modelKey || '').toUpperCase(),
    brand: patch.brand || 'Kia',
    trimLabel: patch.trimLabel
      || draft.vehicleIdentityDraft?.trim?.canonical
      || draft.vehicleIdentityDraft?.trim?.raw
      || null,
    colorLabel: patch.colorLabel
      || draft.vehicleIdentityDraft?.color?.canonical
      || draft.vehicleIdentityDraft?.color?.raw
      || null,
    packageLabels: patch.packageLabels
      || (draft.vehicleIdentityDraft?.packages || [])
        .map((p) => p.canonical || p.raw)
        .filter(Boolean),
    paymentType,
    termMonths: commercial.termMonths ?? commercial.durationMonths ?? patch.termMonths ?? null,
    mileagePerYear: commercial.annualMileage
      ?? commercial.mileagePerYear
      ?? patch.mileagePerYear
      ?? null,
    downPayment: commercial.downPayment ?? patch.downPayment ?? 0,
    desiredRate: null,
    offerDraftId,
    vehicleIdentityDraftId: draft.vehicleIdentityDraftId
      || draft.vehicleIdentityDraft?.id
      || null,
    vehicleIdentityDraft: draft.vehicleIdentityDraft || null,
  };

  let calcOfferDraft = buildOfferDraft({
    configureDraft,
    parsed: { fields: {}, rawInput: extras.sellerInput || draft.sellerInput || '' },
    conditions: {},
    lead,
  });
  if (!calcOfferDraft) {
    return { ok: false, lead, reason: 'build_offer_draft_failed' };
  }

  calcOfferDraft = attachSourceOfferDraftId({
    ...calcOfferDraft,
    payment: {
      ...calcOfferDraft.payment,
      calculatedRate: rate,
      budget: rate,
      type: paymentType,
      termMonths: configureDraft.termMonths,
      mileagePerYear: configureDraft.mileagePerYear,
      downPayment: configureDraft.downPayment,
    },
    offerPreview: {
      ...calcOfferDraft.offerPreview,
      monthlyRate: rate,
      paymentType,
    },
    offerDraftId,
    source: {
      ...calcOfferDraft.source,
      offerDraftId,
      createdFrom: draft.pdfSource ? 'offer_pdf_merge' : 'dealer_ai_calculator',
      originalPdf: draft.pdfSource?.originalPdf || calcOfferDraft.source?.originalPdf || null,
    },
    meta: {
      ...(calcOfferDraft.meta || {}),
      offerDraftId,
    },
  }, offerDraftId);

  const config = offerDraftToVehicleConfiguration(calcOfferDraft, cardId);
  const card = offerDraftToVehicleCard(calcOfferDraft, { configId: cardId, cardId });
  const configWithBridge = {
    ...config,
    offerDraftId,
    vehicleTrackId: draft.vehicleTrackId || config.vehicleTrackId || cardId,
    boardOffer: {
      ...(config.boardOffer || {}),
      rateAuthority: RATE_AUTHORITY.AUTHORITATIVE,
      payment: {
        ...(config.boardOffer?.payment || {}),
        monthlyRate: rate,
        type: paymentType,
        termMonths: configureDraft.termMonths,
        mileagePerYear: configureDraft.mileagePerYear,
        downPayment: configureDraft.downPayment,
      },
    },
  };

  const finalized = finalizeLeadWithOfferDraft(lead, calcOfferDraft, {
    config: configWithBridge,
    card,
    enrichedParsed: { fields: {} },
    selectedModelIds: [],
  });

  // Authority + Track/Scenario-Bridge am gespeicherten VehicleOffer
  const voKey = cardId;
  const prevVo = finalized.crm?.vehicleOffers?.[voKey]
    || findVehicleOfferBySourceOfferDraftId(finalized, offerDraftId)
    || null;
  const scenarios = listCommercialScenarios(lead);
  const trackScenarios = draft.vehicleTrackId
    ? scenarios.filter((s) => !s.vehicleTrackId || s.vehicleTrackId === draft.vehicleTrackId)
    : scenarios;

  const nextVo = attachSourceOfferDraftId({
    ...(prevVo || {}),
    id: prevVo?.id || `vo-${cardId}`,
    vehicleCardId: cardId,
    vehicleTrackId: draft.vehicleTrackId || prevVo?.vehicleTrackId || cardId,
    commercialScenarioId: draft.commercialScenarioId
      || draft.commercialScenario?.id
      || prevVo?.commercialScenarioId
      || null,
    commercialScenarioIds: trackScenarios.map((s) => s.id).filter(Boolean),
    commercialScenarios: trackScenarios.length ? trackScenarios : (prevVo?.commercialScenarios || undefined),
    monthlyRate: rate,
    rateAuthority: RATE_AUTHORITY.AUTHORITATIVE,
    invalidateVehicleRate: false,
    rateNeedsReview: false,
    paymentType,
    status: prevVo?.status && prevVo.status !== VEHICLE_OFFER_STATUS.DRAFT
      ? prevVo.status
      : VEHICLE_OFFER_STATUS.PREPARED,
    boardOffer: {
      ...(prevVo?.boardOffer || configWithBridge.boardOffer || {}),
      payment: {
        ...(prevVo?.boardOffer?.payment || configWithBridge.boardOffer?.payment || {}),
        type: paymentType,
        monthlyRate: rate,
        termMonths: configureDraft.termMonths,
        mileagePerYear: configureDraft.mileagePerYear,
        downPayment: configureDraft.downPayment,
      },
      rateAuthority: RATE_AUTHORITY.AUTHORITATIVE,
      status: 'offer_created',
    },
    offerDraftId,
    source: {
      ...(prevVo?.source || {}),
      offerDraftId,
      createdFrom: draft.pdfSource ? 'offer_pdf_merge' : 'dealer_ai_calculator',
    },
    updatedAt: new Date().toISOString(),
  }, offerDraftId);

  const nextConfigs = dedupeVehicleConfigurationsById([
    ...(finalized.crm?.vehicleConfigurations || []),
    configWithBridge,
  ]);
  const nextReserved = dedupeReservedByConfigurationId(
    finalized.crm?.reservedModels || lead.crm?.reservedModels || [],
  );

  const nextLead = {
    ...lead,
    ...finalized,
    id: lead.id || finalized.id,
    name: pickContactName(
      finalized.name,
      lead.name,
      lead.contact?.name,
      finalized.contact?.name,
    ),
    contact: {
      ...(lead.contact || {}),
      ...(finalized.contact || {}),
      name: pickContactName(
        finalized.contact?.name,
        lead.contact?.name,
        lead.name,
        finalized.name,
      ),
      email: pickContactName(finalized.contact?.email, lead.contact?.email),
      phone: pickContactName(finalized.contact?.phone, lead.contact?.phone),
    },
    crm: {
      ...(lead.crm || {}),
      ...(finalized.crm || {}),
      cleverWorkingState: lead.crm?.cleverWorkingState || finalized.crm?.cleverWorkingState,
      commercialScenarios: lead.crm?.commercialScenarios ?? finalized.crm?.commercialScenarios,
      customerOfferPortfolio: lead.crm?.customerOfferPortfolio
        ?? finalized.crm?.customerOfferPortfolio,
      vehicleConfigurations: nextConfigs,
      reservedModels: nextReserved,
      vehicleOffers: {
        ...(finalized.crm?.vehicleOffers || {}),
        [voKey]: nextVo,
      },
    },
  };

  // Autoritative Neu-Materialisierung schließt offenen Portal-Change Request am Draft
  const clearedLead = resolvePortfolioChangeRequestForOfferDraft(nextLead, offerDraftId, {
    reason: draft.pdfSource ? 're_pdf_authoritative' : 'calculator_authoritative',
  });

  return {
    ok: true,
    lead: clearedLead,
    offer: nextVo,
    created: !existing,
    offerDraftId,
  };
}

/**
 * Nach Draft-Upsert: wenn bereit, VehicleOffer materialisieren.
 */
export function maybeMaterializeVehicleOfferAfterDraftUpsert(lead, offerDraftId, extras = {}) {
  if (!offerDraftId) return { ok: false, lead, reason: 'no_draft_id' };
  const draft = getOfferDraftById(lead, offerDraftId);
  if (!isOfferDraftReadyForVehicleOffer(draft)) {
    return { ok: false, lead, reason: 'draft_not_ready' };
  }
  return materializeVehicleOfferFromOfferDraft(lead, offerDraftId, extras);
}
