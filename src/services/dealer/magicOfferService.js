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
import { readIdentityFromPreparation } from '../cleverSeller/vehicleIdentityDraft.js';
import { mergeIdentitySlot } from '../cleverSeller/offerDraftIntakeMerge.js';
import { RATE_AUTHORITY } from '../cleverSeller/captureThenOffer.js';

function paymentTypeFromOfferType(offerType) {
  if (offerType === 'purchase') return 'cash';
  if (offerType === 'financing') return 'financing';
  if (offerType === 'leasing') return 'leasing';
  return 'unknown';
}

function normalizeVehicleKey(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

const MAGIC_MODEL_ALIASES = [
  ['sportagephev', 'sportage-phev'],
  ['sportagepluginhybrid', 'sportage-phev'],
  ['sportagehybrid', 'sportage-hybrid'],
  ['sportage', 'sportage'],
  ['xceed', 'xceed'],
  ['sorento', 'sorento'],
  ['picanto', 'picanto'],
  ['stonic', 'stonic'],
  ['ceed', 'ceed'],
  ['niro', 'niro'],
  ['esoul', 'esoul'],
  ['soul', 'esoul'],
  ['ev9', 'ev9'],
  ['ev6', 'ev6'],
  ['ev5', 'ev5'],
  ['ev4', 'ev4'],
  ['ev3', 'ev3'],
  ['ev2', 'ev2'],
];

const TRIM_DISPLAY = {
  'gt-line': 'GT-Line',
  gtline: 'GT-Line',
  earth: 'Earth',
  air: 'Air',
  spirit: 'Spirit',
  vision: 'Vision',
};

/**
 * Sportage Vision / EV3 GT-Line etc. → catalog modelKey.
 * @param {string|null|undefined} hint
 * @returns {string|null}
 */
export function resolveMagicModelKey(hint) {
  if (hint == null || hint === '') return null;
  const raw = String(hint).trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (/^(ev[2-9]|sportage(?:-hybrid|-phev)?|ceed|picanto|niro|sorento|stonic|xceed|esoul)$/.test(lower)) {
    return lower;
  }
  let key = normalizeVehicleKey(raw);
  if (!key) return null;
  // „Kia Sportage Vision“ → strip brand prefix for alias match
  key = key.replace(/^(kia|hyundai|toyota|vw|volkswagen|bmw|audi|mercedes|mercedesbenz)+/, '');
  if (!key) return null;
  const ev = key.match(/^ev([234569]|9)/);
  if (ev) return `ev${ev[1]}`;
  for (const [needle, modelKey] of MAGIC_MODEL_ALIASES) {
    if (key === needle || key.startsWith(needle) || key.includes(needle)) return modelKey;
  }
  return null;
}

function displayModelFromKey(modelKey, fallback = null) {
  if (fallback) return fallback;
  if (!modelKey) return null;
  if (modelKey.startsWith('ev')) return modelKey.toUpperCase();
  if (modelKey === 'sportage-hybrid') return 'Sportage Hybrid';
  if (modelKey === 'sportage-phev') return 'Sportage Plug-in Hybrid';
  if (modelKey === 'esoul') return 'e-Soul';
  return modelKey.charAt(0).toUpperCase() + modelKey.slice(1);
}

function resolveTrimFromHints(...hints) {
  for (const hint of hints) {
    if (!hint) continue;
    const raw = String(hint).trim();
    if (!raw) continue;
    const key = normalizeVehicleKey(raw);
    if (key === 'gtline' || key === 'gt-line') {
      return { trimId: 'gt-line', trimLabel: 'GT-Line' };
    }
    if (TRIM_DISPLAY[key] || TRIM_DISPLAY[raw.toLowerCase()]) {
      const trimId = key === 'gtline' ? 'gt-line' : (raw.toLowerCase() === 'gt-line' ? 'gt-line' : key);
      return {
        trimId,
        trimLabel: TRIM_DISPLAY[key] || TRIM_DISPLAY[raw.toLowerCase()] || raw,
      };
    }
    if (/vision|spirit|earth|air|gt[\s-]?line/i.test(raw)) {
      const id = /\bgt[\s-]?line\b/i.test(raw)
        ? 'gt-line'
        : (raw.match(/\b(vision|spirit|earth|air)\b/i)?.[1] ?? raw).toLowerCase();
      return { trimId: id, trimLabel: TRIM_DISPLAY[id] || raw };
    }
  }
  return { trimId: null, trimLabel: null };
}

/**
 * Fahrzeug aus Grounding, Offer-Interpretation, Intent, Identity-Draft oder Headline ableiten.
 * Braucht kein prior parsed.ok – PDF-Leasing ohne Katalog-UPE bleibt navigierbar.
 * Expliziter Composer-Identity-Draft schlägt Lead-/History-Fallback.
 */
export function resolveMagicVehicleFields(preparation) {
  const identity = readIdentityFromPreparation(preparation);
  const g = preparation?.grounded ?? {};
  const oiRoot = preparation?.offerInterpretation?.interpretation
    ?? preparation?.offerInterpretation
    ?? {};
  const oiVehicle = oiRoot.vehicle ?? {};
  const vr = preparation?.intent?.vehicleRequest ?? {};
  const directVehicle = preparation?.vehicle ?? {};
  const headline = preparation?.headline ?? preparation?.vehicleLabel ?? '';

  const modelKey = g.modelKey
    || preparation?.focusModelKey
    || identity?.modelKey
    || resolveMagicModelKey(directVehicle.modelKey)
    || resolveMagicModelKey(directVehicle.model)
    || resolveMagicModelKey(oiVehicle.modelKey)
    || resolveMagicModelKey(oiVehicle.model)
    || resolveMagicModelKey(vr.modelHint)
    || resolveMagicModelKey(identity?.model?.canonical || identity?.model?.raw)
    || resolveMagicModelKey(headline)
    || null;

  const model = g.model
    || identity?.model?.canonical
    || identity?.model?.raw
    || directVehicle.model
    || oiVehicle.model
    || displayModelFromKey(modelKey)
    || displayModelFromKey(resolveMagicModelKey(vr.modelHint));

  const trimResolved = resolveTrimFromHints(
    g.trimLabel,
    g.trimId,
    identity?.trim?.canonical,
    identity?.trim?.raw,
    directVehicle.trim,
    oiVehicle.trim,
    vr.trimHint,
    headline,
  );

  return {
    modelKey,
    model: model || null,
    brand: g.brand || oiVehicle.brand || vr.brandHint || 'Kia',
    trimId: g.trimId || trimResolved.trimId,
    trimLabel: g.trimLabel
      || identity?.trim?.canonical
      || identity?.trim?.raw
      || directVehicle.trim
      || oiVehicle.trim
      || trimResolved.trimLabel,
    colorLabel: g.colorLabel
      || identity?.color?.canonical
      || identity?.color?.raw
      || directVehicle.color
      || vr.colorHint
      || null,
    colorId: g.colorId || identity?.colorId || directVehicle.colorId || null,
    packageLabels: g.packageLabels
      || (identity?.packages || []).map((p) => p.canonical || p.raw).filter(Boolean)
      || directVehicle.packages
      || vr.packageHints
      || [],
  };
}

/**
 * Kommerzielle Felder für Direkt-Sprung zur Angebotsvorschau.
 */
export function magicPreparationHasCommercialPreviewFields(preparation) {
  if (!preparation) return false;
  const calc = preparation.calculation ?? {};
  const commercial = preparation.intent?.commercialInput ?? {};
  if (calc.monthlyRate != null || commercial.monthlyRate != null) return true;
  if (preparation.mode === 'cash_magic' && calc.ok && calc.endPrice != null) return true;
  return false;
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

  const groundingReason = groundedResult.reason ?? '';
  const isPriceListGap = groundingReason === 'unknown_model'
    || groundingReason === 'no_automatic_variant'
    || (
      !groundedResult.grounded?.basePrice
      && groundingReason !== 'unknown_package'
      && groundingReason !== 'unknown_color'
      && groundingReason !== 'package_trim_mismatch'
    );
  if (isPriceListGap) {
    import('../admin/leitstand/cleverAdminWarningBridge.js')
      .then(({ logPriceListGroundingAdminWarning }) => logPriceListGroundingAdminWarning({
        reason: groundingReason || 'missing_list_price',
        message: groundedResult.message ?? null,
        modelKey: groundedResult.grounded?.modelKey ?? context.modelKey ?? null,
      }))
      .catch(() => {});
  }

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
    /** PDF (außer Barkauf-Paketmath): MagicOfferReview überspringen → Angebotsvorschau */
    skipMagicReview: Boolean(context.fromPdf),
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
  const ctx = {
    ...context,
    fromPdf: Boolean(context.fromPdf ?? previous?.fromPdf),
    originalPdf: context.originalPdf ?? previous?.originalPdf ?? null,
  };

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
      ...ctx,
      modelKey: previous?.grounded?.modelKey ?? ctx.modelKey,
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
      ...ctx,
      modelKey: previous?.grounded?.modelKey ?? ctx.modelKey,
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
      ...ctx,
      modelKey: previous?.grounded?.modelKey ?? ctx.modelKey,
      previousPreparation: previous,
    });
  }

  return prepareMagicOffer(correctionText, {
    ...ctx,
    modelKey: previous?.grounded?.modelKey ?? ctx.modelKey,
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
  const vehicle = resolveMagicVehicleFields(preparation);
  const invalidateRate = preparation?.invalidateVehicleRate === true
    || preparation?.createNewAlternative === true
    || preparation?.mode === 'composer_identity_draft';
  if (
    !vehicle.modelKey
    && !vehicle.model
    && !g.modelKey
    && !g.model
    && c.monthlyRate == null
    && calc.monthlyRate == null
  ) {
    if (!preparation?.intent?.vehicleRequest?.modelHint) return null;
  }

  const packageLabels = vehicle.packageLabels || g.packageLabels || [];

  return {
    modelKey: vehicle.modelKey ?? g.modelKey ?? null,
    model: vehicle.model ?? g.model ?? preparation?.intent?.vehicleRequest?.modelHint ?? null,
    brand: vehicle.brand ?? g.brand ?? preparation?.intent?.vehicleRequest?.brandHint ?? 'Kia',
    trimId: vehicle.trimId ?? g.trimId,
    trimLabel: vehicle.trimLabel ?? g.trimLabel ?? preparation?.intent?.vehicleRequest?.trimHint ?? null,
    engineId: g.engineId,
    motorLabel: g.engineLabel,
    colorId: vehicle.colorId ?? g.colorId ?? null,
    colorLabel: vehicle.colorLabel
      ?? g.colorLabel
      ?? preparation?.intent?.vehicleRequest?.colorHint
      ?? null,
    packageIds: g.packageIds ?? [],
    packageLabels,
    paymentType: preparation.paymentType ?? null,
    customerType: preparation.customerType
      || preparation.commercialScenario?.customerType
      || null,
    // Neue Vehicle Identity → keine alte Fahrzeugrate übernehmen
    desiredRate: invalidateRate
      ? null
      : (calc.monthlyRate ?? c.monthlyRate ?? null),
    desiredPrice: preparation.mode === 'cash_magic' ? calc.endPrice ?? null : null,
    termMonths: c.durationMonths ?? calc.durationMonths ?? null,
    mileagePerYear: c.annualMileageKm ?? calc.annualMileageKm ?? null,
    // Keine erfundene AZ 0 – nur echte Sonderzahlung aus Capture/Draft
    downPayment: c.downPayment ?? c.specialPayment ?? calc.downPayment ?? calc.specialPayment ?? null,
    preparationFee: c.transferCost ?? calc.transferCost ?? null,
    customDiscountPercent: calc.discountPercent ?? c.discountPercent ?? null,
    customerGroup: (calc.discountPercent != null || c.discountPercent != null) ? 'custom' : 'standard',
    balloonPayment: c.finalPayment ?? calc.finalPayment ?? null,
    offerDraftId: preparation.offerDraftId || null,
    vehicleIdentityDraftId: preparation.vehicleIdentityDraftId || null,
  };
}

/**
 * Magic-Werte über bestehende Offer-Draft-Pipeline legen
 * (Seller-/PDF-Rate bzw. deterministischer Barkauf – nicht Engine-Schätzung).
 */
export function pickRichestOriginalPdf(...candidates) {
  let best = null;
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const hasData = Boolean(candidate.dataUrl || candidate.url);
    if (!best) {
      best = candidate;
      continue;
    }
    const bestHasData = Boolean(best.dataUrl || best.url);
    if (hasData && !bestHasData) {
      best = candidate;
      continue;
    }
    if (hasData === bestHasData && candidate.fileName && !best.fileName) {
      best = candidate;
    }
  }
  return best;
}

export function ensureOriginalPdfOnOfferDraft(offerDraft, originalPdf = null) {
  if (!offerDraft) return offerDraft;
  const merged = pickRichestOriginalPdf(
    originalPdf,
    offerDraft.source?.originalPdf,
  );
  if (!merged) return offerDraft;
  const fromPdf = Boolean(
    offerDraft.source?.createdFrom === 'magic_offer_pdf'
    || originalPdf
    || merged.dataUrl
    || merged.url
    || merged.fileName,
  );
  return {
    ...offerDraft,
    source: {
      ...(offerDraft.source ?? {}),
      ...(fromPdf ? { createdFrom: 'magic_offer_pdf' } : {}),
      originalPdf: merged,
    },
  };
}

export function overlayMagicOntoOfferDraft(offerDraft, preparation) {
  if (!offerDraft || !preparation) return offerDraft;
  const calc = preparation.calculation ?? {};
  const commercial = preparation.intent?.commercialInput ?? {};
  const payment = { ...(offerDraft.payment ?? {}) };
  const offerPreview = { ...(offerDraft.offerPreview ?? {}) };
  const offerCalculation = { ...(offerDraft.offerCalculation ?? {}) };
  const originalPdf = pickRichestOriginalPdf(
    preparation.originalPdf,
    offerDraft.source?.originalPdf,
  );
  const source = {
    ...(offerDraft.source ?? {}),
    createdFrom: preparation.fromPdf ? 'magic_offer_pdf' : 'magic_offer',
    magicMode: preparation.mode,
    magicDecision: preparation.decision?.action ?? null,
    originalPdf,
  };
  const conceptOfferDraftId = preparation.offerDraftId
    || offerDraft.offerDraftId
    || offerDraft.meta?.offerDraftId
    || offerDraft.source?.offerDraftId
    || null;
  if (conceptOfferDraftId) {
    source.offerDraftId = conceptOfferDraftId;
  }

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

  // Vehicle Identity: leere Slots aus PDF füllen; Konflikte slotweise (kein stilles Überschreiben)
  const vehicle = { ...(offerDraft.vehicle ?? {}) };
  const vehicleConfiguration = { ...(offerDraft.vehicleConfiguration ?? {}) };
  const vr = preparation.intent?.vehicleRequest ?? {};
  const grounded = preparation.grounded
    || preparation.offerInterpretation?.interpretation?.vehicle
    || preparation.offerInterpretation?.vehicle
    || null;
  const modelKey = vehicleConfiguration.modelKey || vehicle.modelKey || null;
  const identityConflicts = [];

  const pdfTrim = grounded?.trimLabel || vr.trimHint || null;
  const trimMerge = mergeIdentitySlot({
    existingSlot: {
      raw: vehicleConfiguration.trimLabel || vehicle.trimLabel || null,
      canonical: vehicleConfiguration.trimLabel || vehicle.trimLabel || null,
    },
    incomingRaw: pdfTrim,
    field: 'trim',
    modelKey,
  });
  if (trimMerge.conflict) identityConflicts.push(trimMerge.conflict);
  else if (trimMerge.patch?.trim) {
    vehicle.trimLabel = trimMerge.patch.trim;
    vehicleConfiguration.trimLabel = trimMerge.patch.trim;
    vehicleConfiguration.trimId = String(trimMerge.patch.trim).toLowerCase().replace(/\s+/g, '-');
  }

  const pdfColor = grounded?.colorLabel || vr.colorHint || null;
  const colorMerge = mergeIdentitySlot({
    existingSlot: {
      raw: vehicleConfiguration.colorLabel || vehicle.color || null,
      canonical: vehicleConfiguration.colorLabel || vehicle.color || null,
    },
    incomingRaw: pdfColor,
    field: 'color',
    modelKey,
  });
  if (colorMerge.conflict) identityConflicts.push(colorMerge.conflict);
  else if (colorMerge.patch?.color) {
    vehicle.color = colorMerge.patch.color;
    vehicleConfiguration.colorLabel = colorMerge.patch.color;
  }

  const pdfMotor = grounded?.engineLabel || vr.motorHint || null;
  if (pdfMotor && !(vehicleConfiguration.motorLabel || vehicle.battery)) {
    vehicle.battery = pdfMotor;
    vehicleConfiguration.motorLabel = pdfMotor;
    vehicleConfiguration.batteryLabel = pdfMotor;
  }

  const pdfPackages = [
    ...(Array.isArray(vr.packageKeys) ? vr.packageKeys : []),
    ...(Array.isArray(grounded?.packageLabels) ? grounded.packageLabels : []),
  ].filter(Boolean);
  if (pdfPackages.length) {
    const existing = new Set([
      ...(vehicleConfiguration.packageLabels || []),
      ...((vehicleConfiguration.selectedPackages || []).map((p) => p.name).filter(Boolean)),
    ]);
    const nextLabels = [...(vehicleConfiguration.packageLabels || [])];
    for (const pkg of pdfPackages) {
      const label = String(pkg).trim();
      if (label && !existing.has(label)) {
        nextLabels.push(label);
        existing.add(label);
      }
    }
    vehicleConfiguration.packageLabels = nextLabels;
  }

  const rateFromPdf = payment.calculatedRate ?? offerPreview.monthlyRate ?? null;
  const rateAuthority = preparation.fromPdf && rateFromPdf != null
    ? RATE_AUTHORITY.AUTHORITATIVE
    : (offerDraft.rateAuthority || null);

  return {
    ...offerDraft,
    payment,
    offerPreview,
    offerCalculation,
    vehicle,
    vehicleConfiguration,
    source,
    ...(conceptOfferDraftId ? { offerDraftId: conceptOfferDraftId } : {}),
    meta: {
      ...(offerDraft.meta || {}),
      ...(conceptOfferDraftId ? { offerDraftId: conceptOfferDraftId } : {}),
      ...(preparation.vehicleIdentityDraftId
        ? { vehicleIdentityDraftId: preparation.vehicleIdentityDraftId }
        : {}),
    },
    identityConflicts,
    rateAuthority,
    missingRate: rateFromPdf != null ? false : offerDraft.missingRate,
    // Rate nur belastbar, wenn Identity zum aktuellen Draft passt (Konflikt → Rate prüfen)
    rateNeedsReview: identityConflicts.length > 0
      ? true
      : (rateFromPdf != null ? false : offerDraft.rateNeedsReview),
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
        ...identityConflicts.map((c) => c.label),
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
 * Nie MagicOfferReview („Angebot vorbereitet“), wenn skipMagicReview oder PDF-Intake.
 * Ausnahme: deterministischer Barkauf (cash_magic) behält Positionsreview.
 * Clever-Handoff / Angebot bearbeiten setzt skipMagicReview und springt direkt zur Vorschau.
 */
export function shouldSkipMagicOfferReview(preparation) {
  if (!preparation) return false;
  if (preparation.mode === 'cash_magic') return false;
  // Expliziter Skip (auch ohne PDF) – z. B. Clever „Angebot bearbeiten“
  if (preparation.skipMagicReview) return true;
  if (!preparation.fromPdf) return false;
  if (preparation.mode === 'leasing_intake' || preparation.mode === 'financing_intake') return true;
  // PDF mit erkannten Konditionen / Fahrzeug – auch ohne sauberes offerType
  if (magicPreparationHasCommercialPreviewFields(preparation)) return true;
  if (resolveMagicVehicleFields(preparation).modelKey) return true;
  // Jedes andere fromPdf (außer cash) trotzdem skippen – Confirm sitzt auf der Vorschau
  return true;
}

export { MAGIC_DECISION, COMMERCIAL_SOURCE };
