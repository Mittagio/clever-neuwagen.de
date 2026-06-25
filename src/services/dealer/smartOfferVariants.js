/**
 * Clever Smart Defaults – drei fertige Angebotsvarianten aus Händlerkonditionen.
 */
import { pickSelectionTrimIds } from '../sales/offerSelectionGroup.js';
import {
  buildBudgetComparison,
  buildConfigureOptions,
  buildSensibleAlternatives,
} from '../dealerAiVehicleConfigureFlow.js';
import { buildVehicleConfiguration } from '../configuration/vehicleConfigurationModel.js';
import { buildOfferConditionsFromDraft } from '../configuration/offerConditionsModel.js';
import { computeOfferCalculation } from '../configuration/offerCalculation.js';
import {
  resolveApplicablePromotions,
  resolvePaymentDiscountPercent,
} from './dealerModelPricing.js';
import { getFinanceResidualValue } from './dealerFinanceResiduals.js';
import { applyDealerDefaultsToDraft } from './dealerOfferDefaults.js';

export { applyDealerDefaultsToDraft, resolveDealerPaymentDefaults } from './dealerOfferDefaults.js';

export const SMART_VARIANT_TIERS = [
  { id: 'basis', label: 'Basis', medal: '🥉', role: 'Preisbewusst' },
  { id: 'recommendation', label: 'Empfehlung', medal: '🥈', role: 'Clever Empfehlung' },
  { id: 'premium', label: 'Premium', medal: '🥇', role: 'Top-Ausstattung' },
];

function normalizePaymentType(paymentType = 'leasing') {
  if (paymentType === 'financing' || paymentType === 'threeWayFinancing') return 'financing';
  if (paymentType === 'cash') return 'cash';
  return 'leasing';
}

function buildVariantDraft(baseDraft, conditions, { trimId, trimLabel, patch = {} } = {}) {
  const options = buildConfigureOptions(baseDraft.modelKey, trimId ?? baseDraft.trimId);
  const trim = options.trims?.find((t) => t.id === (trimId ?? baseDraft.trimId));
  const merged = {
    ...baseDraft,
    trimId: trimId ?? baseDraft.trimId,
    trimLabel: trimLabel ?? trim?.label ?? baseDraft.trimLabel,
    options,
    ...patch,
  };
  return applyDealerDefaultsToDraft(merged, conditions);
}

function computeVariantSnapshot(draft, conditions, budgetLimit) {
  const vehicleConfiguration = buildVehicleConfiguration(draft);
  if (!vehicleConfiguration) return null;

  const offerConditions = buildOfferConditionsFromDraft(draft, conditions);
  const calculation = computeOfferCalculation(vehicleConfiguration, offerConditions, conditions);
  const mode = normalizePaymentType(draft.paymentType);
  const promotions = resolveApplicablePromotions(
    conditions,
    draft.modelKey,
    draft.customerGroup ?? 'standard',
  );
  const discountPercent = resolvePaymentDiscountPercent(
    conditions,
    draft.modelKey,
    mode,
    draft.customerGroup ?? 'standard',
    draft.customDiscountPercent,
    draft.trimId,
  );
  const residualPercent = mode === 'financing'
    ? getFinanceResidualValue(conditions, draft.modelKey, draft.termMonths, draft.trimId)
    : null;

  const monthlyRate = calculation?.monthlyRate ?? null;
  const cashPrice = calculation?.cashPrice ?? calculation?.housePrice ?? null;
  const displayAmount = mode === 'cash' ? cashPrice : monthlyRate;

  return {
    vehicleConfiguration,
    offerConditions,
    calculation,
    monthlyRate,
    cashPrice,
    displayAmount,
    discountPercent,
    preparationFee: offerConditions.preparationFee,
    promotions,
    residualPercent,
    budget: buildBudgetComparison(monthlyRate, budgetLimit, draft.paymentType),
  };
}

function sortTrimCandidates(candidates) {
  return [...candidates].sort((a, b) => {
    const rateA = a.snapshot?.displayAmount ?? 999999;
    const rateB = b.snapshot?.displayAmount ?? 999999;
    return rateA - rateB;
  });
}

function pickTrimCandidates(baseDraft, conditions) {
  const trimIds = pickSelectionTrimIds(baseDraft.modelKey);
  const options = baseDraft.options ?? buildConfigureOptions(baseDraft.modelKey, baseDraft.trimId);
  const allTrims = options.trims ?? [];

  const ids = trimIds.length
    ? trimIds
    : allTrims.map((t) => t.id).slice(0, 3);

  if (!ids.length && baseDraft.trimId) {
    ids.push(baseDraft.trimId);
  }

  return ids.map((trimId) => {
    const trim = allTrims.find((t) => t.id === trimId);
    const variantDraft = buildVariantDraft(baseDraft, conditions, {
      trimId,
      trimLabel: trim?.label,
    });
    return {
      trimId,
      trimLabel: trim?.label ?? variantDraft.trimLabel,
      variantDraft,
      snapshot: computeVariantSnapshot(
        variantDraft,
        conditions,
        baseDraft.desiredRate ?? null,
      ),
      kind: 'trim',
    };
  });
}

function buildConditionFallbackVariants(baseDraft, conditions, existingCount) {
  const needed = Math.max(0, 3 - existingCount);
  if (!needed) return [];

  const alts = buildSensibleAlternatives(baseDraft, conditions, {
    desiredRate: baseDraft.desiredRate,
  }).slice(0, needed);

  return alts.map((alt, index) => {
    const variantDraft = buildVariantDraft(baseDraft, conditions, {
      patch: alt.patch ?? {
        termMonths: alt.termMonths,
        mileagePerYear: alt.mileagePerYear,
        downPayment: alt.downPayment,
      },
    });
    return {
      trimId: variantDraft.trimId,
      trimLabel: variantDraft.trimLabel,
      variantDraft,
      snapshot: computeVariantSnapshot(
        variantDraft,
        conditions,
        baseDraft.desiredRate ?? null,
      ),
      kind: 'condition',
      conditionLabel: alt.headline ?? `Alternative ${index + 1}`,
    };
  });
}

function assignTiers(sortedCandidates) {
  const picked = sortedCandidates.slice(0, 3);
  while (picked.length < 3 && sortedCandidates.length) {
    const next = sortedCandidates[picked.length];
    if (next && !picked.includes(next)) picked.push(next);
    else break;
  }

  return picked.map((candidate, index) => {
    const tier = SMART_VARIANT_TIERS[index] ?? SMART_VARIANT_TIERS[SMART_VARIANT_TIERS.length - 1];
    return {
      id: `smart-${tier.id}`,
      tierId: tier.id,
      tierLabel: tier.label,
      medal: tier.medal,
      roleLabel: tier.role,
      trimId: candidate.trimId,
      trimLabel: candidate.trimLabel,
      conditionLabel: candidate.conditionLabel ?? null,
      draft: candidate.variantDraft,
      snapshot: candidate.snapshot,
      budget: candidate.snapshot?.budget ?? { status: 'open', label: 'Budget offen' },
    };
  });
}

/**
 * Erzeugt drei fertige Varianten (Basis / Empfehlung / Premium) mit echter Berechnung.
 */
export function buildSmartOfferVariants(baseDraft, conditions, fields = {}) {
  if (!baseDraft?.modelKey) return [];

  const enrichedDraft = applyDealerDefaultsToDraft({
    ...baseDraft,
    desiredRate: baseDraft.desiredRate ?? fields.desiredRate ?? null,
  }, conditions);

  const trimCandidates = pickTrimCandidates(enrichedDraft, conditions);
  const sorted = sortTrimCandidates(trimCandidates.filter((c) => c.snapshot));
  const fallbacks = sorted.length < 3
    ? buildConditionFallbackVariants(enrichedDraft, conditions, sorted.length)
    : [];

  const allCandidates = sortTrimCandidates([...sorted, ...fallbacks]);
  if (!allCandidates.length) {
    const single = buildVariantDraft(enrichedDraft, conditions);
    const snapshot = computeVariantSnapshot(single, conditions, enrichedDraft.desiredRate);
    if (!snapshot) return [];
    return assignTiers([{
      trimId: single.trimId,
      trimLabel: single.trimLabel,
      variantDraft: single,
      snapshot,
      kind: 'trim',
    }]);
  }

  return assignTiers(allCandidates);
}

/**
 * Berechnet eine Variante nach Schnell-Editor-Änderung neu.
 */
export function recalculateSmartVariant(variant, conditions) {
  if (!variant?.draft) return variant;
  const draft = applyDealerDefaultsToDraft(variant.draft, conditions);
  const snapshot = computeVariantSnapshot(draft, conditions, draft.desiredRate ?? null);
  return {
    ...variant,
    trimId: draft.trimId,
    trimLabel: draft.trimLabel,
    draft,
    snapshot,
    budget: snapshot?.budget ?? variant.budget,
  };
}

/**
 * Patch für Schnell-Editor auf Varianten-Draft anwenden.
 */
export function patchSmartVariantDraft(variant, patch = {}) {
  if (!variant?.draft) return variant;
  const nextDraft = {
    ...variant.draft,
    ...patch,
    customer: patch.customer
      ? { ...variant.draft.customer, ...patch.customer }
      : variant.draft.customer,
  };
  return { ...variant, draft: nextDraft };
}

export function formatVariantRate(variant) {
  const mode = normalizePaymentType(variant?.draft?.paymentType);
  const amount = variant?.snapshot?.displayAmount;
  if (amount == null) return '–';
  if (mode === 'cash') {
    return `${Math.round(amount).toLocaleString('de-DE')} €`;
  }
  return `${Math.round(amount).toLocaleString('de-DE')} €/Monat`;
}

export function buildVariantSummaryLines(variant) {
  const draft = variant?.draft ?? {};
  const snap = variant?.snapshot ?? {};
  const mode = normalizePaymentType(draft.paymentType);
  const lines = [];

  if (mode === 'leasing') {
    if (draft.termMonths) lines.push({ label: 'Laufzeit', value: `${draft.termMonths} Monate` });
    if (draft.mileagePerYear) {
      lines.push({ label: 'Kilometer', value: `${draft.mileagePerYear.toLocaleString('de-DE')} km/Jahr` });
    }
    if (draft.downPayment > 0) {
      lines.push({ label: 'Anzahlung', value: `${draft.downPayment.toLocaleString('de-DE')} €` });
    }
  } else if (mode === 'financing') {
    if (draft.termMonths) lines.push({ label: 'Laufzeit', value: `${draft.termMonths} Monate` });
    if (draft.downPayment != null) {
      lines.push({ label: 'Anzahlung', value: `${draft.downPayment.toLocaleString('de-DE')} €` });
    }
    if (snap.residualPercent != null) {
      lines.push({ label: 'Schlussrate', value: `${snap.residualPercent} %` });
    }
  }

  if (snap.discountPercent != null) {
    lines.push({ label: 'Rabatt', value: `${snap.discountPercent} %` });
  }
  if (snap.preparationFee != null) {
    lines.push({ label: 'Überführung', value: `${snap.preparationFee.toLocaleString('de-DE')} €` });
  }

  const promoTitles = (snap.promotions ?? []).map((p) => p.badgeText || p.title).filter(Boolean);
  if (promoTitles.length) {
    lines.push({ label: 'Aktionen', value: promoTitles.join(', ') });
  }

  return lines;
}
