/**
 * Globale Historien- / Offer-Suche (Slice 2).
 * Primärquellen: gesendete Nachrichten, Customer Messages, Offer-Events, Activities.
 * Keine Drafts, keine Seller-Kommandos, keine AI-Zwischenschritte.
 */
import {
  MESSAGE_DIRECTION,
  MESSAGE_KIND,
  MESSAGE_STATUS,
  listMessagesForLead,
} from '../crm/customerMessageService.js';
import { extractAkteSearchTerms, searchAkteByQuery } from '../crm/composerAkteSearch.js';
import { listStoredVehicleOffers, VEHICLE_OFFER_STATUS } from '../vehicleOffer.js';
import { listCustomerVehicleTracks } from '../crm/vehicleTrack.js';
import { resolveCustomersFromInput } from './globalCustomerResolve.js';

const SOURCE_LABELS = {
  customer_truth: 'Kundenakte',
  customer_message: 'Kundennachricht',
  seller_message: 'Gesendete Nachricht',
  offer: 'Angebot',
  offer_event: 'Angebots-Ereignis',
  activity: 'Aktivität',
  appointment: 'Termin',
  document: 'Dokument',
  seller_note: 'Verkäufernotiz',
};

function formatWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function isSentOutboundMessage(msg = {}) {
  if (msg.direction !== MESSAGE_DIRECTION.OUTBOUND) return false;
  if (msg.visibleToCustomer === false) return false;
  if (msg.kind === MESSAGE_KIND.CLEVER_MESSAGE && msg.visibleToCustomer === false) return false;
  const status = String(msg.status || '').toLowerCase();
  if (status && status !== MESSAGE_STATUS.SENT && status !== 'sent' && status !== 'delivered') {
    // Drafts / prepared commands ausschließen
    if (/draft|prepared|pending|cancelled|rejected/i.test(status)) return false;
  }
  // Interne Kommandos / AI-Zwischenstände
  if (msg.internal === true || msg.sellerCommand === true) return false;
  if (msg.kind === MESSAGE_KIND.SYSTEM_STATUS && !msg.visibleToCustomer) return false;
  return Boolean(String(msg.text || '').trim() || msg.kind === MESSAGE_KIND.OFFER_CARD);
}

/**
 * @param {object} hit
 * @param {object} lead
 */
function toHistoryResult(hit = {}, lead = {}, extras = {}) {
  const sourceType = extras.sourceType
    || (hit.kind === 'offer' ? 'offer' : hit.kind === 'note' ? 'seller_note' : 'seller_message');
  return {
    sourceType,
    sourceLabel: SOURCE_LABELS[sourceType] || sourceType,
    sourceId: hit.id || hit.offerId || extras.sourceId || null,
    customerId: lead.id || null,
    customerName: lead.contact?.name || lead.name || null,
    createdAt: hit.when || extras.createdAt || null,
    whenLabel: hit.whenLabel || formatWhen(hit.when || extras.createdAt),
    matchedText: hit.snippet || hit.title || extras.matchedText || '',
    matchReason: extras.matchReason || (hit.title ? `Treffer in ${hit.title}` : 'Texttreffer'),
    title: hit.title || extras.title || null,
    offerId: hit.offerId || extras.offerId || null,
    messageId: hit.kind === 'message' || sourceType === 'seller_message' || sourceType === 'customer_message'
      ? (hit.id || extras.messageId || null)
      : (extras.messageId || null),
    kind: hit.kind || extras.kind || null,
  };
}

/**
 * Gesendete Verkäufernachrichten nach Begriffen filtern.
 */
function searchSentMessages(lead = {}, terms = [], options = {}) {
  const limit = options.limit ?? 8;
  const messages = listMessagesForLead(lead) || [];
  const hits = [];
  for (const msg of messages) {
    if (!isSentOutboundMessage(msg) && msg.direction !== MESSAGE_DIRECTION.INBOUND) continue;
    // Primär: gesendete Outbound; Inbound nur wenn explizit Kundenkommunikation
    if (msg.direction === MESSAGE_DIRECTION.OUTBOUND && !isSentOutboundMessage(msg)) continue;
    if (msg.direction === MESSAGE_DIRECTION.INBOUND && msg.visibleToCustomer === false) continue;

    const text = String(msg.text || msg.payload?.title || '').trim();
    if (!text) continue;
    const lower = text.toLowerCase();
    const matched = terms.filter((term) => lower.includes(String(term).toLowerCase()));
    if (!matched.length && terms.length) continue;

    const sourceType = msg.direction === MESSAGE_DIRECTION.INBOUND
      ? 'customer_message'
      : 'seller_message';
    hits.push({
      sourceType,
      sourceLabel: SOURCE_LABELS[sourceType],
      sourceId: msg.id,
      customerId: lead.id,
      customerName: lead.contact?.name || lead.name || null,
      createdAt: msg.createdAt || null,
      whenLabel: formatWhen(msg.createdAt),
      matchedText: text.slice(0, 280),
      matchReason: matched.length
        ? `Enthält „${matched.join('“, „')}“`
        : 'Gesendete Nachricht',
      title: sourceType === 'seller_message'
        ? `Verkäufer an ${lead.contact?.name || 'Kunde'}`
        : 'Kundennachricht',
      offerId: msg.relatedOfferId || msg.payload?.offerId || null,
      messageId: msg.id,
      kind: 'message',
    });
  }
  hits.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return hits.slice(0, limit);
}

/**
 * Letztes Offer-Sent-Event für einen Kunden.
 */
export function findLatestOfferSentEvent(lead = {}) {
  const tracks = listCustomerVehicleTracks(lead) || [];
  const offers = listStoredVehicleOffers(lead) || [];
  const sent = [];
  const offersMap = lead.crm?.vehicleOffers || {};
  for (const [trackId, offer] of Object.entries(offersMap)) {
    if (!offer?.sentAt) continue;
    const statusOk = (
      offer.status === VEHICLE_OFFER_STATUS.SENT
      || offer.status === VEHICLE_OFFER_STATUS.OPENED
      || offer.status === VEHICLE_OFFER_STATUS.ACCEPTED
      || /^(sent|opened|accepted)$/i.test(String(offer.status || ''))
    );
    if (!statusOk) continue;
    const track = tracks.find((t) => t.id === trackId)
      || tracks.find((t) => t.id === offer.vehicleConfigurationId || t.id === offer.vehicleTrackId);
    const vehicleLabel = track?.model
      || track?.modelKey
      || offer.pdf?.fileName?.replace(/_/g, ' ')?.replace(/\.pdf$/i, '')
      || 'Fahrzeug';
    sent.push({
      sourceType: 'offer_event',
      sourceLabel: SOURCE_LABELS.offer_event,
      sourceId: offer.id || trackId,
      customerId: lead.id,
      customerName: lead.contact?.name || lead.name || null,
      createdAt: offer.sentAt,
      whenLabel: formatWhen(offer.sentAt),
      matchedText: `${vehicleLabel}-Angebot versendet`,
      matchReason: 'Angebot gesendet',
      title: `${vehicleLabel} · Angebot v${offer.version || 1}`,
      offerId: offer.id || trackId,
      trackId: track?.id || trackId,
      vehicleLabel,
      version: offer.version || 1,
      status: offer.status,
      kind: 'offer_event',
    });
  }
  // Zusätzliche offerId-keyed Offers
  for (const offer of offers) {
    if (!offer?.sentAt) continue;
    if (sent.some((s) => s.sourceId === offer.id)) continue;
    const statusOk = (
      offer.status === VEHICLE_OFFER_STATUS.SENT
      || offer.status === VEHICLE_OFFER_STATUS.OPENED
      || offer.status === VEHICLE_OFFER_STATUS.ACCEPTED
      || /^(sent|opened|accepted)$/i.test(String(offer.status || ''))
    );
    if (!statusOk) continue;
    sent.push({
      sourceType: 'offer_event',
      sourceLabel: SOURCE_LABELS.offer_event,
      sourceId: offer.id,
      customerId: lead.id,
      customerName: lead.contact?.name || lead.name || null,
      createdAt: offer.sentAt,
      whenLabel: formatWhen(offer.sentAt),
      matchedText: 'Angebot versendet',
      matchReason: 'Angebot gesendet',
      title: `Angebot v${offer.version || 1}`,
      offerId: offer.id,
      trackId: offer.vehicleTrackId || null,
      vehicleLabel: offer.vehicleLabel || null,
      version: offer.version || 1,
      status: offer.status,
      kind: 'offer_event',
    });
  }
  sent.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return sent[0] || null;
}

/**
 * @param {{
 *   lead?: object,
 *   leadsSnapshot?: object[],
 *   sellerInput?: string,
 *   mode?: 'history'|'messages'|'offers'|'activities'|'auto',
 *   limit?: number,
 * }} params
 */
export function searchGlobalCustomerHistory(params = {}) {
  const sellerInput = String(params.sellerInput || '').trim();
  const leads = Array.isArray(params.leadsSnapshot) ? params.leadsSnapshot : [];
  const mode = params.mode || 'auto';
  const limit = params.limit ?? 6;

  let lead = params.lead?.id ? params.lead : null;
  let resolution = null;

  if (!lead?.id && leads.length) {
    resolution = resolveCustomersFromInput(sellerInput, leads, { limit: 4 });
    if (resolution.status === 'ambiguous') {
      return {
        ok: true,
        status: 'ambiguous_customer',
        message: 'Mehrere Kunden gefunden – bitte einen auswählen.',
        customerSearchResults: resolution.results,
        results: [],
        evidence: [],
      };
    }
    if (resolution.status === 'none') {
      return {
        ok: true,
        status: 'no_customer',
        message: resolution.message || 'Ich habe dazu in der Kundenhistorie nichts gefunden.',
        customerSearchResults: [],
        results: [],
        evidence: [],
      };
    }
    lead = resolution.lead;
  }

  if (!lead?.id) {
    return {
      ok: false,
      status: 'missing_customer',
      message: 'Für welchen Kunden soll ich suchen?',
      results: [],
      evidence: [],
    };
  }

  const terms = extractAkteSearchTerms(sellerInput, { freeText: false });
  const wantsOfferSent = /\b(angebot|angebote)\b/i.test(sellerInput)
    && /\b(geschickt|gesendet|versendet|wann)\b/i.test(sellerInput);
  const wantsMessages = mode === 'messages'
    || /\b(geschrieben|nachricht|gesagt)\b/i.test(sellerInput);

  /** @type {object[]} */
  let results = [];

  if (mode === 'offers' || (mode === 'auto' && wantsOfferSent)) {
    const latest = findLatestOfferSentEvent(lead);
    if (latest) results = [latest];
  }

  if (!results.length && (mode === 'messages' || mode === 'history' || mode === 'auto' || wantsMessages)) {
    const msgHits = searchSentMessages(lead, terms.length ? terms : extractAkteSearchTerms(sellerInput, { freeText: true }), { limit });
    results = [...results, ...msgHits];
  }

  if (!results.length && (mode === 'history' || mode === 'auto' || mode === 'activities')) {
    const akte = searchAkteByQuery(lead, sellerInput, { limit, freeText: true });
    for (const hit of akte.hits || []) {
      // Drafts / interne Clever-Messages meiden wenn nicht kundenrelevant
      if (hit.messageKind === MESSAGE_KIND.CLEVER_MESSAGE) continue;
      results.push(toHistoryResult(hit, lead, {
        matchReason: `Treffer zu „${(akte.terms || terms).join(' ')}“`,
        sourceType: hit.kind === 'offer'
          ? 'offer'
          : hit.kind === 'note'
            ? 'seller_note'
            : 'seller_message',
      }));
    }
  }

  // Dedup by sourceId
  const seen = new Set();
  results = results.filter((r) => {
    const key = `${r.sourceType}:${r.sourceId}:${r.matchedText?.slice(0, 40)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);

  if (!results.length) {
    return {
      ok: true,
      status: 'no_result',
      message: 'Ich habe dazu in der Kundenhistorie nichts gefunden.',
      resolvedCustomer: {
        id: lead.id,
        name: lead.contact?.name || lead.name || null,
      },
      customerSearchResults: resolution?.results || [],
      results: [],
      evidence: [],
    };
  }

  return {
    ok: true,
    status: 'found',
    message: null,
    resolvedCustomer: {
      id: lead.id,
      name: lead.contact?.name || lead.name || null,
    },
    customerSearchResults: resolution?.results || [],
    results,
    evidence: results.map((r) => ({
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      customerId: r.customerId,
      createdAt: r.createdAt,
      matchedText: r.matchedText,
      matchReason: r.matchReason,
    })),
  };
}

/**
 * Privacy: nur minimale Felder für optionale AI-Darstellung.
 * @param {object[]} results
 */
export function minimizeHistoryForAi(results = []) {
  return (results || []).map((r) => ({
    sourceLabel: r.sourceLabel,
    whenLabel: r.whenLabel,
    matchedText: String(r.matchedText || '').slice(0, 240),
    matchReason: r.matchReason,
    vehicleLabel: r.vehicleLabel || null,
  }));
}

export { SOURCE_LABELS };
