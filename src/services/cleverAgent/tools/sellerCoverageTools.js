/**
 * Sprint 2 – Agent-Tool-Coverage: wrappt Legacy CLEVER_SELLER_TOOLS / Services.
 * Keine zweite Business-Engine.
 */
import { wrapSellerTool, buildSellerToolContext } from '../wrapSellerTool.js';
import { runTool } from '../../cleverSeller/toolRegistry.js';
import { applyStructuredFactsToLead } from '../../cleverSeller/applyAcceptedSellerTurn.js';
import { createExtractedFact } from '../../cleverSeller/cleverSellerTurnResultSchema.js';
import { SELLER_FACT_CLASS } from '../../cleverSeller/sellerFactTypes.js';
import {
  extractTradeInCandidates,
  hasTradeInCue,
} from '../../cleverSeller/detectTradeInFromSellerInput.js';
import { answerSellerVehicleKnowledge } from '../../cleverSeller/answerSellerVehicleKnowledge.js';
import {
  lookupPackageContents,
  lookupRelevantEquipment,
} from '../../crm/magic/magicKnowledgeTools.js';
import { prepareContextualAppointmentProposal } from '../../cleverSeller/prepareContextualAppointmentProposal.js';
import { runSellerAppointmentAssist } from '../../dealer/sellerAppointmentAssistFlow.js';
import { normalizeCalendarAvailabilityResult } from '../../cleverSeller/checkCalendarAvailability.js';
import {
  classifyComposerPdfKind,
  prepareComposerPdfTurnInput,
} from '../../cleverSeller/prepareComposerPdfTurnInput.js';
import { searchGlobalCustomerHistory } from '../../cleverSeller/globalHistorySearch.js';
import { runComposerAkteSearch } from '../../crm/composerAkteSearch.js';
import { executePrepareOffer } from './createOffer.js';
import { executeCreateMessage } from './createMessage.js';

function readQuery(runtime, args, ...keys) {
  for (const key of keys) {
    const v = args?.[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return String(runtime?.sellerMessage || '').trim();
}

function readLastMessageDraft(runtime = {}) {
  const raw = runtime.workingMemory?.lastMessageDraft
    || runtime.workingMemory?.lastPreparedMessage
    || null;
  if (!raw) return null;
  if (typeof raw === 'string') return raw.trim() || null;
  const body = String(raw.body || raw.text || '').trim();
  return body || null;
}

function okDirect(message, extra = {}) {
  return {
    ok: true,
    confirmationRequired: false,
    message: String(message || 'Erledigt.').slice(0, 1200),
    ...extra,
  };
}

// ─── Customer ───────────────────────────────────────────────

export const findCustomerToolDef = {
  name: 'find_customer',
  kind: 'read',
  description: 'Findet Kunden anhand Name/Hinweis im Lead-Snapshot (kein Öffnen).',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      query: { type: 'string', description: 'Name oder Suchbegriff, z. B. Brandes' },
    },
    required: ['query'],
  },
};

export function executeFindCustomer(runtime = {}, args = {}) {
  const query = readQuery(runtime, args, 'query');
  // Bare Nachname → „finde X“, damit extractCustomerNameQuery greift
  const sellerInput = /^(finde|öffne|suche|zeige)\b/i.test(query)
    ? query
    : `finde ${query}`;
  const wrapped = wrapSellerTool('find_customer', {
    ...buildSellerToolContext(runtime, { ...args, sellerInput }),
    sellerInput,
  }, {
    confirmationRequired: false,
    label: 'Kunden gefunden',
    mapResult: (result) => {
      const cards = result?.cards || result?.results || [];
      const names = cards.slice(0, 5).map((c) => (
        c.card?.customerName || c.card?.name || c.lead?.contact?.name || c.lead?.name || c.label || 'Kunde'
      ));
      return okDirect(
        names.length
          ? `Gefunden: ${names.join(' · ')}`
          : 'Keinen passenden Kunden gefunden.',
        {
          result,
          customerSearchResults: cards,
          resolvedCustomer: cards.length === 1 ? (cards[0]?.lead || null) : null,
          artifacts: [{ type: 'find_customer', label: 'Kundensuche', data: { names, count: cards.length } }],
          suggestedActions: cards.slice(0, 3).map((c) => {
            const leadId = c.leadId || c.customerId || c.lead?.id || null;
            const labelName = c.card?.customerName || c.card?.name || c.lead?.name || 'Kunde';
            return {
              action: 'open_customer',
              label: `Öffne ${labelName}`,
              leadId,
            };
          }),
        },
      );
    },
  });
  return wrapped;
}

export const openCustomerToolDef = {
  name: 'open_customer',
  kind: 'read',
  description: 'Löst Kundenkontext auf und schlägt Öffnen/Wechsel vor („Mach zuerst Brandes“).',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      query: { type: 'string' },
    },
    required: ['query'],
  },
};

export function executeOpenCustomer(runtime = {}, args = {}) {
  const query = readQuery(runtime, args, 'query');
  const sellerInput = /^(finde|öffne|suche|zeige)\b/i.test(query)
    ? query
    : `öffne ${query}`;
  return wrapSellerTool('open_customer', {
    ...buildSellerToolContext(runtime, args),
    sellerInput,
  }, {
    confirmationRequired: false,
    mapResult: (result) => {
      const cards = result?.cards || result?.results || [];
      const top = cards[0];
      const leadId = top?.leadId || top?.customerId || top?.lead?.id || top?.id || null;
      const name = top?.card?.customerName
        || top?.card?.name
        || top?.lead?.contact?.name
        || top?.lead?.name
        || query;
      const unique = cards.length === 1 && leadId;
      return okDirect(
        top
          ? (unique
            ? `Weiter mit ${name}.`
            : `Kunde „${name}“ bereit zum Öffnen.`)
          : `Kein Kunde für „${query}“ gefunden.`,
        {
          result,
          action: 'open_customer',
          resolvedCustomer: top?.lead || null,
          customerSearchResults: cards,
          artifacts: [{
            type: 'open_customer',
            label: name,
            data: { leadId, name },
          }],
          suggestedActions: top
            ? [{ action: 'open_customer', label: `${name} öffnen`, leadId }]
            : [],
        },
      );
    },
  });
}

export const updateCustomerFactsToolDef = {
  name: 'update_customer_facts',
  kind: 'write',
  description:
    'Schreibt sichere strukturierte Kundendaten (Budget, km, Kontakt, Farbe, …). '
    + 'Für freies „merk dir …“ eher remember_customer_information nutzen.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      facts: {
        type: 'array',
        description: 'Liste { field, value, label?, factClass? }',
        items: {
          type: 'object',
          additionalProperties: true,
          properties: {
            field: { type: 'string' },
            value: {},
            label: { type: 'string' },
            factClass: { type: 'string' },
            needsConfirmation: { type: 'boolean' },
          },
        },
      },
      note: { type: 'string', description: 'Fallback-Notiz wenn facts leer' },
    },
  },
};

export function executeUpdateCustomerFacts(runtime = {}, args = {}) {
  const lead = runtime.lead || {};
  let facts = Array.isArray(args.facts) ? args.facts : [];
  if (!facts.length && args.note) {
    facts = [createExtractedFact({
      factClass: SELLER_FACT_CLASS.SELLER_NOTE,
      field: 'sellerNote',
      value: String(args.note).slice(0, 240),
      label: String(args.note).slice(0, 80),
      preserveAsNote: true,
    })];
  }
  if (!facts.length) {
    return { ok: false, error: 'missing_facts', message: 'Welche Kundendaten soll ich übernehmen?' };
  }

  const normalized = facts.map((f) => createExtractedFact({
    factClass: f.factClass || SELLER_FACT_CLASS.CUSTOMER_FACT,
    field: f.field,
    value: f.value,
    label: f.label,
    needsConfirmation: Boolean(f.needsConfirmation),
    confidence: f.confidence ?? 0.9,
  })).filter((f) => f.label);

  const nextLead = applyStructuredFactsToLead(lead, normalized);
  const labels = normalized.map((f) => f.label).filter(Boolean);
  return {
    ok: true,
    confirmationRequired: false,
    message: labels.length ? `Übernommen: ${labels.join(' · ')}` : 'Kundendaten aktualisiert.',
    mutations: [{
      type: 'apply_lead_patch',
      leadPatch: nextLead,
    }],
    artifacts: [{ type: 'update_customer_facts', label: 'Kundendaten', data: { labels } }],
  };
}

// ─── Knowledge ──────────────────────────────────────────────

export const lookupVehicleFactToolDef = {
  name: 'lookup_vehicle_fact',
  kind: 'read',
  description: 'Technische Fahrzeugfrage (Reichweite, AHK, WLTP, …).',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      sellerInput: { type: 'string' },
      modelKey: { type: ['string', 'null'] },
      factKey: { type: ['string', 'null'] },
    },
  },
};

export function executeLookupVehicleFact(runtime = {}, args = {}) {
  const sellerInput = readQuery(runtime, args, 'sellerInput', 'query');
  const result = answerSellerVehicleKnowledge({
    sellerInput,
    modelKey: args.modelKey || null,
    factKey: args.factKey || null,
  });
  if (!result?.ok && !result?.message && !result?.displayValue) {
    return { ok: false, message: 'Dazu habe ich keine verifizierte Antwort.', result };
  }
  const text = result.message || result.body || result.displayValue
    || [result.factLabel, result.displayValue].filter(Boolean).join(': ');
  return okDirect(text || 'Keine Treffer.', {
    knowledgeResult: result,
    result,
    artifacts: [{ type: 'lookup_vehicle_fact', label: result.factLabel || 'Fahrzeugfakt', data: {
      modelKey: result.modelKey,
      displayValue: result.displayValue,
    } }],
  });
}

export const lookupPackageToolDef = {
  name: 'lookup_package',
  kind: 'read',
  description: 'Inhalt eines Ausstattungspakets (z. B. Technology-Paket).',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      modelKey: { type: 'string' },
      packageName: { type: 'string' },
      trim: { type: ['string', 'null'] },
    },
    required: ['modelKey', 'packageName'],
  },
};

export function executeLookupPackage(runtime = {}, args = {}) {
  const result = lookupPackageContents({
    modelKey: args.modelKey,
    packageName: args.packageName,
    trim: args.trim || null,
  });
  if (!result) {
    return { ok: false, message: 'Paket nicht gefunden.' };
  }
  const items = result.items || result.contents || result.equipment || [];
  const list = Array.isArray(items)
    ? items.map((i) => (typeof i === 'string' ? i : i.label || i.name)).filter(Boolean).slice(0, 12)
    : [];
  return okDirect(
    result.message || result.summary || (list.length ? list.join(' · ') : 'Paketinhalt geladen.'),
    {
      result,
      artifacts: [{ type: 'lookup_package', label: args.packageName, data: { list } }],
    },
  );
}

export const lookupEquipmentToolDef = {
  name: 'lookup_equipment',
  kind: 'read',
  description: 'Relevante Ausstattung zu Modell/Trim.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      modelKey: { type: 'string' },
      trim: { type: ['string', 'null'] },
    },
    required: ['modelKey'],
  },
};

export function executeLookupEquipment(_runtime = {}, args = {}) {
  const result = lookupRelevantEquipment({
    modelKey: args.modelKey,
    trim: args.trim || null,
  });
  if (!result) return { ok: false, message: 'Keine Ausstattung gefunden.' };
  const list = (result.items || result.equipment || [])
    .map((i) => (typeof i === 'string' ? i : i.label || i.name))
    .filter(Boolean)
    .slice(0, 14);
  return okDirect(result.message || list.join(' · ') || 'Ausstattung geladen.', {
    result,
    artifacts: [{ type: 'lookup_equipment', label: 'Ausstattung', data: { list } }],
  });
}

export const compareVehiclesToolDef = {
  name: 'compare_vehicles',
  kind: 'read',
  description: 'Vergleicht Fahrzeuge (z. B. EV4 vs EV6 Reichweite) über Knowledge.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      sellerInput: { type: 'string', description: 'Vergleichsfrage' },
      modelA: { type: ['string', 'null'] },
      modelB: { type: ['string', 'null'] },
    },
    required: ['sellerInput'],
  },
};

export function executeCompareVehicles(runtime = {}, args = {}) {
  let sellerInput = readQuery(runtime, args, 'sellerInput');
  if (args.modelA && args.modelB && !/vs|oder|gegenüber/i.test(sellerInput)) {
    sellerInput = `${args.modelA} vs ${args.modelB} ${sellerInput}`.trim();
  }
  return executeLookupVehicleFact(runtime, { sellerInput });
}

// ─── Offer ──────────────────────────────────────────────────

export const modifyOfferToolDef = {
  name: 'modify_offer',
  kind: 'write',
  description:
    'Passt das aktuelle/letzte Angebot an (km, Farbe, Rate, …). '
    + 'Immer Confirmation – keine Blind-Persistenz. Nutzt baseOnCurrentOffer.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      instruction: { type: 'string' },
      mileagePerYear: { type: ['number', 'null'] },
      color: { type: ['string', 'null'] },
      durationMonths: { type: ['number', 'null'] },
      monthlyRate: { type: ['number', 'null'] },
      downPayment: { type: ['number', 'null'] },
    },
    required: ['instruction'],
  },
};

export function executeModifyOffer(runtime = {}, args = {}) {
  return executePrepareOffer(runtime, {
    ...args,
    instruction: args.instruction || runtime.sellerMessage,
    baseOnCurrentOffer: true,
  });
}

export const importOfferPdfToolDef = {
  name: 'import_offer_pdf',
  kind: 'write',
  description:
    'Handoff: klassifiziert Angebots-/Konfigurator-PDF und bereitet Offer-Import vor. '
    + 'Benötigt Attachment im Runtime (Composer-Upload). Confirmation für Persist.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      fileName: { type: ['string', 'null'] },
      instruction: { type: ['string', 'null'] },
    },
  },
};

export function executeImportOfferPdf(runtime = {}, args = {}) {
  const attachments = runtime.attachments || [];
  const att = attachments[0] || null;
  const fileName = args.fileName || att?.fileName || att?.name || 'angebot.pdf';
  const text = att?.extractedText || att?.text || args.instruction || runtime.sellerMessage || '';
  const kind = classifyComposerPdfKind({ text, fileName });
  if (kind === 'contract_pdf') {
    return {
      ok: true,
      confirmationRequired: true,
      message: 'Das sieht nach einem Altvertrag aus – bitte import_contract nutzen.',
      suggestedActions: [{ action: 'import_contract', label: 'Vertrag einlesen' }],
      pendingAction: {
        type: 'import_customer_contract',
        status: 'needs_confirmation',
        payload: { suggestedKind: kind, fileName },
      },
    };
  }
  const prepared = wrapSellerTool('prepare_offer', {
    ...buildSellerToolContext(runtime, args),
    sellerInput: args.instruction || runtime.sellerMessage || 'Angebot aus PDF',
    attachments,
  }, {
    confirmationRequired: true,
    pendingType: 'prepare_offer',
    label: 'PDF-Angebot',
    message: 'Angebot aus PDF vorbereitet – bitte prüfen.',
  });
  return {
    ...prepared,
    pdfKind: kind,
    handoff: 'prepare_offer',
  };
}

export const compareContractOfferToolDef = {
  name: 'compare_contract_offer',
  kind: 'read',
  description: 'Vergleicht Altvertrag mit aktuellem Angebot.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      sellerInput: { type: 'string' },
      customerName: { type: ['string', 'null'] },
    },
  },
};

export function executeCompareContractOffer(runtime = {}, args = {}) {
  return wrapSellerTool('compare_contract_with_offer', {
    ...buildSellerToolContext(runtime, args),
    sellerInput: readQuery(runtime, args, 'sellerInput'),
  }, {
    confirmationRequired: false,
    mapResult: (result) => okDirect(
      result?.contractOfferCompareResult?.body
      || result?.message
      || result?.body
      || 'Vergleich erstellt.',
      {
        result,
        contractOfferCompareResult: result?.contractOfferCompareResult || result,
        artifacts: [{
          type: 'compare_contract_offer',
          label: 'Vertrag ↔ Angebot',
          data: { status: result?.status },
        }],
      },
    ),
  });
}

// ─── Message ────────────────────────────────────────────────

export const rewriteMessageToolDef = {
  name: 'rewrite_message',
  kind: 'write',
  description:
    'Schreibt die letzte vorbereitete Kundennachricht um („kürzer“, „wärmer“). '
    + 'Kein Auto-Send. Nutzt Working Memory lastMessageDraft.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      instruction: {
        type: 'string',
        description: 'z. B. „kürzer und persönlicher“',
      },
    },
    required: ['instruction'],
  },
};

/** Deterministische Kürzung für Follow-up „kürzer“ (Rewrite-Chain ohne Live-LLM). */
export function shortenMessageDraftForRewrite(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const sentences = raw
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  let next = sentences.length > 2
    ? sentences.slice(0, 2).join(' ')
    : raw;
  next = next
    .replace(/\s+/g, ' ')
    .replace(/\b(sehr|wirklich|hiermit|gerne nochmals)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (next.length > 280) next = `${next.slice(0, 277).trim()}…`;
  if (next.length < 12 || next === raw) {
    const clipped = raw.slice(0, Math.min(220, Math.max(80, Math.floor(raw.length * 0.65)))).trim();
    next = clipped.endsWith('.') || clipped.endsWith('!') || clipped.endsWith('?')
      ? clipped
      : `${clipped}…`;
  }
  return next;
}

export function executeRewriteMessage(runtime = {}, args = {}) {
  const previous = readLastMessageDraft(runtime);
  const instruction = String(args.instruction || '').trim();
  if (!previous) {
    return {
      ok: false,
      message: 'Keine vorbereitete Nachricht zum Umschreiben – bitte zuerst einen Entwurf anlegen.',
    };
  }
  // „kürzer“ / knapp → deterministische Rewrite-Chain über Memory-Draft
  if (/kürzer|kuerzer|shorter|knapp|kürze/i.test(instruction || 'kürzer')) {
    const shortened = shortenMessageDraftForRewrite(previous);
    return {
      ok: true,
      status: 'prepared',
      confirmationRequired: false,
      intendSend: false,
      messageDraft: shortened,
      rewriteFrom: previous,
      mutations: [{ type: 'set_message_draft', messageDraft: shortened }],
      artifacts: [{
        type: 'message_draft',
        label: 'Nachricht kürzer',
        data: { body: shortened, previous },
      }],
      suggestedActions: [
        { action: 'edit_message', label: 'Bearbeiten' },
        { action: 'send_message', label: 'Senden' },
      ],
      message: 'Nachricht gekürzt – im Composer bereit.',
    };
  }
  const sellerInstruction = `Schreib die folgende Nachricht um (${instruction}):\n\n${previous}`;
  return executeCreateMessage(runtime, {
    instruction: sellerInstruction,
    intendSend: false,
  });
}

export const intendSendToolDef = {
  name: 'intend_send',
  kind: 'write',
  description:
    'Bereitet Senden vor: Draft aus Memory oder neuer Instruction. '
    + 'Immer Confirmation – kein Auto-Send.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      instruction: { type: ['string', 'null'] },
      channel: { type: ['string', 'null'] },
    },
  },
};

export function executeIntendSend(runtime = {}, args = {}) {
  const previous = readLastMessageDraft(runtime);
  const instruction = String(args.instruction || '').trim()
    || (previous ? 'Schick ihm die vorbereitete Nachricht.' : '');
  if (!instruction && !previous) {
    return { ok: false, message: 'Welche Nachricht soll gesendet werden?' };
  }
  if (previous && !args.instruction) {
    return {
      ok: true,
      status: 'prepared',
      confirmationRequired: true,
      intendSend: true,
      messageDraft: previous,
      mutations: [{ type: 'set_message_draft', messageDraft: previous }],
      pendingAction: {
        type: 'intend_send',
        status: 'needs_confirmation',
        intendSend: true,
        payload: { messageDraft: previous, channel: args.channel || 'message' },
      },
      artifacts: [{ type: 'message_draft', label: 'Senden bestätigen', data: { body: previous } }],
      suggestedActions: [
        { action: 'send_message', label: 'Jetzt senden' },
        { action: 'edit_message', label: 'Bearbeiten' },
      ],
      message: 'Nachricht bereit – Senden erst nach deiner Bestätigung.',
    };
  }
  return executeCreateMessage(runtime, {
    instruction,
    channel: args.channel || null,
    intendSend: true,
  });
}

// ─── Appointment ────────────────────────────────────────────

export const proposeAppointmentToolDef = {
  name: 'propose_appointment',
  kind: 'write',
  description: 'Bereitet Termin/Callback vor („Montag 15 Uhr“). Confirmation nötig.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      sellerInput: { type: 'string' },
    },
    required: ['sellerInput'],
  },
};

export function executeProposeAppointment(runtime = {}, args = {}) {
  const sellerInput = readQuery(runtime, args, 'sellerInput');
  const lead = runtime.lead || {};
  const assist = runSellerAppointmentAssist(lead, sellerInput, {
    previousAppointment: runtime.workingMemory?.lastAppointmentProposal || null,
  });
  if (!assist?.ok && !assist?.appointment) {
    const contextual = prepareContextualAppointmentProposal({
      lead,
      sellerInput,
      pendingAppointment: runtime.workingMemory?.lastAppointmentProposal || null,
    });
    if (contextual?.ok || contextual?.preparedAppointment || contextual?.messageDraft) {
      const appt = contextual.preparedAppointment || contextual.appointment || null;
      return {
        ok: true,
        confirmationRequired: true,
        status: 'prepared',
        preparedAppointment: appt,
        messageDraft: contextual.messageDraft || null,
        pendingAction: {
          type: 'propose_appointment',
          status: 'needs_confirmation',
          payload: { ...contextual, appointment: appt },
        },
        artifacts: [{ type: 'propose_appointment', label: 'Termin vorschlagen', data: {
          startAt: appt?.startAt || appt?.startsAt || null,
        } }],
        message: contextual.message
          || contextual.uiHint?.message
          || 'Terminvorschlag vorbereitet – bitte prüfen.',
      };
    }
    return {
      ok: false,
      message: 'Für den Termin brauche ich noch Tag/Uhrzeit oder Kundenzuordnung.',
    };
  }

  const appointment = assist.appointment || assist.results?.[0]?.appointment || null;
  const draft = assist.results?.[0]?.messageBody || assist.results?.[0]?.draft || null;
  return {
    ok: true,
    confirmationRequired: true,
    status: 'prepared',
    preparedAppointment: appointment,
    messageDraft: draft,
    pendingAction: {
      type: 'propose_appointment',
      status: 'needs_confirmation',
      payload: { appointment, assist },
    },
    artifacts: [{
      type: 'propose_appointment',
      label: appointment?.typeLabel || 'Termin',
      data: { startAt: appointment?.startAt || null },
    }],
    suggestedActions: [
      { action: 'confirm_appointment', label: 'Übernehmen' },
      { action: 'edit_appointment', label: 'Anpassen' },
    ],
    message: assist.results?.[0]?.headline
      || assist.results?.[0]?.body
      || 'Terminvorschlag vorbereitet – bitte prüfen.',
  };
}

export const modifyAppointmentToolDef = {
  name: 'modify_appointment',
  kind: 'write',
  description: 'Passt offenen Terminvorschlag an („lieber Dienstag 10 Uhr“).',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      sellerInput: { type: 'string' },
    },
    required: ['sellerInput'],
  },
};

export function executeModifyAppointment(runtime = {}, args = {}) {
  const sellerInput = readQuery(runtime, args, 'sellerInput');
  const previous = runtime.workingMemory?.lastAppointmentProposal
    || runtime.workingMemory?.pendingAction?.payload?.appointment
    || null;
  const assist = runSellerAppointmentAssist(runtime.lead || {}, sellerInput, {
    previousAppointment: previous,
  });
  if (assist?.ok || assist?.appointment) {
    return executeProposeAppointment(
      { ...runtime, workingMemory: { ...runtime.workingMemory, lastAppointmentProposal: previous } },
      { sellerInput },
    );
  }
  const contextual = prepareContextualAppointmentProposal({
    lead: runtime.lead || {},
    sellerInput,
    pendingAppointment: previous,
  });
  if (!contextual) {
    return { ok: false, message: 'Kein offener Termin zum Anpassen – bitte neu vorschlagen.' };
  }
  const appt = contextual.preparedAppointment || contextual.appointment || null;
  return {
    ok: true,
    confirmationRequired: true,
    status: 'prepared',
    preparedAppointment: appt,
    messageDraft: contextual.messageDraft || null,
    pendingAction: {
      type: 'modify_appointment',
      status: 'needs_confirmation',
      payload: { ...contextual, appointment: appt },
    },
    message: contextual.message || contextual.uiHint?.message || 'Termin angepasst – bitte prüfen.',
    artifacts: [{ type: 'modify_appointment', label: 'Termin anpassen', data: {
      startAt: appt?.startAt || appt?.startsAt || null,
    } }],
  };
}

export const checkAvailabilityToolDef = {
  name: 'check_availability',
  kind: 'read',
  description: 'Prüft Kalender-Verfügbarkeit für einen Slot (wenn Provider vorhanden).',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      startsAt: { type: 'string', description: 'ISO-Zeitpunkt' },
      durationMinutes: { type: ['number', 'null'] },
    },
    required: ['startsAt'],
  },
};

export function executeCheckAvailability(runtime = {}, args = {}) {
  const provider = runtime.calendarProvider || null;
  if (!provider || typeof provider.checkAvailability !== 'function') {
    const normalized = normalizeCalendarAvailabilityResult({
      status: 'unknown',
      source: 'not_configured',
    });
    return okDirect(
      'Kalender-Provider ist nicht angebunden – Verfügbarkeit konnte nicht geprüft werden.',
      {
        availability: { ...normalized, checked: false },
        artifacts: [{ type: 'check_availability', label: 'Verfügbarkeit', data: normalized }],
      },
    );
  }
  // Sync-Handoff: Agent-Loop ist sync; Caller kann async refresh nachziehen.
  return okDirect('Verfügbarkeit wird über den Kalender-Provider geprüft.', {
    availability: {
      checked: false,
      status: 'pending',
      source: provider.id || 'calendar_provider',
      startsAt: args.startsAt,
      durationMinutes: args.durationMinutes || 60,
      needsAsyncCheck: true,
    },
    suggestedActions: [{ action: 'refresh_calendar_check', label: 'Verfügbarkeit aktualisieren' }],
  });
}

// ─── Document / Contract ────────────────────────────────────

export const classifyAttachmentToolDef = {
  name: 'classify_attachment',
  kind: 'read',
  description: 'Klassifiziert Anhang (Angebot/Konfigurator vs. Altvertrag).',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      fileName: { type: ['string', 'null'] },
      text: { type: ['string', 'null'] },
    },
  },
};

export function executeClassifyAttachment(runtime = {}, args = {}) {
  const att = (runtime.attachments || [])[0] || {};
  const fileName = args.fileName || att.fileName || att.name || '';
  const text = args.text || att.extractedText || att.text || runtime.sellerMessage || '';
  const kind = classifyComposerPdfKind({ text, fileName });
  const prepared = prepareComposerPdfTurnInput({
    extracted: { text, fileName },
    file: { name: fileName },
  });
  return okDirect(
    kind === 'contract_pdf'
      ? 'Anhang wirkt wie Altvertrag.'
      : 'Anhang wirkt wie Angebot/Konfigurator-PDF.',
    {
      kind,
      result: prepared,
      artifacts: [{ type: 'classify_attachment', label: kind, data: { kind, fileName } }],
      suggestedActions: kind === 'contract_pdf'
        ? [{ action: 'import_contract', label: 'Vertrag einlesen' }]
        : [{ action: 'import_offer_pdf', label: 'Als Angebot nutzen' }],
    },
  );
}

export const importContractToolDef = {
  name: 'import_contract',
  kind: 'write',
  description: 'Bereitet Altvertrags-Import vor. Confirmation nötig, keine Blind-Persistenz.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      sellerInput: { type: 'string' },
      customerName: { type: ['string', 'null'] },
    },
  },
};

export function executeImportContract(runtime = {}, args = {}) {
  return wrapSellerTool('import_customer_contract', {
    ...buildSellerToolContext(runtime, args),
    sellerInput: readQuery(runtime, args, 'sellerInput'),
  }, {
    confirmationRequired: true,
    pendingType: 'import_customer_contract',
    label: 'Vertrag importieren',
    mapResult: (result) => ({
      ok: Boolean(result?.ok !== false),
      confirmationRequired: true,
      status: result?.status || 'prepared',
      contractDraft: result?.contractDraft || null,
      pendingAction: {
        type: 'import_customer_contract',
        status: 'needs_confirmation',
        payload: result,
      },
      artifacts: [{
        type: 'import_contract',
        label: 'Altvertrag',
        data: { status: result?.status },
      }],
      message: result?.reviewBody
        || result?.message
        || 'Vertragsdaten vorbereitet – bitte prüfen.',
    }),
  });
}

// ─── Trade-in ───────────────────────────────────────────────

export const prepareTradeInToolDef = {
  name: 'prepare_trade_in',
  kind: 'write',
  description: 'Bereitet Inzahlungnahme vor („Smart fortwo kommt in Zahlung“). Confirmation.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      sellerInput: { type: 'string' },
    },
    required: ['sellerInput'],
  },
};

export function executePrepareTradeIn(runtime = {}, args = {}) {
  const sellerInput = readQuery(runtime, args, 'sellerInput');
  const candidates = extractTradeInCandidates(sellerInput);
  const cue = hasTradeInCue(sellerInput);
  if (!cue && !candidates.length) {
    return {
      ok: false,
      message: 'Kein Inzahlungnahme-Hinweis erkannt. Bitte Marke/Modell nennen.',
    };
  }
  const primary = candidates[0] || { make: null, model: null, label: 'Gebrauchtwagen', ambiguous: true };
  const facts = [
    createExtractedFact({
      factClass: SELLER_FACT_CLASS.TRADE_IN_FACT,
      field: 'tradeInRequested',
      value: true,
      label: 'Inzahlungnahme',
      confidence: 0.9,
    }),
  ];
  if (primary.make || primary.model) {
    facts.push(createExtractedFact({
      factClass: SELLER_FACT_CLASS.TRADE_IN_FACT,
      field: 'tradeInVehicle',
      value: { make: primary.make, model: primary.model },
      label: primary.label,
      confidence: primary.ambiguous ? 0.6 : 0.9,
      needsConfirmation: Boolean(primary.ambiguous),
    }));
  }
  return {
    ok: true,
    confirmationRequired: true,
    status: 'prepared',
    extractedFacts: facts,
    pendingAction: {
      type: 'prepare_trade_in',
      status: 'needs_confirmation',
      payload: { candidates, facts, sellerInput },
    },
    artifacts: [{
      type: 'prepare_trade_in',
      label: primary.label,
      data: { candidates: candidates.slice(0, 3) },
    }],
    suggestedActions: [
      { action: 'confirm_trade_in', label: 'Übernehmen' },
      { action: 'edit_trade_in', label: 'Anpassen' },
    ],
    message: primary.label
      ? `Inzahlungnahme vorbereitet: ${primary.label} – bitte prüfen.`
      : 'Inzahlungnahme erkannt – bitte Fahrzeugdetails prüfen.',
  };
}

// ─── Task / Today ───────────────────────────────────────────

export const getTodayOverviewToolDef = {
  name: 'get_today_overview',
  kind: 'read',
  description: 'Was liegt heute an? (Follow-ups, Reaktionen, offene Aktionen).',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {},
  },
};

export function executeGetTodayOverview(runtime = {}, args = {}) {
  return wrapSellerTool('get_today_overview', {
    leadsSnapshot: runtime.leadsSnapshot || [],
    now: args.now || undefined,
  }, {
    confirmationRequired: false,
    mapResult: (result) => {
      const items = result?.items || [];
      const summary = result?.summaryLine
        || (items.length
          ? `Heute ${items.length} Vorgang${items.length === 1 ? '' : 'e'}: ${
            items.slice(0, 3).map((i) => i.customerName || i.headline).filter(Boolean).join(' · ')
          }`
          : 'Heute liegen keine dringenden Vorgänge an.');
      return okDirect(summary, {
        todayOverview: result,
        result,
        artifacts: [{
          type: 'get_today_overview',
          label: 'Heute',
          data: { itemCount: result?.itemCount ?? items.length },
        }],
        suggestedActions: items.slice(0, 3).map((i) => ({
          action: i.composerAction || 'open_customer',
          label: i.primaryCtaLabel || i.customerName || 'Öffnen',
        })),
      });
    },
  });
}

export const createFollowUpToolDef = {
  name: 'create_follow_up',
  kind: 'write',
  description: 'Bereitet Wiedervorlage/Callback vor. Confirmation nötig.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      sellerInput: { type: 'string' },
      when: { type: ['string', 'null'], description: 'z. B. morgen 10 Uhr' },
    },
  },
};

export function executeCreateFollowUp(runtime = {}, args = {}) {
  const base = readQuery(runtime, args, 'sellerInput');
  const sellerInput = [
    'Wiedervorlage / Callback vorbereiten',
    args.when || '',
    base,
  ].filter(Boolean).join('. ');
  return executeProposeAppointment(runtime, { sellerInput });
}

// ─── Search ─────────────────────────────────────────────────

export const searchOffersToolDef = {
  name: 'search_offers',
  kind: 'read',
  description: 'Sucht in Angeboten (Kunde oder global über Snapshot).',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      query: { type: 'string' },
    },
    required: ['query'],
  },
};

export function executeSearchOffers(runtime = {}, args = {}) {
  const query = readQuery(runtime, args, 'query');
  const run = runTool('search_customer_offers', {
    lead: runtime.lead,
    sellerInput: query,
    leadsSnapshot: runtime.leadsSnapshot || [],
  });
  const result = run.result;
  const hits = result?.results || result?.hits || result?.items || [];
  return okDirect(
    hits.length
      ? `Angebote: ${hits.slice(0, 3).map((h) => h.headline || h.label || h.summary).filter(Boolean).join(' · ')}`
      : (result?.message || 'Keine Angebote gefunden.'),
    {
      result,
      historySearchResults: hits,
      artifacts: [{ type: 'search_offers', label: 'Angebotssuche', data: { count: hits.length } }],
    },
  );
}

export const searchContractsToolDef = {
  name: 'search_contracts',
  kind: 'read',
  description: 'Sucht / beantwortet Fragen zu Kundenverträgen.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      query: { type: 'string' },
      customerName: { type: ['string', 'null'] },
    },
    required: ['query'],
  },
};

export function executeSearchContracts(runtime = {}, args = {}) {
  return wrapSellerTool('search_customer_contracts', {
    ...buildSellerToolContext(runtime, args),
    sellerInput: readQuery(runtime, args, 'query', 'sellerInput'),
  }, {
    confirmationRequired: false,
    mapResult: (result) => okDirect(
      result?.contractMemoryResult?.body
      || result?.message
      || result?.contractMemoryResult?.answerLabel
      || 'Vertragssuche abgeschlossen.',
      {
        result,
        contractMemoryResult: result?.contractMemoryResult || null,
        artifacts: [{
          type: 'search_contracts',
          label: 'Verträge',
          data: { status: result?.status },
        }],
      },
    ),
  });
}

export const searchDocumentsToolDef = {
  name: 'search_documents',
  kind: 'read',
  description: 'Sucht in Akte/Dokumenten/Aktivitäten.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      query: { type: 'string' },
    },
    required: ['query'],
  },
};

export function executeSearchDocuments(runtime = {}, args = {}) {
  const query = readQuery(runtime, args, 'query');
  if (Array.isArray(runtime.leadsSnapshot) && runtime.leadsSnapshot.length) {
    const result = searchGlobalCustomerHistory({
      lead: runtime.lead?.id ? runtime.lead : null,
      sellerInput: query,
      leadsSnapshot: runtime.leadsSnapshot,
      mode: 'activities',
    });
    const hits = result?.results || result?.hits || [];
    return okDirect(
      hits.length
        ? `Dokumente/Aktivitäten: ${hits.slice(0, 3).map((h) => h.headline || h.label).filter(Boolean).join(' · ')}`
        : (result?.message || 'Keine Treffer.'),
      { result, historySearchResults: hits },
    );
  }
  const result = runComposerAkteSearch(runtime.lead || {}, query, {});
  return okDirect(result?.message || result?.summary || 'Suche abgeschlossen.', {
    result,
    historySearchResults: result?.results || [],
  });
}

/** Alle Sprint-2 Coverage-Tools für die Registry */
export const SELLER_COVERAGE_AGENT_TOOLS = {
  find_customer: { def: findCustomerToolDef, execute: executeFindCustomer, kind: 'read' },
  open_customer: { def: openCustomerToolDef, execute: executeOpenCustomer, kind: 'read' },
  update_customer_facts: { def: updateCustomerFactsToolDef, execute: executeUpdateCustomerFacts, kind: 'write' },
  lookup_vehicle_fact: { def: lookupVehicleFactToolDef, execute: executeLookupVehicleFact, kind: 'read' },
  lookup_package: { def: lookupPackageToolDef, execute: executeLookupPackage, kind: 'read' },
  lookup_equipment: { def: lookupEquipmentToolDef, execute: executeLookupEquipment, kind: 'read' },
  compare_vehicles: { def: compareVehiclesToolDef, execute: executeCompareVehicles, kind: 'read' },
  modify_offer: { def: modifyOfferToolDef, execute: executeModifyOffer, kind: 'write' },
  import_offer_pdf: { def: importOfferPdfToolDef, execute: executeImportOfferPdf, kind: 'write' },
  compare_contract_offer: { def: compareContractOfferToolDef, execute: executeCompareContractOffer, kind: 'read' },
  rewrite_message: { def: rewriteMessageToolDef, execute: executeRewriteMessage, kind: 'write' },
  intend_send: { def: intendSendToolDef, execute: executeIntendSend, kind: 'write' },
  propose_appointment: { def: proposeAppointmentToolDef, execute: executeProposeAppointment, kind: 'write' },
  modify_appointment: { def: modifyAppointmentToolDef, execute: executeModifyAppointment, kind: 'write' },
  check_availability: { def: checkAvailabilityToolDef, execute: executeCheckAvailability, kind: 'read' },
  classify_attachment: { def: classifyAttachmentToolDef, execute: executeClassifyAttachment, kind: 'read' },
  import_contract: { def: importContractToolDef, execute: executeImportContract, kind: 'write' },
  prepare_trade_in: { def: prepareTradeInToolDef, execute: executePrepareTradeIn, kind: 'write' },
  get_today_overview: { def: getTodayOverviewToolDef, execute: executeGetTodayOverview, kind: 'read' },
  create_follow_up: { def: createFollowUpToolDef, execute: executeCreateFollowUp, kind: 'write' },
  search_offers: { def: searchOffersToolDef, execute: executeSearchOffers, kind: 'read' },
  search_contracts: { def: searchContractsToolDef, execute: executeSearchContracts, kind: 'read' },
  search_documents: { def: searchDocumentsToolDef, execute: executeSearchDocuments, kind: 'read' },
};
