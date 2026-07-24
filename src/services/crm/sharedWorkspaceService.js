/**
 * Shared Customer Workspace – chronologischer Chat als Vorgang.
 * Nutzt bestehende Messages / Unterlagen / Portfolio / Selbstauskunft (keine zweite Wahrheit).
 */
import {
  computeUnterlagenSummary,
  createUnterlagenUploadLink,
  UNTERLAGEN_STATUS,
} from '../cleverUnterlagen.js';
import {
  MESSAGE_DIRECTION,
  MESSAGE_KIND,
  MESSAGE_STATUS,
  MESSAGE_CHANNEL,
  addCustomerMessage,
  buildCustomerPortalMessageThreads,
  findOrCreateThreadForLead,
  getCustomerMessageStore,
  sendCleverChannelMessage,
} from './customerMessageService.js';
import {
  SELF_DISCLOSURE_STATUS,
  buildSelfDisclosureCardModel,
} from './customerPortalSelfDisclosureService.js';

const DONE_STATUSES = new Set(['uploaded', 'checked', 'replaced', 'not_needed']);

const SLOT_ALIASES = [
  { id: 'gehaltsnachweis', patterns: [/gehaltsnachweis/i, /gehalt/i, /einkommensnachweis/i] },
  { id: 'bankverbindung', patterns: [/bankverbindung/i, /\bsepa\b/i, /konto/i] },
  { id: 'ausweis', patterns: [/ausweis/i, /personalausweis/i, /führerschein|fuehrerschein/i] },
  { id: 'selbstauskunft', patterns: [/selbstauskunft/i] },
];

/**
 * Offene Unterlagen-Slots (ohne erfundene Inventar-/CRM-Daten).
 */
export function listOpenDocumentSlots(lead = {}) {
  const paymentType = lead.paymentType ?? lead.wish?.paymentType ?? 'leasing';
  const summary = computeUnterlagenSummary(lead, paymentType);
  return summary.slots
    .filter((slot) => !DONE_STATUSES.has(summary.items[slot.id]?.status))
    .map((slot) => ({
      id: slot.id,
      label: slot.label,
      optional: Boolean(slot.optional),
      status: summary.items[slot.id]?.status ?? UNTERLAGEN_STATUS.open.id,
    }));
}

/**
 * Aus Verkäufer-Freitext die gemeinten offenen Slots ableiten.
 * Ohne Treffer → alle aktuell offenen (ohne optionale).
 */
export function resolveRequestedDocumentSlots(lead = {}, sellerInput = '') {
  const open = listOpenDocumentSlots(lead);
  const text = String(sellerInput ?? '');
  const matched = [];

  for (const alias of SLOT_ALIASES) {
    if (!alias.patterns.some((re) => re.test(text))) continue;
    const slot = open.find((entry) => entry.id === alias.id);
    if (slot) matched.push(slot);
  }

  if (matched.length) return matched;
  return open.filter((slot) => !slot.optional);
}

export function buildDocumentRequestMessageBody(lead = {}, slots = []) {
  const name = lead?.contact?.name || lead?.name || 'Hallo';
  const first = String(name).split(/\s+/)[0] || 'Hallo';
  const labels = slots.map((s) => s.label).filter(Boolean);
  if (!labels.length) {
    return `Hallo ${first},\n\nfür die weitere Bearbeitung fehlen mir noch Unterlagen. Sie können diese direkt hier hochladen bzw. ausfüllen.\n\nViele Grüße`;
  }
  if (labels.length === 1) {
    return `Hallo ${first},\n\nfür die weitere Bearbeitung fehlt mir nur noch: ${labels[0]}.\n\nSie können das direkt hier erledigen.\n\nViele Grüße`;
  }
  const last = labels[labels.length - 1];
  const head = labels.slice(0, -1).join(', ');
  return `Hallo ${first},\n\nfür die weitere Bearbeitung fehlen mir nur noch ${head} und ${last}.\n\nSie können beides direkt hier hochladen bzw. ausfüllen.\n\nViele Grüße`;
}

/**
 * Workspace-Paket vorbereiten (ohne Senden).
 */
export function prepareSellerWorkspacePackage(lead = {}, sellerInput = '') {
  const slots = resolveRequestedDocumentSlots(lead, sellerInput);
  const actions = slots.map((slot) => {
    if (slot.id === 'selbstauskunft') {
      return {
        id: `sa-${slot.id}`,
        kind: MESSAGE_KIND.SELF_DISCLOSURE_CARD,
        slotId: slot.id,
        label: slot.label || 'Selbstauskunft',
        selected: true,
      };
    }
    return {
      id: `doc-${slot.id}`,
      kind: MESSAGE_KIND.DOCUMENT_REQUEST,
      slotId: slot.id,
      label: slot.label,
      selected: true,
    };
  });

  return {
    body: buildDocumentRequestMessageBody(lead, slots),
    actions,
    slots,
  };
}

function ensureUploadLink(lead) {
  const paymentType = lead.paymentType ?? lead.wish?.paymentType ?? 'leasing';
  const summary = computeUnterlagenSummary(lead, paymentType);
  if (summary.data?.uploadLink?.url) {
    return { lead, uploadUrl: summary.data.uploadLink.url };
  }
  try {
    const withLink = createUnterlagenUploadLink(lead, paymentType);
    return {
      lead: {
        ...lead,
        crm: {
          ...(lead.crm ?? {}),
          cleverUnterlagen: withLink,
        },
      },
      uploadUrl: withLink?.uploadLink?.url ?? null,
    };
  } catch {
    return { lead, uploadUrl: null };
  }
}

/**
 * Verkäufer bestätigt Workspace-Paket → Text + Karten im gemeinsamen Thread.
 */
export function sendSellerWorkspacePackage({
  lead,
  body = '',
  actions = [],
  createdByName = 'Verkäufer',
  relatedOfferId = null,
} = {}) {
  if (!lead?.id) return { ok: false, error: 'no_lead', lead };

  let working = lead;
  const ensured = ensureUploadLink(working);
  working = ensured.lead;
  const uploadUrl = ensured.uploadUrl;

  const textResult = sendCleverChannelMessage({
    lead: working,
    text: body,
    relatedOfferId,
    createdByName,
    kind: MESSAGE_KIND.TEXT,
    senderRole: 'seller',
    bypassSanitize: true,
  });
  if (!textResult.message) {
    return { ok: false, error: textResult.error || 'message_failed', lead: textResult.lead };
  }
  working = textResult.lead;
  const threadId = textResult.message.threadId;
  const messages = [textResult.message];

  const selected = (actions ?? []).filter((action) => action.selected !== false);
  for (const action of selected) {
    if (action.kind === MESSAGE_KIND.SELF_DISCLOSURE_CARD || action.slotId === 'selbstauskunft') {
      const added = addCustomerMessage({
        lead: working,
        threadId,
        direction: MESSAGE_DIRECTION.OUTBOUND,
        channel: MESSAGE_CHANNEL.CLEVER,
        status: MESSAGE_STATUS.SENT,
        text: 'Selbstauskunft',
        visibleToCustomer: true,
        createdByName,
        kind: MESSAGE_KIND.SELF_DISCLOSURE_CARD,
        senderRole: 'seller',
        payload: {
          title: 'Selbstauskunft',
          subtitle: 'Dauert ca. 3 Minuten',
          ctaLabel: 'Jetzt ausfüllen',
          slotId: 'selbstauskunft',
        },
      });
      working = added.lead;
      if (added.message) messages.push(added.message);
      continue;
    }

    if (action.kind === MESSAGE_KIND.DOCUMENT_REQUEST || action.slotId) {
      const added = addCustomerMessage({
        lead: working,
        threadId,
        direction: MESSAGE_DIRECTION.OUTBOUND,
        channel: MESSAGE_CHANNEL.CLEVER,
        status: MESSAGE_STATUS.SENT,
        text: action.label || 'Unterlage hochladen',
        relatedDocumentIds: action.slotId ? [action.slotId] : [],
        visibleToCustomer: true,
        createdByName,
        kind: MESSAGE_KIND.DOCUMENT_REQUEST,
        senderRole: 'seller',
        payload: {
          title: action.label || 'Unterlage',
          slotId: action.slotId,
          ctaLabel: 'Hochladen',
          uploadUrl,
          statusLabel: 'Offen',
        },
      });
      working = added.lead;
      if (added.message) messages.push(added.message);
    }
  }

  return {
    ok: true,
    lead: working,
    messages,
    threadId,
    uploadUrl,
  };
}

/**
 * Angebotskarten nach Textnachricht in denselben Thread legen.
 */
export function appendOfferCardsToThread({
  lead,
  threadId = null,
  items = [],
  introText = '',
  createdByName = 'Verkäufer',
} = {}) {
  if (!lead?.id || !items.length) return { ok: false, lead, messages: [] };

  let working = lead;
  let tid = threadId;
  const messages = [];

  if (introText) {
    const sent = sendCleverChannelMessage({
      lead: working,
      text: introText,
      threadId: tid,
      createdByName,
    });
    if (!sent.message) return { ok: false, lead: sent.lead, error: sent.error, messages: [] };
    working = sent.lead;
    tid = sent.message.threadId;
    messages.push(sent.message);
  } else if (!tid) {
    const created = findOrCreateThreadForLead(working, {});
    working = created.lead;
    tid = created.thread?.id;
  }

  for (const item of items) {
    const added = addCustomerMessage({
      lead: working,
      threadId: tid,
      direction: MESSAGE_DIRECTION.OUTBOUND,
      channel: MESSAGE_CHANNEL.CLEVER,
      status: MESSAGE_STATUS.SENT,
      text: item.title || item.modelLabel || 'Angebot',
      relatedOfferId: item.vehicleCardId || item.id,
      visibleToCustomer: true,
      createdByName,
      kind: MESSAGE_KIND.OFFER_CARD,
      senderRole: 'seller',
      payload: {
        title: item.trimLabel
          ? `${item.modelLabel} · ${item.trimLabel}`
          : (item.modelLabel || item.title),
        subtitle: item.conditionsLine || null,
        rateLine: item.rateLine || item.displayFormatted || item.priceLine || null,
        colorLabel: item.colorLabel || null,
        heroImage: item.heroImage || null,
        offerUnitId: item.id,
        ctaLabel: 'Angebot ansehen',
      },
    });
    working = added.lead;
    if (added.message) messages.push(added.message);
  }

  return { ok: true, lead: working, messages, threadId: tid };
}

/**
 * Nach Upload: Statuskarte im Chat (sichtbar für beide).
 */
export function postDocumentReceivedStatus({
  lead,
  slotId,
  label,
  fileName = null,
} = {}) {
  if (!lead?.id || !slotId) return { lead, message: null };

  const { lead: withThread, thread } = findOrCreateThreadForLead(lead, {});
  const added = addCustomerMessage({
    lead: withThread,
    threadId: thread?.id,
    direction: MESSAGE_DIRECTION.INBOUND,
    channel: MESSAGE_CHANNEL.CLEVER,
    status: MESSAGE_STATUS.RECEIVED,
    text: `${label || 'Dokument'} eingegangen`,
    relatedDocumentIds: [slotId],
    visibleToCustomer: true,
    createdByName: lead.contact?.name || 'Kunde',
    kind: MESSAGE_KIND.SYSTEM_STATUS,
    senderRole: 'customer',
    payload: {
      title: label || 'Dokument',
      fileName,
      statusLabel: 'Eingegangen',
      slotId,
      icon: slotId === 'ausweis' ? '🪪' : '📄',
    },
  });
  return added;
}

export function postSelfDisclosureStatusMessage({
  lead,
  status,
} = {}) {
  if (!lead?.id) return { lead, message: null };
  const done = status === SELF_DISCLOSURE_STATUS.SUBMITTED
    || status === SELF_DISCLOSURE_STATUS.REVIEWED;
  const title = done ? 'Selbstauskunft eingegangen' : 'Selbstauskunft in Bearbeitung';
  const { lead: withThread, thread } = findOrCreateThreadForLead(lead, {});
  return addCustomerMessage({
    lead: withThread,
    threadId: thread?.id,
    direction: MESSAGE_DIRECTION.INBOUND,
    channel: MESSAGE_CHANNEL.CLEVER,
    status: MESSAGE_STATUS.RECEIVED,
    text: title,
    visibleToCustomer: true,
    createdByName: 'Clever',
    kind: MESSAGE_KIND.SYSTEM_STATUS,
    senderRole: 'clever',
    payload: {
      title: done ? `✓ ${title}` : title,
      statusLabel: done ? 'Erledigt' : 'In Bearbeitung',
    },
  });
}

/**
 * Clever grounded Antwort als Chat-Nachricht (nur mit verifiedValue).
 */
export function postCleverVerifiedReply({
  lead,
  text,
  verifiedSourceLabel = 'Daten aus verifizierter Fahrzeugquelle',
  relatedOfferId = null,
} = {}) {
  const trimmed = String(text ?? '').trim();
  if (!lead?.id || !trimmed) return { lead, message: null };

  const { lead: withThread, thread } = findOrCreateThreadForLead(lead, { relatedOfferId });
  return addCustomerMessage({
    lead: withThread,
    threadId: thread?.id,
    direction: MESSAGE_DIRECTION.OUTBOUND,
    channel: MESSAGE_CHANNEL.CLEVER,
    status: MESSAGE_STATUS.SENT,
    text: trimmed,
    relatedOfferId,
    visibleToCustomer: true,
    createdByName: 'Clever',
    kind: MESSAGE_KIND.CLEVER_MESSAGE,
    senderRole: 'clever',
    payload: {
      title: '✨ Clever',
      sourceLabel: verifiedSourceLabel,
    },
  });
}

/**
 * Chronologischer Feed für Kunde und Verkäufer (gleiche Messages).
 */
export function buildSharedWorkspaceTimeline(lead = {}, options = {}) {
  const role = options.role === 'seller' ? 'seller' : 'customer';
  const portfolio = lead?.crm?.customerOfferPortfolio ?? null;
  const threads = buildCustomerPortalMessageThreads(lead, {
    portfolioItems: portfolio?.items ?? [],
  });

  const items = [];
  for (const thread of threads) {
    for (const message of thread.messages ?? []) {
      items.push({
        ...message,
        threadId: thread.id,
        threadTitle: thread.title,
      });
    }
  }

  items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const paymentType = lead.paymentType ?? lead.wish?.paymentType ?? 'leasing';
  const docs = computeUnterlagenSummary(lead, paymentType);
  const sd = buildSelfDisclosureCardModel(lead);
  const openSlots = listOpenDocumentSlots(lead);

  return {
    role,
    items,
    threads,
    header: role === 'seller'
      ? {
        title: lead.contact?.name || lead.name || 'Kunde',
        subtitle: buildSellerContextSubtitle(lead, portfolio),
      }
      : {
        title: options.dealerName || 'Ihr Autohaus',
        subtitle: options.advisorName
          ? `Ihr Ansprechpartner: ${options.advisorName}`
          : null,
      },
    progress: {
      documentsDone: docs.doneCount,
      documentsTotal: docs.totalCount,
      documentsLabel: `${docs.doneCount}/${docs.totalCount}`,
      offerCount: portfolio?.items?.length ?? 0,
      selfDisclosureOpen: sd.status === SELF_DISCLOSURE_STATUS.NOT_STARTED
        || sd.status === SELF_DISCLOSURE_STATUS.IN_PROGRESS
        || sd.status === SELF_DISCLOSURE_STATUS.NEEDS_CORRECTION,
      selfDisclosureStatus: sd.status,
      openSlots,
    },
    messageCount: getCustomerMessageStore(lead).messages.filter((m) => m.visibleToCustomer).length,
  };
}

function buildSellerContextSubtitle(lead, portfolio) {
  const models = [...new Set(
    (portfolio?.items ?? [])
      .map((item) => item.modelLabel)
      .filter(Boolean),
  )].slice(0, 2);
  const payment = lead.wish?.paymentType || lead.paymentType || '';
  const paymentLabel = payment === 'leasing'
    ? 'Leasing'
    : payment === 'financing'
      ? 'Finanzierung'
      : payment === 'cash'
        ? 'Kauf'
        : '';
  const parts = [];
  if (models.length) parts.push(models.join(' / '));
  if (paymentLabel) parts.push(paymentLabel);
  return parts.join(' · ') || null;
}
