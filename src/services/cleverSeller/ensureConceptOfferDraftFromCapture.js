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
      || f.field === 'termMonthsVariants'
      || f.field === 'leaseCalcScenarioWishes'
      || f.field === 'downPayment'
      || f.field === 'downPaymentRange'
      || f.field === 'commercialScenarios'
      || f.field === 'colorPreference'
      || f.field === 'motorPreference'
      || f.field === 'batteryPreference'
      || f.field === 'batteryVariantWishes'
    )
  ));
  const leadHasCommercial = Boolean(
    lead?.wish?.paymentType
    || lead?.wish?.termMonths
    || lead?.wish?.mileagePerYear
    || lead?.wish?.annualMileage
    || lead?.wish?.downPayment
    || lead?.crm?.needProfile?.fuel
    || (Array.isArray(lead?.wish?.commercialScenarios) && lead.wish.commercialScenarios.length > 0)
    || (Array.isArray(lead?.crm?.needProfile?.termMonthsVariants)
      && lead.crm.needProfile.termMonthsVariants.length > 0)
    || lead?.crm?.needProfile?.downPaymentRange
  );
  if (!hasCommercialOrIdentity && !leadHasCommercial && options.force !== true) {
    return { lead, offerDraftId: null };
  }

  const createNew = options.createNewAlternative !== false;
  const existingId = lead?.crm?.cleverWorkingState?.currentOfferDraftId || null;
  if (existingId && !createNew) {
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

  const interest = facts.find((f) => f.field === 'vehicleInterest');
  const leasingScenario = (lead?.wish?.commercialScenarios || lead?.crm?.commercialScenarios || [])
    .find((s) => s?.type === 'leasing' || s?.paymentType === 'leasing')
    || null;

  const payload = stripNonAuthoritativeOfferRates(
    enrichPrepareOfferPayloadWithIdentityDraft({
      modelKey,
      createNewAlternative: true,
      monthlyRate: null,
      rate: null,
      missingRate: true,
      rateAuthority: 'non_authoritative',
      canCreateOffer: true,
      source: 'clever_capture_v1',
      vehicleTrackId: options.vehicleTrackId || null,
      ...(leasingScenario ? {
        commercialScenario: {
          ...leasingScenario,
          id: leasingScenario.id || undefined,
          rate: null,
          rateAuthority: 'non_authoritative',
        },
      } : {}),
      vehicle: interest?.value ? {
        modelKey,
        model: interest.value.model || modelKey,
        trim: interest.value.trim || interest.value.trimCandidate?.raw || null,
        color: interest.value.color || interest.value.preferredColor || null,
      } : undefined,
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
