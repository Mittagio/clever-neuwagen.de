/**
 * Zentrale Next-Best-Action für den Verkäufer.
 * Deterministisch aus Lead / Briefing / Working / Portal – kein LLM-Action-System.
 *
 * Mappt auf bestehende Tools/Handoffs (prepare_offer, modify_offer, intend_send, …).
 */

import {
  PORTFOLIO_REACTION_STATUS,
} from '../crm/customerOfferPortfolioService.js';
import {
  listCustomerVehicleTracks,
  VEHICLE_TRACK_STATUS,
} from '../crm/vehicleTrack.js';
import { isBoardOfferSendable } from '../dealer/boardOfferModel.js';
import {
  listStoredVehicleOffers,
  resolveSourceOfferDraftId,
} from '../vehicleOffer.js';
import { RATE_AUTHORITY } from './captureThenOffer.js';
import { resolveActiveOfferDraft } from './cleverWorkingDraft.js';

export const NEXT_BEST_ACTION_ID = Object.freeze({
  MODIFY_OFFER: 'modify_offer',
  INTEND_SEND: 'intend_send',
  PREPARE_OFFER: 'prepare_offer',
  CONSULTATION: 'capture_then_consult',
  PROPOSE_APPOINTMENT: 'propose_appointment',
  REQUEST_DOCUMENTS: 'request_documents',
  CREATE_FOLLOW_UP: 'create_follow_up',
});

/**
 * @param {object} lead
 * @returns {{
 *   item: object,
 *   offerDraftId: string|null,
 *   questionText: string,
 *   changeDimension: string|null,
 *   cardId: string|null,
 * }|null}
 */
export function findPortalChangeRequest(lead = {}) {
  const items = lead?.crm?.customerOfferPortfolio?.items;
  if (!Array.isArray(items)) return null;
  for (const item of items) {
    const reaction = item?.customerReaction;
    if (reaction?.status !== PORTFOLIO_REACTION_STATUS.CHANGE_REQUESTED) continue;
    return {
      item,
      offerDraftId: resolveSourceOfferDraftId(item) || item.offerDraftId || null,
      questionText: String(reaction.questionText || '').trim(),
      changeDimension: reaction.changeDimension || null,
      cardId: item.vehicleCardId || item.id || null,
    };
  }
  return null;
}

/**
 * Sendbares Angebot: echte Rate, nicht stale / nicht Draft-only.
 * @param {object} lead
 */
export function findSendableVehicleOffer(lead = {}) {
  const offers = listStoredVehicleOffers(lead) || [];
  const configs = lead?.crm?.vehicleConfigurations || [];

  for (const offer of offers) {
    const rate = Number(
      offer.monthlyRate
      ?? offer.boardOffer?.payment?.monthlyRate
      ?? offer.offerPreview?.monthlyRate,
    );
    const cash = Number(offer.boardOffer?.payment?.cashPrice ?? offer.cashPrice);
    const hasRate = Number.isFinite(rate) && rate > 0;
    const hasCash = Number.isFinite(cash) && cash > 0;
    if (!hasRate && !hasCash) continue;

    const authority = offer.rateAuthority
      || offer.boardOffer?.rateAuthority
      || null;
    if (authority === RATE_AUTHORITY.STALE || authority === RATE_AUTHORITY.NON_AUTHORITATIVE) {
      continue;
    }
    if (offer.invalidateVehicleRate || offer.rateNeedsReview) continue;

    const card = {
      id: offer.id || offer.vehicleCardId,
      configurationId: offer.configurationId || offer.id,
      paymentType: offer.paymentType || offer.boardOffer?.payment?.type,
      monthlyRate: hasRate ? rate : null,
      boardOffer: offer.boardOffer,
    };
    const config = configs.find((c) => (
      c.id === card.id || c.id === card.configurationId
    ));
    // Board-Model: wenn Config/Card sendable – ok; sonst Rate-Check reicht
    const boardOk = config
      ? isBoardOfferSendable({
        ...card,
        desiredRate: rate,
        calculatedRate: rate,
      }, lead)
      : hasRate || hasCash;

    if (!boardOk && !hasRate && !hasCash) continue;

    return {
      offer,
      cardId: card.id,
      offerDraftId: resolveSourceOfferDraftId(offer) || null,
      monthlyRate: hasRate ? rate : null,
      cashPrice: hasCash ? cash : null,
    };
  }

  // Fallback: Configs mit kalkulierter Rate (Board)
  for (const config of configs) {
    const payment = config.boardOffer?.payment
      || config.leasingData
      || config.financingData
      || null;
    const rate = Number(
      payment?.monthlyRate
      ?? payment?.calculatedRate
      ?? config.leasingData?.calculatedRate
      ?? config.financingData?.calculatedRate,
    );
    if (!(Number.isFinite(rate) && rate > 0)) continue;
    if (config.boardOffer?.rateAuthority === RATE_AUTHORITY.STALE) continue;
    if (config.invalidateVehicleRate || config.rateNeedsReview) continue;
    if (!isBoardOfferSendable({
      id: config.id,
      configurationId: config.id,
      paymentType: config.paymentType || 'leasing',
      desiredRate: rate,
      calculatedRate: rate,
      boardOffer: config.boardOffer,
    }, lead)) {
      continue;
    }
    return {
      offer: config.boardOffer || config,
      cardId: config.id,
      offerDraftId: resolveSourceOfferDraftId(config) || config.offerDraftId || null,
      monthlyRate: rate,
      cashPrice: null,
    };
  }

  return null;
}

/**
 * Konkretes Modell aus Tracks / NeedProfile / Working Draft / Turn-Facts.
 * @param {object} lead
 * @param {object|null} workingState
 * @param {{ draft?: object|null, facts?: object[] }} [opts]
 */
export function resolveConcreteVehicleModel(lead = {}, workingState = null, opts = {}) {
  const draftOpt = opts.draft || null;
  const facts = Array.isArray(opts.facts) ? opts.facts : [];
  const interest = facts.find((f) => (
    f?.field === 'vehicleInterest' && f?.value?.modelKey && !f?.value?.remove
  ));
  if (interest?.value?.modelKey) {
    return {
      modelKey: String(interest.value.modelKey).toLowerCase(),
      trim: interest.value.trim || null,
      offerDraftId: draftOpt?.offerDraftId || null,
      vehicleTrackId: null,
      source: 'turn_facts',
    };
  }
  if (draftOpt?.vehicleIdentityDraft?.modelKey || draftOpt?.modelKey) {
    return {
      modelKey: String(draftOpt.vehicleIdentityDraft?.modelKey || draftOpt.modelKey).toLowerCase(),
      trim: draftOpt.vehicleIdentityDraft?.trim?.canonical
        || draftOpt.vehicleIdentityDraft?.trim?.raw
        || null,
      offerDraftId: draftOpt.offerDraftId || null,
      vehicleTrackId: draftOpt.vehicleTrackId || null,
      source: 'turn_draft',
    };
  }

  const draft = resolveActiveOfferDraft({ lead, workingMemory: workingState })
    || workingState?.currentOfferDraft
    || lead?.crm?.cleverWorkingState?.currentOfferDraft
    || null;
  const draftKey = draft?.vehicleIdentityDraft?.modelKey
    || draft?.focusModelKey
    || draft?.modelKey
    || null;
  if (draftKey) {
    return {
      modelKey: String(draftKey).toLowerCase(),
      trim: draft?.vehicleIdentityDraft?.trim?.canonical
        || draft?.vehicleIdentityDraft?.trim?.raw
        || null,
      offerDraftId: draft.offerDraftId || null,
      vehicleTrackId: draft.vehicleTrackId || null,
      source: 'working_draft',
    };
  }

  const tracks = listCustomerVehicleTracks(lead) || [];
  const preferred = tracks.find((t) => (
    t.status === VEHICLE_TRACK_STATUS.FAVORITE
    || t.status === VEHICLE_TRACK_STATUS.ACTIVE
  )) || tracks[0] || null;
  if (preferred?.modelKey) {
    return {
      modelKey: String(preferred.modelKey).toLowerCase(),
      trim: preferred.trim || preferred.trimLabel || null,
      offerDraftId: preferred.offerDraftId || null,
      vehicleTrackId: preferred.id || null,
      source: 'vehicle_track',
    };
  }

  const profile = lead?.crm?.needProfile || {};
  const selected = profile.selectedModelKey || profile.modelHint || null;
  if (selected && !/^(elektro|electric|auto|fahrzeug)$/i.test(String(selected))) {
    // modelHint „sportage“ / selectedModelKey „ev3“ zählen; reines fuel nicht
    if (profile.selectedModelKey || /^ev\d|^[a-z]+\d/i.test(String(selected))) {
      return {
        modelKey: String(profile.selectedModelKey || selected).toLowerCase(),
        trim: null,
        offerDraftId: null,
        vehicleTrackId: null,
        source: 'need_profile',
      };
    }
  }

  const wishModel = lead?.wish?.modelKey || lead?.vehicle?.modelKey || null;
  if (wishModel) {
    return {
      modelKey: String(wishModel).toLowerCase(),
      trim: lead?.wish?.trim || null,
      offerDraftId: null,
      vehicleTrackId: null,
      source: 'wish',
    };
  }

  return null;
}

function hasMeaningfulNeed(lead = {}, workBriefing = null) {
  const profile = lead?.crm?.needProfile || {};
  const wish = lead?.wish || {};
  if (profile.fuel || wish.paymentType || wish.termMonths || wish.mileagePerYear != null) {
    return true;
  }
  if (profile.household?.childrenCount != null || profile.dog || profile.children != null) {
    return true;
  }
  if ((profile.equipmentWishes || []).length || profile.towbar) return true;
  const s = workBriefing?.sections || {};
  return Boolean(
    s.customerPicture || s.sought || s.leasingWish || s.important || s.currentVehicle || s.planned,
  );
}

function wantsTestDrive(lead = {}) {
  const labels = [
    ...(lead?.crm?.needProfile?.understoodLabels || []),
    ...(lead?.crm?.sellerInsights || []).flatMap((i) => i.labels || i.understoodLabels || []),
  ].map((l) => String(l).toLowerCase());
  if (labels.some((l) => /probefahrt|test\s*fahrt|vorführ/i.test(l))) return true;
  const openAppt = (lead?.crm?.appointments || lead?.appointments || [])
    .some((a) => /probe|test/i.test(String(a?.type || a?.title || a?.label || '')));
  return openAppt ? false : labels.some((l) => /probefahrt/i.test(l));
}

function hasOpenTestDriveAppointment(lead = {}) {
  const list = lead?.crm?.appointments || lead?.appointments || [];
  return list.some((a) => {
    const status = String(a?.status || '').toLowerCase();
    if (status === 'cancelled' || status === 'done' || status === 'completed') return false;
    return /probe|test\s*fahrt|vorführ/i.test(String(a?.type || a?.title || a?.label || a?.purpose || ''));
  });
}

function needsDocuments(lead = {}) {
  const summary = lead?.crm?.unterlagenSummary || lead?.crm?.documentsSummary || null;
  if (summary?.openCount > 0 || summary?.missingCount > 0) return true;
  const docs = lead?.crm?.requestedDocuments || lead?.crm?.documentRequests || [];
  if (Array.isArray(docs) && docs.some((d) => d.status === 'missing' || d.status === 'open')) {
    return true;
  }
  // Explizite Zusage-Signale
  const reaction = (lead?.crm?.customerOfferPortfolio?.items || [])
    .some((i) => i?.customerReaction?.status === PORTFOLIO_REACTION_STATUS.INTERESTED);
  const commitment = /zusage|angenommen|genommen|kaufzusage/i.test(
    String(lead?.crm?.pipelineStatusId || lead?.status || ''),
  );
  return Boolean(reaction && commitment && (summary?.openCount == null || summary.openCount > 0));
}

function followUpDue(lead = {}, portalState = null) {
  const followUpAt = lead?.crm?.followUpAt || lead?.followUpAt || null;
  if (followUpAt) {
    const due = new Date(followUpAt).getTime();
    if (Number.isFinite(due) && due <= Date.now() + 12 * 60 * 60 * 1000) return true;
  }
  const portal = portalState || lead?.crm?.customerPortalAccess || null;
  if (portal?.status === 'viewed' || portal?.viewedAt) {
    const viewed = portal.viewedAt ? new Date(portal.viewedAt).getTime() : null;
    if (viewed && Date.now() - viewed > 24 * 60 * 60 * 1000) return true;
  }
  return false;
}

/**
 * @param {{
 *   lead?: object,
 *   workBriefing?: object|null,
 *   workingState?: object|null,
 *   portalState?: object|null,
 *   draft?: object|null,
 *   facts?: object[],
 * }} params
 * @returns {{
 *   id: string,
 *   label: string,
 *   toolId: string,
 *   handler: string,
 *   contextPayload: object,
 *   reason: string,
 * }|null}
 */
export function determineNextBestSellerAction({
  lead = null,
  workBriefing = null,
  workingState = null,
  portalState = null,
  draft = null,
  facts = null,
} = {}) {
  if (!lead || typeof lead !== 'object') return null;

  const ws = workingState
    || lead.crm?.cleverWorkingState
    || null;
  const turnOpts = { draft, facts: Array.isArray(facts) ? facts : [] };

  // 1) Portal Change Request → modify_offer
  const change = findPortalChangeRequest(lead);
  if (change) {
    return {
      id: NEXT_BEST_ACTION_ID.MODIFY_OFFER,
      label: 'Angebot anpassen',
      toolId: 'modify_offer',
      handler: 'modify_offer',
      contextPayload: {
        offerDraftId: change.offerDraftId,
        cardId: change.cardId,
        questionText: change.questionText,
        changeDimension: change.changeDimension,
        baseOnCurrentOffer: true,
        seedDraft: change.questionText
          ? `Passe Angebot an: ${change.questionText}`
          : 'Passe das Angebot an die Kundenänderung an.',
      },
      reason: 'portal_change_request',
    };
  }

  // 2) Sendbares VehicleOffer → intend_send
  const sendable = findSendableVehicleOffer(lead);
  if (sendable) {
    return {
      id: NEXT_BEST_ACTION_ID.INTEND_SEND,
      label: 'An Kunden senden',
      toolId: 'intend_send',
      handler: 'intend_send',
      contextPayload: {
        cardId: sendable.cardId,
        offerDraftId: sendable.offerDraftId,
        monthlyRate: sendable.monthlyRate,
        cashPrice: sendable.cashPrice,
      },
      reason: 'sendable_vehicle_offer',
    };
  }

  // 3) Konkretes Modell → prepare_offer
  const model = resolveConcreteVehicleModel(lead, ws, turnOpts);
  if (model?.modelKey) {
    const wish = lead.wish || {};
    const profile = lead.crm?.needProfile || {};
    const termFact = turnOpts.facts.find((f) => f?.field === 'termMonths' || f?.field === 'durationMonths');
    const kmFact = turnOpts.facts.find((f) => f?.field === 'annualMileage' || f?.field === 'mileagePerYear');
    const downFact = turnOpts.facts.find((f) => f?.field === 'downPayment');
    const payFact = turnOpts.facts.find((f) => f?.field === 'paymentType');
    return {
      id: NEXT_BEST_ACTION_ID.PREPARE_OFFER,
      label: 'Angebot vorbereiten',
      toolId: 'prepare_offer',
      handler: 'prepare_offer',
      contextPayload: {
        modelKey: model.modelKey,
        trim: model.trim,
        offerDraftId: model.offerDraftId || draft?.offerDraftId || null,
        vehicleTrackId: model.vehicleTrackId,
        paymentType: payFact?.value || wish.paymentType || null,
        termMonths: termFact?.value ?? wish.termMonths ?? null,
        annualMileage: kmFact?.value ?? wish.mileagePerYear ?? wish.annualMileage ?? null,
        downPayment: downFact?.value ?? wish.downPayment ?? null,
        equipmentWishes: profile.equipmentWishes || [],
        fuelPreference: profile.fuel || null,
      },
      reason: 'vehicle_model_ready',
    };
  }

  // 4) Need ohne Modell → Consultation-Handoff
  if (hasMeaningfulNeed(lead, workBriefing) || turnOpts.facts.length > 0) {
    const profile = lead.crm?.needProfile || {};
    const wish = lead.wish || {};
    const hasNeedSignal = hasMeaningfulNeed(lead, workBriefing)
      || turnOpts.facts.some((f) => (
        f?.field === 'fuelPreference'
        || f?.field === 'childrenCount'
        || f?.field === 'existingVehicle'
        || f?.field === 'equipmentWish'
        || f?.field === 'paymentType'
        || f?.field === 'termMonths'
      ));
    if (hasNeedSignal) {
      return {
        id: NEXT_BEST_ACTION_ID.CONSULTATION,
        label: 'Passende Fahrzeuge finden',
        toolId: 'capture_then_consult',
        handler: 'consultation',
        contextPayload: {
          fuelPreference: profile.fuel
            || turnOpts.facts.find((f) => f?.field === 'fuelPreference')?.value
            || null,
          household: profile.household || null,
          dog: profile.dog === true,
          childrenCount: profile.household?.childrenCount
            ?? profile.children
            ?? turnOpts.facts.find((f) => f?.field === 'childrenCount')?.value
            ?? null,
          equipmentWishes: profile.equipmentWishes || [],
          towbar: profile.towbar === true,
          paymentType: wish.paymentType
            || turnOpts.facts.find((f) => f?.field === 'paymentType')?.value
            || null,
          termMonths: wish.termMonths
            ?? turnOpts.facts.find((f) => f?.field === 'termMonths')?.value
            ?? null,
          annualMileage: wish.mileagePerYear
            ?? turnOpts.facts.find((f) => f?.field === 'annualMileage')?.value
            ?? null,
          downPayment: wish.downPayment
            ?? turnOpts.facts.find((f) => f?.field === 'downPayment')?.value
            ?? null,
          desiredDeliveryDate: wish.desiredDeliveryDate || null,
        },
        reason: 'need_consultation',
      };
    }
  }

  // 5) Probefahrt ohne Termin
  if (wantsTestDrive(lead) && !hasOpenTestDriveAppointment(lead)) {
    return {
      id: NEXT_BEST_ACTION_ID.PROPOSE_APPOINTMENT,
      label: 'Probefahrt planen',
      toolId: 'propose_appointment',
      handler: 'propose_appointment',
      contextPayload: {
        purpose: 'test_drive',
        modelKey: model?.modelKey || null,
      },
      reason: 'test_drive_requested',
    };
  }

  // 6) Unterlagen
  if (needsDocuments(lead)) {
    return {
      id: NEXT_BEST_ACTION_ID.REQUEST_DOCUMENTS,
      label: 'Unterlagen anfordern',
      toolId: 'request_documents',
      handler: 'request_documents',
      contextPayload: {},
      reason: 'documents_missing',
    };
  }

  // 7) Follow-up fällig
  if (followUpDue(lead, portalState)) {
    return {
      id: NEXT_BEST_ACTION_ID.CREATE_FOLLOW_UP,
      label: 'Kunden kontaktieren',
      toolId: 'create_follow_up',
      handler: 'create_follow_up',
      contextPayload: {
        followUpAt: lead.crm?.followUpAt || null,
      },
      reason: 'follow_up_due',
    };
  }

  return null;
}

/**
 * Baut Akte-nextStep.primary aus NBA (eine dominante CTA).
 * Secondary „Senden“ nur bei echt sendbarem Angebot.
 * @param {object|null} nba
 * @param {object|null} [existingNextStep]
 * @param {{ offerSendable?: boolean }} [options]
 */
export function overlayNextStepWithNba(nba, existingNextStep = null, options = {}) {
  if (!nba?.label) return existingNextStep;
  const primary = {
    id: nba.id,
    label: nba.label,
    type: nba.handler === 'intend_send' ? 'send' : 'action',
    handlerType: nba.handler,
    toolId: nba.toolId,
    contextPayload: nba.contextPayload || {},
    reason: nba.reason || null,
  };
  let secondary = existingNextStep?.secondary
    && existingNextStep.secondary.label !== primary.label
    ? existingNextStep.secondary
    : null;
  const secondaryIsSend = Boolean(
    secondary
    && (
      secondary.type === 'send'
      || secondary.handlerType === 'intend_send'
      || /an kunden senden/i.test(String(secondary.label || ''))
    ),
  );
  // Concept-Draft / keine echte Rate → kein Fake-Send
  if (secondaryIsSend && !options.offerSendable) {
    secondary = null;
  }
  if (nba.handler === 'intend_send') {
    // Primary ist bereits Senden – kein zweites Send
    secondary = secondaryIsSend ? null : secondary;
  }
  return {
    ...(existingNextStep || {}),
    recommendLabel: existingNextStep?.recommendLabel || 'Clever empfiehlt',
    primary,
    secondary,
    reasonSource: {
      kind: nba.reason || 'open_task',
      detail: nba.label,
      actionId: nba.id,
    },
    showExplanation: false,
  };
}
