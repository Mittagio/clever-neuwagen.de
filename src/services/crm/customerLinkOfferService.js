/**
 * Kundenlink – Events in CRM, Interactions und Clever Eingang.
 */
import {
  addCustomerQuestion,
  createEmptyInteraction,
  getCustomerOfferInteraction,
  mergeCustomerOfferInteractionPatch,
  recordCustomerDeclined,
  recordCustomerInterested,
  recordCustomerOpened,
} from '../customerOfferInteraction.js';
import {
  buildInboxItemFromOfferInteraction,
  createInboxItem,
  INBOX_EVENT_TYPES,
  syncInboxItemsFromLead,
} from './cleverInboxService.js';
import { mirrorInboundCustomerQuestion } from './customerMessageService.js';
import {
  formatVehicleCardTitle,
  buildVehicleOpportunityCards,
} from '../customerAkte.js';
import {
  getVehicleOffer,
  mergeVehicleOffersPatch,
  recordOfferOpened,
  VEHICLE_OFFER_STATUS,
} from '../vehicleOffer.js';

export const CUSTOMER_LINK_EVENTS = {
  OPENED: 'opened',
  INTERESTED: 'interested',
  DECLINED: 'declined',
  QUESTION: 'question',
};

function historyEntry(text, type = 'customer_activity') {
  return {
    id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    type,
    text,
    customerFacing: true,
  };
}

function slugify(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * @param {object} params
 */
export function parseOnlineOfferLinkContext({
  leadId = null,
  vehicleCardId = null,
  modelSlug = '',
  customerSlug = '',
  pathname = '',
} = {}) {
  const pathMatch = String(pathname).match(/\/angebot\/online\/([^/]+)\/([^/?#]+)/i);
  return {
    leadId: leadId ?? null,
    vehicleCardId: vehicleCardId ?? null,
    modelSlug: modelSlug || pathMatch?.[1] || '',
    customerSlug: customerSlug || pathMatch?.[2] || '',
  };
}

/**
 * @param {object} lead
 * @param {string|null} vehicleCardId
 */
export function resolveVehicleCardIdForLead(lead = {}, vehicleCardId = null) {
  if (vehicleCardId && (lead.crm?.vehicleOffers?.[vehicleCardId]
    || lead.crm?.vehicleConfigurations?.some((vc) => vc.id === vehicleCardId))) {
    return vehicleCardId;
  }
  const cards = buildVehicleOpportunityCards({
    lead,
    reservedModels: lead.crm?.reservedModels ?? [],
  });
  if (cards[0]?.id) return cards[0].id;
  const offerKeys = Object.keys(lead.crm?.vehicleOffers ?? {});
  return offerKeys[0] ?? null;
}

/**
 * @param {Array} leads
 * @param {object} context
 */
export function resolveLeadFromOfferLink(leads = [], context = {}) {
  const { leadId, vehicleCardId, modelSlug, customerSlug } = context;
  if (leadId) {
    const lead = leads.find((item) => item.id === leadId);
    if (lead) {
      return {
        lead,
        vehicleCardId: resolveVehicleCardIdForLead(lead, vehicleCardId),
      };
    }
  }

  const normalizedCustomer = slugify(customerSlug);
  const normalizedModel = slugify(modelSlug);

  for (const lead of leads) {
    const customerSlugFromLead = slugify(lead.contact?.name ?? '');
    if (normalizedCustomer && customerSlugFromLead && customerSlugFromLead !== normalizedCustomer) {
      continue;
    }

    for (const [cardId, offer] of Object.entries(lead.crm?.vehicleOffers ?? {})) {
      const linkUrl = offer.onlineLink?.url ?? '';
      if (vehicleCardId && cardId === vehicleCardId) {
        return { lead, vehicleCardId: cardId };
      }
      if (normalizedModel && linkUrl.includes(`/angebot/online/${normalizedModel}/`)) {
        return { lead, vehicleCardId: cardId };
      }
    }

    const cards = buildVehicleOpportunityCards({
      lead,
      reservedModels: lead.crm?.reservedModels ?? [],
    });
    const card = cards.find((item) => slugify(formatVehicleCardTitle(item)).includes(normalizedModel))
      ?? cards[0];
    if (card && (!normalizedModel || slugify(card.modelName ?? '').includes(normalizedModel))) {
      return { lead, vehicleCardId: card.id };
    }
  }

  return { lead: null, vehicleCardId: null };
}

function resolveVehicleLabel(lead, vehicleCardId) {
  const cards = buildVehicleOpportunityCards({
    lead,
    reservedModels: lead.crm?.reservedModels ?? [],
  });
  const card = cards.find((item) => item.id === vehicleCardId);
  if (card) return formatVehicleCardTitle(card);
  return lead.vehicle?.model ? `Kia ${lead.vehicle.model}` : 'Fahrzeug';
}

function resolveVehicleCard(lead, vehicleCardId) {
  const cards = buildVehicleOpportunityCards({
    lead,
    reservedModels: lead.crm?.reservedModels ?? [],
  });
  return cards.find((item) => item.id === vehicleCardId) ?? null;
}

/**
 * @param {object} lead
 * @param {string} vehicleCardId
 */
export function buildCustomerOfferLinkContext(lead = {}, vehicleCardId = '') {
  const card = resolveVehicleCard(lead, vehicleCardId);
  const vehicleOffer = getVehicleOffer(lead, { id: vehicleCardId });
  const interaction = getCustomerOfferInteraction(lead, vehicleCardId);
  const vehicleLabel = resolveVehicleLabel(lead, vehicleCardId);
  const firstName = String(lead.contact?.name ?? '').split(/\s+/)[0] || 'Hallo';

  return {
    leadId: lead.id,
    vehicleCardId,
    customerFirstName: firstName,
    vehicleLabel,
    paymentType: card?.paymentType ?? lead.paymentType ?? null,
    rateLabel: card?.desiredRate ?? null,
    modelName: card?.modelName ?? lead.vehicle?.model ?? null,
    trimLabel: card?.trimLabel ?? null,
    heroImage: card?.imageUrl ?? null,
    vehicleOffer,
    interaction,
  };
}

/**
 * @param {object} lead
 * @param {string} vehicleCardId
 * @param {string} eventType
 * @param {object} [options]
 */
export function applyCustomerLinkEvent(lead = {}, vehicleCardId = '', eventType, options = {}) {
  const { questionText, syncInbox = true } = options;

  if (!lead?.id || !vehicleCardId) {
    return { ok: false, error: 'lead_or_card_missing' };
  }

  const prevInteraction = getCustomerOfferInteraction(lead, vehicleCardId)
    ?? createEmptyInteraction(vehicleCardId, lead.id);
  const prevOffer = getVehicleOffer(lead, { id: vehicleCardId });
  const vehicleLabel = resolveVehicleLabel(lead, vehicleCardId);
  let interaction = { ...prevInteraction };
  let vehicleOffer = { ...prevOffer };
  let historyText = null;

  switch (eventType) {
    case CUSTOMER_LINK_EVENTS.OPENED: {
      interaction = recordCustomerOpened(interaction);
      vehicleOffer = recordOfferOpened(vehicleOffer);
      historyText = `Kunde hat Angebot geöffnet: ${vehicleLabel}`;
      break;
    }
    case CUSTOMER_LINK_EVENTS.INTERESTED: {
      interaction = recordCustomerInterested(interaction);
      vehicleOffer = {
        ...vehicleOffer,
        status: VEHICLE_OFFER_STATUS.ACCEPTED,
        updatedAt: new Date().toISOString(),
      };
      historyText = `Kunde hat Interesse markiert: ${vehicleLabel}`;
      break;
    }
    case CUSTOMER_LINK_EVENTS.DECLINED: {
      interaction = recordCustomerDeclined(interaction);
      vehicleOffer = {
        ...vehicleOffer,
        status: VEHICLE_OFFER_STATUS.REJECTED,
        updatedAt: new Date().toISOString(),
      };
      historyText = `Kunde hat abgelehnt: ${vehicleLabel}`;
      break;
    }
    case CUSTOMER_LINK_EVENTS.QUESTION: {
      const trimmed = String(questionText ?? '').trim();
      if (!trimmed) {
        return { ok: false, error: 'question_required' };
      }
      interaction = addCustomerQuestion(interaction, trimmed);
      historyText = `Kundenfrage: „${trimmed}“`;
      break;
    }
    default:
      return { ok: false, error: 'unknown_event' };
  }

  const customerOfferInteractions = mergeCustomerOfferInteractionPatch(lead, vehicleCardId, interaction);
  const vehicleOffers = mergeVehicleOffersPatch(lead, vehicleCardId, vehicleOffer);

  const nextLead = {
    ...lead,
    updatedAt: new Date().toISOString(),
    crm: {
      ...(lead.crm ?? {}),
      customerOfferInteractions,
      vehicleOffers,
    },
    history: [
      ...(lead.history ?? []),
      historyEntry(historyText, 'customer_activity'),
    ],
  };

  let finalLead = nextLead;
  let customerMessageInboxItem = null;

  if (eventType === CUSTOMER_LINK_EVENTS.QUESTION) {
    const trimmed = String(questionText ?? '').trim();
    const lastQuestion = interaction.customerQuestions?.[interaction.customerQuestions.length - 1];
    const mirrored = mirrorInboundCustomerQuestion({
      lead: finalLead,
      text: trimmed,
      relatedOfferId: vehicleCardId,
      relatedQuestionId: lastQuestion?.id ?? null,
      customerName: lead.contact?.name ?? '',
      vehicleLabel,
      source: 'customer_portal',
    });
    finalLead = mirrored.lead;
    customerMessageInboxItem = mirrored.inboxItem;
  }

  const eventMap = {
    [CUSTOMER_LINK_EVENTS.OPENED]: INBOX_EVENT_TYPES.OFFER_OPENED,
    [CUSTOMER_LINK_EVENTS.INTERESTED]: INBOX_EVENT_TYPES.OFFER_INTERESTED,
    [CUSTOMER_LINK_EVENTS.DECLINED]: INBOX_EVENT_TYPES.OFFER_DECLINED,
  };

  let persistedInboxItem = customerMessageInboxItem;
  if (eventType !== CUSTOMER_LINK_EVENTS.QUESTION) {
    const inboxItem = buildInboxItemFromOfferInteraction({
      lead: finalLead,
      cardId: vehicleCardId,
      interaction,
      vehicleOffer,
      vehicleLabel,
      eventType: eventMap[eventType],
    });
    persistedInboxItem = inboxItem ? createInboxItem(inboxItem) : null;
  }

  if (syncInbox && typeof localStorage !== 'undefined') {
    syncInboxItemsFromLead(finalLead);
  }

  return {
    ok: true,
    lead: finalLead,
    vehicleCardId,
    interaction,
    vehicleOffer,
    inboxItem: persistedInboxItem,
    customerMessageInboxItem,
    vehicleLabel,
    eventType,
  };
}
