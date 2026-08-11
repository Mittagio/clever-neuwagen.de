/**
 * Live-Edit: Fact-Chips im Intake/Clever-Kontext sofort korrigieren.
 * Gleiche Result-State für Inline-Edit und Composer-NL-Korrektur.
 */
import { createExtractedFact } from './cleverSellerTurnResultSchema.js';
import { SELLER_FACT_CLASS, SELLER_FACT_SOURCE } from './sellerFactTypes.js';
import {
  buildInboundLeadReviewModel,
  formatIntakeDownPaymentLabel,
  formatIntakeMileageChipLabel,
  formatIntakeTermChipLabel,
  resolveInboundCustomer,
} from './inboundLeadIntake.js';
import { buildUniversalReviewModel } from './buildUniversalReviewModel.js';
import { resolveVerifiedVehicleSelection } from './liveEditVehicleOptions.js';
import { normalizeVehicleDisplayLabel } from './normalizeVehicleDisplayLabel.js';
import {
  FIELD_EDITOR_MAP,
  IDENTITY_FIELDS,
  LIVE_EDIT_EDITOR,
  PAYMENT_OPTIONS,
  buildEditableFactChip,
  buildFactCorrectedMicroConfirm,
  isLiveEditableField,
  liveEditFieldLabel,
  resolveLiveEditEditor,
} from './liveEditFactMeta.js';

const FIELD_ALIASES = Object.freeze({
  mobile: ['phone', 'mobile'],
  phone: ['phone', 'mobile'],
  durationMonths: ['termMonths', 'durationMonths'],
  termMonths: ['termMonths', 'durationMonths'],
  mileagePerYear: ['annualMileage', 'mileagePerYear'],
  annualMileage: ['annualMileage', 'mileagePerYear'],
  vehicleInterestMulti: ['vehicleInterest', 'vehicleInterestMulti'],
  vehicleInterest: ['vehicleInterest', 'vehicleInterestMulti'],
  color: ['preferredColor', 'color', 'exteriorColor'],
  preferredColor: ['preferredColor', 'color', 'exteriorColor'],
  exteriorColor: ['preferredColor', 'color', 'exteriorColor'],
});

function fieldMatches(factField, targetField) {
  const aliases = FIELD_ALIASES[targetField] || [targetField];
  return aliases.includes(factField);
}

function collectFacts(turn = {}) {
  if (Array.isArray(turn.extractedFacts) && turn.extractedFacts.length) {
    return [...turn.extractedFacts];
  }
  if (Array.isArray(turn.sellerFacts) && turn.sellerFacts.length) {
    return [...turn.sellerFacts];
  }
  return [];
}

function findFactIndex(facts, field, label = '') {
  const byField = facts.findIndex((f) => fieldMatches(f?.field, field));
  if (byField >= 0) return byField;
  const needle = String(label || '').trim().toLowerCase();
  if (!needle) return -1;
  return facts.findIndex((f) => String(f?.label || '').trim().toLowerCase() === needle);
}

export function normalizePhoneLiveEdit(value = '') {
  const raw = String(value || '').trim().replace(/\s+/g, ' ');
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 6 || digits.length > 15) {
    return { ok: false, value: raw, error: 'Bitte gültige Telefonnummer' };
  }
  let formatted = raw;
  if (/^0\d+$/.test(digits) && digits.length >= 10) {
    formatted = `${digits.slice(0, 5)} ${digits.slice(5)}`.trim();
  } else if (digits.startsWith('49') && digits.length >= 11) {
    formatted = `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`.trim();
  }
  return { ok: true, value: formatted, error: null };
}

export function normalizeEmailLiveEdit(value = '') {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, value: email, error: 'Bitte gültige E-Mail' };
  }
  return { ok: true, value: email, error: null };
}

export function validateLiveEditValue(field, rawValue) {
  const editor = resolveLiveEditEditor(field);
  if (!editor) return { ok: false, value: rawValue, error: 'Feld nicht editierbar' };
  if (editor === LIVE_EDIT_EDITOR.PHONE) return normalizePhoneLiveEdit(rawValue);
  if (editor === LIVE_EDIT_EDITOR.EMAIL) return normalizeEmailLiveEdit(rawValue);
  if (editor === LIVE_EDIT_EDITOR.NAME || editor === LIVE_EDIT_EDITOR.TEXT) {
    const text = String(rawValue || '').trim();
    if (!text) return { ok: false, value: text, error: 'Bitte Wert eingeben' };
    return { ok: true, value: text, error: null };
  }
  if (editor === LIVE_EDIT_EDITOR.TERM) {
    const n = Number(String(rawValue).replace(/\D/g, ''));
    if (!Number.isFinite(n) || n < 6 || n > 96) {
      return { ok: false, value: rawValue, error: 'Laufzeit 6–96 Monate' };
    }
    return { ok: true, value: n, error: null };
  }
  if (editor === LIVE_EDIT_EDITOR.KM) {
    const n = Number(String(rawValue).replace(/\./g, '').replace(/\s/g, '').replace(/[^\d]/g, ''));
    if (!Number.isFinite(n) || n < 1000 || n > 200000) {
      return { ok: false, value: rawValue, error: 'Kilometer ungültig' };
    }
    return { ok: true, value: n, error: null };
  }
  if (editor === LIVE_EDIT_EDITOR.MONEY) {
    const n = Number(String(rawValue).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''));
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, value: rawValue, error: 'Betrag ungültig' };
    }
    return { ok: true, value: n, error: null };
  }
  if (editor === LIVE_EDIT_EDITOR.PAYMENT) {
    const key = String(rawValue || '').trim().toLowerCase();
    const opt = PAYMENT_OPTIONS.find((p) => (
      p.id === key || p.label.toLowerCase() === key
    ));
    if (!opt) return { ok: false, value: rawValue, error: 'Zahlungsart wählen' };
    return { ok: true, value: opt.id, error: null };
  }
  if (editor === LIVE_EDIT_EDITOR.COLOR || editor === LIVE_EDIT_EDITOR.EQUIPMENT) {
    const text = String(rawValue || '').trim();
    if (!text) return { ok: false, value: text, error: 'Bitte Wert eingeben' };
    return { ok: true, value: text, error: null };
  }
  if (editor === LIVE_EDIT_EDITOR.VEHICLE) {
    const resolved = resolveVerifiedVehicleSelection(rawValue);
    if (!resolved?.label) return { ok: false, value: rawValue, error: 'Modell wählen' };
    return {
      ok: true,
      value: resolved.value,
      label: resolved.label,
      needsConfirmation: Boolean(resolved.needsConfirmation),
      error: null,
    };
  }
  return { ok: true, value: rawValue, error: null };
}

export function formatLiveEditChipLabel(field, value, existingFact = null) {
  const editor = resolveLiveEditEditor(field);
  if (editor === LIVE_EDIT_EDITOR.TERM) {
    return formatIntakeTermChipLabel(value) || `${value} M`;
  }
  if (editor === LIVE_EDIT_EDITOR.KM) {
    return formatIntakeMileageChipLabel(value) || `${Number(value).toLocaleString('de-DE')} km`;
  }
  if (editor === LIVE_EDIT_EDITOR.MONEY) {
    return formatIntakeDownPaymentLabel(value) || `${Number(value).toLocaleString('de-DE')} € AZ`;
  }
  if (editor === LIVE_EDIT_EDITOR.PAYMENT) {
    return PAYMENT_OPTIONS.find((p) => p.id === value)?.label
      || String(existingFact?.label || value || '');
  }
  if (editor === LIVE_EDIT_EDITOR.VEHICLE) {
    if (value && typeof value === 'object') {
      return normalizeVehicleDisplayLabel(value) || String(value.label || '');
    }
    return normalizeVehicleDisplayLabel(value) || String(value || '');
  }
  return String(value ?? existingFact?.label ?? '').trim();
}

function factClassForField(field) {
  const editor = resolveLiveEditEditor(field);
  if (editor === LIVE_EDIT_EDITOR.VEHICLE) return SELLER_FACT_CLASS.VEHICLE_INTEREST;
  if (
    editor === LIVE_EDIT_EDITOR.TERM
    || editor === LIVE_EDIT_EDITOR.KM
    || editor === LIVE_EDIT_EDITOR.MONEY
    || editor === LIVE_EDIT_EDITOR.PAYMENT
  ) {
    return SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE;
  }
  if (editor === LIVE_EDIT_EDITOR.EQUIPMENT) return SELLER_FACT_CLASS.VEHICLE_REQUIREMENT;
  if (editor === LIVE_EDIT_EDITOR.COLOR) return SELLER_FACT_CLASS.VEHICLE_INTEREST;
  return SELLER_FACT_CLASS.CUSTOMER_FACT;
}

function applyIdentityToContact(contact = {}, field, value) {
  const next = { ...contact };
  if (field === 'customerName') {
    next.fullName = String(value || '').trim() || null;
  } else if (field === 'phone' || field === 'mobile') {
    next.phone = String(value || '').trim() || null;
  } else if (field === 'email') {
    next.email = String(value || '').trim() || null;
  }
  return next;
}

function applyResolutionToInbound(inbound, resolution) {
  const status = resolution.status || 'none';
  return {
    ...inbound,
    resolutionStatus: status,
    matchedLeadId: resolution.lead?.id || null,
    matchedLeadName: resolution.lead?.contact?.name
      || resolution.lead?.name
      || null,
    customerSearchResults: resolution.results || [],
    duplicateHint: resolution.duplicateHint || null,
    proposeCreateCustomer: status === 'none' && Boolean(resolution.proposeCreateCustomer),
  };
}

function rebuildReviewModel(turn, { microConfirm = null, highlightChipLabels = [], matchHint = null } = {}) {
  let reviewModel = null;
  if (turn?.inboundLead?.detected) {
    reviewModel = buildInboundLeadReviewModel(turn.inboundLead, turn);
  } else {
    reviewModel = buildUniversalReviewModel(turn);
  }
  if (!reviewModel) return null;
  return {
    ...reviewModel,
    microConfirm,
    highlightChipLabels,
    matchHint,
  };
}

/**
 * Patch one fact in the current turn / working context.
 */
export function patchSellerReviewFact({
  turn = null,
  field,
  value,
  label = null,
  leads = [],
  correctionSource = 'seller',
} = {}) {
  if (!turn || !field || !isLiveEditableField(field)) {
    return { ok: false, error: 'Keine Live-Korrektur möglich' };
  }

  const validated = validateLiveEditValue(field, value);
  if (!validated.ok) {
    return { ok: false, error: validated.error || 'Ungültiger Wert' };
  }

  const facts = collectFacts(turn);
  const idx = findFactIndex(facts, field, label);
  const previousFact = idx >= 0 ? { ...facts[idx] } : null;
  const chipLabel = validated.label
    || formatLiveEditChipLabel(field, validated.value, previousFact)
    || String(label || '').trim();

  const canonicalField = (
    field === 'mobile' ? 'phone'
      : field === 'durationMonths' ? 'termMonths'
        : field === 'mileagePerYear' ? 'annualMileage'
          : field === 'vehicleInterestMulti' ? 'vehicleInterest'
            : (field === 'color' || field === 'exteriorColor') ? 'preferredColor'
              : field
  );

  const nextFact = createExtractedFact({
    factClass: previousFact?.factClass || factClassForField(canonicalField),
    field: canonicalField,
    value: validated.value,
    label: chipLabel,
    source: SELLER_FACT_SOURCE.MANUAL_EDIT,
    confidence: validated.needsConfirmation ? 0.7 : 0.99,
    needsConfirmation: Boolean(validated.needsConfirmation),
    rawExpression: previousFact?.rawExpression || previousFact?.label || null,
    observedAt: previousFact?.observedAt || null,
    canonicalValue: typeof validated.value === 'object' ? validated.value : null,
    previousValue: previousFact
      ? {
        value: previousFact.value,
        label: previousFact.label,
        source: previousFact.source,
        confidence: previousFact.confidence,
        needsConfirmation: previousFact.needsConfirmation,
      }
      : null,
    correctionSource,
    correctedAt: new Date().toISOString(),
  });

  let nextFacts;
  if (idx >= 0) {
    nextFacts = facts.map((f, i) => {
      if (i === idx) return nextFact;
      if (fieldMatches(f?.field, canonicalField) && i !== idx) return null;
      return f;
    }).filter(Boolean);
  } else {
    nextFacts = [...facts, nextFact];
  }

  let inbound = turn.inboundLead?.detected
    ? {
      ...turn.inboundLead,
      contact: { ...(turn.inboundLead.contact || {}) },
    }
    : null;

  let matchHint = null;
  if (inbound && IDENTITY_FIELDS.has(field)) {
    inbound.contact = applyIdentityToContact(inbound.contact, field, validated.value);
    const resolution = resolveInboundCustomer(inbound.contact, leads);
    inbound = applyResolutionToInbound(inbound, resolution);
    if (resolution.status === 'unique' && resolution.lead) {
      const name = resolution.lead?.contact?.name
        || resolution.lead?.name
        || inbound.matchedLeadName
        || 'Kunde';
      matchHint = {
        text: 'Passende Kundenakte gefunden',
        name: String(name).trim(),
      };
    }
  }

  if (canonicalField === 'vehicleInterest' && inbound) {
    inbound = {
      ...inbound,
      currentVehicleCandidate: {
        label: chipLabel,
        value: validated.value,
        correctedAt: nextFact.correctedAt,
      },
      previousVehicleCandidate: previousFact
        ? {
          label: previousFact.label,
          value: previousFact.value,
        }
        : inbound.previousVehicleCandidate || null,
    };
  }

  const undoSnapshot = {
    field: canonicalField,
    previousFact,
    previousInboundContact: turn.inboundLead?.contact
      ? { ...turn.inboundLead.contact }
      : null,
    previousInboundResolution: turn.inboundLead
      ? {
        resolutionStatus: turn.inboundLead.resolutionStatus,
        matchedLeadId: turn.inboundLead.matchedLeadId,
        matchedLeadName: turn.inboundLead.matchedLeadName,
        customerSearchResults: turn.inboundLead.customerSearchResults,
        duplicateHint: turn.inboundLead.duplicateHint,
        proposeCreateCustomer: turn.inboundLead.proposeCreateCustomer,
        currentVehicleCandidate: turn.inboundLead.currentVehicleCandidate || null,
        previousVehicleCandidate: turn.inboundLead.previousVehicleCandidate || null,
      }
      : null,
    previousFacts: facts,
  };

  const lastTurn = {
    ...turn,
    extractedFacts: nextFacts,
    sellerFacts: nextFacts,
    ...(inbound ? { inboundLead: inbound } : {}),
  };

  const microConfirm = buildFactCorrectedMicroConfirm({
    field: canonicalField,
    verb: previousFact ? 'geändert' : 'ergänzt',
  });
  const highlightChipLabels = chipLabel ? [chipLabel] : [];
  const reviewModel = rebuildReviewModel(lastTurn, {
    microConfirm,
    highlightChipLabels,
    matchHint,
  });

  return {
    ok: true,
    lastTurn,
    reviewModel,
    microConfirm,
    highlightChipLabels,
    matchHint,
    undoSnapshot,
  };
}

/**
 * Restore previous current value from a live-edit undo snapshot.
 */
export function undoSellerReviewFactPatch({ turn = null, undoSnapshot = null } = {}) {
  if (!turn || !undoSnapshot?.previousFacts) {
    return { ok: false, error: 'Kein Undo möglich' };
  }
  let inbound = turn.inboundLead?.detected
    ? { ...turn.inboundLead, contact: { ...(turn.inboundLead.contact || {}) } }
    : null;
  if (inbound && undoSnapshot.previousInboundContact) {
    inbound.contact = { ...undoSnapshot.previousInboundContact };
  }
  if (inbound && undoSnapshot.previousInboundResolution) {
    inbound = {
      ...inbound,
      ...undoSnapshot.previousInboundResolution,
    };
  }
  const lastTurn = {
    ...turn,
    extractedFacts: undoSnapshot.previousFacts,
    sellerFacts: undoSnapshot.previousFacts,
    ...(inbound ? { inboundLead: inbound } : {}),
  };
  const reviewModel = rebuildReviewModel(lastTurn, {
    microConfirm: null,
    highlightChipLabels: [],
    matchHint: null,
  });
  return { ok: true, lastTurn, reviewModel };
}

export {
  LIVE_EDIT_EDITOR,
  FIELD_EDITOR_MAP,
  PAYMENT_OPTIONS,
  IDENTITY_FIELDS,
  resolveLiveEditEditor,
  isLiveEditableField,
  liveEditFieldLabel,
  buildEditableFactChip,
  buildFactCorrectedMicroConfirm,
};
