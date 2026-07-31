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
import { assessCommercialPlausibility } from './parseGermanMoney.js';

function paymentTypeFromOfferType(offerType) {
  if (offerType === 'purchase') return 'cash';
  if (offerType === 'financing') return 'financing';
  if (offerType === 'leasing') return 'leasing';
  return 'unknown';
}

/**
 * Prefer OI value when intent is missing OR intent looks like a classic DE-parse bug
 * (e.g. 152,36 → 15236) while OI has a plausible value.
 */
function preferCommercialValue(intentValue, oiValue, field) {
  if (oiValue == null) return intentValue ?? null;
  if (intentValue == null) return oiValue;
  if (intentValue === oiValue) return oiValue;

  if (field === 'monthlyRate') {
    const intentBad = intentValue > 2500 || intentValue < 50;
    const oiOk = oiValue >= 50 && oiValue <= 2500;
    if (intentBad && oiOk) return oiValue;
    // Classic ×100 mishandle: intent ≈ oi * 100
    if (oiOk && Math.abs(intentValue - oiValue * 100) < 1) return oiValue;
  }
  if (field === 'downPayment') {
    const intentBad = intentValue >= 100000;
    const oiOk = oiValue >= 0 && oiValue < 100000;
    if (intentBad && oiOk) return oiValue;
    if (oiOk && Math.abs(intentValue - oiValue * 100) < 1) return oiValue;
  }
  // Intent already set and not clearly broken – keep intent (NL correction path)
  return intentValue;
}

/**
 * Overlay Offer-Interpreter-Werte auf Intent – nur gesetzte, nicht-ambige Felder.
 * Erfindet nichts; Ambiguities bleiben im Review.
 * PDF-OI gewinnt bei klassischem DE-Zahlen-Bug gegenüber kaputtem Intent.
 */
export function overlayOfferInterpretationOntoIntent(intent, offerInterpretationResult = null) {
  const oi = offerInterpretationResult?.interpretation;
  if (!intent || !oi) return intent;

  const ambiguous = new Set(
    (oi.ambiguities ?? []).map((a) => a.field).filter(Boolean),
  );
  const commercial = intent.commercialInput ?? {};

  if (!ambiguous.has('monthlyRate') && oi.monthlyRate != null) {
    commercial.monthlyRate = preferCommercialValue(
      commercial.monthlyRate,
      oi.monthlyRate,
      'monthlyRate',
    );
  }
  if (!ambiguous.has('termMonths') && oi.termMonths != null && commercial.durationMonths == null) {
    commercial.durationMonths = oi.termMonths;
  }
  if (!ambiguous.has('annualMileage') && oi.annualMileage != null && commercial.annualMileageKm == null) {
    commercial.annualMileageKm = oi.annualMileage;
  }
  if (!ambiguous.has('downPayment') && oi.downPayment != null) {
    const nextDown = preferCommercialValue(
      commercial.downPayment,
      oi.downPayment,
      'downPayment',
    );
    commercial.downPayment = nextDown;
    if (commercial.specialPayment == null || commercial.specialPayment === commercial.downPayment) {
      commercial.specialPayment = nextDown;
    } else {
      commercial.specialPayment = preferCommercialValue(
        commercial.specialPayment,
        oi.downPayment,
        'downPayment',
      );
    }
  }
  if (oi.purchasePrice != null && commercial.listPrice == null) {
    commercial.listPrice = oi.purchasePrice;
  }
  if (oi.finalPayment != null && commercial.finalPayment == null) {
    commercial.finalPayment = oi.finalPayment;
  }
  if (oi.transferFee != null && commercial.transferCost == null) {
    commercial.transferCost = oi.transferFee;
  }
  if (oi.apr != null && commercial.effectiveInterestRate == null) {
    commercial.effectiveInterestRate = oi.apr;
  }

  intent.commercialInput = commercial;

  if (!intent.offerType && oi.offerType) {
    intent.offerType = oi.offerType === 'cash' ? 'purchase' : oi.offerType;
  }

  const vr = intent.vehicleRequest ?? {};
  if (!vr.modelHint && oi.vehicle?.model) vr.modelHint = oi.vehicle.model;
  if (!vr.trimHint && oi.vehicle?.trim) vr.trimHint = oi.vehicle.trim;
  if (!vr.colorHint && oi.vehicle?.color) vr.colorHint = oi.vehicle.color;
  if (!vr.brandHint && oi.vehicle?.brand) vr.brandHint = oi.vehicle.brand;
  intent.vehicleRequest = vr;

  return intent;
}

/**
 * @param {string} text
 * @param {{
 *   modelKey?: string|null,
 *   trimId?: string|null,
 *   fromPdf?: boolean,
 *   previousPreparation?: object|null,
 *   offerInterpretation?: object|null,
 *   originalPdf?: object|null,
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

  overlayOfferInterpretationOntoIntent(intent, context.offerInterpretation);

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

  const offerInterpretation = context.offerInterpretation ?? null;
  const offerReview = offerInterpretation?.review ?? null;
  const hasRateAmbiguity = Boolean(
    (offerInterpretation?.interpretation?.ambiguities ?? [])
      .some((a) => a.field === 'monthlyRate'),
  );

  const commercialPlausibility = assessCommercialPlausibility({
    monthlyRate: intent.commercialInput.monthlyRate,
    downPayment: intent.commercialInput.downPayment ?? intent.commercialInput.specialPayment,
    vehiclePrice: intent.commercialInput.listPrice ?? groundedResult.grounded?.basePrice ?? null,
    offerType: intent.offerType === 'purchase' ? 'cash' : intent.offerType,
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
    offerInterpretation,
    offerReview,
    hasRateAmbiguity,
    commercialPlausibility,
    /** PDF-Leasing/Finanzierung: Zwischen-Review überspringen → Angebotsvorschau */
    skipMagicReview: Boolean(context.fromPdf)
      && (intent.offerType === 'leasing' || intent.offerType === 'financing'),
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
      canCreateOffer: intent.commercialInput.monthlyRate != null && !hasRateAmbiguity,
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
      canCreateOffer: intent.commercialInput.monthlyRate != null && !hasRateAmbiguity,
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
  const g = preparation?.grounded ?? {};
  const c = preparation?.intent?.commercialInput ?? {};
  const calc = preparation?.calculation ?? {};
  if (!g.modelKey && !g.model && !c.monthlyRate && calc.monthlyRate == null) {
    // still allow commercial-only patch from PDF when model hint exists on intent
    if (!preparation?.intent?.vehicleRequest?.modelHint) return null;
  }

  return {
    modelKey: g.modelKey ?? null,
    model: g.model ?? preparation?.intent?.vehicleRequest?.modelHint ?? null,
    brand: g.brand ?? preparation?.intent?.vehicleRequest?.brandHint ?? 'Kia',
    trimId: g.trimId,
    trimLabel: g.trimLabel ?? preparation?.intent?.vehicleRequest?.trimHint ?? null,
    engineId: g.engineId,
    motorLabel: g.engineLabel,
    colorId: g.colorId,
    colorLabel: g.colorLabel ?? preparation?.intent?.vehicleRequest?.colorHint ?? null,
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
  const commercial = preparation.intent?.commercialInput ?? {};
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
    && (calc.monthlyRate != null || commercial.monthlyRate != null || preparation.fromPdf)
  ) {
    payment.type = preparation.mode === 'financing_intake' ? 'financing' : 'leasing';
    const rate = calc.monthlyRate ?? commercial.monthlyRate ?? payment.calculatedRate ?? null;
    payment.budget = rate;
    payment.calculatedRate = rate;
    payment.termMonths = calc.durationMonths ?? commercial.durationMonths ?? payment.termMonths;
    payment.mileagePerYear = calc.annualMileageKm ?? commercial.annualMileageKm ?? payment.mileagePerYear;
    payment.downPayment = calc.downPayment
      ?? calc.specialPayment
      ?? commercial.downPayment
      ?? commercial.specialPayment
      ?? payment.downPayment
      ?? 0;
    payment.finalRate = calc.finalPayment ?? commercial.finalPayment ?? payment.finalRate;
    payment.transferCost = calc.transferCost ?? commercial.transferCost ?? payment.transferCost;
    offerPreview.monthlyRate = rate;
    offerPreview.paymentType = payment.type;
    offerCalculation.monthlyRate = rate;
    offerCalculation.termMonths = payment.termMonths ?? offerCalculation.termMonths;
    offerCalculation.mileagePerYear = payment.mileagePerYear ?? offerCalculation.mileagePerYear;
    offerCalculation.downPayment = payment.downPayment;
    offerCalculation.finalPayment = calc.finalPayment ?? commercial.finalPayment ?? offerCalculation.finalPayment;
    offerCalculation.preparationFee = payment.transferCost ?? offerCalculation.preparationFee;
  }

  return {
    ...offerDraft,
    payment,
    offerPreview,
    offerCalculation,
    source,
    sellerConfirm: {
      required: Boolean(preparation.fromPdf)
        && (preparation.mode === 'leasing_intake' || preparation.mode === 'financing_intake'),
      offerInterpretation: preparation.offerInterpretation?.interpretation
        ?? preparation.offerInterpretation
        ?? null,
      evidence: preparation.offerInterpretation?.interpretation?.evidence
        ?? preparation.offerInterpretation?.evidence
        ?? {},
      ambiguities: preparation.offerInterpretation?.interpretation?.ambiguities
        ?? preparation.offerInterpretation?.ambiguities
        ?? [],
      warnings: [
        ...(preparation.offerInterpretation?.interpretation?.warnings
          ?? preparation.offerInterpretation?.warnings
          ?? []),
        ...(preparation.commercialPlausibility?.warnings ?? []),
      ],
      plausibilityFlags: preparation.commercialPlausibility?.flags ?? {},
      recognized: {
        monthlyRate: calc.monthlyRate ?? commercial.monthlyRate ?? null,
        downPayment: calc.downPayment
          ?? calc.specialPayment
          ?? commercial.downPayment
          ?? commercial.specialPayment
          ?? null,
        termMonths: calc.durationMonths ?? commercial.durationMonths ?? null,
        annualMileage: calc.annualMileageKm ?? commercial.annualMileageKm ?? null,
        transferFee: calc.transferCost ?? commercial.transferCost ?? null,
        offerType: payment.type,
      },
    },
  };
}

/**
 * PDF-Leasing/Finanzierung: MagicOfferReview (Bild 2) überspringen.
 */
export function shouldSkipMagicOfferReview(preparation) {
  if (!preparation?.fromPdf) return false;
  if (preparation.mode === 'cash_magic') return false;
  return Boolean(
    preparation.skipMagicReview
    || preparation.mode === 'leasing_intake'
    || preparation.mode === 'financing_intake',
  );
}

export { MAGIC_DECISION, COMMERCIAL_SOURCE };
