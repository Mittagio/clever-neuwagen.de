/**
 * Slim Offer-Preparation-Handoff nach NBA prepare_offer.
 * Keine neue Architektur – Presenter über bestehendem Draft + upload_pdf / Manual.
 *
 * @see docs/CLEVER_UX_MANIFEST_V1.md
 * @see docs/CLEVER_OFFER_INTAKE_FREEZE.md
 */

import { getOfferDraftById } from './cleverWorkingDraft.js';
import { findSendableVehicleOffer } from './determineNextBestSellerAction.js';

function formatModelLabel(identity = null, nbaPayload = {}) {
  const key = identity?.model?.canonical
    || identity?.modelKey
    || nbaPayload.modelKey
    || null;
  if (!key) return 'Fahrzeug';
  const trim = identity?.trim?.label || identity?.trim?.canonical || nbaPayload.trim || null;
  const raw = String(key).trim();
  const model = /^(EV\d)$/i.test(raw)
    ? `Kia ${raw.toUpperCase()}`
    : (/^kia\s/i.test(raw) ? raw : `Kia ${raw}`);
  return trim ? `${model} ${trim}`.trim() : model;
}

function buildConditionsLine(draft = null, lead = null, nbaPayload = {}) {
  const commercial = draft?.commercialScenario || {};
  const wish = lead?.wish || {};
  const profile = lead?.crm?.needProfile || {};
  const term = commercial.termMonths
    ?? nbaPayload.termMonths
    ?? wish.termMonths
    ?? null;
  const kmVariants = Array.isArray(profile.annualMileageVariants)
    ? profile.annualMileageVariants
    : null;
  const km = commercial.annualMileage
    ?? commercial.mileagePerYear
    ?? nbaPayload.annualMileage
    ?? wish.mileagePerYear
    ?? wish.annualMileage
    ?? null;
  const az = commercial.downPayment
    ?? nbaPayload.downPayment
    ?? wish.downPayment
    ?? null;
  const parts = [];
  if (term != null) parts.push(`${term} Monate`);
  if (Array.isArray(kmVariants) && kmVariants.length >= 2) {
    parts.push(
      kmVariants.map((n) => `${Number(n).toLocaleString('de-DE')} km`).join(' / '),
    );
  } else if (km != null) {
    const n = Number(km);
    parts.push(`${Number.isFinite(n) ? n.toLocaleString('de-DE') : km} km/Jahr`);
  }
  if (az != null) {
    const n = Number(az);
    parts.push(`${Number.isFinite(n) ? n.toLocaleString('de-DE') : az} € Sonderzahlung`);
  }
  return parts.length ? parts.join(' · ') : null;
}

function buildVariantWishesLine(lead = null) {
  const profile = lead?.crm?.needProfile || {};
  const bits = [];
  for (const v of profile.batteryVariantWishes || []) {
    const label = typeof v === 'object' ? v.label : String(v || '');
    if (label) bits.push(label);
  }
  for (const km of profile.annualMileageVariants || []) {
    bits.push(`${Number(km).toLocaleString('de-DE')} km`);
  }
  for (const s of profile.leaseCalcScenarioWishes || []) {
    const label = typeof s === 'object' ? s.label : String(s || '');
    if (label) bits.push(label);
  }
  for (const s of profile.leaseTotalMileageWishes || []) {
    const label = typeof s === 'object' ? s.label : String(s || '');
    if (label) bits.push(label);
  }
  const az = lead?.wish?.downPayment ?? profile?.budget?.downPayment ?? null;
  if (az != null && Number.isFinite(Number(az)) && !(profile.leaseCalcScenarioWishes || []).length) {
    bits.push(`${Number(az).toLocaleString('de-DE')} € AZ`);
  }
  return bits.length ? bits.join(' · ') : null;
}

/**
 * @param {{
 *   lead?: object|null,
 *   offerDraftId?: string|null,
 *   nbaPayload?: object,
 * }} params
 * @returns {object|null} Universal-Review-kompatibles Model für SellerUniversalReviewCard
 */
export function buildOfferPreparationHandoffModel({
  lead = null,
  offerDraftId = null,
  nbaPayload = {},
} = {}) {
  if (!lead || !offerDraftId) return null;
  if (findSendableVehicleOffer(lead)) return null;

  const draft = getOfferDraftById(lead, offerDraftId);
  if (!draft) return null;

  const identity = draft.vehicleIdentityDraft || null;
  const vehicleLabel = formatModelLabel(identity, nbaPayload);
  const conditionsLine = buildConditionsLine(draft, lead, nbaPayload);
  const variantWishesLine = buildVariantWishesLine(lead);
  const rateValue = draft.monthlyRate ?? draft.rate ?? draft.payment?.calculatedRate ?? null;
  const rateOpen = rateValue == null || rateValue === '';
  const prepLine = [variantWishesLine, conditionsLine].filter(Boolean).join(' · ') || conditionsLine;

  return {
    reviewType: 'offer_preparation_handoff',
    compactUi: true,
    hideGlobalAccept: true,
    summaryLine: vehicleLabel,
    offerDraftId,
    offerReview: {
      vehicleLabel,
      heroLine: vehicleLabel,
      conditionsLine: prepLine,
      variantWishesLine,
      openLine: rateOpen ? 'Rate noch offen' : null,
      inCustomerAkte: true,
      conflict: null,
      localClarify: null,
    },
    groups: [],
    collapsedContext: null,
    conflictBox: null,
    actionSections: [{
      id: 'offer_preparation_handoff',
      kind: 'offer_preparation_handoff',
      title: 'Angebot vorbereiten',
      headline: vehicleLabel,
      line: prepLine,
      clarifyPrompt: rateOpen ? 'Rate noch offen' : null,
      primaryActions: [{
        id: 'upload_pdf',
        label: 'Kalkulation / PDF hochladen',
        action: 'upload_pdf',
        tone: 'primary',
        offerDraftId,
      }],
      secondaryActions: [
        {
          id: 'open_offer_manual',
          label: 'Manuell ergänzen',
          action: 'open_offer_manual',
          tone: 'secondary',
          offerDraftId,
        },
        {
          id: 'dismiss_offer_prep',
          label: 'Später bearbeiten',
          action: 'dismiss_offer_prep',
          tone: 'compact',
          offerDraftId,
        },
      ],
      localClarify: null,
    }],
  };
}

/**
 * Resolve strict offerDraftId for prepare_offer NBA click.
 */
export function resolvePrepareOfferDraftId(lead = null, nbaPayload = {}) {
  const fromPayload = nbaPayload?.offerDraftId || null;
  if (fromPayload && getOfferDraftById(lead, fromPayload)) return fromPayload;
  const current = lead?.crm?.cleverWorkingState?.currentOfferDraftId || null;
  if (current && getOfferDraftById(lead, current)) return current;
  return fromPayload || current || null;
}
