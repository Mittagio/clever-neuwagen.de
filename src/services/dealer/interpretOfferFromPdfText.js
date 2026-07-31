/**
 * Bridge: PDF-Text → Offer Interpreter Contract (deterministisch zuerst).
 * OpenAI-Pfad optional später – Schema/Validation bleiben Source of Review.
 */
import { parseMagicOfferIntent } from './magicOfferIntentParser.js';
import {
  EMPTY_OFFER_INTERPRETATION,
  validateOfferInterpretation,
  detectRateAmbiguity,
  buildOfferReviewModel,
} from './offerInterpreterSchema.js';
import {
  parseGermanMoney,
  assessCommercialPlausibility,
} from './parseGermanMoney.js';

const RATE_RE = /(?:leasing)?(?:rate|monatsrate|monatliche\s+(?:leasing)?rate)\s*[:=]?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:[.,]\d{2})?)\s*(?:€|eur)/gi;
const RATE_LOOSE_RE = /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:[.,]\d{2})?)\s*(?:€|eur)\s*(?:\/\s*monat|pro\s*monat|mtl\.?|monatlich)/gi;

/**
 * Sammle alle Rate-Kandidaten inkl. Evidence.
 */
export function collectMonthlyRateCandidates(text = '') {
  const found = [];
  const push = (re) => {
    re.lastIndex = 0;
    let m = re.exec(text);
    while (m) {
      const value = parseGermanMoney(m[1]);
      if (value != null) {
        found.push({
          value,
          sourceText: m[0].trim(),
          page: null,
        });
      }
      m = re.exec(text);
    }
  };
  push(RATE_RE);
  push(RATE_LOOSE_RE);
  return found;
}

/**
 * @param {string} pdfText
 * @param {{ fileName?: string, knownVehicle?: object }} [context]
 */
export function interpretOfferFromPdfText(pdfText, context = {}) {
  const intent = parseMagicOfferIntent(pdfText || '');
  const rateCandidates = collectMonthlyRateCandidates(pdfText || '');
  const ambiguity = detectRateAmbiguity(rateCandidates);

  const commercial = intent.commercialInput ?? {};
  const preferredRate = ambiguity
    ? null
    : (rateCandidates[0]?.value ?? commercial.monthlyRate ?? null);

  const raw = {
    ...EMPTY_OFFER_INTERPRETATION,
    offerType: intent.offerType === 'purchase'
      ? 'cash'
      : (intent.offerType || null),
    vehicle: {
      brand: context.knownVehicle?.brand ?? intent.vehicleRequest?.brandHint ?? 'Kia',
      model: context.knownVehicle?.model
        ?? intent.vehicleRequest?.modelHint
        ?? null,
      trim: context.knownVehicle?.trim ?? intent.vehicleRequest?.trimHint ?? null,
      engine: null,
      color: intent.vehicleRequest?.colorHint ?? null,
    },
    monthlyRate: preferredRate,
    termMonths: commercial.durationMonths ?? null,
    annualMileage: commercial.annualMileageKm ?? null,
    downPayment: commercial.downPayment ?? commercial.specialPayment ?? 0,
    purchasePrice: commercial.listPrice ?? null,
    finalPayment: commercial.finalPayment ?? null,
    transferFee: commercial.transferCost ?? null,
    apr: commercial.effectiveInterestRate ?? null,
    nominalInterest: null,
    totalAmount: null,
    extraMileageCost: null,
    underMileageCredit: null,
    deliveryEstimate: null,
    validUntil: null,
    confidence: {},
    evidence: {},
    ambiguities: ambiguity ? [ambiguity] : [],
    warnings: [],
  };

  if (raw.monthlyRate != null && rateCandidates[0]) {
    raw.evidence.monthlyRate = {
      sourceText: rateCandidates[0].sourceText,
      page: 1,
      confidence: ambiguity ? 0.4 : 0.95,
    };
    raw.confidence.monthlyRate = ambiguity ? 0.4 : 0.95;
  }
  if (raw.termMonths != null) {
    raw.confidence.termMonths = 0.85;
  }
  if (raw.annualMileage != null) {
    raw.confidence.annualMileage = 0.85;
  }

  const plausibility = assessCommercialPlausibility({
    monthlyRate: raw.monthlyRate,
    downPayment: raw.downPayment,
    vehiclePrice: raw.purchasePrice,
    offerType: raw.offerType ?? intent.offerType,
  });
  if (plausibility.warnings.length) {
    raw.warnings.push(...plausibility.warnings);
  }

  if (context.fileName && !raw.vehicle.model) {
    const fromName = String(context.fileName).match(
      /(tivoli|xceed|sportage|ev\d|ceed|niro|sorento|picanto|rio|stonic)/i,
    );
    if (fromName) raw.vehicle.model = fromName[1];
  }

  const validation = validateOfferInterpretation(raw);
  return {
    ...validation,
    review: buildOfferReviewModel(validation),
    intent,
    rateCandidates,
    source: 'pdf_text_deterministic',
  };
}
