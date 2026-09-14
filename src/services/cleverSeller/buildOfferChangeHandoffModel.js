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
import { classifyPortalFreitextSignals } from './portalReactionSignals.js';

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
  // 0 ist ein echter Wert
  if (!Number.isFinite(n)) return null;
  return `${n.toLocaleString('de-DE')} €`;
}

function parseRequestedMileageFromText(questionText = '') {
  const raw = String(questionText || '');
  const stattNew = raw.match(
    /(\d{1,2}(?:[.\s]\d{3})+|\d{4,6})\s+statt\b/i,
  );
  if (stattNew) {
    const n = Number(String(stattNew[1]).replace(/[.\s]/g, ''));
    if (Number.isFinite(n) && n >= 1000) return n;
  }
  // Bevorzuge „mit 15.000 km“ / „20.000 Kilometern“ vor „statt 12.500“
  const preferred = raw.match(
    /(?:mit|auf|bitte)\s+(\d{1,2}(?:[.\s]\d{3})+|\d{4,6})\s*(?:km|kilometer)/i,
  ) || raw.match(
    /(\d{1,2}(?:[.\s]\d{3})+|\d{4,6})\s*(?:km|kilometer)/i,
  );
  if (!preferred) return null;
  const n = Number(String(preferred[1]).replace(/[.\s]/g, ''));
  return Number.isFinite(n) && n >= 1000 ? n : null;
}

function parseRequestedDownPaymentFromText(questionText = '') {
  const raw = String(questionText || '');
  if (/\bohne\s+anzahlung\b|\bkeine\s+anzahlung\b|\banzahlung\s*(?:von\s*)?(?:0|null)\b/i.test(raw)) {
    return 0;
  }
  const m = raw.match(/\banzahlung\b[^\d]{0,24}(\d{1,3}(?:[.\s]\d{3})*|\d+)/i)
    || raw.match(/(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*€?\s*(?:anzahlung|sonderzahlung)/i);
  if (!m) return null;
  const n = Number(String(m[1]).replace(/[.\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseRequestedMileage(questionText = '', change = null) {
  if (change?.requestedMileage != null && Number.isFinite(Number(change.requestedMileage))) {
    return Number(change.requestedMileage);
  }
  return parseRequestedMileageFromText(questionText);
}

function parseRequestedDownPayment(questionText = '', change = null) {
  if (change?.requestedDownPayment != null && Number.isFinite(Number(change.requestedDownPayment))) {
    return Number(change.requestedDownPayment);
  }
  return parseRequestedDownPaymentFromText(questionText);
}

function resolveOfferForChange(lead, change) {
  const cardId = change?.cardId || null;
  if (cardId) {
    const byId = getVehicleOffer(lead, { id: cardId });
    if (byId?.monthlyRate != null || byId?.id) return byId;
  }
  const draftId = change?.offerDraftId || null;
  const offers = listStoredVehicleOffers(lead) || [];
  if (draftId) {
    const byDraft = offers.find((o) => resolveSourceOfferDraftId(o) === draftId || o.offerDraftId === draftId);
    if (byDraft) return byDraft;
  }
  if (cardId) {
    const byTrack = offers.find((o) => o.vehicleCardId === cardId || o.vehicleTrackId === cardId);
    if (byTrack) return byTrack;
  }
  return findSendableVehicleOffer(lead)?.offer || offers[0] || null;
}

/**
 * Quiet Diff: ggf. mehrere preisrelevante Änderungen kompakt (km + AZ).
 */
function buildDiffLines(lead, change) {
  const offer = resolveOfferForChange(lead, change);
  const dimension = change?.changeDimension || null;
  const questionText = change?.questionText || '';
  const dimLabel = PORTFOLIO_CHANGE_DIMENSIONS[dimension]
    || (dimension === 'mileage' ? 'Kilometer' : null)
    || 'Kondition';

  const rows = [];
  const requestedKm = parseRequestedMileage(questionText, change);
  const beforeKm = offer?.mileagePerYear
    ?? offer?.annualMileage
    ?? offer?.boardOffer?.payment?.mileagePerYear
    ?? lead?.wish?.mileagePerYear
    ?? null;
  const wantsKm = requestedKm != null
    || dimension === 'mileage'
    || /\b(?:km|kilometer)\b/i.test(questionText);
  if (wantsKm && (beforeKm != null || requestedKm != null)) {
    rows.push({
      dimensionLabel: 'Kilometer',
      beforeLabel: formatKm(beforeKm) || (beforeKm != null ? String(beforeKm) : 'bisherig'),
      afterLabel: formatKm(requestedKm) || questionText || 'Kundenwunsch',
      beforeValue: beforeKm,
      afterValue: requestedKm,
    });
  }

  const requestedAz = parseRequestedDownPayment(questionText, change);
  const beforeAz = offer?.downPayment
    ?? offer?.boardOffer?.payment?.downPayment
    ?? lead?.wish?.downPayment
    ?? null;
  const wantsAz = requestedAz != null
    || dimension === 'down_payment'
    || /\b(?:anzahlung|sonderzahlung|ohne\s+anzahlung)\b/i.test(questionText);
  if (wantsAz && (beforeAz != null || requestedAz != null)) {
    rows.push({
      dimensionLabel: 'Anzahlung',
      beforeLabel: formatMoney(beforeAz) ?? 'bisherig',
      afterLabel: formatMoney(requestedAz) ?? (questionText || 'Kundenwunsch'),
      beforeValue: beforeAz,
      afterValue: requestedAz,
    });
  }

  if (rows.length === 0 && (dimension === 'term' || /laufzeit|monat/i.test(questionText))) {
    const before = offer?.termMonths ?? offer?.boardOffer?.payment?.termMonths ?? lead?.wish?.termMonths;
    rows.push({
      dimensionLabel: 'Laufzeit',
      beforeLabel: formatMonths(before) || 'bisherig',
      afterLabel: questionText || 'Kundenwunsch',
      beforeValue: before,
      afterValue: null,
    });
  }

  if (rows.length === 0) {
    rows.push({
      dimensionLabel: dimLabel,
      beforeLabel: 'bisheriges Angebot',
      afterLabel: questionText || 'Kundenänderung',
      beforeValue: null,
      afterValue: null,
    });
  }

  const beforeLabel = rows.map((r) => r.beforeLabel).join(' · ');
  const afterLabel = rows.map((r) => r.afterLabel).join(' · ');
  return {
    rows,
    dimensionLabel: rows.length > 1
      ? rows.map((r) => r.dimensionLabel).join(' · ')
      : rows[0].dimensionLabel,
    beforeLabel,
    afterLabel,
    beforeValue: rows[0].beforeValue,
    afterValue: rows[0].afterValue,
    requestedMileage: requestedKm,
    requestedDownPayment: requestedAz,
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
    requestedMileage: change.requestedMileage ?? null,
    requestedDownPayment: change.requestedDownPayment ?? null,
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
    || change?.item?.modelLabel
    || lead?.crm?.needProfile?.selectedModelKey
    || 'Angebot';
  const customerName = lead?.contact?.name || lead?.name || 'Kunde';
  const signals = classifyPortalFreitextSignals(payload.questionText || '');
  const openQuestionLines = (signals.openQuestions || [])
    .map((q) => q.text)
    .filter(Boolean);
  const conditionsLine = diff.rows.length > 1
    ? diff.rows.map((r) => `${r.beforeLabel} → ${r.afterLabel}`).join(' · ')
    : `${diff.beforeLabel} → ${diff.afterLabel}`;
  const openLineParts = [conditionsLine];
  if (openQuestionLines.length) {
    openLineParts.push(`Zusätzlich: ${openQuestionLines.join(' · ')}`);
  }
  const openLine = openLineParts.join('\n');
  const heroLine = `möchte sein ${vehicleLabel}-Angebot ändern`;

  return {
    reviewType: 'offer_change_handoff',
    compactUi: true,
    hideGlobalAccept: true,
    briefingPresenter: true,
    summaryLine: 'Angebot anpassen',
    offerDraftId: payload.offerDraftId || null,
    sellerActivity: {
      customerName,
      wasLine: heroLine,
      diffLines: diff.rows.map((r) => `${r.beforeLabel} → ${r.afterLabel}`),
      openQuestionLines,
      partialSuccess: openQuestionLines.length > 0,
      primaryCtaLabel: 'Angebot anpassen',
    },
    offerChange: {
      vehicleLabel,
      dimensionLabel: diff.dimensionLabel,
      beforeLabel: diff.beforeLabel,
      afterLabel: diff.afterLabel,
      questionText: payload.questionText || '',
      rows: diff.rows,
      requestedMileage: diff.requestedMileage,
      requestedDownPayment: diff.requestedDownPayment,
      openQuestionLines,
    },
    offerReview: {
      vehicleLabel,
      heroLine: `${customerName}`,
      conditionsLine: heroLine,
      openLine,
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
      headline: heroLine,
      line: conditionsLine,
      sellerSummary: openLine
        || payload.questionText
        || `${diff.dimensionLabel}: ${diff.beforeLabel} → ${diff.afterLabel}`,
      clarifyPrompt: openLine,
      primaryActions: [{
        id: 'apply_offer_change',
        label: 'Angebot anpassen',
        action: 'apply_offer_change',
        tone: 'primary',
        offerDraftId: payload.offerDraftId || null,
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
