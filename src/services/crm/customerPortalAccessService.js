/**
 * Kundenportal-Zugang – Link, Code, Status (Stufe 2 Demo).
 * Speicher: lead.crm.customerPortalAccess
 */
import { generateOfferAccessToken } from '../../logic/offerAccessToken.js';

export const PORTAL_ACCESS_STATUS = {
  PREPARED: 'prepared',
  SENT: 'sent',
  OPENED: 'opened',
  CODE_VERIFIED: 'code_verified',
  VIEWED: 'viewed',
};

const HISTORY_KEYS = {
  PREPARED: 'prepared',
  SENT: 'sent',
  OPENED: 'opened',
  VERIFIED: 'verified',
  VIEWED: 'viewed',
};

function nowIso() {
  return new Date().toISOString();
}

function historyEntry(text, type = 'customer_activity') {
  return {
    id: `hist-portal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    at: nowIso(),
    type,
    text,
    customerFacing: true,
    meta: { portalAccess: true },
  };
}

/**
 * @param {object} lead
 */
export function getCustomerPortalAccess(lead = {}) {
  return lead?.crm?.customerPortalAccess ?? null;
}

/**
 * @param {object} lead
 * @param {object} access
 */
export function mergeCustomerPortalAccess(lead = {}, access = null) {
  return {
    ...lead,
    crm: {
      ...(lead.crm ?? {}),
      customerPortalAccess: access,
    },
  };
}

/**
 * @param {string} email
 */
export function maskPortalEmail(email = '') {
  const trimmed = String(email ?? '').trim();
  if (!trimmed.includes('@')) return '';
  const [local, domain] = trimmed.split('@');
  if (!local || !domain) return trimmed;
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

/**
 * Demo: 6-stelliger Zugangscode
 */
export function generatePortalAccessCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * @param {object} lead
 * @param {object} [options]
 */
export function prepareCustomerPortalAccess(lead = {}, {
  portfolioUrl = '',
  email = '',
  accessToken = null,
  codeRequired = true,
} = {}) {
  const normalizedEmail = String(email ?? lead.contact?.email ?? '').trim();
  if (!normalizedEmail) {
    return { ok: false, error: 'email_required' };
  }
  if (!portfolioUrl) {
    return { ok: false, error: 'portfolio_url_required' };
  }

  const existing = getCustomerPortalAccess(lead);
  const now = nowIso();
  const access = {
    portfolioUrl,
    email: normalizedEmail,
    accessToken: accessToken ?? existing?.accessToken ?? generateOfferAccessToken(),
    accessCode: existing?.accessCode ?? generatePortalAccessCode(),
    codeRequired: Boolean(codeRequired),
    lastCodeSentAt: existing?.lastCodeSentAt ?? null,
    verifiedAt: existing?.verifiedAt ?? null,
    status: PORTAL_ACCESS_STATUS.PREPARED,
    sentAt: existing?.sentAt ?? null,
    openedAt: existing?.openedAt ?? null,
    viewedAt: existing?.viewedAt ?? null,
    lastActivityAt: now,
    historyLogged: {
      ...(existing?.historyLogged ?? {}),
    },
  };

  let nextLead = mergeCustomerPortalAccess(lead, access);
  const result = appendPortalAccessHistory(nextLead, HISTORY_KEYS.PREPARED, 'Kundenlink vorbereitet');
  nextLead = result.lead;

  return {
    ok: true,
    lead: nextLead,
    access: getCustomerPortalAccess(nextLead),
    historyText: result.added ? 'Kundenlink vorbereitet' : null,
  };
}

/**
 * @param {object} lead
 * @param {object} [options]
 */
export function markCustomerPortalAccessSent(lead = {}, { via = 'copy' } = {}) {
  const access = getCustomerPortalAccess(lead);
  if (!access) return { lead, access: null, historyText: null };

  const now = nowIso();
  const nextAccess = {
    ...access,
    status: PORTAL_ACCESS_STATUS.SENT,
    sentAt: access.sentAt ?? now,
    lastCodeSentAt: now,
    lastActivityAt: now,
  };

  let nextLead = mergeCustomerPortalAccess(lead, nextAccess);
  const result = appendPortalAccessHistory(nextLead, HISTORY_KEYS.SENT, 'Kundenlink gesendet');
  nextLead = result.lead;

  return {
    lead: nextLead,
    access: getCustomerPortalAccess(nextLead),
    historyText: result.added ? 'Kundenlink gesendet' : null,
    via,
  };
}

/**
 * @param {object} lead
 */
export function recordCustomerPortalAccessOpened(lead = {}) {
  const access = getCustomerPortalAccess(lead);
  if (!access) return { lead, access: null, historyText: null, changed: false };

  const now = nowIso();
  const alreadyOpened = Boolean(access.openedAt);
  let nextStatus = access.status;
  if (access.status === PORTAL_ACCESS_STATUS.PREPARED || access.status === PORTAL_ACCESS_STATUS.SENT) {
    nextStatus = PORTAL_ACCESS_STATUS.OPENED;
  }

  const nextAccess = {
    ...access,
    status: nextStatus,
    openedAt: access.openedAt ?? now,
    lastActivityAt: now,
  };

  let nextLead = mergeCustomerPortalAccess(lead, nextAccess);
  let historyText = null;
  if (!alreadyOpened) {
    const result = appendPortalAccessHistory(nextLead, HISTORY_KEYS.OPENED, 'Kundenlink geöffnet');
    nextLead = result.lead;
    historyText = result.added ? 'Kundenlink geöffnet' : null;
  }

  return {
    lead: nextLead,
    access: getCustomerPortalAccess(nextLead),
    historyText,
    changed: !alreadyOpened,
  };
}

/**
 * @param {object} lead
 * @param {string} code
 */
export function verifyCustomerPortalAccessCode(lead = {}, code = '') {
  const access = getCustomerPortalAccess(lead);
  if (!access) return { ok: false, error: 'no_access' };

  const entered = String(code ?? '').trim();
  const expected = String(access.accessCode ?? '').trim();
  if (!entered || !expected || entered !== expected) {
    return { ok: false, error: 'invalid_code' };
  }

  const now = nowIso();
  const alreadyVerified = Boolean(access.verifiedAt);
  const nextAccess = {
    ...access,
    status: PORTAL_ACCESS_STATUS.CODE_VERIFIED,
    verifiedAt: access.verifiedAt ?? now,
    lastActivityAt: now,
  };

  let nextLead = mergeCustomerPortalAccess(lead, nextAccess);
  let historyText = null;
  if (!alreadyVerified) {
    const result = appendPortalAccessHistory(nextLead, HISTORY_KEYS.VERIFIED, 'Code bestätigt');
    nextLead = result.lead;
    historyText = result.added ? 'Code bestätigt' : null;
  }

  return {
    ok: true,
    lead: nextLead,
    access: getCustomerPortalAccess(nextLead),
    historyText,
  };
}

/**
 * @param {object} lead
 */
export function recordCustomerPortalAccessViewed(lead = {}) {
  const access = getCustomerPortalAccess(lead);
  if (!access) return { lead, access: null, historyText: null, changed: false };

  const now = nowIso();
  const alreadyViewed = Boolean(access.viewedAt);
  const nextAccess = {
    ...access,
    status: PORTAL_ACCESS_STATUS.VIEWED,
    viewedAt: access.viewedAt ?? now,
    lastActivityAt: now,
  };

  let nextLead = mergeCustomerPortalAccess(lead, nextAccess);
  let historyText = null;
  if (!alreadyViewed) {
    const result = appendPortalAccessHistory(
      nextLead,
      HISTORY_KEYS.VIEWED,
      'Kunde hat Fahrzeugauswahl angesehen',
    );
    nextLead = result.lead;
    historyText = result.added ? 'Kunde hat Fahrzeugauswahl angesehen' : null;
  }

  return {
    lead: nextLead,
    access: getCustomerPortalAccess(nextLead),
    historyText,
    changed: !alreadyViewed,
  };
}

/**
 * @param {object} lead
 * @param {string} key
 * @param {string} text
 */
export function appendPortalAccessHistory(lead = {}, key = '', text = '') {
  const access = getCustomerPortalAccess(lead);
  if (!access || !key || !text) {
    return { lead, added: false };
  }

  if (access.historyLogged?.[key]) {
    return { lead, added: false };
  }

  const nextAccess = {
    ...access,
    historyLogged: {
      ...(access.historyLogged ?? {}),
      [key]: true,
    },
    lastActivityAt: nowIso(),
  };

  const nextLead = {
    ...mergeCustomerPortalAccess(lead, nextAccess),
    history: [...(lead.history ?? []), historyEntry(text)],
  };

  return { lead: nextLead, added: true };
}

/**
 * @param {object} lead
 */
export function isCustomerPortalAccessVerified(lead = {}) {
  const access = getCustomerPortalAccess(lead);
  if (!access) return true;
  if (!access.codeRequired) return true;
  return Boolean(access.verifiedAt);
}

/**
 * @param {object} lead
 */
export function buildDealerPortalAccessSummary(lead = {}) {
  const access = getCustomerPortalAccess(lead);
  if (!access) return null;

  const labels = {
    [PORTAL_ACCESS_STATUS.PREPARED]: 'Vorbereitet',
    [PORTAL_ACCESS_STATUS.SENT]: 'Gesendet',
    [PORTAL_ACCESS_STATUS.OPENED]: 'Geöffnet',
    [PORTAL_ACCESS_STATUS.CODE_VERIFIED]: 'Code bestätigt',
    [PORTAL_ACCESS_STATUS.VIEWED]: 'Angesehen',
  };

  return {
    status: access.status,
    statusLabel: labels[access.status] ?? access.status,
    email: access.email,
    portfolioUrl: access.portfolioUrl,
    sentAt: access.sentAt,
    openedAt: access.openedAt,
    verifiedAt: access.verifiedAt,
    viewedAt: access.viewedAt,
    lastActivityAt: access.lastActivityAt,
    demoAccessCode: access.accessCode ?? null,
  };
}

/**
 * @param {object} lead
 * @param {object} [options]
 */
export function buildCustomerPortalAccessContext(lead = {}, { accessVerified = false } = {}) {
  const access = getCustomerPortalAccess(lead);
  if (!access) {
    return { codeRequired: false, verified: true };
  }

  const verified = accessVerified || isCustomerPortalAccessVerified(lead);
  return {
    codeRequired: Boolean(access.codeRequired),
    verified,
    emailHint: maskPortalEmail(access.email),
    status: access.status,
  };
}

/**
 * @param {object} params
 */
export function buildPortalShareEmailBody({
  customerName = '',
  portfolioUrl = '',
  itemCount = 0,
  summaryLines = [],
} = {}) {
  const first = String(customerName).split(/\s+/)[0] || 'Hallo';
  const countLabel = itemCount === 1 ? 'Ihre Fahrzeugauswahl' : `Ihre ${itemCount} Fahrzeugvorschläge`;
  const linesBlock = summaryLines.length ? `\n\n${summaryLines.join('\n')}\n` : '\n';
  return [
    `Guten Tag ${first},`,
    '',
    `hier ist ${countLabel} zum Ansehen und Vergleichen:${linesBlock}`,
    'Öffnen Sie den Link und bestätigen Sie den Zugang mit dem Code aus dieser E-Mail:',
    portfolioUrl,
    '',
    'Bei Fragen antworten Sie einfach direkt im Portal.',
    '',
    'Freundliche Grüße',
    'Ihr Autohaus-Team',
  ].join('\n');
}

export function formatPortalAccessStatusLabel(status = '') {
  const labels = {
    prepared: 'Vorbereitet',
    sent: 'Gesendet',
    opened: 'Geöffnet',
    code_verified: 'Code bestätigt',
    viewed: 'Angesehen',
  };
  return labels[status] ?? status;
}

export const PORTAL_STATUS_STEPS = [
  { id: PORTAL_ACCESS_STATUS.PREPARED, label: 'Vorbereitet' },
  { id: PORTAL_ACCESS_STATUS.SENT, label: 'Gesendet' },
  { id: PORTAL_ACCESS_STATUS.OPENED, label: 'Geöffnet' },
  { id: PORTAL_ACCESS_STATUS.CODE_VERIFIED, label: 'Code bestätigt' },
  { id: PORTAL_ACCESS_STATUS.VIEWED, label: 'Angesehen' },
];

const PORTAL_STATUS_ORDER = [
  PORTAL_ACCESS_STATUS.PREPARED,
  PORTAL_ACCESS_STATUS.SENT,
  PORTAL_ACCESS_STATUS.OPENED,
  PORTAL_ACCESS_STATUS.CODE_VERIFIED,
  PORTAL_ACCESS_STATUS.VIEWED,
];

const PORTAL_STATUS_SUBLINES = {
  [PORTAL_ACCESS_STATUS.PREPARED]: 'Kundenlink vorbereitet',
  [PORTAL_ACCESS_STATUS.SENT]: 'Kundenlink gesendet',
  [PORTAL_ACCESS_STATUS.OPENED]: 'Kunde hat den Link geöffnet',
  [PORTAL_ACCESS_STATUS.CODE_VERIFIED]: 'Zugang bestätigt',
  [PORTAL_ACCESS_STATUS.VIEWED]: 'Fahrzeugauswahl angesehen',
};

function isPortalStepReached(currentStatus = '', stepId = '') {
  const currentIdx = PORTAL_STATUS_ORDER.indexOf(currentStatus);
  const stepIdx = PORTAL_STATUS_ORDER.indexOf(stepId);
  if (currentIdx === -1 || stepIdx === -1) return false;
  return currentIdx >= stepIdx;
}

/**
 * @param {string} [iso]
 */
export function formatPortalLastActivity(iso = '') {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) return `heute ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `gestern ${time}`;
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * @param {object} lead
 * @param {object} [options]
 */
export function buildCustomerPortalStatusCardModel(lead = {}, options = {}) {
  const access = getCustomerPortalAccess(lead);
  const hasOpenInboxMessage = Boolean(options.hasOpenInboxMessage);

  if (!access) {
    return {
      visible: false,
      empty: true,
      title: 'Kundenportal',
      subline: 'Noch kein Kundenlink gesendet',
      steps: [],
      actions: [],
      moreActions: [],
      portfolioUrl: null,
    };
  }

  const status = access.status ?? PORTAL_ACCESS_STATUS.PREPARED;
  const steps = PORTAL_STATUS_STEPS.map((step) => ({
    ...step,
    reached: isPortalStepReached(status, step.id),
  }));

  const actions = [];
  const moreActions = [];

  if (hasOpenInboxMessage) {
    actions.push({ id: 'reply', label: 'Antworten' });
    moreActions.push({ id: 'inbox', label: 'Im Eingang öffnen' });
  } else if (status === PORTAL_ACCESS_STATUS.VIEWED) {
    actions.push({ id: 'message', label: 'Nachricht schreiben' });
    actions.push({ id: 'followup', label: 'Nachfassen vorbereiten' });
  } else if (
    status === PORTAL_ACCESS_STATUS.PREPARED
    || status === PORTAL_ACCESS_STATUS.SENT
  ) {
    actions.push({ id: 'copy', label: 'Link kopieren' });
    actions.push({ id: 'email', label: 'E-Mail-Text vorbereiten' });
  } else {
    actions.push({ id: 'copy', label: 'Link kopieren' });
    moreActions.push({ id: 'email', label: 'E-Mail-Text vorbereiten' });
  }

  return {
    visible: true,
    empty: false,
    title: 'Kundenportal',
    subline: PORTAL_STATUS_SUBLINES[status] ?? PORTAL_STATUS_SUBLINES[PORTAL_ACCESS_STATUS.PREPARED],
    steps,
    lastActivityLabel: formatPortalLastActivity(access.lastActivityAt),
    portfolioUrl: access.portfolioUrl ?? null,
    email: access.email ?? null,
    actions: actions.slice(0, 2),
    moreActions,
  };
}
