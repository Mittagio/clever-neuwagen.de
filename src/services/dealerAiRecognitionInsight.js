/**
 * Clever KI-Check – strukturierte Erkennung aus Freitext vor Bestätigung.
 */
import { joinKundenhelferNotes } from './cleverKundenhelfer.js';
import {
  PAYMENT_TYPE_LABELS,
  parseCustomerEmail,
  parseCustomerName,
  parseCustomerPhone,
} from './dealerAiParser.js';
import { hasRecognizedModelKey } from './dealerAiVehicleConfigureFlow.js';
import { applyDealerAiFields } from './dealerAiParser.js';

const SAMPLE_TEXT = 'Kunde Stefan Wiens fährt aktuell einen 12 Jahre alten VW Golf, hat 2 Kinder, fährt oft nach Südtirol, möchte gerne Hybrid oder Plug-in-Hybrid, braucht 1.200 kg Anhängelast und bevorzugt ein schwarzes Auto.';

function splitCustomerName(full = '') {
  const trimmed = String(full).trim();
  if (!trimmed) return { firstName: null, lastName: null };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function parseTrailerLoadKg(text = '') {
  const normalized = String(text).replace(/\./g, '');
  const match = normalized.match(/([\d,]+)\s*kg\s*anhängelast/i)
    ?? normalized.match(/anhängelast\s*(?:mindestens\s*)?([\d,]+)\s*kg/i)
    ?? normalized.match(/([\d,]+)\s*kg\s*(?:anhängelast|zuglast)/i);
  if (!match) return null;
  const value = Number(match[1].replace(',', '.'));
  return Number.isFinite(value) ? Math.round(value) : null;
}

function parseFuelTypes(text = '') {
  const lower = String(text).toLowerCase();
  const types = [];
  if (/plug[\s-]?in[\s-]?hybrid|phev/i.test(lower)) types.push('Plug-in-Hybrid');
  if (/\bhybrid\b/i.test(lower)) types.push('Hybrid');
  if (/\belektro\b|\bev\b/i.test(lower)) types.push('Elektro');
  if (/\bbenzin\b/i.test(lower)) types.push('Benzin');
  if (/\bdiesel\b/i.test(lower)) types.push('Diesel');
  return [...new Set(types)];
}

function parseColorPreference(text = '') {
  const lower = String(text).toLowerCase();
  if (/schwarz(?:es)?\s+auto|auto\s+schwarz|farbe\s+schwarz/i.test(lower)) return 'schwarz';
  if (/weiß(?:es)?\s+auto|auto\s+weiß/i.test(lower)) return 'weiß';
  if (/grau(?:es)?\s+auto/i.test(lower)) return 'grau';
  if (/rot(?:es)?\s+auto/i.test(lower)) return 'rot';
  return null;
}

function parseCurrentVehicle(text = '') {
  const match = String(text).match(
    /(?:fährt|faehrt)\s+aktuell\s+(?:einen?\s+)?(?:(\d+)\s+jahre?\s+alten?\s+)?((?:vw\s+)?golf|[a-zäöüß]+\s+[a-zäöüß0-9]+)/i,
  );
  if (!match) return { label: null, ageYears: null };
  const ageYears = match[1] ? Number(match[1]) : null;
  let label = match[2]?.trim() ?? null;
  if (label && !/^vw/i.test(label) && /golf/i.test(label)) label = `VW ${label}`;
  return { label, ageYears };
}

function uniquePush(list, value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return list;
  if (!list.includes(trimmed)) list.push(trimmed);
  return list;
}

export function extractCustomerHelperNotes(text = '', fields = {}) {
  const notes = [];
  const raw = String(text);

  const kinder = raw.match(/(\d+)\s*kinder/i);
  if (kinder) uniquePush(notes, `${kinder[1]} Kinder`);

  const { label: currentVehicle, ageYears } = parseCurrentVehicle(raw);
  if (currentVehicle) uniquePush(notes, `fährt aktuell ${currentVehicle}`);
  if (ageYears) uniquePush(notes, `${currentVehicle ?? 'Fahrzeug'} ca. ${ageYears} Jahre alt`);

  if (/südtirol|suedtirol/i.test(raw)) uniquePush(notes, 'fährt oft nach Südtirol');
  if (parseColorPreference(raw)) uniquePush(notes, `bevorzugt ${parseColorPreference(raw)}es Auto`);

  const trailer = parseTrailerLoadKg(raw);
  if (trailer) uniquePush(notes, `Anhängelast ${trailer.toLocaleString('de-DE')} kg wichtig`);

  if (kinder || /familie|familienauto/i.test(raw)) uniquePush(notes, 'Familienauto');
  if (/südtirol|urlaub|langstrecke|reise/i.test(raw)) uniquePush(notes, 'Urlaub / Langstrecke');

  const fuels = parseFuelTypes(raw);
  if (fuels.includes('Hybrid')) uniquePush(notes, 'Hybrid interessiert');
  if (fuels.includes('Plug-in-Hybrid')) uniquePush(notes, 'Plug-in-Hybrid interessiert');

  if (fields.leasingEndDate) uniquePush(notes, `Leasing läuft aus (${fields.leasingEndDate})`);
  if (fields.vehicleChangeIntent) uniquePush(notes, 'Fahrzeugwechsel geplant');

  return notes;
}

function buildVehicleWishLabels(vehicleWish = {}) {
  const labels = [];
  if (vehicleWish.bodyType) labels.push(vehicleWish.bodyType);
  if (vehicleWish.fuelTypes?.length) labels.push(vehicleWish.fuelTypes.join(' / '));
  if (vehicleWish.trailerLoadMinKg) {
    labels.push(`Anhängelast mindestens ${vehicleWish.trailerLoadMinKg.toLocaleString('de-DE')} kg`);
  }
  if (vehicleWish.colorPreference) labels.push(`${vehicleWish.colorPreference}es Fahrzeug`);
  if (vehicleWish.usageProfile) labels.push(vehicleWish.usageProfile);
  if (vehicleWish.currentVehicle) labels.push(`${vehicleWish.currentVehicle}-Nachfolger`);
  if (vehicleWish.familyNeeds) labels.push('familiengeeignet');
  return labels;
}

function buildRecommendation(parsed, vehicleWish = {}, text = '') {
  const suggestions = parsed?.suggestedModels ?? [];
  const fuels = vehicleWish.fuelTypes ?? [];
  const wantsHybrid = fuels.some((f) => /hybrid/i.test(f));
  const wantsTrailer = (vehicleWish.trailerLoadMinKg ?? 0) >= 1200;

  let primary = suggestions.find((m) => (m.modelKey ?? m.id) === 'sportage')
    ?? suggestions.find((m) => wantsHybrid && /hybrid/i.test(m.reason ?? m.badge ?? ''))
    ?? suggestions[0];

  if (!primary && wantsHybrid) {
    primary = {
      modelKey: 'sportage',
      name: 'Kia Sportage Hybrid / Plug-in-Hybrid',
    };
  }

  if (!primary) return null;

  const reasonBullets = [];
  if (vehicleWish.familyNeeds) reasonBullets.push('passt zu Familie');
  if (vehicleWish.currentVehicle) {
    reasonBullets.push(`bietet mehr Platz als ${vehicleWish.currentVehicle}`);
  }
  if (vehicleWish.trailerLoadMinKg) reasonBullets.push('Anhängelast relevant');
  if (/südtirol|urlaub|langstrecke/i.test(text)) {
    reasonBullets.push('gut für Urlaubsfahrten / Südtirol');
  }
  if (wantsHybrid) reasonBullets.push('Hybrid / Plug-in-Hybrid wurde genannt');

  const alternatives = [];
  if (wantsTrailer || vehicleWish.familyNeeds) {
    alternatives.push({ modelKey: 'sorento', modelLabel: 'Kia Sorento Plug-in-Hybrid' });
  }

  return {
    modelKey: primary.modelKey ?? primary.id ?? null,
    modelLabel: primary.name ?? 'Kia Sportage Hybrid / Plug-in-Hybrid',
    reasonBullets,
    alternatives,
  };
}

function scorePresence(value) {
  if (value == null) return 0;
  if (Array.isArray(value)) return value.length ? 0.85 : 0;
  if (typeof value === 'string') return value.trim() ? 0.85 : 0;
  if (typeof value === 'number') return Number.isFinite(value) ? 0.9 : 0;
  if (typeof value === 'boolean') return value ? 0.8 : 0;
  return 0.7;
}

/**
 * @param {string} sourceText
 * @param {object} parsed – Ergebnis von parseDealerAiInput + enrich
 */
export function buildCustomerRecognitionInsight(sourceText = '', parsed = {}) {
  const text = String(sourceText ?? parsed?.fields?.rawText ?? '').trim();
  const fields = parsed?.fields ?? {};

  const fullName = parseCustomerName(text)
    ?? (fields.customerName ? String(fields.customerName).trim() : null);
  const { firstName, lastName } = splitCustomerName(fullName);
  const phone = parseCustomerPhone(text) ?? fields.customerPhone ?? null;
  const email = parseCustomerEmail(text) ?? fields.customerEmail ?? null;

  const { label: currentVehicle, ageYears } = parseCurrentVehicle(text);
  const trailerLoadMinKg = parseTrailerLoadKg(text);
  const fuelTypes = parseFuelTypes(text);
  const colorPreference = parseColorPreference(text);
  const hasKids = /(\d+)\s*kinder/i.test(text);
  const usageProfile = /südtirol|urlaub|langstrecke|reise/i.test(text) ? 'Urlaub / Langstrecke' : null;

  let bodyType = fields.bodyType ?? null;
  if (!bodyType && (hasKids || trailerLoadMinKg || /suv/i.test(text))) bodyType = 'SUV';

  const vehicleWish = {
    bodyType,
    fuelTypes,
    trailerLoadMinKg,
    colorPreference,
    usageProfile,
    currentVehicle,
    familyNeeds: Boolean(hasKids || /familienauto|familie/i.test(text)),
    labels: [],
  };
  vehicleWish.labels = buildVehicleWishLabels(vehicleWish);

  const paymentType = fields.paymentType ?? 'unknown';
  const paymentWish = {
    paymentType,
    paymentLabel: PAYMENT_TYPE_LABELS[paymentType] ?? 'noch offen',
    budget: fields.desiredRate ?? fields.desiredPrice ?? null,
    termMonths: fields.termMonths ?? null,
    mileagePerYear: fields.mileagePerYear ?? null,
    downPayment: fields.downPayment ?? null,
    desiredDeliveryDate: fields.desiredDeliveryDate ?? fields.deliveryTime ?? null,
  };

  const customerHelperNotes = extractCustomerHelperNotes(text, fields);
  const recommendation = buildRecommendation(parsed, vehicleWish, text);

  return {
    sourceText: text,
    customer: {
      firstName,
      lastName,
      phone,
      email,
      displayName: fullName,
    },
    customerHelperNotes,
    vehicleWish,
    paymentWish,
    recommendation,
    confidence: {
      customer: Math.max(scorePresence(fullName), scorePresence(phone), scorePresence(email)),
      vehicle: Math.max(
        scorePresence(bodyType),
        scorePresence(fuelTypes),
        scorePresence(trailerLoadMinKg),
        scorePresence(colorPreference),
      ),
      payment: paymentType !== 'unknown' ? 0.85 : 0.2,
      recommendation: recommendation ? 0.75 : 0.15,
    },
  };
}

export function buildRecognitionAnimationBuckets(insight = {}) {
  const buckets = {
    customer: [],
    customerHelperNotes: [],
    vehicleWish: [],
    paymentWish: [],
    recommendation: [],
  };

  const name = [insight.customer?.firstName, insight.customer?.lastName].filter(Boolean).join(' ');
  if (name) buckets.customer.push(name);

  for (const note of insight.customerHelperNotes ?? []) {
    buckets.customerHelperNotes.push(note);
  }

  for (const label of insight.vehicleWish?.labels ?? []) {
    buckets.vehicleWish.push(label);
  }

  const payment = insight.paymentWish;
  if (payment?.paymentLabel && payment.paymentLabel !== 'noch offen') {
    buckets.paymentWish.push(payment.paymentLabel);
  }
  if (payment?.budget) buckets.paymentWish.push(String(payment.budget));

  const rec = insight.recommendation;
  if (rec?.modelLabel) buckets.recommendation.push(rec.modelLabel);
  for (const alt of rec?.alternatives ?? []) {
    if (alt.modelLabel) buckets.recommendation.push(alt.modelLabel);
  }

  return buckets;
}

export function applyRecognitionInsightToParsed(parsed, insight) {
  if (!parsed?.ok || !insight) return parsed;

  const displayName = [insight.customer?.firstName, insight.customer?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  const fieldPatch = {
    customerName: displayName || parsed.fields?.customerName || null,
    customerPhone: insight.customer?.phone ?? parsed.fields?.customerPhone ?? null,
    customerEmail: insight.customer?.email ?? parsed.fields?.customerEmail ?? null,
    bodyType: insight.vehicleWish?.bodyType ?? parsed.fields?.bodyType,
    colorLabel: insight.vehicleWish?.colorPreference ?? parsed.fields?.colorLabel,
    paymentType: insight.paymentWish?.paymentType ?? parsed.fields?.paymentType,
    termMonths: insight.paymentWish?.termMonths ?? parsed.fields?.termMonths,
    mileagePerYear: insight.paymentWish?.mileagePerYear ?? parsed.fields?.mileagePerYear,
    downPayment: insight.paymentWish?.downPayment ?? parsed.fields?.downPayment,
    desiredRate: insight.paymentWish?.paymentType !== 'cash'
      ? insight.paymentWish?.budget ?? parsed.fields?.desiredRate
      : parsed.fields?.desiredRate,
    desiredPrice: insight.paymentWish?.paymentType === 'cash'
      ? insight.paymentWish?.budget ?? parsed.fields?.desiredPrice
      : parsed.fields?.desiredPrice,
    desiredDeliveryDate: insight.paymentWish?.desiredDeliveryDate ?? parsed.fields?.desiredDeliveryDate,
    rawText: insight.sourceText ?? parsed.fields?.rawText,
  };

  if (insight.recommendation?.modelKey && !parsed.fields?.modelId) {
    const key = insight.recommendation.modelKey;
    const modelName = key === 'sportage' ? 'Sportage' : key === 'sorento' ? 'Sorento' : key;
    fieldPatch.modelId = key;
    fieldPatch.model = modelName;
    fieldPatch.brand = 'Kia';
  }

  return {
    ...applyDealerAiFields(parsed, fieldPatch),
    customerHelperNotes: [...(insight.customerHelperNotes ?? [])],
    sourceText: insight.sourceText ?? parsed.sourceText ?? null,
    recognitionInsight: insight,
  };
}

export function hasMeaningfulVehicleWish(insight = {}) {
  const vw = insight.vehicleWish ?? {};
  return Boolean(
    vw.bodyType
    || vw.fuelTypes?.length
    || vw.trailerLoadMinKg
    || vw.colorPreference
    || vw.usageProfile
    || vw.labels?.length,
  );
}

export function resolvePhaseAfterRecognitionConfirm(insight, parsed) {
  if (hasRecognizedModelKey(parsed)) return 'configure';
  if (hasMeaningfulVehicleWish(insight)) return 'advice';
  return 'akte';
}

export function getKundenhelferNotesFromParsed(parsed) {
  const notes = parsed?.customerHelperNotes ?? parsed?.recognitionInsight?.customerHelperNotes ?? [];
  return joinKundenhelferNotes(notes);
}

export const RECOGNITION_SAMPLE_TEXT = SAMPLE_TEXT;
