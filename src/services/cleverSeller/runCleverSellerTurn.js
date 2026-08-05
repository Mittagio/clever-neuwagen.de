/**
 * Clever Universal Seller Turn – Orchestrator v1.
 *
 * Deterministisch zuerst. OpenAI optional bei Eskalation (Flag).
 * Persistenz / Versand nur über definierte Pfade nach Seller-Review.
 */
import { buildCustomerUnderstanding } from '../dealer/customerUnderstanding.js';
import { buildUnderstoodLabels, getNeedProfileFromLead } from '../consultation/needProfileService.js';
import { buildCleverSellerTurnResult } from './cleverSellerTurnResultSchema.js';
import {
  interpretSellerInput,
  isExplicitCustomerMessageCue,
} from './interpretSellerInput.js';
import {
  hasExplicitAppointmentSellerCue,
  isOfferPdfDropContext,
} from './mapMagicOfferIntentToSellerFacts.js';
import {
  buildProposedUpdatesFromFacts,
  filterDuplicateFacts,
} from './proposeSellerUpdates.js';
import { resolveMissingInformation } from './resolveMissingInformation.js';
import {
  buildSellerAssistantReply,
  planSellerActions,
} from './planSellerActions.js';
import { SELLER_FACT_CLASS, SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import {
  isPrepareSuccessionOfferCue,
  prepareSuccessionOfferFromLead,
} from './prepareSuccessionOfferFromLead.js';
import {
  evaluateSellerInterpretEscalation,
  isCleverSellerOrchestratorEnabled,
  isCleverSellerOpenAiInterpretEnabled,
  evaluateComplexSellerTurn,
} from './cleverSellerOrchestratorConfig.js';
import { buildSellerInterpretSafeContext } from './buildSellerInterpretSafeContext.js';
import { interpretSellerInputWithOpenAi } from './interpretSellerInputWithOpenAi.js';
import {
  buildMultiSourceIntake,
  shouldBuildMultiSourceIntake,
} from './multiSource/buildMultiSourceIntake.js';
import { buildMultiSourceProgressLines } from './multiSource/buildMultiSourceProgressLines.js';
import { interpretMultiSourceWithOpenAi } from './multiSource/interpretMultiSourceWithOpenAi.js';
import { minimizeSensitiveOcrText } from './minimizeSensitiveOcrText.js';
import {
  mergeSellerIntents,
  mergeSellerInterpretation,
} from './mergeSellerInterpretation.js';
import {
  resolveAssistantContext,
  buildInterpretedGoal,
  extractNamedCustomerFromInput,
} from './resolveAssistantContext.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';
import {
  resolveWorkingLeadForTurn,
  buildPreparedOfferWorkingContext,
} from './resolveWorkingLeadForTurn.js';
import {
  buildInboundLeadProposal,
  extractInboundContact,
  proposeInboundNextAction,
  resolveInboundCustomer,
} from './inboundLeadIntake.js';
import {
  buildCustomerReplyProposal,
  extractCustomerReplyBody,
  proposeCustomerReplyNextActions,
  resolveCustomerReplyCustomer,
} from './customerReplyIntake.js';
import { resolveAppointmentCustomerContext } from './resolveAppointmentCustomerContext.js';
import { isAppointmentFollowUpInput } from './prepareContextualAppointmentProposal.js';
import { extractContractCustomerNameHint } from './extractCustomerContractFromText.js';
import { resolveCleverCalendarProvider } from './resolveCleverCalendarProvider.js';
import { checkCalendarAvailability } from './checkCalendarAvailability.js';
import { getAppointmentDurationMinutes } from '../dealer/sellerAppointmentAssistFlow.js';

function createTurnId() {
  return `cst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildEvidenceFromTurn({ facts = [], preparedActions = [], retrievedFacts = [] }) {
  const evidence = [];
  for (const f of facts) {
    if (!f?.label) continue;
    evidence.push({
      kind: 'extracted_fact',
      field: f.field,
      label: f.label,
      source: f.source || 'seller_input',
      confidence: f.confidence ?? null,
    });
  }
  for (const retrieved of retrievedFacts) {
    if (!retrieved) continue;
    evidence.push({
      kind: 'retrieved_fact',
      source: 'verified_vehicle_data',
      payload: retrieved,
    });
  }
  for (const action of preparedActions) {
    if (action?.toolId) {
      evidence.push({
        kind: 'tool',
        toolId: action.toolId,
        type: action.type,
        status: action.status,
      });
    }
  }
  return evidence;
}

/**
 * @param {object} params
 */
function finalizeSellerTurn({
  lead = {},
  interpreted,
  facts: factsIn = [],
  intents: intentsIn = [],
  env = {},
  warningsExtra = [],
  openaiEscalation = null,
  interpreterDiagnostics = null,
  multiSourceIntakeOverride = null,
  currentOfferContext = null,
  workingContextItems = [],
  customerName = '',
  attachments = [],
  leadsSnapshot = [],
  scopeHint = null,
  appContext = null,
  pendingAction: incomingPendingAction = null,
  now = null,
  calendarAvailability = null,
}) {
  void appContext;
  const enabled = isCleverSellerOrchestratorEnabled(env);

  const sellerText = interpreted?.normalized || interpreted?.raw || '';
  let facts = Array.isArray(factsIn) ? [...factsIn] : [];
  let intents = Array.isArray(intentsIn) ? [...intentsIn] : [];
  // Offer-/Konfigurator-PDF: kein Auto-Termin; Angebot hat Vorrang
  if (
    isOfferPdfDropContext(attachments, sellerText)
    && !hasExplicitAppointmentSellerCue(sellerText)
  ) {
    facts = facts.filter((f) => f.factClass !== SELLER_FACT_CLASS.APPOINTMENT_FACT);
    intents = intents.filter((i) => (
      i.type !== SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT
      && i.type !== SELLER_TURN_INTENTS.RESOLVE_RELATIVE_DATETIME
    ));
    if (!intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER)) {
      intents.push({ type: SELLER_TURN_INTENTS.PREPARE_OFFER, confidence: 0.96 });
    }
    if (!isExplicitCustomerMessageCue(sellerText)) {
      intents = intents.filter((i) => i.type !== SELLER_TURN_INTENTS.DRAFT_MESSAGE);
    }
  }

  const pendingAppointment = incomingPendingAction?.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT
    || incomingPendingAction?.preparedAppointment
    ? (incomingPendingAction.preparedAppointment || incomingPendingAction)
    : (appContext?.pendingAppointment || null);

  // Appointment: Pronomen / Kontextkunde
  const wantsAppointment = (intents || []).some((i) => (
    i.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT
    || i.type === SELLER_TURN_INTENTS.PREPARE_CALLBACK
  )) || isAppointmentFollowUpInput(sellerText, pendingAppointment);

  const wantsContractImport = (intents || []).some((i) => (
    i.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT
  ));
  const wantsContractSearch = (intents || []).some((i) => (
    i.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_CONTRACTS
  ));
  const wantsContractCompare = (intents || []).some((i) => (
    i.type === SELLER_TURN_INTENTS.COMPARE_CONTRACT_WITH_OFFER
  ));

  let appointmentCustomer = null;
  if (wantsAppointment) {
    appointmentCustomer = resolveAppointmentCustomerContext({
      sellerInput: interpreted.normalized || interpreted.raw,
      lead,
      leadsSnapshot,
      pendingAction: incomingPendingAction,
      workingContextItems,
    });
  }

  const contractNameHint = wantsContractImport
    ? extractContractCustomerNameHint(interpreted.normalized || interpreted.raw)
    : null;
  const namedForContractSearch = wantsContractSearch
    ? (interpreted.normalized || interpreted.raw).match(
      /\b(?:wann\s+)?(?:läuft|lauft|endet)\s+(?:herrn?\s+|frau\s+)?([A-Za-zÄÖÜäöüß-]{2,40})\s+aus\b/i,
    )?.[1]
      || (interpreted.normalized || interpreted.raw).match(
        /\bwas\s+zahlt\s+(?:herrn?\s+|frau\s+)?([A-Za-zÄÖÜäöüß-]{2,40})\b/i,
      )?.[1]
      || null
    : null;
  const namedForContractCompare = wantsContractCompare
    ? (interpreted.normalized || interpreted.raw).match(
      /\bvertrag\s+(?:von|für)\s+(?:herrn?\s+|frau\s+)?([A-Za-zÄÖÜäöüß-]{2,40})\b/i,
    )?.[1]
      || (interpreted.normalized || interpreted.raw).match(
        /\b(?:herrn?\s+|frau\s+)([A-Za-zÄÖÜäöüß-]{2,40})\b/i,
      )?.[1]
      || extractNamedCustomerFromInput(interpreted.normalized || interpreted.raw)
      || null
    : null;
  const contractSearchInput = contractNameHint
    ? `Öffne ${contractNameHint}`
    : (namedForContractSearch || namedForContractCompare
      ? `Öffne ${namedForContractSearch || namedForContractCompare}`
      : (interpreted.normalized || interpreted.raw));

  const leadResolve = wantsAppointment && appointmentCustomer?.resolved && appointmentCustomer.customer?.id
    ? {
      workingLead: appointmentCustomer.customer,
      resolution: { source: appointmentCustomer.source },
      customerSearchResults: null,
      ambiguous: false,
      resolved: true,
    }
    : resolveWorkingLeadForTurn({
      lead,
      sellerInput: (wantsContractImport || wantsContractSearch || wantsContractCompare) && !lead?.id
        ? contractSearchInput
        : (interpreted.normalized || interpreted.raw),
      leadsSnapshot,
      intents,
    });

  const wantsCustomerReply = (intents || []).some((i) => i.type === SELLER_TURN_INTENTS.CUSTOMER_REPLY);
  const wantsInbound = (intents || []).some((i) => i.type === SELLER_TURN_INTENTS.INBOUND_LEAD);
  let customerReply = null;
  let inboundLead = null;

  if (wantsCustomerReply) {
    const contact = interpreted.inboundContact
      || extractInboundContact(interpreted.normalized || interpreted.raw);
    const replyBody = extractCustomerReplyBody(
      interpreted.normalized || interpreted.raw,
      contact,
    );
    const replyResolution = resolveCustomerReplyCustomer({
      contact,
      leads: leadsSnapshot,
      openLead: lead?.id ? lead : null,
    });
    const nextActions = proposeCustomerReplyNextActions({
      text: replyBody || interpreted.normalized || interpreted.raw,
      facts,
    });
    customerReply = buildCustomerReplyProposal({
      contact,
      resolution: replyResolution,
      facts,
      nextActions,
      rawText: interpreted.normalized || interpreted.raw,
      replyBody,
    });

    if (replyResolution.status === 'unique' && replyResolution.lead?.id) {
      leadResolve.workingLead = replyResolution.lead;
      leadResolve.resolution = replyResolution;
      leadResolve.customerSearchResults = replyResolution.results;
      leadResolve.ambiguous = false;
      leadResolve.resolved = true;
    } else if (replyResolution.status === 'ambiguous') {
      leadResolve.workingLead = lead?.id ? lead : {};
      leadResolve.resolution = replyResolution;
      leadResolve.customerSearchResults = replyResolution.results;
      leadResolve.ambiguous = true;
      leadResolve.resolved = Boolean(lead?.id);
    } else {
      leadResolve.customerSearchResults = replyResolution.results?.length
        ? replyResolution.results
        : null;
      if (!lead?.id) {
        leadResolve.workingLead = {};
        leadResolve.ambiguous = false;
        leadResolve.resolved = false;
      }
    }
  } else if (wantsInbound && !lead?.id) {
    const contact = interpreted.inboundContact
      || extractInboundContact(interpreted.normalized || interpreted.raw);
    const inboundResolution = resolveInboundCustomer(contact, leadsSnapshot);
    const nextAction = proposeInboundNextAction({
      text: interpreted.normalized || interpreted.raw,
      facts,
    });
    inboundLead = buildInboundLeadProposal({
      contact,
      resolution: inboundResolution,
      facts,
      nextAction,
      rawText: interpreted.normalized || interpreted.raw,
    });

    if (inboundResolution.status === 'unique' && inboundResolution.lead?.id) {
      leadResolve.workingLead = inboundResolution.lead;
      leadResolve.resolution = inboundResolution;
      leadResolve.customerSearchResults = inboundResolution.results;
      leadResolve.ambiguous = false;
      leadResolve.resolved = true;
    } else if (inboundResolution.status === 'ambiguous') {
      leadResolve.workingLead = {};
      leadResolve.resolution = inboundResolution;
      leadResolve.customerSearchResults = inboundResolution.results;
      leadResolve.ambiguous = true;
      leadResolve.resolved = false;
    } else if (inboundLead.proposeCreateCustomer) {
      // Kein Treffer per E-Mail/Telefon/Name – false-positive „Leasing“/Sportage verwerfen
      leadResolve.workingLead = {};
      leadResolve.resolution = inboundResolution;
      leadResolve.customerSearchResults = null;
      leadResolve.ambiguous = false;
      leadResolve.resolved = false;
    } else if (inboundResolution.status === 'none' && inboundResolution.results?.length) {
      leadResolve.customerSearchResults = inboundResolution.results;
    }
  }

  const workingLead = leadResolve.workingLead?.id ? leadResolve.workingLead : (lead || {});

  let uniqueFacts = filterDuplicateFacts(facts, workingLead);
  const proposedUpdates = buildProposedUpdatesFromFacts(uniqueFacts);
  const assistantContext = resolveAssistantContext({
    lead: workingLead,
    sellerInput: interpreted.normalized || interpreted.raw,
    workingContextItems,
    currentOfferContext,
    customerName: customerName
      || workingLead?.contact?.name
      || '',
    attachments,
  });
  if (leadResolve.resolved && workingLead?.id) {
    assistantContext.resolvedCustomer = {
      ...assistantContext.resolvedCustomer,
      id: workingLead.id,
      name: workingLead.contact?.name || workingLead.name || assistantContext.resolvedCustomer?.name,
      namedInInput: assistantContext.resolvedCustomer?.namedInInput
        || leadResolve.resolution?.nameQuery
        || null,
      source: appointmentCustomer?.source
        || (customerReply?.detected ? 'customer_reply_match' : null)
        || (inboundLead?.detected ? 'inbound_match' : 'global_search'),
      matched: true,
    };
  } else if (inboundLead?.proposeCreateCustomer) {
    assistantContext.resolvedCustomer = {
      ...(assistantContext.resolvedCustomer || {}),
      id: null,
      name: inboundLead.contact?.fullName || null,
      namedInInput: inboundLead.contact?.fullName || null,
      source: 'inbound_propose_create',
      matched: false,
    };
  }

  // Slice 18: Nachfolgeangebot – Favoriten-/Vertragsdaten als Offer-Facts injizieren
  const successionCue = isPrepareSuccessionOfferCue(interpreted.normalized || interpreted.raw);
  let successionPrep = null;
  if (successionCue && workingLead?.id) {
    successionPrep = prepareSuccessionOfferFromLead(workingLead, {
      now,
      goldenMoment: assistantContext.goldenMoment,
    });
    if (successionPrep.ok && successionPrep.facts?.length) {
      uniqueFacts = filterDuplicateFacts(
        [...uniqueFacts, ...successionPrep.facts],
        workingLead,
      );
    }
  }

  const offerCtx = (successionCue && successionPrep?.ok)
    ? null
    : (currentOfferContext || assistantContext.offerContext || null);

  const missingInformation = resolveMissingInformation({
    intents,
    facts: uniqueFacts,
    lead: workingLead,
    currentOfferContext: offerCtx,
  });

  if (successionCue && successionPrep && !successionPrep.ok) {
    missingInformation.push({
      id: successionPrep.reason === 'missing_rate'
        ? 'monthly_leasing_rate'
        : 'succession_favorite',
      forIntent: SELLER_TURN_INTENTS.PREPARE_OFFER,
      label: successionPrep.message
        || 'Nachfolgeangebot: Favorit oder Rate fehlt.',
      field: successionPrep.reason === 'missing_rate' ? 'monthlyLeasingRate' : 'vehicleInterest',
    });
  }

  // Ambiguous: Angebot oder Nachricht?
  const ambiguousOfferOrMessage = intents.some((i) => i.type === SELLER_TURN_INTENTS.UNKNOWN)
    && uniqueFacts.some((f) => f.field === 'purchasePrice')
    && uniqueFacts.some((f) => f.field === 'vehicleInterest')
    && !intents.some((i) => (
      i.type === SELLER_TURN_INTENTS.PREPARE_OFFER
      || i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE
    ));
  if (ambiguousOfferOrMessage) {
    missingInformation.push({
      id: 'clarify_offer_or_message',
      field: 'sellerGoal',
      label: 'Soll ich daraus ein Angebot vorbereiten oder nur eine Nachricht schreiben?',
      forIntent: SELLER_TURN_INTENTS.UNKNOWN,
    });
  }

  if (leadResolve.ambiguous || appointmentCustomer?.ambiguous) {
    missingInformation.push({
      id: 'clarify_customer',
      field: 'customerId',
      label: appointmentCustomer?.question
        || 'Mehrere Kunden gefunden – bitte einen auswählen.',
      forIntent: SELLER_TURN_INTENTS.FIND_CUSTOMER,
    });
  } else if (wantsAppointment && appointmentCustomer && !appointmentCustomer.resolved) {
    missingInformation.push({
      id: 'clarify_customer_for_appointment',
      field: 'customerId',
      label: appointmentCustomer.question
        || 'Für welchen Kunden soll ich den Termin vorschlagen?',
      forIntent: SELLER_TURN_INTENTS.RESOLVE_CUSTOMER_CONTEXT,
    });
  }

  if (wantsContractImport && !workingLead?.id && !leadResolve.resolved) {
    missingInformation.push({
      id: 'clarify_customer_for_contract',
      field: 'customerId',
      label: contractNameHint
        ? `Kunde „${contractNameHint}“ nicht eindeutig – bitte Akte öffnen oder auswählen.`
        : 'Für welchen Kunden soll ich den Vertrag erfassen?',
      forIntent: SELLER_TURN_INTENTS.RESOLVE_CUSTOMER_CONTEXT,
    });
  }

  if (inboundLead?.proposeCreateCustomer && !workingLead?.id) {
    missingInformation.push({
      id: 'confirm_create_customer',
      field: 'createCustomer',
      label: inboundLead.contact?.fullName
        ? `Neuen Kunden „${inboundLead.contact.fullName}“ anlegen?`
        : 'Neuen Kunden aus der Anfrage anlegen?',
      forIntent: SELLER_TURN_INTENTS.INBOUND_LEAD,
    });
  } else if (inboundLead?.detected && inboundLead.resolutionStatus === 'ambiguous') {
    missingInformation.push({
      id: 'clarify_customer_for_intake',
      field: 'customerId',
      label: 'Mehrere Kunden passen – bitte die richtige Akte wählen.',
      forIntent: SELLER_TURN_INTENTS.INBOUND_LEAD,
    });
  }

  let effectiveIntents = Array.isArray(intents) ? [...intents] : [];
  if (successionCue && !effectiveIntents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER)) {
    effectiveIntents.push({ type: SELLER_TURN_INTENTS.PREPARE_OFFER, confidence: 0.98 });
    if (!effectiveIntents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE)) {
      effectiveIntents.push({ type: SELLER_TURN_INTENTS.DRAFT_MESSAGE, confidence: 0.9 });
    }
  }
  if (wantsAppointment && !effectiveIntents.some((i) => i.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT)) {
    effectiveIntents.push({ type: SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT, confidence: 0.95 });
    effectiveIntents.push({ type: SELLER_TURN_INTENTS.RESOLVE_CUSTOMER_CONTEXT, confidence: 0.9 });
    effectiveIntents.push({ type: SELLER_TURN_INTENTS.RESOLVE_RELATIVE_DATETIME, confidence: 0.9 });
    if (!effectiveIntents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE)) {
      effectiveIntents.push({ type: SELLER_TURN_INTENTS.DRAFT_MESSAGE, confidence: 0.9 });
    }
  }

  const hasCommercial = uniqueFacts.some(
    (f) => f.factClass === SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE
      || f.factClass === SELLER_FACT_CLASS.OFFER_INSTRUCTION,
  );
  // Angehängtes Angebot + Konditionsänderung → Angebots-Update auch bei „schreib …“
  if (
    offerCtx?.offerId
    && hasCommercial
    && !effectiveIntents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER)
  ) {
    effectiveIntents.push({
      type: SELLER_TURN_INTENTS.PREPARE_OFFER,
      confidence: 0.9,
    });
  }

  // Bei Ambiguity oder mehrdeutiger Kundensuche keine Offer/Message-Ausführung
  if (ambiguousOfferOrMessage || leadResolve.ambiguous
    || (wantsAppointment && appointmentCustomer && !appointmentCustomer.resolved)) {
    effectiveIntents = effectiveIntents.filter((i) => (
      i.type !== SELLER_TURN_INTENTS.PREPARE_OFFER
      && i.type !== SELLER_TURN_INTENTS.DRAFT_MESSAGE
      && i.type !== SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT
    ));
    if ((leadResolve.ambiguous || (appointmentCustomer && !appointmentCustomer.resolved))
      && !effectiveIntents.some((i) => i.type === SELLER_TURN_INTENTS.FIND_CUSTOMER)) {
      effectiveIntents.push({ type: SELLER_TURN_INTENTS.FIND_CUSTOMER, confidence: 0.99 });
      effectiveIntents.push({ type: SELLER_TURN_INTENTS.RESOLVE_CUSTOMER_CONTEXT, confidence: 0.99 });
    }
  }

  // Intake/Reply/Multi-Source: keine parallele Nachrichten-/Angebotsvorbereitung vor Confirm
  if (inboundLead?.detected || customerReply?.detected) {
    effectiveIntents = effectiveIntents.filter((i) => (
      i.type !== SELLER_TURN_INTENTS.DRAFT_MESSAGE
      && i.type !== SELLER_TURN_INTENTS.PREPARE_OFFER
      && i.type !== SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT
    ));
  }

  const multiSourceCandidate = shouldBuildMultiSourceIntake({
    sellerInput: interpreted.normalized || interpreted.raw,
    attachments,
    facts: uniqueFacts,
  });
  if (multiSourceCandidate) {
    effectiveIntents = effectiveIntents.filter((i) => (
      i.type !== SELLER_TURN_INTENTS.DRAFT_MESSAGE
    ));
  }

  const preparedActions = enabled
    ? planSellerActions({
      lead: workingLead,
      sellerInput: interpreted.normalized,
      intents: effectiveIntents,
      inputMode: interpreted.inputMode,
      facts: uniqueFacts,
      missingInformation,
      currentOfferContext: offerCtx,
      resolvedCustomer: assistantContext.resolvedCustomer,
      workingContext: assistantContext.resolvedWorkingContext,
      workingContextItems,
      goldenMoment: assistantContext.goldenMoment,
      attachments,
      leadsSnapshot,
      pendingAppointment,
      now,
      calendarAvailability,
    })
    : [];

  // Customer-search results aus Resolve oder Find-Action
  const customerSearchAction = preparedActions.find((a) => (
    a.type === SELLER_TURN_INTENTS.FIND_CUSTOMER
    || a.type === SELLER_TURN_INTENTS.OPEN_CUSTOMER
    || a.type === SELLER_TURN_INTENTS.CUSTOMER_LOOKUP
  ));
  if (leadResolve.customerSearchResults?.length && customerSearchAction) {
    customerSearchAction.payload = {
      ...customerSearchAction.payload,
      customerSearchResults: leadResolve.customerSearchResults,
      status: leadResolve.ambiguous ? 'ambiguous' : (leadResolve.resolved ? 'unique' : customerSearchAction.payload?.status),
      resolvedLeadId: workingLead?.id || null,
      mutatesCustomer: false,
    };
  } else if (leadResolve.customerSearchResults?.length && !customerSearchAction
    && effectiveIntents.some((i) => (
      i.type === SELLER_TURN_INTENTS.FIND_CUSTOMER
      || i.type === SELLER_TURN_INTENTS.PREPARE_OFFER
    ))) {
    preparedActions.unshift({
      id: 'find_customer',
      type: SELLER_TURN_INTENTS.FIND_CUSTOMER,
      label: leadResolve.ambiguous ? 'Kunde auswählen' : 'Kunde gefunden',
      needsSellerConfirmation: false,
      status: 'prepared',
      toolId: 'find_customer',
      payload: {
        customerSearchResults: leadResolve.customerSearchResults,
        status: leadResolve.ambiguous ? 'ambiguous' : 'unique',
        resolvedLeadId: workingLead?.id || null,
        mutatesCustomer: false,
      },
    });
  }

  const todayOverview = preparedActions.find((a) => a.type === SELLER_TURN_INTENTS.GET_TODAY_OVERVIEW)
    ?.payload?.todayOverview
    || null;
  const draftMessageAction = preparedActions.find((a) => a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE);
  const groundedKnowledge = draftMessageAction?.payload?.knowledgeResult || null;
  const knowledgeResult = preparedActions.find((a) => a.type === SELLER_TURN_INTENTS.LOOKUP_VEHICLE_FACT)
    ?.payload?.knowledgeResult
    || (groundedKnowledge
      ? {
        ok: Boolean(groundedKnowledge.vehicleIdentity?.modelKey),
        modelKey: groundedKnowledge.vehicleIdentity?.modelKey,
        modelLabel: groundedKnowledge.vehicleIdentity?.modelLabel,
        factLabel: 'Fahrzeugwissen',
        displayValue: [
          groundedKnowledge.vehicleIdentity?.modelLabel,
          groundedKnowledge.vehicleIdentity?.trimLabel,
          groundedKnowledge.vehicleIdentity?.color,
        ].filter(Boolean).join(' · '),
        sourceLabel: 'verified_vehicle_data + seller_input',
        grounded: groundedKnowledge,
      }
      : null);

  const customerSummaryAction = preparedActions.find((a) => (
    a.type === SELLER_TURN_INTENTS.SUMMARIZE_CUSTOMER_CONTEXT
  ));
  const historyAction = preparedActions.find((a) => (
    a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY
    || a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_MESSAGES
    || a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_OFFERS
    || a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_ACTIVITIES
  ));
  const offerPrepareAction = preparedActions.find((a) => (
    a.type === SELLER_TURN_INTENTS.PREPARE_OFFER && a.status === 'prepared'
  ));
  const appointmentPrepareAction = preparedActions.find((a) => (
    a.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT
  ));
  const documentsPrepareAction = preparedActions.find((a) => (
    a.type === SELLER_TURN_INTENTS.REQUEST_DOCUMENTS && a.status === 'prepared'
  ));
  const contractImportAction = preparedActions.find((a) => (
    a.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT
  ));
  const contractSearchAction = preparedActions.find((a) => (
    a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_CONTRACTS
  ));
  const contractCompareAction = preparedActions.find((a) => (
    a.type === SELLER_TURN_INTENTS.COMPARE_CONTRACT_WITH_OFFER
  ));
  const resolvedDateTime = appointmentPrepareAction?.payload?.resolvedDateTime
    || preparedActions.find((a) => a.type === SELLER_TURN_INTENTS.RESOLVE_RELATIVE_DATETIME)
      ?.payload?.resolvedDateTime
    || null;

  const customerSearchResults = customerSearchAction?.payload?.customerSearchResults
    || (customerSummaryAction?.payload?.status === 'ambiguous_customer'
      ? customerSummaryAction?.payload?.customerSearchResults
      : null)
    || (historyAction?.payload?.status === 'ambiguous_customer'
      ? historyAction?.payload?.customerSearchResults
      : null)
    || contractSearchAction?.payload?.customerSearchResults
    || contractCompareAction?.payload?.customerSearchResults
    || (leadResolve.ambiguous ? leadResolve.customerSearchResults : null)
    || null;
  const customerSummary = customerSummaryAction?.payload?.customerSummary || null;
  const historySearchResults = historyAction?.payload?.historySearchResults
    || null;
  const searchResults = historySearchResults || customerSearchResults || null;

  const deferPersistence = Boolean(
    offerPrepareAction
    || preparedActions.some((a) => a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE)
    || appointmentPrepareAction
    || documentsPrepareAction
    || contractImportAction
    || contractSearchAction
    || contractCompareAction
    || todayOverview
    || knowledgeResult
    || groundedKnowledge
    || customerSummary
    || historySearchResults
    || (customerSearchResults && !offerPrepareAction),
  );

  const scope = scopeHint
    || (todayOverview ? 'dashboard' : null)
    || (workingLead?.id && appointmentPrepareAction ? 'customer' : null)
    || (knowledgeResult && !workingLead?.id ? 'global' : null)
    || ((customerSearchResults || customerSummary || historySearchResults || offerPrepareAction || groundedKnowledge || appointmentPrepareAction)
      && !lead?.id
      ? (appointmentPrepareAction && workingLead?.id ? 'contextual_global' : 'global')
      : null)
    || (workingLead?.id || lead?.id ? 'customer' : 'global');

  // Resolved customer from global search (ohne Akte zu mutieren)
  const resolvedFromSearch = workingLead?.id
    || customerSearchAction?.payload?.resolvedLeadId
    || customerSummaryAction?.payload?.resolvedLeadId
    || historyAction?.legacy?.resolvedCustomer?.id
    || null;
  if (resolvedFromSearch && assistantContext.resolvedCustomer) {
    assistantContext.resolvedCustomer = {
      ...assistantContext.resolvedCustomer,
      id: assistantContext.resolvedCustomer.id || resolvedFromSearch,
      name: workingLead?.contact?.name
        || customerSummary?.customerName
        || customerSearchResults?.[0]?.customerName
        || assistantContext.resolvedCustomer.name,
      source: assistantContext.resolvedCustomer.source || 'global_search',
      matched: true,
    };
  }

  const messageDraft = draftMessageAction?.payload?.messageDraft
    || appointmentPrepareAction?.payload?.messageDraft
    || documentsPrepareAction?.payload?.messageDraft
    || null;

  const sellerFacts = draftMessageAction?.payload?.sellerFacts
    || groundedKnowledge?.sellerFacts
    || [];

  const understanding = (() => {
    try {
      return buildCustomerUnderstanding(workingLead);
    } catch {
      return { verstaendnis: { labels: [], konditionen: [], openPoints: [], vehicles: [] } };
    }
  })();
  const profile = getNeedProfileFromLead(workingLead) || {};
  const knownLabels = buildUnderstoodLabels(profile);

  if (offerPrepareAction?.payload?.cashVsLeasingWarning) {
    warningsExtra.push(offerPrepareAction.payload.cashVsLeasingWarning);
  }
  if (Array.isArray(draftMessageAction?.payload?.warnings)) {
    warningsExtra.push(...draftMessageAction.payload.warnings);
  }
  if (Array.isArray(appointmentPrepareAction?.payload?.warnings)) {
    warningsExtra.push(...appointmentPrepareAction.payload.warnings);
  }
  if (Array.isArray(groundedKnowledge?.conflicts)) {
    for (const c of groundedKnowledge.conflicts) {
      if (c?.message) warningsExtra.push(c.message);
    }
  }

  const preparedAppointmentPayload = appointmentPrepareAction?.payload?.preparedAppointment || null;
  const offerGatheredInputs = uniqueFacts
    .filter((f) => f.factClass === 'offer_instruction' || f.field === 'vehicleInterest')
    .map((f) => ({ field: f.field, value: f.value }));
  const offerMissingInputs = missingInformation
    .filter((m) => m.forIntent === SELLER_TURN_INTENTS.PREPARE_OFFER)
    .map((m) => m.field);
  const pendingCreatedAt = new Date().toISOString();

  // Slice 15: Dual-pending – Angebot und Termin gemeinsam (Follow-ups wie „Lieber 16 Uhr“)
  const pendingAction = (offerPrepareAction && preparedAppointmentPayload)
    ? {
      type: 'offer_and_appointment',
      customerId: workingLead?.id
        || preparedAppointmentPayload.customerId
        || offerPrepareAction.payload?.customerId
        || null,
      gatheredInputs: offerGatheredInputs,
      missingInputs: offerMissingInputs,
      preparedOffer: offerPrepareAction.payload?.preparedOffer || null,
      preparedAppointment: preparedAppointmentPayload,
      messageDraft: appointmentPrepareAction.payload?.messageDraft || messageDraft,
      needsSellerConfirmation: true,
      createdAt: pendingCreatedAt,
    }
    : (offerPrepareAction
      ? {
        type: SELLER_TURN_INTENTS.PREPARE_OFFER,
        gatheredInputs: offerGatheredInputs,
        missingInputs: offerMissingInputs,
        createdAt: pendingCreatedAt,
        preparedOffer: offerPrepareAction.payload?.preparedOffer || null,
      }
      : (preparedAppointmentPayload
        ? {
          type: SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT,
          customerId: workingLead?.id || preparedAppointmentPayload.customerId,
          preparedAppointment: preparedAppointmentPayload,
          messageDraft: appointmentPrepareAction.payload?.messageDraft || messageDraft,
          createdAt: pendingCreatedAt,
        }
        : null));

  const offerHandoffBase = offerPrepareAction?.payload?.attachWorkingContext
    ? buildPreparedOfferWorkingContext({
      customerId: workingLead?.id || offerPrepareAction.payload?.customerId,
      customerName: workingLead?.contact?.name || offerPrepareAction.payload?.customerName,
      vehicleLabel: offerPrepareAction.payload?.vehicleLabel,
      model: offerPrepareAction.payload?.vehicle?.model,
      trim: offerPrepareAction.payload?.vehicle?.trim,
      offerType: offerPrepareAction.payload?.offerType || 'cash',
      purchasePrice: offerPrepareAction.payload?.purchasePrice,
      messageDraft: typeof messageDraft === 'string' ? messageDraft : messageDraft?.body,
    })
    : null;
  const appointmentHandoffBase = appointmentPrepareAction?.payload?.handoff
    ? {
      ...appointmentPrepareAction.payload.handoff,
      customerId: workingLead?.id
        || preparedAppointmentPayload?.customerId
        || null,
      customerName: workingLead?.contact?.name
        || preparedAppointmentPayload?.customerName
        || null,
    }
    : null;

  const handoffWorkingContext = (offerHandoffBase && preparedAppointmentPayload)
    ? {
      ...offerHandoffBase,
      kind: 'offer_and_appointment',
      dual: true,
      composerMode: appointmentHandoffBase?.composerMode || offerHandoffBase.composerMode || null,
      messageDraft: appointmentHandoffBase?.messageDraft
        || appointmentPrepareAction?.payload?.messageDraft
        || (typeof messageDraft === 'string' ? messageDraft : messageDraft?.body)
        || offerHandoffBase.preparedOffer?.messageDraft
        || null,
      preparedAppointment: preparedAppointmentPayload,
      editingMessageDraft: appointmentHandoffBase?.editingMessageDraft || null,
      draft: appointmentHandoffBase?.draft || appointmentHandoffBase?.messageDraft || null,
    }
    : (offerHandoffBase
      || appointmentHandoffBase
      || (draftMessageAction?.payload?.handoff
        ? {
          ...draftMessageAction.payload.handoff,
          customerId: workingLead?.id || draftMessageAction.payload.handoff.customerId || null,
          customerName: workingLead?.contact?.name
            || draftMessageAction.payload.handoff.recipient
            || null,
        }
        : null));

  // Missing package / vehicle clarification → missingInformation
  if (draftMessageAction?.payload?.groundedStatus === 'missing_package_knowledge') {
    missingInformation.push({
      id: 'exact_technology_package_contents',
      field: 'packageContents',
      label: 'Inhalt des Technologie-Pakets für diese Variante noch nicht eindeutig verifiziert',
      forIntent: SELLER_TURN_INTENTS.LOOKUP_VEHICLE_PACKAGE,
    });
  }
  if (draftMessageAction?.payload?.groundedStatus === 'needs_vehicle_clarification'
    || groundedKnowledge?.vehicleAmbiguity) {
    missingInformation.push({
      id: 'clarify_vehicle_for_knowledge',
      field: 'vehicleIdentity',
      label: groundedKnowledge?.vehicleAmbiguity?.question
        || draftMessageAction?.payload?.uiHint?.message
        || 'Für welches Fahrzeug / welche Variante gilt das?',
      forIntent: SELLER_TURN_INTENTS.RESOLVE_VEHICLE,
    });
  }

  const assistantReply = buildSellerAssistantReply({
    facts: uniqueFacts,
    missingInformation,
    preparedActions,
    inputMode: interpreted.inputMode,
  });

  const primaryIntent = effectiveIntents[0]?.type || SELLER_TURN_INTENTS.UNKNOWN;
  const warnings = [
    ...buildWarnings(uniqueFacts, interpreted.inputMode),
    ...warningsExtra,
  ];

  const interpretedGoal = buildInterpretedGoal({
    intents: effectiveIntents,
    facts: uniqueFacts,
    resolvedCustomer: assistantContext.resolvedCustomer,
  });

  const retrievedFacts = [
    ...preparedActions
      .filter((a) => a.payload?.retrieved)
      .map((a) => a.payload.retrieved),
    ...(draftMessageAction?.payload?.retrievedFacts || []),
    ...(groundedKnowledge?.facts || []),
  ];

  const turnPartial = {
    ok: Boolean(interpreted.normalized) && enabled,
    turnId: createTurnId(),
    scope,
    intent: primaryIntent,
    intents: effectiveIntents,
    inputMode: interpreted.inputMode,
    interpretedInput: {
      raw: interpreted.raw,
      normalized: interpreted.normalized,
      attachmentTypes: interpreted.attachmentTypes,
    },
    interpretedGoal,
    resolvedCustomer: assistantContext.resolvedCustomer,
    resolvedWorkingContext: assistantContext.resolvedWorkingContext
      || (handoffWorkingContext ? { attachedOffer: handoffWorkingContext } : null),
    extractedFacts: uniqueFacts,
    sellerFacts,
    retrievedFacts: [
      ...retrievedFacts,
      ...(knowledgeResult && !groundedKnowledge ? [knowledgeResult] : []),
    ],
    knowledgeResult,
    todayOverview,
    searchResults,
    customerSearchResults,
    historySearchResults,
    customerSummary,
    handoffWorkingContext,
    proposedUpdates: deferPersistence ? [] : proposedUpdates,
    missingInformation,
    resolvedDateTime,
    preparedAppointment: appointmentPrepareAction?.payload?.preparedAppointment || null,
    documentClassification: contractImportAction?.payload?.documentClassification || null,
    extractedContractFacts: contractImportAction?.payload?.extractedContractFacts || [],
    contractDraft: contractImportAction?.payload?.contractDraft || null,
    contractMemoryResult: contractSearchAction?.payload?.contractMemoryResult || null,
    contractOfferCompareResult: contractCompareAction?.payload?.contractOfferCompareResult || null,
    relevantCustomerContext: {
      knownLabels: knownLabels.slice(0, 12),
      commercialPreferences: (understanding?.verstaendnis?.konditionen ?? []).slice?.(0, 6)
        || [],
      vehicleInterest: uniqueFacts
        .filter((f) => f.field === 'vehicleInterest' || f.field === 'vehicleInterestMulti')
        .map((f) => f.label),
      currentOffer: offerCtx || null,
      notepadLabels: assistantContext.usedCustomerContext?.notepadLabels ?? [],
      customerNeeds: (understanding?.verstaendnis?.labels || []).slice(0, 6),
    },
    usedCustomerContext: {
      ...(assistantContext.usedCustomerContext || {}),
      customerId: workingLead?.id || null,
      customerName: workingLead?.contact?.name || null,
      labels: (understanding?.verstaendnis?.labels || []).slice(0, 8),
      loaded: Boolean(workingLead?.id),
    },
    preparedActions,
    messageDraft,
    warnings,
    assistantReply,
    confidence: interpreted.confidence,
    evidence: [
      ...buildEvidenceFromTurn({
        facts: uniqueFacts,
        preparedActions,
        retrievedFacts,
      }),
      ...(appointmentPrepareAction?.payload?.evidence || []),
      ...(contractImportAction?.payload?.evidence || []),
    ],
    pendingAction,
    currentOfferContext: offerCtx || null,
    homepageInquiry: interpreted.homepageInquiry ?? null,
    inboundLead,
    customerReply,
    multiSourceIntake: null,
    goldenMoment: assistantContext.goldenMoment ?? null,
    uiEffects: {
      capturedFacts: uniqueFacts
        .filter((f) => !f.needsConfirmation)
        .map((f) => ({ label: f.label, factClass: f.factClass })),
      progressLines: [
        todayOverview
          ? 'Clever prüft Ihre heutigen Vorgänge …'
          : null,
        (workingLead?.id || customerSearchResults?.length)
          && (offerPrepareAction || groundedKnowledge || messageDraft || appointmentPrepareAction || documentsPrepareAction)
          ? `✓ ${workingLead?.contact?.name || customerSearchResults?.[0]?.customerName || 'Kunde'} ${appointmentPrepareAction ? 'erkannt' : 'gefunden'}`
          : (customerSearchResults
            ? 'Clever sucht in Ihren Kunden …'
            : null),
        documentsPrepareAction?.payload?.sellerSummary
          ? `✓ ${documentsPrepareAction.payload.sellerSummary}`
          : (documentsPrepareAction && !documentsPrepareAction.payload?.complete
            ? '✓ Fehlende Unterlagen erkannt'
            : null),
        customerReply?.detected
          ? (customerReply.matchedLeadName
            ? `✓ ${customerReply.matchedLeadName} – Kundenantwort erkannt`
            : '○ Kundenantwort erkannt – Kunde zuordnen')
          : (inboundLead?.detected
            ? (inboundLead.proposeCreateCustomer
              ? '○ Erkannt als neue Anfrage – Kundenakte anlegen?'
              : (inboundLead.matchedLeadName
                ? `✓ Erkannt: ${inboundLead.matchedLeadName}`
                : inboundLead.resolutionStatus === 'ambiguous'
                  ? '○ Erkannt, aber unsicher – bitte Kunde wählen'
                  : 'Clever liest die Kundenanfrage …'))
            : null),
        resolvedDateTime?.ok
          ? `✓ ${resolvedDateTime.dateLabel || resolvedDateTime.whenLabel || 'Datum'} aufgelöst`
          : null,
        resolvedDateTime?.ok && resolvedDateTime.timeLabel
          ? `✓ ${resolvedDateTime.timeLabel} Uhr erkannt`
          : null,
        appointmentPrepareAction?.payload?.preparedAppointment?.vehicleContext?.label
          ? `✓ ${String(appointmentPrepareAction.payload.preparedAppointment.vehicleContext.label).replace(/^Kia\s+/i, '')}-Kontext übernommen`
          : null,
        (() => {
          const avail = appointmentPrepareAction?.payload?.availabilityStatus;
          if (!avail || avail === 'not_checked' || avail === 'seller_claimed') {
            return appointmentPrepareAction ? '○ Kalender noch nicht geprüft' : null;
          }
          if (avail === 'available') return '✓ Kalender: verfügbar';
          if (avail === 'busy') return '○ Kalender: belegt';
          if (avail === 'unknown') return '○ Kalender: unbekannt';
          if (avail === 'error') return '○ Kalenderprüfung fehlgeschlagen';
          return null;
        })(),
        contractImportAction?.payload?.contractDraft
          ? `✓ ${contractImportAction.payload.documentClassification === 'leasing_contract' ? 'Leasingvertrag' : 'Vertrag'} erkannt`
          : null,
        contractImportAction?.payload?.contractDraft?.vehicle?.label
          ? `✓ ${contractImportAction.payload.contractDraft.vehicle.label} übernommen`
          : null,
        contractImportAction?.payload?.contractDraft?.contractEndDate
          ? `✓ Vertragsende ${contractImportAction.payload.contractDraft.contractEndDate} extrahiert`
          : null,
        contractSearchAction?.payload?.contractMemoryResult
          ? `✓ Vertrag ${contractSearchAction.payload.contractMemoryResult.customerName || ''} nachgeschlagen`.trim()
          : (contractSearchAction?.payload?.status === 'no_contract'
            ? '○ Kein Altvertrag hinterlegt'
            : null),
        contractCompareAction?.payload?.contractOfferCompareResult
          ? '✓ Vertrag mit Angebot verglichen'
          : (contractCompareAction?.payload?.status === 'no_contract'
            ? '○ Kein Altvertrag hinterlegt'
            : (contractCompareAction?.payload?.status === 'no_offer'
              ? '○ Kein Angebot zum Vergleich'
              : null)),
        groundedKnowledge?.vehicleIdentity?.modelKey
          ? `✓ ${[
            groundedKnowledge.vehicleIdentity.modelLabel || groundedKnowledge.vehicleIdentity.modelKey,
            groundedKnowledge.vehicleIdentity.trimLabel || groundedKnowledge.vehicleIdentity.trimId,
          ].filter(Boolean).join(' ')} erkannt`
          : (offerPrepareAction && uniqueFacts.find((f) => f.field === 'vehicleInterest')?.label
            ? `✓ ${uniqueFacts.find((f) => f.field === 'vehicleInterest').label} erkannt`
            : null),
        sellerFacts.length
          ? '✓ Seller Facts übernommen'
          : null,
        groundedKnowledge?.verifiedPackageFacts
          ? '✓ Technologie-Paket geprüft'
          : (effectiveIntents.some((i) => i.type === SELLER_TURN_INTENTS.LOOKUP_VEHICLE_PACKAGE)
            ? 'Technologie-Paket geprüft'
            : null),
        groundedKnowledge?.verifiedEquipmentFacts
          ? '✓ Ausstattung geladen'
          : (effectiveIntents.some((i) => i.type === SELLER_TURN_INTENTS.LOOKUP_VEHICLE_EQUIPMENT)
            ? 'Ausstattung geladen'
            : null),
        knowledgeResult && !groundedKnowledge
          ? 'Clever sucht in den verifizierten Fahrzeugdaten …'
          : null,
        offerPrepareAction && uniqueFacts.find((f) => f.field === 'purchasePrice')
          ? `✓ ${uniqueFacts.find((f) => f.field === 'purchasePrice').label} erkannt`
          : (uniqueFacts.find((f) => f.field === 'purchasePrice')?.label || null),
        offerPrepareAction && workingLead?.id
          ? '✓ Kundenwünsche geladen'
          : (customerSummary
            ? 'Clever liest den Kundenkontext …'
            : null),
        historySearchResults
          ? 'Clever durchsucht die Kundenhistorie …'
          : null,
        offerPrepareAction && messageDraft
          ? '✓ Angebot und Nachricht vorbereitet'
          : null,
        appointmentPrepareAction?.status === 'prepared' && messageDraft
          ? '✓ Terminvorschlag und Nachricht vorbereitet'
          : null,
        !offerPrepareAction && !appointmentPrepareAction && messageDraft
          ? '✓ Nachricht vorbereitet'
          : null,
        !offerPrepareAction && preparedActions.some((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER)
          ? 'Angebot vorbereitet'
          : null,
        knowledgeResult?.ok && !groundedKnowledge
          ? `${knowledgeResult.factLabel || 'Fakt'} verifiziert`
          : (knowledgeResult && !groundedKnowledge ? 'Keine sichere Quelle' : null),
        todayOverview
          ? `${todayOverview.itemCount || 0} Vorgänge gefunden`
          : null,
        assistantContext.resolvedWorkingContext?.attachedDocument?.label
          ? `Dokument: ${assistantContext.resolvedWorkingContext.attachedDocument.label}`
          : null,
        assistantContext.goldenMoment?.headline && !todayOverview && !offerPrepareAction && !groundedKnowledge && !appointmentPrepareAction
          ? 'Nächster Schritt erkannt'
          : null,
      ].filter(Boolean),
    },
    featureEnabled: enabled,
    openaiEscalation,
    interpreterDiagnostics: interpreterDiagnostics || {
      interpreterSource: 'deterministic',
      responseId: null,
      model: null,
      reason: null,
      latencyMs: null,
      used: false,
    },
    autoSent: false,
    autoBooked: false,
  };

  if (multiSourceCandidate || multiSourceIntakeOverride?.detected) {
    const safeAttachments = attachments.map((a) => {
      if (!a?.extractedText) return a;
      const minimized = minimizeSensitiveOcrText(a.extractedText);
      return {
        ...a,
        extractedText: minimized?.text ?? a.extractedText,
      };
    });
    const intake = multiSourceIntakeOverride?.detected
      ? multiSourceIntakeOverride
      : buildMultiSourceIntake({
        sellerInput: interpreted.normalized || interpreted.raw,
        attachments: safeAttachments,
        facts: uniqueFacts,
        lead: workingLead,
        now: now || Date.now(),
      });
    turnPartial.multiSourceIntake = intake;
    if (intake?.missingInformation?.length) {
      turnPartial.missingInformation = [
        ...(turnPartial.missingInformation || []),
        ...intake.missingInformation.filter((m) => (
          !(turnPartial.missingInformation || []).some((x) => x.id === m.id)
        )),
      ];
    }
    const attachmentCount = Array.isArray(attachments) ? attachments.length : 0;
    const multiSourceProgress = buildMultiSourceProgressLines(intake, { attachmentCount });
    turnPartial.uiEffects = {
      ...turnPartial.uiEffects,
      progressLines: [
        ...multiSourceProgress,
        ...(turnPartial.uiEffects?.progressLines || []),
      ].filter(Boolean),
    };
  }

  const reviewModel = shouldShowUniversalReview(turnPartial)
    ? buildUniversalReviewModel(turnPartial)
    : null;

  return buildCleverSellerTurnResult({
    ...turnPartial,
    reviewModel,
  });
}

/**
 * Sync / deterministisch (Default für UI-Debounce).
 * @param {object} params
 */
export function runCleverSellerTurn({
  lead = {},
  sellerInput = '',
  attachments = [],
  conversationContext = null,
  currentOfferContext = null,
  sellerContext = null,
  workingContextItems = [],
  customerName = '',
  leadsSnapshot = [],
  scopeHint = null,
  appContext = null,
  pendingAction = null,
  now = null,
  calendarAvailability = null,
  env = typeof process !== 'undefined' ? process.env : {},
} = {}) {
  void conversationContext;
  void sellerContext;

  const interpreted = interpretSellerInput(sellerInput, { attachments, lead });
  return finalizeSellerTurn({
    lead,
    interpreted,
    facts: interpreted.facts,
    intents: interpreted.intents,
    env,
    openaiEscalation: null,
    interpreterDiagnostics: {
      interpreterSource: 'deterministic',
      responseId: null,
      model: null,
      reason: null,
      latencyMs: null,
      used: false,
    },
    currentOfferContext,
    workingContextItems,
    customerName,
    attachments,
    leadsSnapshot,
    scopeHint,
    appContext,
    pendingAction: pendingAction || appContext?.pendingAction || null,
    now: now || appContext?.now || null,
    calendarAvailability: calendarAvailability || appContext?.calendarAvailability || null,
  });
}

/**
 * Async: deterministisch + optionale OpenAI-Eskalation (Facts oder Multi-Source).
 * @param {object} params
 * @param {{
 *   fetchImpl?: typeof fetch,
 *   apiKey?: string|null,
 *   forceEscalate?: boolean,
 *   createResponse?: Function,
 *   model?: string,
 * }} [params.openAiOptions]
 */
export async function runCleverSellerTurnAsync({
  lead = {},
  sellerInput = '',
  attachments = [],
  env = typeof process !== 'undefined' ? process.env : {},
  openAiOptions = {},
  currentOfferContext = null,
  workingContextItems = [],
  customerName = '',
  leadsSnapshot = [],
  scopeHint = null,
  appContext = null,
  pendingAction = null,
  now = null,
  calendarAvailability = null,
} = {}) {
  const interpreted = interpretSellerInput(sellerInput, { attachments, lead });
  const gate = openAiOptions.forceEscalate
    ? {
      shouldEscalate: true,
      reason: 'forced',
      path: evaluateComplexSellerTurn({
        sellerInput: interpreted.normalized || sellerInput,
        attachments,
        facts: interpreted.facts,
      }).isComplex
        ? 'multi_source'
        : 'facts',
      complexity: evaluateComplexSellerTurn({
        sellerInput: interpreted.normalized || sellerInput,
        attachments,
        facts: interpreted.facts,
      }),
    }
    : evaluateSellerInterpretEscalation({
      ...interpreted,
      sellerInput,
      facts: interpreted.facts,
    }, env, { attachments, sellerInput });

  const baseFinalize = (extra = {}) => finalizeSellerTurn({
    lead,
    interpreted,
    facts: interpreted.facts,
    intents: interpreted.intents,
    env,
    currentOfferContext,
    workingContextItems,
    customerName,
    attachments,
    leadsSnapshot,
    scopeHint,
    appContext,
    pendingAction: pendingAction || appContext?.pendingAction || null,
    now: now || appContext?.now || null,
    calendarAvailability: calendarAvailability || appContext?.calendarAvailability || null,
    ...extra,
  });

  if (!gate.shouldEscalate) {
    return baseFinalize({
      openaiEscalation: { used: false, reason: gate.reason },
      interpreterDiagnostics: {
        interpreterSource: 'deterministic',
        responseId: null,
        model: null,
        attachmentCount: Array.isArray(attachments) ? attachments.length : 0,
        attachmentContextMode: 'none',
        complexityReasons: gate.complexity?.complexityReasons || [],
        schemaValid: null,
        validatorWarningsCount: 0,
        toolCalls: 0,
        fallbackReason: null,
        durationMs: null,
        reason: gate.reason,
        latencyMs: null,
        used: false,
      },
    });
  }

  // --- Multi-Source OpenAI path (OpenAI = primäres Sprachverständnis) ---
  if (gate.path === 'multi_source') {
    const complexityReasons = gate.complexity?.complexityReasons
      || evaluateComplexSellerTurn({
        sellerInput: interpreted.normalized || sellerInput,
        attachments,
        facts: interpreted.facts,
      }).complexityReasons
      || [];
    const safeAttachments = (attachments || []).map((a) => {
      if (!a?.extractedText) return a;
      const minimized = minimizeSensitiveOcrText(a.extractedText);
      return { ...a, extractedText: minimized?.text ?? a.extractedText };
    });
    const baselineIntake = buildMultiSourceIntake({
      sellerInput: interpreted.normalized || sellerInput,
      attachments: safeAttachments,
      facts: interpreted.facts,
      lead,
      now: now || Date.now(),
    });
    const safeContext = buildSellerInterpretSafeContext(lead, {
      sellerInput: interpreted.normalized || sellerInput,
      attachmentTypes: interpreted.attachmentTypes,
      attachments: safeAttachments,
      deterministic: interpreted,
      includeAttachmentExcerpts: true,
    });

    const buildMsDiagnostics = (partial = {}) => ({
      interpreterSource: partial.interpreterSource || 'fallback',
      responseId: partial.responseId ?? null,
      model: partial.model ?? null,
      attachmentCount: Array.isArray(attachments) ? attachments.length : 0,
      attachmentContextMode: partial.attachmentContextMode || 'none',
      complexityReasons,
      schemaValid: partial.schemaValid ?? null,
      validatorWarningsCount: partial.validatorWarningsCount ?? 0,
      toolCalls: partial.toolCalls ?? 0,
      fallbackReason: partial.fallbackReason ?? null,
      durationMs: partial.durationMs ?? partial.latencyMs ?? null,
      latencyMs: partial.latencyMs ?? partial.durationMs ?? null,
      reason: gate.reason,
      used: Boolean(partial.used),
      error: partial.error ?? null,
    });

    let aiMs;
    try {
      aiMs = await interpretMultiSourceWithOpenAi(safeContext, {
        apiKey: openAiOptions.apiKey,
        model: openAiOptions.model,
        createResponse: openAiOptions.createResponse,
        runStructured: openAiOptions.runStructured,
        OpenAI: openAiOptions.OpenAI,
        baselineIntake,
        sellerInput: interpreted.normalized || sellerInput,
        attachments: safeAttachments,
        facts: interpreted.facts,
        lead,
        now: now || Date.now(),
        routeScope: scopeHint || appContext?.routeContext?.scope || null,
        workingContext: workingContextItems,
        customerRefId: lead?.id || null,
      });
    } catch (err) {
      return baseFinalize({
        multiSourceIntakeOverride: baselineIntake,
        warningsExtra: [
          'Clever konnte den gesamten Fall nicht vollständig mit dem Sprachmodell interpretieren. Bitte prüfen Sie die erkannten Angaben.',
        ],
        openaiEscalation: {
          used: false,
          reason: gate.reason,
          error: err?.message || 'openai_error',
          interpreterSource: 'fallback',
        },
        interpreterDiagnostics: buildMsDiagnostics({
          interpreterSource: 'fallback',
          fallbackReason: err?.message || 'openai_error',
          error: err?.message || 'openai_error',
          used: false,
          attachmentContextMode: attachments?.length ? 'minimized_text' : 'none',
        }),
      });
    }

    const diagnostics = buildMsDiagnostics({
      interpreterSource: aiMs.interpreterSource || (aiMs.ok ? 'openai' : 'fallback'),
      responseId: aiMs.responseId || null,
      model: aiMs.model || null,
      latencyMs: aiMs.latencyMs ?? null,
      durationMs: aiMs.durationMs ?? aiMs.latencyMs ?? null,
      attachmentContextMode: aiMs.attachmentContextMode || 'none',
      schemaValid: aiMs.schemaValid ?? null,
      validatorWarningsCount: aiMs.validatorWarningsCount ?? 0,
      toolCalls: aiMs.toolCalls ?? 0,
      fallbackReason: aiMs.ok ? null : (aiMs.fallbackReason || aiMs.error || 'openai_failed'),
      used: Boolean(aiMs.ok),
      error: aiMs.ok ? null : (aiMs.error || null),
    });

    return baseFinalize({
      multiSourceIntakeOverride: aiMs.intake || baselineIntake,
      warningsExtra: aiMs.ok
        ? ['Semantische Interpretation – bitte in der Review prüfen.']
        : [
          'Clever konnte den gesamten Fall nicht vollständig mit dem Sprachmodell interpretieren. Bitte prüfen Sie die erkannten Angaben.',
        ],
      openaiEscalation: {
        used: Boolean(aiMs.ok),
        reason: gate.reason,
        path: 'multi_source',
        responseId: diagnostics.responseId,
        model: diagnostics.model,
        latencyMs: diagnostics.latencyMs,
        interpreterSource: diagnostics.interpreterSource,
        error: diagnostics.error,
      },
      interpreterDiagnostics: diagnostics,
    });
  }

  // --- Schwache Facts-Eskalation (bestehend) ---
  const safeContext = buildSellerInterpretSafeContext(lead, {
    sellerInput: interpreted.normalized || sellerInput,
    attachmentTypes: interpreted.attachmentTypes,
    attachments,
    deterministic: interpreted,
    includeAttachmentExcerpts: false,
  });

  let ai;
  try {
    ai = await interpretSellerInputWithOpenAi(safeContext, openAiOptions);
  } catch (err) {
    return baseFinalize({
      warningsExtra: ['OpenAI-Eskalation fehlgeschlagen – nur Regel-Interpretation.'],
      openaiEscalation: {
        used: false,
        reason: gate.reason,
        error: err?.message || 'openai_error',
        interpreterSource: 'fallback',
      },
      interpreterDiagnostics: {
        interpreterSource: 'fallback',
        responseId: null,
        model: null,
        attachmentCount: Array.isArray(attachments) ? attachments.length : 0,
        attachmentContextMode: 'none',
        complexityReasons: gate.complexity?.complexityReasons || [],
        schemaValid: null,
        validatorWarningsCount: 0,
        toolCalls: 0,
        fallbackReason: err?.message || 'openai_error',
        durationMs: null,
        reason: gate.reason,
        latencyMs: null,
        used: false,
        error: err?.message || 'openai_error',
      },
    });
  }

  if (!ai?.ok) {
    return baseFinalize({
      warningsExtra: ['OpenAI nicht verfügbar – nur Regel-Interpretation.'],
      openaiEscalation: {
        used: false,
        reason: gate.reason,
        error: ai?.error || 'openai_failed',
        interpreterSource: 'fallback',
      },
      interpreterDiagnostics: {
        interpreterSource: 'fallback',
        responseId: null,
        model: null,
        attachmentCount: Array.isArray(attachments) ? attachments.length : 0,
        attachmentContextMode: 'none',
        complexityReasons: gate.complexity?.complexityReasons || [],
        schemaValid: null,
        validatorWarningsCount: 0,
        toolCalls: 0,
        fallbackReason: ai?.error || 'openai_failed',
        durationMs: null,
        reason: gate.reason,
        latencyMs: null,
        used: false,
        error: ai?.error || 'openai_failed',
      },
    });
  }

  const facts = mergeSellerInterpretation(interpreted.facts, ai.facts);
  const intents = mergeSellerIntents(interpreted.intents, ai.intents);
  const confidence = Math.max(interpreted.confidence || 0, ai.confidence || 0);

  return finalizeSellerTurn({
    lead,
    interpreted: { ...interpreted, confidence },
    facts,
    intents,
    env,
    warningsExtra: ['OpenAI hat ergänzt – bitte in der Review prüfen.'],
    openaiEscalation: {
      used: true,
      reason: gate.reason,
      path: 'facts',
      aiFactCount: ai.facts.length,
      interpreterSource: 'openai',
    },
    interpreterDiagnostics: {
      interpreterSource: 'openai',
      responseId: null,
      model: null,
      reason: gate.reason,
      latencyMs: null,
      used: true,
    },
    currentOfferContext,
    workingContextItems,
    customerName,
    attachments,
    leadsSnapshot,
    scopeHint,
    appContext,
    pendingAction: pendingAction || appContext?.pendingAction || null,
    now: now || appContext?.now || null,
    calendarAvailability: calendarAvailability || appContext?.calendarAvailability || null,
  });
}

function buildWarnings(facts, inputMode) {
  const warnings = [];
  if (facts.some((f) => f.needsConfirmation)) {
    warnings.push('Mindestens ein Wert braucht kurze Bestätigung.');
  }
  if (inputMode === 'ambiguous') {
    warnings.push('Unklar, ob Kundennachricht oder interne Arbeitsnotiz.');
  }
  if (facts.some((f) => f.field === 'vehicleInterestMulti')) {
    warnings.push('Mehrere Modellinteressen – nicht automatisch auf eines reduziert.');
  }
  return warnings;
}

/**
 * Orchestrator + optionaler Kalender-Check (Flag / window.__cleverCalendarProvider).
 * Ohne Provider: identisch zu runCleverSellerTurn (availabilityStatus: not_checked).
 * Kein Auto-Booking – nur Status für Review.
 *
 * @param {object} params – wie runCleverSellerTurn, plus:
 *   calendarProvider?, windowRef?, skipCalendarCheck?
 */
export async function runCleverSellerTurnWithCalendar(params = {}) {
  const {
    calendarProvider: injectedProvider,
    windowRef = null,
    skipCalendarCheck = false,
    stubOptions = undefined,
    openAiOptions = {},
    forceAsyncInterpret = false,
    ...rest
  } = params;

  const complexity = evaluateComplexSellerTurn({
    sellerInput: rest.sellerInput,
    attachments: rest.attachments || [],
  });
  const preferAsync = Boolean(
    forceAsyncInterpret
    || (complexity.isComplex && isCleverSellerOpenAiInterpretEnabled(rest.env))
    || openAiOptions?.forceEscalate
  );

  const executeTurn = async (turnParams) => {
    if (preferAsync) {
      return runCleverSellerTurnAsync({
        ...turnParams,
        openAiOptions,
      });
    }
    return runCleverSellerTurn(turnParams);
  };

  let calendarAvailability = rest.calendarAvailability
    ?? rest.appContext?.calendarAvailability
    ?? null;

  if (skipCalendarCheck || calendarAvailability) {
    return executeTurn({ ...rest, calendarAvailability });
  }

  const provider = injectedProvider !== undefined
    ? injectedProvider
    : resolveCleverCalendarProvider({
      env: rest.env,
      windowRef,
      stubOptions,
    });

  if (!provider) {
    return executeTurn(rest);
  }

  const draftTurn = await executeTurn(rest);
  const appt = draftTurn.preparedAppointment
    || (draftTurn.preparedActions || []).find((a) => (
      a.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT
    ))?.payload?.preparedAppointment
    || null;

  if (!appt?.startsAt) {
    return draftTurn;
  }

  calendarAvailability = await checkCalendarAvailability({
    provider,
    startsAt: appt.startsAt,
    durationMinutes: appt.durationMinutes
      || getAppointmentDurationMinutes(appt.appointmentType),
    lead: draftTurn.resolvedCustomer || rest.lead || null,
    title: appt.appointmentTypeLabel || null,
    alternativeSlots: appt.alternativeSlots || [],
  });

  return executeTurn({
    ...rest,
    calendarAvailability,
  });
}

export { interpretSellerInput } from './interpretSellerInput.js';
export {
  isCleverSellerOrchestratorEnabled,
  isCleverSellerOpenAiInterpretEnabled,
  evaluateSellerInterpretEscalation,
  shouldEscalateSellerInterpretation,
  evaluateComplexSellerTurn,
  shouldUseSemanticInterpreter,
} from './cleverSellerOrchestratorConfig.js';
