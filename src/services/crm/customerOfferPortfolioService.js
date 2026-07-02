/**
 * Kunden-Portfolio – mehrere Angebote in einem Link (Clever Auswahl + Fahrzeugkarten).
 */
import {
  formatVehicleCardPrice,
  formatVehicleCardTitle,
  buildVehicleOpportunityCards,
} from '../customerAkte.js';
import { PAYMENT_TYPE_LABELS } from '../dealerAiParser.js';
import { resolveConfigureHeroImage } from '../dealerAiVehicleConfigureFlow.js';
import {
  createInboxItem,
  INBOX_EVENT_TYPES,
  INBOX_PRIORITY,
  INBOX_SOURCE_AREA,
  INBOX_STATUS,
} from './cleverInboxService.js';
import {
  buildCustomerPortalMessageThreads,
  mirrorInboundCustomerQuestion,
  sendCustomerPortalInboundMessage,
} from './customerMessageService.js';
import {
  buildCustomerPortalAccessContext,
  isCustomerPortalAccessVerified,
} from './customerPortalAccessService.js';
import { buildCustomerPortalShellModel } from './customerPortalShellPresenter.js';
import {
  buildSelfDisclosureInterviewModel,
  saveSelfDisclosureStep,
  startSelfDisclosure,
  submitSelfDisclosure,
} from './customerPortalSelfDisclosureService.js';
import {
  buildBoardItems,
  OFFER_SELECTION_GROUP_STATUS,
  OFFER_VARIANT_STATUS,
  sanitizeOfferSelectionGroups,
  updateVariantCustomerReaction,
} from '../sales/offerSelectionGroup.js';
import {
  buildConfiguratorConditionsLine,
  buildDraftFromSelectionVariant,
  buildPortfolioSummaryLine,
  computeVariantConfiguratorPreview,
  formatConfiguratorRate,
  formatConfiguratorUvpAmount,
  formatVariantConditionsLine,
  resolveVariantDisplayAmounts,
} from '../sales/offerVariantConfigurator.js';
import {
  getVehicleOffer,
  mergeVehicleOffersPatch,
  VEHICLE_OFFER_STATUS,
} from '../vehicleOffer.js';
import { isBoardOfferSendable } from '../dealer/boardOfferModel.js';

export const PORTFOLIO_STATUS = {
  PREPARED: 'prepared',
  SENT: 'sent',
  OPENED: 'opened',
  REACTED: 'reacted',
};

export const PORTFOLIO_EVENTS = {
  OPENED: 'portfolio_opened',
  OFFER_INTERESTED: 'portfolio_offer_interested',
  OFFER_CALL_REQUEST: 'portfolio_offer_call',
  OFFER_DECLINED: 'portfolio_offer_declined',
  OFFER_MORE_INFO: 'portfolio_offer_more_info',
};

export const PORTFOLIO_DECLINE_REASONS = {
  too_expensive: 'Zu teuer',
  wrong_size: 'Größe passt nicht',
  not_interested: 'Kein Interesse',
};

export const PORTFOLIO_REACTION_STATUS = {
  NONE: 'none',
  INTERESTED: 'interested',
  CALL_REQUESTED: 'call_requested',
  DECLINED: 'declined',
  MORE_INFO: 'more_info',
};

let idCounter = 0;

function nextId(prefix) {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

function slugify(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizePaymentType(paymentType = 'leasing') {
  if (paymentType === 'cash') return 'cash';
  if (paymentType === 'financing' || paymentType === 'threeWayFinancing') return 'financing';
  return 'leasing';
}

function requiresPdfForPayment(paymentType) {
  return normalizePaymentType(paymentType) !== 'cash';
}

function historyEntry(text, type = 'customer_activity') {
  return {
    id: nextId('hist'),
    at: new Date().toISOString(),
    type,
    text,
    customerFacing: true,
  };
}

function buildToken() {
  return Math.random().toString(36).slice(2, 10);
}

export function buildPortfolioLinkUrl({
  customerName = '',
  leadId = null,
  token = null,
  origin = null,
} = {}) {
  const customer = slugify(customerName) || 'kunde';
  const baseOrigin = origin
    ?? (typeof window !== 'undefined' ? window.location.origin : 'https://kia-angebote.de');
  const params = new URLSearchParams();
  if (leadId) params.set('leadId', leadId);
  if (token) params.set('token', token);
  const qs = params.toString();
  return `${baseOrigin}/angebot/auswahl/${customer}${qs ? `?${qs}` : ''}`;
}

function buildPortfolioItemFromSelectionVariant(group, variant, lead = null) {
  if (!group || !variant) return null;

  const draft = buildDraftFromSelectionVariant({ group, variant, lead });
  const preview = computeVariantConfiguratorPreview(draft, null);
  const paymentType = draft?.paymentType ?? group.wishConditions?.paymentType ?? 'leasing';
  const conditionsLine = buildConfiguratorConditionsLine(
    draft,
    preview.paymentLabel ?? PAYMENT_TYPE_LABELS[paymentType],
  );
  const upeLine = formatConfiguratorUvpAmount(draft);
  const display = resolveVariantDisplayAmounts(draft, preview, variant);
  const heroImage = resolveConfigureHeroImage(draft);
  const summaryLine = buildPortfolioSummaryLine({
    modelLabel: group.modelLabel,
    trimLabel: variant.trimLabel ?? variant.label ?? 'Ausstattung',
    conditionsLine,
    displayFormatted: display.formatted,
  });

  return {
    id: nextId('pu'),
    sourceType: 'selection_variant',
    groupId: group.id,
    variantId: variant.id,
    vehicleCardId: null,
    modelKey: group.modelKey,
    modelLabel: group.modelLabel,
    trimLabel: variant.trimLabel ?? variant.label ?? 'Ausstattung',
    roleLabel: variant.label ?? null,
    paymentType,
    conditionsLine,
    upeLine: upeLine !== '–' ? upeLine : null,
    priceLine: display.isCash ? display.formatted : null,
    rateLine: display.isCash ? null : display.formatted,
    displayAmount: display.amount,
    displayFormatted: display.formatted,
    summaryLine,
    heroImage,
    requiresPdf: requiresPdfForPayment(paymentType),
    pdfFileName: variant.offerPdf?.fileName ?? null,
    pdfDataUrl: variant.offerPdf?.dataUrl ?? null,
    customerReaction: {
      status: PORTFOLIO_REACTION_STATUS.NONE,
      declineReason: null,
      declineNote: '',
      questionText: '',
      reactedAt: null,
    },
  };
}

function buildPortfolioItemFromVehicleCard(card, lead = null) {
  if (!card) return null;

  const vehicleOffer = getVehicleOffer(lead, card);
  const paymentType = card.paymentType ?? lead?.paymentType ?? 'leasing';
  const isCash = normalizePaymentType(paymentType) === 'cash';
  const title = formatVehicleCardTitle(card);
  const price = formatVehicleCardPrice(card);
  const heroImage = resolveConfigureHeroImage({
    modelKey: card.modelKey,
    colorId: card.colorId ?? null,
    trimId: card.trimId ?? null,
  });

  const paymentLabel = PAYMENT_TYPE_LABELS[paymentType] ?? PAYMENT_TYPE_LABELS.leasing;
  const conditionsParts = [paymentLabel.replace(' / Barzahlung', '').replace('Kauf / Barzahlung', 'Kauf')];
  if (card.termMonths) conditionsParts.push(`${card.termMonths} Monate`);
  if (card.mileagePerYear) {
    conditionsParts.push(`${card.mileagePerYear.toLocaleString('de-DE')} km/Jahr`);
  }

  return {
    id: nextId('pu'),
    sourceType: 'vehicle_card',
    groupId: null,
    variantId: null,
    vehicleCardId: card.id,
    modelKey: card.modelKey,
    modelLabel: title,
    trimLabel: card.trimLabel ?? null,
    roleLabel: null,
    paymentType,
    conditionsLine: conditionsParts.filter(Boolean).join(' · '),
    upeLine: null,
    priceLine: price,
    rateLine: isCash ? null : price,
    heroImage,
    requiresPdf: requiresPdfForPayment(paymentType),
    pdfFileName: vehicleOffer.pdf?.fileName ?? null,
    pdfDataUrl: vehicleOffer.pdf?.dataUrl ?? null,
    customerReaction: {
      status: PORTFOLIO_REACTION_STATUS.NONE,
      declineReason: null,
      declineNote: '',
      questionText: '',
      reactedAt: null,
    },
  };
}

/**
 * Sammelt alle Angebote aus Clever-Auswahl-Gruppen und Einzelkarten.
 */
export function buildPortfolioItems({
  lead = null,
  offerSelectionGroups = [],
  vehicleCards = [],
} = {}) {
  const items = [];
  const safeGroups = sanitizeOfferSelectionGroups(offerSelectionGroups);

  for (const group of safeGroups) {
    for (const variant of group.variants ?? []) {
      const item = buildPortfolioItemFromSelectionVariant(group, variant, lead);
      if (item) items.push(item);
    }
  }

  const groupedModelKeys = new Set(safeGroups.map((group) => group.modelKey));
  for (const card of vehicleCards ?? []) {
    if (groupedModelKeys.has(card.modelKey)) continue;
    if (!isBoardOfferSendable(card, lead)) continue;
    const item = buildPortfolioItemFromVehicleCard(card, lead);
    if (item) items.push(item);
  }

  return items;
}

/**
 * Erzeugt oder aktualisiert das Portfolio in der Kundenakte.
 */
export function prepareCustomerOfferPortfolio({
  lead = null,
  offerSelectionGroups = [],
  vehicleCards = [],
  origin = null,
} = {}) {
  const items = buildPortfolioItems({ lead, offerSelectionGroups, vehicleCards });
  if (!items.length) {
    return { ok: false, error: 'no_items' };
  }

  const existing = lead?.crm?.customerOfferPortfolio ?? null;
  const token = existing?.token ?? buildToken();
  const now = new Date().toISOString();
  const url = buildPortfolioLinkUrl({
    customerName: lead?.contact?.name ?? '',
    leadId: lead?.id ?? null,
    token,
    origin,
  });

  const portfolio = {
    id: existing?.id ?? nextId('portfolio'),
    token,
    url,
    status: PORTFOLIO_STATUS.PREPARED,
    items,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    sentAt: existing?.sentAt ?? null,
    tracking: existing?.tracking ?? { openCount: 0, firstOpenedAt: null, lastOpenedAt: null },
  };

  const nextGroups = sanitizeOfferSelectionGroups(offerSelectionGroups).map((group) => ({
    ...group,
    status: OFFER_SELECTION_GROUP_STATUS.PREPARED,
    updatedAt: now,
  }));

  return {
    ok: true,
    portfolio,
    offerSelectionGroups: nextGroups,
    itemCount: items.length,
  };
}

export function markPortfolioSent(portfolio) {
  if (!portfolio) return portfolio;
  return {
    ...portfolio,
    status: PORTFOLIO_STATUS.SENT,
    sentAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function resolvePortfolioFromLead(lead = {}, token = null) {
  const portfolio = lead?.crm?.customerOfferPortfolio ?? null;
  if (!portfolio?.items?.length) return null;
  if (token && portfolio.token !== token) return null;
  return portfolio;
}

export function buildPortfolioCustomerContext(lead = {}, options = {}) {
  const portfolio = lead?.crm?.customerOfferPortfolio ?? null;
  if (!portfolio?.items?.length) return null;

  const firstName = String(lead.contact?.name ?? '').split(/\s+/)[0] || 'Hallo';
  const accessVerified = options.accessVerified === true
    || isCustomerPortalAccessVerified(lead);
  const portalAccess = buildCustomerPortalAccessContext(lead, { accessVerified });

  if (portalAccess.codeRequired && !portalAccess.verified) {
    return {
      leadId: lead.id,
      customerFirstName: firstName,
      portfolioId: portfolio.id,
      token: portfolio.token,
      requiresCode: true,
      portalAccess,
      pageTitle: 'Ihre Fahrzeugauswahl',
    };
  }

  const items = portfolio.items.map((item) => ({
    id: item.id,
    title: item.trimLabel
      ? `${item.modelLabel} · ${item.trimLabel}`
      : item.modelLabel,
    modelLabel: item.modelLabel,
    trimLabel: item.trimLabel,
    roleLabel: item.roleLabel,
    conditionsLine: item.conditionsLine,
    upeLine: item.upeLine,
    priceLine: item.priceLine,
    rateLine: item.rateLine,
    displayFormatted: item.displayFormatted ?? item.rateLine ?? item.priceLine ?? null,
    summaryLine: item.summaryLine ?? null,
    heroImage: item.heroImage,
    requiresPdf: item.requiresPdf,
    hasPdf: Boolean(item.pdfDataUrl),
    pdfFileName: item.pdfFileName,
    pdfDataUrl: item.pdfDataUrl ?? null,
    customerReaction: item.customerReaction ?? { status: PORTFOLIO_REACTION_STATUS.NONE },
  }));

  const messageThreads = buildCustomerPortalMessageThreads(lead, { portfolioItems: portfolio.items });
  const messageCount = messageThreads.reduce(
    (sum, thread) => sum + (thread.messages?.length ?? 0),
    0,
  );

  return {
    leadId: lead.id,
    customerFirstName: firstName,
    portfolioId: portfolio.id,
    token: portfolio.token,
    status: portfolio.status,
    summaryLines: items.map((item) => item.summaryLine).filter(Boolean),
    summaryTitle: items.length
      ? `${items[0].modelLabel}${items.every((i) => i.trimLabel === items[0].trimLabel && i.trimLabel) ? ` · ${items[0].trimLabel}` : ''} – Ihre ${items.length} Option${items.length === 1 ? '' : 'en'}`
      : 'Ihre Angebotsauswahl',
    items,
    messageThreads,
    portalAccess,
    shell: buildCustomerPortalShellModel(lead, { messageCount }),
    requiresCode: false,
    pageTitle: 'Ihre Fahrzeugauswahl',
  };
}

/**
 * Kunde sendet Nachricht aus dem Portal-Nachrichtenbereich.
 * @param {object} lead
 * @param {object} [options]
 */
export function applyCustomerPortalMessage(lead, { text } = {}) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) {
    return { ok: false, error: 'message_required' };
  }

  const mirrored = sendCustomerPortalInboundMessage({
    lead,
    text: trimmed,
    customerName: lead.contact?.name ?? '',
  });

  if (!mirrored.message) {
    return { ok: false, error: 'message_invalid' };
  }

  const now = new Date().toISOString();
  const nextLead = {
    ...mirrored.lead,
    updatedAt: now,
    history: [
      ...(mirrored.lead.history ?? []),
      historyEntry(`Kundenfrage: „${trimmed}“`),
    ],
  };

  return {
    ok: true,
    lead: nextLead,
    message: mirrored.message,
    inboxItem: mirrored.inboxItem,
    context: buildPortfolioCustomerContext(nextLead),
  };
}

/**
 * Selbstauskunft im Kundenportal starten.
 */
export function applyCustomerPortalSelfDisclosureStart(lead, { type } = {}) {
  const result = startSelfDisclosure(lead, type);
  if (!result.ok) return result;
  return {
    ok: true,
    lead: result.lead,
    selfDisclosure: result.selfDisclosure,
    interview: buildSelfDisclosureInterviewModel(result.lead),
    context: buildPortfolioCustomerContext(result.lead),
  };
}

/**
 * Selbstauskunft-Schritt speichern.
 */
export function applyCustomerPortalSelfDisclosureSave(lead, { stepId, data, advance = true } = {}) {
  const result = saveSelfDisclosureStep(lead, { stepId, data, advance });
  if (!result.ok) return result;
  return {
    ok: true,
    lead: result.lead,
    selfDisclosure: result.selfDisclosure,
    nextStep: result.nextStep,
    interview: buildSelfDisclosureInterviewModel(result.lead),
    context: buildPortfolioCustomerContext(result.lead),
  };
}

/**
 * Selbstauskunft absenden.
 */
export function applyCustomerPortalSelfDisclosureSubmit(lead) {
  const result = submitSelfDisclosure(lead);
  if (!result.ok) return result;
  return {
    ok: true,
    lead: result.lead,
    selfDisclosure: result.selfDisclosure,
    inboxItem: result.inboxItem,
    interview: buildSelfDisclosureInterviewModel(result.lead),
    context: buildPortfolioCustomerContext(result.lead),
  };
}

/**
 * Interview-Modell für Selbstauskunft.
 */
export function getCustomerPortalSelfDisclosureInterview(lead) {
  return {
    ok: true,
    interview: buildSelfDisclosureInterviewModel(lead),
    context: buildPortfolioCustomerContext(lead),
  };
}

function mapReactionToVariantStatus(reactionStatus) {
  switch (reactionStatus) {
    case PORTFOLIO_REACTION_STATUS.INTERESTED:
      return OFFER_VARIANT_STATUS.INTERESTED;
    case PORTFOLIO_REACTION_STATUS.CALL_REQUESTED:
    case PORTFOLIO_REACTION_STATUS.MORE_INFO:
      return OFFER_VARIANT_STATUS.OFFER_REQUESTED;
    case PORTFOLIO_REACTION_STATUS.DECLINED:
      return OFFER_VARIANT_STATUS.REJECTED;
    default:
      return OFFER_VARIANT_STATUS.OPENED;
  }
}

function buildDeclineMessage(item, declineReason, declineNote) {
  const label = item.trimLabel
    ? `${item.modelLabel} · ${item.trimLabel}`
    : item.modelLabel;
  const reasonLabel = PORTFOLIO_DECLINE_REASONS[declineReason] ?? declineReason ?? 'Passt nicht';
  const note = declineNote?.trim();
  return note
    ? `Kunde lehnt ab (${label}): ${reasonLabel} – „${note}“`
    : `Kunde lehnt ab (${label}): ${reasonLabel}`;
}

function buildInboxForPortfolioEvent({
  lead,
  item,
  eventType,
  message,
}) {
  const customerName = lead.contact?.name ?? '';
  const vehicleLabel = item.trimLabel
    ? `${item.modelLabel} · ${item.trimLabel}`
    : item.modelLabel;

  const inboxTypeMap = {
    [PORTFOLIO_EVENTS.OFFER_INTERESTED]: INBOX_EVENT_TYPES.OFFER_INTERESTED,
    [PORTFOLIO_EVENTS.OFFER_CALL_REQUEST]: INBOX_EVENT_TYPES.CONTACT_REQUESTED,
    [PORTFOLIO_EVENTS.OFFER_DECLINED]: INBOX_EVENT_TYPES.OFFER_DECLINED,
    [PORTFOLIO_EVENTS.OFFER_MORE_INFO]: INBOX_EVENT_TYPES.OFFER_QUESTION,
    [PORTFOLIO_EVENTS.OPENED]: INBOX_EVENT_TYPES.OFFER_OPENED,
  };

  const type = inboxTypeMap[eventType] ?? INBOX_EVENT_TYPES.CUSTOMER_QUESTION;
  const titleMap = {
    [PORTFOLIO_EVENTS.OFFER_INTERESTED]: 'Interesse am Angebot',
    [PORTFOLIO_EVENTS.OFFER_CALL_REQUEST]: 'Rückruf gewünscht',
    [PORTFOLIO_EVENTS.OFFER_DECLINED]: 'Angebot passt nicht',
    [PORTFOLIO_EVENTS.OFFER_MORE_INFO]: 'Mehr Infos gewünscht',
    [PORTFOLIO_EVENTS.OPENED]: 'Auswahl geöffnet',
  };

  return createInboxItem({
    type,
    title: titleMap[eventType] ?? 'Kundenrückmeldung',
    message,
    customerId: lead.id,
    customerName,
    leadId: lead.id,
    offerId: item.vehicleCardId ?? item.variantId ?? item.id,
    vehicleLabel,
    sourceArea: INBOX_SOURCE_AREA.CUSTOMER_LINK,
    priority: eventType === PORTFOLIO_EVENTS.OFFER_CALL_REQUEST
      ? INBOX_PRIORITY.HIGH
      : INBOX_PRIORITY.NORMAL,
    status: INBOX_STATUS.OPEN,
    metadata: {
      dedupeKey: `portfolio:${lead.id}:${item.id}:${eventType}`,
      portfolioItemId: item.id,
      portfolioId: lead.crm?.customerOfferPortfolio?.id,
    },
  });
}

function applyReactionToSelectionGroups(groups, item, reactionStatus) {
  if (item.sourceType !== 'selection_variant' || !item.groupId || !item.variantId) {
    return groups;
  }
  const variantStatus = mapReactionToVariantStatus(reactionStatus);
  return (groups ?? []).map((group) => {
    if (group.id !== item.groupId) return group;
    return updateVariantCustomerReaction(group, item.variantId, variantStatus);
  });
}

function applyReactionToVehicleOffer(lead, item, reactionStatus) {
  if (item.sourceType !== 'vehicle_card' || !item.vehicleCardId) {
    return lead?.crm?.vehicleOffers ?? {};
  }
  const prev = getVehicleOffer(lead, { id: item.vehicleCardId });
  let status = prev.status;
  if (reactionStatus === PORTFOLIO_REACTION_STATUS.INTERESTED
    || reactionStatus === PORTFOLIO_REACTION_STATUS.CALL_REQUESTED) {
    status = VEHICLE_OFFER_STATUS.ACCEPTED;
  } else if (reactionStatus === PORTFOLIO_REACTION_STATUS.DECLINED) {
    status = VEHICLE_OFFER_STATUS.REJECTED;
  }
  return mergeVehicleOffersPatch(lead, item.vehicleCardId, {
    ...prev,
    status,
  });
}

/**
 * Kundenreaktion auf ein Portfolio-Angebot.
 */
export function applyPortfolioEvent(lead = {}, offerUnitId = '', eventType, options = {}) {
  const { declineReason, declineNote, questionText, token = null } = options;
  const portfolio = resolvePortfolioFromLead(lead, token);
  if (!portfolio) {
    return { ok: false, error: 'portfolio_not_found' };
  }

  const itemIndex = portfolio.items.findIndex((entry) => entry.id === offerUnitId);
  if (itemIndex < 0 && eventType !== PORTFOLIO_EVENTS.OPENED) {
    return { ok: false, error: 'offer_unit_not_found' };
  }

  const now = new Date().toISOString();
  let nextPortfolio = { ...portfolio };
  let historyText = null;
  let inboxItem = null;
  let reactionStatus = PORTFOLIO_REACTION_STATUS.NONE;

  if (eventType === PORTFOLIO_EVENTS.OPENED) {
    const count = (portfolio.tracking?.openCount ?? 0) + 1;
    nextPortfolio = {
      ...portfolio,
      status: portfolio.status === PORTFOLIO_STATUS.PREPARED || portfolio.status === PORTFOLIO_STATUS.SENT
        ? PORTFOLIO_STATUS.OPENED
        : portfolio.status,
      tracking: {
        openCount: count,
        firstOpenedAt: portfolio.tracking?.firstOpenedAt ?? now,
        lastOpenedAt: now,
      },
      updatedAt: now,
    };
    historyText = 'Kunde hat Angebotsauswahl geöffnet';
    inboxItem = buildInboxForPortfolioEvent({
      lead,
      item: portfolio.items[0] ?? { modelLabel: 'Auswahl' },
      eventType,
      message: historyText,
    });
  } else {
    const item = portfolio.items[itemIndex];
    switch (eventType) {
      case PORTFOLIO_EVENTS.OFFER_INTERESTED:
        reactionStatus = PORTFOLIO_REACTION_STATUS.INTERESTED;
        historyText = `Kunde interessiert: ${item.modelLabel}${item.trimLabel ? ` · ${item.trimLabel}` : ''}`;
        break;
      case PORTFOLIO_EVENTS.OFFER_CALL_REQUEST:
        reactionStatus = PORTFOLIO_REACTION_STATUS.CALL_REQUESTED;
        historyText = `Kunde wünscht Rückruf: ${item.modelLabel}${item.trimLabel ? ` · ${item.trimLabel}` : ''}`;
        break;
      case PORTFOLIO_EVENTS.OFFER_DECLINED:
        reactionStatus = PORTFOLIO_REACTION_STATUS.DECLINED;
        historyText = buildDeclineMessage(item, declineReason, declineNote);
        break;
      case PORTFOLIO_EVENTS.OFFER_MORE_INFO: {
        const trimmed = String(questionText ?? '').trim();
        if (!trimmed) return { ok: false, error: 'question_required' };
        reactionStatus = PORTFOLIO_REACTION_STATUS.MORE_INFO;
        historyText = `Kunde möchte mehr Infos (${item.modelLabel}): „${trimmed}“`;
        break;
      }
      default:
        return { ok: false, error: 'unknown_event' };
    }

    const updatedItems = portfolio.items.map((entry, index) => {
      if (index !== itemIndex) return entry;
      return {
        ...entry,
        customerReaction: {
          status: reactionStatus,
          declineReason: declineReason ?? null,
          declineNote: declineNote?.trim() ?? '',
          questionText: questionText?.trim() ?? '',
          reactedAt: now,
        },
      };
    });

    const hasAnyReaction = updatedItems.some((entry) => (
      entry.customerReaction?.status
      && entry.customerReaction.status !== PORTFOLIO_REACTION_STATUS.NONE
    ));

    nextPortfolio = {
      ...portfolio,
      items: updatedItems,
      status: hasAnyReaction ? PORTFOLIO_STATUS.REACTED : portfolio.status,
      updatedAt: now,
    };

    inboxItem = eventType === PORTFOLIO_EVENTS.OFFER_MORE_INFO
      ? null
      : buildInboxForPortfolioEvent({
        lead,
        item,
        eventType,
        message: historyText,
      });
  }

  let offerSelectionGroups = lead?.crm?.offerSelectionGroups ?? [];
  let vehicleOffers = lead?.crm?.vehicleOffers ?? {};

  if (eventType !== PORTFOLIO_EVENTS.OPENED && itemIndex >= 0) {
    const reactedItem = nextPortfolio.items[itemIndex];
    offerSelectionGroups = applyReactionToSelectionGroups(
      offerSelectionGroups,
      reactedItem,
      reactionStatus,
    );
    vehicleOffers = applyReactionToVehicleOffer(lead, reactedItem, reactionStatus);
  }

  let finalLead = {
    ...lead,
    updatedAt: now,
    crm: {
      ...(lead.crm ?? {}),
      customerOfferPortfolio: nextPortfolio,
      offerSelectionGroups,
      vehicleOffers,
    },
    history: [
      ...(lead.history ?? []),
      historyEntry(historyText),
    ],
  };

  if (eventType === PORTFOLIO_EVENTS.OFFER_MORE_INFO && itemIndex >= 0) {
    const reactedItem = nextPortfolio.items[itemIndex];
    const trimmed = String(questionText ?? '').trim();
    const vehicleLabel = reactedItem.trimLabel
      ? `${reactedItem.modelLabel} · ${reactedItem.trimLabel}`
      : reactedItem.modelLabel;
    const mirrored = mirrorInboundCustomerQuestion({
      lead: finalLead,
      text: trimmed,
      relatedOfferId: reactedItem.vehicleCardId ?? reactedItem.id,
      relatedQuestionId: `portfolio-more-info-${reactedItem.id}`,
      customerName: lead.contact?.name ?? '',
      vehicleLabel,
      source: 'customer_portal',
    });
    finalLead = mirrored.lead;
    inboxItem = mirrored.inboxItem;
  }

  return {
    ok: true,
    lead: finalLead,
    portfolio: nextPortfolio,
    offerUnitId,
    eventType,
    inboxItem,
    context: buildPortfolioCustomerContext(finalLead),
  };
}

export function buildPortfolioShareMessage({
  customerName = '',
  itemCount = 0,
  url = '',
  summaryLines = [],
} = {}) {
  const first = customerName.split(/\s+/)[0] || 'Hallo';
  const countLabel = itemCount === 1 ? '1 Option' : `${itemCount} Optionen`;
  const linesBlock = summaryLines.length
    ? `\n\n${summaryLines.join('\n')}\n`
    : '\n';
  return `Hallo ${first}, hier ${countLabel === '1 Option' ? 'ist' : 'sind'} ${countLabel} für Sie zum Vergleichen:${linesBlock}\n👉 ${url}`;
}

export function buildPortfolioSummaryLinesFromItems(items = []) {
  return (items ?? [])
    .map((item) => item.summaryLine ?? buildPortfolioSummaryLine({
      modelLabel: item.modelLabel,
      trimLabel: item.trimLabel,
      conditionsLine: item.conditionsLine,
      displayFormatted: item.displayFormatted ?? item.rateLine ?? item.priceLine,
    }))
    .filter(Boolean);
}

export function resolvePortfolioFromRequest(leads = [], { leadId, token, customerSlug } = {}) {
  if (!leadId) return { lead: null, portfolio: null };
  const lead = leads.find((entry) => entry.id === leadId);
  if (!lead) return { lead: null, portfolio: null };

  if (customerSlug) {
    const normalized = slugify(customerSlug);
    const fromLead = slugify(lead.contact?.name ?? '');
    if (normalized && fromLead && normalized !== fromLead) {
      return { lead: null, portfolio: null };
    }
  }

  const portfolio = resolvePortfolioFromLead(lead, token);
  return { lead, portfolio };
}

export function collectPortfolioVehicleCards(lead = {}) {
  return buildVehicleOpportunityCards({
    lead,
    reservedModels: lead.crm?.reservedModels ?? [],
  });
}

export function collectPortfolioBoardItems(lead = {}) {
  const vehicleCards = collectPortfolioVehicleCards(lead);
  const groups = sanitizeOfferSelectionGroups(lead.crm?.offerSelectionGroups ?? []);
  return buildBoardItems({ vehicleCards, offerSelectionGroups: groups });
}
