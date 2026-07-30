/**
 * Zentraler Context Resolver für den Clever Composer.
 * Priorität: geöffneter Kunde → genannter Name → Attachment → Workspace → Spur → Aktivität.
 */

import { formatCustomerDisplayName } from '../dealerAiParser.js';
import { findOfferWorkingContext, toCurrentOfferContext } from '../crm/composerWorkingContext.js';
import { buildVehicleOpportunityCards } from '../customerAkte.js';
import { buildCustomerUnderstanding } from '../dealer/customerUnderstanding.js';

function normalizeName(value = '') {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * Explizit genannten Kundennamen aus Seller-Input ziehen.
 * z. B. „Schreibe Garritano ein Angebot …“
 */
export function extractNamedCustomerFromInput(sellerInput = '') {
  const t = String(sellerInput ?? '').trim();
  const patterns = [
    /\b(?:schreib(?:e|en)?|sag(?:e|en)?|informier(?:e|en)?|mach(?:e|n)?|erstell(?:e|en)?)\s+(?:herrn?\s+|frau\s+)?([A-ZÄÖÜ][a-zäöüßA-ZÄÖÜ-]{1,40})\b/i,
    /\b(?:für|an)\s+(?:herrn?\s+|frau\s+)?([A-ZÄÖÜ][a-zäöüßA-ZÄÖÜ-]{1,40})\b.{0,40}\bangebot\b/i,
  ];
  const stop = /^(ein|eine|ihm|ihr|dem|den|das|picanto|sportage|ev\d|kia|angebot|termin|nachricht)$/i;
  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1] && !stop.test(m[1])) {
      return m[1];
    }
  }
  return null;
}

/**
 * @param {object} params
 * @param {object} [params.lead]
 * @param {string} [params.sellerInput]
 * @param {object} [params.workingContext]
 * @param {object[]} [params.workingContextItems]
 * @param {object} [params.offerContext]
 * @param {object} [params.currentOfferContext]
 * @param {string} [params.customerName]
 */
export function resolveAssistantContext(params = {}) {
  const lead = params.lead || {};
  const sellerInput = String(params.sellerInput ?? '');
  const workingItems = Array.isArray(params.workingContextItems)
    ? params.workingContextItems
    : (params.workingContext ? [params.workingContext] : []);

  const openCustomerName = formatCustomerDisplayName(
    params.customerName
    || lead?.contact?.name
    || lead?.name
    || '',
  ) || null;
  const named = extractNamedCustomerFromInput(sellerInput);
  const namedMatchesOpen = named
    && openCustomerName
    && (
      normalizeName(openCustomerName).includes(normalizeName(named))
      || normalizeName(named).includes(normalizeName(openCustomerName).split(/\s+/).pop())
    );

  const resolvedCustomer = {
    id: lead?.id ?? null,
    name: openCustomerName,
    namedInInput: named,
    source: named
      ? (namedMatchesOpen || !openCustomerName ? 'input_and_open' : 'input_named')
      : (openCustomerName ? 'open_customer' : 'unknown'),
    matched: Boolean(openCustomerName && (!named || namedMatchesOpen)),
  };

  const offerItem = findOfferWorkingContext(workingItems);
  const offerFromItems = offerItem ? toCurrentOfferContext(offerItem) : null;
  const offerContext = params.currentOfferContext
    || params.offerContext
    || offerFromItems
    || null;

  let vehicleCards = [];
  try {
    vehicleCards = buildVehicleOpportunityCards({
      lead,
      wishFields: lead?.wish ?? {},
    }) ?? [];
  } catch {
    vehicleCards = [];
  }

  const attachedVehicle = offerItem?.card || params.workingContext?.card || null;
  const resolvedWorkingContext = {
    offer: offerContext,
    attachedVehicle: attachedVehicle
      ? {
        modelKey: attachedVehicle.modelKey || attachedVehicle.model || null,
        trimId: attachedVehicle.trimId || attachedVehicle.trim || null,
        color: attachedVehicle.color || null,
        label: offerItem?.shortLabel || offerItem?.label || attachedVehicle.title || null,
        offerId: offerContext?.offerId || null,
      }
      : null,
    attachmentCount: workingItems.length,
    openVehicleCount: Array.isArray(vehicleCards) ? vehicleCards.length : 0,
  };

  let understanding = null;
  try {
    understanding = buildCustomerUnderstanding(lead);
  } catch {
    understanding = null;
  }

  const usedCustomerContext = {
    labels: understanding?.verstaendnis?.labels ?? [],
    summary: understanding?.gespraechseinstieg ?? null,
    openPoints: understanding?.verstaendnis?.openPoints ?? [],
    vehicles: understanding?.verstaendnis?.vehicles ?? [],
  };

  return {
    resolvedCustomer,
    resolvedWorkingContext,
    usedCustomerContext,
    offerContext,
    workingContextItems: workingItems,
  };
}

/**
 * Interpretiertes Ziel in Kurzform für Progress-UI.
 */
export function buildInterpretedGoal({ intents = [], facts = [], resolvedCustomer = null } = {}) {
  const types = intents.map((i) => i.type);
  const parts = [];
  if (resolvedCustomer?.name || resolvedCustomer?.namedInInput) {
    parts.push(`Kunde: ${resolvedCustomer.name || resolvedCustomer.namedInInput}`);
  }
  const vehicle = facts.find((f) => f.field === 'vehicleInterest' || f.factClass === 'vehicle_interest');
  if (vehicle?.label) parts.push(`Fahrzeug: ${vehicle.label}`);
  const price = facts.find((f) => f.field === 'purchasePrice' || f.field === 'listPrice');
  if (price?.label) parts.push(price.label);
  if (types.includes('prepare_offer')) parts.push('Angebot vorbereiten');
  if (types.includes('draft_message')) parts.push('Nachricht vorbereiten');
  if (types.includes('propose_appointment')) parts.push('Termin vorbereiten');
  if (types.includes('search_customer_history')) parts.push('Verlauf durchsuchen');
  return {
    summary: parts.join(' · ') || 'Auftrag verstehen',
    intentTypes: types,
  };
}
