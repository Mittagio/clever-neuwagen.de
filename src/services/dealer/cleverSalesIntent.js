/**
 * Clever Sales Intent – Wissens-, Beratungs- und Verkaufsmodus per Score.
 */
import { parseSearchIntent } from '../search/searchIntentParser.js';
import { analyzeVehicleQuery } from '../search/vehicleQueryIntent.js';
import { matchPurchaseIntent } from '../search/customerQueryType.js';
import { detectModelKeyInQuery } from '../search/modelAttributeQuestion.js';
import { isShoppingCriteriaQuery } from '../search/customerQueryHelpers.js';

export const CLEVER_SALES_MODES = {
  KNOWLEDGE: 'knowledge',
  CONSULTATION: 'consultation',
  SALES: 'sales',
};

export const SALES_INTENT_THRESHOLDS = {
  consultation: 40,
  sales: 70,
};

const MODE_LABELS = {
  [CLEVER_SALES_MODES.KNOWLEDGE]: 'Wissensmodus',
  [CLEVER_SALES_MODES.CONSULTATION]: 'Beratungsmodus',
  [CLEVER_SALES_MODES.SALES]: 'Verkaufsmodus',
};

const MODE_HINTS = {
  [CLEVER_SALES_MODES.KNOWLEDGE]: 'Kurze sachliche Antwort',
  [CLEVER_SALES_MODES.CONSULTATION]: 'Beratung mit Empfehlung vorbereiten',
  [CLEVER_SALES_MODES.SALES]: 'Kaufabsicht – Lead vorbereiten',
};

const CONSULTATION_FOLLOW_UPS = {
  compare: 'Welches Modell passt besser zu Ihrem Alltag?',
  family: 'Wie viele Personen fahren regelmäßig mit?',
  fit: 'Was ist Ihnen bei der Ausstattung am wichtigsten?',
  budget: 'Gibt es ein monatliches Budget, das wir einhalten sollen?',
  default: 'Soll ich Ihnen eine passende Empfehlung vorbereiten?',
};

const SALES_FOLLOW_UPS = {
  payment: 'Leasing, Finanzierung oder Kauf – was passt für Sie?',
  budget: 'Welches monatliche Budget haben Sie im Blick?',
  default: 'Ich bereite Ihnen ein passendes Angebot vor – noch kurz die Konditionen klären.',
};

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function addSignal(signals, id, label, points) {
  signals.push({ id, label, points });
  return points;
}

function resolveBudgetBucket(maxRate) {
  const rate = Number(maxRate);
  if (!rate || Number.isNaN(rate)) return null;
  if (rate <= 200) return '200';
  if (rate <= 300) return '300';
  if (rate <= 400) return '400';
  if (rate <= 500) return '500';
  return '600';
}

function extractPaymentType(text, intent = {}) {
  if (/\bleasing\b/i.test(text)) return 'leasing';
  if (/\bfinanzier/i.test(text)) return 'finance';
  if (/\b(kauf|barzahl|cash)\b/i.test(text)) return 'cash';
  const payment = intent.payment ?? intent.filters?.payment;
  if (payment === 'leasing') return 'leasing';
  if (payment === 'finance' || payment === 'financing') return 'finance';
  if (payment === 'cash') return 'cash';
  return null;
}

function buildFollowUpQuestion(mode, context = {}) {
  if (mode === CLEVER_SALES_MODES.SALES) {
    if (!context.hasPayment) return SALES_FOLLOW_UPS.payment;
    if (!context.hasBudget) return SALES_FOLLOW_UPS.budget;
    return SALES_FOLLOW_UPS.default;
  }
  if (context.isCompare) return CONSULTATION_FOLLOW_UPS.compare;
  if (context.isFamily) return CONSULTATION_FOLLOW_UPS.family;
  if (context.isShopping) return CONSULTATION_FOLLOW_UPS.budget;
  if (context.isFit) return CONSULTATION_FOLLOW_UPS.fit;
  return CONSULTATION_FOLLOW_UPS.default;
}

/**
 * @param {object} input
 */
export function computeSalesIntentScore(input = {}) {
  const query = String(input.query ?? '').trim();
  const intent = input.intent ?? parseSearchIntent(query);
  const profile = input.profile ?? {};
  const vehicleAnalysis = input.vehicleAnalysis
    ?? (query ? analyzeVehicleQuery(query, intent, profile) : null);
  const customerQueryType = input.customerQueryType ?? null;

  const signals = [];
  let score = 0;
  const modelKey = detectModelKeyInQuery(query);
  const hasModel = Boolean(modelKey || intent.modelExplicit);

  if (vehicleAnalysis?.intent === 'vehicle_compare_question') {
    score += addSignal(signals, 'compare', 'Modellvergleich', 48);
  }

  if (customerQueryType === 'compare') {
    score = Math.max(score, 52);
    addSignal(signals, 'query_compare', 'Vergleichsfrage', 0);
  }

  if (customerQueryType === 'purchase' || matchPurchaseIntent(query, intent)) {
    score += addSignal(signals, 'purchase', 'Kaufabsicht erkannt', 55);
  }

  if (/\bangebot\b/i.test(query)) {
    score += addSignal(signals, 'offer', 'Angebot angefragt', 50);
  }

  if (/\b(leasingrate|leasing[\s-]?rate|rate.*leasing)\b/i.test(query)) {
    score += addSignal(signals, 'leasing_rate', 'Leasingrate angefragt', 42);
  } else if (/\bleasing\b/i.test(query) && hasModel) {
    score += addSignal(signals, 'leasing_model', 'Leasing mit Modell', 32);
  }

  if (/\bfinanzier/i.test(query) && hasModel) {
    score += addSignal(signals, 'finance_model', 'Finanzierung mit Modell', 38);
  }

  if (/\b(monat|rate|budget|bis\s+\d+\s*€)/i.test(query)) {
    score += addSignal(signals, 'budget', 'Budget/Rate genannt', 22);
  }

  const isFamily = /\b(familie|kinder|7[\s-]?sitz|siebensitz)/i.test(query);
  if (isFamily) {
    score += addSignal(signals, 'family', 'Familienbedarf', 28);
  }

  const isFit = /\b(passt|empfehl|berat|vorschlag|welches\s+(auto|modell|fahrzeug)|welcher\s+.*(besser|größer|kleiner)|besser\s+für)/i.test(query);
  if (isFit) {
    score += addSignal(signals, 'fit', 'Passungs-/Empfehlungsfrage', 26);
  }

  if (/\b(größer|kleiner|mehr|weniger)\b.*\b(kofferraum|reichweite|platz)\b/i.test(query)
    || /\b(kofferraum|reichweite)\b.*\b(größer|kleiner)\b/i.test(query)) {
    score += addSignal(signals, 'ranking', 'Vergleichs-/Rankingfrage', 32);
  }

  if (isShoppingCriteriaQuery(query, intent, profile)) {
    score += addSignal(signals, 'shopping', 'Kaufkriterien im Text', 34);
  }

  if (vehicleAnalysis?.intent === 'vehicle_fact_question') {
    const factualPenalty = hasModel && !(/\b(angebot|leasing|finanzier|kauf)\b/i.test(query)) ? -18 : -8;
    score += addSignal(signals, 'fact', 'Sachfrage zu Fahrzeugdaten', factualPenalty);
  }

  if (/\b(wie\s+(groß|lang|hoch|breit)|hat\s+der|verfügt|kofferraum|anhängelast|reichweite|v2l|wärmepumpe)\b/i.test(query)
    && vehicleAnalysis?.intent === 'vehicle_fact_question') {
    score = Math.min(score, SALES_INTENT_THRESHOLDS.consultation - 5);
    addSignal(signals, 'pure_fact', 'Reine Wissensfrage', 0);
  }

  if (customerQueryType === 'knowledge' && score < SALES_INTENT_THRESHOLDS.consultation) {
    score = Math.min(score, 35);
  }

  if (hasModel && /\b(konfigur|zeig|interessier)/i.test(query)) {
    score += addSignal(signals, 'configure_interest', 'Konfigurationsinteresse', 20);
  }

  score = clampScore(score);

  const mode = resolveCleverSalesMode(score);
  const paymentType = extractPaymentType(query, intent);
  const budgetBucket = resolveBudgetBucket(intent.maxRate ?? profile.maxMonthlyRate);

  const prefillAnswers = {};
  if (paymentType) prefillAnswers.paymentType = paymentType;
  if (budgetBucket) prefillAnswers.monthlyBudget = budgetBucket;

  const followUpQuestion = buildFollowUpQuestion(mode, {
    isCompare: vehicleAnalysis?.intent === 'vehicle_compare_question' || customerQueryType === 'compare',
    isFamily,
    isFit,
    isShopping: isShoppingCriteriaQuery(query, intent, profile),
    hasPayment: Boolean(prefillAnswers.paymentType),
    hasBudget: Boolean(prefillAnswers.monthlyBudget),
  });

  return {
    score,
    mode,
    modeLabel: MODE_LABELS[mode],
    modeHint: MODE_HINTS[mode],
    signals,
    followUpQuestion,
    prefillAnswers,
    modelKey: modelKey ?? null,
    shouldStartConsultation: mode !== CLEVER_SALES_MODES.KNOWLEDGE,
    shouldPrepareLead: mode === CLEVER_SALES_MODES.SALES,
    leadHints: mode === CLEVER_SALES_MODES.SALES
      ? {
        paymentType: paymentType ?? null,
        budgetBucket: budgetBucket ?? null,
        modelKey: modelKey ?? null,
        offerRequested: /\bangebot\b/i.test(query),
      }
      : null,
  };
}

/**
 * @param {number} score
 */
export function resolveCleverSalesMode(score) {
  if (score >= SALES_INTENT_THRESHOLDS.sales) return CLEVER_SALES_MODES.SALES;
  if (score >= SALES_INTENT_THRESHOLDS.consultation) return CLEVER_SALES_MODES.CONSULTATION;
  return CLEVER_SALES_MODES.KNOWLEDGE;
}

/**
 * @param {object} input
 */
export function analyzeCleverSalesIntent(input = {}) {
  const result = computeSalesIntentScore(input);
  return {
    ...result,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * @param {object} profile
 * @param {object} salesIntent
 */
export function attachSalesIntentToProfile(profile, salesIntent) {
  if (!profile || !salesIntent) return profile;
  return {
    ...profile,
    salesIntent: {
      score: salesIntent.score,
      mode: salesIntent.mode,
      modeLabel: salesIntent.modeLabel,
      signals: salesIntent.signals,
      followUpQuestion: salesIntent.followUpQuestion,
      leadHints: salesIntent.leadHints,
      analyzedAt: salesIntent.analyzedAt ?? new Date().toISOString(),
    },
  };
}

/**
 * Beratungsantworten aus Sales Intent vorausfüllen (Verkaufsmodus).
 * @param {object} profile
 * @param {object} salesIntent
 */
export function prefillConsultationFromSalesIntent(profile, salesIntent) {
  if (!profile || !salesIntent?.prefillAnswers) return profile;
  const answers = { ...(profile.answers ?? {}) };
  for (const [key, value] of Object.entries(salesIntent.prefillAnswers)) {
    if (value != null && answers[key] == null) {
      answers[key] = value;
    }
  }
  return { ...profile, answers };
}

/**
 * Kurztext für Wissensmodus-Antworten (Kontextzeile).
 * @param {object} salesIntent
 */
export function buildKnowledgeModeContextLine(salesIntent) {
  if (!salesIntent || salesIntent.mode !== CLEVER_SALES_MODES.KNOWLEDGE) return null;
  return null;
}

/**
 * Ergänzt Smart-Answer um Sales-Intent-Metadaten.
 * @param {object|null} answer
 * @param {object} salesIntent
 */
export function enrichSmartAnswerWithSalesIntent(answer, salesIntent) {
  if (!answer || !salesIntent) return answer;
  return {
    ...answer,
    salesIntent,
    kicker: salesIntent.mode === CLEVER_SALES_MODES.KNOWLEDGE
      ? 'Clever Antwort'
      : `${salesIntent.modeLabel}`,
    consultationFollowUp: salesIntent.mode === CLEVER_SALES_MODES.CONSULTATION
      ? salesIntent.followUpQuestion
      : null,
    showConsultationCta: salesIntent.shouldStartConsultation,
    consultationCtaLabel: salesIntent.mode === CLEVER_SALES_MODES.SALES
      ? 'Angebot vorbereiten'
      : 'Beratung fortsetzen',
  };
}
