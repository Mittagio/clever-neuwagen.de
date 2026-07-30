/**
 * Homepage-Kundenanfrage → commercialScenarios (Epic 2).
 * Parse only – Persistenz erst nach Seller-Review „Übernehmen“.
 */
import {
  COMMERCIAL_CUSTOMER_TYPE,
  COMMERCIAL_SCENARIO_SOURCE,
  COMMERCIAL_SCENARIO_TYPE,
  formatCommercialScenarioChip,
  formatCustomerTypeLabel,
  normalizeCommercialScenario,
  setCommercialScenariosOnLead,
} from './commercialScenarios.js';
import {
  VEHICLE_TRACK_STATUS,
  buildVehicleKey,
  ensureVehicleTrack,
  listCustomerVehicleTracks,
} from './vehicleTrack.js';
import {
  createVehicleOfferForScenario,
  mergeVehicleOfferById,
} from '../vehicleOffer.js';
import {
  createOpenDeliveryTimeQuestion,
  openDeliveryTimeOnLead,
} from './deliveryTimeQuestion.js';

const MODEL_RE = /\b(EV\s*[234569]|EV9|Sportage|Sorento|Ceed|XCeed|Niro|Picanto|Stonic|Soul|Carnival)\b/i;
const CONFIG_ATTACH_RE = /konfiguration\s+(?:im\s+)?anhang|anhang(?:\s+mit)?\s+konfiguration|konfiguration\s+angehängt|beigefügt(?:e)?\s+konfiguration|config(?:uration)?\s+(?:im\s+)?anhang/i;
const PRIVATE_RE = /\bprivat(?:kunde|person)?\b|\bprivatkunde\b|\bals\s+privat/i;
const BUSINESS_RE = /\bgewerbe|\bfirma|\bunternehmen|\bgeschäftlich|\bgewerblich\b/i;
const DELIVERY_Q_RE = /lieferzeit|liefertermin|wann\s+(?:kommt|ist|wäre|waere)|verfügbar(?:keit)?|lieferfrist/i;
const ALT_SPLIT_RE = /\b(?:alternativ(?:\s+(?:auch|dazu|dazu\s+noch))?|beziehungsweise|bzw\.?|oder\s+(?:auch\s+)?alternativ|und\s+alternativ)\b/i;

function parseEuroAmount(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const value = Number(cleaned);
  return Number.isFinite(value) ? Math.round(value) : null;
}

function parseKm(raw) {
  if (raw == null) return null;
  const n = Number(String(raw).replace(/\./g, '').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : null;
}

function detectScenarioType(chunk = '') {
  const t = String(chunk).toLowerCase();
  if (/\bleasing\b/.test(t)) return COMMERCIAL_SCENARIO_TYPE.LEASING;
  if (/\bfinanzierung\b|\bfinanzieren\b|\bkredit\b/.test(t)) {
    return COMMERCIAL_SCENARIO_TYPE.FINANCING;
  }
  if (/\b(?:bar|kauf|barkauf|barzahlung)\b/.test(t)) return COMMERCIAL_SCENARIO_TYPE.CASH;
  return null;
}

function extractTermMonths(chunk = '') {
  const m = String(chunk).match(/(\d{2})\s*monate?/i);
  return m ? Number(m[1]) : null;
}

function extractMileage(chunk = '') {
  const m = String(chunk).match(/(\d{1,3}(?:[.\s]\d{3})*)\s*(?:km|kilometer)(?:\s*\/?\s*jahr)?/i);
  return m ? parseKm(m[1]) : null;
}

function extractDownPayment(chunk = '') {
  const t = String(chunk);
  if (/\b(?:keine|ohne|0)\s*(?:€|euro)?\s*(?:anzahlung|sonderzahlung)\b/i.test(t)
    || /\b(?:anzahlung|sonderzahlung)\s*(?:keine|ohne|0)\b/i.test(t)
    || /\bkeine\s+anzahlung\b/i.test(t)) {
    return 0;
  }
  const m = t.match(/(?:anzahlung|sonderzahlung)\s*(?:von\s*)?(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{1,2})?)\s*(?:€|euro)?/i)
    || t.match(/(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{1,2})?)\s*(?:€|euro)?\s*(?:anzahlung|sonderzahlung)/i);
  if (m?.[1]) return parseEuroAmount(m[1]);
  return null;
}

function splitScenarioChunks(text = '') {
  const raw = String(text ?? '');
  if (!raw.trim()) return [];

  // Explizite Alternativ-Teile
  if (ALT_SPLIT_RE.test(raw)) {
    const parts = raw.split(ALT_SPLIT_RE).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) return parts;
  }

  // „… Leasing … und Finanzierung …“ / „… Finanzierung … und Leasing …“
  const dualCue = raw.match(
    /([\s\S]*?\bleasing\b[\s\S]*?)(?:\bund\b|\bsowie\b)([\s\S]*?\bfinanzierung\b[\s\S]*)/i,
  ) || raw.match(
    /([\s\S]*?\bfinanzierung\b[\s\S]*?)(?:\bund\b|\bsowie\b)([\s\S]*?\bleasing\b[\s\S]*)/i,
  );
  if (dualCue) {
    return [dualCue[1].trim(), dualCue[2].trim()];
  }

  // Zwei Zahlungsarten im Text ohne klaren Split → Chunks um Keyword herum
  const hasLeasing = /\bleasing\b/i.test(raw);
  const hasFinancing = /\bfinanzierung\b/i.test(raw);
  if (hasLeasing && hasFinancing) {
    const leasingIdx = raw.toLowerCase().indexOf('leasing');
    const financingIdx = raw.toLowerCase().indexOf('finanzierung');
    if (leasingIdx >= 0 && financingIdx >= 0 && leasingIdx !== financingIdx) {
      const first = Math.min(leasingIdx, financingIdx);
      const second = Math.max(leasingIdx, financingIdx);
      return [
        raw.slice(Math.max(0, first - 12), second).trim(),
        raw.slice(second).trim(),
      ];
    }
  }

  return [raw];
}

function parseOneScenario(chunk, index, customerType) {
  const type = detectScenarioType(chunk);
  if (!type) return null;
  const termMonths = extractTermMonths(chunk);
  const annualMileage = extractMileage(chunk);
  let downPayment = extractDownPayment(chunk);
  if (downPayment == null && type === COMMERCIAL_SCENARIO_TYPE.LEASING) {
    // „keine Anzahlung“ oft nur im Leasing-Teil
    if (/keine|ohne/i.test(chunk) && /anzahlung|sonderzahlung/i.test(chunk)) {
      downPayment = 0;
    }
  }
  const idBase = type === COMMERCIAL_SCENARIO_TYPE.LEASING
    ? 'leasing'
    : (type === COMMERCIAL_SCENARIO_TYPE.FINANCING ? 'financing' : 'cash');
  return normalizeCommercialScenario({
    id: `${idBase}-${index + 1}`,
    type,
    customerType,
    termMonths,
    annualMileage,
    mileagePerYear: annualMileage,
    downPayment: downPayment ?? 0,
    source: COMMERCIAL_SCENARIO_SOURCE.CUSTOMER_MESSAGE,
  });
}

function slugifyModel(model = '') {
  return String(model)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'fahrzeug';
}

/**
 * @param {string} text
 * @returns {object|null} draft or null if nothing useful
 */
export function parseHomepageCommercialInquiry(text = '') {
  const raw = String(text ?? '').trim();
  if (!raw) return null;

  const modelMatch = raw.match(MODEL_RE);
  const modelLabel = modelMatch
    ? modelMatch[1].replace(/\s+/g, '').replace(/^ev/i, (m) => m.toUpperCase())
    : null;
  // Normalize EV casing
  const model = modelLabel
    ? (/^ev/i.test(modelLabel) ? modelLabel.toUpperCase().replace('EV', 'EV') : (
      modelLabel.charAt(0).toUpperCase() + modelLabel.slice(1).toLowerCase()
    ))
    : null;
  const modelKey = model ? slugifyModel(model) : null;

  const configurationAttached = CONFIG_ATTACH_RE.test(raw);
  let customerType = COMMERCIAL_CUSTOMER_TYPE.PRIVATE;
  if (BUSINESS_RE.test(raw) && !PRIVATE_RE.test(raw)) {
    customerType = COMMERCIAL_CUSTOMER_TYPE.BUSINESS;
  } else if (PRIVATE_RE.test(raw)) {
    customerType = COMMERCIAL_CUSTOMER_TYPE.PRIVATE;
  }

  const chunks = splitScenarioChunks(raw);
  const scenarios = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const scenario = parseOneScenario(chunks[i], i, customerType);
    if (scenario && !scenarios.some((s) => s.type === scenario.type && s.termMonths === scenario.termMonths)) {
      scenarios.push(scenario);
    }
  }

  // Gemeinsame km aus Gesamttext, wenn ein Szenario sie nicht trägt
  const sharedMileage = extractMileage(raw);
  if (sharedMileage != null) {
    for (const scenario of scenarios) {
      if (scenario.annualMileage == null && scenario.mileagePerYear == null) {
        scenario.annualMileage = sharedMileage;
        scenario.mileagePerYear = sharedMileage;
      }
    }
  }

  // Dedup by type preferring more complete data
  const byType = new Map();
  for (const scenario of scenarios) {
    const prev = byType.get(scenario.type);
    if (!prev) {
      byType.set(scenario.type, scenario);
      continue;
    }
    const prevScore = [prev.termMonths, prev.annualMileage, prev.downPayment].filter((v) => v != null).length;
    const nextScore = [scenario.termMonths, scenario.annualMileage, scenario.downPayment].filter((v) => v != null).length;
    if (nextScore > prevScore) byType.set(scenario.type, scenario);
  }
  const commercialScenarios = [...byType.values()];

  const openQuestions = [];
  if (DELIVERY_Q_RE.test(raw)) {
    openQuestions.push({
      id: 'delivery_time',
      field: 'deliveryTime',
      label: 'Lieferzeit beantworten',
      question: 'Wie ist die Lieferzeit?',
    });
  }

  const hasDual = commercialScenarios.length >= 2;
  const hasSignal = Boolean(model || configurationAttached || commercialScenarios.length || openQuestions.length);
  if (!hasSignal) return null;

  // Homepage dual-offer case: need model + >=2 scenarios ideally
  const confidence = hasDual && model
    ? 0.95
    : (commercialScenarios.length || model ? 0.8 : 0.55);

  return {
    kind: 'homepage_commercial_inquiry',
    rawText: raw,
    model,
    modelKey,
    modelLabel: model,
    configurationAttached,
    customerType,
    commercialScenarios,
    openQuestions,
    hasDualScenarios: hasDual,
    confidence,
  };
}

/**
 * True wenn Text wie Homepage-Dual-Szenario-Anfrage aussieht.
 */
export function isHomepageDualScenarioInquiry(text = '') {
  const draft = parseHomepageCommercialInquiry(text);
  return Boolean(draft?.hasDualScenarios && draft.model);
}

/**
 * Review-Model für SellerUniversalReviewCard (vor Persistenz).
 */
export function buildHomepageInquiryReviewModel(draft = null) {
  if (!draft) return null;

  const groups = [];
  const vehicleParts = [];
  if (draft.model) vehicleParts.push(draft.model);
  if (draft.configurationAttached) vehicleParts.push('Konfiguration angehängt');
  if (vehicleParts.length) {
    groups.push({
      id: 'vehicle',
      title: 'FAHRZEUG',
      line: vehicleParts.join(' · '),
      items: vehicleParts.map((label) => ({ label })),
    });
  }

  if (draft.commercialScenarios?.length) {
    groups.push({
      id: 'offer_wishes',
      title: 'ANGEBOTSWÜNSCHE',
      line: draft.commercialScenarios.map(formatCommercialScenarioChip).join('  ·  '),
      items: draft.commercialScenarios.map((s) => ({
        label: formatCommercialScenarioChip(s),
        scenarioId: s.id,
      })),
    });
  }

  groups.push({
    id: 'customer',
    title: 'KUNDE',
    line: formatCustomerTypeLabel(draft.customerType),
    items: [{ label: formatCustomerTypeLabel(draft.customerType) }],
  });

  if (draft.openQuestions?.length) {
    groups.push({
      id: 'open',
      title: 'OFFEN',
      line: draft.openQuestions.map((q) => q.label).join(' · '),
      items: draft.openQuestions.map((q) => ({ label: q.label, tone: 'open' })),
    });
  }

  return {
    title: '✨ Clever hat die Anfrage vorbereitet',
    groups,
    actionSections: [],
    factCount: groups.reduce((n, g) => n + (g.items?.length ?? 0), 0),
    summaryLine: draft.hasDualScenarios
      ? 'Eine Fahrzeugspur · zwei Angebotsvarianten'
      : 'Anfrage erkannt – bitte prüfen und übernehmen',
    missingLine: null,
    primaryCta: 'Übernehmen',
    secondaryCta: 'Verwerfen',
    homepageInquiry: draft,
    kind: 'homepage_commercial_inquiry',
  };
}

/**
 * Nach „Übernehmen“: eine Spur + commercialScenarios + leere Offer-Slots.
 */
export function applyHomepageInquiryToLead(lead = {}, draft = null, {
  createOfferShells = true,
} = {}) {
  if (!draft?.commercialScenarios?.length && !draft?.model) {
    return { ok: false, error: 'no_draft', lead };
  }

  let next = { ...lead };
  const model = draft.model || lead.vehicle?.model || 'Fahrzeug';
  const modelKey = draft.modelKey || slugifyModel(model);
  const vehicleKey = buildVehicleKey({ brand: 'kia', model, modelKey });

  const ensured = ensureVehicleTrack(next, {
    vehicleKey,
    displayName: model,
    model,
    modelKey,
    trimLabel: '',
  });
  next = ensured.lead;
  const trackId = ensured.trackId;

  // Bind scenarios to track
  const scenarios = draft.commercialScenarios.map((s, index) => normalizeCommercialScenario({
    ...s,
    id: s.id || `${s.type}-${index + 1}`,
    vehicleTrackId: trackId,
    customerType: draft.customerType || s.customerType,
    source: COMMERCIAL_SCENARIO_SOURCE.CUSTOMER_MESSAGE,
  })).filter(Boolean);

  next = setCommercialScenariosOnLead(next, scenarios);
  next = {
    ...next,
    vehicle: {
      ...(next.vehicle ?? {}),
      brand: next.vehicle?.brand || 'Kia',
      model,
      label: next.vehicle?.label || `Kia ${model}`,
    },
    wish: {
      ...(next.wish ?? {}),
      customerType: draft.customerType || COMMERCIAL_CUSTOMER_TYPE.PRIVATE,
      commercialScenarios: scenarios,
    },
    crm: {
      ...(next.crm ?? {}),
      customerTruth: {
        ...(next.crm?.customerTruth ?? {}),
        customerType: draft.customerType || COMMERCIAL_CUSTOMER_TYPE.PRIVATE,
        configurationAttached: Boolean(draft.configurationAttached),
      },
      commercialScenarios: scenarios,
    },
  };

  const wantsDeliveryOpen = Boolean(draft.openQuestions?.some((q) => q.field === 'deliveryTime'));
  if (wantsDeliveryOpen) {
    next = openDeliveryTimeOnLead(next, createOpenDeliveryTimeQuestion());
  } else if (next.crm?.customerTruth?.deliveryTimeOpen == null) {
    next = {
      ...next,
      crm: {
        ...next.crm,
        customerTruth: {
          ...next.crm.customerTruth,
          deliveryTimeOpen: false,
          deliveryTimePlaceholder: next.crm.customerTruth.deliveryTimePlaceholder ?? null,
        },
      },
    };
  }

  // Patch track config: active + config attachment
  const configs = (next.crm?.vehicleConfigurations ?? []).map((config) => {
    if (config.id !== trackId) return config;
    return {
      ...config,
      configurationAttached: Boolean(draft.configurationAttached) || Boolean(config.configurationAttached),
      configSnapshot: draft.configurationAttached
        ? (config.configSnapshot || { attached: true, source: 'homepage' })
        : config.configSnapshot,
      vehicleTrack: {
        ...(config.vehicleTrack ?? {}),
        status: config.vehicleTrack?.status === VEHICLE_TRACK_STATUS.DEFERRED
          ? config.vehicleTrack.status
          : VEHICLE_TRACK_STATUS.ACTIVE,
        lastActivityAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };
  });
  next = {
    ...next,
    crm: {
      ...next.crm,
      vehicleConfigurations: configs,
    },
  };

  if (createOfferShells && scenarios.length) {
    for (const scenario of scenarios) {
      const offerId = `vo-${trackId}-${scenario.id}`;
      const existing = next.crm?.vehicleOffers?.[offerId];
      if (existing) continue;
      const shell = createVehicleOfferForScenario({
        trackId,
        scenarioId: scenario.id,
        offerId,
        patch: {
          termMonths: scenario.termMonths,
          mileagePerYear: scenario.annualMileage ?? scenario.mileagePerYear,
          downPayment: scenario.downPayment ?? 0,
        },
      });
      next = mergeVehicleOfferById(next, offerId, shell);
    }
  }

  const tracks = listCustomerVehicleTracks(next);
  const track = tracks.find((t) => t.id === trackId) ?? tracks[0] ?? null;

  return {
    ok: true,
    lead: next,
    trackId,
    track,
    scenarioCount: scenarios.length,
    offerSlotCount: scenarios.length,
    acceptedLabels: [
      model,
      draft.configurationAttached ? 'Konfiguration angehängt' : null,
      ...scenarios.map(formatCommercialScenarioChip),
      formatCustomerTypeLabel(draft.customerType),
      ...(draft.openQuestions ?? []).map((q) => q.label),
    ].filter(Boolean),
  };
}

/**
 * Seller-Facts aus Homepage-Draft (für cleverSeller Pipeline).
 */
export function homepageInquiryToSellerFacts(draft = null) {
  if (!draft) return [];
  const facts = [];

  if (draft.model) {
    facts.push({
      factClass: 'vehicle_interest',
      field: 'vehicleInterest',
      value: { modelKey: draft.modelKey, model: draft.model },
      label: draft.model,
      confidence: draft.confidence,
      source: 'customer_message',
    });
  }
  if (draft.configurationAttached) {
    facts.push({
      factClass: 'vehicle_requirement',
      field: 'configurationAttached',
      value: true,
      label: 'Konfiguration angehängt',
      confidence: 0.92,
      source: 'customer_message',
    });
  }
  if (draft.commercialScenarios?.length) {
    facts.push({
      factClass: 'commercial_preference',
      field: 'commercialScenarios',
      value: draft.commercialScenarios,
      label: draft.commercialScenarios.map(formatCommercialScenarioChip).join(' · '),
      confidence: draft.confidence,
      source: 'customer_message',
      needsConfirmation: false,
    });
  }
  if (draft.customerType) {
    facts.push({
      factClass: 'customer_fact',
      field: 'customerType',
      value: draft.customerType,
      label: formatCustomerTypeLabel(draft.customerType),
      confidence: 0.9,
      source: 'customer_message',
    });
  }
  for (const q of draft.openQuestions ?? []) {
    facts.push({
      factClass: 'customer_need',
      field: q.field,
      value: { open: true, question: q.question },
      label: q.label,
      confidence: 0.9,
      source: 'customer_message',
      needsConfirmation: false,
    });
  }
  return facts;
}
