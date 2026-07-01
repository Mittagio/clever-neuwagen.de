/**
 * Flow „Auto hinzufügen“ aus bestehender Kundenakte
 */
import { generateOfferNumber } from '../logic/offerService.js';
import { normalizeLead } from '../logic/leadNormalization.js';
import { buildDefaultCrm, mapSuggestedModelToReserved } from './dealerAiLeadCrm.js';
import { resolveCustomerId } from './dealerAiCustomer.js';
import { formatCustomerDisplayName } from './dealerAiParser.js';
import { buildKundenaktePath } from './leadAkteEntry.js';
import { buildWishFieldsFromLead } from './dealer/offerEditWishMerge.js';

export const ADD_VEHICLE_SOURCE = 'customer_record';
export const ADD_VEHICLE_CREATED_FROM = 'add_vehicle_from_customer_record';

export function buildAddVehicleContextFromLead(lead, options = {}) {
  if (!lead) return null;
  const customerId = resolveCustomerId(lead);
  if (!customerId) return null;
  const opportunityId = options.opportunityId ?? lead.id ?? null;
  const wishFields = {
    ...buildWishFieldsFromLead(lead),
    ...(options.wishFields ?? {}),
  };
  if (options.paymentType) {
    wishFields.paymentType = options.paymentType;
  }
  return {
    source: ADD_VEHICLE_SOURCE,
    customerId,
    opportunityId,
    leadId: lead.id,
    customerName: formatCustomerDisplayName(lead.contact?.name) || lead.contact?.name?.trim() || '',
    returnPath: options.returnPath ?? buildKundenaktePath(lead.id),
    proposalIntent: options.proposalIntent ?? null,
    paymentType: options.paymentType ?? wishFields.paymentType ?? null,
    wishFields,
  };
}

export function isCustomerRecordAddVehicleContext(ctx) {
  return Boolean(ctx?.source === ADD_VEHICLE_SOURCE && ctx?.customerId);
}

export function getReviewBarButtonLabel(ctx) {
  if (isCustomerRecordAddVehicleContext(ctx)) {
    if (ctx.proposalIntent === 'create_selection_group') {
      return 'Clever Auswahl vorbereiten';
    }
    if (
      ctx.proposalIntent === 'vehicle'
      || ctx.proposalIntent === 'cash'
      || ctx.proposalIntent === 'leasing'
      || ctx.proposalIntent === 'financing'
    ) {
      return 'Fahrzeug konfigurieren';
    }
    if (ctx.paymentType === 'cash' || ctx.proposalIntent === 'cash') {
      return 'Barangebot vorbereiten';
    }
    if (ctx.paymentType === 'financing' || ctx.proposalIntent === 'financing') {
      return 'Finanzierungsvorschlag vorbereiten';
    }
    if (ctx.paymentType === 'leasing' || ctx.proposalIntent === 'leasing') {
      return 'Leasingvorschlag vorbereiten';
    }
    return 'Vorschlag auf den Tisch legen';
  }
  return 'Verkaufschance erstellen';
}

export function getSuccessMessage(ctx, resultMode) {
  if (resultMode === 'attached_to_opportunity') {
    return 'Fahrzeug wurde zur bestehenden Verkaufschance hinzugefügt.';
  }
  if (resultMode === 'new_opportunity_for_customer') {
    return 'Neue Verkaufschance für bestehenden Kunden erstellt.';
  }
  return isCustomerRecordAddVehicleContext(ctx)
    ? 'Fahrzeug zur Kundenakte hinzugefügt.'
    : 'Verkaufschance erstellt';
}

function buildPaymentSideData(fields = {}) {
  const paymentType = fields.paymentType ?? 'unknown';
  const leasingData = paymentType === 'leasing' ? {
    termMonths: fields.termMonths ?? null,
    mileagePerYear: fields.mileagePerYear ?? null,
    desiredRate: fields.desiredRate ?? null,
    downPayment: fields.downPayment ?? 0,
  } : null;
  const financingData = (paymentType === 'financing' || paymentType === 'threeWayFinancing') ? {
    termMonths: fields.termMonths ?? null,
    desiredRate: fields.desiredRate ?? null,
    downPayment: fields.downPayment ?? 0,
    balloonPayment: fields.balloonPayment ?? null,
  } : null;
  const cashPurchaseData = paymentType === 'cash' ? {
    desiredPrice: fields.desiredPrice ?? null,
  } : null;
  return { leasingData, financingData, cashPurchaseData };
}

function applyModelToFields(fields, model) {
  const vehicle = model?.primaryMatch?.vehicle;
  return {
    ...fields,
    brand: vehicle?.brand ?? fields.brand ?? 'Kia',
    model: vehicle?.model ?? model?.name?.replace(/^Kia\s+/i, '') ?? fields.model,
    modelId: model?.modelKey ?? model?.id ?? fields.modelId,
    trimId: vehicle?.trimId ?? fields.trimId ?? null,
    trimLabel: vehicle?.trim ?? model?.trimLabel ?? fields.trimLabel ?? null,
  };
}

export function buildVehicleConfiguration(fields, parsed, model, ctx, index = 0) {
  const merged = model ? applyModelToFields(fields, model) : fields;
  const { leasingData, financingData, cashPurchaseData } = buildPaymentSideData(merged);
  const packages = merged.packageIds ?? merged.selectedPackages ?? [];
  const equipment = merged.equipmentFeatureIds
    ?? merged.selectedEquipmentFeatures
    ?? [];

  return {
    id: `vc-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'vehicle_configuration',
    customerId: ctx?.customerId ?? null,
    opportunityId: ctx?.opportunityId ?? null,
    modelKey: merged.modelId ?? model?.modelKey ?? model?.id ?? '',
    brand: merged.brand ?? 'Kia',
    model: merged.model ?? '',
    trimId: merged.trimId ?? null,
    trimLabel: merged.trimLabel ?? null,
    selectedPackages: Array.isArray(packages) ? packages : [],
    selectedEquipmentFeatures: Array.isArray(equipment) ? equipment : [],
    paymentType: merged.paymentType ?? 'unknown',
    leasingData,
    financingData,
    cashPurchaseData,
    createdFrom: ADD_VEHICLE_CREATED_FROM,
    createdAt: new Date().toISOString(),
  };
}

export function buildVehicleConfigurationsFromSelection(fields, parsed, selectedModelIds = [], ctx) {
  const models = (parsed?.suggestedModels ?? []).filter((m) => selectedModelIds.includes(m.id));
  if (!models.length) {
    return [buildVehicleConfiguration(fields, parsed, null, ctx, 0)];
  }
  return models.map((model, index) => buildVehicleConfiguration(fields, parsed, model, ctx, index));
}

function normalizePackageList(list = []) {
  return [...list].map(String).sort().join('|');
}

function normalizeEquipmentList(list = []) {
  return [...list].map(String).sort().join('|');
}

export function vehicleConfigurationSignature(config = {}) {
  return [
    config.modelKey ?? '',
    config.trimId ?? config.trimLabel ?? '',
    normalizePackageList(config.selectedPackages),
    normalizeEquipmentList(config.selectedEquipmentFeatures),
  ].join('::');
}

export function findDuplicateVehicleConfiguration(existing = [], config) {
  const sig = vehicleConfigurationSignature(config);
  return existing.find((item) => vehicleConfigurationSignature(item) === sig) ?? null;
}

export function findDuplicateInSelection(existing = [], configs = []) {
  for (const config of configs) {
    const duplicate = findDuplicateVehicleConfiguration(existing, config);
    if (duplicate) {
      return { config, duplicate };
    }
  }
  return null;
}

function configToReservedModel(config, modelFromParsed, index) {
  if (modelFromParsed) {
    return mapSuggestedModelToReserved(modelFromParsed, index);
  }
  const name = [config.brand, config.model].filter(Boolean).join(' ').trim() || 'Kia';
  return {
    id: config.id,
    name,
    modelKey: config.modelKey,
    bodyType: 'suv',
    badge: null,
    trimLabel: config.trimLabel,
    priceHint: null,
    reason: null,
    isPrimary: index === 0,
    configurationId: config.id,
  };
}

export function appendVehicleConfigurationsToLead(lead, configs = [], parsed, selectedModelIds = []) {
  const existingConfigs = lead?.crm?.vehicleConfigurations ?? [];
  const existingReserved = lead?.crm?.reservedModels ?? [];
  const suggested = parsed?.suggestedModels ?? [];

  const newReserved = configs.map((config, index) => {
    const model = suggested.find(
      (m) => selectedModelIds.includes(m.id)
        && (m.modelKey === config.modelKey || m.id === config.modelKey),
    ) ?? suggested.find((m) => m.modelKey === config.modelKey || m.id === config.modelKey);
    const reserved = configToReservedModel(config, model, existingReserved.length + index);
    return { ...reserved, configurationId: config.id };
  });

  return {
    crm: {
      ...(lead?.crm ?? {}),
      vehicleConfigurations: [...existingConfigs, ...configs],
      reservedModels: [...existingReserved, ...newReserved],
    },
    updatedAt: new Date().toISOString(),
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

export function buildLeadForExistingCustomer(fields, parsed, conditions, options = {}) {
  const vehicleLabel = [fields.brand, fields.model, fields.trimLabel].filter(Boolean).join(' ').trim();
  const leadId = `lead-ai-${Date.now()}`;
  const now = new Date().toISOString();
  const customerId = options.customerId;
  const crmBase = buildDefaultCrm(parsed, options.selectedModelIds ?? null);

  return normalizeLead({
    id: leadId,
    customerId,
    referenceCode: options.referenceCode ?? null,
    createdAt: now,
    updatedAt: now,
    status: 'neu',
    source: 'dealerAi',
    dealerId: conditions.dealerId ?? 'autohaus-trinkle',
    contact: options.contact ?? {
      name: fields.customerName || 'Kunde (offen)',
      preferredContact: crmBase.preferredContact,
    },
    vehicle: {
      brand: fields.brand ?? 'Kia',
      model: fields.model ?? '',
      trim: fields.trimLabel ?? '',
      engine: fields.motorLabel ?? '',
      label: vehicleLabel || 'Kia – Modell offen',
    },
    paymentType: fields.paymentType ?? 'unknown',
    desiredRate: fields.desiredRate ?? null,
    wish: {
      termMonths: fields.termMonths ?? null,
      mileagePerYear: fields.mileagePerYear ?? null,
      downPayment: fields.downPayment ?? 0,
      paymentType: fields.paymentType ?? 'unknown',
      desiredPrice: fields.desiredPrice ?? null,
    },
    deliveryTime: fields.desiredDeliveryDate ?? fields.deliveryTime ?? null,
    notes: parsed?.shortForm ?? fields.rawText?.slice(0, 500) ?? '',
    crm: crmBase,
    history: [{
      id: `h-${Date.now()}`,
      at: now,
      type: 'system',
      text: 'Verkaufschance für bestehenden Kunden erstellt',
    }],
  });
}

/**
 * Fügt Fahrzeugwünsche an bestehende Kundenakte / Verkaufschance an – ohne neuen Kunden.
 */
export function executeAddVehicleToCustomerRecord(fields, parsed, deps, options = {}) {
  const {
    leads = [],
    updateLead,
    addLead,
    conditions,
    getExistingCodes,
    selectedModelIds = [],
    addVehicleContext,
    carryCustomer,
    forceDuplicate = false,
  } = deps;

  const ctx = addVehicleContext;
  if (!isCustomerRecordAddVehicleContext(ctx)) {
    throw new Error('Kein Kundenkontext für Auto hinzufügen');
  }

  const configs = buildVehicleConfigurationsFromSelection(
    fields,
    parsed,
    selectedModelIds,
    ctx,
  );

  const targetLead = ctx.opportunityId
    ? leads.find((l) => l.id === ctx.opportunityId)
    : null;

  if (targetLead) {
    const existingConfigs = targetLead.crm?.vehicleConfigurations ?? [];
    if (!forceDuplicate) {
      const dup = findDuplicateInSelection(existingConfigs, configs);
      if (dup) {
        return {
          type: 'duplicate',
          duplicate: dup.duplicate,
          pendingConfigs: configs,
          leadId: targetLead.id,
          customerId: ctx.customerId,
        };
      }
    }

    const patch = appendVehicleConfigurationsToLead(
      targetLead,
      configs,
      parsed,
      selectedModelIds,
    );
    updateLead(targetLead.id, patch);

    return {
      type: 'vehicle_added',
      mode: 'attached_to_opportunity',
      leadId: targetLead.id,
      customerId: ctx.customerId,
      configs,
      message: getSuccessMessage(ctx, 'attached_to_opportunity'),
      returnPath: ctx.returnPath ?? buildKundenaktePath(targetLead.id),
    };
  }

  const referenceCode = generateOfferNumber(collectReferenceCodes(getExistingCodes, leads));
  const contact = carryCustomer?.contact ?? {
    name: fields.customerName || ctx.customerName || 'Kunde (offen)',
    phone: '',
    email: '',
  };
  const lead = buildLeadForExistingCustomer(fields, parsed, conditions, {
    customerId: ctx.customerId,
    contact,
    referenceCode,
    selectedModelIds,
  });
  lead.crm = {
    ...lead.crm,
    vehicleConfigurations: configs,
  };
  addLead(lead);

  return {
    type: 'vehicle_added',
    mode: 'new_opportunity_for_customer',
    leadId: lead.id,
    customerId: ctx.customerId,
    configs,
    message: getSuccessMessage(ctx, 'new_opportunity_for_customer'),
    returnPath: ctx.returnPath ?? buildKundenaktePath(lead.id),
  };
}

export function getContextBannerLabel(ctx) {
  if (!isCustomerRecordAddVehicleContext(ctx)) return null;
  const intentLine = {
    vehicle: 'Fahrzeugvorschlag vorbereiten',
    create_selection_group: 'Clever Auswahl vorbereiten',
    cash: 'Barangebot – Kaufpreis statt Leasingrate',
    leasing: 'Leasingvorschlag vorbereiten',
    financing: 'Finanzierungsvorschlag vorbereiten',
  }[ctx.proposalIntent];
  if (intentLine) return intentLine;
  if (ctx.customerName) {
    return `Vorschlag für: ${ctx.customerName}`;
  }
  return 'Vorschlag auf den Tisch legen';
}
