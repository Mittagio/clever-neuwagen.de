/**
 * Dealer AI – Aktionen über bestehende Module ausführen
 */
import { createOfferFromSales, buildOfferUrl } from '../logic/offerService.js';
import { createOrLinkLeadForOffer } from '../logic/offerLeadService.js';
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
  return {
    name: fields.customerName ?? '',
    phone: '',
    email: '',
    desiredRate: fields.desiredRate ?? 399,
    mileagePerYear: fields.mileagePerYear ?? 15000,
    termMonths: fields.termMonths ?? 48,
    downPayment: fields.downPayment ?? 0,
    customerGroup: fields.customerGroup ?? 'standard',
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
      return executeCreateOffer(fields, deps, action === 'create_customer_offer');

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

    default:
      return executeCreateOffer(fields, deps, false);
  }
}

function executeCreateOffer(fields, deps, withCustomer) {
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
