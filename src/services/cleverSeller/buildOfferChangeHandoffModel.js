/**
 * Quiet Change-Request-Handoff (Suggested Update).
 * Ist → Soll + eine Primary „Angebot anpassen“ – keine Edit-Maske als First Screen.
 *
 * @see docs/CLEVER_UX_MANIFEST_V1.md
 */

import {
  findPortalChangeRequest,
  findSendableVehicleOffer,
} from './determineNextBestSellerAction.js';
import {
  getVehicleOffer,
  listStoredVehicleOffers,
  resolveSourceOfferDraftId,
} from '../vehicleOffer.js';
import { PORTFOLIO_CHANGE_DIMENSIONS } from '../crm/customerOfferPortfolioService.js';

function formatKm(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `${n.toLocaleString('de-DE')} km/Jahr`;
}

function formatMonths(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `${n} Monate`;
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `${n.toLocaleString('de-DE')} €`;
}

function parseRequestedMileage(questionText = '', change = null) {
  if (Number.isFinite(Number(change?.requestedMileage))) {
    return Number(change.requestedMileage);
  }
  const raw = String(questionText || '');
  const m = raw.match(/(\d{1,2}(?:[.\s]\d{3})+|\d{4,6})\s*(?:km|kilometer)?/i);
  if (!m) return null;
  const n = Number(String(m[1]).replace(/[.\s]/g, ''));
  return Number.isFinite(n) && n >= 1000 ? n : null;
}

function resolveOfferForChange(lead, change) {
  const cardId = change?.cardId || null;
  if (cardId) {
    const byId = getVehicleOffer(lead, { id: cardId });
    if (byId) return byId;
  }
  const draftId = change?.offerDraftId || null;
  const offers = listStoredVehicleOffers(lead) || [];
  if (draftId) {
    const byDraft = offers.find((o) => resolveSourceOfferDraftId(o) === draftId || o.offerDraftId === draftId);
    if (byDraft) return byDraft;
  }
  return findSendableVehicleOffer(lead)?.offer || offers[0] || null;
}

function buildDiffLines(lead, change) {
  const offer = resolveOfferForChange(lead, change);
  const dimension = change?.changeDimension || null;
  const questionText = change?.questionText || '';
  const dimLabel = PORTFOLIO_CHANGE_DIMENSIONS[dimension]
    || (dimension === 'mileage' ? 'Kilometer' : null)
    || 'Kondition';

  if (dimension === 'mileage' || /km|kilometer/i.test(questionText)) {
    const before = offer?.mileagePerYear
      ?? offer?.annualMileage
      ?? offer?.boardOffer?.payment?.mileagePerYear
      ?? lead?.wish?.mileagePerYear
      ?? null;
    const after = parseRequestedMileage(questionText, change);
    return {
      dimensionLabel: 'Kilometer',
      beforeLabel: formatKm(before) || (before != null ? String(before) : 'bisherig'),
      afterLabel: formatKm(after) || questionText || 'Kundenwunsch',
      beforeValue: before,
      afterValue: after,
    };
  }

  if (dimension === 'term' || /laufzeit|monat/i.test(questionText)) {
    const before = offer?.termMonths ?? offer?.boardOffer?.payment?.termMonths ?? lead?.wish?.termMonths;
    return {
      dimensionLabel: 'Laufzeit',
      beforeLabel: formatMonths(before) || 'bisherig',
      afterLabel: questionText || 'Kundenwunsch',
      beforeValue: before,
      afterValue: null,
    };
  }

  if (dimension === 'down_payment' || /anzahlung|sonderzahlung/i.test(questionText)) {
    const before = offer?.downPayment ?? lead?.wish?.downPayment;
    return {
      dimensionLabel: 'Sonderzahlung',
      beforeLabel: formatMoney(before) || 'bisherig',
      afterLabel: questionText || 'Kundenwunsch',
      beforeValue: before,
      afterValue: null,
    };
  }

  return {
    dimensionLabel: dimLabel,
    beforeLabel: 'bisheriges Angebot',
    afterLabel: questionText || 'Kundenänderung',
    beforeValue: null,
    afterValue: null,
  };
}

/**
 * @param {{ lead?: object|null, nbaPayload?: object }} params
 * @returns {object|null}
 */
export function buildOfferChangeHandoffModel({ lead = null, nbaPayload = {} } = {}) {
  if (!lead) return null;
  const change = findPortalChangeRequest(lead);
  if (!change) return null;

  const payload = {
    offerDraftId: nbaPayload.offerDraftId || change.offerDraftId,
    cardId: nbaPayload.cardId || change.cardId,
    questionText: nbaPayload.questionText || change.questionText,
    changeDimension: nbaPayload.changeDimension || change.changeDimension,
    seedDraft: nbaPayload.seedDraft
      || (change.questionText
        ? `Passe Angebot an: ${change.questionText}`
        : 'Passe das Angebot an die Kundenänderung an.'),
    baseOnCurrentOffer: true,
  };

  const diff = buildDiffLines(lead, { ...change, ...payload });
  const offer = resolveOfferForChange(lead, change);
  const vehicleLabel = offer?.modelLabel
    || offer?.model
    || lead?.crm?.needProfile?.selectedModelKey
    || 'Angebot';

  return {
    reviewType: 'offer_change_handoff',
    compactUi: true,
    hideGlobalAccept: true,
    briefingPresenter: true,
    summaryLine: 'Angebot anpassen',
    offerDraftId: payload.offerDraftId || null,
    offerChange: {
      vehicleLabel,
      dimensionLabel: diff.dimensionLabel,
      beforeLabel: diff.beforeLabel,
      afterLabel: diff.afterLabel,
      questionText: payload.questionText || '',
    },
    offerReview: {
      vehicleLabel,
      heroLine: 'Kunde möchte eine Änderung',
      conditionsLine: `Bisher: ${diff.beforeLabel} → Neu: ${diff.afterLabel}`,
      openLine: payload.questionText || null,
      inCustomerAkte: true,
      conflict: null,
      localClarify: null,
    },
    groups: [],
    collapsedContext: null,
    conflictBox: null,
    actionSections: [{
      id: 'offer_change_handoff',
      kind: 'offer_change_handoff',
      title: 'Angebot anpassen',
      headline: 'Kunde möchte eine Änderung',
      line: `Bisher: ${diff.beforeLabel} → Neu: ${diff.afterLabel}`,
      sellerSummary: payload.questionText
        || `${diff.dimensionLabel}: ${diff.beforeLabel} → ${diff.afterLabel}`,
      clarifyPrompt: null,
      primaryActions: [{
        id: 'apply_offer_change',
        label: 'Angebot anpassen',
        action: 'apply_offer_change',
        tone: 'primary',
        ...payload,
      }],
      secondaryActions: [{
        id: 'dismiss_offer_change',
        label: 'Später',
        action: 'dismiss_offer_change',
        tone: 'secondary',
      }],
      complete: false,
    }],
  };
}
