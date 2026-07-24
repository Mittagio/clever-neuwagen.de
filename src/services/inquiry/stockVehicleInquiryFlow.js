/**
 * Bestandsfahrzeug-Anfrage aus eingefügtem Text → Kundenakte, Eingang, Kalkulator
 */
import { generateOfferNumber } from '../../logic/offerService.js';
import { normalizeLead } from '../../logic/leadNormalization.js';
import { buildDefaultCrm } from '../dealerAiLeadCrm.js';
import { createCustomerId } from '../dealerAiCustomer.js';
import { buildKundenaktePath } from '../leadAkteEntry.js';
import {
  createInboxItem,
  INBOX_EVENT_TYPES,
  INBOX_PRIORITY,
  INBOX_SOURCE_AREA,
  INBOX_STATUS,
} from '../crm/cleverInboxService.js';
import { INQUIRY_TYPES } from './pasteInquiryClassifier.js';
import { organizeInquiryText } from '../dealer/notepadLabelSuggestions.js';
import {
  appendSellerInsightsFromTexts,
  SELLER_INSIGHT_CONTEXT,
} from '../dealer/sellerInsights.js';

function uid(prefix = 'stock') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizePhone(phone) {
  return String(phone ?? '').replace(/\D/g, '');
}

export function normalizeRequestedStockVehicle(input = {}, rawText = '') {
  const now = new Date().toISOString();
  return {
    id: input.id ?? uid('rsv'),
    source: input.source ?? 'unknown',
    sourceLabel: input.sourceLabel ?? 'Unbekannte Quelle',
    vehicleTitle: input.vehicleTitle ?? null,
    price: input.price ?? null,
    stockNumber: input.stockNumber ?? null,
    vehicleUrl: input.vehicleUrl ?? null,
    availabilityLabel: input.availabilityLabel ?? null,
    requestedAt: input.requestedAt ?? now,
    rawText: input.rawText ?? rawText,
  };
}

export function readRequestedStockVehicles(lead) {
  const crm = lead?.crm ?? {};
  if (Array.isArray(crm.requestedStockVehicles) && crm.requestedStockVehicles.length) {
    return crm.requestedStockVehicles;
  }
  if (crm.requestedStockVehicle) {
    return [crm.requestedStockVehicle];
  }
  return [];
}

export function getPrimaryRequestedStockVehicle(lead) {
  const items = readRequestedStockVehicles(lead);
  return items[0] ?? null;
}

/**
 * @param {object} extraction
 * @param {object[]} leads
 */
export function findLeadForStockInquiry(extraction, leads = []) {
  const email = extraction?.customer?.email?.toLowerCase?.();
  const phone = normalizePhone(extraction?.customer?.phone);

  if (email) {
    const byEmail = leads.find((lead) => String(lead.contact?.email ?? '').toLowerCase() === email);
    if (byEmail) return byEmail;
  }

  if (phone.length >= 8) {
    const byPhone = leads.find((lead) => {
      const leadPhone = normalizePhone(lead.contact?.phone);
      return leadPhone && (leadPhone === phone || leadPhone.endsWith(phone.slice(-8)) || phone.endsWith(leadPhone.slice(-8)));
    });
    if (byPhone) return byPhone;
  }

  return null;
}

function buildContactFromExtraction(extraction = {}) {
  const customer = extraction.customer ?? {};
  const name = customer.fullName
    ?? [customer.firstName, customer.lastName].filter(Boolean).join(' ')
    ?? 'Kunde (offen)';
  return {
    name,
    firstName: customer.firstName ?? null,
    lastName: customer.lastName ?? null,
    salutation: customer.salutation ?? null,
    phone: customer.phone ?? null,
    email: customer.email ?? null,
    company: customer.company ?? null,
  };
}

function buildStockVehicleCrmPatch(existingCrm = {}, stockVehicle) {
  const previous = readRequestedStockVehicles({ crm: existingCrm });
  const nextItem = normalizeRequestedStockVehicle(stockVehicle);
  const withoutDup = previous.filter((entry) => entry.stockNumber !== nextItem.stockNumber
    || entry.vehicleTitle !== nextItem.vehicleTitle);
  const requestedStockVehicles = [nextItem, ...withoutDup].slice(0, 5);
  return {
    ...existingCrm,
    requestedStockVehicles,
    requestedStockVehicle: requestedStockVehicles[0],
  };
}

function buildOrganizedSellerInsights(leadLike, extraction = {}, stockVehicle = {}) {
  const raw = extraction.rawText
    || stockVehicle.rawText
    || extraction.customerMessage
    || '';
  const labels = organizeInquiryText(raw);
  if (!labels.length) return leadLike?.crm?.sellerInsights ?? [];
  return appendSellerInsightsFromTexts(leadLike ?? { crm: {} }, labels, {
    context: SELLER_INSIGHT_CONTEXT.EMAIL,
  }).crm.sellerInsights;
}

function buildNewLeadFromStockInquiry(extraction, stockVehicle, deps = {}) {
  const { conditions = {}, getExistingCodes, leads = [] } = deps;
  const now = new Date().toISOString();
  const contact = buildContactFromExtraction(extraction);
  const referenceCode = generateOfferNumber(collectReferenceCodes(getExistingCodes, leads));
  const customerId = createCustomerId();
  const crmBase = buildStockVehicleCrmPatch(buildDefaultCrm(), stockVehicle);
  const sellerInsights = buildOrganizedSellerInsights({ crm: crmBase }, extraction, stockVehicle);

  const vehicleLabel = stockVehicle.vehicleTitle ?? 'Bestandsfahrzeug';
  return normalizeLead({
    id: uid('lead'),
    customerId,
    referenceCode,
    createdAt: now,
    updatedAt: now,
    status: 'neu',
    source: 'dealerAi',
    dealerId: conditions.dealerId ?? 'autohaus-trinkle',
    contact,
    vehicle: {
      brand: vehicleLabel.startsWith('Kia') ? 'Kia' : 'Fahrzeug',
      model: vehicleLabel.replace(/^Kia\s+/i, ''),
      label: vehicleLabel,
    },
    paymentType: 'unknown',
    notes: extraction.customerMessage ?? '',
    crm: {
      ...crmBase,
      sellerInsights,
    },
    history: [{
      id: uid('h'),
      at: now,
      type: 'system',
      text: `Bestandsfahrzeug-Anfrage erkannt (${stockVehicle.sourceLabel ?? 'Quelle unbekannt'})`,
    }],
  });
}

function collectReferenceCodes(getExistingCodes, leads = []) {
  const codes = [];
  const existing = getExistingCodes?.();
  if (existing) {
    for (const code of existing) codes.push({ code });
  }
  for (const lead of leads) {
    if (lead.referenceCode) codes.push({ code: lead.referenceCode });
  }
  return codes;
}

function buildLeadPatchFromStockInquiry(existingLead, extraction, stockVehicle) {
  const now = new Date().toISOString();
  const contact = buildContactFromExtraction(extraction);
  const crmBase = buildStockVehicleCrmPatch(existingLead.crm ?? {}, stockVehicle);
  const sellerInsights = buildOrganizedSellerInsights(existingLead, extraction, stockVehicle);
  const vehicleLabel = stockVehicle.vehicleTitle ?? existingLead.vehicle?.label;

  return {
    updatedAt: now,
    contact: {
      ...existingLead.contact,
      ...contact,
      name: contact.name || existingLead.contact?.name,
    },
    vehicle: {
      ...existingLead.vehicle,
      label: vehicleLabel ?? existingLead.vehicle?.label,
      model: vehicleLabel?.replace(/^Kia\s+/i, '') ?? existingLead.vehicle?.model,
    },
    notes: extraction.customerMessage ?? existingLead.notes,
    crm: {
      ...crmBase,
      sellerInsights,
    },
    history: [
      ...(existingLead.history ?? []),
      {
        id: uid('h'),
        at: now,
        type: 'system',
        text: `Neue Bestandsfahrzeug-Anfrage: ${vehicleLabel ?? 'Fahrzeug'}`,
      },
    ],
  };
}

export function createStockVehicleInboxItem(lead, stockVehicle, extraction = {}) {
  const customerName = lead.contact?.name ?? 'Kunde';
  const priceLine = stockVehicle.price != null
    ? `${Number(stockVehicle.price).toLocaleString('de-DE')} €`
    : null;
  const contentParts = [
    priceLine,
    stockVehicle.vehicleUrl ? 'Fahrzeuglink gefunden' : null,
  ].filter(Boolean);

  return createInboxItem({
    type: INBOX_EVENT_TYPES.STOCK_VEHICLE_REQUEST,
    title: 'Neue Bestandsfahrzeug-Anfrage',
    message: extraction.customerMessage ?? stockVehicle.vehicleTitle ?? 'Bestandsfahrzeug-Anfrage',
    customerName,
    customerId: lead.customerId,
    leadId: lead.id,
    vehicleLabel: stockVehicle.vehicleTitle,
    sourceArea: INBOX_SOURCE_AREA.SYSTEM,
    priority: INBOX_PRIORITY.HIGH,
    status: INBOX_STATUS.OPEN,
    actionLabel: 'Antworten',
    actionTarget: 'reply',
    metadata: {
      suggestedIntent: 'answer_stock_vehicle_request',
      stockVehicleId: stockVehicle.id,
      vehicleUrl: stockVehicle.vehicleUrl,
      price: stockVehicle.price,
      stockNumber: stockVehicle.stockNumber,
      sourceLabel: stockVehicle.sourceLabel,
      contentLine: contentParts.join(' · '),
      urgent: true,
    },
  });
}

/**
 * @param {object} params
 * @param {object} params.extraction
 * @param {object} params.stockVehicle
 * @param {object} params.classification
 * @param {object} deps
 */
export function applyStockVehicleInquiry({ extraction, stockVehicle, classification }, deps = {}) {
  const normalizedStock = normalizeRequestedStockVehicle(stockVehicle, extraction?.rawText);
  const existingLead = findLeadForStockInquiry(extraction, deps.leads ?? []);

  let lead;
  let extendedExisting = false;

  if (existingLead) {
    const patch = buildLeadPatchFromStockInquiry(existingLead, extraction, normalizedStock);
    deps.updateLead?.(existingLead.id, patch);
    lead = normalizeLead({ ...existingLead, ...patch });
    extendedExisting = true;
  } else {
    lead = buildNewLeadFromStockInquiry(extraction, normalizedStock, deps);
    deps.addLead?.(lead);
  }

  const inboxItem = createStockVehicleInboxItem(lead, normalizedStock, extraction);
  createInboxItem(inboxItem);

  return {
    lead,
    leadId: lead.id,
    inboxItem,
    extendedExisting,
    inquiryType: classification?.type ?? INQUIRY_TYPES.STOCK_VEHICLE_REQUEST,
    message: extendedExisting
      ? 'Bestandsfahrzeug-Anfrage zur Kundenakte hinzugefügt.'
      : 'Kundenakte für Bestandsfahrzeug-Anfrage erstellt.',
  };
}

export function buildStockVehicleVehicleConfiguration(stockVehicle = {}) {
  const title = stockVehicle.vehicleTitle ?? 'Bestandsfahrzeug';
  const brand = /^Kia\b/i.test(title) ? 'Kia' : 'Fahrzeug';
  const model = title.replace(/^Kia\s+/i, '').trim() || title;
  return {
    brand,
    model,
    modelKey: null,
    trimId: null,
    trimLabel: model,
    motorLabel: null,
    colorLabel: null,
    selectedPackages: [],
    includedPackages: [],
    accessories: [],
    dealerExtras: [],
    uvpBasePrice: stockVehicle.price ?? null,
    uvpConfigurationPrice: stockVehicle.price ?? null,
    uvpLineItems: [],
    isStockVehicle: true,
    stockNumber: stockVehicle.stockNumber ?? null,
    vehicleUrl: stockVehicle.vehicleUrl ?? null,
  };
}

export function buildStockVehicleConfigureDraft(stockVehicle = {}, lead = null, conditions = {}) {
  const title = stockVehicle.vehicleTitle ?? 'Bestandsfahrzeug';
  const brand = /^Kia\b/i.test(title) ? 'Kia' : 'Fahrzeug';
  const model = title.replace(/^Kia\s+/i, '').trim() || title;
  const contact = lead?.contact ?? {};

  return {
    brand,
    model,
    modelKey: null,
    trimLabel: model,
    paymentType: 'cash',
    desiredPrice: stockVehicle.price ?? null,
    customer: {
      name: contact.name ?? null,
      firstName: contact.firstName ?? null,
      lastName: contact.lastName ?? null,
      phone: contact.phone ?? null,
      email: contact.email ?? null,
      mailNote: stockVehicle.rawText ?? null,
    },
    stockVehicleId: stockVehicle.id ?? null,
    isStockVehicle: true,
    preparationFee: conditions.preparationFee ?? 1290,
  };
}

export function buildStockVehicleCalculatorNavigateState(lead, stockVehicle, options = {}) {
  if (!lead?.id || !stockVehicle) return null;
  const returnPath = options.returnPath ?? buildKundenaktePath(lead.id);
  return {
    addVehicleContext: {
      source: 'customer_record',
      customerId: lead.customerId,
      opportunityId: lead.id,
      leadId: lead.id,
      customerName: lead.contact?.name ?? '',
      returnPath,
      openConditions: true,
      openCalculator: true,
      stockVehicle,
      skipConfigure: true,
      proposalIntent: 'cash',
      paymentType: 'cash',
    },
  };
}

export function openStockVehicleListing(stockVehicle) {
  if (!stockVehicle?.vehicleUrl) return false;
  if (typeof window !== 'undefined') {
    window.open(stockVehicle.vehicleUrl, '_blank', 'noopener,noreferrer');
    return true;
  }
  return false;
}
