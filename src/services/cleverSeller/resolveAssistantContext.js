/**
 * Zentraler Context Resolver für den Clever Composer.
 * Priorität: geöffneter Kunde → genannter Name → Attachment → Workspace → Spur → Aktivität.
 */

import { formatCustomerDisplayName } from '../dealerAiParser.js';
import {
  findOfferWorkingContext,
  findDocumentWorkingContext,
  listWorkingContextDocuments,
  toCurrentOfferContext,
} from '../crm/composerWorkingContext.js';
import { buildVehicleOpportunityCards } from '../customerAkte.js';
import {
  buildAttributedWishChips,
  buildCustomerUnderstanding,
} from '../dealer/customerUnderstanding.js';
import {
  listCustomerVehicleTracks,
  sortTracksForOverview,
} from '../crm/vehicleTrack.js';
import { buildGoldenMoment } from '../journey/goldenMoment.js';

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
 * Pronomen / Bezugswörter im Seller-Input.
 */
export function resolvePronounHints(sellerInput = '') {
  const t = String(sellerInput ?? '');
  return {
    refersToCurrentCustomer: /\b(ihm|ihr|ihn|sie|dem\s+kunden|der\s+kunde)\b/i.test(t),
    refersToCurrentOffer: /\b(das\s+angebot|dieses\s+angebot|das\s+da|nochmal)\b/i.test(t),
    refersToHistory: /\b(damals|wie\s+damals|früher|verlauf)\b/i.test(t),
    refersToPreviousTurn: /\b(nochmal|noch\s+mal|wie\s+eben|dasselbe)\b/i.test(t),
  };
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
 * @param {object[]} [params.attachments]
 */
export function resolveAssistantContext(params = {}) {
  const lead = params.lead || {};
  const sellerInput = String(params.sellerInput ?? '');
  const workingItems = Array.isArray(params.workingContextItems)
    ? params.workingContextItems
    : (params.workingContext ? [params.workingContext] : []);
  const attachments = Array.isArray(params.attachments) ? params.attachments : [];
  const pronouns = resolvePronounHints(sellerInput);

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
    pronounResolved: Boolean(pronouns.refersToCurrentCustomer && openCustomerName),
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

  let vehicleTracks = [];
  try {
    vehicleTracks = sortTracksForOverview(listCustomerVehicleTracks(lead) || []);
  } catch {
    vehicleTracks = [];
  }

  const favoriteTrack = vehicleTracks.find((t) => t.status === 'favorite') || null;
  const deferredTracks = vehicleTracks.filter((t) => t.status === 'deferred');

  const documentItems = listWorkingContextDocuments(workingItems);
  const primaryDocument = findDocumentWorkingContext(workingItems);

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
    attachedDocument: primaryDocument
      ? {
        id: primaryDocument.documentId || primaryDocument.id,
        label: primaryDocument.label || primaryDocument.shortLabel,
        fileName: primaryDocument.detail || primaryDocument.document?.fileName || null,
      }
      : null,
    documents: documentItems.map((d) => ({
      id: d.documentId || d.id,
      label: d.label,
    })),
    attachmentCount: workingItems.length + attachments.length,
    documentCount: documentItems.length + attachments.filter((a) => (
      /\.pdf$/i.test(a?.name || a?.fileName || '') || a?.kind === 'pdf' || a?.kind === 'configurator_pdf'
    )).length,
    openVehicleCount: Array.isArray(vehicleCards) ? vehicleCards.length : 0,
    vehicleTracks: vehicleTracks.map((t) => ({
      id: t.id,
      modelLabel: t.modelLabel,
      status: t.status,
      statusLabel: t.statusLabel,
      requirementLabels: t.requirementLabels ?? [],
      activeOfferId: t.activeOfferId ?? null,
    })),
    favoriteTrackId: favoriteTrack?.id ?? null,
    deferredTrackIds: deferredTracks.map((t) => t.id),
    pronouns,
  };

  let understanding = null;
  let notepadLabels = [];
  try {
    understanding = buildCustomerUnderstanding(lead);
    notepadLabels = (buildAttributedWishChips(lead) ?? [])
      .map((c) => c.label || c.text)
      .filter(Boolean)
      .slice(0, 16);
  } catch {
    understanding = null;
  }

  let goldenMoment = null;
  try {
    goldenMoment = buildGoldenMoment(lead);
  } catch {
    goldenMoment = null;
  }

  const usedCustomerContext = {
    labels: understanding?.verstaendnis?.labels ?? [],
    notepadLabels,
    summary: understanding?.gespraechseinstieg ?? null,
    openPoints: understanding?.verstaendnis?.openPoints ?? [],
    vehicles: understanding?.verstaendnis?.vehicles ?? [],
    favoriteVehicle: favoriteTrack?.modelLabel ?? null,
    deferredVehicles: deferredTracks.map((t) => t.modelLabel),
    goldenMomentType: goldenMoment?.type ?? null,
    termMonths: lead?.wish?.termMonths
      ?? lead?.crm?.needProfile?.leaseDurationMonths
      ?? null,
    annualMileage: lead?.wish?.mileagePerYear
      ?? lead?.crm?.needProfile?.annualKm
      ?? null,
    mileagePerYear: lead?.wish?.mileagePerYear
      ?? lead?.crm?.needProfile?.annualKm
      ?? null,
    downPayment: lead?.wish?.downPayment
      ?? lead?.crm?.needProfile?.budget?.downPayment
      ?? null,
    paymentType: lead?.paymentType
      ?? lead?.wish?.paymentType
      ?? lead?.crm?.needProfile?.paymentType
      ?? null,
  };

  return {
    resolvedCustomer,
    resolvedWorkingContext,
    usedCustomerContext,
    offerContext,
    workingContextItems: workingItems,
    goldenMoment,
    vehicleTracks,
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
  if (types.includes('update_customer_context')) parts.push('Kundenkontext einsortieren');
  return {
    summary: parts.join(' · ') || 'Auftrag verstehen',
    intentTypes: types,
  };
}
