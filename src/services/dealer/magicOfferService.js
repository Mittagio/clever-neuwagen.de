/**
 * Clever Magic Offer – Orchestrierung Intent → Grounding → Decision → Safe Calc.
 * Persistenz weiter über buildOfferDraft / executeSaveOfferDraft.
 */
import { parseMagicOfferIntent } from './magicOfferIntentParser.js';
import { groundMagicOfferIntent } from './magicOfferGrounding.js';
import { decideMagicOfferAction, MAGIC_DECISION } from './magicOfferDecision.js';
import {
  buildOfferPositionLines,
  computeSafeCashOffer,
  COMMERCIAL_SOURCE,
} from './magicOfferSafeCalculation.js';

function paymentTypeFromOfferType(offerType) {
  if (offerType === 'purchase') return 'cash';
  if (offerType === 'financing') return 'financing';
  if (offerType === 'leasing') return 'leasing';
  return 'unknown';
}

/**
 * @param {string} text
 * @param {{
 *   modelKey?: string|null,
 *   trimId?: string|null,
 *   fromPdf?: boolean,
 *   previousPreparation?: object|null,
 * }} [context]
 */
export function prepareMagicOffer(text, context = {}) {
  const intent = parseMagicOfferIntent(text);
  if (context.previousPreparation?.intent?.commercialInput) {
    // merge: new parse wins on non-null fields
    const prev = context.previousPreparation.intent.commercialInput;
    for (const key of Object.keys(prev)) {
      if (intent.commercialInput[key] == null && prev[key] != null) {
        intent.commercialInput[key] = prev[key];
      }
    }
    if (!intent.offerType && context.previousPreparation.intent.offerType) {
      intent.offerType = context.previousPreparation.intent.offerType;
    }
    if (!intent.vehicleRequest.modelHint && context.previousPreparation.intent.vehicleRequest?.modelHint) {
      intent.vehicleRequest.modelHint = context.previousPreparation.intent.vehicleRequest.modelHint;
    }
  }

  const groundedResult = groundMagicOfferIntent(intent, {
    modelKey: context.modelKey,
    trimId: context.trimId,
  });

  const decision = decideMagicOfferAction({
    offerType: intent.offerType,
    groundedOk: groundedResult.ok,
    hasVerifiedPrices: Boolean(groundedResult.grounded?.basePrice),
    discountPercent: intent.commercialInput.discountPercent,
    discountAmount: intent.commercialInput.discountAmount,
    transferCost: intent.commercialInput.transferCost,
    monthlyRate: intent.commercialInput.monthlyRate,
    durationMonths: intent.commercialInput.durationMonths,
    annualMileageKm: intent.commercialInput.annualMileageKm,
    finalPayment: intent.commercialInput.finalPayment,
    effectiveInterestRate: intent.commercialInput.effectiveInterestRate,
    fromPdf: Boolean(context.fromPdf),
    unresolvedPackages: groundedResult.unresolvedPackages,
  });

  const base = {
    intent,
    grounded: groundedResult.grounded,
    groundingStatus: groundedResult.status,
    groundingMessage: groundedResult.message,
    unresolvedPackages: groundedResult.unresolvedPackages ?? [],
    suggestions: groundedResult.suggestions ?? [],
    decision,
    calculation: null,
    positionLines: [],
    headline: null,
    subline: null,
    canCreateOffer: false,
    paymentType: paymentTypeFromOfferType(intent.offerType),
    fromPdf: Boolean(context.fromPdf),
    originalPdf: context.originalPdf ?? null,
  };

  if (decision.action === MAGIC_DECISION.CALCULATE_CASH && groundedResult.grounded) {
    const calc = computeSafeCashOffer({
      lineItems: groundedResult.grounded.lineItems,
      discountPercent: intent.commercialInput.discountPercent,
      discountAmount: intent.commercialInput.discountAmount,
      transferCost: intent.commercialInput.transferCost ?? 0,
    });
    const positionLines = buildOfferPositionLines({
      lineItems: groundedResult.grounded.lineItems,
      listPrice: calc.listPrice,
      discountPercent: calc.discountPercent,
      discountAmount: calc.discountAmount,
      vehiclePrice: calc.vehiclePrice,
      transferCost: calc.transferCost,
      endPrice: calc.endPrice,
      includeEmptyTransfer: true,
    });
    return {
      ...base,
      ok: calc.ok,
      mode: 'cash_magic',
      calculation: calc,
      positionLines,
      headline: `Kia ${groundedResult.grounded.model}${groundedResult.grounded.trimLabel ? ` ${groundedResult.grounded.trimLabel}` : ''}`,
      subline: [groundedResult.grounded.engineLabel, groundedResult.grounded.colorLabel].filter(Boolean).join(' · '),
      canCreateOffer: calc.ok,
      endPrice: calc.endPrice,
      verifiedPrices: true,
    };
  }

  if (
    (decision.action === MAGIC_DECISION.INTAKE_COMMERCIAL
      || decision.action === MAGIC_DECISION.EXTRACT_DOCUMENT)
    && intent.offerType === 'leasing'
  ) {
    return {
      ...base,
      ok: true,
      mode: 'leasing_intake',
      calculation: {
        ok: true,
        monthlyRate: intent.commercialInput.monthlyRate,
        durationMonths: intent.commercialInput.durationMonths,
        annualMileageKm: intent.commercialInput.annualMileageKm,
        specialPayment: intent.commercialInput.specialPayment ?? intent.commercialInput.downPayment,
        transferCost: intent.commercialInput.transferCost,
        sources: {
          monthlyRate: context.fromPdf
            ? COMMERCIAL_SOURCE.UPLOADED_OFFER_PDF
            : COMMERCIAL_SOURCE.SELLER_INPUT,
        },
      },
      positionLines: [],
      headline: groundedResult.grounded
        ? `Kia ${groundedResult.grounded.model}${groundedResult.grounded.trimLabel ? ` ${groundedResult.grounded.trimLabel}` : ''}`
        : 'Leasingangebot',
      subline: groundedResult.grounded?.engineLabel ?? null,
      canCreateOffer: intent.commercialInput.monthlyRate != null,
      endPrice: null,
      verifiedPrices: Boolean(groundedResult.grounded),
    };
  }

  if (
    (decision.action === MAGIC_DECISION.INTAKE_COMMERCIAL
      || decision.action === MAGIC_DECISION.EXTRACT_DOCUMENT)
    && intent.offerType === 'financing'
  ) {
    return {
      ...base,
      ok: true,
      mode: 'financing_intake',
      calculation: {
        ok: true,
        monthlyRate: intent.commercialInput.monthlyRate,
        durationMonths: intent.commercialInput.durationMonths,
        downPayment: intent.commercialInput.downPayment,
        finalPayment: intent.commercialInput.finalPayment,
        effectiveInterestRate: intent.commercialInput.effectiveInterestRate,
        transferCost: intent.commercialInput.transferCost,
        sources: {
          monthlyRate: context.fromPdf
            ? COMMERCIAL_SOURCE.UPLOADED_OFFER_PDF
            : COMMERCIAL_SOURCE.SELLER_INPUT,
        },
      },
      positionLines: [],
      headline: groundedResult.grounded
        ? `Kia ${groundedResult.grounded.model}${groundedResult.grounded.trimLabel ? ` ${groundedResult.grounded.trimLabel}` : ''}`
        : 'Finanzierung',
      subline: null,
      canCreateOffer: intent.commercialInput.monthlyRate != null,
      endPrice: null,
      verifiedPrices: Boolean(groundedResult.grounded),
    };
  }

  return {
    ...base,
    ok: false,
    mode: decision.action,
    calculation: null,
    positionLines: [],
    headline: groundedResult.grounded
      ? `Kia ${groundedResult.grounded.model}`
      : 'Angebot',
    subline: null,
    canCreateOffer: false,
    endPrice: null,
    verifiedPrices: Boolean(groundedResult.grounded),
    promptMessage: decision.message ?? groundedResult.message,
    choices: decision.choices ?? null,
  };
}

/**
 * Natürliche Korrektur auf bestehender Vorbereitung.
 * @param {object} previous
 * @param {string} correctionText
 * @param {object} [context]
 */
export function applyMagicOfferCorrection(previous, correctionText, context = {}) {
  const blob = String(correctionText ?? '').toLowerCase();
  let nextText = previous?.intent?.rawText ?? '';

  // „P11 raus“
  const removePkg = blob.match(/(?:p\s*([1-9]\d?))\s*(?:raus|weg|entfernen|ohne)/i)
    ?? blob.match(/(?:ohne|raus|weg)\s*(?:p\s*([1-9]\d?))/i);
  if (removePkg) {
    const code = `P${removePkg[1]}`;
    nextText = nextText
      .replace(new RegExp(`\\bP\\s*${removePkg[1]}\\b`, 'gi'), ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return prepareMagicOffer(nextText, {
      ...context,
      modelKey: previous?.grounded?.modelKey ?? context.modelKey,
      previousPreparation: { ...previous, intent: { ...previous.intent, rawText: nextText } },
    });
  }

  // „Mach 22 Prozent“
  const pct = blob.match(/(?:mach|auf|rabatt)?\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:%|prozent)/i);
  if (pct && !/effektiv|zins/.test(blob)) {
    nextText = nextText.replace(/\d{1,2}(?:[.,]\d+)?\s*(?:%|prozent)/i, `${pct[1].replace(',', '.')} %`);
    if (!/\d{1,2}(?:[.,]\d+)?\s*(?:%|prozent)/i.test(previous?.intent?.rawText ?? '')) {
      nextText = `${nextText}, ${pct[1].replace(',', '.')} %`.trim();
    }
    return prepareMagicOffer(nextText, {
      ...context,
      modelKey: previous?.grounded?.modelKey ?? context.modelKey,
      previousPreparation: previous,
    });
  }

  // „Überführung 990“
  const transfer = blob.match(/(?:ueberfuehrung|uberfuhrung|überführung)\s*(\d{3,5})/i)
    ?? blob.match(/(\d{3,5})\s*(?:€|euro)?\s*(?:ueberfuehrung|uberfuhrung|überführung)/i);
  if (transfer) {
    const amount = transfer[1];
    if (/(?:ueberfuehrung|uberfuhrung|überführung)/i.test(nextText) || /plus\s+\d{3,5}/i.test(nextText)) {
      nextText = nextText
        .replace(/(?:plus|und)\s+\d{3,5}(?:[.,]\d{1,2})?\s*(?:€|euro)?\s*(?:ueberfuehrung|uberfuhrung|überführung)?/i, `plus ${amount} Überführung`)
        .replace(/\d{3,5}(?:[.,]\d{1,2})?\s*(?:€|euro)?\s*(?:ueberfuehrung|uberfuhrung|überführung)/i, `${amount} Überführung`)
        .replace(/(?:ueberfuehrung|uberfuhrung|überführung)\s*\d{3,5}(?:[.,]\d{1,2})?/i, `Überführung ${amount}`);
    } else {
      nextText = `${nextText}, ${amount} Überführung`;
    }
    return prepareMagicOffer(nextText, {
      ...context,
      modelKey: previous?.grounded?.modelKey ?? context.modelKey,
      previousPreparation: previous,
    });
  }

  return prepareMagicOffer(correctionText, {
    ...context,
    modelKey: previous?.grounded?.modelKey ?? context.modelKey,
    previousPreparation: previous,
  });
}

/**
 * Magic-Ergebnis → Felder für configureDraft / buildOfferDraft.
 */
export function magicPreparationToConfigurePatch(preparation) {
  if (!preparation?.grounded) return null;
  const g = preparation.grounded;
  const c = preparation.intent?.commercialInput ?? {};
  const calc = preparation.calculation ?? {};

  return {
    modelKey: g.modelKey,
    model: g.model,
    brand: g.brand ?? 'Kia',
    trimId: g.trimId,
    trimLabel: g.trimLabel,
    engineId: g.engineId,
    motorLabel: g.engineLabel,
    colorId: g.colorId,
    colorLabel: g.colorLabel,
    packageIds: g.packageIds ?? [],
    paymentType: preparation.paymentType,
    desiredRate: calc.monthlyRate ?? c.monthlyRate ?? null,
    desiredPrice: preparation.mode === 'cash_magic' ? calc.endPrice ?? null : null,
    termMonths: c.durationMonths ?? null,
    mileagePerYear: c.annualMileageKm ?? null,
    downPayment: c.downPayment ?? c.specialPayment ?? 0,
    preparationFee: c.transferCost ?? calc.transferCost ?? null,
    customDiscountPercent: calc.discountPercent ?? c.discountPercent ?? null,
    customerGroup: (calc.discountPercent != null || c.discountPercent != null) ? 'custom' : 'standard',
    balloonPayment: c.finalPayment ?? calc.finalPayment ?? null,
  };
}

/**
 * Magic-Werte über bestehende Offer-Draft-Pipeline legen
 * (Seller-/PDF-Rate bzw. deterministischer Barkauf – nicht Engine-Schätzung).
 */
export function overlayMagicOntoOfferDraft(offerDraft, preparation) {
  if (!offerDraft || !preparation) return offerDraft;
  const calc = preparation.calculation ?? {};
  const payment = { ...(offerDraft.payment ?? {}) };
  const offerPreview = { ...(offerDraft.offerPreview ?? {}) };
  const offerCalculation = { ...(offerDraft.offerCalculation ?? {}) };
  const source = {
    ...(offerDraft.source ?? {}),
    createdFrom: preparation.fromPdf ? 'magic_offer_pdf' : 'magic_offer',
    magicMode: preparation.mode,
    magicDecision: preparation.decision?.action ?? null,
    originalPdf: preparation.originalPdf ?? offerDraft.source?.originalPdf ?? null,
  };

  if (preparation.mode === 'cash_magic' && calc.ok) {
    payment.type = 'cash';
    payment.listPrice = calc.listPrice ?? payment.listPrice;
    payment.discountPercent = calc.discountPercent ?? payment.discountPercent;
    payment.discountAmount = calc.discountAmount ?? payment.discountAmount;
    payment.transferCost = calc.transferCost ?? payment.transferCost;
    payment.budget = calc.endPrice;
    payment.calculatedRate = calc.endPrice;
    offerPreview.uvpConfigurationPrice = calc.listPrice ?? offerPreview.uvpConfigurationPrice;
    offerPreview.discountPercent = calc.discountPercent;
    offerPreview.discountAmount = calc.discountAmount;
    offerPreview.housePrice = calc.vehiclePrice;
    offerPreview.monthlyRate = calc.endPrice;
    offerPreview.paymentType = 'cash';
    offerCalculation.discountPercent = calc.discountPercent;
    offerCalculation.discountAmount = calc.discountAmount;
    offerCalculation.housePrice = calc.vehiclePrice;
    offerCalculation.cashPrice = calc.endPrice;
    offerCalculation.preparationFee = calc.transferCost;
  }

  if (
    (preparation.mode === 'leasing_intake' || preparation.mode === 'financing_intake')
    && calc.monthlyRate != null
  ) {
    payment.type = preparation.mode === 'financing_intake' ? 'financing' : 'leasing';
    payment.budget = calc.monthlyRate;
    payment.calculatedRate = calc.monthlyRate;
    payment.termMonths = calc.durationMonths ?? payment.termMonths;
    payment.mileagePerYear = calc.annualMileageKm ?? payment.mileagePerYear;
    payment.downPayment = calc.downPayment ?? calc.specialPayment ?? payment.downPayment ?? 0;
    payment.finalRate = calc.finalPayment ?? payment.finalRate;
    payment.transferCost = calc.transferCost ?? payment.transferCost;
    offerPreview.monthlyRate = calc.monthlyRate;
    offerPreview.paymentType = payment.type;
    offerCalculation.monthlyRate = calc.monthlyRate;
    offerCalculation.termMonths = calc.durationMonths ?? offerCalculation.termMonths;
    offerCalculation.mileagePerYear = calc.annualMileageKm ?? offerCalculation.mileagePerYear;
    offerCalculation.downPayment = payment.downPayment;
    offerCalculation.finalPayment = calc.finalPayment ?? offerCalculation.finalPayment;
    offerCalculation.preparationFee = calc.transferCost ?? offerCalculation.preparationFee;
  }

  return {
    ...offerDraft,
    payment,
    offerPreview,
    offerCalculation,
    source,
  };
}

export { MAGIC_DECISION, COMMERCIAL_SOURCE };
