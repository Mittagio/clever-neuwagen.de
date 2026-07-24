/**
 * Safe-Offer-Decision – was Clever rechnen / übernehmen / ablehnen darf.
 */

export const MAGIC_DECISION = {
  CALCULATE_CASH: 'calculate_cash',
  INTAKE_COMMERCIAL: 'intake_commercial',
  EXTRACT_DOCUMENT: 'extract_document',
  ASK_RATE: 'ask_rate',
  ASK_OFFER_TYPE: 'ask_offer_type',
  NEEDS_REVIEW: 'needs_review',
  BLOCKED: 'blocked',
};

/**
 * @param {{
 *   offerType?: string|null,
 *   groundedOk?: boolean,
 *   hasVerifiedPrices?: boolean,
 *   discountPercent?: number|null,
 *   discountAmount?: number|null,
 *   transferCost?: number|null,
 *   monthlyRate?: number|null,
 *   durationMonths?: number|null,
 *   annualMileageKm?: number|null,
 *   finalPayment?: number|null,
 *   effectiveInterestRate?: number|null,
 *   fromPdf?: boolean,
 *   unresolvedPackages?: string[],
 * }} input
 */
export function decideMagicOfferAction(input = {}) {
  if (input.unresolvedPackages?.length) {
    return {
      action: MAGIC_DECISION.NEEDS_REVIEW,
      reason: 'unknown_package',
      message: 'Paket konnte ich nicht sicher verifizieren.',
    };
  }

  const type = input.offerType;
  const canIntakeWithoutFullPrice = (type === 'leasing' || type === 'financing')
    && input.monthlyRate != null;

  if (
    !canIntakeWithoutFullPrice
    && (input.groundedOk === false || input.hasVerifiedPrices === false)
  ) {
    return {
      action: MAGIC_DECISION.NEEDS_REVIEW,
      reason: 'unverified_price',
      message: 'Preis bitte prüfen – keine verifizierte Quelle.',
    };
  }

  if (!type) {
    return {
      action: MAGIC_DECISION.ASK_OFFER_TYPE,
      reason: 'ambiguous_offer_type',
      message: 'Was ist es?',
      choices: ['leasing', 'financing', 'purchase'],
    };
  }

  if (type === 'purchase') {
    const hasDiscount = input.discountPercent != null || input.discountAmount != null;
    if (input.hasVerifiedPrices && hasDiscount) {
      return {
        action: MAGIC_DECISION.CALCULATE_CASH,
        reason: 'deterministic_cash',
        message: null,
      };
    }
    if (input.hasVerifiedPrices && input.transferCost != null && !hasDiscount) {
      return {
        action: MAGIC_DECISION.NEEDS_REVIEW,
        reason: 'missing_discount',
        message: 'Welchen Rabatt soll ich rechnen?',
      };
    }
    return {
      action: MAGIC_DECISION.NEEDS_REVIEW,
      reason: 'incomplete_cash',
      message: 'Für den Barkauf fehlen noch sichere Angaben.',
    };
  }

  if (type === 'leasing') {
    if (input.fromPdf && input.monthlyRate != null) {
      return {
        action: MAGIC_DECISION.EXTRACT_DOCUMENT,
        reason: 'pdf_rate',
        message: null,
      };
    }
    if (input.monthlyRate != null) {
      return {
        action: MAGIC_DECISION.INTAKE_COMMERCIAL,
        reason: 'seller_rate',
        message: null,
      };
    }
    return {
      action: MAGIC_DECISION.ASK_RATE,
      reason: 'missing_leasing_rate',
      message: 'Fahrzeug, Laufzeit und Kilometer habe ich. Mir fehlt nur noch die gerechnete Leasingrate.',
    };
  }

  if (type === 'financing') {
    if (input.fromPdf && input.monthlyRate != null) {
      return {
        action: MAGIC_DECISION.EXTRACT_DOCUMENT,
        reason: 'pdf_finance',
        message: null,
      };
    }
    if (input.monthlyRate != null) {
      return {
        action: MAGIC_DECISION.INTAKE_COMMERCIAL,
        reason: 'seller_finance',
        message: null,
      };
    }
    return {
      action: MAGIC_DECISION.BLOCKED,
      reason: 'no_free_finance_calc',
      message: 'Finanzierungskonditionen übernehme ich nur vom Verkäufer oder aus einem Bank-PDF – ich rechne sie nicht frei.',
    };
  }

  return {
    action: MAGIC_DECISION.NEEDS_REVIEW,
    reason: 'unknown',
    message: 'Angaben bitte prüfen.',
  };
}
