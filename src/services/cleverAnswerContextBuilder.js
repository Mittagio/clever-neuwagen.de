/**
 * Clever Antworten – reicher Kundenkontext aus der Kundenakte
 */
import { buildCleverAntwortenContext, resolveLegacyKundenhelferNotes } from './cleverAntworten.js';
import { buildSchnellaufnahmeChips } from './customerAkte.js';
import { buildKundenwissenOverview } from './kundenwissenCategories.js';
import { buildCustomerUnderstanding } from './dealer/customerUnderstanding.js';
import { countUnterlagenOpenTasks, getUnterlagenSlotsForLead } from './cleverUnterlagen.js';
import {
  countOpenQuestions,
  getCustomerOfferInteraction,
  INTEREST_STATUS,
} from './customerOfferInteraction.js';
import {
  formatSelectionGroupTrimLine,
  formatWishConditionsLine,
} from './sales/offerSelectionGroup.js';
import { formatVariantCustomerPriceLine } from './sales/offerVariantConfigurator.js';

function normalizePaymentType(paymentType = '') {
  if (paymentType === 'threeWayFinancing') return 'financing';
  return paymentType || 'unknown';
}

function resolveWishConditions(lead = {}, wishPaymentType = 'unknown', offerSelectionGroups = []) {
  const primaryGroup = pickPrimarySelectionGroup(offerSelectionGroups, []);
  const groupWish = primaryGroup?.wishConditions ?? {};
  const crmWish = lead?.crm?.wishConditions ?? lead?.wish ?? {};

  return {
    paymentType: groupWish.paymentType ?? crmWish.paymentType ?? wishPaymentType ?? lead?.paymentType ?? 'unknown',
    termMonths: groupWish.termMonths ?? crmWish.termMonths ?? lead?.wish?.termMonths ?? null,
    mileagePerYear: groupWish.mileagePerYear ?? crmWish.mileagePerYear ?? lead?.wish?.mileagePerYear ?? null,
    downPayment: groupWish.downPayment ?? crmWish.downPayment ?? lead?.wish?.downPayment ?? null,
    desiredRate: groupWish.desiredRate ?? crmWish.desiredRate ?? lead?.wish?.desiredRate ?? null,
    desiredPrice: groupWish.desiredPrice ?? crmWish.desiredPrice ?? lead?.wish?.desiredPrice ?? null,
    delivery: groupWish.delivery ?? crmWish.delivery ?? lead?.wish?.delivery ?? '',
  };
}

function collectCustomerInteractions(lead = {}, vehicleCards = []) {
  const interactions = [];
  const seen = new Set();

  for (const card of vehicleCards) {
    if (!card?.id || seen.has(card.id)) continue;
    seen.add(card.id);
    const interaction = getCustomerOfferInteraction(lead, card.id);
    if (interaction) interactions.push({ card, interaction });
  }

  for (const [cardId, stored] of Object.entries(lead?.crm?.customerOfferInteractions ?? {})) {
    if (seen.has(cardId)) continue;
    seen.add(cardId);
    interactions.push({
      card: vehicleCards.find((c) => c.id === cardId) ?? { id: cardId },
      interaction: getCustomerOfferInteraction(lead, cardId) ?? stored,
    });
  }

  return interactions;
}

function collectOpenCustomerQuestions(lead = {}, vehicleCards = []) {
  const questions = [];

  for (const { interaction } of collectCustomerInteractions(lead, vehicleCards)) {
    for (const question of interaction?.customerQuestions ?? []) {
      if (question.status === 'open' && question.text) {
        questions.push({
          id: question.id,
          text: question.text,
          source: 'offer_interaction',
        });
      }
    }
  }

  const special = lead?.specialCustomerQuestion;
  if (special?.rawText && !lead?.specialQuestionAnswer?.answerText) {
    questions.push({
      id: 'special-question',
      text: special.rawText,
      source: 'special',
    });
  }

  return questions;
}

function pickPrimarySelectionGroup(offerSelectionGroups = [], vehicleCards = []) {
  const groups = (offerSelectionGroups ?? []).filter(Boolean);
  if (!groups.length) return null;

  const primaryModelKey = vehicleCards[0]?.modelKey;
  if (primaryModelKey) {
    const match = groups.find((group) => group.modelKey === primaryModelKey);
    if (match) return match;
  }

  return groups[0];
}

function summarizeSelectionGroup(group) {
  if (!group) return null;
  const variantCount = group.variants?.length ?? 0;
  const trimLine = formatSelectionGroupTrimLine(group);
  const rates = (group.variants ?? [])
    .map((variant) => formatVariantCustomerPriceLine(variant))
    .filter(Boolean);

  let rateRange = null;
  const numericRates = (group.variants ?? [])
    .map((variant) => variant.calculatedRate ?? variant.calculatedPrice)
    .filter((value) => Number.isFinite(Number(value)))
    .map(Number);

  if (numericRates.length >= 2) {
    const min = Math.min(...numericRates);
    const max = Math.max(...numericRates);
    const suffix = normalizePaymentType(group.wishConditions?.paymentType) === 'cash' ? ' €' : ' €/Monat';
    rateRange = `${min.toLocaleString('de-DE')} bis ${max.toLocaleString('de-DE')}${suffix}`;
  } else if (numericRates.length === 1) {
    rateRange = rates[0] ?? null;
  }

  const hasCalculatedRates = numericRates.length > 0;
  const customerLink = group.customerLink?.url ?? group.portfolioLink?.url ?? '';

  return {
    id: group.id,
    modelLabel: group.modelLabel ?? 'Auswahl',
    variantCount,
    trimLine,
    trimLabels: (group.variants ?? []).map((variant) => variant.trimLabel).filter(Boolean),
    wishConditions: group.wishConditions ?? {},
    wishConditionsLine: formatWishConditionsLine(group.wishConditions ?? {}),
    rates,
    rateRange,
    hasCalculatedRates,
    customerLink,
    status: group.status ?? 'prepared',
  };
}

function summarizeBoard(vehicleCards = [], offerSelectionGroups = []) {
  const cards = (vehicleCards ?? []).filter(Boolean);
  const groups = (offerSelectionGroups ?? []).filter(Boolean);

  const cashCards = cards.filter((card) => normalizePaymentType(card.paymentType) === 'cash');
  const leaseCards = cards.filter((card) => {
    const pt = normalizePaymentType(card.paymentType);
    return pt === 'leasing' || pt === 'financing';
  });

  return {
    vehicleCards: cards,
    selectionGroups: groups.map(summarizeSelectionGroup).filter(Boolean),
    primarySelectionGroup: summarizeSelectionGroup(pickPrimarySelectionGroup(groups, cards)),
    hasCashAndLeasing: cashCards.length > 0 && leaseCards.length > 0,
    cashCards,
    leaseCards,
    sentOrOpenedCards: cards.filter((card) => {
      const status = card.vehicleOffer?.status ?? card.offer?.status;
      return status === 'sent' || status === 'opened';
    }),
    openedCards: cards.filter((card) => {
      const status = card.vehicleOffer?.status ?? card.offer?.status;
      return status === 'opened';
    }),
  };
}

function summarizeReactions(lead = {}, vehicleCards = []) {
  const interactions = collectCustomerInteractions(lead, vehicleCards);
  const opened = interactions.filter(({ interaction }) => (
    interaction?.interestStatus === INTEREST_STATUS.OPENED
    || interaction?.openedAt
    || interaction?.interestStatus === INTEREST_STATUS.INTERESTED
  ));
  const interested = interactions.filter(({ interaction }) => (
    interaction?.interestStatus === INTEREST_STATUS.INTERESTED
  ));
  const openQuestionCount = interactions.reduce(
    (sum, { interaction }) => sum + countOpenQuestions(interaction),
    0,
  );

  const offerOpened = interactions.some(({ interaction, card }) => {
    const cardStatus = card?.vehicleOffer?.status ?? card?.offer?.status;
    return cardStatus === 'opened' || interaction?.interestStatus === INTEREST_STATUS.OPENED;
  });

  return {
    interactions,
    offerOpened,
    customerInterested: interested.length > 0,
    openedCount: opened.length,
    openQuestionCount,
  };
}

function summarizeUnterlagen(lead = {}, paymentType = 'unknown') {
  const safeLead = lead ?? {};
  const { openCount, summary } = countUnterlagenOpenTasks(safeLead, paymentType);
  const slots = getUnterlagenSlotsForLead(safeLead, paymentType);
  const openLabels = slots
    .filter((slot) => !['uploaded', 'checked', 'replaced', 'not_needed'].includes(summary.items[slot.id]?.status))
    .map((slot) => slot.label);

  return {
    openCount,
    openLabels,
    uploadUrl: summary.data?.uploadLink?.url ?? safeLead?.crm?.cleverUnterlagen?.uploadLink?.url ?? '',
    hasUploadLink: Boolean(summary.hasUploadLink),
  };
}

function summarizeKundenwissen(lead = {}, kundenhelferNotes = '') {
  const chipCategories = lead?.crm?.kundenhelfer?.chipCategories ?? {};
  const understanding = buildCustomerUnderstanding(lead);
  const notesForOverview = understanding?.verstaendnis?.labels?.length
    ? understanding.verstaendnis.labels.join(', ')
    : kundenhelferNotes;
  const categories = buildKundenwissenOverview(notesForOverview, lead, chipCategories);
  const facts = [];

  for (const category of categories) {
    for (const item of category.items ?? []) {
      const label = item.display ?? item.label ?? item.raw;
      if (label && facts.length < 8) {
        facts.push({ category: category.label, text: label });
      }
    }
  }

  return { categories, facts };
}

function summarizeAdvisorConversation(lead = {}) {
  const conversation = lead?.advisorConversation ?? null;
  if (!conversation) {
    return {
      summary: lead?.advisorConversationSummary ?? '',
      openQuestions: [],
      extractedSignals: [],
    };
  }

  return {
    summary: conversation.summary ?? '',
    openQuestions: (conversation.openQuestions ?? []).map((entry) => (
      typeof entry === 'string' ? entry : entry?.question ?? entry?.text ?? ''
    )).filter(Boolean),
    extractedSignals: conversation.extractedSignals ?? [],
  };
}

function buildGroupedContextDisplay(context = {}) {
  const groups = [];
  let hiddenCount = 0;

  const angebotItems = [];
  if (context.board?.primarySelectionGroup) {
    const group = context.board.primarySelectionGroup;
    angebotItems.push(`${group.modelLabel.replace(/^Kia\s+/i, 'Kia ')}-Auswahl · ${group.variantCount} Varianten`);
  } else if (context.legacy?.vehicleTitle) {
    angebotItems.push(context.legacy.vehicleTitle);
  }
  if (context.wishConditionsLine) {
    angebotItems.push(context.wishConditionsLine.replace(/ · Liefertermin.*$/i, ''));
  }
  if (angebotItems.length) {
    groups.push({ id: 'angebot', label: 'Angebot', items: angebotItems.slice(0, 2) });
  }

  const kundeItems = (context.kundenwissen?.facts ?? [])
    .slice(0, 3)
    .map((fact) => fact.text);
  if (context.advisor?.extractedSignals?.length) {
    hiddenCount += Math.max(0, context.advisor.extractedSignals.length - 1);
  }
  if (kundeItems.length) {
    groups.push({ id: 'kunde', label: 'Kunde', items: kundeItems.slice(0, 2) });
    hiddenCount += Math.max(0, kundeItems.length - 2);
  }

  const offenItems = [];
  if (context.reactions?.offerOpened) offenItems.push('Angebot geöffnet');
  if (context.reactions?.customerInterested) offenItems.push('Kunde interessiert');
  if (context.openCustomerQuestions?.length === 1) {
    offenItems.push(`Frage: ${context.openCustomerQuestions[0].text.slice(0, 40)}${context.openCustomerQuestions[0].text.length > 40 ? '…' : ''}`);
  } else if (context.openCustomerQuestions?.length > 1) {
    offenItems.push(`${context.openCustomerQuestions.length} Kundenfragen offen`);
  }
  if (context.unterlagen?.openCount > 0) {
    offenItems.push(`${context.unterlagen.openCount} Unterlagen offen`);
  }
  if (offenItems.length) {
    groups.push({ id: 'offen', label: 'Offen', items: offenItems.slice(0, 2) });
    hiddenCount += Math.max(0, offenItems.length - 2);
  }

  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);
  const allFacts = (context.kundenwissen?.facts ?? []).length
    + (context.advisor?.extractedSignals ?? []).length
    + (context.openCustomerQuestions ?? []).length;
  hiddenCount = Math.max(hiddenCount, allFacts + offenItems.length + angebotItems.length - totalItems);

  return {
    groups,
    hiddenCount: Math.max(0, hiddenCount),
  };
}

function buildContextPreviewLines(context = {}) {
  const lines = [];

  if (context.board?.primarySelectionGroup) {
    const group = context.board.primarySelectionGroup;
    lines.push(`${group.modelLabel}-Auswahl mit ${group.variantCount} Varianten`);
  } else if (context.legacy?.vehicleTitle) {
    lines.push(`Angebot: ${context.legacy.vehicleTitle}`);
  }

  if (context.wishConditionsLine) {
    lines.push(context.wishConditionsLine);
  }

  for (const fact of context.kundenwissen?.facts?.slice(0, 2) ?? []) {
    lines.push(`Kunde: ${fact.text}`);
  }

  if (context.reactions?.offerOpened) {
    lines.push('Angebot wurde geöffnet');
  } else if (context.reactions?.customerInterested) {
    lines.push('Kunde hat Interesse gezeigt');
  }

  const openQuestions = context.openCustomerQuestions ?? [];
  if (openQuestions.length === 1) {
    lines.push(`1 Kundenfrage offen: „${openQuestions[0].text.slice(0, 48)}${openQuestions[0].text.length > 48 ? '…' : ''}“`);
  } else if (openQuestions.length > 1) {
    lines.push(`${openQuestions.length} Kundenfragen offen`);
  }

  if (context.unterlagen?.openCount > 0) {
    lines.push(`${context.unterlagen.openCount} Unterlagen offen`);
  }

  if (context.advisor?.extractedSignals?.length) {
    const signal = context.advisor.extractedSignals.slice(0, 2).join(' · ');
    lines.push(`Frag Clever: ${signal}`);
  }

  return lines.slice(0, 6);
}

/**
 * Sammelt den vollständigen Kundenkontext für Clever Antworten.
 */
export function buildCleverAnswerContext({
  lead = null,
  customerName = '',
  phone = '',
  email = '',
  vehicleCards = [],
  offerSelectionGroups = [],
  kundenhelferNotes = '',
  sellerName = '',
  dealerName = '',
  wishPaymentType = 'unknown',
} = {}) {
  const wishConditions = resolveWishConditions(lead, wishPaymentType, offerSelectionGroups);
  const paymentType = wishConditions.paymentType;
  const legacyNotes = resolveLegacyKundenhelferNotes(lead, kundenhelferNotes);
  const legacy = buildCleverAntwortenContext({
    lead,
    customerName,
    phone,
    email,
    vehicleCards,
    kundenhelferNotes: legacyNotes,
    sellerName,
    dealerName,
    wishPaymentType: paymentType,
  });

  const schnellChips = buildSchnellaufnahmeChips(wishConditions);
  const wishConditionsLine = schnellChips
    .filter((chip) => chip.field !== 'delivery')
    .map((chip) => chip.label)
    .join(' · ');

  const board = summarizeBoard(vehicleCards, offerSelectionGroups);
  const reactions = summarizeReactions(lead, vehicleCards);
  const unterlagen = summarizeUnterlagen(lead, paymentType);
  const kundenwissen = summarizeKundenwissen(lead, legacyNotes);
  const advisor = summarizeAdvisorConversation(lead);
  const openCustomerQuestions = collectOpenCustomerQuestions(lead, vehicleCards);

  const communicationPreference = kundenwissen.facts.find((fact) => (
    /whatsapp|telefon|e-mail|email|rückruf/i.test(fact.text)
  ))?.text ?? '';

  const context = {
    lead,
    customer: {
      name: customerName || legacy.customerName,
      salutation: legacy.salutation,
      phone,
      email,
      communicationPreference,
    },
    legacy,
    wishConditions,
    wishConditionsLine,
    schnellChips,
    board,
    reactions,
    unterlagen,
    kundenwissen,
    advisor,
    openCustomerQuestions,
    primaryOpenQuestion: openCustomerQuestions[0] ?? null,
    sellerName: legacy.sellerName,
    dealerName: legacy.dealerName,
  };

  context.previewLines = buildContextPreviewLines(context);
  context.contextDisplay = buildGroupedContextDisplay(context);
  return context;
}

export function suggestCleverAnswerType(context = {}) {
  if (context.openCustomerQuestions?.length) return 'kundenfrage';
  if (context.reactions?.offerOpened) return 'nachfassen';
  if (context.board?.primarySelectionGroup?.variantCount > 0) return 'angebot_senden';
  if (context.board?.hasCashAndLeasing) return 'bar_leasing_vergleichen';
  if (context.unterlagen?.openCount > 0 && context.reactions?.offerOpened) return 'unterlagen';
  if (context.legacy?.offerOpened) return 'nachfassen';
  if (context.legacy?.offerUrl && context.legacy?.vehicleTitle) return 'angebot_senden';
  if (context.unterlagen?.openCount > 0) return 'unterlagen';
  if (context.kundenwissen?.facts?.some((fact) => /probefahrt/i.test(fact.text))) return 'probefahrt';
  return 'angebot_senden';
}
