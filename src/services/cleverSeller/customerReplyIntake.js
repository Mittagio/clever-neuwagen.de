/**
 * Zwei-Wege-Mail leicht: Kundenantwort per Paste/Forward im Composer.
 * Propose → Confirm → Action – kein Auto-Persist, kein Auto-Send.
 * Kanal-Adapter: Paste/Forward jetzt; Hook für spätere Inbox/IMAP.
 */
import { SELLER_FACT_CLASS, SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import {
  extractInboundContact,
  isInboundLeadPaste,
  resolveInboundCustomer,
} from './inboundLeadIntake.js';

const SELLER_COMMAND_START = /^(?:öffne|zeige|zeig|finde|suche|erstell|mach|schreib|sag|was\s+|wann\s+|wie\s+|schlag|bereite)/i;

const EXPLICIT_REPLY_CUE = /\b(?:hier\s+(?:eine\s+)?kundenantwort|kundenantwort\s*:|antwort\s+des\s+kunden|kunden-?rückmeldung)\b/i;

const SUBJECT_REPLY_RE = /\b(?:Betreff|Subject)\s*:\s*(?:re|aw|wg)\s*:/i;

/** Erste-Person / Änderungswunsch – nicht „bitte um Rückruf“ (Inbound-Anfrage). */
const BODY_REPLY_SIGNALS = /\b(?:gefällt\s+mir|gefaellt\s+mir|gefällt\s+uns|bitte\s+in\s+\w+|mit\s+ahk|uhr\s+passt|termin\s+passt|\bpasst\.?\s*$|angebot\s+anpassen|bitte\s+anpassen|lieber\s+in\s+\w+)\b/im;

/**
 * Späterer Inbox-/IMAP-Adapter: Rohkanal → Composer-Paste-Text.
 * Heute: identity / Forward-Wrapper; kein IMAP.
 * @param {{ channel?: string, rawText?: string, subject?: string, fromName?: string, fromEmail?: string }} input
 */
export function adaptInboundChannelToPaste(input = {}) {
  const raw = String(input.rawText || '').replace(/\r\n/g, '\n').trim();
  if (!raw) return '';
  if (isCustomerReplyPaste(raw) || isInboundLeadPaste(raw)) return raw;

  const subject = String(input.subject || 'Kundenantwort').trim();
  const fromName = String(input.fromName || '').trim();
  const fromEmail = String(input.fromEmail || '').trim();
  const fromLine = fromName && fromEmail
    ? `${fromName} <${fromEmail}>`
    : (fromEmail || fromName || 'Kunde');

  return [
    'Hier eine Kundenantwort:',
    '',
    '-----Ursprüngliche Nachricht-----',
    `Von: ${fromLine}`,
    `Betreff: Re: ${subject.replace(/^(?:re|aw|wg)\s*:\s*/i, '')}`,
    '',
    raw,
  ].join('\n');
}

/**
 * Erkennt Paste/Forward einer Kundenantwort (nicht Erst-Anfrage).
 * @param {string} text
 */
export function isCustomerReplyPaste(text = '') {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim();
  if (raw.length < 24) return false;
  if (SELLER_COMMAND_START.test(raw)) return false;

  if (EXPLICIT_REPLY_CUE.test(raw)) return true;

  const mailLike = isInboundLeadPaste(raw);
  if (!mailLike) return false;

  if (SUBJECT_REPLY_RE.test(raw)) return true;
  if (BODY_REPLY_SIGNALS.test(raw)) return true;

  return false;
}

/**
 * Body der Kundenantwort (ohne Mail-Header), für Facts / History.
 * @param {string} text
 * @param {{ inquiryText?: string }} [contact]
 */
export function extractCustomerReplyBody(text = '', contact = {}) {
  const inquiry = String(contact.inquiryText || '').replace(/\r\n/g, '\n').trim();
  if (inquiry && inquiry.length >= 12) {
    return inquiry
      .replace(EXPLICIT_REPLY_CUE, '')
      .replace(/^-----\s*Ursprüngliche Nachricht\s*-----[\s\S]*?(?:\n\n|\r\n\r\n)/i, '')
      .trim() || inquiry;
  }
  const raw = String(text || '').replace(/\r\n/g, '\n').trim();
  const stripped = raw
    .replace(EXPLICIT_REPLY_CUE, '')
    .replace(/^[\s\S]*?-----Ursprüngliche Nachricht-----[\s\S]*?(?:\n\n|\r\n\r\n)/i, '')
    .replace(/^(?:Von|From|Gesendet|Sent|An|To|Betreff|Subject):.*$/gim, '')
    .trim();
  return stripped || raw;
}

/**
 * Vorgeschlagene Folgeschritte aus Antwort-Facts (nur Proposal).
 * @param {{ text?: string, facts?: object[] }} params
 */
export function proposeCustomerReplyNextActions({ text = '', facts = [] } = {}) {
  const list = Array.isArray(facts) ? facts : [];
  const t = String(text || '').toLowerCase();
  const actions = [];

  const hasWishOrTrack = list.some((f) => (
    f.factClass === SELLER_FACT_CLASS.VEHICLE_INTEREST
    || f.factClass === SELLER_FACT_CLASS.VEHICLE_REQUIREMENT
    || f.field === 'vehicleTrackFeedback'
    || f.field === 'colorPreference'
    || f.field === 'towHitchRequired'
  ));
  const hasAppointment = list.some((f) => f.factClass === SELLER_FACT_CLASS.APPOINTMENT_FACT)
    || /\b(?:montag|dienstag|mittwoch|donnerstag|freitag).{0,40}\b\d{1,2}\s*uhr\b|\buhr\s+passt\b/i.test(t);
  const hasOfferChange = hasWishOrTrack
    || /\b(?:angebot\s+anpassen|bitte\s+anpassen|bitte\s+in\s+\w+|mit\s+ahk)\b/i.test(t);

  if (hasWishOrTrack) {
    actions.push({
      type: SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT,
      label: 'Wünsche / Favorit übernehmen',
      intent: SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT,
    });
  }
  if (hasAppointment) {
    actions.push({
      type: SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT,
      label: 'Terminvorschlag vorbereiten',
      intent: SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT,
    });
  }
  if (hasOfferChange) {
    actions.push({
      type: SELLER_TURN_INTENTS.PREPARE_OFFER,
      label: 'Angebot anpassen',
      intent: SELLER_TURN_INTENTS.PREPARE_OFFER,
    });
  }
  if (!actions.length) {
    actions.push({
      type: SELLER_TURN_INTENTS.DRAFT_MESSAGE,
      label: 'Antwortnachricht vorbereiten',
      intent: SELLER_TURN_INTENTS.DRAFT_MESSAGE,
    });
  }
  return actions;
}

/**
 * Resolve: offene Akte bevorzugen, sonst Snapshot wie Inbound.
 */
export function resolveCustomerReplyCustomer({
  contact = {},
  leads = [],
  openLead = null,
} = {}) {
  if (openLead?.id) {
    const email = String(contact.email || '').trim().toLowerCase();
    const openEmail = String(openLead?.contact?.email || '').trim().toLowerCase();
    if (!email || !openEmail || email === openEmail) {
      return {
        status: 'unique',
        lead: openLead,
        results: [{
          leadId: openLead.id,
          customerId: openLead.id,
          customerName: openLead.contact?.name || openLead.name || 'Kunde',
          matchReasons: ['Aktuelle Akte'],
          matchReason: 'Aktuelle Akte',
          sourceType: 'customer_reply_open_akte',
          lead: openLead,
        }],
        duplicateHint: null,
        proposeCreateCustomer: false,
      };
    }
  }

  const resolution = resolveInboundCustomer(contact, leads);
  return {
    ...resolution,
    // Antwort: nie stillschweigend neuen Kunden anlegen
    proposeCreateCustomer: false,
  };
}

/**
 * Vollständiges Customer-Reply-Proposal für Turn/Review.
 */
export function buildCustomerReplyProposal({
  contact = {},
  resolution = {},
  facts = [],
  nextActions = null,
  rawText = '',
  replyBody = '',
} = {}) {
  const status = resolution.status || 'none';
  const actions = Array.isArray(nextActions) && nextActions.length
    ? nextActions
    : proposeCustomerReplyNextActions({ text: replyBody || rawText, facts });

  return {
    detected: true,
    kind: 'customer_reply',
    contact: {
      fullName: contact.fullName || null,
      email: contact.email || null,
      phone: contact.phone || null,
      subject: contact.subject || null,
      sourceHint: contact.sourceHint || 'customer_reply',
      isForwarded: Boolean(contact.isForwarded),
    },
    replyBody: replyBody || extractCustomerReplyBody(rawText, contact),
    resolutionStatus: status,
    matchedLeadId: resolution.lead?.id || null,
    matchedLeadName: resolution.lead?.contact?.name || resolution.lead?.name || null,
    customerSearchResults: resolution.results || [],
    duplicateHint: resolution.duplicateHint
      || (status === 'none' ? 'Kunde nicht eindeutig – bitte Akte öffnen oder wählen.' : null),
    proposeCreateCustomer: false,
    nextActions: actions,
    nextAction: actions[0] || null,
    factLabels: (facts || [])
      .filter((f) => f.factClass !== SELLER_FACT_CLASS.MESSAGE_INSTRUCTION)
      .filter((f) => !['email', 'customerName', 'phone'].includes(f.field))
      .map((f) => f.label)
      .filter(Boolean)
      .slice(0, 12),
  };
}

/**
 * Universal-Review für Kundenantwort.
 */
export function buildCustomerReplyReviewModel(reply = null, turn = {}) {
  if (!reply?.detected) return null;

  const groups = [];
  const contactLines = [
    reply.contact?.fullName,
    reply.contact?.email,
    reply.contact?.subject ? `Betreff: ${reply.contact.subject}` : null,
  ].filter(Boolean);

  if (reply.resolutionStatus === 'unique' && reply.matchedLeadName) {
    groups.push({
      id: 'customer',
      title: 'KUNDE',
      line: `${reply.matchedLeadName} · Antwort zuordnen`,
      items: [
        { label: reply.matchedLeadName, tone: 'match' },
        ...(reply.customerSearchResults?.[0]?.matchReasons || []).map((r) => ({ label: r })),
      ],
    });
  } else if (reply.resolutionStatus === 'ambiguous') {
    groups.push({
      id: 'customer',
      title: 'KUNDE',
      line: `${reply.customerSearchResults?.length || 0} mögliche Treffer`,
      items: (reply.customerSearchResults || []).slice(0, 4).map((r) => ({
        label: r.customerName || 'Kunde',
        tone: 'open',
      })),
    });
  } else {
    groups.push({
      id: 'customer',
      title: 'KUNDE',
      line: 'Nicht eindeutig zugeordnet',
      items: [
        { label: reply.duplicateHint || 'Bitte Kundenakte öffnen oder wählen', tone: 'open' },
        ...contactLines.slice(0, 2).map((label) => ({ label })),
      ],
    });
  }

  const factLabels = reply.factLabels?.length
    ? reply.factLabels
    : (turn.extractedFacts || [])
      .filter((f) => !['email', 'customerName', 'phone'].includes(f.field))
      .map((f) => f.label)
      .filter(Boolean)
      .slice(0, 8);

  if (factLabels.length) {
    groups.push({
      id: 'facts',
      title: 'ERKANNTE ANGABEN',
      line: factLabels.join(' · '),
      items: factLabels.map((label) => ({ label })),
    });
  }

  const actionLabels = (reply.nextActions || [])
    .map((a) => a.label)
    .filter(Boolean);
  if (actionLabels.length) {
    groups.push({
      id: 'next',
      title: 'VORBEREITETE AKTIONEN',
      line: actionLabels.join(' · '),
      items: actionLabels.map((label) => ({ label })),
    });
  }

  if (reply.replyBody) {
    groups.push({
      id: 'body',
      title: 'KUNDENANTWORT',
      line: reply.replyBody.length > 120
        ? `${reply.replyBody.slice(0, 117)}…`
        : reply.replyBody,
      items: [{ label: reply.replyBody }],
    });
  }

  const primaryCta = reply.resolutionStatus === 'unique'
    ? 'Übernehmen'
    : reply.resolutionStatus === 'ambiguous'
      ? 'Kunde wählen'
      : 'Kunde wählen';

  return {
    title: '✨ Clever hat die Kundenantwort erkannt',
    groups,
    actionSections: [{
      id: 'customer_reply_review',
      kind: 'customer_reply_review',
      title: 'Kundenantwort',
      headline: reply.matchedLeadName || 'Antwort zuordnen',
      body: [
        contactLines.join('\n'),
        factLabels.length ? `Angaben: ${factLabels.join(' · ')}` : null,
        actionLabels.length ? `Aktionen: ${actionLabels.join(' · ')}` : null,
      ].filter(Boolean).join('\n\n'),
      customerReply: reply,
      primaryActions: reply.resolutionStatus === 'ambiguous'
        ? (reply.customerSearchResults || []).slice(0, 4).map((r) => ({
          id: `open-${r.leadId || r.customerId}`,
          label: `${r.customerName || 'Kunde'} öffnen`,
          leadId: r.leadId || r.customerId,
          action: 'open_customer',
        }))
        : reply.resolutionStatus === 'unique'
          ? [{
            id: 'accept_customer_reply',
            label: primaryCta,
            action: 'accept_customer_reply',
            leadId: reply.matchedLeadId || null,
          }]
          : [{
            id: 'pick_customer',
            label: 'Kunde wählen',
            action: 'open_customer_search',
          }],
    }],
    factCount: factLabels.length,
    summaryLine: reply.resolutionStatus === 'unique'
      ? 'Antwort zuordnen – Fakten und Aktionen erst nach Bestätigung.'
      : 'Kundenantwort erkannt – bitte Kunden zuordnen',
    missingLine: reply.duplicateHint || null,
    primaryCta,
    secondaryCta: 'Verwerfen',
    reviewType: 'customer_reply_review',
    kind: 'customer_reply',
    customerReply: reply,
    resolvedCustomer: reply.matchedLeadId
      ? { id: reply.matchedLeadId, name: reply.matchedLeadName }
      : null,
  };
}

/** Re-export für Orchestrierung / Tests */
export { extractInboundContact, resolveInboundCustomer };
