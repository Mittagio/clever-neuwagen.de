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

const SELLER_COMMAND_START = /^(?:öffne|zeige|zeig|finde|suche|erstell|mach|schreib|sag|was\s+|wann\s+|wie\s+|schlag|bereite)/i;

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
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
  const name = mail.customerName || forwardRaw?.fromName || null;
  const nameParts = splitCustomerName(name);

  let email = forwardRaw?.fromEmail || mail.customerEmail || null;
  if (!email) {
    const emails = [...raw.matchAll(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g)]
      .map((m) => m[1].toLowerCase());
    email = emails.find((e) => !isLikelyDealerEmail(e)) || null;
  }

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
    sourceHint: (mail.isForwarded || forwardRaw) ? 'forwarded_mail' : (email ? 'customer_mail' : 'pasted_inquiry'),
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
  const email = normalizeEmail(contact.email);
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
    proposeCreateCustomer: Boolean(contact.fullName || contact.email || contact.phone),
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

/**
 * Review-Model für Inbound (Gruppen wie Homepage-Inquiry).
 */
export function buildInboundLeadReviewModel(inbound = null, turn = {}) {
  if (!inbound?.detected) return null;

  const groups = [];
  const contactLines = [
    inbound.contact?.fullName,
    inbound.contact?.email,
    inbound.contact?.phone,
    inbound.contact?.subject ? `Betreff: ${inbound.contact.subject}` : null,
  ].filter(Boolean);

  if (inbound.resolutionStatus === 'unique' && inbound.matchedLeadName) {
    groups.push({
      id: 'customer',
      title: 'KUNDE',
      line: `${inbound.matchedLeadName} · bestehend`,
      items: [
        { label: inbound.matchedLeadName, tone: 'match' },
        ...(inbound.customerSearchResults?.[0]?.matchReasons || []).map((r) => ({ label: r })),
      ],
    });
  } else if (inbound.resolutionStatus === 'ambiguous') {
    groups.push({
      id: 'customer',
      title: 'KUNDE',
      line: `${inbound.customerSearchResults?.length || 0} mögliche Treffer`,
      items: (inbound.customerSearchResults || []).slice(0, 4).map((r) => ({
        label: r.customerName || 'Kunde',
        tone: 'open',
      })),
    });
  } else if (inbound.proposeCreateCustomer) {
    groups.push({
      id: 'customer',
      title: 'KUNDE',
      line: contactLines[0]
        ? `Neu anlegen? · ${contactLines[0]}`
        : 'Neuen Kunden anlegen?',
      items: [
        { label: 'Noch kein Treffer – neuen Kunden anlegen?', tone: 'open' },
        ...contactLines.slice(0, 3).map((label) => ({ label })),
      ],
    });
  } else if (contactLines.length) {
    groups.push({
      id: 'customer',
      title: 'KUNDE',
      line: contactLines.join(' · '),
      items: contactLines.map((label) => ({ label })),
    });
  }

  if (inbound.duplicateHint) {
    groups.push({
      id: 'duplicate',
      title: 'DUBLETTE',
      line: inbound.duplicateHint,
      items: [{ label: inbound.duplicateHint, tone: 'open' }],
    });
  }

  const factLabels = inbound.factLabels?.length
    ? inbound.factLabels
    : (turn.extractedFacts || []).map((f) => f.label).filter(Boolean).slice(0, 8);
  if (factLabels.length) {
    groups.push({
      id: 'facts',
      title: 'ERKANNTE ANGABEN',
      line: factLabels.join(' · '),
      items: factLabels.map((label) => ({ label })),
    });
  }

  if (inbound.nextAction?.label) {
    groups.push({
      id: 'next',
      title: 'NÄCHSTE AKTION',
      line: inbound.nextAction.label,
      items: [{ label: inbound.nextAction.label }],
    });
  }

  const primaryCta = inbound.proposeCreateCustomer
    ? 'Neue Kundenakte anlegen'
    : inbound.resolutionStatus === 'unique'
      ? 'Verknüpfen & übernehmen'
      : inbound.resolutionStatus === 'ambiguous'
        ? 'Kunde wählen'
        : 'Übernehmen';

  const showResearchSecondary = inbound.proposeCreateCustomer
    || inbound.resolutionStatus === 'ambiguous';
  const secondaryCta = showResearchSecondary ? 'Erneut suchen' : 'Verwerfen';
  const secondaryActions = showResearchSecondary
    ? [
      { id: 'research_customer', label: 'Erneut suchen', action: 'open_customer_search' },
      { id: 'discard_intake', label: 'Verwerfen', action: 'discard' },
    ]
    : [{ id: 'discard_intake', label: 'Verwerfen', action: 'discard' }];

  return {
    title: '✨ Clever hat eine Anfrage erkannt',
    groups,
    actionSections: [{
      id: 'customer_intake_review',
      kind: 'customer_intake_review',
      title: 'Kundenanfrage',
      headline: inbound.proposeCreateCustomer
        ? 'Neue Kundenakte vorschlagen'
        : (inbound.matchedLeadName || 'Anfrage zuordnen'),
      body: [
        contactLines.join('\n'),
        inbound.duplicateHint,
        inbound.nextAction?.label ? `Nächste Aktion: ${inbound.nextAction.label}` : null,
      ].filter(Boolean).join('\n\n'),
      inboundLead: inbound,
      // Ambiguous: Kundenwahl nur über Composer-Pills (keine doppelten Text-Links)
      primaryActions: inbound.resolutionStatus === 'ambiguous'
        ? []
        : [{
          id: 'accept_inbound',
          label: primaryCta,
          action: 'accept_inbound_lead',
          leadId: inbound.matchedLeadId || null,
        }],
      secondaryActions,
    }],
    factCount: factLabels.length,
    summaryLine: inbound.proposeCreateCustomer
      ? 'Kein bestehender Kunde gefunden – neue Kundenakte vorschlagen. Erst nach Bestätigung.'
      : inbound.resolutionStatus === 'unique'
        ? 'Bestehenden Kunden gefunden – Anfrage verknüpfen. Fakten erst nach Bestätigung.'
        : inbound.resolutionStatus === 'ambiguous'
          ? 'Mehrere mögliche Kunden – bitte den richtigen wählen.'
          : 'Kundenanfrage erkannt – bitte prüfen',
    missingLine: inbound.duplicateHint || null,
    primaryCta,
    secondaryCta,
    reviewType: 'customer_intake_review',
    legacyReviewType: 'inbound_lead_review',
    kind: 'customer_intake',
    inboundLead: inbound,
    resolvedCustomer: inbound.matchedLeadId
      ? { id: inbound.matchedLeadId, name: inbound.matchedLeadName }
      : null,
  };
}
