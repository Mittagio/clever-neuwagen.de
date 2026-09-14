/**
 * Seller Activity Presenter – Portal Reaction V1
 *
 * Leitet aus Lead-/Portfolio-/NBA-State eine kompakte Verkäufer-Aktivität ab:
 * WER · WAS · IST→SOLL · NEXT (ein Primary CTA).
 *
 * Keine zweite Wahrheit – liest bestehende customerReaction + Quiet Diff.
 */

import {
  PORTFOLIO_REACTION_STATUS,
} from '../crm/customerOfferPortfolioService.js';
import {
  listStoredVehicleOffers,
  resolveSourceOfferDraftId,
} from '../vehicleOffer.js';
import { buildOfferChangeHandoffModel } from './buildOfferChangeHandoffModel.js';
import { findPortalChangeRequest } from './determineNextBestSellerAction.js';
import { classifyPortalFreitextSignals } from './portalReactionSignals.js';

export { classifyPortalFreitextSignals } from './portalReactionSignals.js';

export const SELLER_PORTAL_ACTIVITY_KIND = Object.freeze({
  CHANGE_REQUEST: 'change_request',
  INTERESTED: 'interested',
  QUESTION: 'question',
  CALL_REQUESTED: 'call_requested',
  DECLINED: 'declined',
});

const KIND_SORT_RANK = {
  [SELLER_PORTAL_ACTIVITY_KIND.CHANGE_REQUEST]: 0,
  [SELLER_PORTAL_ACTIVITY_KIND.INTERESTED]: 1,
  [SELLER_PORTAL_ACTIVITY_KIND.QUESTION]: 2,
  [SELLER_PORTAL_ACTIVITY_KIND.CALL_REQUESTED]: 2,
  [SELLER_PORTAL_ACTIVITY_KIND.DECLINED]: 4,
};

function customerName(lead = {}) {
  return lead?.contact?.name || lead?.name || 'Kunde';
}

function vehicleLabelFromItem(item = {}, offer = null) {
  const model = item.modelLabel
    || offer?.modelLabel
    || offer?.model
    || 'Angebot';
  const color = item.colorLabel || item.exteriorColor || offer?.colorLabel || '';
  if (color && !String(model).toLowerCase().includes(String(color).toLowerCase())) {
    return `${model} ${color}`.trim();
  }
  return model;
}

function resolveOfferDraftId(item = {}, offer = null) {
  return resolveSourceOfferDraftId(item)
    || item.sourceOfferDraftId
    || item.offerDraftId
    || resolveSourceOfferDraftId(offer)
    || offer?.offerDraftId
    || offer?.sourceOfferDraftId
    || null;
}

function resolveOfferForItem(lead, item) {
  const draftId = resolveOfferDraftId(item);
  const cardId = item?.vehicleCardId || item?.id || null;
  const offers = listStoredVehicleOffers(lead) || [];
  if (draftId) {
    const byDraft = offers.find((o) => (
      resolveSourceOfferDraftId(o) === draftId
      || o.offerDraftId === draftId
      || o.sourceOfferDraftId === draftId
    ));
    if (byDraft) return byDraft;
  }
  if (cardId) {
    return offers.find((o) => (
      o.id === cardId || o.vehicleCardId === cardId || o.vehicleTrackId === cardId
    )) || null;
  }
  return null;
}

function formatDiffShort(rows = []) {
  return rows.map((row) => {
    const before = String(row.beforeLabel || '').replace(/\s*km\/Jahr$/i, '');
    const after = String(row.afterLabel || '').replace(/\s*km\/Jahr$/i, '');
    if (/kilometer/i.test(row.dimensionLabel || '')) {
      return `${before} → ${after} km`;
    }
    if (/anzahlung/i.test(row.dimensionLabel || '')) {
      return `${before} → ${after} Anzahlung`;
    }
    return `${before} → ${after}`;
  }).filter(Boolean);
}

function activityFromChange(lead, item, reaction) {
  const change = findPortalChangeRequest(lead);
  const handoff = buildOfferChangeHandoffModel({
    lead,
    nbaPayload: {
      offerDraftId: change?.offerDraftId || resolveOfferDraftId(item),
      cardId: change?.cardId || item.vehicleCardId || item.id,
      questionText: reaction.questionText || '',
      changeDimension: reaction.changeDimension || null,
    },
  });
  const signals = classifyPortalFreitextSignals(reaction.questionText || '');
  const offer = resolveOfferForItem(lead, item);
  const vehicleLabel = vehicleLabelFromItem(item, offer);
  const rows = handoff?.offerChange?.rows || [];
  const diffLines = formatDiffShort(rows);
  const openQuestions = signals.openQuestions.length
    ? signals.openQuestions
    : [];
  const openQuestionLines = openQuestions.map((q) => q.text).filter(Boolean);

  return {
    kind: SELLER_PORTAL_ACTIVITY_KIND.CHANGE_REQUEST,
    customerName: customerName(lead),
    vehicleLabel,
    headline: `Möchte ${vehicleLabel}-Angebot ändern`,
    wasLine: `möchte sein ${vehicleLabel}-Angebot ändern`,
    diffLines,
    diffSummary: diffLines.join(' · ') || null,
    customerWishText: String(reaction.questionText || '').trim() || null,
    openQuestionLines,
    openQuestions,
    partialSuccess: openQuestionLines.length > 0,
    primaryCtaLabel: 'Angebot anpassen',
    actionId: 'modify_offer',
    handler: 'modify_offer',
    offerDraftId: resolveOfferDraftId(item, offer) || change?.offerDraftId || null,
    vehicleCardId: item.vehicleCardId || item.id || null,
    portfolioItemId: item.id || null,
    reactedAt: reaction.reactedAt || null,
    sortRank: KIND_SORT_RANK[SELLER_PORTAL_ACTIVITY_KIND.CHANGE_REQUEST],
    reasonLines: [
      `Kundenänderung: ${vehicleLabel}`,
      ...diffLines,
      ...openQuestionLines.map((q) => `Frage: ${q}`),
    ].filter(Boolean),
    rateStaleExpected: true,
  };
}

function activityFromInterested(lead, item, reaction) {
  const offer = resolveOfferForItem(lead, item);
  const vehicleLabel = vehicleLabelFromItem(item, offer);
  return {
    kind: SELLER_PORTAL_ACTIVITY_KIND.INTERESTED,
    customerName: customerName(lead),
    vehicleLabel,
    headline: `Hat ${vehicleLabel}-Angebot angenommen`,
    wasLine: `möchte den ${vehicleLabel} übernehmen`,
    diffLines: [],
    diffSummary: null,
    customerWishText: String(reaction.questionText || '').trim() || null,
    openQuestionLines: [],
    openQuestions: [],
    partialSuccess: false,
    primaryCtaLabel: 'Abschluss vorbereiten',
    actionId: 'application_prepare',
    handler: 'application_prepare',
    offerDraftId: resolveOfferDraftId(item, offer),
    vehicleCardId: item.vehicleCardId || item.id || null,
    portfolioItemId: item.id || null,
    reactedAt: reaction.reactedAt || null,
    sortRank: KIND_SORT_RANK[SELLER_PORTAL_ACTIVITY_KIND.INTERESTED],
    reasonLines: [`Zusage: ${vehicleLabel}`],
    rateStaleExpected: false,
  };
}

function activityFromQuestion(lead, item, reaction) {
  const offer = resolveOfferForItem(lead, item);
  const vehicleLabel = vehicleLabelFromItem(item, offer);
  const signals = classifyPortalFreitextSignals(reaction.questionText || '');
  // Mixed: Frage + sichere Änderung → Change Presenter (Partial Success)
  if (signals.hasStructuredChange) {
    return activityFromChange(lead, {
      ...item,
      customerReaction: {
        ...reaction,
        status: PORTFOLIO_REACTION_STATUS.CHANGE_REQUESTED,
      },
    }, {
      ...reaction,
      status: PORTFOLIO_REACTION_STATUS.CHANGE_REQUESTED,
    });
  }
  const quote = String(reaction.questionText || '').trim();
  const openQuestionLines = signals.openQuestions.map((q) => q.text).filter(Boolean);
  if (quote && !openQuestionLines.length) openQuestionLines.push(quote);

  return {
    kind: SELLER_PORTAL_ACTIVITY_KIND.QUESTION,
    customerName: customerName(lead),
    vehicleLabel,
    headline: `Fragt zum ${vehicleLabel}`,
    wasLine: `hat eine Frage zum ${vehicleLabel}-Angebot`,
    diffLines: [],
    diffSummary: null,
    customerWishText: quote || null,
    openQuestionLines,
    openQuestions: signals.openQuestions,
    partialSuccess: false,
    primaryCtaLabel: 'Antworten',
    actionId: 'draft_message',
    handler: 'draft_message',
    offerDraftId: resolveOfferDraftId(item, offer),
    vehicleCardId: item.vehicleCardId || item.id || null,
    portfolioItemId: item.id || null,
    reactedAt: reaction.reactedAt || null,
    sortRank: KIND_SORT_RANK[SELLER_PORTAL_ACTIVITY_KIND.QUESTION],
    reasonLines: [
      `Kundenfrage: ${vehicleLabel}`,
      ...(openQuestionLines.slice(0, 2)),
    ].filter(Boolean),
    rateStaleExpected: false,
  };
}

function activityFromCall(lead, item, reaction) {
  const offer = resolveOfferForItem(lead, item);
  const vehicleLabel = vehicleLabelFromItem(item, offer);
  return {
    kind: SELLER_PORTAL_ACTIVITY_KIND.CALL_REQUESTED,
    customerName: customerName(lead),
    vehicleLabel,
    headline: 'Möchte Rückruf',
    wasLine: `wünscht Rückruf zum ${vehicleLabel}`,
    diffLines: [],
    diffSummary: null,
    customerWishText: String(reaction.questionText || '').trim() || null,
    openQuestionLines: [],
    openQuestions: [],
    partialSuccess: false,
    primaryCtaLabel: 'Antworten',
    actionId: 'draft_message',
    handler: 'draft_message',
    offerDraftId: resolveOfferDraftId(item, offer),
    vehicleCardId: item.vehicleCardId || item.id || null,
    portfolioItemId: item.id || null,
    reactedAt: reaction.reactedAt || null,
    sortRank: KIND_SORT_RANK[SELLER_PORTAL_ACTIVITY_KIND.CALL_REQUESTED],
    reasonLines: [`Rückrufwunsch: ${vehicleLabel}`],
    rateStaleExpected: false,
  };
}

function activityFromDeclined(lead, item, reaction) {
  const offer = resolveOfferForItem(lead, item);
  const vehicleLabel = vehicleLabelFromItem(item, offer);
  return {
    kind: SELLER_PORTAL_ACTIVITY_KIND.DECLINED,
    customerName: customerName(lead),
    vehicleLabel,
    headline: `Hat ${vehicleLabel} abgelehnt`,
    wasLine: `lehnt das ${vehicleLabel}-Angebot ab`,
    diffLines: [],
    diffSummary: null,
    customerWishText: String(reaction.declineNote || reaction.questionText || '').trim() || null,
    openQuestionLines: [],
    openQuestions: [],
    partialSuccess: false,
    primaryCtaLabel: 'Nachfassen',
    actionId: 'create_follow_up',
    handler: 'create_follow_up',
    offerDraftId: resolveOfferDraftId(item, offer),
    vehicleCardId: item.vehicleCardId || item.id || null,
    portfolioItemId: item.id || null,
    reactedAt: reaction.reactedAt || null,
    sortRank: KIND_SORT_RANK[SELLER_PORTAL_ACTIVITY_KIND.DECLINED],
    reasonLines: [`Ablehnung: ${vehicleLabel}`],
    rateStaleExpected: false,
  };
}

/**
 * Alle offenen Portal-Reaktionen als Seller Activities (Lead = Authority).
 * @returns {object[]}
 */
export function listSellerPortalReactionActivities(lead = {}) {
  const items = lead?.crm?.customerOfferPortfolio?.items;
  if (!Array.isArray(items) || !items.length) return [];

  const out = [];
  for (const item of items) {
    const reaction = item?.customerReaction;
    const status = reaction?.status;
    if (!status || status === PORTFOLIO_REACTION_STATUS.NONE) continue;

    if (status === PORTFOLIO_REACTION_STATUS.CHANGE_REQUESTED) {
      out.push(activityFromChange(lead, item, reaction));
      continue;
    }
    if (status === PORTFOLIO_REACTION_STATUS.INTERESTED) {
      out.push(activityFromInterested(lead, item, reaction));
      continue;
    }
    if (status === PORTFOLIO_REACTION_STATUS.MORE_INFO) {
      out.push(activityFromQuestion(lead, item, reaction));
      continue;
    }
    if (status === PORTFOLIO_REACTION_STATUS.CALL_REQUESTED) {
      out.push(activityFromCall(lead, item, reaction));
      continue;
    }
    if (status === PORTFOLIO_REACTION_STATUS.DECLINED) {
      out.push(activityFromDeclined(lead, item, reaction));
    }
  }

  return out.sort((a, b) => {
    if (a.sortRank !== b.sortRank) return a.sortRank - b.sortRank;
    const ta = Date.parse(a.reactedAt || '') || 0;
    const tb = Date.parse(b.reactedAt || '') || 0;
    return tb - ta;
  });
}

/**
 * Primäre Seller Activity für Heute / Akte / Sync.
 * @returns {object|null}
 */
export function buildPrimarySellerPortalReactionActivity(lead = {}) {
  const list = listSellerPortalReactionActivities(lead);
  return list[0] || null;
}

/**
 * Kompakte Akte-Zeilen (WER / WAS / IST→SOLL / NEXT).
 */
export function presentSellerPortalReactionForAkte(activity = null, lead = null) {
  if (!activity) return null;
  const name = activity.customerName || customerName(lead || {});
  return {
    customerName: name,
    title: `${name}`,
    subtitle: activity.wasLine || activity.headline,
    reactionLabel: activity.kind === SELLER_PORTAL_ACTIVITY_KIND.CHANGE_REQUEST
      ? `Reaktion auf ${activity.vehicleLabel}`
      : activity.headline,
    customerWishText: activity.customerWishText,
    diffLines: activity.diffLines || [],
    openQuestionLines: activity.openQuestionLines || [],
    primaryCtaLabel: activity.primaryCtaLabel,
    offerDraftId: activity.offerDraftId,
    vehicleCardId: activity.vehicleCardId,
    handler: activity.handler,
    kind: activity.kind,
    partialSuccess: Boolean(activity.partialSuccess),
  };
}
