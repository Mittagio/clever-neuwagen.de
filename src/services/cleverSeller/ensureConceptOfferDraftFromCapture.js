/**
 * Clever Agent V1 – Concept-Offer-Draft aus Capture-Facts (rate immer null).
 * Getrennt von interpretCleverInput, damit Apply-Pfad keinen Import-Zyklus hat.
 */

import {
  enrichPrepareOfferPayloadWithIdentityDraft,
} from './vehicleIdentityDraft.js';
import {
  upsertOfferDraftOnLead,
  getOfferDraftById,
} from './cleverWorkingDraft.js';
import { stripNonAuthoritativeOfferRates } from './captureThenOffer.js';

/**
 * @returns {{ lead: object, offerDraftId: string|null }}
 */
export function ensureConceptOfferDraftFromCapture(lead = {}, facts = [], options = {}) {
  const sellerInput = String(options.sellerInput || '').trim();
  if (facts.some((f) => f.field === 'vehicleInterestMulti' && f.consultationCandidates === true)) {
    return { lead, offerDraftId: null };
  }
  const profile = lead?.crm?.needProfile || {};
  if (
    profile.consultationPending === true
    && !profile.selectedModelKey
    && !facts.some((f) => f.field === 'vehicleInterest' && f.value?.modelKey)
  ) {
    return { lead, offerDraftId: null };
  }
  const modelKey = options.modelKey
    || facts.find((f) => f.field === 'vehicleInterest' && f.value?.modelKey && !f.needsConfirmation)
      ?.value?.modelKey
    || null;
  if (!modelKey) return { lead, offerDraftId: null };

  const hasCommercialOrIdentity = facts.some((f) => (
    !f?.needsConfirmation && (
      f.field === 'termMonths'
      || f.field === 'durationMonths'
      || f.field === 'annualMileage'
      || f.field === 'annualMileageVariants'
      || f.field === 'leaseCalcScenarioWishes'
      || f.field === 'downPayment'
      || f.field === 'colorPreference'
      || f.field === 'motorPreference'
      || f.field === 'batteryPreference'
      || f.field === 'batteryVariantWishes'
    )
  ));
  if (!hasCommercialOrIdentity && options.force !== true) {
    return { lead, offerDraftId: null };
  }

  const existingId = lead?.crm?.cleverWorkingState?.currentOfferDraftId || null;
  if (existingId && options.createNewAlternative !== true) {
    const existing = getOfferDraftById(lead, existingId);
    const existingKey = String(
      existing?.vehicleIdentityDraft?.model?.canonical
      || existing?.modelKey
      || '',
    ).toLowerCase();
    if (existingKey === String(modelKey).toLowerCase()) {
      return { lead, offerDraftId: existingId };
    }
  }

  const payload = stripNonAuthoritativeOfferRates(
    enrichPrepareOfferPayloadWithIdentityDraft({
      modelKey,
      createNewAlternative: options.createNewAlternative !== false,
      monthlyRate: null,
      rate: null,
      missingRate: true,
      rateAuthority: 'non_authoritative',
      canCreateOffer: true,
      source: 'clever_capture_v1',
    }, {
      facts,
      sellerInput,
      lead,
      customerId: lead.id || null,
    }),
  );
  payload.monthlyRate = null;
  payload.rate = null;
  payload.missingRate = true;
  if (payload.offerDraft) {
    payload.offerDraft = {
      ...payload.offerDraft,
      monthlyRate: null,
      rate: null,
      missingRate: true,
      payment: {
        ...(payload.offerDraft.payment || {}),
        calculatedRate: null,
        budget: null,
      },
      offerPreview: {
        ...(payload.offerDraft.offerPreview || {}),
        monthlyRate: null,
      },
      offerCalculation: {
        ...(payload.offerDraft.offerCalculation || {}),
        monthlyRate: null,
      },
    };
  }
  const next = upsertOfferDraftOnLead(lead, payload);
  return { lead: next, offerDraftId: payload.offerDraftId || null };
}
