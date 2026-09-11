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
import {
  buildContactPayloadFromIdentity,
  deriveContactIdentity,
} from '../dealer/customerContactIdentity.js';
import {
  sanitizeCustomerNameCandidate,
} from './resolveAssistantContext.js';

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
    const cleaned = sanitizeCustomerNameCandidate(labeled[1].replace(/<[^>]+>/g, '').trim());
    if (cleaned) return cleaned;
  }

  const angle = text.match(
    /['"]([A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+)+)['"]\s*<[^>\s]+@[^>\s]+>/,
  ) || text.match(
    /\b([A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+)+)\s*<[^>\s]+@[^>\s]+>/,
  );
  if (angle?.[1]) {
    const cleaned = sanitizeCustomerNameCandidate(angle[1].trim());
    if (cleaned) return cleaned;
  }

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 8);
  let fromLine = null;
  for (const line of lines) {
    if (/^(?:von|from|betreff|subject|an|to|gesendet|sent|email|e-?mail|tel|telefon|phone)\b/i.test(line)) {
      continue;
    }
    if (STRUCTURED_LEAD_NAME_LABEL.test(line)) continue;

    // „Ehrlich 0173 …“ / „Andreas Ehrlich 0173…“ – Name vor Telefon auf derselben Zeile
    const nameBeforePhone = line.match(
      /^([A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]{1,40}(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]{1,40})?)\s+(?:\+49|0\d)/,
    );
    if (nameBeforePhone?.[1]) {
      const cleaned = sanitizeCustomerNameCandidate(nameBeforePhone[1].trim());
      if (cleaned) {
        fromLine = cleaned;
        break;
      }
    }

    if (/@/.test(line) || /\d{5,}/.test(line)) {
      // „Familie Müller, optional mail: …“ → Name vor Mail noch retten
      const familyOnMailLine = line.match(/^familie\s+([A-Za-zÄÖÜäöüß-]{2,40})\b/i);
      if (familyOnMailLine) {
        const cleaned = sanitizeCustomerNameCandidate(`Familie ${familyOnMailLine[1]}`);
        if (cleaned) {
          fromLine = cleaned;
          break;
        }
      }
      continue;
    }
    if (STRUCTURED_LEAD_VEHICLE_CUE.test(line) && !/\s/.test(line.trim())) continue;

    const familyLine = line.match(/^familie\s+([A-Za-zÄÖÜäöüß-]{2,40})\b/i);
    if (familyLine) {
      const cleaned = sanitizeCustomerNameCandidate(`Familie ${familyLine[1]}`);
      if (cleaned) {
        fromLine = cleaned;
        break;
      }
    }

    // „Alexander Schlayer“ oder „Schlayer Alexander Aalen“
    if (/^[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){1,3}$/.test(line)
      && line.length <= 60) {
      const cleaned = sanitizeCustomerNameCandidate(line);
      if (cleaned) {
        fromLine = cleaned;
        break;
      }
    }
  }

  // E-Mail lokal: nachname-vorname@ → Vorname Nachname
  let fromEmail = null;
  const email = text.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/)?.[1];
  if (email) {
    const local = String(email.split('@')[0] || '');
    const parts = local.split(/[-_.]/).filter(Boolean);
    if (parts.length === 2 && /^[a-zäöüß]+$/i.test(parts[0]) && /^[a-zäöüß]+$/i.test(parts[1])) {
      const last = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
      const first = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase();
      const cleaned = sanitizeCustomerNameCandidate(`${first} ${last}`);
      if (cleaned) fromEmail = cleaned;
    }
  }

  // Nur Nachname in Zeile + passende Mail → voller Name aus Mail
  if (fromLine && fromEmail && !/\s/.test(fromLine)) {
    if (fromEmail.toLowerCase().includes(fromLine.toLowerCase())) return fromEmail;
  }
  if (fromLine) return fromLine;
  if (fromEmail) return fromEmail;
  return null;
}

/**
 * Freier Seller-Capture-Dump (Multi-Fahrzeug + Soft/Konditionen) – kein Inbound-Miss.
 * Klare Mail-Forwards/Header bleiben Inbound.
 * @param {string} text
 */
export function isSellerFreestyleCaptureDump(text = '') {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim();
  if (raw.length < 40) return false;

  const hasForward = /-----Ursprüngliche Nachricht-----|Forwarded message|Weitergeleitete Nachricht|Begin forwarded message|Anfang der weitergeleiteten Nachricht/i.test(raw);
  const hasMailHeaders = /\b(?:Von|From):\s*.+/i.test(raw)
    && /\b(?:Betreff|Subject):\s*.+/i.test(raw);
  if (hasForward || hasMailHeaders) return false;
  if (STRUCTURED_LEAD_NAME_LABEL.test(raw) && !/\bwill\s+angebote?\s+für\b/i.test(raw)) {
    // Klassische Händler-Notiz mit Name:-Label bleibt Inbound
    return false;
  }

  const evHits = raw.match(/\bev\s*[2-9]\b/gi) || [];
  const multiVehicle = evHits.length >= 2
    || (/\b(?:picanto|sportage|xceed|ceed|niro|sorento)\b/i.test(raw) && evHits.length >= 1);
  const softOrWish = /\b(?:kinder|ahk|entscheidet\s+mit|max\.?\s*\d+|wunsch\s*konditionen|will\s+angebote?\s+für)\b/i.test(raw);
  const identityCue = /\bfamilie\s+[A-Za-zÄÖÜäöüß-]+|\bkunde\s+hei(?:ss|ß)t\b|\b(?:herr|frau)\s+[A-Za-zÄÖÜäöüß-]{2,}/i.test(raw);

  return Boolean(multiVehicle && (softOrWish || identityCue));
}

/**
 * Händler-Lead-Notiz ohne Mail-Header (Name + Kontakt + Fahrzeug/Kondition).
 * @param {string} text
 */
export function isStructuredLeadNote(text = '') {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim();
  if (raw.length < 50) return false;
  if (SELLER_COMMAND_START.test(raw)) return false;
  // Multi-Fahrzeug Soft-Dump mit optional Mail → Capture-first, kein Inbound
  if (isSellerFreestyleCaptureDump(raw)) return false;

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
    onBehalfOf: mail.onBehalfOf || null,
    onBehalfPlace: mail.onBehalfPlace || null,
    customerMailNote: mail.customerMailNote || null,
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
  if (contact.onBehalfOf) {
    facts.push(createExtractedFact({
      factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
      field: 'onBehalfOf',
      value: {
        name: contact.onBehalfOf,
        place: contact.onBehalfPlace || null,
        role: 'buyer',
      },
      label: contact.onBehalfPlace
        ? `Im Auftrag von ${contact.onBehalfOf} (${contact.onBehalfPlace})`
        : `Im Auftrag von ${contact.onBehalfOf}`,
      source: SELLER_FACT_SOURCE.CUSTOMER_MESSAGE,
      confidence: 0.93,
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
      firstName: contact.firstName || null,
      lastName: contact.lastName || null,
      salutation: contact.salutation || null,
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
  const identity = deriveContactIdentity(
    {
      firstName: contact.firstName,
      lastName: contact.lastName,
      salutation: contact.salutation,
      name: contact.fullName,
    },
    contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(' '),
  );
  const contactPayload = buildContactPayloadFromIdentity(identity, {
    phone: contact.phone || '',
    email: contact.email || '',
  });
  const name = contactPayload.name || 'Neuer Kunde';
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
      ...contactPayload,
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
    if (fact.consultationCandidates === true) return false;
    const vals = Array.isArray(fact.value) ? fact.value : [];
    if (vals.length > 1) return true;
    if (/\boder\b|\//i.test(String(fact.label || ''))) return true;
  }
  if (fact.needsConfirmation && confidence < MODEL_CHECK_CONFIDENCE) return true;
  if (confidence < 0.75) return true;
  return false;
}

function isConsultationCandidateFact(fact) {
  return fact?.field === 'vehicleInterestMulti' && fact?.consultationCandidates === true;
}

function hasEnoughDealFactsForOffer(facts = []) {
  const vehicle = pickIntakeVehicleFact(facts);
  if (!vehicle || isConsultationCandidateFact(vehicle)) return false;
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
 * Primary CTA sitzt auf der Briefing-Karte (eine Aktion); Soft Needs lokal bei „Noch offen“.
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

  if (vehicle && !isConsultationCandidateFact(vehicleFact)) {
    pushFactChip(vehicleFact?.field || 'vehicleInterest', vehicle, vehicleFact);
  }
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
  // Soft Need + Unsicherheit → „Noch offen“ (menschliche Labels, keine Debug-Chips)
  const openNeeds = nextActions
    .filter((a) => a.kind === 'soft_need' || a.kind === 'uncertainty')
    .map((a) => {
      if (a.id === 'qi_phone') return 'Telefonnummer';
      if (a.id === 'qi_model') return 'Modell';
      return a.label;
    })
    .filter(Boolean);

  const openLocalActions = nextActions
    .filter((a) => a.kind === 'soft_need' || a.kind === 'uncertainty')
    .map((a) => ({
      id: a.id,
      label: a.label,
      intentChipId: a.intentChipId,
      draft: a.draft || '',
      composerTitle: a.composerTitle,
      placeholder: a.placeholder,
      kind: a.kind,
    }));

  // Kompakte Verkäufer-Arbeitsgrundlage (keine Fact-Chip-Wolke)
  const leasingLine = [term, mileage, downPayment
    ? String(downPayment).replace(/\s*AZ\s*$/i, ' Sonderzahlung')
    : null]
    .filter(Boolean)
    .join(' · ') || null;
  const contactCityCompact = (() => {
    if (cityFact?.needsConfirmation || (cityFact && Number(cityFact.confidence || 1) < 0.75)) {
      return null;
    }
    const zip = cityFact?.value?.postalCode || cityFact?.value?.zip || null;
    const city = cityFact?.value?.city
      || (cityFact?.label && !/^\d{5}$/.test(String(cityFact.label).trim())
        ? String(cityFact.label).replace(/^\d{5}\s*/, '').trim()
        : null);
    if (zip && city) return `${zip} ${city}`;
    if (cityLine && !/^\d{5}$/.test(String(cityLine).trim())) return cityLine;
    return cityLine || null;
  })();
  const contactLine = [
    contactEmail,
    inbound.contact?.phone || null,
    contactCityCompact,
  ].filter(Boolean).join(' · ') || null;
  const consultationCase = isConsultationCandidateFact(vehicleFact);
  const vehicleLine = (!consultationCase && vehicle)
    ? (/^kia\b/i.test(vehicle) ? vehicle : `Kia ${vehicle}`)
    : null;

  const maritalFact = pickIntakeFact(facts, 'maritalStatus');
  const maritalLine = maritalFact?.label
    ? String(maritalFact.label).replace(/^Familienstand:\s*/i, '').trim()
    : null;
  const existingFact = pickIntakeFact(facts, 'existingVehicle');
  const existingLine = existingFact
    ? (
      [existingFact.value?.make, existingFact.value?.model].filter(Boolean).join(' ')
      || String(existingFact.label || '').replace(/\s*·\s*.*$/, '').trim()
      || null
    )
    : null;

  const rangeFact = pickIntakeFact(facts, 'rangeNeed');
  const importantBits = [
    rangeFact?.label || null,
    ...facts.filter((f) => f.field === 'equipmentWish').map((f) => f.label),
    pickIntakeFact(facts, 'availabilityPreference')?.label || null,
  ].filter(Boolean);
  const importantLine = importantBits.length ? [...new Set(importantBits)].join(' · ') : null;
  const candidatesLine = consultationCase
    ? String(vehicleFact?.label || '')
    : null;
  const openQuestionLine = facts
    .filter((f) => f.field === 'openCustomerQuestion')
    .map((f) => f.label)
    .filter(Boolean)
    .join(' · ') || null;

  // Unsicheres „Bar“ (oft Stadt-Fehlparse) → lokal klären, nie Hero-Chip
  const clarifyItems = [];
  if (
    cityFact?.needsConfirmation
    || (cityFact && Number(cityFact.confidence || 1) < 0.8)
  ) {
    const rawCity = String(cityFact?.label || cityFact?.value?.city || '').trim();
    if (rawCity && /^bar$/i.test(rawCity)) {
      clarifyItems.push({
        id: 'clarify_bar',
        label: '„Bar“ prüfen',
        field: cityFact.field || 'city',
        draft: '',
        composerTitle: `ANGABE PRÜFEN · ${inbound.contact?.fullName || 'Kunde'}`,
        placeholder: 'Meinten Sie Barzahlung / Kauf – oder einen Ort?',
      });
    }
  }
  // Klare Zahlungsart Bar/Kauf → Konditionen-Zeile
  const clearCash = payment === 'Kauf'
    || paymentFact?.value === 'cash'
    || (paymentFact && /\bbar\b/i.test(String(paymentFact.label || ''))
      && !paymentFact.needsConfirmation
      && Number(paymentFact.confidence || 1) >= 0.8);

  /** @type {{ id: string, title: string, line: string }[]} */
  const briefingSections = [];
  if (vehicleLine) {
    briefingSections.push({ id: 'customerWants', title: 'Kunde möchte', line: vehicleLine });
  } else if (consultationCase) {
    const fuel = pickIntakeFact(facts, 'fuelPreference');
    const seek = fuel?.value === 'electric' || /elektro/i.test(String(fuel?.label || ''))
      ? 'vollelektrischen Neuwagen'
      : 'passendes Fahrzeug';
    briefingSections.push({
      id: 'sought',
      title: 'Sucht',
      line: seek,
    });
  }
  if (importantLine) {
    briefingSections.push({ id: 'important', title: 'Wichtig', line: importantLine });
  }
  if (candidatesLine) {
    briefingSections.push({
      id: 'modelCandidates',
      title: 'Interessante Modelle',
      line: candidatesLine,
    });
  }
  if (maritalLine) {
    briefingSections.push({ id: 'customerPicture', title: 'Kundenbild', line: maritalLine });
  }
  if (existingLine) {
    briefingSections.push({ id: 'currentVehicle', title: 'Aktuelles Fahrzeug', line: existingLine });
  }
  if (leasingLine && (payment === 'Leasing' || paymentFact?.value === 'leasing' || !payment)) {
    briefingSections.push({ id: 'leasingWish', title: payment || 'Leasing', line: leasingLine });
  } else if (leasingLine && payment) {
    briefingSections.push({ id: 'commercial', title: payment, line: leasingLine });
  } else if (clearCash && !leasingLine) {
    briefingSections.push({ id: 'commercial', title: 'Konditionen', line: 'Kauf / Bar' });
  } else   if (payment && !leasingLine && payment !== 'Kauf') {
    briefingSections.push({ id: 'commercial', title: 'Konditionen', line: payment });
  }
  const financeWish = pickIntakeFact(facts, 'financeWish');
  if (financeWish?.label && (payment === 'Finanzierung' || paymentFact?.value === 'financing')) {
    const commercial = briefingSections.find((s) => s.id === 'commercial' || s.id === 'leasingWish');
    if (commercial && !commercial.line.includes('Jahreszins')) {
      commercial.line = [commercial.line, financeWish.label].filter(Boolean).join(' · ');
    } else if (!commercial) {
      briefingSections.push({
        id: 'commercial',
        title: 'Finanzierung',
        line: financeWish.label,
      });
    }
  }
  if (openQuestionLine) {
    briefingSections.push({ id: 'open', title: 'Offen', line: openQuestionLine });
  }
  if (contactLine) {
    briefingSections.push({ id: 'contact', title: 'Kontakt', line: contactLine });
  }

  const quickCorrectActions = buildIntakeQuickCorrectActions(inbound, turn);
  // Hard Review nur bei echter Zuordnungs-/Identitätsgefahr – nicht bei Soft Needs
  const hardReviewRequired = Boolean(
    inbound.duplicateHint
    || inbound.resolutionStatus === 'ambiguous'
  );
  const isConfidentIntake = Boolean(vehicleLine) && !hardReviewRequired
    && !intakeVehicleNeedsModelCheck(vehicleFact);

  return {
    conditionLine,
    recognizedChips: uniqueRecognized,
    recognizedFactChips: uniqueFactChips,
    contactChips: [...new Set(contactChips)].slice(0, 4),
    noteChips: uniqueNoteChips,
    openNeeds: [...new Set(openNeeds)].slice(0, 3),
    openLocalActions,
    briefingSections,
    clarifyItems,
    nextActions,
    // Kein permanentes „Schnell korrigieren“ im ruhigen Verkäuferzustand
    quickCorrectActions: hardReviewRequired ? quickCorrectActions : [],
    cityLine,
    contactLine,
    vehicleLine,
    leasingLine,
    isConfidentIntake,
    hardReviewRequired,
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
 * Review-Model für Inbound – Verkäuferstand: Briefing + eine Primary Action.
 * Hard Review (Chip-/System-UI) nur bei echter Zuordnungsgefahr.
 */
export function buildInboundLeadReviewModel(inbound = null, turn = {}) {
  if (!inbound?.detected) return null;

  const presentation = buildInboundIntakePresentation(inbound, turn);
  const groups = [];

  const customerName = inbound.matchedLeadName
    || inbound.contact?.fullName
    || 'Neue Anfrage';

  const hardReviewRequired = Boolean(presentation.hardReviewRequired);
  const isAmbiguous = inbound.resolutionStatus === 'ambiguous';
  const useBriefing = !hardReviewRequired;

  // Hero: nur Kundenname – nie „Von Clever erkannt“ / „neue Kundenakte“
  const workTitle = isAmbiguous
    ? (customerName && customerName !== 'Neue Anfrage'
      ? `${customerName} · Treffer prüfen…`
      : 'Treffer prüfen…')
    : customerName;

  if (isAmbiguous) {
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

  if (useBriefing) {
    // Partial Success: Work-Briefing-Zeilen, keine Fact-Chip-Wolke
    for (const section of (presentation.briefingSections || [])) {
      groups.push({
        id: section.id,
        title: section.title,
        line: section.line,
        mode: 'briefing',
        chips: [],
        items: [{ label: section.line }],
      });
    }

    const nextActions = presentation.nextActions || buildIntakeNextActions(inbound, turn);
    if (presentation.openNeeds?.length) {
      const phoneLocal = (presentation.openLocalActions || [])
        .find((a) => a.id === 'qi_phone');
      groups.push({
        id: 'open',
        title: 'Noch offen',
        line: presentation.openNeeds.join(' · '),
        mode: 'briefing',
        chips: [],
        items: presentation.openNeeds.map((label) => ({
          label,
          tone: 'open',
        })),
        localActions: phoneLocal
          ? [{
            id: phoneLocal.id,
            label: 'Telefon ergänzen',
            action: 'intake_next_action',
            nextActionId: phoneLocal.id,
            intentChipId: phoneLocal.intentChipId,
            draft: phoneLocal.draft,
            composerTitle: phoneLocal.composerTitle,
            placeholder: phoneLocal.placeholder,
            tone: 'local',
          }]
          : (presentation.openLocalActions || []).slice(0, 1).map((a) => ({
            id: a.id,
            label: a.label,
            action: 'intake_next_action',
            nextActionId: a.id,
            intentChipId: a.intentChipId,
            draft: a.draft,
            composerTitle: a.composerTitle,
            placeholder: a.placeholder,
            tone: 'local',
          })),
      });
    }

    if (presentation.clarifyItems?.length) {
      groups.push({
        id: 'clarify',
        title: 'Noch zu klären',
        line: presentation.clarifyItems
          .map((c) => String(c.label || '').replace(/\s*prüfen\s*$/i, '').trim() || c.label)
          .join(' · '),
        mode: 'briefing',
        chips: [],
        items: presentation.clarifyItems.map((c) => ({
          label: c.label,
          tone: 'open',
        })),
        localActions: presentation.clarifyItems.slice(0, 2).map((c) => ({
          id: c.id,
          label: c.label,
          action: 'intake_next_action',
          nextActionId: c.id,
          draft: c.draft || '',
          composerTitle: c.composerTitle,
          placeholder: c.placeholder,
          tone: 'local',
        })),
      });
    }

    const hasVehicle = Boolean(presentation.vehicleLine);
    const consultationCase = Boolean(
      (turn?.extractedFacts || turn?.sellerFacts || []).some((f) => (
        f?.field === 'vehicleInterestMulti' && f?.consultationCandidates === true
      )),
    );
    const primaryCta = isAmbiguous
      ? 'Treffer prüfen & weitermachen'
      : consultationCase
        ? 'Passende Fahrzeuge finden'
        : hasVehicle
          ? 'Angebot vorbereiten'
          : 'Angaben übernehmen';

    return {
      title: '',
      groups,
      body: null,
      hero: {
        headline: null,
        name: workTitle,
        subtitle: null,
      },
      compactUi: true,
      quietIntake: true,
      briefingPresenter: true,
      hardReviewRequired: false,
      actionSections: [{
        id: 'customer_intake_review',
        kind: 'customer_intake_review',
        title: 'Kundenanfrage',
        headline: primaryCta,
        body: null,
        inboundLead: inbound,
        primaryActions: isAmbiguous
          ? []
          : [{
            id: 'accept_inbound',
            label: primaryCta,
            action: 'accept_inbound_lead',
            leadId: inbound.matchedLeadId || null,
            tone: 'primary',
            intentChipId: consultationCase
              ? undefined
              : (hasVehicle ? 'angebot' : undefined),
          }],
        secondaryActions: [],
      }],
      factCount: presentation.recognizedChips.length,
      summaryLine: null,
      missingLine: presentation.openNeeds?.[0] || null,
      nextActions,
      quickCorrectActions: [],
      liveEditEnabled: false,
      primaryCta,
      secondaryCta: null,
      progressLines: [],
      debugDetails: {
        progressLines: turn.uiEffects?.progressLines || [],
        resolutionStatus: inbound.resolutionStatus,
        sourceHint: inbound.contact?.sourceHint || null,
        nextAction: inbound.nextAction?.label || null,
        nextActions: nextActions.map((a) => a.id),
        briefingSections: presentation.briefingSections || [],
        hardReviewRequired: false,
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

  // --- Hard Review: Chip-/System-UI nur hier ---
  const nextActions = presentation.nextActions || buildIntakeNextActions(inbound, turn);
  if (presentation.recognizedChips.length) {
    const factChips = Array.isArray(presentation.recognizedFactChips)
      && presentation.recognizedFactChips.length
      ? presentation.recognizedFactChips
      : presentation.recognizedChips.map((label) => ({
        label,
        source: 'clever',
        editable: false,
      }));
    groups.push({
      id: 'facts',
      title: 'Von Clever erkannt',
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
  if (presentation.openNeeds?.length) {
    groups.push({
      id: 'open',
      title: 'Noch offen',
      line: presentation.openNeeds.join(' · '),
      chips: presentation.openNeeds.map((label) => ({
        label,
        source: 'meta',
        tone: 'open',
      })),
      items: presentation.openNeeds.map((label) => ({ label, tone: 'open' })),
    });
  }

  const primaryCta = isAmbiguous
    ? 'Treffer prüfen & weitermachen'
    : inbound.proposeCreateCustomer
      ? 'Kundenakte anlegen & weitermachen'
      : inbound.resolutionStatus === 'unique'
        ? 'In Kundenakte weitermachen'
        : 'Übernehmen & weitermachen';

  const secondaryActions = [
    { id: 'revise_intake', label: 'Korrigieren', action: 'revise_intake', tone: 'compact' },
    { id: 'research_customer', label: 'Erneut suchen', action: 'open_customer_search', tone: 'compact' },
    { id: 'discard_intake', label: 'Verwerfen', action: 'discard', tone: 'compact' },
  ];

  return {
    title: '',
    groups,
    body: null,
    hero: {
      headline: null,
      name: workTitle,
      subtitle: null,
    },
    compactUi: true,
    quietIntake: true,
    briefingPresenter: false,
    hardReviewRequired: true,
    actionSections: [{
      id: 'customer_intake_review',
      kind: 'customer_intake_review',
      title: 'Kundenanfrage',
      headline: primaryCta,
      body: null,
      inboundLead: inbound,
      primaryActions: isAmbiguous
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
    summaryLine: null,
    missingLine: presentation.openNeeds?.[0] || null,
    nextActions,
    quickCorrectActions: presentation.quickCorrectActions || [],
    liveEditEnabled: true,
    primaryCta,
    secondaryCta: 'Korrigieren',
    progressLines: [],
    debugDetails: {
      progressLines: turn.uiEffects?.progressLines || [],
      resolutionStatus: inbound.resolutionStatus,
      sourceHint: inbound.contact?.sourceHint || null,
      nextAction: inbound.nextAction?.label || null,
      nextActions: nextActions.map((a) => a.id),
      hardReviewRequired: true,
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
