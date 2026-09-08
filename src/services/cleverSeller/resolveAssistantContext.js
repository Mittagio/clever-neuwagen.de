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

/** Placeholder-Namen – nie echten Kundenkontakt überschreiben/blockieren. */
export function isPlaceholderCustomerName(name = '') {
  const t = String(name || '').trim();
  if (!t) return true;
  return /^(?:kunde(?:\s+noch)?\s*offen|kunde\s*\(\s*offen\s*\)|neuer\s+kunde|unbekannt|–|-|\.{1,3})$/i.test(t);
}

/**
 * Vehicle-/Commercial-/Prozess-Tokens – keine Kundennamen.
 * z. B. „Angebote für“, „Earth weiß“, „EV2 Air“.
 */
export function isCustomerNameStopToken(token = '') {
  return /^(?:ein|eine|einen|einem|einer|eines|ihm|ihr|dem|den|das|des|der|die|noch|hat|gibt|geben|möchte|moechte|eventuell|vielleicht|ungefähr|ungefaehr|circa|ca|picanto|sportage|xceed|ceed|niro|sorento|stonic|soul|ev\d|kia|angebot|angebote|termin|nachricht|leasingangebot|leasing|privatleasing|privat|finanzierung|für|an|will|optional|mail|e-?mail|earth|air|spirit|vision|elite|core|gt-?line|x-?line|weiß|weiss|schwarz|blau|grau|silber|rot|grün|gruen|terracotta|wolfsgrau|metallic|und|oder|mit|ohne|max|km|monate?|kinder|ahk|pv\d|donnerstag|montag|dienstag|mittwoch|freitag|rückruf|anrufen|erstmal|nur|entscheidet|entscheiden|entwurf|seine|ihre|interessiere|inklusive|farbe|wunschkonditionen)$/i
    .test(String(token || '').trim());
}

/**
 * Plausibler Personen-/Familienname (nicht Modell/Trim/Farbe/Commercial).
 * @param {string} name
 */
export function isPlausibleCustomerName(name = '') {
  const raw = String(name || '').trim();
  if (!raw || raw.length < 2 || raw.length > 60) return false;
  if (isPlaceholderCustomerName(raw)) return false;
  if (/\b(?:angebot|angebote|ev\s*\d|leasing|finanz)\b/i.test(raw)) return false;
  if (/\b(?:earth|air|spirit|vision|elite)\s+(?:weiß|weiss|schwarz|blau|grau|rot)\b/i.test(raw)) {
    return false;
  }
  const parts = raw
    .replace(/^(?:herr|frau|hr\.|fr\.|familie)\s+/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return false;
  if (parts.some((p) => isCustomerNameStopToken(p))) return false;
  if (parts.some((p) => /^\d+$/.test(p) || /@/.test(p))) return false;
  return true;
}

/**
 * Name-Kandidat säubern (Stop-Wörter abschneiden, Familie/Herr behalten).
 * @param {string} raw
 * @param {{ keepFamilie?: boolean, keepSalutation?: boolean }} [opts]
 */
export function sanitizeCustomerNameCandidate(raw = '', opts = {}) {
  let text = String(raw || '').trim().replace(/[,:;]+$/g, '').trim();
  if (!text) return null;
  const keepFamilie = opts.keepFamilie !== false;
  const keepSalutation = opts.keepSalutation !== false;
  let prefix = '';
  const fam = text.match(/^(familie)\s+/i);
  if (fam && keepFamilie) {
    prefix = 'Familie ';
    text = text.slice(fam[0].length);
  } else {
    const sal = text.match(/^(herrn?|frau|hr\.|fr\.)\s+/i);
    if (sal && keepSalutation) {
      const s = /^frau/i.test(sal[1]) ? 'Frau' : 'Herr';
      prefix = `${s} `;
      text = text.slice(sal[0].length);
    }
  }
  const parts = text.split(/\s+/).filter(Boolean);
  const kept = [];
  for (const part of parts) {
    if (isCustomerNameStopToken(part)) break;
    kept.push(part);
  }
  if (!kept.length) return null;
  const cleaned = `${prefix}${kept.join(' ')}`.trim();
  return isPlausibleCustomerName(cleaned) ? cleaned : null;
}

/**
 * Explizit genannten Kundennamen aus Seller-Input ziehen.
 * z. B. „Schreibe Garritano ein Angebot …“, „Familie Müller …“, „Kunde heißt …“
 */
export function extractNamedCustomerFromInput(sellerInput = '') {
  const t = String(sellerInput ?? '').trim();
  if (!t) return null;

  const nameToken = '([A-Za-zÄÖÜäöüß-]{2,40}(?:\\s+[A-Za-zÄÖÜäöüß-]{2,40})?)';
  const patterns = [
    // „Familie Müller,“ / „Familie Müller will …“
    /\b(familie\s+[A-Za-zÄÖÜäöüß-]{2,40})\b/i,
    // „Kunde heißt Familie Müller“ / „heißt Max Mustermann“
    new RegExp(
      `\\b(?:kunde\\s+)?(?:hei(?:ss|ß)t|namens|ist)\\s+(?:der\\s+|die\\s+)?(?:familie\\s+|herrn?\\s+|frau\\s+)?${nameToken}\\b`,
      'i',
    ),
    // „Name: …“ / „Kunde: …“
    new RegExp(
      `(?:^|[\\n;])\\s*(?:name|kunde|interessent|kontakt)\\s*:\\s*(?:familie\\s+|herrn?\\s+|frau\\s+)?${nameToken}\\b`,
      'i',
    ),
    new RegExp(`(?:^|[^\\wäöüÄÖÜß])(?:erstell(?:e|en)?|mach(?:e|en)?|vorbereiten)\\s+(?:herrn?\\s+|frau\\s+)?${nameToken}\\b`, 'i'),
    new RegExp(`\\b(?:schreib(?:e|en)?|sag(?:e|en)?|informier(?:e|en)?)\\s+(?:herrn?\\s+|frau\\s+)?${nameToken}\\b`, 'i'),
    // „für Herrn X … Angebot“ – nicht „Angebote für EV2“
    new RegExp(`\\b(?:für|an)\\s+(?:herrn?\\s+|frau\\s+|familie\\s+)${nameToken}\\b.{0,40}\\bangebot\\b`, 'i'),
    new RegExp(`\\b(?:für|an)\\s+${nameToken}\\b.{0,40}\\bangebot\\b`, 'i'),
    new RegExp(`\\b(?:öffne|zeige|zeig|finde)\\s+(?:den\\s+|die\\s+)?(?:kunden?\\s+)?(?:herrn?\\s+|frau\\s+)?${nameToken}\\b`, 'i'),
    // „Herr Marcel Grube“ → voller Name (nicht nur Vorname)
    new RegExp(`\\b(?:herrn?\\s+|frau\\s+)${nameToken}\\b`, 'i'),
  ];

  for (const re of patterns) {
    const m = t.match(re);
    if (!m?.[1]) continue;
    const cleaned = sanitizeCustomerNameCandidate(m[1]);
    if (cleaned) return cleaned;
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
  const focusedTrackId = lead?.crm?.focusedVehicleTrackId
    || favoriteTrack?.id
    || null;
  const focusedTrack = focusedTrackId
    ? vehicleTracks.find((t) => t.id === focusedTrackId)
    : null;
  const resolvedWorkingContext = {
    offer: offerContext,
    attachedVehicle: attachedVehicle
      ? {
        modelKey: attachedVehicle.modelKey || attachedVehicle.model || null,
        trimId: attachedVehicle.trimId || attachedVehicle.trim || null,
        color: attachedVehicle.color || null,
        label: offerItem?.shortLabel || offerItem?.label || attachedVehicle.title || null,
        offerId: offerContext?.offerId || null,
        vehicleTrackId: offerItem?.vehicleTrackId
          || offerItem?.vehicleCardId
          || attachedVehicle.vehicleTrackId
          || focusedTrackId
          || null,
      }
      : (focusedTrack
        ? {
          modelKey: focusedTrack.config?.modelKey || focusedTrack.modelLabel || null,
          trimId: focusedTrack.config?.trimId || null,
          color: focusedTrack.config?.colorLabel || null,
          label: focusedTrack.displayName || null,
          offerId: focusedTrack.activeOfferId || null,
          vehicleTrackId: focusedTrack.id,
        }
        : null),
    focusedVehicleTrackId: focusedTrackId,
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
