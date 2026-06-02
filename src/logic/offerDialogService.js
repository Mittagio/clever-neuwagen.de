import {
  OFFER_DIALOG_CHANNEL,
  OFFER_DIALOG_EVENTS,
  OFFER_ACTION_TO_EVENT,
  OFFER_ACTION_STATUS,
  EMPTY_SONDERWUESNCHE,
  SESSION_LEAD_KEY,
  COUNTER_OFFER_STATUS,
} from '../data/offerDialogTypes.js';
import {
  generateOfferAccessToken,
  buildOfferMagicUrl,
  OFFER_TOKEN_TTL_DAYS,
  validateOfferAccessToken,
} from './offerAccessToken.js';
import {
  createLeadFromOffer,
  createLeadFromNewOffer,
  findMatchingLead,
  linkOfferToLead,
} from './offerLeadService.js';
import { normalizeLead } from './leadNormalization.js';

function uid(prefix = 'hist') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createDialogHistoryEntry(eventId, text, offerCode, extra = {}) {
  const event = OFFER_DIALOG_EVENTS[eventId] ?? { direction: 'inbound', label: text };
  return {
    id: uid('hist'),
    at: new Date().toISOString(),
    type: 'offer_dialog',
    text,
    direction: event.direction,
    channel: OFFER_DIALOG_CHANNEL,
    offerCode,
    eventId,
    ...extra,
  };
}

export function findLeadForOffer(leads, offer, contact = {}) {
  if (!offer) return null;

  if (offer.leadId) {
    const byId = leads.find((l) => l.id === offer.leadId);
    if (byId) return byId;
  }

  const byCode = leads.find(
    (l) => l.offerCode?.toUpperCase() === offer.code?.toUpperCase(),
  );
  if (byCode) return byCode;

  return findMatchingLead(leads, {
    email: contact.email ?? offer.customer?.email,
    phone: contact.phone ?? offer.customer?.phone,
  });
}

function mergeSonderwuensche(existing = {}, incoming = {}) {
  const base = { ...EMPTY_SONDERWUESNCHE, ...existing };
  const next = { ...base };

  for (const [key, value] of Object.entries(incoming)) {
    if (value === '' || value === null || value === undefined) continue;
    if (typeof value === 'boolean') {
      if (value) next[key] = true;
    } else {
      next[key] = value;
    }
  }

  return next;
}

function formatSonderwuenscheSummary(sonderwuensche) {
  const parts = [];
  if (sonderwuensche.wunschfarbe) parts.push(`Farbe: ${sonderwuensche.wunschfarbe}`);
  for (const [key, label] of [
    ['anhaengerkupplung', 'Anhängerkupplung'],
    ['gummifussmatten', 'Gummifußmatten'],
    ['winterraeder', 'Winterräder'],
    ['glasdach', 'Glasdach'],
  ]) {
    if (sonderwuensche[key]) parts.push(label);
  }
  if (sonderwuensche.andereLaufzeit) parts.push(`Laufzeit: ${sonderwuensche.andereLaufzeit} Monate`);
  if (sonderwuensche.andereKilometer) parts.push(`Kilometer: ${sonderwuensche.andereKilometer} km/J`);
  if (sonderwuensche.andereAnzahlung) parts.push(`Anzahlung: ${sonderwuensche.andereAnzahlung} €`);
  if (sonderwuensche.sonstigerWunsch) parts.push(sonderwuensche.sonstigerWunsch);
  return parts;
}

export function buildDialogEventText(action, message, sonderwuensche) {
  const eventId = OFFER_ACTION_TO_EVENT[action] ?? 'customer_inquiry';
  const event = OFFER_DIALOG_EVENTS[eventId];
  const summary = formatSonderwuenscheSummary(sonderwuensche ?? {});
  let text = event?.label ?? 'Kundenaktion';

  if (summary.length) {
    text += `: ${summary.join(' · ')}`;
  }
  if (message?.trim()) {
    text += ` — „${message.trim().slice(0, 120)}${message.length > 120 ? '…' : ''}"`;
  }
  return { eventId, text };
}

/**
 * Eine Verkaufschance pro Angebot – keine Duplikate bei Kundenaktionen.
 */
export function upsertLeadFromOfferAction({
  offer,
  action = 'inquiry',
  contact = {},
  message = '',
  sonderwuensche = {},
  leads = [],
}) {
  const { eventId, text: historyText } = buildDialogEventText(action, message, sonderwuensche);
  const historyEntry = createDialogHistoryEntry(eventId, historyText, offer.code, {
    message: message?.trim() || undefined,
  });

  let existing = findLeadForOffer(leads, offer, contact);
  const mergedContact = {
    name: contact.name?.trim() || offer.customer?.name || existing?.contact?.name || '',
    email: contact.email?.trim() || offer.customer?.email || existing?.contact?.email || '',
    phone: contact.phone?.trim() || offer.customer?.phone || existing?.contact?.phone || '',
  };

  const mergedSonder = mergeSonderwuensche(existing?.sonderwuensche, sonderwuensche);
  const newStatus = OFFER_ACTION_STATUS[action] ?? 'neu';

  if (existing) {
    const lead = normalizeLead({
      ...existing,
      contact: { ...existing.contact, ...mergedContact },
      sonderwuensche: mergedSonder,
      offerCode: offer.code,
      currentRate: offer.pricing?.rate ?? offer.pricing?.leasingRate ?? existing.currentRate,
      status: existing.status === 'bestellung' ? existing.status : newStatus,
      updatedAt: new Date().toISOString(),
      history: [...(existing.history ?? []), historyEntry],
      notes: message?.trim()
        ? `${existing.notes ?? ''}\n\n${message.trim()}`.trim()
        : existing.notes,
    });
    return { lead, leadId: lead.id, isNew: false, offerPatch: { leadId: lead.id } };
  }

  const base = createLeadFromOffer(offer, action, mergedContact);
  const lead = normalizeLead({
    ...base,
    source: 'offer',
    dealerId: offer.dealer?.dealerId ?? base.dealerId,
    sonderwuensche: mergedSonder,
    status: newStatus,
    history: [
      createDialogHistoryEntry(
        'customer_offer_opened',
        OFFER_DIALOG_EVENTS.customer_offer_opened.label,
        offer.code,
      ),
      historyEntry,
    ],
  });

  return { lead, leadId: lead.id, isNew: true, offerPatch: { leadId: lead.id } };
}

export function upsertFromExistingOfferLink(offer, leads) {
  const existing = findLeadForOffer(leads, offer);
  if (existing) {
    return { lead: linkOfferToLead(offer, existing), leadId: existing.id, isNew: false };
  }
  const lead = normalizeLead(createLeadFromNewOffer(offer));
  return { lead, leadId: lead.id, isNew: true };
}

export function getOfferDialogHistory(lead, offerCode) {
  if (!lead?.history?.length) return [];
  const code = offerCode?.toUpperCase();
  return lead.history.filter(
    (h) => h.channel === OFFER_DIALOG_CHANNEL
      || (code && h.offerCode?.toUpperCase() === code),
  );
}

export function rememberOfferLeadId(offerCode, leadId) {
  try {
    sessionStorage.setItem(SESSION_LEAD_KEY(offerCode), leadId);
  } catch {
    /* ignorieren */
  }
}

export function recallOfferLeadId(offerCode) {
  try {
    return sessionStorage.getItem(SESSION_LEAD_KEY(offerCode));
  } catch {
    return null;
  }
}

export function hasActiveSonderwuensche(sonderwuensche) {
  return formatSonderwuenscheSummary(sonderwuensche ?? {}).length > 0;
}

export function getActiveCounterOffer(offer) {
  if (!offer?.dialog?.counterOffers?.length) return null;
  const activeId = offer.dialog.activeCounterOfferId;
  if (activeId) {
    const found = offer.dialog.counterOffers.find((co) => co.id === activeId);
    if (found && found.status === 'pending') return found;
  }
  return offer.dialog.counterOffers.find((co) => co.status === 'pending') ?? null;
}

function buildCounterOfferPricing(offer, pricingPreview, lead) {
  const wish = lead?.wish ?? {};
  const paymentType = wish.paymentType ?? offer.pricing?.paymentType ?? 'leasing';
  const leasingRate = pricingPreview?.leasingRate ?? offer.pricing?.leasingRate;
  const financeRate = pricingPreview?.financeRate ?? offer.pricing?.financeRate;
  const cashPrice = pricingPreview?.cashPrice ?? offer.pricing?.cashPrice;
  const rate = paymentType === 'finance'
    ? financeRate
    : paymentType === 'cash'
      ? cashPrice
      : leasingRate;

  return {
    paymentType,
    rate,
    leasingRate,
    financeRate,
    cashPrice,
    hauspreis: pricingPreview?.listPrice ?? offer.pricing?.hauspreis,
    termMonths: wish.termMonths ?? pricingPreview?.termMonths ?? offer.pricing?.termMonths,
    mileagePerYear: wish.mileagePerYear ?? pricingPreview?.mileagePerYear ?? offer.pricing?.mileagePerYear,
    downPayment: wish.downPayment ?? pricingPreview?.downPayment ?? offer.pricing?.downPayment ?? 0,
  };
}

function formatCounterOfferSummary(pricing, accessoriesNote) {
  const parts = [];
  if (pricing.rate != null) {
    parts.push(
      pricing.paymentType === 'cash'
        ? `Kaufpreis: ${pricing.rate.toLocaleString('de-DE')} €`
        : `Rate: ${pricing.rate.toLocaleString('de-DE')} €/Monat`,
    );
  }
  if (pricing.termMonths) parts.push(`${pricing.termMonths} Monate`);
  if (pricing.mileagePerYear) parts.push(`${pricing.mileagePerYear.toLocaleString('de-DE')} km/J`);
  if (pricing.downPayment > 0) parts.push(`Anzahlung ${pricing.downPayment.toLocaleString('de-DE')} €`);
  if (accessoriesNote) parts.push(accessoriesNote);
  return parts.join(' · ');
}

export function prepareCounterOfferSend({
  offer,
  lead,
  pricingPreview,
  accessoriesNote = '',
  dealerMessage = '',
}) {
  const token = generateOfferAccessToken();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + OFFER_TOKEN_TTL_DAYS * 86400000).toISOString();
  const pricing = buildCounterOfferPricing(offer, pricingPreview, lead);

  const counterOffer = {
    id: uid('co'),
    sentAt: now,
    status: COUNTER_OFFER_STATUS.pending.id,
    pricing,
    accessoriesNote: accessoriesNote.trim(),
    dealerMessage: dealerMessage.trim(),
  };

  const existing = offer.dialog?.counterOffers ?? [];
  const superseded = existing.map((co) =>
    (co.status === COUNTER_OFFER_STATUS.pending.id
      ? { ...co, status: COUNTER_OFFER_STATUS.superseded.id }
      : co),
  );

  const summary = formatCounterOfferSummary(pricing, counterOffer.accessoriesNote);
  const historyText = `${OFFER_DIALOG_EVENTS.dealer_counter_offer.label}: ${summary}`;

  const offerPatch = {
    status: 'verhandlung',
    pricing: { ...offer.pricing, ...pricing },
    dialog: {
      accessToken: token,
      tokenIssuedAt: now,
      tokenExpiresAt: expiresAt,
      counterOffers: [...superseded, counterOffer],
      activeCounterOfferId: counterOffer.id,
    },
    updatedAt: now,
  };

  return {
    counterOffer,
    token,
    offerPatch,
    historyText,
    magicUrl: buildOfferMagicUrl(offer.code, token),
  };
}

export function buildCounterOfferResolutionPatch(offer, counterOfferId, resolution) {
  const counterOffers = (offer.dialog?.counterOffers ?? []).map((co) => {
    if (co.id !== counterOfferId) return co;
    return {
      ...co,
      status: resolution,
      respondedAt: new Date().toISOString(),
    };
  });

  const offerStatus = resolution === COUNTER_OFFER_STATUS.accepted.id
    ? 'bestellung'
    : offer.status;

  return {
    dialog: {
      ...offer.dialog,
      counterOffers,
      activeCounterOfferId: resolution === COUNTER_OFFER_STATUS.pending.id
        ? offer.dialog?.activeCounterOfferId
        : null,
    },
    status: offerStatus,
    updatedAt: new Date().toISOString(),
  };
}

export function canCustomerRespondToCounterOffer(offer, { token, email, hasLinkedLead }) {
  const active = getActiveCounterOffer(offer);
  if (!active) return { canRespond: false, reason: 'none' };

  if (token) {
    const check = validateOfferAccessToken(offer, token);
    if (check.valid) return { canRespond: true, via: 'token' };
    return { canRespond: false, reason: check.code };
  }

  const customerEmail = offer.customer?.email?.trim().toLowerCase();
  if (email && customerEmail && email.trim().toLowerCase() === customerEmail) {
    return { canRespond: true, via: 'account' };
  }
  if (hasLinkedLead) return { canRespond: true, via: 'session' };

  return { canRespond: false, reason: 'auth_required', active };
}

export { formatSonderwuenscheSummary, validateOfferAccessToken, buildOfferMagicUrl };

export function appendOfferDialogEventToLead({
  lead,
  offerCode,
  eventId,
  text,
  updateLeadFn,
}) {
  if (!lead?.id || !updateLeadFn) return null;
  const entry = createDialogHistoryEntry(eventId, text, offerCode ?? lead.offerCode);
  updateLeadFn(lead.id, {
    history: [...(lead.history ?? []), entry],
    updatedAt: new Date().toISOString(),
  });
  return entry;
}
