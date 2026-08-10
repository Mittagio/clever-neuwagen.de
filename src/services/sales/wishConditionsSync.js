/**
 * Kundenwunsch-Konditionen ↔ Clever-Auswahl synchron halten.
 */
import { buildWishConditionChips } from '../customerAkte.js';

const VARIANT_DRAFT = 'draft';

export function buildWishConditionsFromSources({
  paymentType = null,
  termMonths = null,
  mileagePerYear = null,
  downPayment = null,
  desiredRate = null,
  desiredPrice = null,
} = {}) {
  const pt = paymentType && paymentType !== 'unknown' ? paymentType : null;
  return {
    paymentType: pt,
    termMonths: termMonths != null && Number(termMonths) > 0 ? Number(termMonths) : null,
    mileagePerYear: mileagePerYear != null && Number(mileagePerYear) > 0
      ? Number(mileagePerYear)
      : null,
    downPayment: downPayment != null && downPayment !== '' && Number.isFinite(Number(downPayment))
      ? Number(downPayment)
      : null,
    desiredRate: desiredRate != null && Number(desiredRate) > 0 ? Number(desiredRate) : null,
    desiredPrice: desiredPrice != null && Number(desiredPrice) > 0 ? Number(desiredPrice) : null,
  };
}

export function buildWishConditionsFromLeadAndFields(lead = null, wishFields = {}) {
  return buildWishConditionsFromSources({
    paymentType: wishFields.paymentType ?? lead?.paymentType ?? null,
    termMonths: wishFields.termMonths ?? lead?.wish?.termMonths ?? null,
    mileagePerYear: wishFields.mileagePerYear ?? lead?.wish?.mileagePerYear ?? null,
    downPayment: wishFields.downPayment ?? lead?.wish?.downPayment ?? null,
    desiredRate: wishFields.desiredRate ?? lead?.desiredRate ?? lead?.wish?.desiredRate ?? null,
    desiredPrice: wishFields.desiredPrice ?? lead?.desiredPrice ?? lead?.wish?.desiredPrice ?? null,
  });
}

export function buildVariantPaymentFromWish(wishConditions = {}) {
  return {
    paymentType: wishConditions.paymentType ?? 'leasing',
    termMonths: wishConditions.termMonths ?? null,
    mileagePerYear: wishConditions.mileagePerYear ?? null,
    downPayment: wishConditions.downPayment ?? 0,
    desiredRate: wishConditions.desiredRate ?? null,
    desiredPrice: wishConditions.desiredPrice ?? null,
  };
}

export function hasMeaningfulWishConditions(wish = {}) {
  if (!wish || typeof wish !== 'object') return false;
  return Boolean(
    (wish.paymentType && wish.paymentType !== 'unknown')
    || (Number(wish.termMonths) > 0)
    || (Number(wish.mileagePerYear) > 0)
    || (Number(wish.desiredRate) > 0)
    || (Number(wish.desiredPrice) > 0)
    || (Number(wish.downPayment) > 0),
  );
}

export function formatWishConditionsBanner(wishConditions = {}, delivery = '') {
  const chips = buildWishConditionChips({
    paymentType: wishConditions.paymentType ?? 'unknown',
    termMonths: wishConditions.termMonths,
    mileagePerYear: wishConditions.mileagePerYear,
    desiredRate: wishConditions.desiredRate,
    desiredPrice: wishConditions.desiredPrice,
    downPayment: wishConditions.downPayment,
    delivery,
  });
  return chips.filter(Boolean).join(' · ');
}

function variantAcceptsWishSync(variant) {
  if (!variant) return false;
  if (variant.conditionsLocked) return false;
  if (variant.status && variant.status !== VARIANT_DRAFT) return false;
  return true;
}

/**
 * Aktualisiert group.wishConditions und Varianten, die noch nicht manuell gesperrt sind.
 */
export function syncOfferSelectionGroupsWithWish(groups = [], wishPatch = {}) {
  const patch = buildWishConditionsFromSources(wishPatch);
  if (!hasMeaningfulWishConditions(patch)) return groups;

  const now = new Date().toISOString();
  return (groups ?? []).map((group) => {
    const mergedWish = {
      ...(group.wishConditions ?? {}),
      ...Object.fromEntries(
        Object.entries(patch).filter(([, value]) => value != null),
      ),
    };
    const paymentFromWish = buildVariantPaymentFromWish(mergedWish);

    const variants = (group.variants ?? []).map((variant) => {
      if (!variantAcceptsWishSync(variant)) return variant;
      return {
        ...variant,
        payment: { ...paymentFromWish },
      };
    });

    return {
      ...group,
      wishConditions: mergedWish,
      variants,
      updatedAt: now,
    };
  });
}

function isWishCommercialFieldEmpty(key, current) {
  if (current == null || current === '') return true;
  if (key === 'paymentType') return current === 'unknown';
  if (key === 'downPayment') return String(current).trim() === '';
  if (key === 'leasingEndDate') return !String(current).trim();
  return !(Number(current) > 0);
}

/**
 * Angebots-/PDF-Konditionen behutsam in lead.wish mergen.
 * Standard: nur leere/offene Wish-Felder. Mit forceFromActiveOffer: aktive Offer-Werte gewinnen.
 */
export function mergeOfferCommercialIntoWish(existingWish = {}, offerCommercial = {}, options = {}) {
  const force = options.forceFromActiveOffer === true;
  const next = { ...(existingWish && typeof existingWish === 'object' ? existingWish : {}) };
  const patch = buildWishConditionsFromSources(offerCommercial);
  const endDate = offerCommercial?.leasingEndDate
    ?? offerCommercial?.contractEndDate
    ?? offerCommercial?.endDate
    ?? null;

  const assign = (key, value) => {
    if (value == null || value === '') return;
    if (key === 'paymentType' && value === 'unknown') return;
    if (force || isWishCommercialFieldEmpty(key, next[key])) {
      next[key] = value;
    }
  };

  assign('paymentType', patch.paymentType);
  assign('termMonths', patch.termMonths);
  assign('mileagePerYear', patch.mileagePerYear);
  assign('downPayment', patch.downPayment);
  assign('desiredRate', patch.desiredRate);
  assign('desiredPrice', patch.desiredPrice);
  if (endDate != null && String(endDate).trim()) {
    assign('leasingEndDate', String(endDate).trim());
  }

  return next;
}

/**
 * Lead-Patch: Wish + Top-Level paymentType aus Offer-Konditionen.
 */
export function applyOfferCommercialToLeadWish(lead = {}, offerCommercial = {}, options = {}) {
  const mergedWish = mergeOfferCommercialIntoWish(lead?.wish, offerCommercial, options);
  const paymentType = mergedWish.paymentType && mergedWish.paymentType !== 'unknown'
    ? mergedWish.paymentType
    : (lead?.paymentType ?? null);
  return {
    ...lead,
    paymentType: paymentType ?? lead?.paymentType,
    wish: mergedWish,
  };
}
