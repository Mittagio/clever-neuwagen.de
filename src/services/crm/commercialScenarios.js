/**
 * Commercial Scenarios – Kundenwahrheit für parallele Angebotsvarianten
 * an EINER Fahrzeugspur (z. B. Sportage Leasing + Finanzierung).
 *
 * Schichtentrennung:
 * - Customer Truth (wish.commercialScenarios / crm.commercialScenarios)
 * - Offer Object (vehicleOffers[*].commercialScenarioId)
 * - Vehicle Track (eine Spur, offerIds[])
 */
import {
  formatDeliveryTimeAnsweredChip,
  getDeliveryTimeQuestion,
  isDeliveryTimeOpen,
  DELIVERY_TIME_STATUS,
} from './deliveryTimeQuestion.js';

export const COMMERCIAL_SCENARIO_TYPE = {
  LEASING: 'leasing',
  FINANCING: 'financing',
  CASH: 'cash',
};

export const COMMERCIAL_CUSTOMER_TYPE = {
  PRIVATE: 'private',
  BUSINESS: 'business',
};

export const COMMERCIAL_SCENARIO_SOURCE = {
  CUSTOMER_MESSAGE: 'customer_message',
  SELLER: 'seller',
  LEGACY: 'legacy',
};

const TYPE_LABEL = {
  [COMMERCIAL_SCENARIO_TYPE.LEASING]: 'Leasing',
  [COMMERCIAL_SCENARIO_TYPE.FINANCING]: 'Finanzierung',
  [COMMERCIAL_SCENARIO_TYPE.CASH]: 'Kauf',
};

const CUSTOMER_TYPE_LABEL = {
  [COMMERCIAL_CUSTOMER_TYPE.PRIVATE]: 'Privat',
  [COMMERCIAL_CUSTOMER_TYPE.BUSINESS]: 'Gewerbe',
};

function asNumber(value, fallback = null) {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * @param {object} raw
 * @returns {object|null}
 */
export function normalizeCommercialScenario(raw = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const type = normalizeScenarioType(raw.type ?? raw.paymentType);
  if (!type) return null;
  const id = String(raw.id || `${type}-${Date.now()}`).trim();
  if (!id) return null;

  return {
    id,
    type,
    paymentType: type,
    customerType: normalizeCustomerType(raw.customerType),
    termMonths: asNumber(raw.termMonths),
    annualMileage: asNumber(raw.annualMileage ?? raw.mileagePerYear),
    mileagePerYear: asNumber(raw.mileagePerYear ?? raw.annualMileage),
    downPayment: asNumber(raw.downPayment, 0) ?? 0,
    source: raw.source || COMMERCIAL_SCENARIO_SOURCE.CUSTOMER_MESSAGE,
    vehicleTrackId: raw.vehicleTrackId ?? null,
    label: raw.label ?? null,
  };
}

export function normalizeScenarioType(value) {
  const v = String(value ?? '').toLowerCase().trim();
  if (v === 'leasing') return COMMERCIAL_SCENARIO_TYPE.LEASING;
  if (v === 'financing' || v === 'finance' || v === 'threewayfinancing') {
    return COMMERCIAL_SCENARIO_TYPE.FINANCING;
  }
  if (v === 'cash' || v === 'purchase' || v === 'kauf') return COMMERCIAL_SCENARIO_TYPE.CASH;
  return null;
}

export function normalizeCustomerType(value) {
  const v = String(value ?? '').toLowerCase().trim();
  if (v === 'business' || v === 'gewerbe' || v === 'gewerblich') {
    return COMMERCIAL_CUSTOMER_TYPE.BUSINESS;
  }
  return COMMERCIAL_CUSTOMER_TYPE.PRIVATE;
}

/**
 * Customer-truth scenarios from wish / crm (prefer wish).
 * Legacy single paymentType → one synthetic scenario when none stored.
 *
 * @param {object} lead
 * @returns {object[]}
 */
export function listCommercialScenarios(lead = {}) {
  const fromWish = lead?.wish?.commercialScenarios;
  const fromCrm = lead?.crm?.commercialScenarios;
  const raw = Array.isArray(fromWish) && fromWish.length
    ? fromWish
    : (Array.isArray(fromCrm) ? fromCrm : []);

  const normalized = raw.map(normalizeCommercialScenario).filter(Boolean);
  if (normalized.length) return normalized;

  return buildLegacyScenarioFromWish(lead);
}

/**
 * Backward compatible: single paymentType / wish fields → 0–1 scenario.
 */
export function buildLegacyScenarioFromWish(lead = {}) {
  const wish = lead?.wish ?? {};
  const type = normalizeScenarioType(wish.paymentType ?? lead?.paymentType);
  if (!type) return [];

  const termMonths = asNumber(wish.termMonths ?? lead?.termMonths);
  const mileage = asNumber(wish.mileagePerYear ?? wish.annualMileage ?? lead?.mileagePerYear);
  const downPayment = asNumber(wish.downPayment ?? lead?.downPayment, 0) ?? 0;

  // Nur synthetisieren, wenn mindestens eine Kondition bekannt ist
  if (termMonths == null && mileage == null && downPayment === 0 && !wish.paymentType && !lead?.paymentType) {
    return [];
  }

  return [normalizeCommercialScenario({
    id: `legacy-${type}`,
    type,
    customerType: wish.customerType ?? COMMERCIAL_CUSTOMER_TYPE.PRIVATE,
    termMonths,
    annualMileage: mileage,
    downPayment,
    source: COMMERCIAL_SCENARIO_SOURCE.LEGACY,
  })].filter(Boolean);
}

export function getCommercialScenarioById(lead = {}, scenarioId) {
  if (!scenarioId) return null;
  return listCommercialScenarios(lead).find((s) => s.id === scenarioId) ?? null;
}

export function listCommercialScenariosForTrack(lead = {}, trackId) {
  const all = listCommercialScenarios(lead);
  if (!trackId) return all;
  const bound = all.filter((s) => !s.vehicleTrackId || s.vehicleTrackId === trackId);
  return bound.length ? bound : all;
}

/**
 * Chip-Label: „Leasing · 36 M · 10.000 km · 0 €“
 */
export function formatCommercialScenarioChip(scenario = {}) {
  if (scenario.label) return String(scenario.label);
  const type = TYPE_LABEL[scenario.type] ?? 'Angebot';
  const parts = [type];
  if (scenario.termMonths != null) parts.push(`${scenario.termMonths} M`);
  const km = scenario.annualMileage ?? scenario.mileagePerYear;
  if (km != null) {
    parts.push(`${Number(km).toLocaleString('de-DE')} km`);
  }
  const down = scenario.downPayment;
  if (down != null) {
    parts.push(`${Number(down).toLocaleString('de-DE')} €`);
  }
  return parts.join(' · ');
}

export function formatCommercialScenarioTypeLabel(type) {
  return TYPE_LABEL[normalizeScenarioType(type)] ?? 'Angebot';
}

export function formatCustomerTypeLabel(customerType) {
  return CUSTOMER_TYPE_LABEL[normalizeCustomerType(customerType)] ?? 'Privat';
}

export function resolveLeadCustomerType(lead = {}) {
  const scenarios = listCommercialScenarios(lead);
  if (scenarios[0]?.customerType) return scenarios[0].customerType;
  const raw = lead?.wish?.customerType
    ?? lead?.crm?.customerTruth?.customerType
    ?? lead?.customerType;
  return normalizeCustomerType(raw);
}

/**
 * Conditions line for offer/portal: „Leasing · 36 Monate · 10.000 km/Jahr · 0 € AZ“
 */
export function formatCommercialScenarioConditionsLine(scenario = {}) {
  const type = TYPE_LABEL[scenario.type] ?? 'Angebot';
  const parts = [type];
  if (scenario.termMonths != null) parts.push(`${scenario.termMonths} Monate`);
  const km = scenario.annualMileage ?? scenario.mileagePerYear;
  if (km != null) {
    parts.push(`${Number(km).toLocaleString('de-DE')} km/Jahr`);
  }
  if (scenario.downPayment != null) {
    const label = scenario.type === COMMERCIAL_SCENARIO_TYPE.FINANCING
      ? 'Anzahlung'
      : 'Sonderzahlung';
    parts.push(`${Number(scenario.downPayment).toLocaleString('de-DE')} € ${label === 'Anzahlung' ? 'AZ' : 'SZ'}`);
  }
  return parts.join(' · ');
}

/**
 * Patch lead wish with commercialScenarios (immutable).
 * Keeps legacy paymentType = first scenario for backward compat.
 */
export function setCommercialScenariosOnLead(lead = {}, scenarios = []) {
  const normalized = (scenarios ?? []).map(normalizeCommercialScenario).filter(Boolean);
  const primary = normalized[0] ?? null;
  return {
    ...lead,
    paymentType: primary?.type ?? lead.paymentType,
    wish: {
      ...(lead.wish ?? {}),
      commercialScenarios: normalized,
      paymentType: primary?.type ?? lead.wish?.paymentType,
      termMonths: primary?.termMonths ?? lead.wish?.termMonths ?? null,
      mileagePerYear: primary?.annualMileage
        ?? primary?.mileagePerYear
        ?? lead.wish?.mileagePerYear
        ?? null,
      downPayment: primary?.downPayment ?? lead.wish?.downPayment ?? 0,
      customerType: primary?.customerType
        ?? lead.wish?.customerType
        ?? COMMERCIAL_CUSTOMER_TYPE.PRIVATE,
    },
    crm: {
      ...(lead.crm ?? {}),
      commercialScenarios: normalized,
    },
  };
}

/**
 * Notepad groups for dual-scenario customer truth.
 *
 * @returns {{
 *   vehicle: object[],
 *   offerWishes: object[],
 *   customer: object[],
 *   open: object[],
 * } | null}
 */
export function buildCustomerTruthNotepadGroups(lead = {}, {
  vehicleLabel = null,
  configurationAttached = false,
  openItems = null,
} = {}) {
  const hasExplicit = Array.isArray(lead?.wish?.commercialScenarios)
    && lead.wish.commercialScenarios.length > 0;
  const scenarios = hasExplicit ? listCommercialScenarios(lead) : [];

  if (!hasExplicit && !configurationAttached && !openItems?.length) {
    return null;
  }

  const configs = lead?.crm?.vehicleConfigurations ?? [];
  const primaryConfig = configs.find((c) => scenarios.some((s) => s.vehicleTrackId === c.id))
    ?? configs[0]
    ?? null;
  const model = vehicleLabel
    || primaryConfig?.model
    || lead?.vehicle?.model
    || null;
  const modelClean = model ? String(model).replace(/^kia\s*/i, '') : null;

  const hasConfigAttachment = configurationAttached
    || Boolean(primaryConfig?.configurationAttached)
    || Boolean(primaryConfig?.configSnapshot)
    || Boolean(lead?.crm?.customerTruth?.configurationAttached)
    || (hasExplicit && Boolean(primaryConfig));

  const vehicle = [];
  if (modelClean) vehicle.push({ id: 'vehicle-model', label: modelClean, kind: 'vehicle' });
  if (hasConfigAttachment) {
    vehicle.push({
      id: 'vehicle-config',
      label: 'Konfiguration angehängt',
      kind: 'vehicle',
    });
  }

  const deliveryQ = getDeliveryTimeQuestion(lead);
  if (deliveryQ?.status === DELIVERY_TIME_STATUS.ANSWERED) {
    vehicle.push({
      id: 'delivery-answered',
      label: formatDeliveryTimeAnsweredChip(deliveryQ),
      kind: 'fact',
      field: 'deliveryTime',
      tone: 'answered',
    });
  }

  const offerWishes = scenarios.map((scenario) => ({
    id: `scenario-${scenario.id}`,
    label: formatCommercialScenarioChip(scenario),
    kind: 'offer_wish',
    scenarioId: scenario.id,
    field: 'commercialScenario',
  }));

  const customerType = resolveLeadCustomerType(lead);
  const customer = [{
    id: 'customer-type',
    label: formatCustomerTypeLabel(customerType),
    kind: 'customer',
    field: 'customerType',
  }];

  const deliveryOpen = isDeliveryTimeOpen(lead);
  const open = Array.isArray(openItems) && openItems.length
    ? openItems
    : (hasExplicit && deliveryOpen
      ? [{
        id: 'open-delivery',
        label: deliveryQ?.label || 'Lieferzeit beantworten',
        kind: 'open',
        tone: 'open',
        field: 'deliveryTime',
      }]
      : []);

  if (!vehicle.length && !offerWishes.length && !customer.length && !open.length) {
    return null;
  }

  return { vehicle, offerWishes, customer, open };
}

/**
 * Whether both scenario offers are ready to dual-send.
 */
export function areAllScenarioOffersReady(slots = []) {
  if (!slots.length) return false;
  return slots.every((slot) => slot?.ready === true);
}

export function countReadyScenarioOffers(slots = []) {
  return slots.filter((slot) => slot?.ready === true).length;
}
