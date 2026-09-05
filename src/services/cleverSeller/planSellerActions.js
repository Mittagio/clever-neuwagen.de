/**
 * Action Planner – verbindet Intents mit Tool Registry (bestehende CRM-Services).
 * EXECUTE passiert erst nach Seller-Bestätigung.
 */
import { SELLER_FACT_CLASS, SELLER_INPUT_MODE, SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { runTool } from './toolRegistry.js';
import { buildCustomerUnderstanding } from '../dealer/customerUnderstanding.js';
import { validateCustomerMessageNotSellerCommand } from './validateSellerCommandMessage.js';
import { prepareGroundedCustomerMessageSync } from './prepareGroundedCustomerMessageSync.js';
import { resolveGroundedVehicleKnowledge } from './resolveGroundedVehicleKnowledge.js';
import { prepareContextualAppointmentProposal, isAppointmentFollowUpInput } from './prepareContextualAppointmentProposal.js';
import { resolveRelativeDateTime } from './resolveRelativeDateTime.js';
import { prepareCustomerContractImport } from './prepareCustomerContractImport.js';
import { searchCustomerContracts } from './searchCustomerContracts.js';
import { compareContractWithOffer } from './compareContractWithOffer.js';
import { draftContractCompareCustomerMessage } from './draftContractCompareCustomerMessage.js';
import {
  buildMagicAkteContext,
  detectChipIntent,
} from '../crm/magic/buildMagicAkteContext.js';
import { isSellerOfferMailShorthand } from '../crm/magic/generateCleverCustomerMessage.js';
import { deriveContactIdentity } from '../dealer/customerContactIdentity.js';
import {
  OFFER_MUTATION_MODE,
  OFFER_VEHICLE_TARGET_STATUS,
  resolveOfferVehicleTarget,
  isModelOnlyOfferCue,
} from './offerVehicleIdentity.js';
import {
  resolveBatchOfferTracks,
} from './batchOfferTrackScope.js';
import {
  isBatchOfferCue,
  hasCommercialOfferSlots,
  isBareOrGenericOfferCue,
} from './commercialOfferNl.js';
import {
  RATE_AUTHORITY,
  extractAuthoritativeOfferRateFromFacts,
  resolveAuthoritativeOfferMonthlyRate,
  stripNonAuthoritativeOfferRates,
} from './captureThenOffer.js';
import { enrichPrepareOfferPayloadWithIdentityDraft } from './vehicleIdentityDraft.js';
import {
  shouldMutateExistingOfferDraft,
  mutateActiveOfferDraft,
  buildMutatedPrepareOfferPayload,
  isMessageRewriteCue,
  isMessageSendCue,
  rewriteMessageBody,
  resolveActiveMessageDraft,
} from './cleverWorkingDraft.js';
import {
  mergePdfIntoActiveOfferDraft,
  shouldRefineActiveOfferFromPdf,
} from './offerDraftIntakeMerge.js';

function salutationName(customerName, facts, lead) {
  const identity = deriveContactIdentity(
    lead?.contact || {},
    customerName
      || facts.find((f) => f.field === 'customerName')?.value
      || lead?.contact?.name
      || lead?.name
      || '',
  );
  if (identity.salutation && identity.lastName) {
    return `${identity.salutation} ${identity.lastName}`;
  }
  if (identity.firstName && identity.lastName) {
    return `${identity.firstName} ${identity.lastName}`;
  }
  const name = customerName
    || facts.find((f) => f.field === 'customerName')?.value
    || lead?.contact?.name
    || '';
  if (!name || /^kunde(\s*\(offen\))?$/i.test(String(name).trim())) return 'Kunde';
  if (/^(herr|frau)\b/i.test(name)) return name;
  if (/\s/.test(String(name).trim())) return String(name).trim();
  // Einzelname ohne Anrede → kein „Herr Aalen“
  return 'Kunde';
}

function messageGreetingLine(customerName, facts, lead) {
  const target = salutationName(customerName, facts || [], lead);
  return target === 'Kunde' ? 'Guten Tag,' : `Hallo ${target},`;
}

function buildOfferMessageDraft({
  lead,
  sellerInput,
  facts,
  customerName,
  offerPayload = null,
}) {
  void sellerInput;
  const purchase = facts.find((f) => f.field === 'purchasePrice');
  const vehicle = facts.find((f) => f.field === 'vehicleInterest');
  const transmission = facts.find((f) => f.field === 'transmissionPreference');
  const discount = facts.find((f) => f.field === 'discountPercent');
  const vehicleLabel = offerPayload?.vehicleLabel
    || vehicle?.label
    || 'das gewünschte Fahrzeug';
  const monthlyRate = offerPayload?.monthlyRate != null
    ? Number(offerPayload.monthlyRate)
    : null;
  const priceLabel = purchase
    ? `${Number(purchase.value).toLocaleString('de-DE')} €`
    : (monthlyRate != null && Number.isFinite(monthlyRate)
      ? `${monthlyRate.toLocaleString('de-DE')} €/Monat`
      : null);

  const labels = [];
  try {
    const u = buildCustomerUnderstanding(lead);
    for (const l of (u?.verstaendnis?.labels ?? []).slice(0, 4)) {
      if (l) labels.push(String(l));
    }
  } catch {
    /* ignore */
  }

  const detailBits = [];
  if (transmission?.label || /automatik/i.test(vehicleLabel)) {
    detailBits.push(transmission?.label || 'Automatik');
  }
  if (discount?.label) detailBits.push(discount.label);

  const lines = [
    messageGreetingLine(customerName, facts, lead),
    '',
    `anbei erhalten Sie das gewünschte Angebot für den ${vehicleLabel}`
      + (detailBits.length ? ` (${detailBits.join(', ')})` : '')
      + '.',
  ];
  if (priceLabel) {
    const isCash = /cash|purchase|kauf/i.test(String(offerPayload?.paymentType || offerPayload?.offerType || ''))
      || Boolean(purchase);
    lines.push(
      '',
      isCash
        ? `Der Kaufpreis für das Fahrzeug liegt bei ${priceLabel}.`
        : `Die Kondition: ${priceLabel}.`,
    );
  }
  const term = offerPayload?.termMonths ?? lead?.wish?.termMonths;
  const km = offerPayload?.mileagePerYear ?? lead?.wish?.mileagePerYear;
  const down = offerPayload?.downPayment ?? lead?.wish?.downPayment;
  if (term || km != null || down != null) {
    const cond = [
      term ? `${term} Monate` : null,
      km != null ? `${Number(km).toLocaleString('de-DE')} km/Jahr` : null,
      down != null ? `${Number(down) === 0 ? '0 €' : `${Number(down).toLocaleString('de-DE')} €`} AZ` : null,
    ].filter(Boolean);
    if (cond.length) lines.push('', `Basis: ${cond.join(' · ')}.`);
  }
  if (labels.some((l) => /hund/i.test(l))) {
    lines.push(
      '',
      'Da Ihnen auch ausreichend Platz für Ihren Hund wichtig ist, können wir uns das Fahrzeug gerne gemeinsam vor Ort ansehen und prüfen, ob es für Ihre Anforderungen gut passt.',
    );
  } else if (labels.length) {
    lines.push(
      '',
      `Dabei berücksichtige ich, was uns wichtig war: ${labels.slice(0, 3).join(', ')}.`,
    );
  }
  lines.push('', 'Viele Grüße');
  return lines.join('\n');
}

/** Neutraler Zwischenentwurf – nur wenn Angebot noch unvollständig (Rate fehlt). */
function buildOfferPendingInterimDraft({ lead, facts, customerName, offerPayload = null }) {
  const vehicle = facts.find((f) => f.field === 'vehicleInterest');
  const vehicleLabel = offerPayload?.vehicleLabel || vehicle?.label || 'Ihr Wunschfahrzeug';
  return [
    messageGreetingLine(customerName, facts, lead),
    '',
    `ich bereite das gewünschte Angebot für den ${vehicleLabel} aktuell für Sie vor`,
    'und sende es Ihnen, sobald die Kalkulation vollständig ist.',
    '',
    'Viele Grüße',
  ].join('\n');
}

/** Kundennachricht bei Anpassung eines angehängten Angebots (km, Laufzeit, Rate, …). */
function buildOfferUpdateMessageDraft({
  lead,
  facts = [],
  customerName,
  currentOfferContext = null,
}) {
  const offerLabel = currentOfferContext?.title
    || currentOfferContext?.summary
    || 'Ihr Angebot';
  const changeBits = facts
    .filter((f) => (
      f.field === 'annualMileage'
      || f.field === 'termMonths'
      || f.field === 'desiredRate'
      || f.field === 'downPayment'
      || f.factClass === SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE
      || f.factClass === SELLER_FACT_CLASS.OFFER_INSTRUCTION
    ))
    .map((f) => String(f.label || '').trim())
    .filter(Boolean);

  const lines = [
    messageGreetingLine(customerName, facts, lead),
    '',
    `wie besprochen habe ich das Angebot (${offerLabel}) angepasst.`,
  ];
  if (changeBits.length) {
    lines.push('', `Konkret: ${changeBits.slice(0, 4).join(', ')}.`);
  }
  lines.push(
    '',
    'Schauen Sie gerne noch einmal rein – bei Fragen melde ich mich gerne.',
    '',
    'Viele Grüße',
  );
  return lines.join('\n');
}

/** Kundennachricht: angehängtes Angebot kurz als Mail zusammenfassen. */
function buildAttachedOfferSummaryMessageDraft({
  lead,
  customerName,
  currentOfferContext = null,
}) {
  const offerLabel = currentOfferContext?.title
    || currentOfferContext?.summary
    || 'Ihr Angebot';
  const bits = [];
  if (currentOfferContext?.termMonths) bits.push(`${currentOfferContext.termMonths} Monate`);
  if (currentOfferContext?.mileagePerYear) {
    bits.push(`${Number(currentOfferContext.mileagePerYear).toLocaleString('de-DE')} km/Jahr`);
  }
  if (currentOfferContext?.monthlyRate != null) {
    bits.push(`${Number(currentOfferContext.monthlyRate).toLocaleString('de-DE')} €/Monat`);
  }
  const payment = currentOfferContext?.paymentType;
  const paymentLabel = payment === 'leasing'
    ? 'Leasing'
    : payment === 'financing' || payment === 'threeWayFinancing'
      ? 'Finanzierung'
      : payment === 'cash'
        ? 'Barkauf'
        : null;

  const lines = [
    messageGreetingLine(customerName, [], lead),
    '',
    `anbei die Kurzfassung zu Ihrem Angebot (${offerLabel}).`,
  ];
  if (paymentLabel || bits.length) {
    lines.push(
      '',
      [paymentLabel, bits.length ? bits.join(' · ') : null].filter(Boolean).join(' – '),
    );
  }
  lines.push(
    '',
    'Wenn Sie möchten, schicke ich Ihnen gerne den Kundenlink oder wir sprechen die Details kurz durch.',
    '',
    'Viele Grüße',
  );
  return lines.join('\n');
}

function stampStableMessageDraftIds(actions = [], workingMemory = null) {
  const existingId = workingMemory?.currentMessageDraftId
    || workingMemory?.lastMessageDraft?.messageDraftId
    || null;
  let sharedId = existingId;
  return (actions || []).map((action) => {
    if (action?.type !== SELLER_TURN_INTENTS.DRAFT_MESSAGE || !action.payload) return action;
    if (action.payload.messageDraftId) {
      sharedId = action.payload.messageDraftId;
      return action;
    }
    if (!sharedId) {
      sharedId = `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    }
    return {
      ...action,
      payload: {
        ...action.payload,
        messageDraftId: sharedId,
      },
    };
  });
}

/**
 * @param {object} params
 */
export function planSellerActions({
  lead = {},
  sellerInput = '',
  intents = [],
  inputMode = SELLER_INPUT_MODE.CLEVER_WORK_INPUT,
  facts = [],
  missingInformation = [],
  currentOfferContext = null,
  resolvedCustomer = null,
  workingContext = null,
  workingContextItems = [],
  goldenMoment = null,
  attachments = [],
  leadsSnapshot = [],
  pendingAppointment = null,
  now = null,
  calendarAvailability = null,
  workingMemory = null,
  conversationHistory = null,
} = {}) {
  const actions = [];
  const intentTypes = new Set(intents.map((i) => i.type));
  const customerName = resolvedCustomer?.name
    || resolvedCustomer?.namedInInput
    || lead?.contact?.name
    || '';

  const moment = goldenMoment
    || runTool('build_golden_moment', { lead }).result
    || null;

  // „schreib ihm das“ → Draft aus Session-Memory (Knowledge/Draft), kein Neustart
  const referentialWrite = /\bschreib(?:e|en)?\s+(?:ihm|ihr|dem\s+kunden)?\s*das\b/i.test(sellerInput)
    || /^(?:schreib(?:e|en)?|sag(?:e|en)?)\s+das[.!?]?$/i.test(String(sellerInput || '').trim());
  if (referentialWrite) {
    intentTypes.add(SELLER_TURN_INTENTS.DRAFT_MESSAGE);
  }

  // Message Continuity: „kürzer“ / „senden“ auf denselben messageDraftId
  const activeMessage = resolveActiveMessageDraft({ lead, workingMemory });
  if (activeMessage?.body && isMessageRewriteCue(sellerInput)) {
    const messageDraftId = activeMessage.messageDraftId || `msg_${Date.now().toString(36)}`;
    const nextBody = rewriteMessageBody(activeMessage.body, sellerInput);
    actions.push({
      id: 'rewrite_message',
      type: SELLER_TURN_INTENTS.DRAFT_MESSAGE,
      label: 'Nachricht angepasst',
      needsSellerConfirmation: false,
      status: 'prepared',
      toolId: 'draft_customer_message',
      payload: {
        messageDraftId,
        messageDraft: nextBody,
        previousBody: activeMessage.body,
        rewriteCue: sellerInput,
        updateOnly: true,
        mutatesCustomer: false,
        sendable: true,
        fromWorkingMemory: true,
      },
    });
    intentTypes.add(SELLER_TURN_INTENTS.DRAFT_MESSAGE);
  } else if (activeMessage?.body && isMessageSendCue(sellerInput)) {
    const messageDraftId = activeMessage.messageDraftId || `msg_${Date.now().toString(36)}`;
    actions.push({
      id: 'intend_send_message',
      type: SELLER_TURN_INTENTS.DRAFT_MESSAGE,
      label: 'Nachricht senden – bitte bestätigen',
      needsSellerConfirmation: true,
      status: 'prepared',
      toolId: 'draft_customer_message',
      payload: {
        messageDraftId,
        messageDraft: activeMessage.body,
        intendSend: true,
        needsSellerConfirmation: true,
        mutatesCustomer: false,
        sendable: true,
        fromWorkingMemory: true,
      },
    });
    intentTypes.add(SELLER_TURN_INTENTS.DRAFT_MESSAGE);
  }

  // Working-Draft Follow-up („doch Earth“, „schwarz“, „Winterpaket raus“) → PREPARE_OFFER mutieren
  if (shouldMutateExistingOfferDraft({
    sellerInput,
    facts,
    lead,
    workingMemory,
  })) {
    intentTypes.add(SELLER_TURN_INTENTS.PREPARE_OFFER);
  }

  // Follow-up auf Pending Appointment (ohne neuen Propose-Intent)
  const followUpAppointment = Boolean(pendingAppointment)
    && isAppointmentFollowUpInput(sellerInput, pendingAppointment)
    && !intentTypes.has(SELLER_TURN_INTENTS.PREPARE_OFFER);

  if (intentTypes.has(SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT)) {
    const prepared = prepareCustomerContractImport({
      sellerInput,
      lead,
      customerName,
      attachments,
    });
    actions.push({
      id: 'import_customer_contract',
      type: SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT,
      label: prepared.status === 'needs_manual_describe'
        ? 'PDF ohne Text'
        : 'Vertrag erkannt',
      needsSellerConfirmation: true,
      status: prepared.ok ? 'prepared' : 'blocked',
      toolId: 'import_customer_contract',
      payload: {
        documentClassification: prepared.documentClassification,
        contractDraft: prepared.contractDraft,
        extractedContractFacts: prepared.extractedContractFacts,
        evidence: prepared.evidence,
        missingInformation: prepared.missingInformation,
        reviewBody: prepared.reviewBody,
        warnings: prepared.warnings,
        intakeSource: prepared.intakeSource || null,
        mutatesCustomer: false,
        mutatesCustomerTruth: false,
        persistOnAccept: true,
      },
    });
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.SEARCH_CUSTOMER_CONTRACTS)) {
    const searched = searchCustomerContracts({
      sellerInput,
      lead,
      leadsSnapshot: Array.isArray(leadsSnapshot) ? leadsSnapshot : [],
      customerName,
    });
    actions.push({
      id: 'search_customer_contracts',
      type: SELLER_TURN_INTENTS.SEARCH_CUSTOMER_CONTRACTS,
      label: searched.ok ? 'Vertrag gefunden' : 'Vertrag nachschlagen',
      needsSellerConfirmation: false,
      status: searched.ok ? 'prepared' : 'blocked',
      toolId: 'search_customer_contracts',
      payload: {
        queryField: searched.queryField,
        status: searched.status,
        message: searched.message,
        contractMemoryResult: searched.contractMemoryResult,
        contracts: searched.contracts || [],
        customerSearchResults: searched.customerSearchResults || [],
        mutatesCustomer: false,
      },
    });
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.COMPARE_CONTRACT_WITH_OFFER)) {
    const compared = compareContractWithOffer({
      sellerInput,
      lead,
      leadsSnapshot: Array.isArray(leadsSnapshot) ? leadsSnapshot : [],
      customerName,
      currentOfferContext,
    });
    actions.push({
      id: 'compare_contract_with_offer',
      type: SELLER_TURN_INTENTS.COMPARE_CONTRACT_WITH_OFFER,
      label: compared.ok ? 'Vergleich bereit' : 'Vertragsvergleich',
      needsSellerConfirmation: false,
      status: compared.ok ? 'prepared' : 'blocked',
      toolId: 'compare_contract_with_offer',
      payload: {
        status: compared.status,
        message: compared.message,
        contractOfferCompareResult: compared.contractOfferCompareResult,
        customerSearchResults: compared.customerSearchResults || [],
        mutatesCustomer: false,
        mutatesCustomerTruth: false,
      },
    });

    // Slice 10: Nachricht nur bei explizitem DRAFT_MESSAGE + erfolgreichem Vergleich
    if (
      intentTypes.has(SELLER_TURN_INTENTS.DRAFT_MESSAGE)
      && compared.ok
      && compared.contractOfferCompareResult
      && !actions.some((a) => a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE)
    ) {
      const drafted = draftContractCompareCustomerMessage({
        compareResult: compared.contractOfferCompareResult,
        lead,
        customerName,
      });
      if (drafted.ok && drafted.messageDraft) {
        actions.push({
          id: 'draft_message',
          type: SELLER_TURN_INTENTS.DRAFT_MESSAGE,
          label: 'Vergleichsnachricht',
          needsSellerConfirmation: true,
          status: 'prepared',
          toolId: 'draft_customer_message',
          payload: {
            messageDraft: drafted.messageDraft,
            handoff: drafted.handoff,
            contractCompareLinked: true,
            autoSend: false,
            mutatesCustomer: false,
            mutatesCustomerTruth: false,
          },
        });
      }
    }
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.GET_TODAY_OVERVIEW)) {
    const overview = runTool('get_today_overview', {
      leadsSnapshot: Array.isArray(leadsSnapshot) ? leadsSnapshot : [],
    }).result;
    actions.push({
      id: 'get_today_overview',
      type: SELLER_TURN_INTENTS.GET_TODAY_OVERVIEW,
      label: 'Heute wichtig',
      needsSellerConfirmation: false,
      status: overview?.ok ? 'prepared' : 'blocked',
      toolId: 'get_today_overview',
      payload: {
        todayOverview: overview,
        itemCount: overview?.itemCount ?? 0,
      },
    });
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.RECOMMEND_NEXT_STEP) && moment) {
    actions.push({
      id: 'recommend_next_step',
      type: SELLER_TURN_INTENTS.RECOMMEND_NEXT_STEP,
      label: moment.primaryLabel || 'Nächster Schritt',
      needsSellerConfirmation: true,
      status: 'prepared',
      toolId: 'build_golden_moment',
      payload: {
        goldenMoment: moment,
        recommendedAction: moment.recommendedAction,
      },
    });
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.CUSTOMER_REPLY)) {
    actions.push({
      id: 'customer_reply',
      type: SELLER_TURN_INTENTS.CUSTOMER_REPLY,
      label: 'Kundenantwort zuordnen',
      needsSellerConfirmation: true,
      status: 'prepared',
      payload: {
        mutatesCustomer: true,
        requiresAccept: true,
        factCount: facts.filter((f) => f.factClass !== SELLER_FACT_CLASS.MESSAGE_INSTRUCTION).length,
      },
    });
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.INBOUND_LEAD)) {
    actions.push({
      id: 'inbound_lead',
      type: SELLER_TURN_INTENTS.INBOUND_LEAD,
      label: 'Anfrage zuordnen',
      needsSellerConfirmation: true,
      status: 'prepared',
      payload: {
        mutatesCustomer: true,
        requiresAccept: true,
        factCount: facts.filter((f) => f.factClass !== SELLER_FACT_CLASS.MESSAGE_INSTRUCTION).length,
      },
    });
  }

  if (
    intentTypes.has(SELLER_TURN_INTENTS.OPEN_CUSTOMER)
    || intentTypes.has(SELLER_TURN_INTENTS.FIND_CUSTOMER)
    || intentTypes.has(SELLER_TURN_INTENTS.CUSTOMER_LOOKUP)
  ) {
    const toolId = intentTypes.has(SELLER_TURN_INTENTS.OPEN_CUSTOMER)
      ? 'open_customer'
      : 'find_customer';
    const { result: found } = runTool(toolId, {
      sellerInput,
      leadsSnapshot: Array.isArray(leadsSnapshot) ? leadsSnapshot : [],
    });
    actions.push({
      id: toolId,
      type: intentTypes.has(SELLER_TURN_INTENTS.OPEN_CUSTOMER)
        ? SELLER_TURN_INTENTS.OPEN_CUSTOMER
        : SELLER_TURN_INTENTS.FIND_CUSTOMER,
      label: intentTypes.has(SELLER_TURN_INTENTS.OPEN_CUSTOMER) ? 'Kunde öffnen' : 'Kunde finden',
      needsSellerConfirmation: false,
      status: found?.status === 'none' || found?.status === 'missing_query' ? 'blocked' : 'prepared',
      toolId,
      payload: {
        customerSearchResults: found?.cards || found?.results || [],
        status: found?.status || null,
        message: found?.message || null,
        resolvedLeadId: found?.lead?.id || null,
        mutatesCustomer: false,
      },
    });
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.SUMMARIZE_CUSTOMER_CONTEXT)) {
    const { result: summary } = runTool('summarize_customer_context', {
      lead,
      sellerInput,
      leadsSnapshot: Array.isArray(leadsSnapshot) ? leadsSnapshot : [],
    });
    actions.push({
      id: 'summarize_customer_context',
      type: SELLER_TURN_INTENTS.SUMMARIZE_CUSTOMER_CONTEXT,
      label: 'Kundenkontext',
      needsSellerConfirmation: false,
      status: summary?.ok && summary?.customerSummary ? 'prepared' : 'blocked',
      toolId: 'summarize_customer_context',
      payload: {
        customerSummary: summary?.customerSummary || null,
        customerSearchResults: summary?.customerSearchResults || [],
        status: summary?.status || null,
        message: summary?.message || null,
        resolvedLeadId: summary?.resolvedCustomer?.id || null,
        mutatesCustomer: false,
      },
    });
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.SEARCH_CUSTOMER_OFFERS)) {
    const { result: search } = runTool('search_customer_offers', {
      lead,
      sellerInput,
      leadsSnapshot: Array.isArray(leadsSnapshot) ? leadsSnapshot : [],
    });
    actions.push({
      id: 'search_customer_offers',
      type: SELLER_TURN_INTENTS.SEARCH_CUSTOMER_OFFERS,
      label: 'Angebotshistorie',
      needsSellerConfirmation: false,
      status: search?.ok ? 'prepared' : 'blocked',
      toolId: 'search_customer_offers',
      legacy: search ?? null,
      payload: {
        historySearchResults: search?.results || [],
        customerSearchResults: search?.customerSearchResults || [],
        status: search?.status || null,
        message: search?.message || null,
        hitCount: search?.results?.length ?? 0,
        mutatesCustomer: false,
      },
    });
  } else if (
    intentTypes.has(SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY)
    || intentTypes.has(SELLER_TURN_INTENTS.SEARCH_CUSTOMER_MESSAGES)
    || intentTypes.has(SELLER_TURN_INTENTS.SEARCH_CUSTOMER_ACTIVITIES)
  ) {
    const toolId = intentTypes.has(SELLER_TURN_INTENTS.SEARCH_CUSTOMER_MESSAGES)
      ? 'search_customer_messages'
      : intentTypes.has(SELLER_TURN_INTENTS.SEARCH_CUSTOMER_ACTIVITIES)
        ? 'search_customer_activities'
        : 'search_customer_history';
    const { result: search } = runTool(toolId, {
      lead,
      sellerInput,
      customerName,
      leadsSnapshot: Array.isArray(leadsSnapshot) ? leadsSnapshot : [],
    });
    const results = search?.results
      || search?.results?.[0]?.hits
      || [];
    // Legacy runComposerAkteSearch shape
    const normalizedResults = Array.isArray(search?.results) && search.results[0]?.hits
      ? search.results[0].hits
      : (Array.isArray(search?.results) ? search.results : []);
    actions.push({
      id: toolId,
      type: intentTypes.has(SELLER_TURN_INTENTS.SEARCH_CUSTOMER_MESSAGES)
        ? SELLER_TURN_INTENTS.SEARCH_CUSTOMER_MESSAGES
        : SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY,
      label: 'Verlauf durchsuchen',
      needsSellerConfirmation: false,
      status: search?.ok ? 'prepared' : 'blocked',
      toolId,
      legacy: search ?? null,
      payload: {
        historySearchResults: normalizedResults.filter((r) => r.sourceType || r.matchedText || r.snippet),
        customerSearchResults: search?.customerSearchResults || [],
        status: search?.status || null,
        message: search?.message || null,
        hitCount: (search?.results?.length ?? search?.payload?.hitCount ?? 0)
          || normalizedResults.length,
        mutatesCustomer: false,
      },
    });
    void results;
  }

  if (
    intentTypes.has(SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT)
    && !intentTypes.has(SELLER_TURN_INTENTS.PREPARE_OFFER)
    && !intentTypes.has(SELLER_TURN_INTENTS.DRAFT_MESSAGE)
  ) {
    actions.push({
      id: 'update_customer_context',
      type: SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT,
      label: 'Kundendaten einsortieren',
      needsSellerConfirmation: false,
      status: 'prepared',
      payload: {
        factCount: facts.filter((f) => f.factClass !== 'offer_instruction').length,
      },
    });
  }

  const trackFeedbackFacts = facts.filter((f) => f.field === 'vehicleTrackFeedback' && f.value);
  const favoriteFeedback = trackFeedbackFacts.find(
    (f) => f.value?.status === 'favorite',
  );
  if (favoriteFeedback || trackFeedbackFacts.some((f) => f.value?.status === 'deferred')) {
    const favoriteLabel = favoriteFeedback?.label
      || favoriteFeedback?.value?.modelKey
      || 'Favorit';
    const modelKey = favoriteFeedback?.value?.modelKey || null;
    actions.push({
      id: 'revise_favorite_offer',
      type: SELLER_TURN_INTENTS.PREPARE_OFFER,
      label: modelKey
        ? `${String(modelKey).replace(/^./, (c) => c.toUpperCase())}-Angebot anpassen`
        : 'Angebot anpassen',
      needsSellerConfirmation: true,
      status: 'prepared',
      toolId: 'prepare_offer',
      payload: {
        reviseFavoriteOffer: true,
        modelKey,
        favoriteLabel,
        trackFeedback: trackFeedbackFacts.map((f) => ({
          modelKey: f.value?.modelKey,
          status: f.value?.status,
          label: f.label,
        })),
        goldenMoment: moment || null,
      },
    });
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.PREPARE_TRADE_IN)) {
    actions.push({
      id: 'prepare_trade_in',
      type: SELLER_TURN_INTENTS.PREPARE_TRADE_IN,
      label: 'Inzahlungnahme vorbereiten',
      needsSellerConfirmation: true,
      status: 'prepared',
      payload: {
        missing: missingInformation.filter((m) => m.forIntent === SELLER_TURN_INTENTS.PREPARE_TRADE_IN),
      },
    });
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.PREPARE_OFFER)) {
    const batchCue = isBatchOfferCue(sellerInput);
    // Batch löst Multi-Fahrzeug selbst – kein clarify_vehicle_for_offer-Block
    const blockedByClarify = missingInformation.some((m) => (
      m.id === 'clarify_purchase_vs_leasing'
      || (m.id === 'clarify_vehicle_for_offer' && !batchCue)
    ));
    const batchResolved = batchCue
      ? resolveBatchOfferTracks({
        lead,
        sellerInput,
        workingMemory,
        conversationHistory,
        // Scope-Tracks nachziehen (auch wenn Remember Configs noch nicht persistiert hat)
        ensureMissingTracks: true,
      })
      : null;
    const openTracks = batchResolved?.ok
      ? batchResolved.tracks
      : [];
    // Ensure erzeugt neues Lead-Objekt – Configs für Apply mitschicken
    const ensuredVehicleConfigurations = batchResolved?.ok
      && Array.isArray(batchResolved.lead?.crm?.vehicleConfigurations)
      ? batchResolved.lead.crm.vehicleConfigurations
      : null;
    const offerVehicleTarget = resolveOfferVehicleTarget({
      lead,
      sellerInput,
      facts,
      currentOfferContext,
      workingContext,
    });
    // Telefon Ende: „mach die 3 Angebote“ → exakter Gesprächs-Scope (keine EV4-History)
    if (batchCue && openTracks.length >= 2 && !blockedByClarify) {
      const commercial = null;
      const batchOffers = openTracks.map((t) => {
        const modelKey = String(t.config?.modelKey || t.modelLabel || '')
          .toLowerCase()
          .replace(/^kia\s+/i, '')
          .replace(/\s+/g, '');
        const modelLabel = t.displayName || t.modelLabel || modelKey;
        const identity = {
          id: `vid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          customerId: lead?.id || null,
          model: { raw: modelLabel, canonical: modelKey?.toUpperCase?.() || modelLabel, status: 'captured' },
          trim: { raw: t.config?.trimLabel || null, canonical: t.config?.trimLabel || null, status: t.config?.trimLabel ? 'captured' : 'open' },
          powertrainVariant: { raw: null, canonical: null, status: 'open' },
          color: { raw: null, canonical: null, status: 'open' },
          packages: [],
          equipment: [],
          modelKey: modelKey || null,
          vehicleLabel: modelLabel ? `Kia ${String(modelLabel).replace(/^kia\s*/i, '')}` : null,
          source: 'seller_input_batch',
        };
        const offerDraftId = `ofd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        return {
          offerDraftId,
          customerId: lead?.id || null,
          vehicleTrackId: t.id,
          vehicleIdentityDraftId: identity.id,
          vehicleIdentityDraft: identity,
          commercialScenarioId: commercial?.id || null,
          rate: null,
          status: 'draft',
          createNewAlternative: false,
          invalidateVehicleRate: true,
          vehicleLabel: identity.vehicleLabel,
          focusModelKey: modelKey || null,
        };
      });
      actions.push({
        id: 'prepare_offers_batch',
        type: SELLER_TURN_INTENTS.PREPARE_OFFER,
        label: `${openTracks.length} Angebote vorbereiten`,
        needsSellerConfirmation: true,
        status: 'prepared',
        toolId: 'prepare_offer',
        payload: {
          batch: true,
          trackIds: openTracks.map((t) => t.id),
          offerDraftIds: batchOffers.map((o) => o.offerDraftId),
          offers: batchOffers,
          models: openTracks.map((t) => ({
            trackId: t.id,
            modelKey: t.config?.modelKey || t.modelLabel,
            displayName: t.displayName,
          })),
          batchScope: batchResolved?.scope || null,
          batchModelKeys: batchResolved?.modelKeys || [],
          ensuredVehicleConfigurations,
          canCreateOffer: false,
          attachWorkingContext: true,
          needsSellerConfirmation: true,
          mutatesCustomer: false,
          source: 'seller_input_batch',
          nextStepHint: 'Angebote vorbereiten',
          // Primärer Draft = erster für Memory Continuity
          offerDraftId: batchOffers[0]?.offerDraftId || null,
          vehicleIdentityDraft: batchOffers[0]?.vehicleIdentityDraft || null,
          vehicleIdentityDraftId: batchOffers[0]?.vehicleIdentityDraftId || null,
        },
      });
    } else if (batchCue && !blockedByClarify) {
      // Batch-Cue erkannt, aber Scope unklar – kein Single-Offer mit CRM-Primary/EV4
      actions.push({
        id: 'prepare_offers_batch_clarify',
        type: SELLER_TURN_INTENTS.PREPARE_OFFER,
        label: 'Angebote – Fahrzeuge klären',
        needsSellerConfirmation: true,
        status: 'blocked',
        payload: {
          needsClarification: true,
          clarifyVehicleForOffer: true,
          batch: true,
          question: 'Für welche Fahrzeuge soll ich Angebote vorbereiten?',
          choices: (batchResolved?.modelKeys || []).map((k) => ({
            id: k,
            label: String(k).toUpperCase(),
          })),
          reason: batchResolved?.reason || 'insufficient_batch_tracks',
        },
      });
    } else if (offerVehicleTarget.status === OFFER_VEHICLE_TARGET_STATUS.NEEDS_CLARIFICATION) {
      actions.push({
        id: 'prepare_offer',
        type: SELLER_TURN_INTENTS.PREPARE_OFFER,
        label: 'Angebot – Fahrzeug klären',
        needsSellerConfirmation: true,
        status: 'blocked',
        payload: {
          needsClarification: true,
          clarifyVehicleForOffer: true,
          question: offerVehicleTarget.question,
          choices: offerVehicleTarget.choices || [],
        },
      });
    } else {
    const commercialOnly = facts.length > 0
      && facts.every((f) => (
        f.factClass === SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE
        || f.factClass === SELLER_FACT_CLASS.MESSAGE_INSTRUCTION
        || f.factClass === SELLER_FACT_CLASS.SELLER_NOTE
        || f.factClass === SELLER_FACT_CLASS.OFFER_INSTRUCTION
        || f.factClass === SELLER_FACT_CLASS.VEHICLE_INTEREST
        || f.factClass === SELLER_FACT_CLASS.VEHICLE_REQUIREMENT
        || f.factClass === SELLER_FACT_CLASS.CUSTOMER_FACT
      ));
    const identityOnOpenOffer = facts.some((f) => (
      (f.field === 'trimPreference' || f.field === 'colorPreference')
      && (
        f.value?.targetScope === 'offer_vehicle'
        || Boolean(currentOfferContext?.offerId)
      )
    ));
    if (blockedByClarify) {
      actions.push({
        id: 'prepare_offer',
        type: SELLER_TURN_INTENTS.PREPARE_OFFER,
        label: 'Angebot – Klärung nötig',
        needsSellerConfirmation: true,
        status: 'blocked',
        payload: {
          needsClarification: true,
        },
      });
    } else if (
      shouldRefineActiveOfferFromPdf({
        lead,
        workingMemory,
        attachments,
        facts,
      })
      && (() => {
        const pdfMerged = mergePdfIntoActiveOfferDraft({
          lead,
          workingMemory,
          facts,
          sellerInput,
        });
        if (!pdfMerged.ok) return false;
        const mutatedPayload = buildMutatedPrepareOfferPayload(pdfMerged.mutation, {
          lead,
          sellerInput,
        });
        if (!mutatedPayload) return false;
        actions.push({
          id: 'refine_offer_from_pdf',
          type: SELLER_TURN_INTENTS.PREPARE_OFFER,
          label: pdfMerged.conflicts.length
            ? 'PDF übernommen – bitte Konflikt prüfen'
            : 'PDF in Angebot übernommen',
          needsSellerConfirmation: pdfMerged.conflicts.length > 0,
          status: 'prepared',
          toolId: 'modify_offer',
          payload: {
            ...mutatedPayload,
            // Bei Konflikt: volle Review (nicht updateOnly-Skip)
            updateOnly: pdfMerged.conflicts.length === 0,
            fromPdf: true,
            refineExistingDraft: true,
            identityConflicts: pdfMerged.conflicts,
            monthlyRate: pdfMerged.rate,
            rateAuthority: pdfMerged.rate != null
              ? RATE_AUTHORITY.AUTHORITATIVE
              : RATE_AUTHORITY.NON_AUTHORITATIVE,
            missingRate: pdfMerged.rate == null,
            commercialScenario: pdfMerged.commercial,
          },
        });
        return true;
      })()
    ) {
      // PDF in denselben Offer Draft gemerged
    } else if (
      shouldMutateExistingOfferDraft({
        sellerInput,
        facts,
        lead,
        workingMemory,
        createNewAlternative: offerVehicleTarget.createNew === true
          || offerVehicleTarget.mutationMode === OFFER_MUTATION_MODE.CREATE_NEW,
      })
    ) {
      const mutation = mutateActiveOfferDraft({
        lead,
        workingMemory,
        sellerInput,
        facts,
      });
      const mutatedPayload = mutation
        ? buildMutatedPrepareOfferPayload(mutation, { lead, sellerInput })
        : null;
      if (mutatedPayload) {
        actions.push({
          id: 'update_working_offer_draft',
          type: SELLER_TURN_INTENTS.PREPARE_OFFER,
          label: 'Angebot aktualisiert',
          needsSellerConfirmation: false,
          status: 'prepared',
          toolId: 'modify_offer',
          payload: mutatedPayload,
        });
      } else if (
        currentOfferContext?.offerId
        && (commercialOnly || identityOnOpenOffer)
        && !facts.some((f) => f.field === 'purchasePrice')
      ) {
        // Fallback: alter updateOnly-Pfad wenn Mutation fehlschlägt
        const trimFact = facts.find((f) => f.field === 'trimPreference');
        const colorFact = facts.find((f) => f.field === 'colorPreference');
        const trimValue = trimFact?.value?.trim
          || (Array.isArray(trimFact?.value) ? trimFact.value[0] : null)
          || (typeof trimFact?.value === 'string' ? trimFact.value : null)
          || trimFact?.label
          || null;
        const colorValue = colorFact?.value?.color
          || (typeof colorFact?.value === 'string' ? colorFact.value : null)
          || colorFact?.label
          || null;
        actions.push({
          id: 'update_offer_context',
          type: SELLER_TURN_INTENTS.PREPARE_OFFER,
          label: 'Fahrzeugidentität anpassen',
          needsSellerConfirmation: true,
          status: 'prepared',
          toolId: 'modify_offer',
          payload: {
            updateOnly: true,
            offerId: currentOfferContext.offerId,
            offerSummary: currentOfferContext.summary || currentOfferContext.title || null,
            vehicleTrackId: offerVehicleTarget.vehicleTrackId
              || currentOfferContext.vehicleTrackId
              || currentOfferContext.vehicleCardId
              || null,
            identityPatch: (trimValue || colorValue)
              ? {
                trim: trimValue,
                color: colorValue,
                modelKey: offerVehicleTarget.modelKey || currentOfferContext.modelKey || null,
                mutationMode: OFFER_MUTATION_MODE.UPDATE_EXISTING,
              }
              : null,
          },
        });
      }
    } else if (
      currentOfferContext?.offerId
      && (commercialOnly || identityOnOpenOffer)
      && !facts.some((f) => f.field === 'purchasePrice')
    ) {
      const trimFact = facts.find((f) => f.field === 'trimPreference');
      const colorFact = facts.find((f) => f.field === 'colorPreference');
      const trimValue = trimFact?.value?.trim
        || (Array.isArray(trimFact?.value) ? trimFact.value[0] : null)
        || (typeof trimFact?.value === 'string' ? trimFact.value : null)
        || trimFact?.label
        || null;
      const colorValue = colorFact?.value?.color
        || (typeof colorFact?.value === 'string' ? colorFact.value : null)
        || colorFact?.label
        || null;
      actions.push({
        id: 'update_offer_context',
        type: SELLER_TURN_INTENTS.PREPARE_OFFER,
          label: identityOnOpenOffer && !hasCommercialOfferSlots(facts)
            ? 'Fahrzeugidentität anpassen'
            : 'Angebot anpassen',
        needsSellerConfirmation: true,
        status: 'prepared',
        toolId: 'modify_offer',
        payload: {
          updateOnly: true,
          offerId: currentOfferContext.offerId,
          offerSummary: currentOfferContext.summary || currentOfferContext.title || null,
          vehicleTrackId: offerVehicleTarget.vehicleTrackId
            || currentOfferContext.vehicleTrackId
            || currentOfferContext.vehicleCardId
            || null,
          identityPatch: (trimValue || colorValue)
            ? {
              trim: trimValue,
              color: colorValue,
              modelKey: offerVehicleTarget.modelKey || currentOfferContext.modelKey || null,
              mutationMode: OFFER_MUTATION_MODE.UPDATE_EXISTING,
            }
            : null,
        },
      });
    } else {
      const { result: offer } = runTool('prepare_offer', {
        lead,
        sellerInput,
        currentOfferContext,
        facts,
        attachments,
      });
      const purchase = facts.find((f) => f.field === 'purchasePrice');
      const purchaseAmount = typeof purchase?.value === 'object' && purchase?.value
        ? (purchase.value.amount ?? purchase.value.value ?? null)
        : (purchase?.value ?? null);
      const authoritativeRate = extractAuthoritativeOfferRateFromFacts(facts);
      const rateAmount = authoritativeRate.amount;
      const magic = offer?.results?.[0]?.magic || null;
      const grounded = magic?.grounded || null;
      const resolvedOfferRate = resolveAuthoritativeOfferMonthlyRate({
        sellerFactRate: rateAmount,
        magicCalculationRate: magic?.calculation?.monthlyRate ?? null,
        magicIntentRate: magic?.intent?.commercialInput?.monthlyRate ?? null,
        fromPdf: Boolean(magic?.fromPdf),
      });
      const vehicleFromFacts = facts.find((f) => f.field === 'vehicleInterest');
      const vehicleConflict = Boolean(vehicleFromFacts?.value?.conflictWithActive);
      // Explizites Seller-Modell schlägt Magic-Grounding (EV4 statt klebendem EV3).
      // PDF-Konflikt: aktives Akte-Modell behalten (Focus nicht still auf PDF-Modell).
      const groundedVehicleLabel = [
        grounded?.model ? `Kia ${grounded.model}` : null,
        grounded?.trimLabel || null,
        /automatik|dct/i.test(grounded?.engineLabel || '') ? 'Automatik' : null,
      ].filter(Boolean).join(' ') || null;
      const vehicleLabel = vehicleConflict
        ? (vehicleFromFacts.value?.activeLabel
          || `Kia ${vehicleFromFacts.value?.activeModel || vehicleFromFacts.value?.activeModelKey || ''}`.trim()
          || groundedVehicleLabel)
        : (vehicleFromFacts?.label || groundedVehicleLabel || null);
      const paymentRaw = facts.find((f) => f.field === 'paymentType')?.value
        || magic?.paymentType
        || null;
      const offerType = paymentRaw === 'purchase' || paymentRaw === 'cash'
        ? 'cash'
        : (paymentRaw || (purchase ? 'cash' : null));
      const offerMonthlyRate = resolvedOfferRate.monthlyRate;
      const hasLeasingRate = offerType === 'leasing' && offerMonthlyRate != null;
      const cashReady = (offerType === 'cash' || offerType === 'purchase')
        && (purchaseAmount != null || Boolean(magic?.canCreateOffer));
      const canCreate = cashReady
        || hasLeasingRate
        || (Boolean(magic?.canCreateOffer) && offerMonthlyRate != null)
        || Boolean(purchaseAmount != null);
      const vehicleInterest = facts.find((f) => f.field === 'vehicleInterest');
      const targetModel = offerVehicleTarget.modelKey
        || (vehicleConflict
          ? (vehicleInterest?.value?.activeModelKey || vehicleInterest?.value?.activeModel)
          : (vehicleInterest?.value?.modelKey || vehicleInterest?.value?.model));
      // Kein stilles Magic-/Track-Default-Trim – nur Seller-Fact / explizit geparstes Trim
      const modelOnlyConcept = isModelOnlyOfferCue(sellerInput)
        || offerVehicleTarget.modelOnlyConcept === true;
      const targetTrim = modelOnlyConcept
        ? null
        : (vehicleConflict
          ? null
          : (
            vehicleInterest?.value?.trim
            || offerVehicleTarget.trim
            || facts.find((f) => f.field === 'trimPreference')?.value?.trim
            || (Array.isArray(facts.find((f) => f.field === 'trimPreference')?.value)
              ? facts.find((f) => f.field === 'trimPreference').value[0]
              : null)
            || null
          ));
      // Magic-Grounding nur wenn Modell zum Target passt – sonst klebt EV3 nicht über EV2
      const groundedMatchesTarget = !modelOnlyConcept
        && grounded?.modelKey
        && targetModel
        && String(grounded.modelKey).toLowerCase() === String(targetModel).toLowerCase();
      const focusModel = targetModel
        || (groundedMatchesTarget ? grounded?.model : null)
        || null;
      const focusTrim = modelOnlyConcept
        ? null
        : (targetTrim || (groundedMatchesTarget ? grounded?.trimLabel : null) || null);
      const resolvedVehicleLabel = [
        focusModel ? `Kia ${String(focusModel).replace(/^kia\s*/i, '')}` : null,
        focusTrim,
      ].filter(Boolean).join(' ')
        || vehicleLabel
        || offerVehicleTarget.label
        || null;
      const leasingWithoutRate = (offerType === 'leasing' || offerType == null)
        && offerMonthlyRate == null
        && (
          magic?.decision?.action === 'ask_rate'
          || isBareOrGenericOfferCue(sellerInput)
          || Boolean(offerVehicleTarget.vehicleTrackId)
        );
      const profileLeasing = lead?.paymentType === 'leasing' || lead?.wish?.paymentType === 'leasing';
      const cashVsLeasingWarning = offerType === 'cash' && profileLeasing
        ? 'In der Kundenakte ist bisher Leasing notiert.'
        : null;
      // Capture→Offer: Track-Target ohne Fake-Rate bleibt prepared (Angebotstool), nicht stuck-blocked
      const bareOfferShell = isBareOrGenericOfferCue(sellerInput)
        && Boolean(offerVehicleTarget.vehicleTrackId || focusModel);
      const preparedOk = bareOfferShell
        || ((offer?.ok || purchaseAmount != null || hasLeasingRate) && !(
          offerType === 'leasing' && offerMonthlyRate == null && magic?.decision?.action === 'ask_rate'
        ));
      const offerPayload = stripNonAuthoritativeOfferRates(
        enrichPrepareOfferPayloadWithIdentityDraft({
          canCreateOffer: Boolean(canCreate) && !(
            offerType === 'leasing' && offerMonthlyRate == null
          ),
          purchasePrice: purchaseAmount ?? (
            (offerType === 'cash' || offerType === 'purchase')
              ? (magic?.calculation?.endPrice ?? grounded?.basePrice ?? null)
              : null
          ),
          paymentType: paymentRaw,
          offerType,
          vehicleLabel: resolvedVehicleLabel,
          vehicleTrackId: offerVehicleTarget.vehicleTrackId || null,
          createNewAlternative: offerVehicleTarget.createNew === true
            || offerVehicleTarget.mutationMode === OFFER_MUTATION_MODE.CREATE_NEW,
          mutationMode: offerVehicleTarget.mutationMode || null,
          vehicle: {
            model: focusModel || null,
            trim: focusTrim,
            make: 'Kia',
            modelKey: offerVehicleTarget.modelKey || focusModel || null,
          },
          customerId: lead?.id || resolvedCustomer?.id || null,
          customerName: customerName || lead?.contact?.name || null,
          monthlyRate: offerMonthlyRate,
          rateAuthority: offerMonthlyRate != null
            ? (resolvedOfferRate.rateAuthority || RATE_AUTHORITY.AUTHORITATIVE)
            : RATE_AUTHORITY.NON_AUTHORITATIVE,
          discountPercent: magic?.intent?.commercialInput?.discountPercent ?? null,
          listPrice: groundedMatchesTarget ? (grounded?.basePrice ?? null) : null,
          engineLabel: groundedMatchesTarget ? (grounded?.engineLabel ?? null) : null,
          variantId: groundedMatchesTarget ? (grounded?.variantId ?? null) : null,
          decisionAction: magic?.decision?.action ?? null,
          missingRate: (offerType === 'leasing' || offerType == null)
            && (leasingWithoutRate || magic?.decision?.action === 'ask_rate' || offerMonthlyRate == null)
            && purchaseAmount == null,
          attachWorkingContext: true,
          needsSellerConfirmation: true,
          mutatesCustomer: false,
          source: offerVehicleTarget.source || 'seller_input',
          cashVsLeasingWarning,
          vehicleModelConflict: vehicleConflict
            ? {
              pdfLabel: vehicleInterest?.value?.pdfLabel || vehicleInterest?.label,
              activeLabel: vehicleInterest?.value?.activeLabel,
              warning: vehicleInterest?.label,
            }
            : null,
          preparedOffer: {
            type: 'prepare_offer',
            customerId: lead?.id || resolvedCustomer?.id || null,
            vehicleTrackId: offerVehicleTarget.vehicleTrackId || null,
            vehicle: {
              model: focusModel || null,
              trim: focusTrim || null,
              modelKey: offerVehicleTarget.modelKey || focusModel || null,
            },
            offerType: offerType || null,
            purchasePrice: purchaseAmount ?? null,
            source: 'seller_input',
            needsSellerConfirmation: true,
          },
        }, {
          facts,
          sellerInput,
          lead,
        }),
      );
      actions.push({
        id: 'prepare_offer',
        type: SELLER_TURN_INTENTS.PREPARE_OFFER,
        label: leasingWithoutRate && !bareOfferShell
          ? 'Leasingangebot – Rate fehlt'
          : (canCreate ? 'Angebot vorbereiten' : 'Angebot prüfen'),
        needsSellerConfirmation: true,
        status: preparedOk ? 'prepared' : 'blocked',
        toolId: 'prepare_offer',
        legacy: offer ?? null,
        payload: offerPayload,
      });
    }
    }
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.SEND_PORTFOLIO)) {
    actions.push({
      id: 'send_portfolio',
      type: SELLER_TURN_INTENTS.SEND_PORTFOLIO,
      label: 'Kundenlink senden',
      needsSellerConfirmation: true,
      status: 'prepared',
      payload: {
        cta: 'Kundenlink senden',
      },
    });
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.REQUEST_DOCUMENTS)) {
    const { result: pkg } = runTool('request_documents', { lead, sellerInput });
    const slots = Array.isArray(pkg?.slots) ? pkg.slots : [];
    const complete = Boolean(pkg?.complete) || slots.length === 0;
    actions.push({
      id: 'request_documents',
      type: SELLER_TURN_INTENTS.REQUEST_DOCUMENTS,
      label: complete ? 'Unterlagen vollständig' : 'Sicheren Upload-Link senden',
      needsSellerConfirmation: !complete,
      status: 'prepared',
      toolId: 'request_documents',
      legacy: pkg,
      payload: {
        actionCount: pkg?.actions?.length ?? 0,
        slots,
        missingLabels: slots.map((s) => s.label).filter(Boolean),
        sellerSummary: pkg?.sellerSummary || null,
        messageDraft: pkg?.body || null,
        ctaLabel: pkg?.ctaLabel || (complete ? null : 'Sicheren Upload-Link senden'),
        workspacePackage: pkg,
        complete,
        mutatesCustomer: !complete,
      },
    });
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT)
    || intentTypes.has(SELLER_TURN_INTENTS.PREPARE_CALLBACK)
    || followUpAppointment) {
    if (intentTypes.has(SELLER_TURN_INTENTS.RESOLVE_RELATIVE_DATETIME) || followUpAppointment) {
      const dt = resolveRelativeDateTime(sellerInput, {
        now: now || undefined,
        previousStartsAt: pendingAppointment?.startsAt || pendingAppointment?.startAt || null,
      });
      actions.push({
        id: 'resolve_relative_datetime',
        type: SELLER_TURN_INTENTS.RESOLVE_RELATIVE_DATETIME,
        label: dt.ok ? (dt.whenLabel || 'Datum aufgelöst') : 'Datum klären',
        needsSellerConfirmation: false,
        status: dt.ok ? 'prepared' : 'blocked',
        toolId: 'resolve_relative_datetime',
        payload: { resolvedDateTime: dt, mutatesCustomer: false },
      });
    }

    const prepared = prepareContextualAppointmentProposal({
      sellerInput,
      lead,
      customerName,
      workingContextItems: workingContextItems.length
        ? workingContextItems
        : (workingContext ? [workingContext] : []),
      pendingAppointment,
      now: now || undefined,
      calendarAvailability,
      sellerClaimsAvailable: /\b(ist frei|frei ist|kalender ist frei)\b/i.test(sellerInput),
      customerConfirmed: Boolean(pendingAppointment?.customerConfirmed),
    });

    const appointmentReady = prepared.status === 'prepared'
      || prepared.status === 'message_rewritten';
    actions.push({
      id: 'propose_appointment',
      type: SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT,
      label: prepared.status === 'needs_customer_confirmation_first'
        ? 'Termin erst vorschlagen'
        : 'Terminvorschlag',
      needsSellerConfirmation: true,
      status: appointmentReady ? 'prepared' : 'blocked',
      toolId: 'propose_appointment',
      legacy: prepared.legacyAppointment
        ? {
          ok: appointmentReady,
          appointment: prepared.legacyAppointment,
          results: [{
            draft: { body: prepared.messageDraft },
            messageBody: prepared.messageDraft,
            appointment: prepared.legacyAppointment,
          }],
        }
        : null,
      payload: {
        preparedAppointment: prepared.preparedAppointment,
        messageDraft: prepared.messageDraft,
        when: prepared.preparedAppointment?.startsAt || null,
        resolvedDateTime: prepared.resolvedDateTime,
        availabilityStatus: prepared.availabilityStatus || 'not_checked',
        handoff: prepared.handoff,
        sendable: prepared.sendable,
        bookable: false,
        mutatesCustomer: false,
        status: prepared.status,
        warnings: prepared.warnings || [],
        uiHint: prepared.uiHint || null,
        evidence: prepared.evidence || [],
      },
    });

    if (prepared.messageDraft && !actions.some((a) => a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE)) {
      actions.push({
        id: 'draft_message',
        type: SELLER_TURN_INTENTS.DRAFT_MESSAGE,
        label: 'Nachricht vorbereiten',
        needsSellerConfirmation: true,
        status: 'prepared',
        toolId: 'draft_customer_message',
        payload: {
          messageDraft: prepared.messageDraft,
          handoff: prepared.handoff,
          mutatesCustomer: false,
          appointmentLinked: true,
        },
      });
    }
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.LOOKUP_VEHICLE_FACT)) {
    const modelFact = facts.find((f) => f.field === 'vehicleInterest');
    const modelKey = modelFact?.value?.modelKey
      || workingContext?.attachedVehicle?.modelKey
      || null;
    const knowledge = runTool('lookup_vehicle_technical_fact', {
      modelKey,
      sellerInput,
    }).result;
    actions.push({
      id: 'lookup_vehicle_fact',
      type: SELLER_TURN_INTENTS.LOOKUP_VEHICLE_FACT,
      label: knowledge?.factLabel || 'Fahrzeugfakt prüfen',
      needsSellerConfirmation: false,
      status: knowledge?.ok || knowledge?.status === 'unverified_or_missing' ? 'prepared' : 'blocked',
      toolId: 'lookup_vehicle_technical_fact',
      payload: {
        knowledgeResult: knowledge,
        mutatesCustomer: false,
      },
    });
  }

  const needsGroundedKnowledge = intentTypes.has(SELLER_TURN_INTENTS.RESOLVE_VEHICLE)
    || intentTypes.has(SELLER_TURN_INTENTS.LOOKUP_VEHICLE_PACKAGE)
    || intentTypes.has(SELLER_TURN_INTENTS.LOOKUP_VEHICLE_EQUIPMENT)
    || (
      intentTypes.has(SELLER_TURN_INTENTS.DRAFT_MESSAGE)
      && /\b(technologie[-\s]?paket|technik[-\s]?paket|schiebedach|ausstattung)\b/i.test(sellerInput)
      && !intentTypes.has(SELLER_TURN_INTENTS.PREPARE_OFFER)
    );

  if (needsGroundedKnowledge
    && (
      intentTypes.has(SELLER_TURN_INTENTS.RESOLVE_VEHICLE)
      || intentTypes.has(SELLER_TURN_INTENTS.LOOKUP_VEHICLE_PACKAGE)
      || intentTypes.has(SELLER_TURN_INTENTS.LOOKUP_VEHICLE_EQUIPMENT)
    )) {
    const knowledgePreview = resolveGroundedVehicleKnowledge({
      sellerInput,
      lead,
      workingContext,
      offerContext: currentOfferContext,
    });
    if (intentTypes.has(SELLER_TURN_INTENTS.RESOLVE_VEHICLE)) {
      actions.push({
        id: 'resolve_vehicle',
        type: SELLER_TURN_INTENTS.RESOLVE_VEHICLE,
        label: knowledgePreview.vehicleIdentity?.modelLabel
          || knowledgePreview.vehicleIdentity?.modelKey
          || 'Fahrzeug auflösen',
        needsSellerConfirmation: false,
        status: knowledgePreview.vehicleIdentity?.modelKey ? 'prepared' : 'blocked',
        toolId: 'resolve_grounded_vehicle_knowledge',
        payload: {
          vehicleIdentity: knowledgePreview.vehicleIdentity,
          mutatesCustomer: false,
        },
      });
    }
    if (intentTypes.has(SELLER_TURN_INTENTS.LOOKUP_VEHICLE_PACKAGE)) {
      actions.push({
        id: 'lookup_vehicle_package',
        type: SELLER_TURN_INTENTS.LOOKUP_VEHICLE_PACKAGE,
        label: 'Technologie-Paket prüfen',
        needsSellerConfirmation: false,
        status: knowledgePreview.verifiedPackageFacts ? 'prepared' : 'blocked',
        toolId: 'lookup_vehicle_package',
        payload: {
          package: knowledgePreview.verifiedPackageFacts,
          missingKnowledge: knowledgePreview.missingKnowledge,
          mutatesCustomer: false,
        },
      });
    }
    if (intentTypes.has(SELLER_TURN_INTENTS.LOOKUP_VEHICLE_EQUIPMENT)) {
      actions.push({
        id: 'lookup_vehicle_equipment',
        type: SELLER_TURN_INTENTS.LOOKUP_VEHICLE_EQUIPMENT,
        label: 'Ausstattung laden',
        needsSellerConfirmation: false,
        status: knowledgePreview.verifiedEquipmentFacts ? 'prepared' : 'blocked',
        toolId: 'lookup_vehicle_equipment',
        payload: {
          equipment: knowledgePreview.verifiedEquipmentFacts,
          mutatesCustomer: false,
        },
      });
    }
  }

  const offerAction = actions.find((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER);
  const offerIncomplete = Boolean(
    offerAction
    && offerAction.payload
    && offerAction.payload.canCreateOffer === false,
  );

  // Session: „schreib ihm das“ aus Memory (Draft / Knowledge)
  if (
    referentialWrite
    && !actions.some((a) => a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE)
  ) {
    const fromMemory = workingMemory?.lastMessageDraft?.body
      || workingMemory?.lastKnowledgeAnswer?.text
      || null;
    if (fromMemory) {
      actions.push({
        id: 'draft_message',
        type: SELLER_TURN_INTENTS.DRAFT_MESSAGE,
        label: 'Nachricht vorbereiten',
        needsSellerConfirmation: true,
        status: 'prepared',
        toolId: 'draft_customer_message',
        payload: {
          messageDraft: String(fromMemory).slice(0, 4000),
          fromWorkingMemory: true,
          mutatesCustomer: false,
          sendable: true,
        },
      });
    }
  }

  // „Angebot“ allein ist kein Message-Intent – erst verstehen/vorbereiten, dann formulieren.
  const explicitWrite = /\b(schreib(?:e|en)?|sag(?:e|en)?\s+ihm|mail\b|nachricht|danke|lieferzeit|verf(?:ue|u|ü)gbar|nachfass|kundenlink)\b/i.test(sellerInput);
  const hasPrepareOffer = intentTypes.has(SELLER_TURN_INTENTS.PREPARE_OFFER);
  const hasWorkAction = hasPrepareOffer
    || intentTypes.has(SELLER_TURN_INTENTS.DRAFT_MESSAGE)
    || intentTypes.has(SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT);
  const knowledgeOrDashboardOnly = (
    intentTypes.has(SELLER_TURN_INTENTS.GET_TODAY_OVERVIEW)
    || (
      !hasWorkAction
      && (
        intentTypes.has(SELLER_TURN_INTENTS.FIND_CUSTOMER)
        || intentTypes.has(SELLER_TURN_INTENTS.OPEN_CUSTOMER)
        || intentTypes.has(SELLER_TURN_INTENTS.SUMMARIZE_CUSTOMER_CONTEXT)
        || intentTypes.has(SELLER_TURN_INTENTS.CUSTOMER_LOOKUP)
        || intentTypes.has(SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY)
        || intentTypes.has(SELLER_TURN_INTENTS.SEARCH_CUSTOMER_MESSAGES)
        || intentTypes.has(SELLER_TURN_INTENTS.SEARCH_CUSTOMER_OFFERS)
        || intentTypes.has(SELLER_TURN_INTENTS.SEARCH_CUSTOMER_ACTIVITIES)
      )
    )
    || (
      intentTypes.has(SELLER_TURN_INTENTS.LOOKUP_VEHICLE_FACT)
      && !intentTypes.has(SELLER_TURN_INTENTS.DRAFT_MESSAGE)
      && !hasPrepareOffer
      && !explicitWrite
    )
  );
  // Unvollständiges Angebot → kein Kundennachricht-Template (kein Bilder-Satz).
  // Nachricht nur bei explizitem Schreib-Cue oder fertigem Angebot + Write.
  const wantsCustomerMessage = !knowledgeOrDashboardOnly
    && !(hasPrepareOffer && offerIncomplete && !explicitWrite)
    && (
      inputMode === SELLER_INPUT_MODE.CUSTOMER_MESSAGE
      || (intentTypes.has(SELLER_TURN_INTENTS.DRAFT_MESSAGE)
        && (explicitWrite || !hasPrepareOffer))
      || (explicitWrite && !hasPrepareOffer)
      || (explicitWrite && hasPrepareOffer && !offerIncomplete)
      || (hasPrepareOffer && offerAction?.payload?.canCreateOffer && explicitWrite)
    );

  if (
    !intentTypes.has(SELLER_TURN_INTENTS.SEND_PORTFOLIO)
    && !intentTypes.has(SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY)
    && !intentTypes.has(SELLER_TURN_INTENTS.SEARCH_CUSTOMER_MESSAGES)
    && !intentTypes.has(SELLER_TURN_INTENTS.SEARCH_CUSTOMER_OFFERS)
    && !actions.some((a) => a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE)
    && wantsCustomerMessage
  ) {
    const inline = runTool('draft_customer_message', {
      lead,
      sellerInput,
      currentOfferContext,
      customerName,
      workingContext,
    }).result;
    let messageDraft = null;
    const offerUpdateAction = actions.find((a) => (
      a.type === SELLER_TURN_INTENTS.PREPARE_OFFER && a.payload?.updateOnly
    ));

    if (offerIncomplete && intentTypes.has(SELLER_TURN_INTENTS.PREPARE_OFFER) && !explicitWrite) {
      // Primär: Angebot vervollständigen – nur neutraler Zwischenentwurf (sekundär)
      messageDraft = buildOfferPendingInterimDraft({
        lead,
        facts,
        customerName,
        offerPayload: offerAction?.payload,
      });
    } else if (intentTypes.has(SELLER_TURN_INTENTS.PREPARE_OFFER)
      && offerAction?.payload?.canCreateOffer
      && facts.some((f) => f.field === 'purchasePrice' || f.field === 'vehicleInterest')) {
      messageDraft = buildOfferMessageDraft({
        lead,
        sellerInput,
        facts,
        customerName,
        offerPayload: offerAction?.payload,
      });
    } else if (
      currentOfferContext?.offerId
      && (
        detectChipIntent(sellerInput) === 'angebot'
        || isSellerOfferMailShorthand(sellerInput)
      )
    ) {
      messageDraft = buildOfferMessageDraft({
        lead,
        sellerInput,
        facts,
        customerName,
        offerPayload: {
          vehicleLabel: currentOfferContext.title
            || currentOfferContext.modelLabel
            || currentOfferContext.modelKey
            || offerAction?.payload?.vehicleLabel
            || null,
          monthlyRate: currentOfferContext.monthlyRate ?? offerAction?.payload?.monthlyRate ?? null,
          termMonths: currentOfferContext.termMonths ?? null,
          mileagePerYear: currentOfferContext.mileagePerYear ?? null,
          downPayment: currentOfferContext.downPayment ?? null,
          paymentType: currentOfferContext.paymentType ?? null,
          ...(offerAction?.payload || {}),
        },
      });
    } else if (offerUpdateAction || (
      intentTypes.has(SELLER_TURN_INTENTS.PREPARE_OFFER)
      && currentOfferContext?.offerId
      && facts.some((f) => (
        f.field === 'annualMileage'
        || f.field === 'termMonths'
        || f.field === 'desiredRate'
        || f.field === 'downPayment'
      ))
    )) {
      messageDraft = buildOfferUpdateMessageDraft({
        lead,
        facts,
        customerName,
        currentOfferContext,
      });
    } else if (intentTypes.has(SELLER_TURN_INTENTS.DRAFT_MESSAGE)
      && currentOfferContext?.offerId
      && /\b(fass(?:e|en)?|zusammenfass|erkl[aä]r|angehängten?\s+angebot|kurz(?:e)?\s+zusammenfassung)\b/i.test(sellerInput)
    ) {
      messageDraft = buildAttachedOfferSummaryMessageDraft({
        lead,
        customerName,
        currentOfferContext,
      });
    } else if (wantsCustomerMessage && !offerIncomplete && needsGroundedKnowledge) {
      const grounded = prepareGroundedCustomerMessageSync({
        sellerInput,
        lead,
        customerName: customerName || resolvedCustomer?.name || null,
        workingContext,
        offerContext: currentOfferContext,
        allowWithoutPackageDetails: /\bohne\s+paketdetails\b/i.test(sellerInput),
      });
      messageDraft = grounded.messageDraft;
      actions.push({
        id: 'draft_message',
        type: SELLER_TURN_INTENTS.DRAFT_MESSAGE,
        label: grounded.status === 'missing_package_knowledge'
          ? 'Nachricht (Paket unvollständig)'
          : 'Nachricht vorbereiten',
        needsSellerConfirmation: true,
        status: grounded.messageDraft ? 'prepared' : 'blocked',
        toolId: 'draft_customer_message',
        payload: {
          messageDraft: grounded.messageDraft,
          sendable: grounded.sendable,
          knowledgeResult: grounded.knowledge,
          sellerFacts: grounded.knowledge?.sellerFacts || [],
          usedFacts: grounded.usedFacts || [],
          retrievedFacts: grounded.knowledge?.facts || [],
          missingKnowledge: grounded.knowledge?.missingKnowledge || [],
          conflicts: grounded.knowledge?.conflicts || [],
          warnings: grounded.warnings || [],
          uiHint: grounded.uiHint,
          handoff: grounded.handoff,
          mutatesCustomer: false,
          groundedStatus: grounded.status,
        },
      });
      // bereits gepusht – Skip duplicate push unten
      return stampStableMessageDraftIds(actions, workingMemory);
    } else if (wantsCustomerMessage && !offerIncomplete) {
      const instruction = runTool('interpret_message_instruction', { sellerInput }).result;
      const offerFacts = currentOfferContext?.offerId
        ? {
          offerId: currentOfferContext.offerId,
          title: currentOfferContext.title || currentOfferContext.summary || currentOfferContext.shortLabel || null,
          monthlyRate: currentOfferContext.monthlyRate ?? null,
          termMonths: currentOfferContext.termMonths ?? null,
          mileagePerYear: currentOfferContext.mileagePerYear ?? null,
          paymentType: currentOfferContext.paymentType ?? null,
          summary: currentOfferContext.summary || currentOfferContext.shortLabel || null,
        }
        : null;
      const vehicleIdentity = workingContext?.attachedVehicle
        || (currentOfferContext
          ? {
            modelKey: currentOfferContext.modelKey || null,
            modelLabel: currentOfferContext.title || currentOfferContext.modelKey || null,
            trimId: currentOfferContext.trimId || null,
            color: currentOfferContext.color || null,
          }
          : null);
      const chipIntent = detectChipIntent(sellerInput);
      const akteContext = buildMagicAkteContext({
        lead,
        rawSellerInput: sellerInput,
        workingContext,
        offerContext: currentOfferContext,
      });
      const ctx = runTool('build_minimal_message_context', {
        recipient: customerName || 'Kunde',
        rawSellerInstruction: sellerInput,
        vehicleIdentity,
        sellerFacts: instruction?.sellerFacts || [],
        offerFacts,
        tone: 'freundlich',
        akteContext,
        chipIntent: chipIntent || akteContext.chipIntent,
      }).result;
      messageDraft = runTool('write_grounded_message', {
        minimalContext: ctx || {},
        options: {},
      }).result?.body || null;
    }

    if (messageDraft && !validateCustomerMessageNotSellerCommand(messageDraft).ok) {
      messageDraft = offerIncomplete
        ? buildOfferPendingInterimDraft({
          lead,
          facts,
          customerName,
          offerPayload: offerAction?.payload,
        })
        : buildOfferMessageDraft({
          lead,
          sellerInput,
          facts,
          customerName,
          offerPayload: offerAction?.payload,
        });
      if (!validateCustomerMessageNotSellerCommand(messageDraft).ok) {
        messageDraft = null;
      }
    }

    if (messageDraft || inline) {
      actions.push({
        id: 'draft_message',
        type: SELLER_TURN_INTENTS.DRAFT_MESSAGE,
        label: offerIncomplete ? 'Zwischenentwurf' : 'Nachricht vorbereiten',
        needsSellerConfirmation: true,
        status: 'prepared',
        toolId: 'draft_customer_message',
        legacy: inline ?? null,
        payload: {
          messageDraft,
          interimOnly: offerIncomplete,
        },
      });
    }
  }

  return stampStableMessageDraftIds(actions, workingMemory);
}

/**
 * Kompakte Assistenten-Antwort (kein JSON im UI).
 */
export function buildSellerAssistantReply({
  facts = [],
  missingInformation = [],
  preparedActions = [],
  inputMode,
} = {}) {
  if (!facts.length && !preparedActions.length) {
    return null;
  }

  const captured = facts
    .filter((f) => !f.needsConfirmation)
    .map((f) => f.label)
    .slice(0, 8);

  const lines = [];
  if (captured.length) {
    lines.push(`Alles klar. Ich habe die Angaben einsortiert: ${captured.join(' · ')}.`);
  } else {
    lines.push('Alles klar – ich habe den Input verstanden.');
  }

  if (missingInformation.length) {
    const labels = missingInformation.slice(0, 2).map((m) => m.label);
    lines.push(`Noch offen: ${labels.join('; ')}.`);
  }

  if (inputMode === SELLER_INPUT_MODE.AMBIGUOUS) {
    lines.push('Soll ich das dem Kunden senden oder nur intern speichern?');
  }

  const confirmActions = preparedActions.filter((a) => a.needsSellerConfirmation);
  if (confirmActions.length) {
    lines.push(`Vorbereitet: ${confirmActions.map((a) => a.label).join(', ')}.`);
  }

  return lines.join('\n\n');
}
