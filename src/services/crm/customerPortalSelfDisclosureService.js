/**
 * Digitale Selbstauskunft im Kundenportal – Interview, Speichern, Status.
 * Speicher: lead.crm.selfDisclosure
 */
import { createInboxItem, INBOX_EVENT_TYPES, INBOX_SOURCE_AREA } from './cleverInboxService.js';
import { UNTERLAGEN_STATUS } from '../cleverUnterlagen.js';

export const SELF_DISCLOSURE_TYPES = {
  PRIVATE: 'private',
  FREELANCER: 'freelancer',
  CORPORATION: 'corporation',
};

export const SELF_DISCLOSURE_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  SUBMITTED: 'submitted',
  REVIEWED: 'reviewed',
  NEEDS_CORRECTION: 'needs_correction',
};

export const SELF_DISCLOSURE_TYPE_LABELS = {
  [SELF_DISCLOSURE_TYPES.PRIVATE]: 'Privatperson',
  [SELF_DISCLOSURE_TYPES.FREELANCER]: 'Freiberufler / Gewerbetreibende',
  [SELF_DISCLOSURE_TYPES.CORPORATION]: 'Firma / Körperschaft',
};

export const SELF_DISCLOSURE_INBOX_TYPE_LABELS = {
  [SELF_DISCLOSURE_TYPES.PRIVATE]: 'Privatperson',
  [SELF_DISCLOSURE_TYPES.FREELANCER]: 'Selbstständig',
  [SELF_DISCLOSURE_TYPES.CORPORATION]: 'Firma',
};

export const SELF_DISCLOSURE_REVIEW_STATUS = {
  PENDING: 'pending',
  REVIEWED: 'reviewed',
  NEEDS_CORRECTION: 'needs_correction',
};

export const SELF_DISCLOSURE_CORRECTION_PRESETS = [
  { sectionId: 'personalData', fieldId: 'birthDate', label: 'Geburtsdatum fehlt' },
  { sectionId: 'employment', fieldId: 'employer', label: 'Arbeitgeber ergänzen' },
  { sectionId: 'income', fieldId: 'netMonthly', label: 'Nettoeinkommen prüfen' },
  { sectionId: 'expenses', fieldId: 'warmRent', label: 'Ausgaben unklar' },
  { sectionId: 'address', fieldId: 'previousAddress', label: 'Vorherige Anschrift fehlt' },
  { sectionId: 'bank', fieldId: 'iban', label: 'IBAN später ergänzen' },
];
const FIELD = (key, label, { required = true, type = 'text' } = {}) => ({
  key, label, required, type,
});

const PRIVATE_STEPS = [
  {
    id: 'personalData',
    title: 'Persönliche Daten',
    sectionKey: 'personalData',
    fields: [
      FIELD('firstName', 'Vorname'),
      FIELD('lastName', 'Name'),
      FIELD('phone', 'Telefon', { type: 'tel' }),
      FIELD('email', 'E-Mail', { type: 'email' }),
      FIELD('birthDate', 'Geburtsdatum', { type: 'date' }),
      FIELD('birthPlace', 'Geburtsort'),
      FIELD('nationality', 'Staatsangehörigkeit'),
    ],
  },
  {
    id: 'address',
    title: 'Adresse & Wohnsituation',
    sectionKey: 'address',
    fields: [
      FIELD('street', 'Straße'),
      FIELD('houseNumber', 'Hausnummer'),
      FIELD('zip', 'PLZ'),
      FIELD('city', 'Ort'),
      FIELD('country', 'Land'),
      FIELD('housingType', 'Miete / Wohneigentum'),
      FIELD('livedOverThreeYears', 'Wohnt seit mehr als 3 Jahren dort', { type: 'yesno' }),
      FIELD('previousAddress', 'Vorherige Anschrift', { required: false }),
    ],
  },
  {
    id: 'family',
    title: 'Familie',
    sectionKey: 'housing',
    fields: [
      FIELD('maritalStatus', 'Familienstand'),
      FIELD('dependentChildren', 'Anzahl unterhaltspflichtiger Kinder', { type: 'number' }),
      FIELD('residencePermit', 'Aufenthaltsgenehmigung', { required: false }),
    ],
  },
  {
    id: 'employment',
    title: 'Arbeit',
    sectionKey: 'employment',
    fields: [
      FIELD('employer', 'Arbeitgeber'),
      FIELD('jobGroup', 'Berufsgruppe'),
      FIELD('employedSince', 'Dort beschäftigt seit', { type: 'date' }),
      FIELD('permanentContract', 'Unbefristetes Arbeitsverhältnis', { type: 'yesno' }),
      FIELD('fixedTermUntil', 'Befristet bis', { required: false, type: 'date' }),
      FIELD('probation', 'Probezeit', { type: 'yesno' }),
      FIELD('probationUntil', 'Probezeit bis', { required: false, type: 'date' }),
    ],
  },
  {
    id: 'income',
    title: 'Einkommen',
    sectionKey: 'income',
    fields: [
      FIELD('netMonthly', 'Monatliches Nettoeinkommen', { type: 'number' }),
      FIELD('capitalIncome', 'Einkünfte aus Kapitalvermögen', { required: false, type: 'number' }),
      FIELD('rentIncome', 'Einkünfte aus Miete/Pacht', { required: false, type: 'number' }),
      FIELD('otherIncome', 'Sonstige Einkünfte', { required: false, type: 'number' }),
      FIELD('spouseIncome', 'Einkünfte Ehepartner', { required: false, type: 'number' }),
    ],
  },
  {
    id: 'expenses',
    title: 'Ausgaben',
    sectionKey: 'expenses',
    fields: [
      FIELD('warmRent', 'Warmmiete/Pacht', { type: 'number' }),
      FIELD('mortgagePayments', 'Raten Immobiliendarlehen', { required: false, type: 'number' }),
      FIELD('loanPayments', 'Raten weiterer Kredite / Leasing', { required: false, type: 'number' }),
      FIELD('otherExpenses', 'Sonstige Ausgaben', { required: false, type: 'number' }),
    ],
  },
  {
    id: 'review',
    title: 'Prüfen & absenden',
    sectionKey: 'declarations',
    fields: [
      FIELD('confirmed', 'Angaben sind vollständig und richtig', { type: 'yesno' }),
    ],
  },
];

const FREELANCER_STEPS = [
  {
    id: 'company',
    title: 'Unternehmensdaten',
    sectionKey: 'company',
    fields: [
      FIELD('companyName', 'Name / Firmierung'),
      FIELD('street', 'Straße'),
      FIELD('houseNumber', 'Hausnummer'),
      FIELD('zip', 'PLZ'),
      FIELD('city', 'Ort'),
      FIELD('country', 'Land'),
      FIELD('legalForm', 'Rechtsform'),
      FIELD('registerType', 'HR-Typ/Nr.'),
      FIELD('registerCourt', 'Handelsregistergericht'),
      FIELD('foundedAt', 'Gründungsdatum', { type: 'date' }),
      FIELD('businessSince', 'Aufnahme der Geschäftstätigkeit', { type: 'date' }),
    ],
  },
  {
    id: 'representative',
    title: 'Persönlich haftender Gesellschafter',
    sectionKey: 'representative',
    fields: [
      FIELD('firstName', 'Vorname'),
      FIELD('lastName', 'Name'),
      FIELD('street', 'Straße'),
      FIELD('houseNumber', 'Hausnummer'),
      FIELD('zip', 'PLZ'),
      FIELD('city', 'Ort'),
      FIELD('phone', 'Telefon', { type: 'tel' }),
      FIELD('email', 'E-Mail', { type: 'email' }),
      FIELD('birthDate', 'Geburtsdatum', { type: 'date' }),
      FIELD('birthPlace', 'Geburtsort'),
      FIELD('maritalStatus', 'Familienstand'),
      FIELD('dependentChildren', 'Kinder', { type: 'number' }),
      FIELD('nationality', 'Staatsangehörigkeit'),
      FIELD('housingType', 'Wohnsituation'),
    ],
  },
  {
    id: 'income',
    title: 'Wirtschaftliche Verhältnisse',
    sectionKey: 'income',
    fields: [
      FIELD('revenueCurrentYear', 'Umsatz laufendes Jahr', { type: 'number' }),
      FIELD('netMonthly', 'Monatliches Nettoeinkommen', { type: 'number' }),
      FIELD('spouseIncome', 'Einkommen Ehepartner', { required: false, type: 'number' }),
      FIELD('capitalAssets', 'Kapitalvermögen', { required: false, type: 'number' }),
      FIELD('rentIncome', 'Miete/Pacht', { required: false, type: 'number' }),
      FIELD('otherIncome', 'Sonstige Einkünfte', { required: false, type: 'number' }),
    ],
  },
  {
    id: 'expenses',
    title: 'Monatliche Ausgaben',
    sectionKey: 'expenses',
    fields: [
      FIELD('warmRent', 'Warmmiete/Pacht', { type: 'number' }),
      FIELD('loanPayments', 'Raten bestehende Kredite / Leasing', { required: false, type: 'number' }),
      FIELD('otherExpenses', 'Sonstige Ausgaben', { required: false, type: 'number' }),
      FIELD('ownerOccupied', 'Selbstgenutztes Wohneigentum', { type: 'yesno' }),
    ],
  },
  {
    id: 'review',
    title: 'Prüfen & absenden',
    sectionKey: 'declarations',
    fields: [
      FIELD('confirmed', 'Angaben sind vollständig und richtig', { type: 'yesno' }),
    ],
  },
];

const CORPORATION_STEPS = [
  {
    id: 'company',
    title: 'Angaben zur Körperschaft',
    sectionKey: 'company',
    fields: [
      FIELD('companyName', 'Name / Firmierung'),
      FIELD('street', 'Straße'),
      FIELD('houseNumber', 'Hausnummer'),
      FIELD('zip', 'PLZ'),
      FIELD('city', 'Ort'),
      FIELD('country', 'Land'),
      FIELD('legalForm', 'Rechtsform'),
      FIELD('registerType', 'HR-Typ/Nr.'),
      FIELD('registerCourt', 'Handelsregistergericht'),
      FIELD('foundedAt', 'Gründungsdatum', { type: 'date' }),
      FIELD('businessSince', 'Aufnahme der Geschäftstätigkeit', { type: 'date' }),
    ],
  },
  {
    id: 'representative',
    title: 'Ansprechpartner',
    sectionKey: 'representative',
    fields: [
      FIELD('firstName', 'Vorname'),
      FIELD('lastName', 'Name'),
      FIELD('birthDate', 'Geburtsdatum', { type: 'date' }),
      FIELD('email', 'E-Mail', { type: 'email' }),
      FIELD('phone', 'Telefon', { type: 'tel' }),
      FIELD('role', 'Funktion'),
    ],
  },
  {
    id: 'financials',
    title: 'Wirtschaftliche Verhältnisse',
    sectionKey: 'income',
    fields: [
      FIELD('balanceDate', 'Bilanzierungsstichtag', { type: 'date' }),
      FIELD('revenuePreviousYear', 'Umsatz Vorjahr', { type: 'number' }),
    ],
  },
  {
    id: 'review',
    title: 'Prüfen & absenden',
    sectionKey: 'declarations',
    fields: [
      FIELD('confirmed', 'Angaben sind vollständig und richtig', { type: 'yesno' }),
    ],
  },
];

export const SELF_DISCLOSURE_STEP_MAP = {
  [SELF_DISCLOSURE_TYPES.PRIVATE]: PRIVATE_STEPS,
  [SELF_DISCLOSURE_TYPES.FREELANCER]: FREELANCER_STEPS,
  [SELF_DISCLOSURE_TYPES.CORPORATION]: CORPORATION_STEPS,
};

const SENSITIVE_SELF_DISCLOSURE_PATTERNS = [
  /\bnettoeinkommen\b/i,
  /\bmonatlich(?:es)?\s+netto\b/i,
  /\beinkommen\b/i,
  /\bgehalt\b/i,
  /\biban\b/i,
  /\bbankverbindung\b/i,
  /\bbonit/i,
  /\bschufa\b/i,
  /\bverdienst\b/i,
  /\bausgaben\b/i,
  /\bkredit\b/i,
  /\bleasingrate\b/i,
];

function uid(prefix = 'sd') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function historyEntry(text) {
  return {
    id: `hist-${uid('sdh')}`,
    at: nowIso(),
    type: 'customer_activity',
    text,
    customerFacing: true,
    meta: { selfDisclosure: true },
  };
}

function internalHistoryEntry(text) {
  return {
    id: `hist-${uid('sdh')}`,
    at: nowIso(),
    type: 'note',
    text,
    customerFacing: false,
    meta: { selfDisclosure: true, internal: true },
  };
}

function emptyReview() {
  return {
    status: SELF_DISCLOSURE_REVIEW_STATUS.PENDING,
    reviewedAt: null,
    reviewedBy: null,
    correctionRequestedAt: null,
    correctionNotes: '',
    internalNote: '',
    correctionFields: [],
  };
}

function formatSelfDisclosureWhen(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `heute ${time}`;
  return `${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${time}`;
}

function formatFieldDisplayValue(field, value) {
  if (field?.type === 'yesno') {
    if (value === true || value === 'yes') return 'Ja';
    if (value === false || value === 'no') return 'Nein';
    return '–';
  }
  const raw = String(value ?? '').trim();
  return raw || '–';
}

function resolveCorrectionStartStepId(selfDisclosure = {}) {
  const fields = selfDisclosure.review?.correctionFields ?? [];
  if (!fields.length) return selfDisclosure.currentStep ?? null;
  const steps = getStepsForType(selfDisclosure.type);
  const first = fields[0];
  const byStep = steps.find((step) => step.id === first.sectionId);
  if (byStep) return byStep.id;
  const bySection = steps.find((step) => step.sectionKey === first.sectionId);
  return bySection?.id ?? steps[0]?.id ?? null;
}

export function buildCorrectionCustomerMessage(correctionFields = [], correctionNotes = '') {
  const lines = (correctionFields ?? []).map((entry) => `• ${entry.label}${entry.note ? ` – ${entry.note}` : ''}`);
  const intro = 'Bitte prüfen Sie noch folgende Angaben in Ihrer Selbstauskunft:';
  const noteBlock = correctionNotes?.trim() ? `\n\n${correctionNotes.trim()}` : '';
  return lines.length
    ? `${intro}\n\n${lines.join('\n')}${noteBlock}`
    : `Bitte prüfen Sie Ihre Selbstauskunft und ergänzen Sie die fehlenden Angaben.${noteBlock}`;
}

export function buildSelfDisclosureReviewModel(lead = {}) {
  const sd = getSelfDisclosure(lead);
  if (!sd?.type) {
    return { visible: false, empty: true };
  }

  const steps = getStepsForType(sd.type).filter((step) => step.id !== 'review');
  const validation = validateSelfDisclosureForSubmit(sd);
  const typeLabel = SELF_DISCLOSURE_TYPE_LABELS[sd.type] ?? sd.type;

  let statusLabel = 'Zur Prüfung';
  if (sd.status === SELF_DISCLOSURE_STATUS.REVIEWED) statusLabel = 'Geprüft';
  if (sd.status === SELF_DISCLOSURE_STATUS.NEEDS_CORRECTION) statusLabel = 'Korrektur angefordert';

  const indicators = [];
  if (sd.type === SELF_DISCLOSURE_TYPES.PRIVATE) {
    indicators.push({
      id: 'netMonthly',
      label: 'Monatliches Nettoeinkommen vorhanden',
      ok: isFieldFilled(sd.sections?.income?.netMonthly),
    });
    indicators.push({
      id: 'expenses',
      label: 'Monatliche Ausgaben vorhanden',
      ok: isFieldFilled(sd.sections?.expenses?.warmRent),
    });
    indicators.push({
      id: 'employer',
      label: 'Arbeitgeber vorhanden',
      ok: isFieldFilled(sd.sections?.employment?.employer),
    });
  } else if (sd.type === SELF_DISCLOSURE_TYPES.FREELANCER) {
    indicators.push({
      id: 'company',
      label: 'Unternehmensdaten vorhanden',
      ok: isFieldFilled(sd.sections?.company?.companyName),
    });
    indicators.push({
      id: 'netMonthly',
      label: 'Nettoeinkommen vorhanden',
      ok: isFieldFilled(sd.sections?.income?.netMonthly),
    });
  } else {
    indicators.push({
      id: 'company',
      label: 'Firmierung vorhanden',
      ok: isFieldFilled(sd.sections?.company?.companyName),
    });
    indicators.push({
      id: 'representative',
      label: 'Ansprechpartner vorhanden',
      ok: isFieldFilled(sd.sections?.representative?.lastName),
    });
  }
  indicators.push({
    id: 'required',
    label: validation.ok ? 'Pflichtfelder vollständig' : 'Pflichtfelder unvollständig',
    ok: validation.ok,
  });

  const sections = steps.map((step) => ({
    id: step.id,
    title: step.title,
    fields: step.fields.map((field) => ({
      key: field.key,
      label: field.label,
      value: sd.sections?.[step.sectionKey]?.[field.key],
      displayValue: formatFieldDisplayValue(field, sd.sections?.[step.sectionKey]?.[field.key]),
      required: field.required,
    })),
  }));

  return {
    visible: true,
    empty: false,
    title: 'Selbstauskunft prüfen',
    customerName: lead.contact?.name ?? '',
    type: sd.type,
    typeLabel,
    status: sd.status,
    statusLabel,
    progress: sd.progress ?? calculateSelfDisclosureProgress(sd),
    submittedAt: sd.submittedAt ?? null,
    submittedAtLabel: formatSelfDisclosureWhen(sd.submittedAt),
    lastSavedAt: sd.lastSavedAt ?? null,
    lastSavedAtLabel: formatSelfDisclosureWhen(sd.lastSavedAt),
    review: sd.review ?? emptyReview(),
    indicators,
    sections,
    canMarkReviewed: sd.status === SELF_DISCLOSURE_STATUS.SUBMITTED,
    canRequestCorrection: sd.status === SELF_DISCLOSURE_STATUS.SUBMITTED,
    correctionPresets: SELF_DISCLOSURE_CORRECTION_PRESETS,
  };
}

export function getSelfDisclosure(lead = {}) {
  return lead?.crm?.selfDisclosure ?? null;
}

export function getStepsForType(type = '') {
  return SELF_DISCLOSURE_STEP_MAP[type] ?? [];
}

export function isSelfDisclosureSensitiveText(text = '') {
  const raw = String(text ?? '').trim();
  if (!raw) return false;
  return SENSITIVE_SELF_DISCLOSURE_PATTERNS.some((pattern) => pattern.test(raw));
}

function emptySections() {
  return {
    personalData: {},
    address: {},
    housing: {},
    employment: {},
    income: {},
    expenses: {},
    company: {},
    representative: {},
    bank: {},
    declarations: {},
  };
}

function isFieldFilled(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return true;
  return String(value).trim().length > 0;
}

export function calculateSelfDisclosureProgress(selfDisclosure = {}) {
  const steps = getStepsForType(selfDisclosure.type);
  if (!steps.length) return 0;

  let total = 0;
  let filled = 0;

  for (const step of steps) {
    if (step.id === 'review') continue;
    const section = selfDisclosure.sections?.[step.sectionKey] ?? {};
    for (const field of step.fields) {
      if (!field.required) continue;
      total += 1;
      if (isFieldFilled(section[field.key])) filled += 1;
    }
  }

  if (!total) return 0;
  return Math.round((filled / total) * 100);
}

export function getStepIndex(steps = [], stepId = '') {
  const idx = steps.findIndex((step) => step.id === stepId);
  return idx >= 0 ? idx : 0;
}

export function validateSelfDisclosureForSubmit(selfDisclosure = {}) {
  const steps = getStepsForType(selfDisclosure.type);
  const missing = [];

  for (const step of steps) {
    const section = selfDisclosure.sections?.[step.sectionKey] ?? {};
    for (const field of step.fields) {
      if (!field.required) continue;
      if (!isFieldFilled(section[field.key])) {
        missing.push({ stepId: step.id, field: field.key, label: field.label });
      }
    }
  }

  const confirmed = selfDisclosure.sections?.declarations?.confirmed;
  if (confirmed !== true && confirmed !== 'yes') {
    missing.push({ stepId: 'review', field: 'confirmed', label: 'Bestätigung' });
  }

  return { ok: missing.length === 0, missing };
}

export function buildSelfDisclosureCardModel(lead = {}) {
  const sd = getSelfDisclosure(lead);
  if (!sd) {
    return {
      visible: true,
      title: 'Selbstauskunft',
      status: SELF_DISCLOSURE_STATUS.NOT_STARTED,
      statusLabel: 'Noch nicht begonnen',
      progress: 0,
      type: null,
      typeLabel: null,
      actionLabel: 'Selbstauskunft starten',
      actionMode: 'start',
      showTypePicker: true,
    };
  }

  const progress = sd.progress ?? calculateSelfDisclosureProgress(sd);
  const typeLabel = SELF_DISCLOSURE_TYPE_LABELS[sd.type] ?? sd.type;

  let statusLabel = 'Noch nicht begonnen';
  let actionLabel = 'Selbstauskunft starten';
  let actionMode = 'start';

  switch (sd.status) {
    case SELF_DISCLOSURE_STATUS.IN_PROGRESS:
      statusLabel = `${progress} % ausgefüllt`;
      actionLabel = 'Weiter ausfüllen';
      actionMode = 'continue';
      break;
    case SELF_DISCLOSURE_STATUS.SUBMITTED:
      statusLabel = 'Abgesendet';
      actionLabel = 'Angaben ansehen';
      actionMode = 'view';
      break;
    case SELF_DISCLOSURE_STATUS.NEEDS_CORRECTION:
      statusLabel = 'Bitte Angaben prüfen';
      actionLabel = 'Korrektur bearbeiten';
      actionMode = 'correct';
      break;
    case SELF_DISCLOSURE_STATUS.REVIEWED:
      statusLabel = 'Geprüft';
      actionLabel = 'Angaben ansehen';
      actionMode = 'view';
      break;
    default:
      break;
  }

  return {
    visible: true,
    title: 'Selbstauskunft',
    status: sd.status,
    statusLabel,
    progress,
    type: sd.type,
    typeLabel,
    actionLabel,
    actionMode,
    showTypePicker: !sd.type,
    lastSavedAt: sd.lastSavedAt ?? null,
  };
}

export function buildDealerSelfDisclosureSummary(lead = {}) {
  const card = buildSelfDisclosureCardModel(lead);
  if (!card.type && card.status === SELF_DISCLOSURE_STATUS.NOT_STARTED) {
    return { label: 'nicht begonnen', progress: 0, status: card.status };
  }
  return {
    label: card.statusLabel,
    progress: card.progress,
    status: card.status,
    typeLabel: card.typeLabel,
    canReview: card.status === SELF_DISCLOSURE_STATUS.SUBMITTED,
  };
}

function mergeSelfDisclosureLead(lead, selfDisclosure) {
  return {
    ...lead,
    updatedAt: nowIso(),
    crm: {
      ...(lead.crm ?? {}),
      selfDisclosure,
    },
  };
}

export function startSelfDisclosure(lead = {}, type = '') {
  if (!Object.values(SELF_DISCLOSURE_TYPES).includes(type)) {
    return { ok: false, error: 'invalid_type' };
  }

  const existing = getSelfDisclosure(lead);
  if (existing?.type && existing.type !== type && existing.status !== SELF_DISCLOSURE_STATUS.NOT_STARTED) {
    return { ok: false, error: 'type_locked' };
  }

  const steps = getStepsForType(type);
  const selfDisclosure = {
    id: existing?.id ?? uid('self-disclosure'),
    type,
    status: SELF_DISCLOSURE_STATUS.IN_PROGRESS,
    progress: 0,
    currentStep: steps[0]?.id ?? 'personalData',
    lastSavedAt: nowIso(),
    submittedAt: null,
    reviewedAt: null,
    source: 'customer_portal',
    sections: existing?.sections ?? emptySections(),
    requiredDocuments: existing?.requiredDocuments ?? [],
    customerVisible: true,
  };
  selfDisclosure.progress = calculateSelfDisclosureProgress(selfDisclosure);

  const nextLead = mergeSelfDisclosureLead(lead, selfDisclosure);
  return {
    ok: true,
    lead: {
      ...nextLead,
      history: [...(lead.history ?? []), historyEntry('Selbstauskunft gestartet')],
    },
    selfDisclosure,
  };
}

export function saveSelfDisclosureStep(lead = {}, { stepId, data = {}, advance = true } = {}) {
  const existing = getSelfDisclosure(lead);
  if (!existing?.type) {
    return { ok: false, error: 'not_started' };
  }
  if ([SELF_DISCLOSURE_STATUS.SUBMITTED, SELF_DISCLOSURE_STATUS.REVIEWED].includes(existing.status)) {
    return { ok: false, error: 'read_only' };
  }

  const steps = getStepsForType(existing.type);
  const step = steps.find((entry) => entry.id === stepId);
  if (!step) return { ok: false, error: 'invalid_step' };

  const sections = {
    ...emptySections(),
    ...(existing.sections ?? {}),
    [step.sectionKey]: {
      ...(existing.sections?.[step.sectionKey] ?? {}),
      ...data,
    },
  };

  const stepIdx = getStepIndex(steps, stepId);
  const nextStep = steps[Math.min(stepIdx + 1, steps.length - 1)]?.id ?? stepId;

  const selfDisclosure = {
    ...existing,
    status: SELF_DISCLOSURE_STATUS.IN_PROGRESS,
    sections,
    currentStep: advance ? nextStep : stepId,
    lastSavedAt: nowIso(),
  };
  selfDisclosure.progress = calculateSelfDisclosureProgress(selfDisclosure);

  return {
    ok: true,
    lead: mergeSelfDisclosureLead(lead, selfDisclosure),
    selfDisclosure,
    nextStep,
  };
}

export function buildSelfDisclosureInboxItem(lead = {}, selfDisclosure = {}, { resubmit = false } = {}) {
  const typeLabel = SELF_DISCLOSURE_INBOX_TYPE_LABELS[selfDisclosure.type]
    ?? SELF_DISCLOSURE_TYPE_LABELS[selfDisclosure.type]
    ?? 'Selbstauskunft';
  const submittedAt = selfDisclosure.submittedAt ?? nowIso();
  return createInboxItem({
    type: INBOX_EVENT_TYPES.SELF_DISCLOSURE_SUBMITTED,
    title: resubmit ? 'Selbstauskunft erneut eingereicht' : 'Selbstauskunft eingereicht',
    message: `Typ: ${typeLabel}`,
    customerId: lead.id,
    customerName: lead.contact?.name ?? '',
    leadId: lead.id,
    sourceArea: INBOX_SOURCE_AREA.DOCUMENTS,
    actionLabel: 'Prüfen',
    actionTarget: 'self_disclosure_review',
    metadata: {
      dedupeKey: `self-disclosure:${lead.id}:${selfDisclosure.id}:${submittedAt}`,
      selfDisclosureId: selfDisclosure.id,
      selfDisclosureType: selfDisclosure.type,
      resubmit,
    },
  });
}

export function submitSelfDisclosure(lead = {}) {
  const existing = getSelfDisclosure(lead);
  if (!existing?.type) {
    return { ok: false, error: 'not_started' };
  }
  if (existing.status === SELF_DISCLOSURE_STATUS.SUBMITTED) {
    return { ok: false, error: 'already_submitted' };
  }

  const validation = validateSelfDisclosureForSubmit(existing);
  if (!validation.ok) {
    return { ok: false, error: 'incomplete', missing: validation.missing };
  }

  const now = nowIso();
  const resubmit = existing.status === SELF_DISCLOSURE_STATUS.NEEDS_CORRECTION;
  const selfDisclosure = {
    ...existing,
    status: SELF_DISCLOSURE_STATUS.SUBMITTED,
    progress: 100,
    submittedAt: now,
    lastSavedAt: now,
    currentStep: 'review',
    review: {
      ...(existing.review ?? emptyReview()),
      status: SELF_DISCLOSURE_REVIEW_STATUS.PENDING,
      correctionRequestedAt: null,
      correctionFields: resubmit ? (existing.review?.correctionFields ?? []) : [],
      correctionNotes: resubmit ? (existing.review?.correctionNotes ?? '') : '',
    },
  };

  const unterlagen = lead.crm?.cleverUnterlagen ?? { items: {} };
  let nextLead = mergeSelfDisclosureLead(lead, selfDisclosure);
  nextLead = {
    ...nextLead,
    crm: {
      ...nextLead.crm,
      cleverUnterlagen: {
        ...unterlagen,
        items: {
          ...(unterlagen.items ?? {}),
          selbstauskunft: {
            ...(unterlagen.items?.selbstauskunft ?? {}),
            status: UNTERLAGEN_STATUS.uploaded.id,
            source: 'customer_portal',
            submittedAt: now,
          },
        },
        selbstauskunft: {
          ...(unterlagen.selbstauskunft ?? {}),
          status: 'completed',
          submittedAt: now,
          source: 'customer_portal',
        },
        updatedAt: now,
      },
    },
    history: [
      ...(lead.history ?? []),
      historyEntry(resubmit ? 'Selbstauskunft erneut abgesendet' : 'Selbstauskunft abgesendet'),
    ],
  };

  const inboxItem = buildSelfDisclosureInboxItem(nextLead, selfDisclosure, { resubmit });

  return {
    ok: true,
    lead: nextLead,
    selfDisclosure,
    inboxItem,
  };
}

export function buildSelfDisclosureInterviewModel(lead = {}) {
  const sd = getSelfDisclosure(lead);
  if (!sd?.type) {
    return {
      needsTypeSelection: true,
      types: Object.entries(SELF_DISCLOSURE_TYPE_LABELS).map(([id, label]) => ({ id, label })),
    };
  }

  const steps = getStepsForType(sd.type);
  const correctionStart = sd.status === SELF_DISCLOSURE_STATUS.NEEDS_CORRECTION
    ? resolveCorrectionStartStepId(sd)
    : null;
  const activeStepId = correctionStart ?? sd.currentStep;
  const currentIdx = getStepIndex(steps, activeStepId);
  const currentStep = steps[currentIdx] ?? steps[0];
  const readOnly = sd.status === SELF_DISCLOSURE_STATUS.SUBMITTED
    || sd.status === SELF_DISCLOSURE_STATUS.REVIEWED;

  return {
    needsTypeSelection: false,
    selfDisclosure: sd,
    typeLabel: SELF_DISCLOSURE_TYPE_LABELS[sd.type],
    correctionNotice: sd.status === SELF_DISCLOSURE_STATUS.NEEDS_CORRECTION
      ? 'Das Autohaus bittet Sie, folgende Angaben zu prüfen.'
      : null,
    correctionItems: sd.review?.correctionFields ?? [],
    correctionMessage: sd.status === SELF_DISCLOSURE_STATUS.NEEDS_CORRECTION
      ? buildCorrectionCustomerMessage(sd.review?.correctionFields ?? [], sd.review?.correctionNotes ?? '')
      : null,
    steps: steps.map((step, index) => ({
      id: step.id,
      title: step.title,
      index,
      reached: index <= currentIdx || sd.status === SELF_DISCLOSURE_STATUS.SUBMITTED,
    })),
    currentStep: {
      ...currentStep,
      index: currentIdx,
      values: sd.sections?.[currentStep.sectionKey] ?? {},
    },
    progress: sd.progress ?? calculateSelfDisclosureProgress(sd),
    readOnly,
    isLastStep: currentStep?.id === 'review',
    isFirstStep: currentIdx === 0,
  };
}

export function markSelfDisclosureReviewed(lead = {}, { reviewedBy = null, internalNote = '' } = {}) {
  const existing = getSelfDisclosure(lead);
  if (!existing?.type) return { ok: false, error: 'not_started' };
  if (existing.status !== SELF_DISCLOSURE_STATUS.SUBMITTED) {
    return { ok: false, error: 'invalid_status' };
  }

  const now = nowIso();
  const selfDisclosure = {
    ...existing,
    status: SELF_DISCLOSURE_STATUS.REVIEWED,
    reviewedAt: now,
    review: {
      ...(existing.review ?? emptyReview()),
      status: SELF_DISCLOSURE_REVIEW_STATUS.REVIEWED,
      reviewedAt: now,
      reviewedBy,
      internalNote: String(internalNote ?? '').trim() || existing.review?.internalNote || '',
    },
  };

  const nextLead = {
    ...mergeSelfDisclosureLead(lead, selfDisclosure),
    history: [
      ...(lead.history ?? []),
      internalHistoryEntry('Selbstauskunft geprüft'),
    ],
  };

  return { ok: true, lead: nextLead, selfDisclosure };
}

export function requestSelfDisclosureCorrection(lead = {}, {
  correctionFields = [],
  correctionNotes = '',
  internalNote = '',
  reviewedBy = null,
} = {}) {
  const existing = getSelfDisclosure(lead);
  if (!existing?.type) return { ok: false, error: 'not_started' };
  if (existing.status !== SELF_DISCLOSURE_STATUS.SUBMITTED) {
    return { ok: false, error: 'invalid_status' };
  }

  const now = nowIso();
  const normalizedFields = (correctionFields ?? []).map((entry) => ({
    sectionId: entry.sectionId,
    fieldId: entry.fieldId,
    label: entry.label,
    note: entry.note ?? '',
  }));
  const startStepId = resolveCorrectionStartStepId({
    ...existing,
    review: { correctionFields: normalizedFields },
  });

  const selfDisclosure = {
    ...existing,
    status: SELF_DISCLOSURE_STATUS.NEEDS_CORRECTION,
    currentStep: startStepId ?? existing.currentStep,
    review: {
      ...(existing.review ?? emptyReview()),
      status: SELF_DISCLOSURE_REVIEW_STATUS.NEEDS_CORRECTION,
      correctionRequestedAt: now,
      correctionNotes: String(correctionNotes ?? '').trim(),
      internalNote: String(internalNote ?? '').trim(),
      correctionFields: normalizedFields,
      reviewedBy,
    },
  };
  selfDisclosure.progress = calculateSelfDisclosureProgress(selfDisclosure);

  const customerMessageDraft = buildCorrectionCustomerMessage(normalizedFields, correctionNotes);

  const nextLead = {
    ...mergeSelfDisclosureLead(lead, selfDisclosure),
    history: [
      ...(lead.history ?? []),
      internalHistoryEntry('Korrektur zur Selbstauskunft angefordert'),
    ],
  };

  return {
    ok: true,
    lead: nextLead,
    selfDisclosure,
    customerMessageDraft,
  };
}

export function applyMarkSelfDisclosureReviewed(lead = {}, options = {}) {
  const result = markSelfDisclosureReviewed(lead, options);
  if (!result.ok) return result;
  return {
    ok: true,
    lead: result.lead,
    selfDisclosure: result.selfDisclosure,
    leadPatch: {
      crm: result.lead.crm,
      updatedAt: result.lead.updatedAt,
    },
    historyText: 'Selbstauskunft geprüft',
  };
}

export function applyRequestSelfDisclosureCorrection(lead = {}, options = {}) {
  const result = requestSelfDisclosureCorrection(lead, options);
  if (!result.ok) return result;
  return {
    ok: true,
    lead: result.lead,
    selfDisclosure: result.selfDisclosure,
    customerMessageDraft: result.customerMessageDraft,
    leadPatch: {
      crm: result.lead.crm,
      updatedAt: result.lead.updatedAt,
    },
    historyText: 'Korrektur zur Selbstauskunft angefordert',
  };
}
