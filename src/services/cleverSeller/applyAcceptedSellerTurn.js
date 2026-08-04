/**
 * Seller bestätigt Review → Persistenz nur über bestehende Adapter.
 * Kein Blind-Auto-Apply; ausdrücklich nach „Übernehmen“.
 */
import { appendSellerInsightsFromTexts } from '../dealer/sellerInsights.js';
import { getTradeIn, patchTradeIn } from '../customerAkteTradeIn.js';
import {
  createEmptyNeedProfile,
  getNeedProfileFromLead,
  mergeNeedProfileIntoLead,
} from '../consultation/needProfileService.js';
import { SELLER_FACT_CLASS, SELLER_FACT_SOURCE, SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { postCleverAssistFeedCard, sendSellerWorkspacePackage } from '../crm/sharedWorkspaceService.js';
import {
  appointmentTypeLabel,
  applyAppointmentCrmPatch,
  buildCrmPatchFromAppointment,
} from '../dealer/sellerAppointmentAssistFlow.js';
import { mapSellerFactsToTrackFeedback } from './mapSellerFactsToTrackFeedback.js';
import {
  applyTrackFeedbackFacts,
  listCustomerVehicleTracks,
  patchVehicleTrackOnLead,
  sortTracksForOverview,
  VEHICLE_TRACK_STATUS,
} from '../crm/vehicleTrack.js';
import { applyHomepageInquiryToLead } from '../crm/homepageCommercialInquiry.js';
import { answerDeliveryTimeOnLead } from '../crm/deliveryTimeQuestion.js';
import { applyScenarioOfferFeedbackFacts } from '../crm/scenarioOfferFeedback.js';
import { persistConfirmedCustomerContract } from '../crm/customerContracts.js';
import { buildInboundLeadDraft } from './inboundLeadIntake.js';
import { isPrepareSuccessionOfferCue } from './prepareSuccessionOfferFromLead.js';

function pushUnique(list, item) {
  if (!item) return list;
  if (list.includes(item)) return list;
  return [...list, item];
}

/**
 * Strukturierte Felder aus bestätigten Facts (nach Review).
 * @param {object} lead
 * @param {object[]} facts
 */
export function applyStructuredFactsToLead(lead = {}, facts = []) {
  let next = lead;
  const wish = { ...(next.wish ?? {}) };
  const contact = { ...(next.contact ?? {}) };
  let desiredRate = next.desiredRate ?? wish.desiredRate ?? null;
  let paymentType = next.paymentType ?? wish.paymentType ?? null;
  let profile = { ...(getNeedProfileFromLead(next) || createEmptyNeedProfile()) };
  let touchedWish = false;
  let touchedContact = false;
  let touchedProfile = false;
  let appointmentValue = null;

  for (const fact of facts) {
    if (!fact || fact.needsConfirmation) continue;
    const field = fact.field;
    const value = fact.value;

    if (field === 'monthlyBudget' && value != null) {
      desiredRate = Number(value);
      wish.desiredRate = desiredRate;
      profile.budget = {
        ...(profile.budget ?? {}),
        maxMonthlyRate: desiredRate,
      };
      touchedWish = true;
      touchedProfile = true;
    }

    if (field === 'annualMileage' && value != null) {
      wish.mileagePerYear = Number(value);
      profile.annualKm = Number(value);
      touchedWish = true;
      touchedProfile = true;
    }

    if ((field === 'termMonths' || field === 'durationMonths') && value != null) {
      const months = typeof value === 'object' ? value.value : value;
      if (months) {
        wish.termMonths = Number(months);
        touchedWish = true;
      }
    }

    if (field === 'paymentType' && value) {
      // Dual-Szenario: nicht auf einzelnes paymentType kollabieren
      if (facts.some((f) => f.field === 'commercialScenarios')) continue;
      paymentType = String(value);
      wish.paymentType = paymentType;
      profile.budget = {
        ...(profile.budget ?? {}),
        paymentType,
      };
      touchedWish = true;
      touchedProfile = true;
    }

    if (field === 'downPayment' && value != null && value !== '') {
      const down = Number(value);
      if (Number.isFinite(down)) {
        wish.downPayment = down;
        profile.budget = {
          ...(profile.budget ?? {}),
          downPayment: down,
        };
        touchedWish = true;
        touchedProfile = true;
      }
    }

    if (field === 'phone') {
      const phone = String(fact.label || value || '').trim();
      if (phone) {
        contact.phone = phone;
        touchedContact = true;
      }
    }

    if (field === 'email') {
      const email = String(fact.label || value || '').trim();
      if (email && email.includes('@')) {
        contact.email = email;
        touchedContact = true;
      }
    }

    if (field === 'customerName') {
      const name = String(value || fact.label || '').trim();
      if (name && !String(contact.name || next.name || '').trim()) {
        contact.name = name;
        touchedContact = true;
      }
    }

    if (field === 'customerPlace') {
      const place = String(value || fact.label || '').trim();
      if (place) {
        contact.city = place;
        touchedContact = true;
      }
    }

    if (field === 'towHitchRequired' && value) {
      profile.towbar = true;
      profile.priorities = pushUnique(profile.priorities ?? [], 'towing');
      touchedProfile = true;
    }

    if (field === 'colorPreference' && (value || fact.label)) {
      profile.colorPreference = String(value || fact.label).toLowerCase();
      touchedProfile = true;
    }

    if (field === 'transmissionPreference' && value) {
      profile.transmission = String(value);
      touchedProfile = true;
    }

    if (field === 'sunroofRequired' && value) {
      profile.equipmentWishes = pushUnique(profile.equipmentWishes ?? [], 'Schiebedach');
      profile.priorities = pushUnique(profile.priorities ?? [], 'technology');
      touchedProfile = true;
    }

    if (field === 'trimPreference') {
      const trims = Array.isArray(value) ? value : [value || fact.label];
      for (const trim of trims) {
        const label = String(trim ?? '').trim();
        if (label) {
          profile.equipmentWishes = pushUnique(profile.equipmentWishes ?? [], label);
        }
      }
      touchedProfile = true;
    }

    if (field === 'discountPercent' && value != null) {
      wish.customDiscountPercent = Number(value);
      wish.customerGroup = 'custom';
      touchedWish = true;
    }

    if (field === 'existingContractEnd') {
      if (value?.endDate) {
        wish.leasingEndDate = value.endDate;
        touchedWish = true;
      }
      if (value?.type === 'leasing' || value?.type === 'financing' || value?.type === 'cash') {
        paymentType = value.type;
        wish.paymentType = value.type;
        touchedWish = true;
      }
    }

    if (field === 'deliveryDeadline' && value?.endDate) {
      wish.desiredDeliveryDate = value.endDate;
      if (value.important) wish.deliveryImportant = true;
      touchedWish = true;
    }

    if (field === 'deliveryEstimateMonths' && value != null) {
      const months = typeof value === 'object'
        ? (value.months ?? value.value ?? null)
        : value;
      if (months != null) {
        wish.deliveryEstimateMonths = Number(months);
        touchedWish = true;
      }
    }

    if (field === 'vehicleInterest' && value?.modelKey) {
      profile.selectedModelKey = value.modelKey;
      profile.modelHint = value.modelKey;
      touchedProfile = true;
    }

    if (field === 'vehicleInterestMulti') {
      const entries = Array.isArray(value) ? value : [];
      const keys = entries
        .map((entry) => (typeof entry === 'string' ? entry : entry?.modelKey))
        .filter(Boolean);
      if (keys.length) {
        profile.modelCandidates = keys;
      }
      if (fact.label) {
        profile.understoodLabels = pushUnique(profile.understoodLabels ?? [], fact.label);
      }
      // kein selectedModelKey – Mehrdeutigkeit bewusst offen lassen
      touchedProfile = true;
    }

    if (field === 'appointment' && value?.startAt) {
      appointmentValue = value;
    }

    if (field === 'maritalStatus' || field === 'childrenCount') {
      profile.household = {
        ...(profile.household ?? {}),
        ...(field === 'maritalStatus' ? { maritalStatus: value } : {}),
        ...(field === 'childrenCount' ? { childrenCount: value } : {}),
      };
      touchedProfile = true;
    }

    if (field === 'monthlyNetIncome' && value != null) {
      profile.finance = {
        ...(profile.finance ?? {}),
        monthlyNetIncome: Number(value),
      };
      touchedProfile = true;
    }
  }

  if (touchedWish || desiredRate != null || paymentType) {
    next = {
      ...next,
      desiredRate: desiredRate ?? next.desiredRate,
      paymentType: paymentType ?? next.paymentType,
      wish: {
        ...wish,
        desiredRate: desiredRate ?? wish.desiredRate,
        paymentType: paymentType ?? wish.paymentType,
      },
    };
  }

  if (touchedContact) {
    next = {
      ...next,
      contact: {
        ...(next.contact ?? {}),
        ...contact,
      },
      name: contact.name || next.name,
    };
  }

  if (touchedProfile) {
    next = mergeNeedProfileIntoLead(next, profile);
  }

  if (appointmentValue?.startAt) {
    const appointment = {
      id: `appt-review-${Date.now()}`,
      type: appointmentValue.type,
      typeLabel: appointmentTypeLabel(appointmentValue.type),
      startAt: appointmentValue.startAt,
      status: appointmentValue.status,
    };
    next = applyAppointmentCrmPatch(
      next,
      buildCrmPatchFromAppointment(appointment, { markProposed: true }),
    );
  }

  return next;
}

/**
 * @param {object} lead
 * @param {object} turn – CleverSellerTurnResult
 * @param {{ sellerId?: string, sellerName?: string, postFeedCard?: boolean }} [options]
 */
function hasPreparedCustomerFollowThrough(turn = {}) {
  return (turn.preparedActions ?? []).some((a) => (
    (
      a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE
      || a.type === SELLER_TURN_INTENTS.SEND_PORTFOLIO
      || a.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT
      || a.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT
      || a.type === SELLER_TURN_INTENTS.REQUEST_DOCUMENTS
      || a.type === SELLER_TURN_INTENTS.INBOUND_LEAD
      || a.type === SELLER_TURN_INTENTS.CUSTOMER_REPLY
      || a.type === SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT
    )
    && a.status === 'prepared'
  ));
}

function applyDocumentsPackageIfPresent(lead, turn, options = {}) {
  if (options.sendDocumentsPackage === false) {
    return { applied: false, lead, uploadUrl: null };
  }
  const docsAction = (turn.preparedActions ?? []).find((a) => (
    a.type === SELLER_TURN_INTENTS.REQUEST_DOCUMENTS
    && a.status === 'prepared'
    && !a.payload?.complete
  ));
  if (!docsAction) return { applied: false, lead, uploadUrl: null };

  const pkg = docsAction.legacy
    || docsAction.payload?.workspacePackage
    || null;
  const body = pkg?.body
    || docsAction.payload?.messageDraft
    || turn.messageDraft
    || '';
  const actions = Array.isArray(pkg?.actions) ? pkg.actions : [];
  if (!lead?.id || (!String(body).trim() && !actions.length)) {
    return { applied: false, lead, uploadUrl: null };
  }

  const sent = sendSellerWorkspacePackage({
    lead,
    body,
    actions,
    createdByName: options.sellerName || 'Verkäufer',
    threadId: options.threadId || null,
    relatedOfferId: options.relatedOfferId || null,
    relatedQuestionId: options.relatedQuestionId || null,
  });
  return {
    applied: Boolean(sent.ok),
    lead: sent.lead || lead,
    uploadUrl: sent.uploadUrl || null,
    messages: sent.messages || [],
    error: sent.error || null,
  };
}

function applyContractImportIfPresent(lead, turn, options = {}) {
  const contractAction = (turn.preparedActions ?? []).find((a) => (
    a.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT
    && a.status === 'prepared'
  ));
  const draft = contractAction?.payload?.contractDraft || turn.contractDraft || null;
  if (!draft || !lead?.id) {
    return { applied: false, lead, contract: null, duplicate: false };
  }
  const persisted = persistConfirmedCustomerContract(lead, draft, {
    activityText: 'Altvertrag erfasst',
  });
  let nextLead = persisted.lead || lead;
  if (options.postFeedCard !== false && persisted.ok && !persisted.duplicate) {
    const posted = postCleverAssistFeedCard({
      lead: nextLead,
      title: '✨ Altvertrag erfasst',
      text: [
        draft.vehicle?.label || draft.contractType || 'Vertrag',
        draft.contractEndDate ? `Ende ${draft.contractEndDate}` : null,
        draft.monthlyRate != null ? `${draft.monthlyRate} € / Monat` : null,
      ].filter(Boolean).join(' · '),
      visibleToCustomer: false,
    });
    if (posted.message) nextLead = posted.lead;
  }
  return {
    applied: persisted.ok,
    lead: nextLead,
    contract: persisted.contract,
    duplicate: persisted.duplicate,
  };
}

export function applyAcceptedSellerTurn(lead = {}, turn = {}, options = {}) {
  const rawFacts = turn.extractedFacts ?? [];
  const hasCustomerActions = hasPreparedCustomerFollowThrough(turn);
  const inbound = turn.inboundLead || null;

  // Inbound: neuen Kunden nur nach Accept anlegen (kein Auto-Persist vorher)
  let workingLead = lead;
  let createdFromInbound = false;
  if (
    inbound?.proposeCreateCustomer
    && !lead?.id
    && options.allowCreateCustomer !== false
  ) {
    workingLead = buildInboundLeadDraft(inbound.contact || {}, {
      dealerId: options.dealerId,
    });
    createdFromInbound = true;
  }

  if (!workingLead?.id || (!rawFacts.length && !hasCustomerActions && !createdFromInbound)) {
    return { ok: false, lead: workingLead, acceptedLabels: [], created: false };
  }

  // Contract Import zuerst – keine Contract Facts als Customer Truth
  const contractResult = applyContractImportIfPresent(workingLead, turn, options);
  if (contractResult.applied && !rawFacts.length) {
    // Unterlagen ggf. im selben Accept (ohne weitere Facts)
    const docsAfterContract = applyDocumentsPackageIfPresent(contractResult.lead, turn, options);
    if (docsAfterContract.applied) {
      let nextLead = docsAfterContract.lead;
      if (options.postFeedCard !== false) {
        const summary = (turn.preparedActions ?? [])
          .find((a) => a.type === SELLER_TURN_INTENTS.REQUEST_DOCUMENTS)
          ?.payload?.sellerSummary
          || 'Sicheren Upload-Link gesendet';
        const posted = postCleverAssistFeedCard({
          lead: nextLead,
          title: '✨ Unterlagen-Link gesendet',
          text: summary,
          visibleToCustomer: false,
        });
        if (posted.message) nextLead = posted.lead;
      }
      return {
        ok: true,
        lead: nextLead,
        acceptedLabels: [
          contractResult.duplicate ? 'Vertrag bereits vorhanden' : 'Altvertrag erfasst',
          'Sicheren Upload-Link gesendet',
        ],
        contract: contractResult.contract,
        duplicateContract: contractResult.duplicate,
        documentsPackageSent: true,
        uploadUrl: docsAfterContract.uploadUrl || null,
        created: createdFromInbound,
      };
    }
    return {
      ok: true,
      lead: contractResult.lead,
      acceptedLabels: contractResult.duplicate
        ? ['Vertrag bereits vorhanden']
        : ['Altvertrag erfasst'],
      contract: contractResult.contract,
      duplicateContract: contractResult.duplicate,
    };
  }

  // Unterlagen-Paket allein: erst nach Confirm senden (Propose → Confirm → Action)
  if (!rawFacts.length) {
    const docsResult = applyDocumentsPackageIfPresent(
      contractResult.applied ? contractResult.lead : workingLead,
      turn,
      options,
    );
    if (docsResult.applied) {
      let nextLead = docsResult.lead;
      if (options.postFeedCard !== false) {
        const summary = (turn.preparedActions ?? [])
          .find((a) => a.type === SELLER_TURN_INTENTS.REQUEST_DOCUMENTS)
          ?.payload?.sellerSummary
          || 'Sicheren Upload-Link gesendet';
        const posted = postCleverAssistFeedCard({
          lead: nextLead,
          title: '✨ Unterlagen-Link gesendet',
          text: summary,
          visibleToCustomer: false,
        });
        if (posted.message) nextLead = posted.lead;
      }
      return {
        ok: true,
        lead: nextLead,
        acceptedLabels: ['Sicheren Upload-Link gesendet'],
        documentsPackageSent: true,
        uploadUrl: docsResult.uploadUrl || null,
        created: createdFromInbound,
      };
    }

    let nextLead = contractResult.applied ? contractResult.lead : workingLead;
    if (options.postFeedCard !== false) {
      const preparedLabels = (turn.preparedActions ?? [])
        .filter((a) => a.status === 'prepared')
        .map((a) => a.label || a.type)
        .filter(Boolean)
        .slice(0, 4);
      const text = preparedLabels.length
        ? `Vorbereitet: ${preparedLabels.join(' · ')}`
        : (String(turn.messageDraft ?? turn.assistantReply ?? '').trim() || 'Clever hat vorbereitet');
      if (String(text).trim()) {
        const posted = postCleverAssistFeedCard({
          lead: nextLead,
          title: '✨ Clever hat vorbereitet',
          text,
          visibleToCustomer: false,
        });
        if (posted.message) nextLead = posted.lead;
      }
    }
    return {
      ok: true,
      lead: nextLead,
      acceptedLabels: createdFromInbound ? ['Kunde aus Anfrage angelegt'] : [],
      created: createdFromInbound,
    };
  }

  // „Übernehmen“ = Seller bestätigt die Review inkl. unsicherer Facts
  // Bei Contract-Import: keine Wish-/Truth-Mutation aus Contract-Paste-Facts
  const skipTruthFromContract = Boolean(contractResult.applied);
  const facts = (skipTruthFromContract ? [] : rawFacts).map((f) => (
    f?.needsConfirmation ? { ...f, needsConfirmation: false } : f
  ));

  if (skipTruthFromContract && !facts.length) {
    return {
      ok: true,
      lead: contractResult.lead,
      acceptedLabels: contractResult.duplicate
        ? ['Vertrag bereits vorhanden']
        : ['Altvertrag erfasst'],
      contract: contractResult.contract,
      duplicateContract: contractResult.duplicate,
      created: createdFromInbound,
    };
  }

  const labels = facts.map((f) => String(f.label ?? '').trim()).filter(Boolean);
  let nextLead = appendSellerInsightsFromTexts(workingLead, labels, {
    context: 'universal_review',
    sellerId: options.sellerId,
    sellerName: options.sellerName,
  });

  // Epic 2: Dual commercial scenarios → eine Spur + zwei Offer-Slots
  const homepageDraft = turn.homepageInquiry?.hasDualScenarios
    ? turn.homepageInquiry
    : null;
  const scenarioFact = facts.find((f) => f.field === 'commercialScenarios');
  if (homepageDraft || (Array.isArray(scenarioFact?.value) && scenarioFact.value.length >= 2)) {
    const draft = homepageDraft || {
      model: facts.find((f) => f.field === 'vehicleInterest')?.value?.model
        || facts.find((f) => f.field === 'vehicleInterest')?.label
        || workingLead.vehicle?.model
        || null,
      modelKey: facts.find((f) => f.field === 'vehicleInterest')?.value?.modelKey || null,
      configurationAttached: facts.some((f) => f.field === 'configurationAttached'),
      customerType: facts.find((f) => f.field === 'customerType')?.value || 'private',
      commercialScenarios: scenarioFact.value,
      openQuestions: facts
        .filter((f) => f.field === 'deliveryTime')
        .map((f) => ({
          id: 'delivery_time',
          field: 'deliveryTime',
          label: f.label || 'Lieferzeit beantworten',
          question: f.value?.question || 'Wie ist die Lieferzeit?',
        })),
      hasDualScenarios: true,
    };
    const appliedHome = applyHomepageInquiryToLead(nextLead, draft, { createOfferShells: true });
    if (appliedHome.ok) {
      nextLead = appliedHome.lead;
    }
  }

  nextLead = applyStructuredFactsToLead(nextLead, facts);

  // Epic 3: Lieferzeit-Antwort schließt offene Kundenfrage + Portal-Text
  const deliveryAnswerFact = facts.find((f) => (
    f.field === 'deliveryTimeAnswer' && f.value?.answerText && !f.needsConfirmation
  ));
  if (deliveryAnswerFact) {
    nextLead = answerDeliveryTimeOnLead(nextLead, {
      answerText: deliveryAnswerFact.value.answerText,
      weeksMin: deliveryAnswerFact.value.weeksMin ?? null,
      weeksMax: deliveryAnswerFact.value.weeksMax ?? null,
      months: deliveryAnswerFact.value.months ?? null,
      approximate: deliveryAnswerFact.value.approximate !== false,
      source: deliveryAnswerFact.value.source
        || deliveryAnswerFact.source
        || SELLER_FACT_SOURCE.SELLER_INPUT,
      answeredBy: options.sellerId || options.sellerName || null,
    });
  } else {
    const monthsFact = facts.find((f) => (
      f.field === 'deliveryEstimateMonths' && !f.needsConfirmation
    ));
    if (monthsFact) {
      const months = typeof monthsFact.value === 'object'
        ? (monthsFact.value.months ?? monthsFact.value.value)
        : monthsFact.value;
      if (months != null) {
        nextLead = answerDeliveryTimeOnLead(nextLead, {
          answerText: `${Number(months)} Monate`,
          months: Number(months),
          approximate: true,
          source: monthsFact.source || SELLER_FACT_SOURCE.SELLER_INPUT,
          answeredBy: options.sellerId || options.sellerName || null,
        });
      }
    }
  }

  const trackFeedback = mapSellerFactsToTrackFeedback(facts, nextLead);
  if (trackFeedback.length) {
    nextLead = applyTrackFeedbackFacts(nextLead, trackFeedback);
  }

  // Slice 18: Nach Confirm Nachfolgeangebot auf Favoriten-Spur markieren (kein Auto-Send)
  const successionCue = isPrepareSuccessionOfferCue(
    turn?.interpretedInput?.normalized || turn?.interpretedInput?.raw || '',
  );
  const successionFact = facts.some((f) => (
    f.field === 'paymentType' && /nachfolge/i.test(String(f.label || ''))
  ));
  if (successionCue || successionFact) {
    const tracks = sortTracksForOverview(listCustomerVehicleTracks(nextLead));
    const favorite = tracks.find((t) => t.status === VEHICLE_TRACK_STATUS.FAVORITE);
    if (favorite?.id) {
      nextLead = patchVehicleTrackOnLead(nextLead, favorite.id, {
        successionOfferPreparedAt: new Date().toISOString(),
      });
      if (!labels.includes('Nachfolgeangebot vorbereitet')) {
        labels.push('Nachfolgeangebot vorbereitet');
      }
    }
  }

  // Epic 4: Varianten-Feedback (commercialScenarioId) – Spur bleibt eine
  const scenarioFeedbackFacts = facts
    .filter((f) => f.field === 'scenarioOfferFeedback' && f.value?.commercialScenarioId && !f.needsConfirmation)
    .map((f) => f.value);
  if (scenarioFeedbackFacts.length) {
    nextLead = applyScenarioOfferFeedbackFacts(nextLead, scenarioFeedbackFacts);
  }

  const tradeInRequested = facts.some((f) => f.factClass === SELLER_FACT_CLASS.TRADE_IN_FACT);
  const existingVehicle = facts.find((f) => f.factClass === SELLER_FACT_CLASS.EXISTING_VEHICLE);
  if (tradeInRequested || existingVehicle) {
    const current = getTradeIn(nextLead);
    const vehicleLabel = existingVehicle?.label
      || (existingVehicle?.value
        ? `${existingVehicle.value.make ?? ''} ${existingVehicle.value.model ?? ''}`.trim()
        : current.vehicle);
    nextLead = {
      ...nextLead,
      crm: {
        ...(nextLead.crm ?? {}),
        tradeIn: patchTradeIn(current, {
          vehicle: vehicleLabel || current.vehicle,
          notes: tradeInRequested
            ? [current.notes, 'Inzahlungnahme gewünscht'].filter(Boolean).join(' · ')
            : current.notes,
        }),
      },
    };
  }

  if (options.postFeedCard !== false) {
    const lines = labels.slice(0, 8);
    const preparedLabels = (turn.preparedActions ?? [])
      .filter((a) => a.status === 'prepared')
      .map((a) => a.label || a.type)
      .filter(Boolean)
      .slice(0, 4);
    const text = lines.length
      ? `${lines.join(' · ')}\n\n${labels.length} Angabe${labels.length === 1 ? '' : 'n'} übernommen`
      : (preparedLabels.length
        ? `Vorbereitet: ${preparedLabels.join(' · ')}`
        : (String(turn.messageDraft ?? turn.assistantReply ?? '').trim() || 'Clever hat vorbereitet'));
    if (String(text).trim()) {
      const isHomepageDual = Boolean(turn.homepageInquiry?.hasDualScenarios)
        || facts.some((f) => f.field === 'commercialScenarios');
      const isCustomerReply = Boolean(turn.customerReply?.detected);
      const reviewType = turn.reviewModel?.reviewType || turn.reviewType || null;
      const isInbound = Boolean(turn.inboundLead?.detected)
        || reviewType === 'customer_intake_review'
        || reviewType === 'inbound_lead_review';
      const posted = postCleverAssistFeedCard({
        lead: nextLead,
        title: isCustomerReply
          ? '✨ Clever hat die Kundenantwort erkannt'
          : isInbound
            ? '✨ Clever hat eine Anfrage erkannt'
            : isHomepageDual
              ? '✨ Clever hat die Anfrage vorbereitet'
              : '✨ Clever hat verstanden',
        text,
        visibleToCustomer: false,
      });
      if (posted.message) nextLead = posted.lead;
    }
  }

  // Facts + Unterlagen-Paket in einem Accept
  const docsWithFacts = applyDocumentsPackageIfPresent(nextLead, turn, options);
  if (docsWithFacts.applied) {
    nextLead = docsWithFacts.lead;
    labels.push('Sicheren Upload-Link gesendet');
  }

  return {
    ok: true,
    lead: nextLead,
    acceptedLabels: labels,
    created: createdFromInbound,
    documentsPackageSent: Boolean(docsWithFacts.applied),
    uploadUrl: docsWithFacts.uploadUrl || null,
  };
}
