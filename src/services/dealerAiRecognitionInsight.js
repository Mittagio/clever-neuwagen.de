/**
 * Clever KI-Check – strukturierte Erkennung aus Freitext vor Bestätigung.
 */
import { joinKundenhelferNotes } from './cleverKundenhelfer.js';
import {
  PAYMENT_TYPE_LABELS,
  parseBatteryPowerFromText,
  parseBudgetMaxFromText,
  parseColorPreferenceFromText,
  parseCustomerAddressFromText,
  parseCustomerEmail,
  parseCustomerName,
  parseCustomerPhone,
  parseModelHintFromText,
  parseStructuredCustomerName,
  parseUsedVehicleHint,
  parseWishDateFromText,
} from './dealerAiParser.js';
import { hasRecognizedModelKey } from './dealerAiVehicleConfigureFlow.js';
import { applyDealerAiFields } from './dealerAiParser.js';
import { organizeInquiryText } from './dealer/notepadLabelSuggestions.js';

const SAMPLE_TEXT = 'Kunde Stefan Wiens fährt aktuell einen 12 Jahre alten VW Golf, hat 2 Kinder, fährt oft nach Südtirol, möchte gerne Hybrid oder Plug-in-Hybrid, braucht 1.200 kg Anhängelast und bevorzugt ein schwarzes Auto.';

function splitCustomerName(full) {
  if (full == null || full === '') return { firstName: null, lastName: null };
  const trimmed = String(full).trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') {
    return { firstName: null, lastName: null };
  }
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
  return parseColorPreferenceFromText(text);
}

function parseCurrentVehicle(text = '') {
  const match = String(text).match(
    /(?:fährt|faehrt)\s+aktuell\s+(?:einen?\s+)?(?:(\d+)\s+jahre?\s+alten?\s+)?((?:vw\s+)?golf|[a-zäöüß]+\s+[a-zäöüß0-9]+)/i,
  );
  if (match) {
    const ageYears = match[1] ? Number(match[1]) : null;
    let label = match[2]?.trim() ?? null;
    if (label && !/^vw/i.test(label) && /golf/i.test(label)) label = `VW ${label}`;
    return { label, ageYears };
  }

  for (const line of splitLines(text)) {
    const brandLine = line.match(/^(audi|bmw|mercedes|vw|volkswagen|opel|ford|skoda|seat|porsche|toyota|hyundai)\s+([a-z0-9][a-z0-9\s-]*)/i);
    if (brandLine && !/ev\d|leasing|kia/i.test(line)) {
      const label = `${brandLine[1]} ${brandLine[2]}`.trim().replace(/\s+/g, ' ');
      return { label, ageYears: null };
    }
  }

  return { label: null, ageYears: null };
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

function splitLines(text = '') {
  return String(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function extractStructuredHelperNotes(text = '', fields = {}) {
  const notes = [];
  const lines = splitLines(text);
  const customerName = fields.customerName ?? parseCustomerName(text);
  const phone = fields.customerPhone ?? parseCustomerPhone(text);
  const email = fields.customerEmail ?? parseCustomerEmail(text);
  const phoneDigits = phone?.replace(/\D/g, '') ?? '';

  for (const line of lines) {
    if (customerName && line === customerName) continue;
    if (email && line.toLowerCase() === email.toLowerCase()) continue;
    if (phoneDigits && line.replace(/\D/g, '').includes(phoneDigits.slice(-8))) continue;

    if (/e[\s-]?soul\s+gw/i.test(line)) {
      uniquePush(notes, 'E-Soul Gebrauchtwagen');
      const wishDate = parseWishDateFromText(line);
      if (wishDate) uniquePush(notes, `Wunschtermin ${wishDate.label}`);
      continue;
    }
    if (/^bis\s+[\d.\s]+\s*€/i.test(line)) {
      uniquePush(notes, `Budget ${line}`);
      continue;
    }
    if (/^keine\s+förderung/i.test(line)) {
      uniquePush(notes, 'keine Förderung');
      continue;
    }
    if (/^wohnmobil$/i.test(line)) {
      uniquePush(notes, 'Wohnmobil');
      continue;
    }
    if (/^\d+\s*k(?:w|wh)\s*batterie/i.test(line)) {
      uniquePush(notes, line.replace(/\s+/g, ' '));
      continue;
    }
    if (/^farbe\s+/i.test(line)) {
      uniquePush(notes, line);
      continue;
    }
    if (/^ledig$/i.test(line)) {
      uniquePush(notes, 'ledig');
      continue;
    }
    if (/^keine\s+kinder$/i.test(line)) {
      uniquePush(notes, 'keine Kinder');
      continue;
    }
    if (/corporate\s*benefits?/i.test(line)) {
      uniquePush(notes, 'Corporate Benefits');
      continue;
    }
    if (/^(audi|bmw|mercedes|vw|volkswagen|opel|ford|skoda|seat|porsche)\s+[a-z0-9][a-z0-9\s-]*$/i.test(line)) {
      uniquePush(notes, `fährt aktuell ${line}`);
      continue;
    }
  }

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
  if (vehicleWish.modelLabel) labels.push(vehicleWish.modelLabel);
  if (vehicleWish.vehicleType) labels.push(vehicleWish.vehicleType);
  if (vehicleWish.batteryLabel) labels.push(vehicleWish.batteryLabel);
  if (vehicleWish.budget) {
    labels.push(`Budget bis ${Number(vehicleWish.budget).toLocaleString('de-DE')} €`);
  }
  return labels;
}

function buildRecommendation(parsed, vehicleWish = {}, text = '') {
  const modelHint = vehicleWish.modelKey ?? vehicleWish.modelHint;
  const suggestions = parsed?.suggestedModels ?? [];
  const fuels = vehicleWish.fuelTypes ?? [];
  const wantsHybrid = fuels.some((f) => /hybrid/i.test(f));
  const wantsTrailer = (vehicleWish.trailerLoadMinKg ?? 0) >= 1200;

  let primary = suggestions.find((m) => (m.modelKey ?? m.id) === modelHint)
    ?? suggestions.find((m) => (m.modelKey ?? m.id) === 'sportage')
    ?? suggestions.find((m) => wantsHybrid && /hybrid/i.test(m.reason ?? m.badge ?? ''))
    ?? suggestions[0];

  if (!primary && modelHint === 'esoul') {
    primary = {
      modelKey: 'esoul',
      name: 'Kia e-Soul',
    };
  }

  if (!primary && modelHint === 'ev3') {
    primary = {
      modelKey: 'ev3',
      name: vehicleWish.trimLabel ? `Kia EV3 ${vehicleWish.trimLabel}` : 'Kia EV3',
    };
  }

  if (!primary && wantsHybrid) {
    primary = {
      modelKey: 'sportage',
      name: 'Kia Sportage Hybrid / Plug-in-Hybrid',
    };
  }

  if (!primary) return null;

  const reasonBullets = [];
  if (vehicleWish.vehicleType) reasonBullets.push(`passt zu ${vehicleWish.vehicleType}`);
  if (vehicleWish.familyNeeds) reasonBullets.push('passt zu Familie');
  if (vehicleWish.currentVehicle) {
    reasonBullets.push(`bietet mehr Platz als ${vehicleWish.currentVehicle}`);
  }
  if (vehicleWish.trailerLoadMinKg) reasonBullets.push('Anhängelast relevant');
  if (/südtirol|urlaub|langstrecke/i.test(text)) {
    reasonBullets.push('gut für Urlaubsfahrten / Südtirol');
  }
  if (wantsHybrid) reasonBullets.push('Hybrid / Plug-in-Hybrid wurde genannt');
  if (vehicleWish.colorPreference) reasonBullets.push(`Farbe ${vehicleWish.colorPreference} wurde genannt`);
  if (vehicleWish.budget) reasonBullets.push('Budget im Wunschbereich');
  if (!reasonBullets.length) reasonBullets.push('möglicher Fahrzeugwunsch erkannt');

  const alternatives = [];
  if (wantsTrailer || vehicleWish.familyNeeds) {
    alternatives.push({ modelKey: 'sorento', modelLabel: 'Kia Sorento Plug-in-Hybrid' });
  }

  let modelLabel = primary.name ?? 'Kia Sportage Hybrid / Plug-in-Hybrid';
  if (vehicleWish.trimLabel && !modelLabel.toLowerCase().includes(String(vehicleWish.trimLabel).toLowerCase())) {
    modelLabel = `${modelLabel} ${vehicleWish.trimLabel}`;
  }

  return {
    modelKey: primary.modelKey ?? primary.id ?? null,
    modelLabel,
    reasonBullets,
    alternatives,
    status: 'prüfen',
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

  const structuredName = parseStructuredCustomerName(text);
  const fullName = structuredName?.fullName
    ?? parseCustomerName(text)
    ?? (fields.customerName ? String(fields.customerName).trim() : null);
  const firstName = structuredName?.firstName ?? splitCustomerName(fullName).firstName;
  const lastName = structuredName?.lastName ?? splitCustomerName(fullName).lastName;
  const phone = parseCustomerPhone(text) ?? fields.customerPhone ?? null;
  const email = parseCustomerEmail(text) ?? fields.customerEmail ?? null;
  const address = parseCustomerAddressFromText(text)
    ?? (fields.customerAddress ? { formatted: fields.customerAddress } : null);

  const modelHint = parseModelHintFromText(text);
  const wishDate = parseWishDateFromText(text);
  const budget = parseBudgetMaxFromText(text)
    || (Number(fields.desiredPrice) > 0 ? Number(fields.desiredPrice) : null);
  const batteryPower = parseBatteryPowerFromText(text) ?? fields.batteryKwh ?? null;
  const batteryLabel = batteryPower != null ? `${batteryPower} kW Batterie` : fields.batteryLabel ?? null;
  const usedVehicle = parseUsedVehicleHint(text) || Boolean(modelHint?.used);

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
    modelHint: modelHint?.model ?? fields.model ?? null,
    modelKey: modelHint?.modelKey ?? fields.modelId ?? null,
    modelLabel: modelHint
      ? `Kia ${modelHint.model}${fields.trimLabel ? ` ${fields.trimLabel}` : ''}`
      : (fields.model ? `Kia ${fields.model}${fields.trimLabel ? ` ${fields.trimLabel}` : ''}` : null),
    trimLabel: fields.trimLabel ?? null,
    trimId: fields.trimId ?? null,
    vehicleType: usedVehicle ? 'Gebrauchtwagen' : null,
    battery: batteryPower,
    batteryLabel,
    budget,
    desiredDate: wishDate?.iso ?? null,
    desiredDateLabel: wishDate?.label ?? null,
    labels: [],
  };
  vehicleWish.labels = buildVehicleWishLabels(vehicleWish);

  let paymentType = fields.paymentType && fields.paymentType !== 'unknown'
    ? fields.paymentType
    : (budget ? 'cash' : 'unknown');
  const organizedLabels = organizeInquiryText(text);
  if (paymentType === 'unknown' && organizedLabels.some((label) => /leasing/i.test(label))) {
    paymentType = 'leasing';
  }
  const deliveryLabel = fields.desiredDeliveryDate
    ?? wishDate?.label
    ?? fields.deliveryTime
    ?? null;
  const monthlyFromOrganized = organizedLabels
    .map((label) => label.match(/^Budget bis\s+(\d+)\s*€$/i)?.[1])
    .find(Boolean);
  const desiredRate = fields.desiredRate
    ?? (monthlyFromOrganized ? Number(monthlyFromOrganized) : null);
  const downPayment = fields.downPayment
    ?? (organizedLabels.some((label) => /0\s*€\s*Anzahlung/i.test(label)) ? 0 : null);
  const paymentWish = {
    paymentType,
    paymentLabel: PAYMENT_TYPE_LABELS[paymentType] ?? 'noch offen',
    budget,
    desiredRate: Number.isFinite(desiredRate) ? desiredRate : null,
    termMonths: fields.termMonths ?? null,
    mileagePerYear: fields.mileagePerYear ?? null,
    downPayment,
    desiredDeliveryDate: deliveryLabel,
    specialCondition: /corporate\s*benefits?/i.test(text) ? 'corporate_benefits' : null,
  };

  const narrativeNotes = extractCustomerHelperNotes(text, fields);
  const structuredNotes = extractStructuredHelperNotes(text, {
    ...fields,
    customerName: fullName,
    customerPhone: phone,
    customerEmail: email,
  });
  const customerHelperNotes = [];
  for (const note of [...narrativeNotes, ...structuredNotes]) uniquePush(customerHelperNotes, note);

  // Verkaufsassistent „Anfrage einfügen“: Mail/Text → organisierte Notizzettel-Chips
  for (const label of organizedLabels) uniquePush(customerHelperNotes, label);
  for (const label of organizedLabels) {
    if (/sitzheizung|parksensor|heckklappe|lenkrad|kamera|anhänger|panorama|keyless|wärmepumpe|head-up|totwinkel|spurhalte|tempomat/i.test(label)) {
      uniquePush(vehicleWish.labels, label);
    }
  }

  const recommendation = buildRecommendation(parsed, vehicleWish, text);

  return {
    sourceText: text,
    customer: {
      firstName,
      lastName,
      phone,
      email,
      displayName: fullName,
      address,
      addressFormatted: address?.formatted ?? fields.customerAddress ?? null,
    },
    customerHelperNotes,
    organizedLabels,
    vehicleWish,
    paymentWish,
    recommendation,
    confidence: {
      customer: Math.max(
        scorePresence(fullName),
        scorePresence(phone),
        scorePresence(email),
        structuredName?.confidence ?? 0,
      ),
      vehicle: Math.max(
        scorePresence(bodyType),
        scorePresence(fuelTypes),
        scorePresence(trailerLoadMinKg),
        scorePresence(colorPreference),
        scorePresence(modelHint),
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
    board: [],
  };

  const name = [insight.customer?.firstName, insight.customer?.lastName]
    .filter((part) => part && part !== 'null' && part !== 'undefined')
    .join(' ');
  if (name) buckets.customer.push(name);
  if (insight.customer?.phone) buckets.customer.push(insight.customer.phone);
  if (insight.customer?.email) buckets.customer.push(insight.customer.email);

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
  if (payment?.desiredRate) {
    buckets.paymentWish.push(`bis ${Number(payment.desiredRate).toLocaleString('de-DE')} €/Monat`);
  }
  if (payment?.budget) {
    buckets.paymentWish.push(`Budget bis ${Number(payment.budget).toLocaleString('de-DE')} €`);
  }
  if (payment?.termMonths) buckets.paymentWish.push(`${payment.termMonths} Monate`);
  if (payment?.mileagePerYear) {
    buckets.paymentWish.push(`${Number(payment.mileagePerYear).toLocaleString('de-DE')} km/Jahr`);
  }
  if (payment?.downPayment === 0) buckets.paymentWish.push('0 € Anzahlung');

  const rec = insight.recommendation;
  if (rec?.modelLabel) buckets.recommendation.push(rec.modelLabel);
  if (rec?.modelLabel) buckets.board.push(rec.modelLabel);
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
    customerAddress: insight.customer?.addressFormatted ?? parsed.fields?.customerAddress ?? null,
    addressStreet: insight.customer?.address?.street ?? parsed.fields?.addressStreet ?? null,
    addressHouseNumber: insight.customer?.address?.houseNumber ?? parsed.fields?.addressHouseNumber ?? null,
    addressPostalCode: insight.customer?.address?.postalCode ?? parsed.fields?.addressPostalCode ?? null,
    addressCity: insight.customer?.address?.city ?? parsed.fields?.addressCity ?? null,
    bodyType: insight.vehicleWish?.bodyType ?? parsed.fields?.bodyType,
    colorLabel: insight.vehicleWish?.colorPreference ?? parsed.fields?.colorLabel,
    paymentType: insight.paymentWish?.paymentType ?? parsed.fields?.paymentType,
    termMonths: insight.paymentWish?.termMonths ?? parsed.fields?.termMonths,
    mileagePerYear: insight.paymentWish?.mileagePerYear ?? parsed.fields?.mileagePerYear,
    downPayment: insight.paymentWish?.downPayment ?? parsed.fields?.downPayment,
    desiredRate: insight.paymentWish?.desiredRate
      ?? (insight.paymentWish?.paymentType !== 'cash'
        ? parsed.fields?.desiredRate ?? null
        : parsed.fields?.desiredRate),
    desiredPrice: insight.paymentWish?.paymentType === 'cash'
      ? insight.paymentWish?.budget ?? parsed.fields?.desiredPrice
      : parsed.fields?.desiredPrice,
    desiredDeliveryDate: insight.paymentWish?.desiredDeliveryDate
      ?? insight.vehicleWish?.desiredDateLabel
      ?? parsed.fields?.desiredDeliveryDate,
    trimLabel: parsed.fields?.trimLabel ?? insight.vehicleWish?.trimLabel ?? null,
    trimId: parsed.fields?.trimId ?? insight.vehicleWish?.trimId ?? null,
    rawText: insight.sourceText ?? parsed.fields?.rawText,
  };

  const modelKey = insight.recommendation?.modelKey ?? insight.vehicleWish?.modelKey;
  if (modelKey && !parsed.fields?.modelId) {
    const modelName = modelKey === 'sportage' ? 'Sportage'
      : modelKey === 'sorento' ? 'Sorento'
        : modelKey === 'esoul' ? 'e-Soul'
          : modelKey === 'ev3' ? 'EV3'
            : insight.vehicleWish?.modelHint ?? modelKey;
    fieldPatch.modelId = modelKey;
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
