/**
 * Clever-Beratung → Angebotsflow vorausfüllen (bestehender Offer-Flow, keine Duplikation).
 */
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { getSpecialConditionLabels } from './specialConditionOptions.js';
import {
  buildCleverBeratungAkteView,
  extractConsultationFromLead,
} from './cleverConsultationAkte.js';

const KM_MAP = {
  '8000': 8000,
  '12000': 12000,
  '15000': 15000,
  '20000': 20000,
  '25000': 25000,
};

const DEFAULT_TERM_MONTHS = 48;

function uid(prefix = 'clever-offer') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function resolvePaymentType(answers = {}, lead = {}) {
  if (answers.paymentType === 'finance') return 'financing';
  if (answers.paymentType === 'cash') return 'cash';
  if (answers.paymentType === 'leasing') return 'leasing';
  if (lead?.paymentType && lead.paymentType !== 'unknown') return lead.paymentType;
  if (lead?.journeySnapshot?.purchaseType === 'finance') return 'financing';
  if (lead?.journeySnapshot?.purchaseType === 'cash') return 'cash';
  if (lead?.journeySnapshot?.purchaseType === 'leasing') return 'leasing';
  return 'unknown';
}

function resolveTermMonths(lead) {
  return lead?.wish?.termMonths
    ?? lead?.journeySnapshot?.configuration?.leasingTermMonths
    ?? DEFAULT_TERM_MONTHS;
}

function resolveDownPayment(lead) {
  return lead?.wish?.downPayment
    ?? lead?.journeySnapshot?.configuration?.downPayment
    ?? null;
}

function resolveSpecialConditionLabels(lead) {
  const ids = lead?.sonderwuensche?.specialConditions
    ?? lead?.journeySnapshot?.specialConditions
    ?? [];
  return getSpecialConditionLabels(ids);
}

/**
 * @param {object} values
 */
function buildPendingFields({
  paymentType,
  termMonths,
  mileagePerYear,
  desiredRate,
  desiredPrice,
  downPayment,
  deliveryNote,
  specialConditionLabels,
}) {
  const pending = [];
  const add = (id, label) => pending.push({ id, label, hint: 'bitte klären' });

  if (!paymentType || paymentType === 'unknown') add('paymentType', 'Zahlungsart');
  if (!mileagePerYear && paymentType !== 'cash') add('mileagePerYear', 'Kilometer / Jahr');
  if (!termMonths && paymentType !== 'cash') add('termMonths', 'Laufzeit');
  if (paymentType === 'cash') {
    if (desiredPrice == null) add('desiredPrice', 'Kaufpreis');
  } else if (desiredRate == null) {
    add('desiredRate', 'Monatsrate / Budget');
  }
  if (downPayment == null && paymentType !== 'cash') add('downPayment', 'Anzahlung');
  if (!deliveryNote) add('delivery', 'Lieferzeit');
  if (!specialConditionLabels?.length) add('specialConditions', 'Zielgruppe / Aktionen');

  return pending;
}

/**
 * @param {object} lead
 */
export function buildCleverConsultationOfferPrefill(lead) {
  const akteView = buildCleverBeratungAkteView(lead);
  if (!akteView) return null;

  const consultation = extractConsultationFromLead(lead);
  const answers = consultation?.consultationProfile?.answers ?? {};
  const rec = akteView.recommendation;
  const modelKey = rec?.modelKey ?? 'ev3';
  const attrs = KIA_MODEL_ATTRIBUTES[modelKey] ?? {};
  const paymentType = resolvePaymentType(answers, lead);
  const mileagePerYear = KM_MAP[answers.annualKm]
    ?? lead?.wish?.mileagePerYear
    ?? null;
  const termMonths = resolveTermMonths(lead);
  const downPayment = resolveDownPayment(lead);
  const desiredRate = answers.monthlyBudget && answers.monthlyBudget !== 'open'
    ? Number(answers.monthlyBudget)
    : (lead?.desiredRate ?? lead?.inquiryBrief?.budget?.maxMonthly ?? null);
  const desiredPrice = paymentType === 'cash'
    ? (lead?.wish?.desiredPrice ?? lead?.inquiryBrief?.budget?.maxPrice ?? null)
    : null;
  const deliveryNote = lead?.deliveryTime
    ?? lead?.wish?.desiredDeliveryDate
    ?? lead?.inquiryBrief?.deliveryLabel
    ?? '';
  const specialConditionLabels = resolveSpecialConditionLabels(lead);
  const trimId = consultation?.cleverRecommendation?.trimId ?? null;

  const cardId = uid();
  const modelName = rec?.vehicleTitle ?? `Kia ${rec?.modelLabel ?? modelKey}`;

  const pendingFields = buildPendingFields({
    paymentType,
    termMonths: paymentType === 'cash' ? termMonths : termMonths,
    mileagePerYear,
    desiredRate,
    desiredPrice,
    downPayment,
    deliveryNote,
    specialConditionLabels,
  });

  const card = {
    id: cardId,
    leadId: lead?.id,
    modelKey,
    modelName,
    trimLabel: rec?.trimLabel ?? null,
    trimId,
    motorLabel: rec?.batteryOrMotor ?? null,
    bodyType: attrs.bodyType ?? 'suv',
    paymentType,
    termMonths: paymentType === 'cash' ? null : termMonths,
    mileagePerYear: paymentType === 'cash' ? null : mileagePerYear,
    desiredRate: paymentType === 'cash' ? null : desiredRate,
    desiredPrice,
    downPayment,
    isPrimary: true,
    isFavorite: true,
    badge: 'Clever Empfehlung',
    source: 'clever-consultation',
    configurationId: cardId,
    featureLabels: akteView.requirementChips.map((c) => c.label),
    specialConditionLabels,
    fromCleverConsultation: true,
  };

  const vehicleConfiguration = {
    id: cardId,
    modelKey,
    model: rec?.modelLabel ?? attrs.label ?? modelKey,
    trimLabel: rec?.trimLabel ?? null,
    trimId,
    batteryLabel: rec?.batteryOrMotor ?? null,
    powertrainLabel: rec?.batteryOrMotor ?? null,
    paymentType,
    leasingData: paymentType === 'leasing' ? {
      termMonths,
      mileagePerYear,
      desiredRate,
      downPayment: downPayment ?? 0,
    } : null,
    financingData: paymentType === 'financing' ? {
      termMonths,
      desiredRate,
      downPayment: downPayment ?? 0,
    } : null,
    cashPurchaseData: paymentType === 'cash' ? {
      desiredPrice,
    } : null,
    source: 'clever_consultation',
    featureWishLabels: akteView.requirementChips.map((c) => c.label),
    specialConditionLabels,
    openQuestions: akteView.openQuestions,
  };

  const cleverTransfer = {
    customerWish: akteView.customerWish,
    recommendationTitle: rec?.vehicleTitle ?? null,
    recommendationSummary: rec?.summarySentence ?? null,
    requirementChips: akteView.requirementChips,
    openQuestions: akteView.openQuestions,
    whyLines: rec?.whyLines ?? [],
    transferredAt: new Date().toISOString(),
  };

  const parsedFieldPatches = {
    brand: 'Kia',
    model: vehicleConfiguration.model,
    modelId: modelKey,
    trimLabel: card.trimLabel,
    trimId,
    paymentType,
    desiredRate: card.desiredRate,
    desiredPrice: card.desiredPrice,
    termMonths: card.termMonths,
    mileagePerYear: card.mileagePerYear,
    downPayment: card.downPayment,
    batteryLabel: card.motorLabel,
    motorLabel: card.motorLabel,
  };

  return {
    card,
    vehicleConfiguration,
    cleverTransfer,
    pendingFields,
    parsedFieldPatches,
  };
}

/**
 * @param {object} prefill
 */
export function buildLeadPatchFromCleverPrefill(prefill, lead = {}) {
  if (!prefill) return null;
  const { card, vehicleConfiguration, cleverTransfer } = prefill;
  const existingConfigs = lead?.crm?.vehicleConfigurations ?? [];
  const withoutDup = existingConfigs.filter((c) => c.source !== 'clever_consultation');
  const nextConfigs = [vehicleConfiguration, ...withoutDup];

  return {
    vehicle: {
      brand: 'Kia',
      model: vehicleConfiguration.model,
      trim: vehicleConfiguration.trimLabel ?? '',
      engine: vehicleConfiguration.batteryLabel ?? '',
      label: card.modelName,
    },
    paymentType: card.paymentType !== 'unknown' ? card.paymentType : lead.paymentType,
    desiredRate: card.desiredRate ?? lead.desiredRate ?? null,
    wish: {
      ...(lead.wish ?? {}),
      paymentType: card.paymentType !== 'unknown' ? card.paymentType : lead.wish?.paymentType,
      termMonths: card.termMonths ?? lead.wish?.termMonths,
      mileagePerYear: card.mileagePerYear ?? lead.wish?.mileagePerYear,
      downPayment: card.downPayment ?? lead.wish?.downPayment,
      desiredPrice: card.desiredPrice ?? lead.wish?.desiredPrice,
    },
    crm: {
      ...(lead.crm ?? {}),
      vehicleConfigurations: nextConfigs,
      cleverOfferTransfer: cleverTransfer,
      reservedModels: [{
        id: card.id,
        modelKey: card.modelKey,
        name: card.modelName,
        trimLabel: card.trimLabel,
        isPrimary: true,
        isFavorite: true,
        source: 'clever-consultation',
      }, ...(lead.crm?.reservedModels ?? []).filter((m) => m.id !== card.id)],
    },
  };
}
