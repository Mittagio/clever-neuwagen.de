/**
 * Clever-Beratung in der Kundenakte – verkäuferfreundliche Zusammenfassung.
 */
import { PAYMENT_TYPES } from '../../data/leadTypes.js';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { CONSULTATION_QUESTIONS } from './cleverSalesAdvisor.js';
import { buildDealerClassicModelUrl } from '../wish/wishUrlService.js';

const KM_MAP = {
  '8000': 8000,
  '12000': 12000,
  '15000': 15000,
  '20000': 20000,
  '25000': 25000,
};

const PAYMENT_ANSWER_LABELS = {
  leasing: 'Leasing',
  finance: 'Finanzierung',
  cash: 'Kauf',
  open: 'Zahlungsart offen',
};

const STATUS_META = {
  complete: {
    id: 'complete',
    label: 'Beratung vollständig',
    tone: 'success',
  },
  partial: {
    id: 'partial',
    label: 'Beratung teilweise',
    tone: 'warn',
  },
  incomplete: {
    id: 'incomplete',
    label: 'Beratung unvollständig',
    tone: 'muted',
  },
};

function optionLabel(questionId, answerId) {
  const question = CONSULTATION_QUESTIONS.find((q) => q.id === questionId);
  return question?.options?.find((o) => o.id === answerId)?.label ?? answerId;
}

/**
 * @param {object} lead
 */
export function extractConsultationFromLead(lead) {
  const consultation = lead?.sonderwuensche?.consultation ?? null;
  if (consultation?.consultationProfile || consultation?.cleverRecommendation) {
    return consultation;
  }
  if (lead?.source === 'dealerJourney' && lead?.inquiryBrief?.searchQuery) {
    return {
      entryMode: 'clever',
      consultationProfile: {
        initialWish: lead.inquiryBrief.searchQuery,
        answers: {},
      },
      cleverRecommendation: lead.inquiryBrief.recommended?.title
        ? {
          vehicleTitle: lead.inquiryBrief.recommended.title,
          modelKey: lead.inquiryBrief.recommended.modelKey,
          trimLabel: lead.inquiryBrief.configuration?.trim ?? null,
          whyLines: [],
        }
        : null,
      consultationHandoff: null,
    };
  }
  return null;
}

/**
 * @param {object} lead
 */
export function hasCleverBeratungData(lead) {
  return Boolean(extractConsultationFromLead(lead));
}

function detectFuelChip(text = '') {
  if (/elektro|e-auto|\bev\b|vollelektr/i.test(text)) return 'Elektro';
  if (/hybrid|plug-in|phev/i.test(text)) return 'Hybrid';
  if (/diesel/i.test(text)) return 'Diesel';
  if (/benzin|verbrenner/i.test(text)) return 'Benziner';
  return null;
}

function buildRequirementChips(lead, consultation) {
  const answers = consultation?.consultationProfile?.answers ?? {};
  const handoff = consultation?.consultationHandoff ?? {};
  const brief = lead?.inquiryBrief ?? {};
  const initialWish = consultation?.consultationProfile?.initialWish
    ?? brief.searchQuery
    ?? '';

  const chips = [];
  const seen = new Set();

  function add(label, id = label) {
    if (!label || seen.has(label)) return;
    seen.add(label);
    chips.push({ id, label });
  }

  const fuel = detectFuelChip(initialWish);
  if (fuel) add(fuel, 'fuel');

  if (answers.paymentType && answers.paymentType !== 'open') {
    add(PAYMENT_ANSWER_LABELS[answers.paymentType], `payment-${answers.paymentType}`);
  } else if (lead?.paymentType && lead.paymentType !== 'unknown') {
    add(PAYMENT_TYPES[lead.paymentType]?.label ?? lead.paymentType, `payment-${lead.paymentType}`);
  } else if (brief.variant?.paymentLabel) {
    add(brief.variant.paymentLabel, 'payment-brief');
  }

  if (answers.annualKm) {
    const km = KM_MAP[answers.annualKm];
    add(km ? `${km.toLocaleString('de-DE')} km/Jahr` : optionLabel('annualKm', answers.annualKm), 'km');
  } else if (lead?.wish?.mileagePerYear) {
    add(`${Number(lead.wish.mileagePerYear).toLocaleString('de-DE')} km/Jahr`, 'km-lead');
  }

  if (answers.monthlyBudget && answers.monthlyBudget !== 'open') {
    add(`Budget ${answers.monthlyBudget} €`, 'budget');
  } else if (brief.budget?.maxMonthly) {
    add(`Budget ${brief.budget.maxMonthly} €`, 'budget-brief');
  } else if (lead?.desiredRate) {
    add(`Budget ${lead.desiredRate} €`, 'budget-rate');
  }

  for (const label of handoff.recognizedWishes ?? []) {
    add(label, `wish-${label}`);
  }

  if (answers.heatPump === 'yes') add('Wärmepumpe', 'heat_pump');
  if (answers.hud === 'yes' || answers.hud === 'nice') add('Head-up-Display', 'hud');
  if (answers.towCapacity && answers.towCapacity !== 'no') add('Anhängelast', 'tow');
  if (answers.trunkImportance === 'high') add('Großer Kofferraum', 'trunk');
  if (answers.rangeImportance === 'high') add('Reichweite wichtig', 'range');
  if (answers.v2l === 'yes') add('V2L', 'v2l');
  if (answers.passengers === '7') add('7 Sitzer', 'seats_7');

  return chips;
}

function buildOpenQuestions(lead, consultation) {
  const answers = consultation?.consultationProfile?.answers ?? {};
  const handoff = consultation?.consultationHandoff ?? {};
  const open = [...(handoff.openQuestions ?? [])];

  if (!answers.paymentType || answers.paymentType === 'open') {
    if (!open.some((q) => /zahlungsart/i.test(q))) open.push('Zahlungsart offen');
  }
  if (!answers.annualKm && !lead?.wish?.mileagePerYear) {
    if (!open.some((q) => /kilometer|km/i.test(q))) open.push('Kilometer pro Jahr offen');
  }
  if ((!answers.monthlyBudget || answers.monthlyBudget === 'open')
    && !lead?.desiredRate
    && !lead?.inquiryBrief?.budget?.maxMonthly) {
    if (!open.some((q) => /budget/i.test(q))) open.push('Budget offen');
  }
  if (!lead?.inquiryBrief?.deliveryLabel && !lead?.wish?.deliveryPreference) {
    if (!open.some((q) => /liefer/i.test(q))) open.push('Lieferzeit offen');
  }

  return [...new Set(open.filter(Boolean))];
}

function resolvePriceLine(lead, consultation) {
  const brief = lead?.inquiryBrief ?? {};
  if (brief.variant?.priceLabel) return brief.variant.priceLabel;
  if (lead?.desiredRate) return `ca. ${lead.desiredRate} € / Monat`;
  if (brief.budget?.label) return brief.budget.label;
  const budget = consultation?.consultationProfile?.answers?.monthlyBudget;
  if (budget && budget !== 'open') return `bis ${budget} € / Monat`;
  return null;
}

function buildRecommendationSummary(recommendation, whyLines = []) {
  if (!recommendation?.vehicleTitle) return null;
  const reasons = (whyLines.length ? whyLines : recommendation.whyLines ?? [])
    .slice(0, 3)
    .map((line) => line.replace(/^erfüllt\s+/i, '').replace(/\.$/, ''))
    .join(', ');
  if (!reasons) {
    return `${recommendation.vehicleTitle} empfohlen – passt zu den Kundenangaben.`;
  }
  return `${recommendation.vehicleTitle} empfohlen, weil ${reasons}.`;
}

function computeConsultationStatus(lead, consultation, requirementChips, openQuestions) {
  const answers = consultation?.consultationProfile?.answers ?? {};
  const answeredCount = Object.keys(answers).length;
  const hasRecommendation = Boolean(
    consultation?.cleverRecommendation?.vehicleTitle
    || lead?.inquiryBrief?.recommended?.title,
  );
  const hasWish = Boolean(consultation?.consultationProfile?.initialWish || lead?.inquiryBrief?.searchQuery);

  if (!hasWish) return STATUS_META.incomplete;

  if (hasRecommendation && openQuestions.length === 0 && answeredCount >= 4) {
    return STATUS_META.complete;
  }
  if (hasRecommendation || answeredCount >= 2 || requirementChips.length >= 3) {
    return STATUS_META.partial;
  }
  return STATUS_META.incomplete;
}

function resolveModelKey(lead, consultation) {
  return consultation?.cleverRecommendation?.modelKey
    ?? lead?.inquiryBrief?.recommended?.modelKey
    ?? lead?.vehicle?.model?.toLowerCase?.()
    ?? null;
}

function resolveBatteryLabel(lead, consultation, modelKey) {
  const attrs = modelKey ? KIA_MODEL_ATTRIBUTES[modelKey] : null;
  if (attrs?.fuel !== 'electric') {
    return lead?.inquiryBrief?.configuration?.powertrain
      ?? lead?.vehicle?.engine
      ?? null;
  }
  const title = consultation?.cleverRecommendation?.vehicleTitle ?? '';
  const match = title.match(/(\d+)\s*kwh/i);
  if (match) return `${match[1]} kWh`;
  return lead?.inquiryBrief?.configuration?.powertrain ?? 'Elektro';
}

/**
 * @param {object} lead
 */
export function buildCleverBeratungAkteView(lead) {
  const consultation = extractConsultationFromLead(lead);
  if (!consultation) return null;

  const profile = consultation.consultationProfile ?? {};
  const recommendation = consultation.cleverRecommendation ?? null;
  const brief = lead?.inquiryBrief ?? {};
  const modelKey = resolveModelKey(lead, consultation);
  const requirementChips = buildRequirementChips(lead, consultation);
  const openQuestions = buildOpenQuestions(lead, consultation);
  const status = computeConsultationStatus(lead, consultation, requirementChips, openQuestions);

  const vehicleTitle = recommendation?.vehicleTitle
    ?? brief.recommended?.title
    ?? (lead?.vehicle?.label?.trim() || null);

  const trimLabel = recommendation?.trimLabel
    ?? brief.configuration?.trim
    ?? lead?.vehicle?.trim
    ?? null;

  const modelLabel = modelKey
    ? (KIA_MODEL_ATTRIBUTES[modelKey]?.label ?? modelKey)
    : (vehicleTitle?.replace(/^Kia\s+/i, '').split(' ')[0] ?? null);

  const whyLines = recommendation?.whyLines?.length
    ? recommendation.whyLines
    : (brief.recommended?.title && consultation.consultationHandoff?.lines
      ?.find((l) => l.label === 'Gründe')?.value?.split(' · ') ?? []);

  const dealerSlug = lead?.dealerId ?? 'autohaus-trinkle';

  return {
    status,
    customerWish: profile.initialWish ?? brief.searchQuery ?? lead?.notes?.split('\n')[0] ?? '',
    requirementChips,
    recommendation: {
      vehicleTitle,
      modelKey,
      modelLabel,
      trimLabel,
      batteryOrMotor: resolveBatteryLabel(lead, consultation, modelKey),
      priceLine: resolvePriceLine(lead, consultation),
      summarySentence: buildRecommendationSummary(
        { vehicleTitle, whyLines },
        whyLines,
      ),
      whyLines,
      alternatives: recommendation?.alternatives ?? [],
      cleverQuotePercent: lead?.cleverQuotePercent ?? brief.cleverQuotePercent ?? null,
    },
    openQuestions,
    configuratorUrl: modelKey
      ? buildDealerClassicModelUrl(modelKey, { dealerSlug })
      : null,
    entryMode: consultation.entryMode ?? 'clever',
    answeredCount: Object.keys(profile.answers ?? {}).length,
  };
}
