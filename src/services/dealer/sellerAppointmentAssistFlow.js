/**
 * Clever Termin-Assistent – Probefahrt / Rückruf / Übergabe / Beratung.
 * Kein Kalender-Klon: CRM-Appointment + followUpAt + Nachricht.
 */
import { buildCleverGreeting } from '../cleverAntworten.js';
import {
  detectSellerActionIntent,
  SELLER_ACTION_INTENTS,
  extractSellerFactsFromInput,
} from './sellerActionIntent.js';

/** Gleicher Wert wie INLINE_RESULT_TYPES.APPOINTMENT_DRAFT – ohne Import-Zyklus. */
const APPOINTMENT_DRAFT_TYPE = 'appointment_draft';

export const APPOINTMENT_TYPES = {
  TEST_DRIVE: 'test_drive',
  CALLBACK: 'callback',
  HANDOVER: 'handover',
  CONSULTATION: 'consultation',
};

export const APPOINTMENT_STATUS = {
  DRAFT: 'draft',
  PROPOSED: 'proposed',
  CUSTOMER_CONFIRMED: 'customer_confirmed',
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const DURATION_MINUTES = {
  [APPOINTMENT_TYPES.TEST_DRIVE]: 60,
  [APPOINTMENT_TYPES.CALLBACK]: 15,
  [APPOINTMENT_TYPES.HANDOVER]: 60,
  [APPOINTMENT_TYPES.CONSULTATION]: 60,
};

const TYPE_LABELS = {
  [APPOINTMENT_TYPES.TEST_DRIVE]: 'Probefahrt',
  [APPOINTMENT_TYPES.CALLBACK]: 'Rückruf',
  [APPOINTMENT_TYPES.HANDOVER]: 'Fahrzeugübergabe',
  [APPOINTMENT_TYPES.CONSULTATION]: 'Beratungsgespräch',
};

const WEEKDAYS = {
  sonntag: 0,
  montag: 1,
  dienstag: 2,
  mittwoch: 3,
  donnerstag: 4,
  freitag: 5,
  samstag: 6,
};

function customerDisplayName(lead = {}) {
  const raw = lead?.name
    || [lead?.firstName, lead?.lastName].filter(Boolean).join(' ')
    || lead?.crm?.customerName
    || '';
  return String(raw).trim() || 'Kunde';
}

function salutationName(lead = {}) {
  const name = customerDisplayName(lead);
  if (/^(herr|frau)\b/i.test(name)) return name;
  return name;
}

function vehicleContextLabel(lead = {}, sellerFacts = []) {
  const fromFact = sellerFacts.find((f) => f.key === 'vehicle')?.label;
  if (fromFact) return fromFact.startsWith('Kia') ? fromFact : `Kia ${fromFact}`;
  const model = lead?.vehicle?.model || lead?.wish?.model || lead?.crm?.needProfile?.selectedModelKey;
  const trim = lead?.vehicle?.trim || lead?.wish?.trimLabel;
  if (!model) return null;
  const cleaned = String(model).replace(/^kia\s*/i, '');
  return [`Kia ${cleaned}`, trim].filter(Boolean).join(' ');
}

export function appointmentTypeLabel(type) {
  return TYPE_LABELS[type] || 'Termin';
}

export function getAppointmentDurationMinutes(type) {
  return DURATION_MINUTES[type] ?? 60;
}

/**
 * Datum/Uhrzeit aus Verkäufer-Freitext.
 */
export function parseAppointmentDateTime(text = '', now = new Date()) {
  const t = String(text ?? '').trim().toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!t) return { startAt: null, missing: 'datetime' };

  let base = new Date(now);
  let dateFound = false;

  const iso = t.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  const de = t.match(/\b(\d{1,2})\.(\d{1,2})\.(?:(20\d{2}))?\b/);
  if (iso) {
    base = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 0, 0, 0, 0);
    dateFound = true;
  } else if (de) {
    const year = de[3] ? Number(de[3]) : now.getFullYear();
    base = new Date(year, Number(de[2]) - 1, Number(de[1]), 0, 0, 0, 0);
    if (base < startOfDay(now) && !de[3]) base.setFullYear(year + 1);
    dateFound = true;
  } else if (/\bheute\b/.test(t)) {
    base = startOfDay(now);
    dateFound = true;
  } else if (/\bmorgen\b/.test(t)) {
    base = startOfDay(now);
    base.setDate(base.getDate() + 1);
    dateFound = true;
  } else if (/\buber morgen\b|\bübermorgen\b/.test(t)) {
    base = startOfDay(now);
    base.setDate(base.getDate() + 2);
    dateFound = true;
  } else {
    for (const [name, dow] of Object.entries(WEEKDAYS)) {
      if (new RegExp(`\\b${name}\\b`).test(t)) {
        base = nextWeekday(now, dow);
        dateFound = true;
        break;
      }
    }
  }

  const timeMatch = t.match(/\b(?:um\s*)?(\d{1,2})(?:[:.](\d{2}))?\s*uhr\b/)
    || t.match(/\b(?:um\s*)?(\d{1,2})[:.](\d{2})\b/)
    || t.match(/\bum\s+(\d{1,2})\b/);
  let hour = null;
  let minute = 0;
  if (timeMatch) {
    hour = Number(timeMatch[1]);
    minute = timeMatch[2] != null ? Number(timeMatch[2]) : 0;
    if (hour >= 0 && hour <= 23) {
      base.setHours(hour, minute, 0, 0);
    } else {
      hour = null;
    }
  }

  if (!dateFound && hour == null) {
    return { startAt: null, missing: 'datetime' };
  }
  if (!dateFound && hour != null) {
    return { startAt: null, missing: 'date', partialTime: { hour, minute } };
  }
  if (dateFound && hour == null) {
    return { startAt: null, missing: 'time', partialDate: base.toISOString() };
  }

  return { startAt: base.toISOString(), missing: null };
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function nextWeekday(from, weekday) {
  const d = startOfDay(from);
  const delta = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + delta);
  return d;
}

export function detectAppointmentType(text = '') {
  const t = String(text ?? '').toLowerCase();
  if (/\bprobefahrt\b|\bprobe\s*fahrt\b|\bprobefahren\b/.test(t)) {
    return APPOINTMENT_TYPES.TEST_DRIVE;
  }
  if (/\bubergabe\b|\bübergabe\b|\babholung\b/.test(t)) {
    return APPOINTMENT_TYPES.HANDOVER;
  }
  if (/\bberatung\b|\bberatungsgesprach\b|\bberatungsgespräch\b/.test(t)) {
    return APPOINTMENT_TYPES.CONSULTATION;
  }
  if (/\bruckruf\b|\brückruf\b|\banrufen\b|\bcallback\b|\bruf\s+(ihn|sie|ihm)/.test(t)) {
    return APPOINTMENT_TYPES.CALLBACK;
  }
  if (/\btermin\b/.test(t)) return APPOINTMENT_TYPES.CONSULTATION;
  return null;
}

export function isAppointmentSellerIntent(text = '') {
  const intent = detectSellerActionIntent(text);
  if (intent === SELLER_ACTION_INTENTS.PREPARE_CALLBACK) return true;
  if (intent === SELLER_ACTION_INTENTS.PROPOSE_APPOINTMENT) return true;
  return Boolean(detectAppointmentType(text));
}

function formatDeDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function formatDeTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function formatAppointmentWhen(iso) {
  if (!iso) return '';
  return `${formatDeDate(iso)} · ${formatDeTime(iso)} Uhr`;
}

function buildCustomerProposalMessage(lead, appointment) {
  const name = salutationName(lead);
  const greeting = buildCleverGreeting(name, lead?.salutation ?? null);
  const typeLabel = appointmentTypeLabel(appointment.type);
  const when = formatAppointmentWhen(appointment.startAt);
  const vehicle = appointment.vehicleContext;
  const dealer = lead?.ownerName || 'Ihr Verkaufsteam';

  if (appointment.type === APPOINTMENT_TYPES.TEST_DRIVE) {
    const vehicleLine = vehicle
      ? `sollen wir den ${vehicle} einmal gemeinsam ausprobieren?`
      : 'sollen wir eine Probefahrt vereinbaren?';
    return [
      greeting.replace(/!$/, ','),
      '',
      vehicleLine,
      '',
      `Ich könnte Ihnen am ${when} eine Probefahrt anbieten.`,
      '',
      'Passt Ihnen der Termin?',
      '',
      `Viele Grüße\n${dealer}`,
    ].join('\n');
  }

  if (appointment.type === APPOINTMENT_TYPES.CALLBACK) {
    return null; // interner Rückruf – keine Kundennachricht nötig
  }

  return [
    greeting.replace(/!$/, ','),
    '',
    `dürfen wir einen Termin für ${typeLabel.toLowerCase()}${vehicle ? ` (${vehicle})` : ''} vorschlagen?`,
    '',
    when ? `${when} – passt Ihnen das?` : 'Wann würde es Ihnen passen?',
    '',
    `Viele Grüße\n${dealer}`,
  ].join('\n');
}

function nextStepIdForType(type) {
  if (type === APPOINTMENT_TYPES.TEST_DRIVE) return 'test_drive';
  if (type === APPOINTMENT_TYPES.CALLBACK) return 'call_tomorrow';
  return 'reminder';
}

export function buildAppointmentRecord({
  type,
  startAt,
  lead,
  sellerFacts = [],
  status = APPOINTMENT_STATUS.DRAFT,
  sourceInput = '',
} = {}) {
  const durationMinutes = getAppointmentDurationMinutes(type);
  const endAt = startAt
    ? new Date(new Date(startAt).getTime() + durationMinutes * 60_000).toISOString()
    : null;
  return {
    id: `appt-${Date.now()}`,
    type,
    typeLabel: appointmentTypeLabel(type),
    customerId: lead?.id ?? null,
    vehicleContext: vehicleContextLabel(lead, sellerFacts),
    startAt,
    endAt,
    durationMinutes,
    status,
    proposedBy: 'seller',
    confirmedByCustomer: false,
    sourceInput: String(sourceInput ?? '').slice(0, 240),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * proposed → nur cleverAppointment (kein Kalender-/Wiedervorlage-Write).
 * scheduled → followUpAt + Journey-Felder + ggf. testDriveScheduledAt.
 */
export function buildCrmPatchFromAppointment(appointment, {
  markScheduled = false,
  markProposed = false,
} = {}) {
  if (!appointment) return {};
  let status = appointment.status;
  if (markScheduled) status = APPOINTMENT_STATUS.SCHEDULED;
  else if (markProposed) status = APPOINTMENT_STATUS.PROPOSED;

  const cleverAppointment = {
    ...appointment,
    status,
    updatedAt: new Date().toISOString(),
  };

  if (!markScheduled) {
    return { cleverAppointment };
  }

  if (!appointment.startAt) return { cleverAppointment };

  const patch = {
    cleverAppointment,
    followUpAt: appointment.startAt,
    nextStepId: nextStepIdForType(appointment.type),
    nextStepLabel: appointment.typeLabel,
    followUpSource: 'manual',
  };
  if (appointment.type === APPOINTMENT_TYPES.TEST_DRIVE) {
    patch.testDriveScheduledAt = appointment.startAt;
    patch.testDriveAppointmentAt = appointment.startAt;
  }
  return patch;
}

export function applyAppointmentCrmPatch(lead = {}, patch = {}) {
  if (!lead?.id || !patch || !Object.keys(patch).length) return lead;
  return {
    ...lead,
    crm: {
      ...(lead.crm ?? {}),
      ...patch,
    },
  };
}

/**
 * Nach eingehender Kundennachricht: Status am offenen Termin aktualisieren.
 */
export function applyCustomerAppointmentReplyToLead(lead = {}, text = '') {
  const open = getOpenCleverAppointment(lead);
  if (!open || open.status !== APPOINTMENT_STATUS.PROPOSED) return { lead, reply: null };

  const reply = detectCustomerAppointmentReply(text, open);
  if (!reply) return { lead, reply: null };

  if (reply.kind === 'confirm') {
    const nextAppt = {
      ...open,
      status: APPOINTMENT_STATUS.CUSTOMER_CONFIRMED,
      confirmedByCustomer: true,
      updatedAt: new Date().toISOString(),
    };
    return {
      lead: applyAppointmentCrmPatch(lead, { cleverAppointment: nextAppt }),
      reply: { ...reply, appointment: nextAppt },
    };
  }

  if (reply.kind === 'change_request' && reply.proposedStartAt) {
    const nextAppt = {
      ...open,
      pendingChangeStartAt: reply.proposedStartAt,
      updatedAt: new Date().toISOString(),
    };
    return {
      lead: applyAppointmentCrmPatch(lead, { cleverAppointment: nextAppt }),
      reply: { ...reply, appointment: nextAppt },
    };
  }

  return { lead, reply };
}

/**
 * Kundennachricht: Bestätigung / Verschiebung / Absage erkennen.
 */
export function detectCustomerAppointmentReply(text = '', openAppointment = null) {
  const t = String(text ?? '').trim().toLowerCase();
  if (!t || !openAppointment) return null;

  if (/\b(leider|kann nicht|absagen|stornier|passt nicht|geht nicht)\b/.test(t)) {
    return { kind: 'cancel_or_reschedule', appointment: openAppointment };
  }

  const parsed = parseAppointmentDateTime(t);
  if (parsed.startAt && /\b(statt|besser|eher|geht|um)\b/.test(t)) {
    return {
      kind: 'change_request',
      appointment: openAppointment,
      proposedStartAt: parsed.startAt,
    };
  }

  // Nur Uhrzeit genannt → Datum vom offenen Vorschlag behalten
  if (parsed.missing === 'date' && parsed.partialTime && openAppointment?.startAt) {
    const base = new Date(openAppointment.startAt);
    base.setHours(parsed.partialTime.hour, parsed.partialTime.minute, 0, 0);
    return {
      kind: 'change_request',
      appointment: openAppointment,
      proposedStartAt: base.toISOString(),
    };
  }

  if (/\b(ja|passt|gerne|einverstanden|ok|okay|super|machen wir|15 uhr ist gut|passt mir)\b/.test(t)) {
    return { kind: 'confirm', appointment: openAppointment };
  }

  return null;
}

export function getOpenCleverAppointment(lead = {}) {
  const appt = lead?.crm?.cleverAppointment ?? null;
  if (!appt) return null;
  if ([
    APPOINTMENT_STATUS.PROPOSED,
    APPOINTMENT_STATUS.CUSTOMER_CONFIRMED,
    APPOINTMENT_STATUS.DRAFT,
  ].includes(appt.status)) {
    return appt;
  }
  return null;
}

/**
 * @returns {{ ok: boolean, results: object[], appointment: object|null, mode: string }|null}
 */
export function runSellerAppointmentAssist(lead = {}, draftText = '', options = {}) {
  const text = String(draftText ?? '').trim();
  if (!text || text.length < 3) return null;

  const previous = options.previousAppointment ?? getOpenCleverAppointment(lead);
  const type = detectAppointmentType(text)
    || previous?.type
    || (detectSellerActionIntent(text) === SELLER_ACTION_INTENTS.PREPARE_CALLBACK
      ? APPOINTMENT_TYPES.CALLBACK
      : null);

  if (!type && !isAppointmentSellerIntent(text)) {
    // Follow-up nur Uhrzeit/Datum während offenem Draft
    if (!previous || !/heute|morgen|uhr|\d{1,2}\.\d{1,2}|\d{1,2}:\d{2}/i.test(text)) {
      return null;
    }
  }

  const resolvedType = type || previous?.type || APPOINTMENT_TYPES.CONSULTATION;
  const sellerFacts = extractSellerFactsFromInput(text);
  const parsed = parseAppointmentDateTime(text, options.now ? new Date(options.now) : new Date());
  const name = customerDisplayName(lead);

  // Slot missing
  if (parsed.missing) {
    const askDate = parsed.missing === 'datetime' || parsed.missing === 'date';
    const choices = askDate
      ? [
        { id: 'today', label: 'Heute', insertText: 'heute um 15 Uhr' },
        { id: 'tomorrow', label: 'Morgen', insertText: 'morgen um 15 Uhr' },
        { id: 'pick', label: 'Termin nennen', insertText: 'am 02.08.2026 um 15 Uhr' },
      ]
      : [
        { id: 't10', label: '10:00', insertText: 'um 10 Uhr' },
        { id: 't15', label: '15:00', insertText: 'um 15 Uhr' },
        { id: 't16', label: '16:00', insertText: 'um 16 Uhr' },
      ];

    const draftAppt = buildAppointmentRecord({
      type: resolvedType,
      startAt: null,
      lead,
      sellerFacts,
      status: APPOINTMENT_STATUS.DRAFT,
      sourceInput: text,
    });

    return {
      ok: true,
      mode: 'appointment',
      appointment: draftAppt,
      results: [{
        type: APPOINTMENT_DRAFT_TYPE,
        title: '✨ Clever',
        headline: `${appointmentTypeLabel(resolvedType)} vorbereiten`,
        body: askDate
          ? `Wann möchten Sie die ${appointmentTypeLabel(resolvedType)} anbieten?`
          : 'Um welche Uhrzeit?',
        hint: 'Ein fehlender Punkt – dann bereite ich die Nachricht vor.',
        appointment: draftAppt,
        choices,
        primaryCta: null,
        requiresCustomerMessage: resolvedType !== APPOINTMENT_TYPES.CALLBACK,
      }],
    };
  }

  const appointment = buildAppointmentRecord({
    type: resolvedType,
    startAt: parsed.startAt,
    lead,
    sellerFacts,
    status: APPOINTMENT_STATUS.DRAFT,
    sourceInput: text,
  });

  const messageBody = buildCustomerProposalMessage(lead, appointment);
  const when = formatAppointmentWhen(appointment.startAt);
  const bodyLines = [
    `${appointment.typeLabel}`,
    when,
    appointment.vehicleContext || null,
  ].filter(Boolean);

  const isInternal = resolvedType === APPOINTMENT_TYPES.CALLBACK;

  return {
    ok: true,
    mode: 'appointment',
    appointment,
    results: [{
      type: APPOINTMENT_DRAFT_TYPE,
      title: '✨ Clever hat vorbereitet',
      headline: isInternal
        ? `Rückruf · ${name}`
        : `${appointment.typeLabel} · ${name}`,
      body: bodyLines.join('\n'),
      hint: isInternal
        ? 'Interner Termin – kein Kundenchat nötig.'
        : 'Nachricht an den Kunden ist vorbereitet.',
      appointment,
      draft: messageBody ? { body: messageBody, channel: 'preferred' } : null,
      messageBody,
      choices: [],
      primaryCta: isInternal ? 'Termin eintragen' : 'Vorschlag senden',
      secondaryCta: messageBody ? 'Bearbeiten' : null,
      requiresCustomerMessage: !isInternal,
      canScheduleNow: isInternal,
    }],
  };
}

/**
 * Aus Kunden-Chat: Confirmation → Review-Card für Verkäufer.
 */
export function buildCustomerAppointmentConfirmResult(lead = {}, reply = null) {
  if (!reply) return null;
  const appt = reply.appointment;
  if (!appt) return null;

  if (reply.kind === 'confirm') {
    const next = {
      ...appt,
      status: APPOINTMENT_STATUS.CUSTOMER_CONFIRMED,
      confirmedByCustomer: true,
      updatedAt: new Date().toISOString(),
    };
    return {
      ok: true,
      mode: 'appointment_confirm',
      appointment: next,
      results: [{
        type: APPOINTMENT_DRAFT_TYPE,
        title: '✓ Termin bestätigt',
        headline: `${next.typeLabel} · ${formatAppointmentWhen(next.startAt)}`,
        body: [next.vehicleContext, 'Kunde hat zugesagt.'].filter(Boolean).join('\n'),
        appointment: next,
        primaryCta: 'Termin eintragen',
        canScheduleNow: true,
        choices: [],
      }],
    };
  }

  if (reply.kind === 'change_request') {
    return {
      ok: true,
      mode: 'appointment_change',
      appointment: appt,
      results: [{
        type: APPOINTMENT_DRAFT_TYPE,
        title: '✨ Terminänderung',
        headline: `${customerDisplayName(lead)} schlägt ${formatAppointmentWhen(reply.proposedStartAt)} vor.`,
        body: `Aktuell: ${formatAppointmentWhen(appt.startAt)}`,
        appointment: appt,
        proposedStartAt: reply.proposedStartAt,
        choices: [
          {
            id: 'accept',
            label: 'Neuen Termin bestätigen',
            insertText: `Termin auf ${formatDeTime(reply.proposedStartAt)} Uhr bestätigen`,
          },
          { id: 'other', label: 'Andere Zeit', insertText: 'Anderen Termin vorschlagen' },
        ],
        primaryCta: null,
      }],
    };
  }

  if (reply.kind === 'cancel_or_reschedule') {
    return {
      ok: true,
      mode: 'appointment_cancel',
      appointment: appt,
      results: [{
        type: APPOINTMENT_DRAFT_TYPE,
        title: '✨ Terminänderung',
        headline: 'Kunde kann den Termin so nicht wahrnehmen.',
        body: formatAppointmentWhen(appt.startAt),
        appointment: appt,
        choices: [
          { id: 'new', label: 'Neuen Termin vorschlagen', insertText: 'Probefahrt neu vorschlagen' },
        ],
        primaryCta: null,
      }],
    };
  }

  return null;
}

export function listLeadAppointments(lead = {}) {
  const list = [];
  const current = lead?.crm?.cleverAppointment;
  if (current?.startAt) list.push(current);
  if (lead?.crm?.followUpAt && (!current || current.startAt !== lead.crm.followUpAt)) {
    list.push({
      id: 'followup',
      type: lead.crm.nextStepId === 'test_drive'
        ? APPOINTMENT_TYPES.TEST_DRIVE
        : APPOINTMENT_TYPES.CALLBACK,
      typeLabel: lead.crm.nextStepLabel || 'Wiedervorlage',
      startAt: lead.crm.followUpAt,
      status: APPOINTMENT_STATUS.SCHEDULED,
      vehicleContext: null,
    });
  }
  return list.sort((a, b) => String(a.startAt).localeCompare(String(b.startAt)));
}
