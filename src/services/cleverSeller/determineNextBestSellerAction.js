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
  VEHICLE_OFFER_STATUS,
} from '../vehicleOffer.js';
import {
  countUnterlagenOpenTasks,
} from '../cleverUnterlagen.js';
import { RATE_AUTHORITY } from './captureThenOffer.js';
import { resolveActiveOfferDraft } from './cleverWorkingDraft.js';
import { hasPreparedOutboundOfferCue } from './commercialOfferNl.js';

export const NEXT_BEST_ACTION_ID = Object.freeze({
  MODIFY_OFFER: 'modify_offer',
  INTEND_SEND: 'intend_send',
  PREPARE_OFFER: 'prepare_offer',
  DRAFT_MESSAGE: 'draft_message',
  CONSULTATION: 'capture_then_consult',
  PROPOSE_APPOINTMENT: 'propose_appointment',
  REQUEST_DOCUMENTS: 'request_documents',
  /** Bestehender Clever-Action-Handoff (Unterlagen/SA), kein neuer Status */
  REQUEST_SELF_DISCLOSURE: 'self_disclosure_request',
  /** Bestehender Clever-Action-Handoff nach Docs+SA */
  APPLICATION_PREPARE: 'application_prepare',
  CREATE_FOLLOW_UP: 'create_follow_up',
});

const UNTERLAGEN_DONE = new Set(['uploaded', 'checked', 'replaced', 'not_needed', 'received']);
const OFFER_ALREADY_WITH_CUSTOMER = new Set([
  VEHICLE_OFFER_STATUS.SENT,
  VEHICLE_OFFER_STATUS.OPENED,
  VEHICLE_OFFER_STATUS.ACCEPTED,
  VEHICLE_OFFER_STATUS.REJECTED,
]);

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

/**
 * Kundenzusage / Commit-Signal (bestehende Werte – kein neues Enum).
 * Portfolio: interested · VehicleOffer: accepted
 */
export function hasCustomerOfferCommitment(lead = {}) {
  const items = lead?.crm?.customerOfferPortfolio?.items;
  if (Array.isArray(items)
    && items.some((i) => i?.customerReaction?.status === PORTFOLIO_REACTION_STATUS.INTERESTED)) {
    return true;
  }
  const offers = listStoredVehicleOffers(lead) || [];
  return offers.some((o) => String(o?.status || '').toLowerCase() === VEHICLE_OFFER_STATUS.ACCEPTED);
}

/**
 * Angebot muss dem Kunden noch zugestellt werden (neue Version / nie gesendet).
 * Bereits sent/opened/accepted zählen nicht als Send-Primary nach Commit.
 */
export function offerNeedsCustomerDelivery(offer = null, { committed = false } = {}) {
  if (!offer || typeof offer !== 'object') return false;
  const status = String(offer.status || '').toLowerCase();
  if (OFFER_ALREADY_WITH_CUSTOMER.has(status)) return false;
  if (!status) {
    // Ohne Status: vor Commit senden ok; nach Commit kein Fake-Resend
    return !committed;
  }
  return true;
}

/**
 * Sendbares Offer, das der Kunde noch nicht hat (Resend nach Anpassung).
 */
export function findUnsentSendableVehicleOffer(lead = {}, { committed = false } = {}) {
  const offers = listStoredVehicleOffers(lead) || [];
  for (const offer of offers) {
    if (!offerNeedsCustomerDelivery(offer, { committed })) continue;
    const rate = Number(
      offer.monthlyRate
      ?? offer.boardOffer?.payment?.monthlyRate
      ?? offer.offerPreview?.monthlyRate,
    );
    const cash = Number(offer.boardOffer?.payment?.cashPrice ?? offer.cashPrice);
    const hasRate = Number.isFinite(rate) && rate > 0;
    const hasCash = Number.isFinite(cash) && cash > 0;
    if (!hasRate && !hasCash) continue;
    const authority = offer.rateAuthority || offer.boardOffer?.rateAuthority || null;
    if (authority === RATE_AUTHORITY.STALE || authority === RATE_AUTHORITY.NON_AUTHORITATIVE) {
      continue;
    }
    if (offer.invalidateVehicleRate || offer.rateNeedsReview) continue;
    return {
      offer,
      cardId: offer.id || offer.vehicleCardId,
      offerDraftId: resolveSourceOfferDraftId(offer) || null,
      monthlyRate: hasRate ? rate : null,
      cashPrice: hasCash ? cash : null,
    };
  }
  if (!committed) {
    const sendable = findSendableVehicleOffer(lead);
    if (sendable && offerNeedsCustomerDelivery(sendable.offer, { committed })) {
      return sendable;
    }
  }
  return null;
}

/**
 * Aktive Portfolio-Zusage (interested) – blockiert Send, bis Change/Resend-Pfad greift.
 */
export function hasActivePortfolioInterest(lead = {}) {
  const items = lead?.crm?.customerOfferPortfolio?.items;
  if (!Array.isArray(items)) return false;
  return items.some((i) => i?.customerReaction?.status === PORTFOLIO_REACTION_STATUS.INTERESTED);
}

/**
 * Post-Commit: Unterlagen vs. Selbstauskunft getrennt (bestehende Unterlagen-Slots).
 */
export function resolvePostCommitOpenWork(lead = {}) {
  const summary = lead?.crm?.unterlagenSummary || lead?.crm?.documentsSummary || null;
  const requested = lead?.crm?.requestedDocuments || lead?.crm?.documentRequests || [];
  const requestedOpen = Array.isArray(requested)
    && requested.some((d) => {
      const st = String(d?.status || '').toLowerCase();
      return st === 'missing' || st === 'open' || st === 'requested';
    });
  const tasks = countUnterlagenOpenTasks(lead);
  const docSlotsOpen = (tasks.summary?.slots || []).filter((slot) => {
    if (slot.id === 'selbstauskunft') return false;
    const st = String(tasks.summary?.items?.[slot.id]?.status || 'open').toLowerCase();
    return !UNTERLAGEN_DONE.has(st);
  }).length;

  let documentsIncomplete;
  let selfDisclosureIncomplete;

  if (summary && typeof summary.openCount === 'number') {
    // Explizite CRM-/Selftest-Summary hat Vorrang
    documentsIncomplete = summary.openCount > 0
      || Number(summary.missingCount) > 0
      || requestedOpen;
    if (!documentsIncomplete && summary.openCount === 0 && !Number(summary.missingCount)) {
      // Summary „alles klar“ → auch SA als erledigt für NBA (kein zweites Enum)
      selfDisclosureIncomplete = false;
    } else {
      selfDisclosureIncomplete = Boolean(tasks.showSa && !tasks.saComplete);
    }
  } else {
    documentsIncomplete = docSlotsOpen > 0 || requestedOpen;
    selfDisclosureIncomplete = Boolean(tasks.showSa && !tasks.saComplete);
  }

  return {
    documentsIncomplete,
    selfDisclosureIncomplete,
    openCount: documentsIncomplete
      ? Math.max(docSlotsOpen, Number(summary?.openCount) || 0, requestedOpen ? 1 : 0)
      : (selfDisclosureIncomplete ? 1 : 0),
    tasks,
  };
}

function needsDocuments(lead = {}) {
  const work = resolvePostCommitOpenWork(lead);
  return work.documentsIncomplete || work.selfDisclosureIncomplete;
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
  sellerInput = null,
} = {}) {
  if (!lead || typeof lead !== 'object') return null;

  const ws = workingState
    || lead.crm?.cleverWorkingState
    || null;
  const turnOpts = {
    draft,
    facts: Array.isArray(facts) ? facts : [],
    sellerInput: sellerInput || null,
  };

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

  const committed = hasCustomerOfferCommitment(lead);

  // 2) Post-Commit: nach Zusage keine Offer-Phase – außer neue ungesendete Version
  if (committed) {
    const activeInterest = hasActivePortfolioInterest(lead);
    // intend_send nur wenn keine aktive Zusage mehr (Change resolved → neue Version)
    // oder explizit ungesendete Prepared-Version ohne aktive Interest-Sperre
    const unsent = !activeInterest
      ? findUnsentSendableVehicleOffer(lead, { committed: true })
      : null;
    if (unsent) {
      return {
        id: NEXT_BEST_ACTION_ID.INTEND_SEND,
        label: 'An Kunden senden',
        toolId: 'intend_send',
        handler: 'intend_send',
        contextPayload: {
          cardId: unsent.cardId,
          offerDraftId: unsent.offerDraftId,
          monthlyRate: unsent.monthlyRate,
          cashPrice: unsent.cashPrice,
        },
        reason: 'post_commit_unsent_offer',
      };
    }

    const openWork = resolvePostCommitOpenWork(lead);
    if (openWork.documentsIncomplete) {
      return {
        id: NEXT_BEST_ACTION_ID.REQUEST_DOCUMENTS,
        label: 'Unterlagen anfordern',
        toolId: 'request_documents',
        handler: 'request_documents',
        contextPayload: {
          openCount: openWork.openCount,
          postCommit: true,
        },
        reason: 'post_commit_documents_missing',
      };
    }
    if (openWork.selfDisclosureIncomplete) {
      return {
        id: NEXT_BEST_ACTION_ID.REQUEST_SELF_DISCLOSURE,
        label: 'Selbstauskunft anfordern',
        toolId: 'self_disclosure_request',
        handler: 'self_disclosure_request',
        contextPayload: {
          postCommit: true,
        },
        reason: 'post_commit_self_disclosure_open',
      };
    }
    // Bestehender Abschluss-Handoff (Clever Action APPLICATION_PREPARE)
    return {
      id: NEXT_BEST_ACTION_ID.APPLICATION_PREPARE,
      label: 'Antrag vorbereiten',
      toolId: 'application_prepare',
      handler: 'application_prepare',
      contextPayload: {
        postCommit: true,
      },
      reason: 'post_commit_application_prepare',
    };
  }

  // 3) Sendbares VehicleOffer → intend_send (vor Commit)
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

  // 3.4) Outbound-/Prepared-Kontext: Angebotstext schon formuliert → kein prepare_offer
  {
    const profile = lead.crm?.needProfile || {};
    const sellerInputText = String(turnOpts.sellerInput || '').trim();
    const preparedCue = profile.preparedOutboundOffer === true
      || turnOpts.facts.some((f) => f?.field === 'preparedOutboundOffer' && f.value)
      || hasPreparedOutboundOfferCue(sellerInputText);
    if (preparedCue) {
      return {
        id: NEXT_BEST_ACTION_ID.DRAFT_MESSAGE,
        label: 'Nachricht prüfen',
        toolId: 'draft_message',
        handler: 'draft_message',
        contextPayload: {
          seedDraft: sellerInputText || null,
          preparedOutboundOffer: true,
          modelKey: resolveConcreteVehicleModel(lead, ws, turnOpts)?.modelKey || null,
        },
        reason: 'prepared_outbound_message',
      };
    }
  }

  // 3.5) Beratungsfall: modelCandidates ohne selectedModelKey → Consultation
  // (kein Concept-Draft / prepare_offer nur wegen Kandidaten)
  {
    const profile = lead.crm?.needProfile || {};
    const turnPickedModel = turnOpts.facts.some((f) => (
      f?.field === 'vehicleInterest' && f?.value?.modelKey && !f?.needsConfirmation
    ));
    const hasCandidates = Array.isArray(profile.modelCandidates)
      && profile.modelCandidates.length > 0;
    if (
      !turnPickedModel
      && !profile.selectedModelKey
      && (
        profile.consultationPending === true
        || (hasCandidates && !draft?.vehicleIdentityDraft?.modelKey
          && !listCustomerVehicleTracks(lead).some((t) => (
            t.status === VEHICLE_TRACK_STATUS.ACTIVE
            || t.status === VEHICLE_TRACK_STATUS.FAVORITE
          )))
      )
    ) {
      return {
        id: NEXT_BEST_ACTION_ID.CONSULTATION,
        label: 'Passende Fahrzeuge finden',
        toolId: 'capture_then_consult',
        handler: 'consultation',
        contextPayload: {
          modelCandidates: profile.modelCandidates || [],
          fuelPreference: profile.fuel || null,
          equipmentWishes: profile.equipmentWishes || [],
          paymentType: lead.wish?.paymentType || null,
          rangeKmMin: profile.rangeKmMin || null,
        },
        reason: 'consultation_candidates',
      };
    }
  }

  // 4) Konkretes Modell → prepare_offer
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

  // 5) Need ohne Modell → Consultation-Handoff
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
        || f?.field === 'termMonthsVariants'
        || f?.field === 'downPaymentRange'
        || f?.field === 'monthlyBudget'
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

  // 6) Probefahrt ohne Termin
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

  // 7) Unterlagen (ohne Commit – Legacy-Pfad)
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

  // 8) Follow-up fällig
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
