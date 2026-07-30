/**
 * OpenAI Offer Interpreter – striktes JSON-Schema + Validierung.
 * OpenAI darf nur vorhandene PDF-Werte extrahieren; keine Erfindung.
 */

export const OFFER_INTERPRETER_TYPES = ['leasing', 'financing', 'cash'];

/** JSON Schema für Structured Outputs / Validierung */
export const OFFER_INTERPRETER_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'offerType',
    'vehicle',
    'monthlyRate',
    'termMonths',
    'annualMileage',
    'downPayment',
    'purchasePrice',
    'finalPayment',
    'transferFee',
    'apr',
    'nominalInterest',
    'totalAmount',
    'extraMileageCost',
    'underMileageCredit',
    'deliveryEstimate',
    'validUntil',
    'confidence',
    'evidence',
    'ambiguities',
    'warnings',
  ],
  properties: {
    offerType: {
      type: ['string', 'null'],
      enum: [...OFFER_INTERPRETER_TYPES, null],
    },
    vehicle: {
      type: 'object',
      additionalProperties: false,
      required: ['brand', 'model', 'trim', 'engine', 'color'],
      properties: {
        brand: { type: ['string', 'null'] },
        model: { type: ['string', 'null'] },
        trim: { type: ['string', 'null'] },
        engine: { type: ['string', 'null'] },
        color: { type: ['string', 'null'] },
      },
    },
    monthlyRate: { type: ['number', 'null'] },
    termMonths: { type: ['integer', 'null'] },
    annualMileage: { type: ['integer', 'null'] },
    downPayment: { type: ['number', 'null'] },
    purchasePrice: { type: ['number', 'null'] },
    finalPayment: { type: ['number', 'null'] },
    transferFee: { type: ['number', 'null'] },
    apr: { type: ['number', 'null'] },
    nominalInterest: { type: ['number', 'null'] },
    totalAmount: { type: ['number', 'null'] },
    extraMileageCost: { type: ['number', 'null'] },
    underMileageCredit: { type: ['number', 'null'] },
    deliveryEstimate: { type: ['string', 'null'] },
    validUntil: { type: ['string', 'null'] },
    confidence: {
      type: 'object',
      additionalProperties: { type: 'number' },
    },
    evidence: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        additionalProperties: false,
        required: ['sourceText'],
        properties: {
          sourceText: { type: 'string' },
          page: { type: ['integer', 'null'] },
          confidence: { type: ['number', 'null'] },
        },
      },
    },
    ambiguities: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['field', 'candidates', 'message'],
        properties: {
          field: { type: 'string' },
          candidates: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['value', 'sourceText'],
              properties: {
                value: {},
                sourceText: { type: 'string' },
                page: { type: ['integer', 'null'] },
              },
            },
          },
          message: { type: 'string' },
        },
      },
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
    },
  },
};

export const EMPTY_OFFER_INTERPRETATION = {
  offerType: null,
  vehicle: {
    brand: null,
    model: null,
    trim: null,
    engine: null,
    color: null,
  },
  monthlyRate: null,
  termMonths: null,
  annualMileage: null,
  downPayment: null,
  purchasePrice: null,
  finalPayment: null,
  transferFee: null,
  apr: null,
  nominalInterest: null,
  totalAmount: null,
  extraMileageCost: null,
  underMileageCredit: null,
  deliveryEstimate: null,
  validUntil: null,
  confidence: {},
  evidence: {},
  ambiguities: [],
  warnings: [],
};

const NUMERIC_FIELDS = [
  'monthlyRate',
  'termMonths',
  'annualMileage',
  'downPayment',
  'purchasePrice',
  'finalPayment',
  'transferFee',
  'apr',
  'nominalInterest',
  'totalAmount',
  'extraMileageCost',
  'underMileageCredit',
];

const REVIEW_PRIORITY_FIELDS = [
  'monthlyRate',
  'termMonths',
  'annualMileage',
  'downPayment',
  'offerType',
];

/**
 * @param {unknown} raw
 * @returns {{ ok: boolean, interpretation: object, errors: string[], reviewNeeded: boolean, reviewFields: string[] }}
 */
export function validateOfferInterpretation(raw) {
  const errors = [];
  const interpretation = {
    ...EMPTY_OFFER_INTERPRETATION,
    vehicle: { ...EMPTY_OFFER_INTERPRETATION.vehicle },
    confidence: {},
    evidence: {},
    ambiguities: [],
    warnings: [],
  };

  if (!raw || typeof raw !== 'object') {
    return {
      ok: false,
      interpretation,
      errors: ['invalid_payload'],
      reviewNeeded: true,
      reviewFields: [...REVIEW_PRIORITY_FIELDS],
    };
  }

  if (raw.offerType != null) {
    if (!OFFER_INTERPRETER_TYPES.includes(raw.offerType)) {
      errors.push('invalid_offerType');
      interpretation.offerType = null;
    } else {
      interpretation.offerType = raw.offerType;
    }
  }

  if (raw.vehicle && typeof raw.vehicle === 'object') {
    for (const key of ['brand', 'model', 'trim', 'engine', 'color']) {
      const val = raw.vehicle[key];
      interpretation.vehicle[key] = val == null || val === '' ? null : String(val);
    }
  }

  for (const field of NUMERIC_FIELDS) {
    const val = raw[field];
    if (val == null || val === '') {
      interpretation[field] = null;
      continue;
    }
    const num = Number(val);
    if (!Number.isFinite(num)) {
      errors.push(`invalid_${field}`);
      interpretation[field] = null;
    } else {
      interpretation[field] = field === 'termMonths' || field === 'annualMileage'
        ? Math.round(num)
        : num;
    }
  }

  interpretation.deliveryEstimate = raw.deliveryEstimate == null
    ? null
    : String(raw.deliveryEstimate);
  interpretation.validUntil = raw.validUntil == null ? null : String(raw.validUntil);

  if (raw.confidence && typeof raw.confidence === 'object') {
    for (const [key, value] of Object.entries(raw.confidence)) {
      const n = Number(value);
      if (Number.isFinite(n)) interpretation.confidence[key] = n;
    }
  }

  if (raw.evidence && typeof raw.evidence === 'object') {
    for (const [key, ev] of Object.entries(raw.evidence)) {
      if (!ev || typeof ev !== 'object' || !ev.sourceText) continue;
      interpretation.evidence[key] = {
        sourceText: String(ev.sourceText),
        page: Number.isFinite(Number(ev.page)) ? Number(ev.page) : null,
        confidence: Number.isFinite(Number(ev.confidence)) ? Number(ev.confidence) : null,
      };
    }
  }

  if (Array.isArray(raw.ambiguities)) {
    interpretation.ambiguities = raw.ambiguities
      .filter((a) => a && a.field && Array.isArray(a.candidates) && a.candidates.length >= 2)
      .map((a) => ({
        field: String(a.field),
        message: String(a.message || `${a.field} nicht eindeutig erkannt.`),
        candidates: a.candidates.map((c) => ({
          value: c?.value,
          sourceText: String(c?.sourceText ?? ''),
          page: Number.isFinite(Number(c?.page)) ? Number(c.page) : null,
        })),
      }));
  }

  if (Array.isArray(raw.warnings)) {
    interpretation.warnings = raw.warnings.map((w) => String(w)).filter(Boolean);
  }

  // Felder ohne Evidence bei gesetztem Wert → Warnung (kein Auto-Trust)
  for (const field of REVIEW_PRIORITY_FIELDS) {
    const value = field === 'offerType'
      ? interpretation.offerType
      : interpretation[field];
    if (value == null) continue;
    if (!interpretation.evidence[field] && field !== 'offerType') {
      interpretation.warnings.push(`missing_evidence:${field}`);
    }
  }

  const reviewFields = [
    ...interpretation.ambiguities.map((a) => a.field),
    ...REVIEW_PRIORITY_FIELDS.filter((f) => {
      const value = f === 'offerType' ? interpretation.offerType : interpretation[f];
      if (value == null) return f === 'monthlyRate' || f === 'offerType';
      if (interpretation.ambiguities.some((a) => a.field === f)) return true;
      const conf = interpretation.confidence[f];
      return Number.isFinite(conf) && conf < 0.7;
    }),
  ];
  const uniqueReview = [...new Set(reviewFields)];

  return {
    ok: errors.length === 0 && interpretation.ambiguities.length === 0,
    interpretation,
    errors,
    reviewNeeded: uniqueReview.length > 0 || interpretation.ambiguities.length > 0,
    reviewFields: uniqueReview,
  };
}

/**
 * Zwei widersprüchliche Raten → Ambiguity, kein Auto-Pick.
 */
export function detectRateAmbiguity(candidates = []) {
  const unique = [];
  for (const c of candidates) {
    const value = Number(c?.value);
    if (!Number.isFinite(value)) continue;
    if (!unique.some((u) => u.value === value)) {
      unique.push({
        value,
        sourceText: String(c.sourceText ?? ''),
        page: c.page ?? null,
      });
    }
  }
  if (unique.length < 2) return null;
  return {
    field: 'monthlyRate',
    message: 'Monatsrate nicht eindeutig erkannt.',
    candidates: unique,
  };
}

/**
 * Kompaktes Seller-Review-Modell (keine große Formularseite).
 */
export function buildOfferReviewModel(validation) {
  const i = validation?.interpretation ?? EMPTY_OFFER_INTERPRETATION;
  const vehicleLabel = [
    i.vehicle?.brand,
    i.vehicle?.model,
    i.vehicle?.trim,
  ].filter(Boolean).join(' ') || 'Angebot erkannt';

  const lines = [];
  if (i.monthlyRate != null) lines.push(`${formatEuro(i.monthlyRate)}/Monat`);
  if (i.termMonths != null) lines.push(`${i.termMonths} Monate`);
  if (i.annualMileage != null) {
    lines.push(`${Number(i.annualMileage).toLocaleString('de-DE')} km/Jahr`);
  }
  if (i.downPayment != null) lines.push(`${formatEuro(i.downPayment)} Sonderzahlung`);

  const complete = !validation?.reviewNeeded
    && i.monthlyRate != null
    && (i.offerType != null || i.purchasePrice != null);

  return {
    title: validation?.reviewNeeded
      ? 'Bitte kurz prüfen'
      : 'Clever hat das Angebot erkannt',
    vehicleLabel,
    lines,
    recognitionLabel: complete ? 'vollständig' : 'teilweise',
    ambiguities: i.ambiguities ?? [],
    reviewFields: validation?.reviewFields ?? [],
    warnings: i.warnings ?? [],
    canAccept: (i.ambiguities?.length ?? 0) === 0 && i.monthlyRate != null,
    interpretation: i,
  };
}

function formatEuro(value) {
  return `${Number(value).toLocaleString('de-DE', {
    minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : 2,
    maximumFractionDigits: 2,
  })} €`;
}

export const OFFER_INTERPRETER_SYSTEM_PROMPT = `Du extrahierst Angebotsdaten ausschließlich aus dem gelieferten PDF-Text.
Regeln:
- Nur Werte übernehmen, die im Text vorkommen.
- Nicht raten, nicht aus Modellwissen ergänzen.
- Wenn ein Feld fehlt: null.
- Wenn zwei widersprüchliche Werte existieren: ambiguities mit beiden Kandidaten, Feldwert null.
- Für jeden gesetzten Wert evidence.sourceText angeben.
- confidence nur wenn Evidenz klar ist (0–1).
Antworte ausschließlich als JSON gemäß Schema.`;
