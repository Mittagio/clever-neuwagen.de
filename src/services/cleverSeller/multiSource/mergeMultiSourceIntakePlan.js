/**
 * Semantic Turn Merge:
 * 1) OpenAI-Plan  2) normalisieren/validieren  3) lokale Safety/Sources/Status
 * 4) Intake-Modell für Review (kein Auto-Persist)
 *
 * Deterministik ist NICHT mehr Hauptwahrheit – nur Validator/Safety/Fallback.
 */
import { SELLER_TURN_INTENTS } from '../sellerFactTypes.js';
import { resolveContractTemporalStatus } from './resolveContractTemporalStatus.js';
import { validateMultiSourceIntakePlan } from './validateMultiSourceIntakePlan.js';

const SENSITIVE_FIELD_BLOCKLIST = new Set([
  'iban', 'accountNumber', 'idNumber', 'ausweisnummer', 'income', 'employer',
  'street', 'address', 'signature', 'gehalt', 'arbeitgeber',
]);

const KIND_TO_SUBTYPE = {
  leasing: { contractType: 'leasing', contractSubtype: null, label: 'Leasingvertrag' },
  financing: { contractType: 'financing', contractSubtype: null, label: 'Finanzierungsvertrag' },
  three_way: {
    contractType: 'financing',
    contractSubtype: 'three_way_financing',
    label: '3-Wege-Finanzierung',
  },
  purchase: { contractType: 'purchase', contractSubtype: null, label: 'Kaufvertrag' },
  unknown: { contractType: null, contractSubtype: null, label: null },
};

const ACTION_MAP = {
  find_customer: {
    id: 'find_customer',
    type: SELLER_TURN_INTENTS.RESOLVE_CUSTOMER_CONTEXT,
    label: 'Kunde suchen',
  },
  prepare_customer_creation: {
    id: 'create_customer_candidate',
    type: 'create_customer_candidate',
    label: 'Kundenakte vorbereiten',
  },
  import_historical_contract: {
    id: 'import_historical_contract',
    type: SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT,
    label: 'Altvertrag übernehmen',
  },
  prepare_trade_in: {
    id: 'create_trade_in_candidate',
    type: SELLER_TURN_INTENTS.PREPARE_TRADE_IN,
    label: 'Inzahlungnahme vorbereiten',
  },
  create_vehicle_interest: {
    id: 'create_vehicle_interest',
    type: SELLER_TURN_INTENTS.RESOLVE_VEHICLE,
    label: 'Fahrzeugwunsch übernehmen',
  },
  create_commercial_scenario: {
    id: 'create_commercial_scenario',
    type: SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT,
    label: 'Konditionen übernehmen',
  },
  update_current_customer_facts: {
    id: 'update_current_customer_facts',
    type: SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT,
    label: 'Aktuelle Angaben übernehmen',
  },
  prepare_offer: {
    id: 'prepare_new_offer',
    type: SELLER_TURN_INTENTS.PREPARE_OFFER,
    label: 'Neues Angebot vorbereiten',
  },
  attach_working_context: {
    id: 'attach_working_context',
    type: 'attach_working_context',
    label: 'Arbeitskontext verknüpfen',
  },
};

/**
 * @param {object|null} plan – AI CleverMultiSourceIntakePlan
 * @param {object} [baseline] – nur Fallback / optionale Safety-Hints
 * @param {{ sellerInput?: string, now?: Date|number }} [options]
 */
export function mergeMultiSourceIntakePlan(plan, baseline = {}, options = {}) {
  if (!plan || typeof plan !== 'object') {
    return {
      intake: baseline?.detected ? baseline : null,
      ok: false,
      error: 'empty_plan',
      validators: [],
      validatorWarnings: [],
      schemaValid: false,
      plan: null,
    };
  }

  const sellerInput = String(options.sellerInput || '');
  const now = options.now || Date.now();

  const validated = validateMultiSourceIntakePlan(plan, { sellerInput, now });
  const intake = planToIntake(validated.plan, { sellerInput, now, baseline });
  scrubSensitiveStrings(intake);

  return {
    intake,
    ok: Boolean(intake?.detected),
    error: null,
    validators: validated.warnings.map((w) => ({ id: w.id, ok: true, note: w.message })),
    validatorWarnings: validated.warnings,
    schemaValid: validated.schemaValid,
    plan: validated.plan,
  };
}

/**
 * Konvertiert validierten Semantic Plan → Review-Intake (bestehende Review-Karte).
 */
export function planToIntake(plan = {}, { sellerInput = '', now = Date.now(), baseline = {} } = {}) {
  const observedAt = new Date(now instanceof Date ? now : now).toISOString().slice(0, 10);
  const customer = (plan.customerCandidates || [])[0] || null;

  const interest = (plan.vehicleInterests || []).find((v) => (
    v.role === 'desired_vehicle' || v.role === 'unknown' || !v.role
  ));
  const tradeIns = (plan.tradeInCandidates || [])
    .filter((t) => t?.model || t?.label)
    .slice(0, 4)
    .map((t) => ({
      make: t.make || null,
      model: t.model || null,
      label: t.label || [t.make, t.model].filter(Boolean).join(' '),
      cue: 'openai',
      span: null,
      ambiguous: Boolean(t.ambiguous),
      role: t.role || 'trade_in_vehicle',
      sourceType: t.sourceType || 'seller_input',
    }));

  const commercial = (plan.commercialScenarios || [])[0] || null;
  const currentFacts = plan.currentCustomerFacts || [];
  const children = currentFacts.find((f) => f.field === 'childrenCount');
  const housing = currentFacts.find((f) => f.field === 'housingType');

  const aiContract = (plan.historicalContracts || [])[0] || null;
  let historicalContract = null;
  if (aiContract) {
    const kindMeta = KIND_TO_SUBTYPE[aiContract.kind] || KIND_TO_SUBTYPE.unknown;
    const temporal = resolveContractTemporalStatus(aiContract.contractEndDate, now);
    const vehicle = [aiContract.vehicleMake, aiContract.vehicleModel].filter(Boolean).join(' ') || null;
    historicalContract = {
      contractType: kindMeta.contractType,
      contractTypeLabel: kindMeta.label,
      vehicle,
      vehicleRole: aiContract.vehicleRole || 'historical_contract_vehicle',
      monthlyRate: numOrNull(aiContract.monthlyRate),
      finalPayment: numOrNull(aiContract.finalPayment),
      contractEndDate: aiContract.contractEndDate || null,
      contractStartDate: aiContract.contractStartDate || null,
      totalMileage: numOrNull(aiContract.totalMileage),
      annualMileage: numOrNull(aiContract.annualMileage),
      excessMileageRate: numOrNull(aiContract.excessMileageRate),
      underMileageRate: numOrNull(aiContract.underMileageRate),
      status: temporal.status,
      statusLabel: temporal.label,
      contractKindId: aiContract.kind === 'three_way' ? 'financing_three_way' : aiContract.kind,
      contractKindLabel: kindMeta.label,
      source: ['openai_interpretation', aiContract.sourceType].filter(Boolean),
      evidence: redactEvidence(plan.evidence || []),
    };
  }

  const histChildren = (plan.historicalCustomerFacts || []).find((f) => f.field === 'childrenCount');
  const historicalHousehold = histChildren
    ? {
      childrenCount: numOrNull(histChildren.value),
      observedAt: 'Altvertrag',
      source: histChildren.sourceType || 'contract_pdf',
    }
    : null;

  const currentHouseholdFacts = (children || housing)
    ? {
      childrenCount: children ? numOrNull(children.value) : null,
      housingType: housing
        ? (String(housing.value).includes('haus') || housing.value === 'own_house'
          ? 'own_house'
          : String(housing.value))
        : null,
      source: 'openai_interpretation',
      observedAt,
      label: [
        children != null ? `${numOrNull(children.value)} Kinder` : null,
        housing && (String(housing.value).includes('haus') || housing.value === 'own_house')
          ? 'Eigenes Haus'
          : null,
      ].filter(Boolean).join(' · '),
    }
    : null;

  const conflicts = (plan.conflicts || [])
    .filter((c) => c?.id && c?.label && !SENSITIVE_FIELD_BLOCKLIST.has(c.field))
    .slice(0, 8)
    .map((c) => ({
      id: String(c.id).slice(0, 64),
      field: c.field || null,
      label: String(c.label).slice(0, 240),
      suggestedAction: c.suggestedAction || 'prefer_current',
    }));

  if (
    historicalHousehold?.childrenCount != null
    && currentHouseholdFacts?.childrenCount != null
    && Number(historicalHousehold.childrenCount) !== Number(currentHouseholdFacts.childrenCount)
    && !conflicts.some((c) => c.field === 'childrenCount')
  ) {
    conflicts.push({
      id: 'children_count_temporal',
      field: 'childrenCount',
      label: `Im Altvertrag war ${historicalHousehold.childrenCount} Kind angegeben. Aktuell haben Sie ${currentHouseholdFacts.childrenCount} Kinder genannt.`,
      suggestedAction: 'prefer_current',
    });
  }

  const preparedActions = buildPreparedActions(plan, {
    customer,
    interest,
    tradeIns,
    commercial,
    historicalContract,
    currentHouseholdFacts,
  });

  const missingInformation = (plan.missingInformation || []).slice(0, 8).map((m) => ({
    id: m.id,
    field: m.field,
    label: m.label,
  }));
  if (customer && !customer.email && !customer.phone
    && !missingInformation.some((m) => m.field === 'email' || m.field === 'phone')) {
    missingInformation.push({
      id: 'customer_contact',
      field: 'email',
      label: 'E-Mail/Telefon für Kundenakte',
    });
  }

  const resolvedCustomerCandidate = customer?.fullName
    ? {
      fullName: String(customer.fullName).trim().slice(0, 80),
      firstName: customer.firstName || null,
      lastName: customer.lastName || null,
      email: sanitizeContact(customer.email),
      phone: sanitizeContact(customer.phone),
      source: ['openai_interpretation', customer.sourceType].filter(Boolean),
      missingContact: !(sanitizeContact(customer.email) || sanitizeContact(customer.phone)),
    }
    : null;

  const currentVehicleInterest = interest?.model
    ? {
      make: interest.make || 'Kia',
      model: interest.model,
      trim: interest.trim || null,
      color: interest.color || null,
      requestedEquipment: Array.isArray(interest.equipment) ? interest.equipment.slice(0, 8) : [],
      role: interest.role || 'desired_vehicle',
      label: interest.label
        || [interest.make, interest.model, interest.trim, interest.color].filter(Boolean).join(' · '),
      source: 'openai_interpretation',
    }
    : null;

  const commercialScenario = commercial && (commercial.termMonths != null || commercial.annualMileage != null)
    ? {
      type: commercial.type || 'leasing',
      termMonths: commercial.termMonths ?? null,
      annualMileage: commercial.annualMileage ?? null,
      purchasePrice: commercial.purchasePrice ?? null,
      source: 'openai_interpretation',
      label: [
        commercial.termMonths != null ? `${commercial.termMonths} Monate` : null,
        commercial.annualMileage != null
          ? `${Number(commercial.annualMileage).toLocaleString('de-DE')} km/Jahr`
          : null,
      ].filter(Boolean).join(' · '),
    }
    : null;

  // Lokale Safety: Baseline-Attachment-IDs behalten, Status nie aus AI übernehmen ungeprüft
  const attachmentIds = baseline?.sources?.attachmentIds || [];

  return {
    detected: true,
    reviewType: 'customer_contract_tradein_intake_review',
    turnType: plan.turnType || 'customer_contract_tradein_intake',
    semanticPlan: plan,
    resolvedCustomerCandidate,
    currentVehicleInterest,
    commercialScenario,
    currentHouseholdFacts,
    tradeInCandidate: tradeIns[0] || null,
    tradeInCandidates: tradeIns,
    historicalContract,
    historicalHousehold,
    conflicts,
    ambiguities: plan.ambiguities || [],
    missingInformation,
    preparedActions,
    documentClassifications: plan.documentClassifications || [],
    contractDraft: historicalContract
      ? {
        fields: sanitizeFields({
          contractType: historicalContract.contractType,
          contractSubtype: KIND_TO_SUBTYPE[aiContract?.kind]?.contractSubtype || null,
          contractTypeLabel: historicalContract.contractTypeLabel,
          vehicleMake: aiContract?.vehicleMake || null,
          vehicleModel: aiContract?.vehicleModel || null,
          monthlyRate: historicalContract.monthlyRate,
          finalPayment: historicalContract.finalPayment,
          contractEndDate: historicalContract.contractEndDate,
          contractStartDate: historicalContract.contractStartDate,
          totalMileage: historicalContract.totalMileage,
          excessMileageRate: historicalContract.excessMileageRate,
          underMileageRate: historicalContract.underMileageRate,
        }),
        temporalStatus: {
          status: historicalContract.status,
          label: historicalContract.statusLabel,
        },
        mutatesCustomer: false,
        persistOnAccept: true,
        sourceType: 'openai_interpretation',
      }
      : null,
    sources: {
      sellerInput: Boolean(sellerInput.trim()) || (plan.evidence || []).some((e) => e.sourceType === 'seller_input'),
      contractPdf: Boolean(historicalContract) || (plan.evidence || []).some((e) => /contract|pdf/i.test(e.sourceType || '')),
      attachmentIds,
    },
    aiConfidence: clamp01(plan.confidence),
    observedAt,
  };
}

function buildPreparedActions(plan, parts = {}) {
  const fromPlan = (plan.proposedActions || [])
    .filter((a) => a?.type && ACTION_MAP[a.type])
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
    .map((a) => ({
      id: ACTION_MAP[a.type].id,
      type: ACTION_MAP[a.type].type,
      label: a.label || ACTION_MAP[a.type].label,
      persistOnAccept: a.type !== 'prepare_offer' && a.type !== 'attach_working_context',
      mutatesCustomer: false,
    }));

  if (fromPlan.length) return dedupeActions(fromPlan);

  // Safety defaults – nur Prepared, keine Execution
  const defaults = [];
  if (parts.customer) {
    defaults.push({
      id: 'find_customer',
      type: SELLER_TURN_INTENTS.RESOLVE_CUSTOMER_CONTEXT,
      label: 'Kunde suchen',
      persistOnAccept: false,
      mutatesCustomer: false,
    });
    defaults.push({
      id: 'create_customer_candidate',
      type: 'create_customer_candidate',
      label: 'Kundenakte vorbereiten',
      persistOnAccept: true,
      mutatesCustomer: false,
    });
  }
  if (parts.historicalContract) {
    defaults.push({
      id: 'import_historical_contract',
      type: SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT,
      label: 'Altvertrag übernehmen',
      persistOnAccept: true,
      mutatesCustomer: false,
    });
  }
  if (parts.tradeIns?.[0]) {
    defaults.push({
      id: 'create_trade_in_candidate',
      type: SELLER_TURN_INTENTS.PREPARE_TRADE_IN,
      label: `${parts.tradeIns[0].label} als Inzahlungnahme`,
      persistOnAccept: true,
      mutatesCustomer: false,
    });
  }
  if (parts.currentHouseholdFacts || parts.interest) {
    defaults.push({
      id: 'update_current_customer_facts',
      type: SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT,
      label: 'Aktuelle Angaben übernehmen',
      persistOnAccept: true,
      mutatesCustomer: false,
    });
  }
  if (parts.interest) {
    defaults.push({
      id: 'create_vehicle_interest',
      type: SELLER_TURN_INTENTS.RESOLVE_VEHICLE,
      label: 'Fahrzeugwunsch übernehmen',
      persistOnAccept: true,
      mutatesCustomer: false,
    });
  }
  if (parts.commercial) {
    defaults.push({
      id: 'create_commercial_scenario',
      type: SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT,
      label: 'Konditionen übernehmen',
      persistOnAccept: true,
      mutatesCustomer: false,
    });
  }
  if (parts.interest) {
    defaults.push({
      id: 'prepare_new_offer',
      type: SELLER_TURN_INTENTS.PREPARE_OFFER,
      label: 'Neues Angebot vorbereiten',
      persistOnAccept: false,
      mutatesCustomer: false,
    });
  }
  return dedupeActions(defaults);
}

function dedupeActions(actions = []) {
  const seen = new Set();
  return actions.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

function numOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0.65;
  return Math.max(0, Math.min(1, x));
}

function sanitizeContact(v) {
  const s = String(v || '').trim();
  if (!s || s.length > 80) return null;
  if (/iban|ausweis|gehalt/i.test(s)) return null;
  return s;
}

function sanitizeFields(fields = {}) {
  const out = { ...fields };
  for (const key of SENSITIVE_FIELD_BLOCKLIST) delete out[key];
  return out;
}

function redactEvidence(evidence = []) {
  return (evidence || [])
    .filter((e) => !SENSITIVE_FIELD_BLOCKLIST.has(e?.field))
    .slice(0, 12)
    .map((e) => ({
      id: e.id || null,
      field: e.field || null,
      sourceType: e.sourceType || null,
      sourceId: e.sourceId || null,
      evidenceText: scrubText(e.snippet || e.evidenceText),
    }));
}

function scrubText(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/\b[A-Z]{2}\d{2}(?:[ ]?\d{4}){3,8}\b/gi, '[IBAN entfernt]')
    .replace(/\b(?:Personalausweis|Reisepass|Ausweisnr\.?|Ausweis-?Nr\.?)\s*[:.]?\s*[A-Z0-9]{6,}/gi, '[Ausweis entfernt]');
}

function scrubSensitiveStrings(node, depth = 0) {
  if (!node || depth > 8) return;
  if (Array.isArray(node)) {
    for (const item of node) scrubSensitiveStrings(item, depth + 1);
    return;
  }
  if (typeof node !== 'object') return;
  for (const key of Object.keys(node)) {
    if (SENSITIVE_FIELD_BLOCKLIST.has(key)) {
      delete node[key];
      continue;
    }
    const val = node[key];
    if (typeof val === 'string') node[key] = scrubText(val);
    else if (val && typeof val === 'object') scrubSensitiveStrings(val, depth + 1);
  }
}

export { SENSITIVE_FIELD_BLOCKLIST };
