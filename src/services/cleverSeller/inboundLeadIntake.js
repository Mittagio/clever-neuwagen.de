/**
 * Leichter Seller-Inbound: Paste/Forward im Composer.
 * Propose → Confirm → Action – kein Auto-Persist ohne Accept.
 * Seller Facts ≠ Customer Truth; kein zweiter CRM-Store.
 */
import { normalizeLead } from '../../logic/leadNormalization.js';
import { createCustomerId } from '../dealerAiCustomer.js';
import { buildDefaultCrm } from '../dealerAiLeadCrm.js';
import { parseCustomerPhone } from '../dealerAiParser.js';
import {
  isLikelyCustomerMail,
  isLikelyDealerEmail,
  parseForwardBlock,
  preprocessCustomerMail,
  splitCustomerName,
} from '../dealerAiMailExtractor.js';
import {
  buildCustomerSearchResult,
  searchCustomers,
} from '../crm/customerSearchService.js';
import { SELLER_FACT_CLASS, SELLER_FACT_SOURCE, SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { createExtractedFact } from './cleverSellerTurnResultSchema.js';
import { normalizeVehicleDisplayLabel } from './normalizeVehicleDisplayLabel.js';
import { buildComposerTaskTitle } from './composerSurfaceState.js';
import { buildEditableFactChip, isLiveEditableField } from './liveEditFactMeta.js';

const SELLER_COMMAND_START = /^(?:öffne|zeige|zeig|finde|suche|erstell|mach|schreib|sag|was\s+|wann\s+|wie\s+|schlag|bereite)/i;

/** Händler-Notiz / Lead-Dump: Fahrzeug- oder Konditions-Signale */
const STRUCTURED_LEAD_VEHICLE_CUE = /\b(?:ev\s?[3469]|picanto|sportage|xceed|ceed|niro|sorento|soul|stonic|kia|suzuki|vitara|swift|s-?cross|corporate\s+benefits|leasing|finanzierung|barzahlung|\bbar\b|liefertermin|wunschtermin|november|dezember|januar|februar)\b/i;

const STRUCTURED_LEAD_NAME_LABEL = /^(?:Name|Kunde|Interessent|Kontakt)\s*:\s*(.+)$/im;

/** Meta-/Status-Labels – nie als Clever-„Erkannt“-Fact-Chips */
export const INTAKE_META_CHIP_LABELS = new Set([
  'Unsicher erkannt',
  'Mehrere Treffer',
  'Notiz übernommen',
  'Neu anlegen',
  'Kunde noch offen',
  'Kunde (offen)',
]);

/** Bank-/Leasing-/Service-Mails aus Angebots-PDFs – nie Kunden-Match-Key */
const INSTITUTIONAL_EMAIL_RE = [
  /@lease\.kiafinance\./i,
  /kiafinance/i,
  /^kundenservice@/i,
  /@(?:vwfs|volkswagenbank|santander(?:-?consumer)?|aldautomotive|leaseplan|arval|alphabet(?:-?leasing)?|sixt-?leasing|deutsche-?leasing)\b/i,
  /@(?:[^@]+\.)?(?:lease|leasing)\.[a-z]{2,}$/i,
  /^(?:noreply|no-reply)@/i,
];

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

/**
 * Institutions-/Bank-/Leasing-Kontakt (kein Endkunde).
 * @param {string} [email]
 */
export function isInstitutionalContactEmail(email = '') {
  const lower = normalizeEmail(email);
  if (!lower || !lower.includes('@')) return false;
  if (isLikelyDealerEmail(lower)) return true;
  return INSTITUTIONAL_EMAIL_RE.some((re) => re.test(lower));
}

/**
 * Name aus strukturierter Lead-Notiz (Name:-Label, „Vorname Nachname“ &lt;mail&gt;, erste Namenszeile).
 * @param {string} raw
 */
export function extractStructuredLeadName(raw = '') {
  const text = String(raw || '').replace(/\r\n/g, '\n').trim();
  if (!text) return null;

  const labeled = text.match(STRUCTURED_LEAD_NAME_LABEL);
  if (labeled?.[1]) {
    const cleaned = labeled[1].replace(/<[^>]+>/g, '').trim();
    if (cleaned.length >= 3) return cleaned;
  }

  const angle = text.match(
    /['"]([A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+)+)['"]\s*<[^>\s]+@[^>\s]+>/,
  ) || text.match(
    /\b([A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+)+)\s*<[^>\s]+@[^>\s]+>/,
  );
  if (angle?.[1]) return angle[1].trim();

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 8);
  for (const line of lines) {
    if (/^(?:von|from|betreff|subject|an|to|gesendet|sent|email|e-?mail|tel|telefon|phone)\b/i.test(line)) {
      continue;
    }
    if (STRUCTURED_LEAD_NAME_LABEL.test(line)) continue;
    if (/@/.test(line) || /\d{5,}/.test(line)) continue;
    if (STRUCTURED_LEAD_VEHICLE_CUE.test(line) && !/\s/.test(line.trim())) continue;
    // „Alexander Schlayer“ oder „Schlayer Alexander Aalen“
    if (/^[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){1,3}$/.test(line)
      && line.length <= 60) {
      return line;
    }
  }
  return null;
}

/**
 * Händler-Lead-Notiz ohne Mail-Header (Name + Kontakt + Fahrzeug/Kondition).
 * @param {string} text
 */
export function isStructuredLeadNote(text = '') {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim();
  if (raw.length < 50) return false;
  if (SELLER_COMMAND_START.test(raw)) return false;

  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 4) return false;

  const emails = [...raw.matchAll(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g)]
    .map((m) => m[1].toLowerCase());
  const hasCustomerEmail = emails.some((e) => !isInstitutionalContactEmail(e));
  const hasPhone = Boolean(
    parseCustomerPhone(raw)
    || /(?:^|[^\d])(\+49[\s/-]?\d{2,5}[\s/-]?\d{3,10}|0\d{2,4}[\s/-]?\d{3,10})\b/m.test(raw),
  );
  const hasName = Boolean(
    STRUCTURED_LEAD_NAME_LABEL.test(raw) || extractStructuredLeadName(raw),
  );
  const hasVehicleOrDeal = STRUCTURED_LEAD_VEHICLE_CUE.test(raw);

  // Mindestens Kontakt + (Name oder Deal-Signal), damit reine Mail-Signaturen nicht greifen
  if (!(hasCustomerEmail || hasPhone)) return false;
  if (!(hasName || hasVehicleOrDeal)) return false;
  // Mindestens zwei der drei Signale (Name / Kontakt schon, + Deal oder Label-Struktur)
  const score = Number(hasName) + Number(hasCustomerEmail || hasPhone) + Number(hasVehicleOrDeal);
  return score >= 2 && (hasName || hasVehicleOrDeal);
}

function normalizePhoneDigits(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function phoneMatches(a, b) {
  const left = normalizePhoneDigits(a);
  const right = normalizePhoneDigits(b);
  if (!left || !right || left.length < 8 || right.length < 8) return false;
  return left === right
    || left.endsWith(right.slice(-8))
    || right.endsWith(left.slice(-8));
}

/**
 * Erkennt Paste/Forward einer Kundenanfrage (kein Seller-Befehl, kein Freitext-Dump).
 * @param {string} text
 */
export function isInboundLeadPaste(text = '') {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim();
  if (raw.length < 40) return false;
  if (SELLER_COMMAND_START.test(raw)) return false;

  const hasForward = /-----Ursprüngliche Nachricht-----|Forwarded message|Weitergeleitete Nachricht|Begin forwarded message|Anfang der weitergeleiteten Nachricht/i.test(raw);
  const hasMailHeaders = /\b(?:Von|From):\s*.+/i.test(raw)
    && /\b(?:Betreff|Subject):\s*.+/i.test(raw);
  const explicitCue = /\b(?:hier\s+(?:eine\s+)?(?:anfrage|e-?mail|mail)|weitergeleitet|fwd:|wg:)\b/i.test(raw);
  if (hasForward || hasMailHeaders || explicitCue) return true;

  // Händler-Notizblatt (Name + Mail/Tel + Fahrzeug/Kondition) ohne klassischen Forward
  if (isStructuredLeadNote(raw)) return true;

  // Fallback nur bei klarer Mail (Adresse + Gruß), nicht bei Notizzettel-Dumps mit „Leasing“
  const hasEmail = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/.test(raw);
  const hasGreeting = /mit freundlichen grüßen|viele grüße|beste grüße|guten tag[,!]|hallo[,!]/i.test(raw);
  return hasEmail && hasGreeting && raw.split('\n').length >= 5 && isLikelyCustomerMail(raw);
}

/**
 * Kontakt aus Paste/Forward extrahieren (Mail-Header bevorzugt).
 * E-Mail aus Rohtext – cleanMailHtmlArtifacts entfernt sonst `<email@…>`.
 * @param {string} text
 */
export function extractInboundContact(text = '') {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim();
  const forwardRaw = parseForwardBlock(raw);
  const mail = preprocessCustomerMail(raw);
  const phone = parseCustomerPhone(mail.inquiryText || raw)
    || parseCustomerPhone(mail.signatureBlock || '')
    || parseCustomerPhone(raw)
    || (() => {
      const m = raw.match(/(?:^|[^\d])(\+49[\s/-]?\d{2,5}[\s/-]?\d{3,10}|0\d{2,4}[\s/-]?\d{3,10})\b/m);
      if (!m) return null;
      const digits = m[1].replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 13 ? m[1].trim() : null;
    })()
    || null;
  const structuredName = extractStructuredLeadName(raw);
  const name = mail.customerName || forwardRaw?.fromName || structuredName || null;
  const nameParts = splitCustomerName(name);

  let email = forwardRaw?.fromEmail || mail.customerEmail || null;
  if (email && isInstitutionalContactEmail(email)) {
    email = null;
  }
  if (!email) {
    const emails = [...raw.matchAll(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g)]
      .map((m) => m[1].toLowerCase());
    email = emails.find((e) => !isInstitutionalContactEmail(e)) || null;
  }

  const sourceHint = (mail.isForwarded || forwardRaw)
    ? 'forwarded_mail'
    : (isStructuredLeadNote(raw)
      ? 'structured_lead_note'
      : (email ? 'customer_mail' : 'pasted_inquiry'));

  return {
    fullName: name || nameParts.fullName || null,
    firstName: nameParts.firstName || null,
    lastName: nameParts.lastName || null,
    salutation: nameParts.salutation || null,
    email,
    phone,
    subject: mail.subject || forwardRaw?.subject || null,
    inquiryText: mail.inquiryText || raw,
    isForwarded: Boolean(mail.isForwarded || forwardRaw),
    sourceHint,
  };
}

/**
 * Kontakt → Facts (Seller Facts, Confirm-pflichtig wo nötig).
 * @param {object} contact
 */
export function buildInboundContactFacts(contact = {}) {
  const facts = [];
  if (contact.fullName) {
    facts.push(createExtractedFact({
      factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
      field: 'customerName',
      value: contact.fullName,
      label: contact.fullName,
      source: SELLER_FACT_SOURCE.CUSTOMER_MESSAGE,
      confidence: 0.9,
      needsConfirmation: true,
    }));
  }
  if (contact.email) {
    facts.push(createExtractedFact({
      factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
      field: 'email',
      value: contact.email,
      label: contact.email,
      source: SELLER_FACT_SOURCE.CUSTOMER_MESSAGE,
      confidence: 0.94,
      needsConfirmation: true,
    }));
  }
  if (contact.phone) {
    const digits = normalizePhoneDigits(contact.phone);
    facts.push(createExtractedFact({
      factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
      field: 'phone',
      value: digits || contact.phone,
      label: String(contact.phone).trim(),
      source: SELLER_FACT_SOURCE.CUSTOMER_MESSAGE,
      confidence: 0.92,
      needsConfirmation: true,
    }));
  }
  return facts;
}

/**
 * Kunde per E-Mail / Telefon / Name gegen Snapshot auflösen.
 * @param {object} contact
 * @param {object[]} leads
 */
export function resolveInboundCustomer(contact = {}, leads = []) {
  const list = Array.isArray(leads) ? leads : [];
  const rawEmail = normalizeEmail(contact.email);
  // Institutions-/Bank-Mails nie als Kunden-Match-Key
  const email = rawEmail && !isInstitutionalContactEmail(rawEmail) ? rawEmail : '';
  const phone = contact.phone;
  const name = String(contact.fullName || contact.lastName || '').trim();

  const byEmail = [];
  const byPhone = [];
  if (email) {
    for (const lead of list) {
      if (normalizeEmail(lead?.contact?.email) === email) {
        byEmail.push(lead);
      }
    }
  }
  if (phone) {
    for (const lead of list) {
      if (phoneMatches(phone, lead?.contact?.phone)) {
        byPhone.push(lead);
      }
    }
  }

  const enrich = (lead, reasons) => ({
    ...buildCustomerSearchResult(lead),
    matchReasons: reasons,
    matchReason: reasons.join(' · '),
    sourceType: 'inbound_match',
    customerId: lead.id,
    lead,
  });

  if (byEmail.length === 1) {
    const lead = byEmail[0];
    const reasons = ['E-Mail stimmt überein'];
    if (byPhone.some((l) => l.id === lead.id)) reasons.push('Telefon stimmt überein');
    return {
      status: 'unique',
      lead,
      results: [enrich(lead, reasons)],
      duplicateHint: null,
      proposeCreateCustomer: false,
    };
  }

  if (byEmail.length > 1) {
    return {
      status: 'ambiguous',
      lead: null,
      results: byEmail.map((l) => enrich(l, ['E-Mail stimmt überein'])),
      duplicateHint: 'Mehrere Kunden mit derselben E-Mail – bitte prüfen.',
      proposeCreateCustomer: false,
    };
  }

  if (byPhone.length === 1) {
    return {
      status: 'unique',
      lead: byPhone[0],
      results: [enrich(byPhone[0], ['Telefon stimmt überein'])],
      duplicateHint: null,
      proposeCreateCustomer: false,
    };
  }

  if (byPhone.length > 1) {
    return {
      status: 'ambiguous',
      lead: null,
      results: byPhone.map((l) => enrich(l, ['Telefon stimmt überein'])),
      duplicateHint: 'Mehrere Kunden mit derselben Telefonnummer – bitte prüfen.',
      proposeCreateCustomer: false,
    };
  }

  if (name) {
    const query = contact.lastName || name.split(/\s+/).slice(-1)[0] || name;
    const hits = searchCustomers(query, list, { limit: 6 });
    const enriched = hits.map((hit) => {
      const lead = list.find((l) => l.id === hit.leadId) || null;
      return {
        ...hit,
        matchReasons: [`Name passt zu „${query}“`],
        matchReason: `Name passt zu „${query}“`,
        sourceType: 'inbound_match',
        customerId: hit.leadId,
        lead,
      };
    }).filter((r) => r.lead);

    if (enriched.length === 1) {
      return {
        status: 'unique',
        lead: enriched[0].lead,
        results: enriched,
        duplicateHint: email || phone
          ? 'Name gefunden – E-Mail/Telefon weichen ab. Bitte Dublette prüfen.'
          : null,
        proposeCreateCustomer: false,
      };
    }
    if (enriched.length > 1) {
      return {
        status: 'ambiguous',
        lead: null,
        results: enriched,
        duplicateHint: 'Mehrere Namens-Treffer – bitte einen Kunden wählen.',
        proposeCreateCustomer: false,
      };
    }
  }

  return {
    status: 'none',
    lead: null,
    results: [],
    duplicateHint: null,
    // Institutions-Mail zählt nicht als Kundenkontakt für „Neu anlegen“
    proposeCreateCustomer: Boolean(contact.fullName || email || contact.phone),
  };
}

/**
 * Vorgeschlagene nächste Aktion (nur Proposal).
 * @param {{ text?: string, facts?: object[] }} params
 */
export function proposeInboundNextAction({ text = '', facts = [] } = {}) {
  const t = String(text || '').toLowerCase();
  const hasAppointment = facts.some((f) => f.factClass === SELLER_FACT_CLASS.APPOINTMENT_FACT)
    || /\bprobefahrt|termin|rückruf|rueckruf\b/i.test(t);
  const hasOffer = facts.some((f) => (
    f.factClass === SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE
    || f.field === 'commercialScenarios'
    || f.field === 'monthlyBudget'
  )) || /\b(?:leasing|finanzierung|angebot|rate|€\s*\/\s*monat)\b/i.test(t);

  if (hasAppointment) {
    return {
      type: SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT,
      label: 'Terminvorschlag / Rückruf vorbereiten',
      intent: SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT,
    };
  }
  if (hasOffer) {
    return {
      type: SELLER_TURN_INTENTS.PREPARE_OFFER,
      label: 'Angebot vorbereiten',
      intent: SELLER_TURN_INTENTS.PREPARE_OFFER,
    };
  }
  return {
    type: SELLER_TURN_INTENTS.DRAFT_MESSAGE,
    label: 'Antwortnachricht vorbereiten',
    intent: SELLER_TURN_INTENTS.DRAFT_MESSAGE,
  };
}

/**
 * Vollständiges Inbound-Proposal für Turn/Review.
 */
export function buildInboundLeadProposal({
  contact = {},
  resolution = {},
  facts = [],
  nextAction = null,
  rawText = '',
} = {}) {
  const status = resolution.status || 'none';
  const proposeCreate = status === 'none' && Boolean(resolution.proposeCreateCustomer);
  return {
    detected: true,
    contact: {
      fullName: contact.fullName || null,
      email: contact.email || null,
      phone: contact.phone || null,
      subject: contact.subject || null,
      sourceHint: contact.sourceHint || null,
      isForwarded: Boolean(contact.isForwarded),
    },
    resolutionStatus: status,
    matchedLeadId: resolution.lead?.id || null,
    matchedLeadName: resolution.lead?.contact?.name || resolution.lead?.name || null,
    customerSearchResults: resolution.results || [],
    duplicateHint: resolution.duplicateHint || null,
    proposeCreateCustomer: proposeCreate,
    nextAction: nextAction || proposeInboundNextAction({ text: rawText, facts }),
    factLabels: (facts || [])
      .filter((f) => f.factClass !== SELLER_FACT_CLASS.MESSAGE_INSTRUCTION)
      .map((f) => f.label)
      .filter(Boolean)
      .slice(0, 12),
  };
}

/**
 * Lead-Entwurf – nur nach Seller-Accept anlegen.
 */
export function buildInboundLeadDraft(contact = {}, options = {}) {
  const now = new Date().toISOString();
  const name = contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Neuer Kunde';
  const customerId = options.customerId || createCustomerId();
  return normalizeLead({
    id: options.id || `lead-inbound-${Date.now()}`,
    customerId,
    createdAt: now,
    updatedAt: now,
    status: 'neu',
    source: 'composer_inbound',
    dealerId: options.dealerId || 'autohaus-trinkle',
    name,
    contact: {
      name,
      email: contact.email || '',
      phone: contact.phone || '',
      preferredContact: contact.phone ? 'phone' : 'email',
    },
    vehicle: {
      brand: 'Kia',
      model: '',
      label: 'Kia – Modell offen',
    },
    paymentType: 'unknown',
    wish: {
      paymentType: 'unknown',
    },
    notes: contact.subject
      ? `Inbound: ${contact.subject}`
      : 'Inbound über Composer (Paste/Forward)',
    crm: buildDefaultCrm({}),
    history: [{
      id: `h-inbound-${Date.now()}`,
      at: now,
      type: 'system',
      text: 'Kundenakte aus Composer-Inbound vorgeschlagen und bestätigt',
    }],
  });
}

const INTAKE_CONTACT_FIELDS = new Set(['customerName', 'email', 'phone', 'salutation']);
const INTAKE_CORE_FIELDS = new Set([
  'vehicleInterest',
  'vehicleInterestMulti',
  'paymentType',
  'termMonths',
  'durationMonths',
  'annualMileage',
  'mileagePerYear',
  'downPayment',
]);

function pickIntakeFact(facts = [], field) {
  return (facts || []).find((f) => f?.field === field) || null;
}

/** Max. kontextuelle Suggest-Actions (Soft Need / Unsicherheit / Business Step). */
export const INTAKE_NEXT_ACTION_MAX = 3;

const MODEL_CHECK_CONFIDENCE = 0.85;

function resolveIntakeTurnFacts(turn = {}) {
  if (Array.isArray(turn.extractedFacts) && turn.extractedFacts.length) {
    return turn.extractedFacts;
  }
  if (Array.isArray(turn.sellerFacts) && turn.sellerFacts.length) {
    return turn.sellerFacts;
  }
  return [];
}

function hasIntakePhone(inbound = {}, facts = []) {
  return Boolean(String(inbound?.contact?.phone || '').trim())
    || facts.some((f) => f?.field === 'phone' || f?.field === 'mobile');
}

function pickIntakeVehicleFact(facts = []) {
  return pickIntakeFact(facts, 'vehicleInterest')
    || pickIntakeFact(facts, 'vehicleInterestMulti');
}

/** Modell prüfen nur bei Unsicherheit – nicht bei klar erkanntem EV2 Earth o. ä. */
export function intakeVehicleNeedsModelCheck(fact) {
  if (!fact) return false;
  const confidence = Number(fact.confidence ?? 1);
  if (fact.value?.ambiguous || fact.ambiguous) return true;
  if (fact.field === 'vehicleInterestMulti') {
    const vals = Array.isArray(fact.value) ? fact.value : [];
    if (vals.length > 1) return true;
    if (/\boder\b|\//i.test(String(fact.label || ''))) return true;
  }
  if (fact.needsConfirmation && confidence < MODEL_CHECK_CONFIDENCE) return true;
  if (confidence < 0.75) return true;
  return false;
}

function hasEnoughDealFactsForOffer(facts = []) {
  if (!pickIntakeVehicleFact(facts)) return false;
  return facts.some((f) => (
    f?.field === 'paymentType'
    || f?.field === 'termMonths'
    || f?.field === 'durationMonths'
    || f?.field === 'annualMileage'
    || f?.field === 'mileagePerYear'
    || f?.field === 'monthlyBudget'
    || f?.field === 'commercialScenarios'
    || f?.field === 'downPayment'
    || f?.factClass === SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE
  ));
}

function resolveIntakeActionCustomerName(inbound = {}, turn = {}) {
  return String(
    inbound?.matchedLeadName
    || inbound?.contact?.fullName
    || turn?.resolvedCustomer?.name
    || '',
  ).trim() || 'den Kunden';
}

/**
 * Optional choice chips above composer for model_fix (Quick decisions only).
 * @param {object|null} vehicle
 * @returns {{ id: string, label: string, draft: string }[]}
 */
export function buildIntakeModelChoiceChips(vehicle = null) {
  if (!vehicle) return [];
  const labels = [];
  if (vehicle.field === 'vehicleInterestMulti') {
    const vals = Array.isArray(vehicle.value) ? vehicle.value : [];
    for (const item of vals) {
      const label = normalizeVehicleDisplayLabel(
        typeof item === 'string' ? item : (item?.label || item?.model || ''),
      );
      if (label && !labels.includes(label)) labels.push(label);
    }
  }
  if (!labels.length) {
    const raw = String(vehicle.label || '').trim();
    const parts = raw.split(/\s*(?:oder|\/|,|;)\s*/i).map((p) => (
      normalizeVehicleDisplayLabel(p)
    )).filter(Boolean);
    for (const label of parts) {
      if (label && !labels.includes(label)) labels.push(label);
    }
  }
  if (labels.length < 2) return [];
  const chips = labels.slice(0, 3).map((label) => ({
    id: `qi_model_opt_${label.replace(/\s+/g, '_').toLowerCase()}`,
    label,
    draft: label,
  }));
  chips.push({ id: 'qi_model_other', label: 'Anderes', draft: '' });
  return chips;
}

/**
 * Kontextuelle Clever-Next-Actions aus Intake-Fallstand.
 * Universal grammar: Soft Need prominent → Unsicherheit → Business Step secondary.
 * Permanent „Notiz merken“ / „Modell korrigieren“ bei High-Confidence entfallen.
 * Primary CTA „Kundenakte anlegen & weitermachen“ bleibt auf der Review-Karte.
 * Keine gleichgewichtigen Toolbar-Chips für Telefon + Angebot.
 *
 * @param {object|null} inbound
 * @param {object} turn
 * @returns {object[]}
 */
export function buildIntakeNextActions(inbound = null, turn = {}) {
  const inboundLead = inbound?.detected
    ? inbound
    : (turn?.inboundLead?.detected ? turn.inboundLead : null);
  if (!inboundLead?.detected) return [];

  const facts = resolveIntakeTurnFacts(turn);
  const name = resolveIntakeActionCustomerName(inboundLead, turn);
  const actions = [];
  let hasBlockingNeed = false;

  if (!hasIntakePhone(inboundLead, facts)) {
    hasBlockingNeed = true;
    actions.push({
      id: 'qi_phone',
      kind: 'soft_need',
      label: 'Telefon ergänzen',
      openLabel: 'Telefon fehlt → Ergänzen',
      intentChipId: 'merken',
      draft: '',
      composerTitle: buildComposerTaskTitle({ kind: 'phone_add', name }),
      placeholder: 'Telefonnummer eingeben oder sprechen …',
      important: true,
      secondary: false,
      weight: 'important',
    });
  }

  const vehicle = pickIntakeVehicleFact(facts);
  if (intakeVehicleNeedsModelCheck(vehicle)) {
    hasBlockingNeed = true;
    const choiceChips = buildIntakeModelChoiceChips(vehicle);
    actions.push({
      id: 'qi_model',
      kind: 'uncertainty',
      label: 'Modell korrigieren',
      openLabel: 'Modell unsicher → Korrigieren',
      intentChipId: 'merken',
      draft: '',
      composerTitle: buildComposerTaskTitle({ kind: 'model_fix', name }),
      placeholder: 'Korrektes Modell eingeben oder sprechen …',
      important: true,
      secondary: false,
      weight: 'important',
      choiceChips,
    });
  }

  if (hasEnoughDealFactsForOffer(facts)) {
    // Angebot nie gleichgewichtig zu Soft Need / Unsicherheit
    const demote = hasBlockingNeed;
    actions.push({
      id: 'qi_offer',
      kind: 'business_step',
      label: 'Angebot vorbereiten',
      intentChipId: 'angebot',
      composerTitle: buildComposerTaskTitle({ kind: 'offer_prepare', name }),
      placeholder: 'Fahrzeug und Konditionen nennen oder sprechen …',
      important: !demote,
      secondary: demote,
      weight: demote ? 'secondary' : 'important',
    });
  }

  return actions.slice(0, INTAKE_NEXT_ACTION_MAX);
}

/** @param {number|string|null|undefined} value */
export function formatIntakeTermLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${n} Monate`;
}

/** Kompakter Chip: „48 M“ */
export function formatIntakeTermChipLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${n} M`;
}

/** @param {number|string|null|undefined} value */
export function formatIntakeMileageLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${n.toLocaleString('de-DE')} km/Jahr`;
}

/** Kompakter Chip: „12.500 km“ */
export function formatIntakeMileageChipLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${n.toLocaleString('de-DE')} km`;
}

/** @param {number|string|null|undefined} value */
export function formatIntakeDownPaymentLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return `${n.toLocaleString('de-DE')} € AZ`;
}

function formatIntakePaymentLabel(fact) {
  if (!fact) return null;
  if (fact.value === 'leasing' || /leasing/i.test(String(fact.label || ''))) return 'Leasing';
  if (fact.value === 'financing' || /finanz/i.test(String(fact.label || ''))) return 'Finanzierung';
  if (fact.value === 'cash' || fact.value === 'purchase' || /\b(kauf|bar)\b/i.test(String(fact.label || ''))) {
    return 'Kauf';
  }
  const cleaned = String(fact.label || '')
    .replace(/^Zahlungsart:\s*/i, '')
    .trim();
  return cleaned || null;
}

function formatIntakeVehicleLabel(fact) {
  if (!fact) return null;
  const raw = fact.label || fact.value?.label || [
    fact.value?.make,
    fact.value?.model,
    fact.value?.trim,
  ].filter(Boolean).join(' ');
  const normalized = normalizeVehicleDisplayLabel(raw);
  if (!normalized) return null;
  return normalized.replace(/^Fahrzeug:\s*/i, '').trim() || null;
}

function ensureLabeledMileage(label) {
  const text = String(label || '').trim();
  if (!text) return null;
  if (/km\s*\/\s*jahr|km\/jahr|km\s*pro\s*jahr/i.test(text)) return text;
  if (/\bkm\b/i.test(text)) return text.replace(/\s*km\b/i, ' km/Jahr');
  return text;
}

function ensureLabeledDownPayment(label) {
  const text = String(label || '').trim();
  if (!text) return null;
  if (/\b(az|anzahlung)\b/i.test(text)) return text.replace(/\banzahlung\b/i, 'AZ');
  if (/€/.test(text)) return `${text} AZ`;
  return text;
}

function truncateStreetLine(value = '', max = 28) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trim()}…`;
}

/**
 * Kompakte Konditions-/Wunschzeile + Erkannt-Chips aus Facts.
 * Roh-Zahlenblobs („48 12.500 km 5000 €“) werden immer gelabelt.
 */
export function buildInboundIntakePresentation(inbound = {}, turn = {}) {
  const facts = Array.isArray(turn.extractedFacts) && turn.extractedFacts.length
    ? turn.extractedFacts
    : Array.isArray(turn.sellerFacts) ? turn.sellerFacts : [];

  const vehicle = formatIntakeVehicleLabel(
    pickIntakeFact(facts, 'vehicleInterest') || pickIntakeFact(facts, 'vehicleInterestMulti'),
  );
  const payment = formatIntakePaymentLabel(pickIntakeFact(facts, 'paymentType'));

  const termFact = pickIntakeFact(facts, 'termMonths') || pickIntakeFact(facts, 'durationMonths');
  const term = formatIntakeTermLabel(termFact?.value)
    || (termFact?.label && /\bmonat/i.test(termFact.label)
      ? String(termFact.label).replace(/^Laufzeit:\s*/i, '').trim()
      : null);

  const kmFact = pickIntakeFact(facts, 'annualMileage') || pickIntakeFact(facts, 'mileagePerYear');
  const mileage = formatIntakeMileageLabel(kmFact?.value)
    || ensureLabeledMileage(kmFact?.label);

  const downFact = pickIntakeFact(facts, 'downPayment');
  const downPayment = formatIntakeDownPaymentLabel(downFact?.value)
    || ensureLabeledDownPayment(downFact?.label);

  const termChip = formatIntakeTermChipLabel(termFact?.value)
    || (term ? String(term).replace(/\s*Monate?\b/i, ' M').trim() : null);
  const mileageChip = formatIntakeMileageChipLabel(kmFact?.value)
    || (mileage
      ? String(mileage).replace(/\s*\/\s*Jahr\b/i, '').replace(/\s*km\/Jahr\b/i, ' km').trim()
      : null);

  const conditionParts = [vehicle, payment, term, mileage, downPayment].filter(Boolean);
  const conditionLine = conditionParts.join(' · ') || null;

  // Clever-Chips: kompakt, ohne Meta-/Status-Labels
  const isFactChipLabel = (label) => {
    const t = String(label || '').trim();
    if (!t) return false;
    if (INTAKE_META_CHIP_LABELS.has(t)) return false;
    if (/^(unsicher|mehrere treffer|notiz übernommen|neu anlegen)/i.test(t)) return false;
    return true;
  };

  const vehicleFact = pickIntakeFact(facts, 'vehicleInterest')
    || pickIntakeFact(facts, 'vehicleInterestMulti');
  const paymentFact = pickIntakeFact(facts, 'paymentType');

  /** @type {object[]} */
  const recognizedFactChips = [];
  const pushFactChip = (field, label, fact, value = null) => {
    if (!isFactChipLabel(label)) return;
    if (recognizedFactChips.some((c) => c.label === label)) return;
    const chip = buildEditableFactChip({
      field,
      label,
      value: value != null ? value : (fact?.value ?? label),
      fact,
      source: 'clever',
    }) || {
      label,
      field: field || null,
      value: value != null ? value : (fact?.value ?? label),
      source: 'clever',
      needsConfirmation: Boolean(fact?.needsConfirmation),
      editable: isLiveEditableField(field),
      title: 'Von Clever erkannt',
    };
    recognizedFactChips.push(chip);
  };

  if (vehicle) pushFactChip(vehicleFact?.field || 'vehicleInterest', vehicle, vehicleFact);
  if (payment) pushFactChip('paymentType', payment, paymentFact, paymentFact?.value);
  if (termChip) pushFactChip(termFact?.field || 'termMonths', termChip, termFact, termFact?.value);
  if (mileageChip) {
    pushFactChip(kmFact?.field || 'annualMileage', mileageChip, kmFact, kmFact?.value);
  }
  if (downPayment) {
    pushFactChip('downPayment', downPayment, downFact, downFact?.value);
  }

  const cityFact = pickIntakeFact(facts, 'city') || pickIntakeFact(facts, 'postalCode');
  const streetFact = pickIntakeFact(facts, 'street') || pickIntakeFact(facts, 'address');
  const cityLine = [
    cityFact?.value?.postalCode || cityFact?.value?.zip || null,
    cityFact?.value?.city || cityFact?.label || null,
  ].filter(Boolean).join(' ')
    || (cityFact?.label ? String(cityFact.label).trim() : null)
    || null;

  const contactEmail = inbound.contact?.email && !isInstitutionalContactEmail(inbound.contact.email)
    ? inbound.contact.email
    : null;
  const emailFact = pickIntakeFact(facts, 'email');
  const phoneFact = pickIntakeFact(facts, 'phone') || pickIntakeFact(facts, 'mobile');
  const contactChips = [
    contactEmail,
    inbound.contact?.phone || null,
    cityLine,
    streetFact ? truncateStreetLine(streetFact.label || streetFact.value) : null,
  ].filter(isFactChipLabel);

  if (contactEmail) {
    pushFactChip('email', contactEmail, emailFact, contactEmail);
  }
  if (inbound.contact?.phone) {
    pushFactChip('phone', inbound.contact.phone, phoneFact, inbound.contact.phone);
  }
  if (cityLine && cityFact) {
    pushFactChip(cityFact.field || 'city', cityLine, cityFact);
  }
  if (streetFact) {
    const streetLabel = truncateStreetLine(streetFact.label || streetFact.value);
    if (streetLabel) pushFactChip(streetFact.field || 'street', streetLabel, streetFact);
  }

  // Name als Chip nur wenn unsicher / prüfenswert (Titel trägt den Namen bereits)
  const nameFact = pickIntakeFact(facts, 'customerName');
  if (nameFact?.needsConfirmation || inbound.resolutionStatus === 'ambiguous') {
    const nameLabel = String(
      inbound.contact?.fullName || nameFact?.label || nameFact?.value || '',
    ).trim();
    if (nameLabel) pushFactChip('customerName', nameLabel, nameFact, nameLabel);
  }

  // Weitere sichere Wish-/Deal-Chips, ohne Kontakt/Kern-Duplikate
  for (const fact of facts) {
    if (!fact?.label) continue;
    if (INTAKE_CONTACT_FIELDS.has(fact.field) || INTAKE_CORE_FIELDS.has(fact.field)) continue;
    if (fact.field === 'unresolvedNote' || fact.preserveAsNote) continue;
    if (fact.factClass === SELLER_FACT_CLASS.MESSAGE_INSTRUCTION) continue;
    if (fact.factClass === SELLER_FACT_CLASS.SELLER_NOTE) continue;
    if (fact.needsConfirmation && Number(fact.confidence || 0) < 0.75) continue;
    const label = String(fact.label).trim();
    if (!isFactChipLabel(label)) continue;
    if (/^betreff:/i.test(label)) continue;
    pushFactChip(fact.field, label, fact);
    if (recognizedFactChips.length >= 8) break;
  }

  const noteChips = [];
  if (inbound.duplicateHint) noteChips.push('Unsicher erkannt');
  if (inbound.resolutionStatus === 'ambiguous') noteChips.push('Mehrere Treffer');

  const unresolved = [
    ...(Array.isArray(turn.unresolvedNotes) ? turn.unresolvedNotes : []),
    ...(Array.isArray(turn.interpretedInput?.unresolvedNotes)
      ? turn.interpretedInput.unresolvedNotes
      : []),
  ];
  for (const note of unresolved) {
    const text = String(note?.text || note?.label || note || '').trim();
    if (!text) continue;
    noteChips.push('Notiz übernommen');
    break;
  }
  for (const fact of facts) {
    if (!(fact?.field === 'unresolvedNote' || fact?.preserveAsNote
      || fact?.factClass === SELLER_FACT_CLASS.SELLER_NOTE)) {
      continue;
    }
    const text = String(fact.label || '').trim();
    if (!text) continue;
    if (!noteChips.includes('Notiz übernommen')) noteChips.push('Notiz übernommen');
    break;
  }
  // Unklare Adresse / Bedarf Bestätigung → nicht in den Hero
  if (streetFact?.needsConfirmation || (streetFact && Number(streetFact.confidence || 1) < 0.75)) {
    if (!noteChips.includes('Unsicher erkannt')) noteChips.push('Unsicher erkannt');
  }

  const uniqueNoteChips = [...new Set(noteChips)].slice(0, 4);
  // Meta-Chips strikt getrennt von Erkannt-Fact-Chips
  const uniqueFactChips = recognizedFactChips
    .filter((chip) => (
      isFactChipLabel(chip.label) && !uniqueNoteChips.includes(chip.label)
    ))
    .slice(0, 8);
  const uniqueRecognized = uniqueFactChips.map((c) => c.label);

  const nextActions = buildIntakeNextActions(inbound, turn);
  // Soft Need + Unsicherheit → „Noch offen“; Business Steps bleiben secondary/CTA
  const openNeeds = nextActions
    .filter((a) => a.kind === 'soft_need' || a.kind === 'uncertainty')
    .map((a) => a.openLabel || a.label)
    .filter(Boolean);

  const quickCorrectActions = buildIntakeQuickCorrectActions(inbound, turn);

  return {
    conditionLine,
    recognizedChips: uniqueRecognized,
    recognizedFactChips: uniqueFactChips,
    contactChips: [...new Set(contactChips)].slice(0, 4),
    noteChips: uniqueNoteChips,
    openNeeds: [...new Set(openNeeds)].slice(0, 3),
    nextActions,
    quickCorrectActions,
    cityLine,
  };
}

/**
 * Kontextuelle Schnell-Korrekturen (max 3) – nur bei Soft Need / Unsicherheit.
 * Keine permanente Toolbar gleicher Aktionen.
 */
export function buildIntakeQuickCorrectActions(inbound = null, turn = {}) {
  const inboundLead = inbound?.detected
    ? inbound
    : (turn?.inboundLead?.detected ? turn.inboundLead : null);
  if (!inboundLead?.detected) return [];

  const facts = resolveIntakeTurnFacts(turn);
  const actions = [];

  if (!hasIntakePhone(inboundLead, facts)) {
    actions.push({
      id: 'qc_phone',
      field: 'phone',
      label: 'Telefon korrigieren',
      editor: 'phone',
      mode: 'inline',
    });
  } else {
    const phoneFact = pickIntakeFact(facts, 'phone') || pickIntakeFact(facts, 'mobile');
    if (phoneFact?.needsConfirmation) {
      actions.push({
        id: 'qc_phone',
        field: 'phone',
        label: 'Telefon prüfen',
        editor: 'phone',
        mode: 'inline',
      });
    }
  }

  const vehicle = pickIntakeVehicleFact(facts);
  if (intakeVehicleNeedsModelCheck(vehicle)) {
    actions.push({
      id: 'qc_model',
      field: vehicle?.field || 'vehicleInterest',
      label: 'Modell ändern',
      editor: 'vehicle',
      mode: 'inline',
    });
  }

  const nameFact = pickIntakeFact(facts, 'customerName');
  if (
    inboundLead.resolutionStatus === 'ambiguous'
    || nameFact?.needsConfirmation
    || (nameFact && Number(nameFact.confidence || 1) < 0.75)
  ) {
    actions.push({
      id: 'qc_name',
      field: 'customerName',
      label: 'Name prüfen',
      editor: 'name',
      mode: 'inline',
    });
  }

  return actions.slice(0, INTAKE_NEXT_ACTION_MAX);
}

/**
 * Review-Model für Inbound – kompakt: Status · Ergebnis · nächster Klick.
 */
export function buildInboundLeadReviewModel(inbound = null, turn = {}) {
  if (!inbound?.detected) return null;

  const presentation = buildInboundIntakePresentation(inbound, turn);
  const groups = [];

  const customerName = inbound.matchedLeadName
    || inbound.contact?.fullName
    || 'Neue Anfrage';

  const workTitle = inbound.proposeCreateCustomer
    ? `${customerName} · neue Kundenakte`
    : inbound.resolutionStatus === 'unique'
      ? `${customerName} · Kundenakte öffnen`
      : inbound.resolutionStatus === 'ambiguous'
        ? (customerName && customerName !== 'Neue Anfrage'
          ? `${customerName} · Treffer prüfen…`
          : 'Treffer prüfen…')
        : customerName;

  if (inbound.resolutionStatus === 'ambiguous') {
    const candidates = (inbound.customerSearchResults || []).slice(0, 4)
      .map((r) => r.customerName || 'Kunde')
      .filter((label) => label && !INTAKE_META_CHIP_LABELS.has(label));
    if (candidates.length) {
      groups.push({
        id: 'matches',
        title: '',
        line: 'Mehrere Treffer',
        chips: candidates.map((label) => ({
          label,
          source: 'meta',
          title: 'Treffer zur Auswahl',
          tone: 'meta',
        })),
        items: candidates.map((label) => ({ label, tone: 'open' })),
      });
    }
  }

  if (presentation.recognizedChips.length) {
    const factChips = Array.isArray(presentation.recognizedFactChips)
      && presentation.recognizedFactChips.length
      ? presentation.recognizedFactChips
      : presentation.recognizedChips.map((label) => ({
        label,
        source: 'clever',
        title: 'Von Clever erkannt',
        editable: false,
      }));
    groups.push({
      id: 'facts',
      // Kein „ERKANNT“-Lärm – Chips sprechen für sich
      title: '',
      line: presentation.conditionLine || presentation.recognizedChips.join(' · '),
      chips: factChips,
      items: factChips.map((chip) => ({
        label: chip.label,
        field: chip.field || null,
        source: chip.source || 'clever',
        needsConfirmation: Boolean(chip.needsConfirmation),
      })),
    });
  }

  const nextActions = presentation.nextActions || buildIntakeNextActions(inbound, turn);
  if (presentation.openNeeds?.length) {
    groups.push({
      id: 'open',
      title: 'Noch offen',
      line: presentation.openNeeds.join(' · '),
      chips: presentation.openNeeds.map((label) => ({
        label,
        source: 'meta',
        title: 'Noch offen',
        tone: 'open',
      })),
      items: presentation.openNeeds.map((label) => ({
        label,
        tone: 'open',
      })),
    });
  }

  const primaryCta = inbound.proposeCreateCustomer
    ? 'Kundenakte anlegen & weitermachen'
    : inbound.resolutionStatus === 'unique'
      ? 'In Kundenakte weitermachen'
      : inbound.resolutionStatus === 'ambiguous'
        ? 'Treffer prüfen & weitermachen'
        : 'Übernehmen & weitermachen';

  const secondaryActions = [
    { id: 'revise_intake', label: 'Korrigieren', action: 'revise_intake', tone: 'compact' },
    { id: 'research_customer', label: 'Erneut suchen', action: 'open_customer_search', tone: 'compact' },
    { id: 'discard_intake', label: 'Verwerfen', action: 'discard', tone: 'compact' },
  ];

  const summaryLine = inbound.proposeCreateCustomer
    ? `${customerName} · neue Kundenakte`
    : inbound.resolutionStatus === 'unique'
      ? `${inbound.matchedLeadName || customerName} · Kundenakte öffnen`
      : inbound.resolutionStatus === 'ambiguous'
        ? 'Treffer prüfen…'
        : null;

  return {
    // Kein Clever-Narrations-Titel – Seller sieht nur die Karte
    title: '',
    groups,
    body: null,
    hero: {
      // Name · Kontext oben; CTA nur als Primary-Button
      headline: null,
      name: workTitle,
      subtitle: 'Von Clever erkannt',
    },
    compactUi: true,
    quietIntake: true,
    actionSections: [{
      id: 'customer_intake_review',
      kind: 'customer_intake_review',
      title: 'Kundenanfrage',
      headline: primaryCta,
      body: null,
      inboundLead: inbound,
      // Ambiguous: Kundenwahl nur über Composer-Pills (keine doppelten Text-Links)
      primaryActions: inbound.resolutionStatus === 'ambiguous'
        ? []
        : [{
          id: 'accept_inbound',
          label: primaryCta,
          action: 'accept_inbound_lead',
          leadId: inbound.matchedLeadId || null,
          tone: 'primary',
        }],
      secondaryActions,
    }],
    factCount: presentation.recognizedChips.length,
    summaryLine,
    missingLine: presentation.openNeeds?.[0] || presentation.noteChips[0] || null,
    nextActions,
    quickCorrectActions: presentation.quickCorrectActions || [],
    liveEditEnabled: true,
    primaryCta,
    secondaryCta: 'Korrigieren',
    // Keine Protokoll-Statuszeilen in der Seller-UI (Debug behalten)
    progressLines: [],
    debugDetails: {
      progressLines: turn.uiEffects?.progressLines || [],
      resolutionStatus: inbound.resolutionStatus,
      sourceHint: inbound.contact?.sourceHint || null,
      nextAction: inbound.nextAction?.label || null,
      nextActions: nextActions.map((a) => a.id),
    },
    reviewType: 'customer_intake_review',
    legacyReviewType: 'inbound_lead_review',
    kind: 'customer_intake',
    inboundLead: inbound,
    resolvedCustomer: inbound.matchedLeadId
      ? { id: inbound.matchedLeadId, name: inbound.matchedLeadName }
      : null,
  };
}
