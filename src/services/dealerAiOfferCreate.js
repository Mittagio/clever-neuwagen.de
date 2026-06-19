/**
 * Dealer AI – Angebot aus live Configure-Draft erstellen
 */
import { generateOfferNumber } from '../logic/offerService.js';
import { normalizeLead } from '../logic/leadNormalization.js';
import {
  buildDefaultCrm,
  computeFollowUpAt,
  formatReservedModelName,
  FOLLOW_UP_CHIPS,
  pipelineToLeadStatus,
} from './dealerAiLeadCrm.js';
import { createCustomerId } from './dealerAiCustomer.js';
import {
  appendVehicleConfigurationsToLead,
  buildLeadForExistingCustomer,
} from './customerAddVehicleFlow.js';
import {
  buildOfferPreview,
  fieldsFromConfigureDraft,
} from './dealerAiVehicleConfigureFlow.js';
import {
  customerContextFromDraft,
  mergeConfigureCustomerContext,
} from './dealerAiCustomerContext.js';
import { joinKundenhelferNotes, parseKundenhelferNotes } from './cleverKundenhelfer.js';
import { VEHICLE_OFFER_STATUS } from './vehicleOffer.js';
import { PAYMENT_TYPE_LABELS } from './dealerAiParser.js';

export function normalizeOfferPaymentType(paymentType = 'leasing') {
  if (paymentType === 'financing' || paymentType === 'threeWayFinancing') return 'financing';
  if (paymentType === 'cash') return 'cash';
  return 'leasing';
}

export function resolveOfferCustomerContext({
  carryCustomer = null,
  addVehicleContext = null,
  lead = null,
} = {}) {
  const customerId = addVehicleContext?.customerId
    ?? carryCustomer?.customerId
    ?? lead?.customerId
    ?? null;
  const opportunityId = addVehicleContext?.opportunityId
    ?? (customerId && lead?.id ? lead.id : null)
    ?? null;

  return {
    customerId,
    opportunityId,
    needsCustomerSelection: !customerId,
    needsNewOpportunity: Boolean(customerId && !opportunityId),
  };
}

export function resolveOfferSaveMode(offerDraft) {
  const { customerId, opportunityId } = offerDraft ?? {};
  if (!customerId) return 'needs_customer_selection';
  if (opportunityId) return 'attach_to_opportunity';
  return 'new_opportunity_for_customer';
}

function buildPaymentSideData(payment = {}) {
  const paymentType = normalizeOfferPaymentType(payment.type);
  return {
    leasingData: paymentType === 'leasing' ? {
      termMonths: payment.termMonths ?? null,
      mileagePerYear: payment.mileagePerYear ?? null,
      desiredRate: payment.budget ?? null,
      calculatedRate: payment.calculatedRate ?? null,
      downPayment: payment.downPayment ?? 0,
    } : null,
    financingData: paymentType === 'financing' ? {
      termMonths: payment.termMonths ?? null,
      desiredRate: payment.budget ?? null,
      calculatedRate: payment.calculatedRate ?? null,
      downPayment: payment.downPayment ?? 0,
    } : null,
    cashPurchaseData: paymentType === 'cash' ? {
      desiredPrice: payment.budget ?? null,
      calculatedPrice: payment.calculatedRate ?? null,
    } : null,
  };
}

export function buildOfferDraft({
  configureDraft,
  parsed,
  conditions,
  carryCustomer = null,
  addVehicleContext = null,
  lead = null,
}) {
  if (!configureDraft) return null;

  const parsedFields = parsed?.fields ?? {};
  const mergedFields = fieldsFromConfigureDraft(configureDraft, parsedFields);
  const preview = buildOfferPreview(configureDraft, conditions, mergedFields);
  const crmContext = mergeConfigureCustomerContext({
    parsedFields: mergedFields,
    carryCustomer,
    addVehicleContext,
    lead,
  });
  const customer = customerContextFromDraft(configureDraft, crmContext);
  const customerCtx = resolveOfferCustomerContext({ carryCustomer, addVehicleContext, lead });

  const paymentType = normalizeOfferPaymentType(configureDraft.paymentType);
  const budget = paymentType === 'cash'
    ? (configureDraft.desiredPrice ?? mergedFields.desiredPrice ?? null)
    : (configureDraft.desiredRate ?? mergedFields.desiredRate ?? null);

  return {
    customerId: customerCtx.customerId,
    opportunityId: customerCtx.opportunityId,
    customer: {
      salutation: configureDraft.customer?.salutation ?? mergedFields.customerSalutation ?? null,
      firstName: configureDraft.customer?.firstName ?? customer.firstName ?? null,
      lastName: configureDraft.customer?.lastName ?? customer.lastName ?? null,
      name: customer.name ?? mergedFields.customerName ?? null,
      phone: configureDraft.customer?.phone ?? customer.phone ?? null,
      email: configureDraft.customer?.email ?? customer.email ?? null,
      mailNote: configureDraft.customer?.mailNote ?? mergedFields.customerMailNote ?? null,
    },
    vehicle: {
      brand: configureDraft.brand ?? mergedFields.brand ?? 'Kia',
      model: configureDraft.model ?? mergedFields.model ?? '',
      modelKey: configureDraft.modelKey ?? mergedFields.modelId ?? '',
      trimId: configureDraft.trimId ?? mergedFields.trimId ?? null,
      trimLabel: configureDraft.trimLabel ?? mergedFields.trimLabel ?? null,
      battery: configureDraft.batteryLabel ?? mergedFields.batteryLabel ?? null,
      engineId: configureDraft.engineId ?? mergedFields.engineId ?? null,
      color: configureDraft.colorLabel ?? mergedFields.colorLabel ?? null,
      colorId: configureDraft.colorId ?? mergedFields.colorId ?? null,
      selectedPackages: configureDraft.packageIds ?? mergedFields.packageIds ?? [],
      selectedEquipmentFeatures: configureDraft.specialEquipment ?? mergedFields.specialEquipment ?? [],
    },
    payment: {
      type: paymentType,
      termMonths: configureDraft.termMonths ?? mergedFields.termMonths ?? null,
      mileagePerYear: configureDraft.mileagePerYear ?? mergedFields.mileagePerYear ?? null,
      downPayment: configureDraft.downPayment ?? mergedFields.downPayment ?? 0,
      budget,
      calculatedRate: preview.monthlyRate ?? null,
      transferCost: configureDraft.preparationFee ?? conditions?.preparationFee ?? 1290,
      maintenance: Boolean(configureDraft.extras?.wartung),
      insurance: Boolean(configureDraft.extras?.versicherung),
      winterWheels: Boolean(configureDraft.extras?.winterraeder),
      towBar: Boolean(configureDraft.extras?.ahk),
    },
    timing: {
      desiredDeliveryDate: configureDraft.desiredDeliveryDate ?? mergedFields.desiredDeliveryDate ?? null,
      leasingEnd: configureDraft.leasingEndDate ?? mergedFields.leasingEndDate ?? null,
      vehicleChangePlanned: Boolean(
        configureDraft.vehicleChangeIntent ?? mergedFields.vehicleChangeIntent,
      ),
      urgentNeed: Boolean(
        configureDraft.immediateAvailability ?? mergedFields.immediateAvailability,
      ),
    },
    source: {
      createdFrom: 'dealer_ai_mail',
      originalText: parsedFields.rawText ?? parsed?.rawInput ?? '',
      parsedFields: mergedFields,
      confidence: parsed?.confidence ?? null,
    },
  };
}

export function offerDraftToParserFields(offerDraft) {
  const { vehicle, payment, customer, timing, source } = offerDraft;
  const paymentType = payment.type === 'financing' ? 'financing' : payment.type;
  return {
    ...source.parsedFields,
    brand: vehicle.brand,
    model: vehicle.model,
    modelId: vehicle.modelKey,
    trimId: vehicle.trimId,
    trimLabel: vehicle.trimLabel,
    engineId: vehicle.engineId,
    batteryLabel: vehicle.battery,
    colorId: vehicle.colorId,
    colorLabel: vehicle.color,
    packageIds: vehicle.selectedPackages ?? [],
    specialEquipment: vehicle.selectedEquipmentFeatures ?? [],
    paymentType,
    termMonths: payment.termMonths,
    mileagePerYear: payment.mileagePerYear,
    downPayment: payment.downPayment ?? 0,
    desiredRate: payment.budget,
    calculatedRate: payment.calculatedRate,
    desiredPrice: payment.type === 'cash' ? payment.budget : source.parsedFields?.desiredPrice ?? null,
    desiredDeliveryDate: timing.desiredDeliveryDate,
    leasingEndDate: timing.leasingEnd,
    vehicleChangeIntent: timing.vehicleChangePlanned,
    immediateAvailability: timing.urgentNeed,
    customerName: customer.name,
    customerFirstName: customer.firstName,
    customerLastName: customer.lastName,
    customerSalutation: customer.salutation,
    customerPhone: customer.phone,
    customerEmail: customer.email,
    customerMailNote: customer.mailNote,
    rawText: source.originalText,
  };
}

export function offerDraftToVehicleConfiguration(offerDraft, configId = null) {
  const { vehicle, payment, customerId, opportunityId } = offerDraft;
  const paymentType = normalizeOfferPaymentType(payment.type);
  const { leasingData, financingData, cashPurchaseData } = buildPaymentSideData(payment);

  return {
    id: configId ?? `vc-${Date.now()}`,
    type: 'vehicle_configuration',
    customerId: customerId ?? null,
    opportunityId: opportunityId ?? null,
    modelKey: vehicle.modelKey,
    brand: vehicle.brand,
    model: vehicle.model,
    trimId: vehicle.trimId,
    trimLabel: vehicle.trimLabel,
    engineId: vehicle.engineId,
    batteryLabel: vehicle.battery,
    colorId: vehicle.colorId,
    colorLabel: vehicle.color,
    selectedPackages: vehicle.selectedPackages ?? [],
    selectedEquipmentFeatures: vehicle.selectedEquipmentFeatures ?? [],
    paymentType,
    leasingData,
    financingData,
    cashPurchaseData,
    extras: {
      maintenance: payment.maintenance,
      insurance: payment.insurance,
      winterWheels: payment.winterWheels,
      towBar: payment.towBar,
    },
    timing: offerDraft.timing,
    createdFrom: offerDraft.source.createdFrom,
    createdAt: new Date().toISOString(),
  };
}

export function offerDraftToVehicleCard(offerDraft, options = {}) {
  const { vehicle, payment, opportunityId } = offerDraft;
  const modelName = /^kia\b/i.test(vehicle.model ?? '')
    ? vehicle.model
    : `${vehicle.brand ?? 'Kia'} ${vehicle.model ?? ''}`.trim();
  const configId = options.configId ?? options.cardId ?? `vc-${Date.now()}`;
  const paymentType = normalizeOfferPaymentType(payment.type);

  return {
    id: configId,
    leadId: opportunityId ?? null,
    modelKey: vehicle.modelKey,
    modelName: modelName || 'Kia',
    trimLabel: vehicle.trimLabel,
    bodyType: 'suv',
    paymentType: paymentType === 'financing' ? 'financing' : paymentType,
    termMonths: payment.termMonths,
    mileagePerYear: payment.mileagePerYear,
    desiredRate: payment.calculatedRate,
    desiredPrice: paymentType === 'cash' ? payment.calculatedRate : null,
    downPayment: payment.downPayment ?? 0,
    transferCost: payment.transferCost,
    configurationId: configId,
    source: 'dealer_ai_configure',
    badge: 'Clever Empfehlung',
    isPrimary: true,
  };
}

function mergeKundenhelferNotes(existingNotes = '', additions = []) {
  const parts = parseKundenhelferNotes(existingNotes);
  for (const item of additions) {
    const trimmed = String(item ?? '').trim();
    if (trimmed && !parts.includes(trimmed)) parts.push(trimmed);
  }
  return joinKundenhelferNotes(parts);
}

export function buildOfferSavedActivityText(offerDraft) {
  const vehicle = [offerDraft.vehicle.model, offerDraft.vehicle.trimLabel].filter(Boolean).join(' ');
  const parts = [];
  if (offerDraft.payment.termMonths) parts.push(`${offerDraft.payment.termMonths} Monate`);
  if (offerDraft.payment.mileagePerYear) {
    parts.push(`${Number(offerDraft.payment.mileagePerYear).toLocaleString('de-DE')} km`);
  }
  if (offerDraft.payment.calculatedRate != null) {
    parts.push(`${Number(offerDraft.payment.calculatedRate).toLocaleString('de-DE')} €/Monat`);
  }
  const tail = parts.length ? ` · ${parts.join(' · ')}` : '';
  return `Clever Empfehlung gespeichert: ${vehicle}${tail}`;
}

export function buildKundenhelferChipsFromOfferDraft(offerDraft) {
  const chips = [];
  const extras = [];
  const { payment, timing, customer, source } = offerDraft;
  const fields = source.parsedFields ?? {};

  if (timing.urgentNeed || timing.desiredDeliveryDate === 'sofort') {
    chips.push('braucht Auto sofort');
  }
  if (timing.vehicleChangePlanned || timing.leasingEnd) {
    chips.push('Leasing läuft aus');
  }
  if (payment.budget != null && payment.calculatedRate != null && payment.calculatedRate > payment.budget) {
    chips.push('Preis sehr wichtig');
  }
  if (customer.email?.trim() && !customer.phone?.trim()) {
    chips.push('lieber E-Mail');
  }
  if (customer.phone?.trim() && !customer.email?.trim()) {
    chips.push('bevorzugt WhatsApp');
  }

  if (payment.towBar) extras.push('AHK gewünscht');
  if (payment.winterWheels) extras.push('Winterräder gewünscht');
  if (payment.maintenance) extras.push('Wartungspaket');
  if (payment.insurance) extras.push('Versicherung');
  if (Array.isArray(fields.specialEquipment)) {
    extras.push(...fields.specialEquipment.filter(Boolean));
  }
  if (customer.mailNote?.trim()) extras.push(customer.mailNote.trim());

  return { chips, extras };
}

function inferPreferredContact(offerDraft) {
  const { customer } = offerDraft;
  if (customer.phone?.trim()) return 'phone';
  if (customer.email?.trim()) return 'email';
  return 'phone';
}

function upsertPrimaryReservedFromOfferDraft(reservedModels = [], offerDraft, configId) {
  const modelName = formatReservedModelName(
    `${offerDraft.vehicle.brand ?? 'Kia'} ${offerDraft.vehicle.model ?? ''}`.trim(),
  );
  const rateHint = offerDraft.payment.calculatedRate != null
    ? `${Number(offerDraft.payment.calculatedRate).toLocaleString('de-DE')} €/Monat`
    : null;
  const primary = {
    id: configId,
    name: modelName,
    modelKey: offerDraft.vehicle.modelKey,
    trimLabel: offerDraft.vehicle.trimLabel,
    bodyType: 'suv',
    badge: 'Clever Empfehlung',
    priceHint: rateHint,
    reason: buildOfferSavedActivityText(offerDraft),
    isPrimary: true,
    configurationId: configId,
  };
  const rest = reservedModels
    .filter((m) => m.configurationId !== configId && m.id !== configId)
    .map((m) => ({ ...m, isPrimary: false }));
  return [primary, ...rest];
}

function buildCrmOfferEntry(offerDraft, configId) {
  const vehicleTitle = [
    offerDraft.vehicle.model,
    offerDraft.vehicle.trimLabel,
    offerDraft.vehicle.battery,
  ].filter(Boolean).join(' ');
  const paymentLabel = PAYMENT_TYPE_LABELS[offerDraft.payment.type === 'financing' ? 'financing' : offerDraft.payment.type]
    ?.replace(' / Barzahlung', '')
    ?? offerDraft.payment.type;

  return {
    id: configId,
    code: null,
    name: vehicleTitle,
    vehicle: vehicleTitle,
    paymentType: paymentLabel,
    status: 'draft',
    monthlyRate: offerDraft.payment.calculatedRate,
    termMonths: offerDraft.payment.termMonths,
    mileagePerYear: offerDraft.payment.mileagePerYear,
    downPayment: offerDraft.payment.downPayment ?? 0,
    createdAt: new Date().toISOString(),
  };
}

function mergeCrmOffers(existingOffers = [], nextOffer) {
  const withoutDup = existingOffers.filter((o) => o.id !== nextOffer.id);
  return [nextOffer, ...withoutDup];
}

export function buildKundenakteEnrichmentFromOfferDraft(offerDraft, {
  configId,
  card = null,
  existingLead = null,
} = {}) {
  const cardId = configId ?? card?.id;
  const nextStepId = 'send_offer';
  const nextStepChip = FOLLOW_UP_CHIPS.find((c) => c.id === nextStepId);
  const { chips, extras } = buildKundenhelferChipsFromOfferDraft(offerDraft);
  const existingNotes = existingLead?.crm?.kundenhelfer?.notes ?? '';
  const kundenhelferNotes = mergeKundenhelferNotes(existingNotes, [...chips, ...extras]);
  const crmOffer = buildCrmOfferEntry(offerDraft, cardId);
  const now = new Date().toISOString();
  const historyEntry = {
    id: `h-${Date.now()}`,
    at: now,
    type: 'offer',
    text: buildOfferSavedActivityText(offerDraft),
  };

  return {
    crmPatch: {
      pipelineStatusId: 'angebot_erstellt',
      nextStepId,
      nextStepLabel: nextStepChip?.label ?? 'Angebot senden',
      followUpAt: computeFollowUpAt(nextStepId),
      preferredContact: inferPreferredContact(offerDraft),
      kundenhelfer: {
        notes: kundenhelferNotes,
        voiceMemos: existingLead?.crm?.kundenhelfer?.voiceMemos ?? [],
      },
      offers: mergeCrmOffers(existingLead?.crm?.offers ?? [], crmOffer),
      vehicleOffers: {
        [cardId]: {
          id: `vo-${cardId}`,
          vehicleCardId: cardId,
          status: VEHICLE_OFFER_STATUS.DRAFT,
          downPayment: offerDraft.payment.downPayment ?? 0,
          deliveryFee: offerDraft.payment.transferCost ?? 990,
          pdf: null,
          onlineLink: null,
          tracking: { openCount: 0, lastOpenedAt: null, firstOpenedAt: null },
          sentVia: null,
          sentAt: null,
          createdAt: now,
          updatedAt: now,
        },
      },
      lastOfferAt: now,
      lastOfferStatus: 'draft',
    },
    historyEntry,
    activityText: historyEntry.text,
    crmOffer,
  };
}

export function finalizeLeadWithOfferDraft(lead, offerDraft, {
  config,
  card,
  enrichedParsed,
  selectedModelIds = [],
}) {
  const withConfig = appendVehicleConfigurationsToLead(
    lead,
    [config],
    enrichedParsed,
    selectedModelIds,
  );
  const enrichment = buildKundenakteEnrichmentFromOfferDraft(offerDraft, {
    configId: config.id,
    card,
    existingLead: lead,
  });

  const reservedModels = upsertPrimaryReservedFromOfferDraft(
    withConfig.crm.reservedModels,
    offerDraft,
    config.id,
  );

  const mergedCrm = {
    ...withConfig.crm,
    ...enrichment.crmPatch,
    reservedModels,
    kundenhelfer: enrichment.crmPatch.kundenhelfer,
    offers: enrichment.crmPatch.offers,
    vehicleOffers: {
      ...(lead?.crm?.vehicleOffers ?? {}),
      ...enrichment.crmPatch.vehicleOffers,
    },
  };

  return {
    ...buildLeadPatchFromOfferDraft(offerDraft),
    status: pipelineToLeadStatus(enrichment.crmPatch.pipelineStatusId),
    crm: mergedCrm,
    updatedAt: new Date().toISOString(),
    historyEntry: enrichment.historyEntry,
    activityText: enrichment.activityText,
  };
}

function collectReferenceCodes(getExistingCodes, leads = []) {
  const codes = [];
  const existing = getExistingCodes?.();
  if (existing) {
    for (const code of existing) codes.push({ code });
  }
  for (const lead of leads) {
    if (lead.referenceCode) codes.push({ code: lead.referenceCode });
    if (lead.offerCode) codes.push({ code: lead.offerCode });
  }
  return codes;
}

function buildLeadPatchFromOfferDraft(offerDraft) {
  const fields = offerDraftToParserFields(offerDraft);
  const vehicleLabel = [fields.brand, fields.model, fields.trimLabel].filter(Boolean).join(' ').trim();
  return {
    contact: {
      name: offerDraft.customer.name ?? 'Kunde (offen)',
      phone: offerDraft.customer.phone ?? '',
      email: offerDraft.customer.email ?? '',
    },
    vehicle: {
      brand: fields.brand ?? 'Kia',
      model: fields.model ?? '',
      trim: fields.trimLabel ?? '',
      engine: fields.batteryLabel ?? fields.motorLabel ?? '',
      label: vehicleLabel || 'Kia – Modell offen',
    },
    paymentType: fields.paymentType ?? 'unknown',
    desiredRate: offerDraft.payment.calculatedRate ?? fields.desiredRate ?? null,
    wish: {
      termMonths: fields.termMonths ?? null,
      mileagePerYear: fields.mileagePerYear ?? null,
      downPayment: fields.downPayment ?? 0,
      paymentType: fields.paymentType ?? 'unknown',
      desiredPrice: fields.desiredPrice ?? null,
      desiredDeliveryDate: fields.desiredDeliveryDate ?? null,
    },
    deliveryTime: fields.desiredDeliveryDate ?? null,
    notes: fields.rawText?.slice(0, 500) ?? '',
  };
}

function buildLeadFromOfferDraft(offerDraft, parsed, conditions, options = {}) {
  const fields = offerDraftToParserFields(offerDraft);
  const vehicleLabel = [fields.brand, fields.model, fields.trimLabel].filter(Boolean).join(' ').trim();
  const leadId = options.leadId ?? `lead-ai-${Date.now()}`;
  const now = new Date().toISOString();
  const customerId = offerDraft.customerId ?? options.customerId ?? createCustomerId();
  const crmBase = buildDefaultCrm(
    { ...parsed, fields },
    options.selectedModelIds ?? null,
  );

  return normalizeLead({
    id: leadId,
    customerId,
    referenceCode: options.referenceCode ?? null,
    createdAt: now,
    updatedAt: now,
    status: pipelineToLeadStatus('angebot_erstellt'),
    source: 'dealerAi',
    dealerId: conditions.dealerId ?? 'autohaus-trinkle',
    contact: {
      name: offerDraft.customer.name || 'Kunde (offen)',
      phone: offerDraft.customer.phone ?? '',
      email: offerDraft.customer.email ?? '',
      preferredContact: crmBase.preferredContact,
    },
    vehicle: {
      brand: fields.brand ?? 'Kia',
      model: fields.model ?? '',
      trim: fields.trimLabel ?? '',
      engine: fields.batteryLabel ?? '',
      label: vehicleLabel || 'Kia – Modell offen',
    },
    paymentType: fields.paymentType ?? 'unknown',
    desiredRate: offerDraft.payment.calculatedRate ?? fields.desiredRate ?? null,
    wish: {
      termMonths: fields.termMonths ?? null,
      mileagePerYear: fields.mileagePerYear ?? null,
      downPayment: fields.downPayment ?? 0,
      paymentType: fields.paymentType ?? 'unknown',
      desiredPrice: fields.desiredPrice ?? null,
      desiredDeliveryDate: fields.desiredDeliveryDate ?? null,
    },
    deliveryTime: fields.desiredDeliveryDate ?? null,
    notes: fields.rawText?.slice(0, 500) ?? '',
    crm: crmBase,
    history: [],
  });
}

function buildParsedFromOfferDraft(offerDraft, parsed = {}) {
  const fields = offerDraftToParserFields(offerDraft);
  return {
    ...parsed,
    ok: true,
    fields,
  };
}

/**
 * Speichert den Offer-Draft anhand des Kundenkontexts.
 */
export function executeSaveOfferDraft(offerDraft, deps) {
  const {
    parsed,
    conditions,
    leads = [],
    addLead,
    updateLead,
    getExistingCodes,
    selectedModelIds = [],
  } = deps;

  if (!offerDraft) {
    throw new Error('Kein Angebotsentwurf vorhanden');
  }

  const mode = resolveOfferSaveMode(offerDraft);
  const fields = offerDraftToParserFields(offerDraft);
  const config = offerDraftToVehicleConfiguration(offerDraft);
  const card = offerDraftToVehicleCard(offerDraft, { configId: config.id, cardId: config.id });
  const enrichedParsed = buildParsedFromOfferDraft(offerDraft, parsed);

  if (mode === 'attach_to_opportunity') {
    const targetLead = leads.find((l) => l.id === offerDraft.opportunityId);
    if (!targetLead) {
      throw new Error('Verkaufschance nicht gefunden');
    }

    const finalized = finalizeLeadWithOfferDraft(targetLead, offerDraft, {
      config,
      card,
      enrichedParsed,
      selectedModelIds,
    });
    const { historyEntry, activityText, ...leadUpdate } = finalized;

    updateLead(targetLead.id, leadUpdate);

    return {
      type: 'offer_saved',
      mode: 'attached_to_opportunity',
      leadId: targetLead.id,
      customerId: offerDraft.customerId,
      card,
      offerDraft,
      historyEntry,
      activityText,
      message: 'Kundenakte aktualisiert – Angebot auf dem Tisch',
    };
  }

  if (mode === 'new_opportunity_for_customer') {
    const referenceCode = generateOfferNumber(collectReferenceCodes(getExistingCodes, leads));
    const baseLead = buildLeadForExistingCustomer(fields, enrichedParsed, conditions, {
      customerId: offerDraft.customerId,
      referenceCode,
      contact: {
        name: offerDraft.customer.name ?? 'Kunde (offen)',
        phone: offerDraft.customer.phone ?? '',
        email: offerDraft.customer.email ?? '',
      },
      selectedModelIds,
    });
    const finalized = finalizeLeadWithOfferDraft(
      { ...baseLead, ...buildLeadPatchFromOfferDraft(offerDraft) },
      offerDraft,
      {
        config,
        card,
        enrichedParsed,
        selectedModelIds,
      },
    );
    const { historyEntry, activityText, ...leadUpdate } = finalized;
    const lead = {
      ...baseLead,
      ...leadUpdate,
      referenceCode,
    };
    addLead(lead);

    return {
      type: 'offer_saved',
      mode: 'new_opportunity_for_customer',
      leadId: lead.id,
      customerId: offerDraft.customerId,
      card,
      offerDraft,
      historyEntry,
      activityText,
      message: 'Kundenakte für bestehenden Kunden angelegt',
    };
  }

  const referenceCode = generateOfferNumber(collectReferenceCodes(getExistingCodes, leads));
  const baseLead = buildLeadFromOfferDraft(offerDraft, enrichedParsed, conditions, {
    referenceCode,
    selectedModelIds,
  });
  const finalized = finalizeLeadWithOfferDraft(baseLead, offerDraft, {
    config,
    card,
    enrichedParsed,
    selectedModelIds,
  });
  const { historyEntry, activityText, ...leadUpdate } = finalized;
  const lead = {
    ...baseLead,
    ...leadUpdate,
  };
  addLead(lead);

  return {
    type: 'offer_saved',
    mode: 'needs_customer_selection',
    leadId: lead.id,
    customerId: lead.customerId,
    card,
    offerDraft,
    historyEntry,
    activityText,
    needsCapture: true,
    message: 'Kundenakte vorbereitet – Kunde zuordnen',
  };
}
