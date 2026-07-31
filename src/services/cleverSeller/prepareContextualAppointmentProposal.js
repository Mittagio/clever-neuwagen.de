/**
 * Kontextbezogener Terminvorschlag + Kundennachricht (Slice 5).
 * Keine Kalenderbuchung, kein Auto-Send.
 */
import {
  APPOINTMENT_TYPES,
  APPOINTMENT_STATUS,
  appointmentTypeLabel,
  detectAppointmentType,
  getAppointmentDurationMinutes,
  formatAppointmentWhen,
  buildAppointmentRecord,
} from '../dealer/sellerAppointmentAssistFlow.js';
import { resolveRelativeDateTime, resolveMultipleRelativeDateTimes } from './resolveRelativeDateTime.js';
import { beginCustomerMessageEdit } from '../crm/composerMode.js';
import { validateCustomerMessageNotSellerCommand } from './validateSellerCommandMessage.js';

/**
 * Fahrzeugkontext aus Working Context – keine Customer Truth.
 */
export function extractVehicleContextFromWorking(workingContextItems = [], lead = {}) {
  const items = Array.isArray(workingContextItems) ? workingContextItems : [];
  for (const item of items) {
    const model = item.model
      || item.modelKey
      || item.vehicle?.model
      || item.preparedOffer?.vehicle?.model
      || item.vehicleIdentity?.modelKey
      || null;
    const trim = item.trim
      || item.trimId
      || item.vehicle?.trim
      || item.preparedOffer?.vehicle?.trim
      || item.vehicleIdentity?.trimId
      || null;
    const label = item.vehicleLabel
      || item.shortLabel
      || item.label
      || [model, trim].filter(Boolean).join(' ');
    if (model || /picanto|sportage|xceed|ev\s?\d|kia/i.test(String(label))) {
      const modelClean = String(model || label)
        .replace(/^kia\s+/i, '')
        .replace(/\s+gt-?line.*/i, '')
        .split(/[·,]/)[0]
        .trim();
      const trimClean = trim
        || (/gt-?line/i.test(String(label)) ? 'GT-Line' : null);
      return {
        model: modelClean || null,
        trim: trimClean,
        label: label
          ? (String(label).startsWith('Kia') ? String(label) : `Kia ${String(label).replace(/^kia\s+/i, '')}`)
          : null,
        source: 'working_context',
      };
    }
  }

  // Explizites Fahrzeug im Seller-Input (nicht nur Working Context)
  return null;
}

export function extractVehicleFromSellerInput(sellerInput = '') {
  const t = String(sellerInput);
  const m = t.match(/\b(picanto|sportage|xceed|ev\s?[2-9]|ceed|niro|sorento|tivoli)\b/i);
  if (!m) return null;
  const model = m[1].toLowerCase().replace(/\s+/g, '');
  const trim = /\bgt[-\s]?line\b/i.test(t) ? 'GT-Line' : null;
  const label = [`Kia ${model.charAt(0).toUpperCase()}${model.slice(1)}`, trim].filter(Boolean).join(' ');
  return { model, trim, label, source: 'seller_input' };
}

/**
 * @param {{
 *   sellerInput: string,
 *   lead?: object,
 *   customerName?: string,
 *   workingContextItems?: object[],
 *   pendingAppointment?: object|null,
 *   now?: Date|string|number,
 *   calendarAvailability?: object|null,
 *   sellerClaimsAvailable?: boolean,
 * }} params
 */
export function prepareContextualAppointmentProposal(params = {}) {
  const sellerInput = String(params.sellerInput || '').trim();
  const lead = params.lead || {};
  const pending = params.pendingAppointment || null;
  const now = params.now != null ? new Date(params.now) : new Date();

  const followUpToneOnly = /\b(persönlicher|wärmer|freundlicher|formeller)\b/i.test(sellerInput)
    && !/\b(uhr|montag|dienstag|mittwoch|donnerstag|freitag|termin)\b/i.test(sellerInput);

  const dualSlots = /\b(montag|dienstag|mittwoch|donnerstag|freitag).{0,40}\b(?:und|oder)\b.{0,20}\b(montag|dienstag|mittwoch|donnerstag|freitag)/i.test(sellerInput)
    ? resolveMultipleRelativeDateTimes(sellerInput, { now })
    : [];

  const resolvedDateTime = dualSlots.length >= 2
    ? dualSlots[0]
    : resolveRelativeDateTime(sellerInput, {
      now,
      previousStartsAt: pending?.startsAt || pending?.startAt || null,
    });

  const explicitTestDrive = /\bprobefahrt\b|\bprobe\s*fahrt\b|\bfahren\b/i.test(sellerInput);
  const appointmentType = followUpToneOnly && pending?.appointmentType
    ? pending.appointmentType
    : (detectAppointmentType(sellerInput, {
      forceTestDrive: explicitTestDrive,
      activeTestDriveJourney: Boolean(params.activeTestDriveJourney),
    }) || pending?.appointmentType || APPOINTMENT_TYPES.SHOWROOM_VISIT);

  // Keine Probefahrt nur aus Working-Context ableiten
  const finalType = (!explicitTestDrive && appointmentType === APPOINTMENT_TYPES.TEST_DRIVE
    && !params.activeTestDriveJourney)
    ? APPOINTMENT_TYPES.SHOWROOM_VISIT
    : appointmentType;

  // „direkt eintragen“ ohne Kundenzusage
  const wantsDirectBook = /\b(trag|trage|eintragen|direkt\s+ein|sofort\s+ein)\b/i.test(sellerInput)
    && !params.customerConfirmed;
  if (wantsDirectBook) {
    const dt = resolvedDateTime.ok ? resolvedDateTime : resolveRelativeDateTime(
      pending?.startsAt ? formatAppointmentWhen(pending.startsAt) : sellerInput,
      { now, previousStartsAt: pending?.startsAt },
    );
    return {
      ok: true,
      status: 'needs_customer_confirmation_first',
      sendable: false,
      bookable: false,
      warnings: ['no_customer_acceptance_documented'],
      uiHint: {
        message: 'Ohne dokumentierte Kundenzusage sollte der Termin nicht blind eingetragen werden.',
        actions: ['propose_first', 'discard'],
      },
      resolvedDateTime: dt,
      preparedAppointment: null,
      messageDraft: null,
      handoff: null,
    };
  }

  if (followUpToneOnly && pending?.messageDraft) {
    const rewritten = rewriteAppointmentMessageTone(pending.messageDraft, sellerInput);
    const handoff = beginCustomerMessageEdit({
      result: { body: rewritten },
      recipient: params.customerName || lead.contact?.name || lead.name || 'Kunde',
      contextAttachments: params.workingContextItems || [],
    });
    return {
      ok: true,
      status: 'message_rewritten',
      sendable: true,
      bookable: false,
      resolvedDateTime: {
        ok: true,
        startsAt: pending.startsAt,
        dateLabel: pending.dateLabel,
        timeLabel: pending.timeLabel,
        whenLabel: pending.whenLabel || formatAppointmentWhen(pending.startsAt),
      },
      preparedAppointment: {
        ...pending,
        needsSellerConfirmation: true,
      },
      messageDraft: rewritten,
      handoff: {
        ...handoff,
        kind: 'appointment_message',
        messageDraft: rewritten,
        preparedAppointment: pending,
      },
      mutatesCustomer: false,
      availabilityStatus: pending.availabilityStatus || 'not_checked',
    };
  }

  if (!resolvedDateTime.ok && dualSlots.length < 2) {
    return {
      ok: true,
      status: 'missing_datetime',
      sendable: false,
      bookable: false,
      resolvedDateTime,
      preparedAppointment: null,
      messageDraft: null,
      uiHint: {
        message: resolvedDateTime.missing === 'time'
          ? 'Um welche Uhrzeit soll ich den Termin vorschlagen?'
          : 'Für welchen Tag soll ich den Termin vorschlagen?',
        actions: ['clarify_datetime'],
      },
      mutatesCustomer: false,
    };
  }

  const vehicleFromWorking = extractVehicleContextFromWorking(
    params.workingContextItems,
    lead,
  );
  const vehicleFromInput = extractVehicleFromSellerInput(sellerInput);
  const vehicleContext = vehicleFromInput || vehicleFromWorking || pending?.vehicleContext || null;

  const sellerClaimsAvailable = Boolean(params.sellerClaimsAvailable)
    || /\b(ist frei|frei ist|kalender ist frei|termin ist frei)\b/i.test(sellerInput);
  const calendarAvailability = params.calendarAvailability || null;
  const availabilityStatus = calendarAvailability?.checked
    ? (calendarAvailability.available ? 'available' : 'busy')
    : (sellerClaimsAvailable ? 'seller_claimed' : 'not_checked');

  const slots = dualSlots.length >= 2
    ? dualSlots
    : [resolvedDateTime];

  const primary = slots[0];
  const preparedAppointment = {
    type: 'propose_appointment',
    customerId: lead.id || null,
    customerName: params.customerName || lead.contact?.name || lead.name || null,
    appointmentType: finalType,
    appointmentTypeLabel: appointmentTypeLabel(finalType),
    startsAt: primary.startsAt,
    durationMinutes: null,
    vehicleContext: vehicleContext
      ? {
        model: vehicleContext.model,
        trim: vehicleContext.trim,
        label: vehicleContext.label,
        source: vehicleContext.source,
      }
      : null,
    status: 'proposed',
    availabilityStatus,
    availabilitySource: calendarAvailability?.checked
      ? 'calendar_check'
      : (sellerClaimsAvailable ? 'seller_input' : 'not_checked'),
    needsSellerConfirmation: true,
    dateLabel: primary.dateLabel || primary.shortDateLabel,
    timeLabel: primary.timeLabel,
    whenLabel: primary.whenLabel,
    alternativeSlots: slots.length > 1
      ? slots.slice(1).map((s) => ({
        startsAt: s.startsAt,
        dateLabel: s.dateLabel,
        timeLabel: s.timeLabel,
        whenLabel: s.whenLabel,
      }))
      : [],
    mutatesCustomer: false,
    bookable: false,
  };

  // Legacy-kompatibler Appointment-Record für bestehende Pfade
  const legacyRecord = buildAppointmentRecord({
    type: finalType,
    startAt: primary.startsAt,
    lead,
    sellerFacts: vehicleContext?.label
      ? [{ key: 'vehicle', label: vehicleContext.label.replace(/^Kia\s+/i, '') }]
      : [],
    status: APPOINTMENT_STATUS.DRAFT,
    sourceInput: sellerInput,
  });
  legacyRecord.vehicleContext = vehicleContext?.label || legacyRecord.vehicleContext;
  legacyRecord.availabilityStatus = availabilityStatus;

  let messageDraft = buildSuggestionMessage({
    recipient: params.customerName || lead.contact?.name || lead.name || 'Kunde',
    slots,
    appointmentType: finalType,
    vehicleContext,
    tonePersonal: /\bpersönlicher\b/i.test(sellerInput),
  });

  if (!validateCustomerMessageNotSellerCommand(messageDraft).ok) {
    messageDraft = buildSuggestionMessage({
      recipient: params.customerName || lead.contact?.name || lead.name || 'Kunde',
      slots,
      appointmentType: finalType,
      vehicleContext,
      tonePersonal: true,
    });
  }

  const handoff = beginCustomerMessageEdit({
    result: { body: messageDraft },
    recipient: preparedAppointment.customerName || 'Kunde',
    contextAttachments: [
      ...(params.workingContextItems || []),
      {
        id: 'appointment-proposal',
        kind: 'appointment_proposal',
        label: `${preparedAppointment.appointmentTypeLabel} · ${preparedAppointment.whenLabel}`,
        shortLabel: preparedAppointment.whenLabel,
        preparedAppointment,
        oneShot: true,
      },
    ],
  });

  return {
    ok: true,
    status: 'prepared',
    sendable: Boolean(messageDraft),
    bookable: false,
    resolvedDateTime: primary,
    resolvedDateTimes: slots,
    preparedAppointment,
    legacyAppointment: legacyRecord,
    messageDraft,
    availabilityStatus,
    sellerClaimsAvailable,
    warnings: [
      availabilityStatus === 'not_checked' ? 'calendar_availability_not_checked' : null,
      sellerClaimsAvailable ? 'availability_is_seller_claim_not_calendar_check' : null,
    ].filter(Boolean),
    handoff: {
      ...handoff,
      kind: 'appointment_message',
      messageDraft,
      preparedAppointment,
      composerMode: handoff.composerMode,
    },
    mutatesCustomer: false,
    evidence: [
      { kind: 'date_phrase', source: 'seller_input', value: sellerInput },
      { kind: 'resolved_date', source: 'deterministic_datetime_resolver', value: primary.startsAt },
      vehicleContext
        ? { kind: 'vehicle', source: vehicleContext.source, value: vehicleContext.label }
        : null,
      { kind: 'availability', source: preparedAppointment.availabilitySource, value: availabilityStatus },
    ].filter(Boolean),
  };
}

function buildSuggestionMessage({
  recipient,
  slots = [],
  appointmentType,
  vehicleContext,
  tonePersonal = false,
} = {}) {
  const name = /^(herr|frau)\b/i.test(recipient) ? recipient : `Herr ${recipient}`;
  const primary = slots[0];
  const vehicleLabel = vehicleContext?.label || null;
  const isTestDrive = appointmentType === APPOINTMENT_TYPES.TEST_DRIVE;

  const lines = [
    `Hallo ${name},`,
    '',
  ];

  if (slots.length >= 2) {
    const a = slots[0];
    const b = slots[1];
    lines.push(
      tonePersonal
        ? `ich würde mich freuen, Sie bald persönlich zu treffen.`
        : `wie wäre es bei Ihnen an einem der folgenden Termine?`,
      '',
      `• ${a.dateLabel || a.whenLabel} um ${a.timeLabel} Uhr`,
      `• ${b.dateLabel || b.whenLabel} um ${b.timeLabel} Uhr`,
    );
  } else {
    const datePart = primary?.dateLabel || primary?.shortDateLabel || 'dem vorgeschlagenen Tag';
    const timePart = primary?.timeLabel || '15:00';
    lines.push(
      tonePersonal
        ? `mir wäre es eine Freude, Sie am ${datePart} um ${timePart} Uhr bei uns begrüßen zu dürfen.`
        : `wie wäre es bei Ihnen am ${datePart} um ${timePart} Uhr?`,
    );
  }

  lines.push('');
  if (isTestDrive) {
    lines.push(
      vehicleLabel
        ? `Dann können wir eine Probefahrt mit dem ${vehicleLabel} machen.`
        : 'Dann können wir eine Probefahrt gemeinsam planen.',
    );
  } else if (vehicleLabel) {
    lines.push(`Dann können wir uns den ${vehicleLabel} gemeinsam in Ruhe ansehen.`);
  } else {
    lines.push('Dann können wir uns in Ruhe im Autohaus unterhalten.');
  }

  lines.push('');
  lines.push('Geben Sie mir gerne kurz Bescheid, ob der Termin für Sie passt.');
  lines.push('');
  lines.push('Viele Grüße');

  return lines.join('\n');
}

function rewriteAppointmentMessageTone(previousBody = '', sellerInput = '') {
  const body = String(previousBody || '');
  if (/\bpersönlicher|wärmer|freundlicher\b/i.test(sellerInput)) {
    return body
      .replace(/wie wäre es bei Ihnen/i, 'ich würde mich freuen, wenn wir uns')
      .replace(/Geben Sie mir gerne kurz Bescheid,\s*ob der Termin für Sie passt\./i,
        'Ich freue mich sehr auf Ihre kurze Rückmeldung, ob Ihnen der Termin passt.');
  }
  return body;
}

export function isAppointmentFollowUpInput(sellerInput = '', pendingAppointment = null) {
  if (!pendingAppointment?.startsAt && !pendingAppointment?.startAt) return false;
  const t = String(sellerInput || '').trim();
  if (!t) return false;
  if (/\b(schreib|erstell|angebot)\b/i.test(t) && !/\b(lieber|besser|eher|dann)\b/i.test(t)) {
    return false;
  }
  if (/\b(lieber|besser|eher|dann)\b/i.test(t) && /\b\d{1,2}\b/.test(t)) return true;
  if (/\b(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/i.test(t)) return true;
  if (/\bpersönlicher|wärmer|freundlicher\b/i.test(t)) return true;
  if (/\bund\b.+\b(montag|dienstag|mittwoch|donnerstag|freitag)\b/i.test(t)) return true;
  if (/^(?:um\s*)?\d{1,2}(?:[:.]\d{2})?\s*(?:uhr)?\s*$/i.test(t)) return true;
  return false;
}
