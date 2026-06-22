/**
 * Dealer AI – Aktionen über bestehende Module ausführen
 */
import { createOfferFromSales, buildOfferUrl, generateOfferNumber } from '../logic/offerService.js';
import { createOrLinkLeadForOffer } from '../logic/offerLeadService.js';
import { normalizeLead } from '../logic/leadNormalization.js';
import { buildDefaultCrm, buildLeadSubline } from './dealerAiLeadCrm.js';
import { createCustomerId } from './dealerAiCustomer.js';
import { executeAddVehicleToCustomerRecord } from './customerAddVehicleFlow.js';
import { joinKundenhelferNotes } from './cleverKundenhelfer.js';
import { generateListingBlocks } from '../logic/listingGenerator.js';
import { getTrimName, getEngineName, getColorName, normalizeInventoryItem } from '../logic/inventoryService.js';

function buildSalesPayload(fields) {
  return {
    brand: fields.brand ?? 'Kia',
    model: fields.model ?? 'Sportage',
    variant: fields.trimLabel ?? '',
    engineId: fields.engineId,
    trimId: fields.trimId,
    colorId: fields.colorId,
    packageIds: fields.packageIds ?? [],
    monthlyRate: fields.desiredRate,
    deliveryTime: fields.deliveryTime,
    availabilityLabel: fields.stockStatus === 'lager' ? '🟢 Sofort verfügbar' : null,
  };
}

function buildCustomerPayload(fields) {
  const paymentType = fields.paymentType ?? 'leasing';
  return {
    name: fields.customerName ?? '',
    phone: '',
    email: '',
    desiredRate: fields.desiredRate ?? (paymentType === 'cash' ? null : 399),
    mileagePerYear: fields.mileagePerYear ?? 15000,
    termMonths: fields.termMonths ?? 48,
    downPayment: fields.downPayment ?? 0,
    customerGroup: fields.customerGroup ?? 'standard',
    paymentType,
    desiredPrice: fields.desiredPrice ?? null,
    desiredDeliveryDate: fields.desiredDeliveryDate ?? null,
    balloonPayment: fields.balloonPayment ?? null,
  };
}

function buildListingTexts(blocks, fields, conditions) {
  const vehicleLabel = `${fields.brand ?? 'Kia'} ${fields.model ?? ''} ${fields.trimLabel ?? ''}`.trim();
  const rateLine = fields.desiredRate ? `Leasing ab ${fields.desiredRate} €/Monat` : '';

  const whatsapp = [
    '🚀 Neues Fahrzeugangebot',
    '',
    `🍴 ${vehicleLabel}`,
    fields.motorLabel ? `Antrieb: ${fields.motorLabel}` : '',
    fields.colorLabel ? `Farbe: ${fields.colorLabel}` : '',
    rateLine,
    fields.deliveryTime ? `📅 ${fields.deliveryTime}` : '',
    '',
    `📍 ${conditions.dealerName}`,
    `👉 ${typeof window !== 'undefined' ? window.location.origin : ''}/haendler/autohaus-trinkle`,
  ].filter(Boolean).join('\n');

  const email = [
    `Betreff: ${vehicleLabel} – Ihr Angebot`,
    '',
    `Guten Tag${fields.customerName ? ` ${fields.customerName}` : ''},`,
    '',
    `gerne unterbreiten wir Ihnen folgendes Leasingangebot:`,
    '',
    blocks.leasingExample,
    '',
    '---',
    blocks.mobileTitle,
    '',
    'Mit freundlichen Grüßen',
    conditions.dealerName,
  ].join('\n');

  const leasingmarkt = [
    blocks.mobileTitle,
    '',
    blocks.leasingExample,
    '',
    blocks.serienausstattung?.slice(0, 800),
  ].join('\n');

  return {
    mobileDe: blocks.mobileTitle,
    leasingExample: blocks.leasingExample,
    leasingmarkt,
    whatsapp,
    email,
    wltp: blocks.wltpBlock,
    serienausstattung: blocks.serienausstattung,
    rechtstext: blocks.rechtstext,
  };
}

function buildInventoryItem(fields, index = 0) {
  const type = fields.stockStatus === 'lager' ? 'lager'
    : fields.deliveryEta ? 'vorlauf'
      : 'bestellt';

  return normalizeInventoryItem({
    id: `inv-ai-${Date.now()}-${index}`,
    type,
    model: fields.model ?? 'Sportage',
    engineId: fields.engineId ?? '',
    trimId: fields.trimId ?? '',
    colorId: fields.colorId ?? '',
    color: fields.colorLabel ?? getColorName(fields.colorId),
    equipment: fields.trimLabel ?? getTrimName(fields.trimId),
    vin: '',
    eta: fields.deliveryEta ?? '',
    location: 'Heilbronn Ausstellung',
    visibleOnLanding: true,
    internalNote: `Dealer AI · ${fields.rawText?.slice(0, 120) ?? ''}`,
    packageIds: fields.packageIds ?? [],
  });
}

export function executeDealerAiAction(action, parsed, deps) {
  const { fields } = parsed;
  const {
    conditions,
    addOffer,
    getExistingCodes,
    leads,
    addLead,
    updateLead,
    linkLead,
    addInventoryItem,
    publishChanges,
  } = deps;

  switch (action) {
    case 'create_offer':
    case 'create_customer_offer':
    case 'create_cash_offer':
    case 'create_leasing_offer':
    case 'create_financing_offer':
    case 'create_three_way_offer':
      return executeCreateOffer(fields, deps, action === 'create_customer_offer', action);

    case 'create_sales_opportunity':
      return executeCreateSalesOpportunity(fields, parsed, deps, {
        selectedModelIds: deps.selectedModelIds ?? [],
      });

    case 'add_vehicle_to_customer_record':
      return executeAddVehicleToCustomerRecord(fields, parsed, deps, {
        selectedModelIds: deps.selectedModelIds ?? [],
        addVehicleContext: deps.addVehicleContext,
        carryCustomer: deps.carryCustomer,
        forceDuplicate: deps.forceDuplicate ?? false,
      });

    case 'create_inventory': {
      const items = [];
      const count = Math.min(Math.max(fields.quantity ?? 1, 1), 5);
      for (let i = 0; i < count; i += 1) {
        const item = buildInventoryItem(fields, i);
        addInventoryItem(item);
        items.push(item);
      }
      return {
        type: 'inventory',
        items,
        inventoryIds: items.map((i) => i.id),
        syncStatus: 'draft_pending',
        message: `${count} Lagerfahrzeug${count > 1 ? 'e' : ''} angelegt`,
      };
    }

    case 'publish_online': {
      const item = buildInventoryItem({ ...fields, stockStatus: 'lager' });
      addInventoryItem(item);
      publishChanges?.();
      const offerResult = executeCreateOffer(fields, deps, false);
      return {
        ...offerResult,
        type: 'published',
        inventoryId: item.id,
        syncStatus: 'synchronized',
        landingPage: '/haendler/autohaus-trinkle',
        dealerPage: '/haendler/autohaus-trinkle',
        message: 'Fahrzeug online gestellt – Händlerseite synchronisiert',
      };
    }

    case 'generate_listing': {
      const config = {
        engineId: fields.engineId,
        trimId: fields.trimId,
        colorId: fields.colorId,
        packageIds: fields.packageIds ?? [],
      };
      const blocks = generateListingBlocks(config, conditions);
      const texts = buildListingTexts(blocks, fields, conditions);
      return {
        type: 'listing',
        texts,
        config,
        insertGeneratorUrl: `/insert-generator?engine=${config.engineId}&trim=${config.trimId}&color=${config.colorId}`,
        message: 'Inserattexte generiert',
      };
    }

    case 'show_suggestions':
      return {
        type: 'suggestions',
        suggestedModels: parsed.suggestedModels ?? [],
        message: 'Fahrzeugvorschläge notiert – bitte mit dem Kunden besprechen',
      };

    case 'calculate_rate': {
      const rate = fields.desiredRate ?? 299;
      const term = fields.termMonths ?? 48;
      const km = fields.mileagePerYear ?? 10000;
      return {
        type: 'rate_estimate',
        estimate: { rate, termMonths: term, mileagePerYear: km },
        message: `Grobe Orientierung: ca. ${rate} €/Monat bei ${term} Monaten und ${km.toLocaleString('de-DE')} km/Jahr – bitte im System prüfen`,
      };
    }

    case 'draft_reply': {
      const vehicle = fields.model ? `Kia ${fields.model}` : 'ein passendes Fahrzeug';
      const draft = [
        `Guten Tag${fields.customerName ? ` ${fields.customerName}` : ''},`,
        '',
        `vielen Dank für Ihre Anfrage zu ${vehicle}.`,
        fields.desiredRate ? `Ihr Wunschbudget von ca. ${fields.desiredRate} €/Monat haben wir notiert.` : '',
        fields.termMonths && fields.mileagePerYear
          ? `Laufzeit ${fields.termMonths} Monate und ${fields.mileagePerYear.toLocaleString('de-DE')} km/Jahr sind für uns eine gute Basis.`
          : '',
        '',
        'Darf ich noch kurz Rückfragen zu Ausstattung oder Liefertermin stellen?',
        '',
        'Freundliche Grüße',
        conditions.dealerName,
      ].filter(Boolean).join('\n');
      return {
        type: 'draft_reply',
        draftText: draft,
        message: 'Rückfrage-Entwurf erstellt',
      };
    }

    default:
      return executeCreateOffer(fields, deps, false);
  }
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

function buildLeadFromDealerAi(fields, parsed, conditions, options = {}) {
  const vehicleLabel = [fields.brand, fields.model, fields.trimLabel].filter(Boolean).join(' ').trim();
  const leadId = `lead-ai-${Date.now()}`;
  const now = new Date().toISOString();
  const carry = options.carryCustomer ?? null;
  const crmBase = buildDefaultCrm(parsed, options.selectedModelIds ?? null);
  const helperNotes = parsed?.customerHelperNotes ?? [];
  const crmWithHelper = helperNotes.length
    ? {
        ...crmBase,
        kundenhelfer: {
          notes: joinKundenhelferNotes(helperNotes),
          voiceMemos: carry?.kundenhelfer?.voiceMemos ?? [],
        },
      }
    : crmBase;
  const crm = carry?.kundenhelfer
    ? { ...crmWithHelper, kundenhelfer: carry.kundenhelfer }
    : crmWithHelper;

  const customerId = carry?.customerId ?? createCustomerId();
  const contact = carry?.contact
    ? {
        name: carry.contact.name,
        phone: carry.contact.phone ?? '',
        email: carry.contact.email ?? '',
        preferredContact: crm.preferredContact,
      }
    : {
        name: fields.customerName || 'Kunde (offen)',
        phone: fields.customerPhone ?? carry?.contact?.phone ?? '',
        email: fields.customerEmail ?? carry?.contact?.email ?? '',
        preferredContact: crm.preferredContact,
      };

  return normalizeLead({
    id: leadId,
    customerId,
    referenceCode: options.referenceCode ?? null,
    createdAt: now,
    updatedAt: now,
    status: 'neu',
    source: 'dealerAi',
    dealerId: conditions.dealerId ?? 'autohaus-trinkle',
    contact,
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
    crm,
    history: [{
      id: `h-${Date.now()}`,
      at: now,
      type: 'system',
      text: 'Verkaufschance erstellt',
    }],
  });
}

function executeCreateSalesOpportunity(fields, parsed, deps, options = {}) {
  const { addLead, conditions, getExistingCodes, leads = [], carryCustomer } = deps;
  const referenceCode = generateOfferNumber(collectReferenceCodes(getExistingCodes, leads));
  const lead = buildLeadFromDealerAi(fields, parsed, conditions, {
    ...options,
    referenceCode,
    carryCustomer,
  });
  addLead(lead);

  return {
    type: 'lead',
    leadId: lead.id,
    leadName: lead.contact?.name,
    leadSubline: buildLeadSubline(fields),
    referenceCode,
    customerId: lead.customerId,
    isReturningWish: Boolean(carryCustomer),
    message: carryCustomer ? 'Neuer Kundenwunsch angelegt' : 'Verkaufschance erstellt',
    syncStatus: 'created',
  };
}

function executeCreateOffer(fields, deps, withCustomer, actionId = 'create_offer') {
  const {
    conditions,
    addOffer,
    getExistingCodes,
    leads,
    addLead,
    updateLead,
    linkLead,
  } = deps;

  const customer = buildCustomerPayload(fields);
  const salesPayload = buildSalesPayload(fields);
  let offer = createOfferFromSales(customer, salesPayload, conditions, getExistingCodes());
  offer = {
    ...offer,
    source: 'dealerAi',
    paymentType: fields.paymentType ?? 'leasing',
    dealerAiAction: actionId,
  };

  if (withCustomer && fields.customerName) {
    offer.customer = {
      ...offer.customer,
      name: fields.customerName,
    };
  }

  addOffer(offer);
  const { lead, leadId, isNew } = createOrLinkLeadForOffer(offer, leads);
  if (isNew) addLead(lead);
  else updateLead(leadId, lead);
  linkLead(offer.code, leadId);

  const url = buildOfferUrl(offer.code);

  return {
    type: 'offer',
    offer,
    offerCode: offer.code,
    offerUrl: url,
    leadId,
    leadName: fields.customerName ?? lead.contact?.name,
    vehicleLabel: offer.vehicle?.label,
    syncStatus: 'created',
    message: `Angebot ${offer.code} erstellt`,
  };
}

export function formatDealerAiVehicleCard(fields, conditions) {
  const label = `${fields.brand ?? 'Kia'} ${fields.model ?? ''} ${fields.trimLabel ?? ''}`.trim();
  return {
    label,
    motor: fields.motorLabel ?? getEngineName(fields.engineId),
    color: fields.colorLabel ?? getColorName(fields.colorId),
    dealer: conditions.dealerName,
    rate: fields.desiredRate,
    delivery: fields.deliveryTime,
  };
}
