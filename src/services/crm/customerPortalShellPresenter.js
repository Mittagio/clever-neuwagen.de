/**
 * Kundenportal – Shell-Modell für Navigation, Unterlagen und Ansprechpartner.
 */
import {
  computeUnterlagenSummary,
  UNTERLAGEN_STATUS,
} from '../cleverUnterlagen.js';
import { getCustomerMessageStore } from './customerMessageService.js';
import { buildCustomerPortalAdvisorModel } from './customerPortalAdvisorService.js';
import {
  buildSelfDisclosureCardModel,
  SELF_DISCLOSURE_STATUS,
  SELF_DISCLOSURE_TYPES,
} from './customerPortalSelfDisclosureService.js';

export const PORTAL_NAV_IDS = {
  OFFERS: 'offers',
  MESSAGES: 'messages',
  DOCUMENTS: 'documents',
  ADVISOR: 'advisor',
};

export const PORTAL_NAV_SECTIONS = [
  { id: PORTAL_NAV_IDS.OFFERS, label: 'Angebote' },
  { id: PORTAL_NAV_IDS.MESSAGES, label: 'Chat mit Clever', badgeKey: 'messageCount' },
  { id: PORTAL_NAV_IDS.DOCUMENTS, label: 'Unterlagen', badgeKey: 'documentsOpenCount' },
  { id: PORTAL_NAV_IDS.ADVISOR, label: 'Profil' },
];

const DONE_DOCUMENT_STATUSES = new Set(['uploaded', 'checked', 'replaced', 'not_needed']);
const UPLOADED_EVIDENCE_STATUSES = new Set(['uploaded', 'replaced']);
const DIGITAL_SLOT_IDS = new Set(['selbstauskunft']);

const RECOMMENDED_EVIDENCE_LABELS = {
  [SELF_DISCLOSURE_TYPES.PRIVATE]: [
    'Ausweis',
    'Gehaltsnachweis',
    'Bankverbindung / SEPA',
    'Meldebescheinigung',
  ],
  [SELF_DISCLOSURE_TYPES.FREELANCER]: [
    'Ausweis',
    'Gewerbeanmeldung',
    'Gewinnermittlung',
    'Kontoauszüge / Bankunterlagen',
    'Bankverbindung / SEPA',
  ],
  [SELF_DISCLOSURE_TYPES.CORPORATION]: [
    'Handelsregisterauszug',
    'Ausweis Ansprechpartner',
    'Bilanz / GuV / vorläufige Gewinnermittlung',
    'Bankverbindung / SEPA',
  ],
};

const DOCUMENTS_AREA_SUBLINE = 'Hier sehen Sie, was für Ihr Leasing- oder Finanzierungsangebot noch benötigt wird.';

function countVisibleMessages(lead = {}) {
  const store = getCustomerMessageStore(lead);
  return store.messages.filter((message) => message.visibleToCustomer).length;
}

function formatLastSavedLabel(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `heute ${time}`;
  return `${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} ${time}`;
}

function mapSelfDisclosureCardForDocumentsArea(card = {}) {
  let statusLabel = card.statusLabel ?? 'Noch nicht begonnen';
  switch (card.status) {
    case SELF_DISCLOSURE_STATUS.IN_PROGRESS:
      statusLabel = `In Bearbeitung · ${card.progress ?? 0} %`;
      break;
    case SELF_DISCLOSURE_STATUS.SUBMITTED:
      statusLabel = 'Eingereicht';
      break;
    case SELF_DISCLOSURE_STATUS.REVIEWED:
      statusLabel = 'Geprüft';
      break;
    case SELF_DISCLOSURE_STATUS.NEEDS_CORRECTION:
      statusLabel = 'Bitte Angaben prüfen';
      break;
    case SELF_DISCLOSURE_STATUS.NOT_STARTED:
      statusLabel = 'Noch nicht begonnen';
      break;
    default:
      break;
  }

  return {
    status: card.status,
    statusLabel,
    progress: card.progress ?? 0,
    typeLabel: card.typeLabel ?? null,
    actionLabel: card.actionLabel ?? 'Selbstauskunft starten',
    actionMode: card.actionMode ?? 'start',
    showTypePicker: Boolean(card.showTypePicker),
    lastSavedAt: card.lastSavedAt ?? null,
    lastSavedLabel: formatLastSavedLabel(card.lastSavedAt),
    href: null,
  };
}

function isSelfDisclosureOpenForCustomer(status = '') {
  return status === SELF_DISCLOSURE_STATUS.NOT_STARTED
    || status === SELF_DISCLOSURE_STATUS.IN_PROGRESS
    || status === SELF_DISCLOSURE_STATUS.NEEDS_CORRECTION;
}

function buildEvidenceItem(slot = {}) {
  let group = 'open';
  let icon = '○';
  let statusLabel = slot.statusLabel ?? 'Noch offen';

  if (slot.status === UNTERLAGEN_STATUS.checked.id) {
    group = 'checked';
    icon = '✓✓';
    statusLabel = `${slot.label} geprüft`;
  } else if (UPLOADED_EVIDENCE_STATUSES.has(slot.status)) {
    group = 'uploaded';
    icon = '✓';
    statusLabel = 'Hochgeladen';
  } else if (slot.status === UNTERLAGEN_STATUS.not_needed.id) {
    group = 'notNeeded';
    icon = '–';
    statusLabel = 'Nicht erforderlich';
  }

  return {
    id: slot.id,
    label: slot.label,
    status: slot.status,
    statusLabel,
    optional: Boolean(slot.optional),
    icon,
    group,
  };
}

function groupEvidenceItems(items = []) {
  const groups = {
    open: [],
    uploaded: [],
    checked: [],
    notNeeded: [],
  };

  for (const item of items) {
    groups[item.group]?.push(item);
  }

  return groups;
}

function buildSummaryLabel(selfDisclosureCard = {}, evidence = {}) {
  const sdOpen = isSelfDisclosureOpenForCustomer(selfDisclosureCard.status);
  const openCount = evidence.groups?.open?.length ?? 0;
  const uploadedCount = (evidence.groups?.uploaded?.length ?? 0)
    + (evidence.groups?.checked?.length ?? 0);
  const relevantTotal = openCount + uploadedCount;

  if (!sdOpen && openCount === 0) {
    return 'Alles erledigt';
  }

  if (selfDisclosureCard.status === SELF_DISCLOSURE_STATUS.IN_PROGRESS) {
    if (openCount > 0) {
      return `Selbstauskunft in Bearbeitung · ${openCount} Unterlage${openCount === 1 ? '' : 'n'} offen`;
    }
    return `Selbstauskunft in Bearbeitung · ${selfDisclosureCard.progress ?? 0} %`;
  }

  if (selfDisclosureCard.status === SELF_DISCLOSURE_STATUS.NOT_STARTED) {
    if (openCount > 0) {
      return `Selbstauskunft noch offen · ${openCount} Nachweis${openCount === 1 ? '' : 'e'} benötigt`;
    }
    return 'Selbstauskunft noch nicht begonnen';
  }

  if (selfDisclosureCard.status === SELF_DISCLOSURE_STATUS.NEEDS_CORRECTION) {
    return `Korrektur an Selbstauskunft nötig${openCount > 0 ? ` · ${openCount} Nachweis${openCount === 1 ? '' : 'e'} offen` : ''}`;
  }

  if (selfDisclosureCard.status === SELF_DISCLOSURE_STATUS.SUBMITTED
    || selfDisclosureCard.status === SELF_DISCLOSURE_STATUS.REVIEWED) {
    if (relevantTotal === 0) {
      return selfDisclosureCard.status === SELF_DISCLOSURE_STATUS.REVIEWED
        ? 'Selbstauskunft geprüft'
        : 'Selbstauskunft eingereicht';
    }
    if (openCount > 0) {
      return `Selbstauskunft eingereicht · ${openCount} Nachweis${openCount === 1 ? '' : 'e'} noch offen`;
    }
    return `Selbstauskunft eingereicht · ${uploadedCount} von ${relevantTotal} Nachweisen hochgeladen`;
  }

  if (openCount > 0) {
    return `${openCount} Unterlage${openCount === 1 ? '' : 'n'} noch offen`;
  }

  return 'Alle Unterlagen sind eingereicht oder nicht benötigt';
}

function countDocumentsBadge(selfDisclosureCard = {}, evidenceGroups = {}) {
  const sdCount = isSelfDisclosureOpenForCustomer(selfDisclosureCard.status) ? 1 : 0;
  const evidenceOpen = (evidenceGroups.open ?? []).filter((item) => !item.optional).length;
  const total = sdCount + evidenceOpen;
  return total > 0 ? total : null;
}

function resolveUploadAction({ uploadUrl, openCount, allDone }) {
  if (!uploadUrl) {
    return {
      visible: false,
      label: null,
      variant: null,
      hint: openCount > 0
        ? 'Das Autohaus stellt Ihnen den Upload-Link bereit.'
        : null,
    };
  }

  if (allDone) {
    return {
      visible: true,
      label: 'Weitere Unterlage hochladen',
      variant: 'secondary',
      hint: null,
      url: uploadUrl,
    };
  }

  return {
    visible: true,
    label: 'Nachweise hochladen',
    variant: 'primary',
    hint: null,
    url: uploadUrl,
  };
}

function hasApplicationDocumentsContext(lead = {}) {
  if (lead?.crm?.selfDisclosure) return true;
  const unterlagen = lead?.crm?.cleverUnterlagen;
  if (!unterlagen) return false;
  return Boolean(
    unterlagen.uploadLink?.url
    || (unterlagen.items && Object.keys(unterlagen.items).length > 0),
  );
}

function mapDealerSelfDisclosureStatusLabel(status = '', progress = 0) {
  switch (status) {
    case SELF_DISCLOSURE_STATUS.IN_PROGRESS:
      return `In Bearbeitung · ${progress ?? 0} %`;
    case SELF_DISCLOSURE_STATUS.SUBMITTED:
      return 'Eingereicht';
    case SELF_DISCLOSURE_STATUS.REVIEWED:
      return 'Geprüft';
    case SELF_DISCLOSURE_STATUS.NEEDS_CORRECTION:
      return 'Korrektur nötig';
    case SELF_DISCLOSURE_STATUS.NOT_STARTED:
    default:
      return 'Nicht begonnen';
  }
}

function buildDealerEvidenceSummaryLine(evidence = {}) {
  const parts = [];
  if (evidence.open > 0) {
    parts.push(`${evidence.open} offen`);
  }
  if (evidence.uploaded > 0) {
    parts.push(`${evidence.uploaded} hochgeladen`);
  }
  if (evidence.checked > 0) {
    parts.push(`${evidence.checked} geprüft`);
  }
  if (!parts.length) {
    return evidence.total > 0 ? 'Keine offenen Nachweise' : 'Noch keine Nachweise';
  }
  return parts.join(' · ');
}

function buildApplicationDocumentsActions({
  selfDisclosureStatus,
  evidence = {},
  hasUploadLink = false,
  allDone = false,
}) {
  const candidates = [];

  if (selfDisclosureStatus === SELF_DISCLOSURE_STATUS.SUBMITTED) {
    candidates.push({
      id: 'self_disclosure_review',
      label: 'Selbstauskunft prüfen',
      handlerType: 'self_disclosure_review',
    });
  } else if (selfDisclosureStatus === SELF_DISCLOSURE_STATUS.NEEDS_CORRECTION) {
    candidates.push({
      id: 'self_disclosure_review',
      label: 'Korrektur ansehen',
      handlerType: 'self_disclosure_review',
    });
  }

  if (evidence.open > 0 || allDone || evidence.total > 0) {
    candidates.push({
      id: 'open_unterlagen',
      label: 'Unterlagen ansehen',
      handlerType: 'unterlagen',
    });
  }

  const moreActions = [];
  if (!hasUploadLink && evidence.open > 0) {
    moreActions.push({
      id: 'create_upload_link',
      label: 'Upload-Link erstellen',
      handlerType: 'unterlagen',
    });
  }

  const deduped = [];
  const seen = new Set();
  for (const action of candidates) {
    if (seen.has(action.id)) continue;
    seen.add(action.id);
    deduped.push(action);
  }

  return {
    actions: deduped.slice(0, 2),
    moreActions: deduped.slice(2).concat(moreActions),
  };
}

/**
 * Kompakte Verkäufer-Übersicht – für Kundenakte / Unterlagen-Sheet (Stufe 2).
 * @param {object} lead
 */
export function buildDealerPortalDocumentsOverview(lead = {}) {
  const documents = buildCustomerPortalDocumentsModel(lead);
  const area = documents.documentsArea;
  return {
    selfDisclosure: {
      status: area.selfDisclosureCard.status,
      label: area.selfDisclosureCard.statusLabel,
      progress: area.selfDisclosureCard.progress,
    },
    evidence: {
      open: area.evidence.open,
      uploaded: area.evidence.uploaded,
      checked: area.evidence.checked,
      total: area.evidence.total,
    },
    summaryLabel: area.summaryLabel,
    allDone: area.allDone,
    hasUploadLink: area.evidence.hasUploadLink,
    lastActivityAt: area.selfDisclosureCard.lastSavedAt
      ?? lead?.crm?.cleverUnterlagen?.updatedAt
      ?? lead?.crm?.selfDisclosure?.submittedAt
      ?? null,
  };
}

/**
 * Kompakte Karte „Antrag & Unterlagen“ für die Verkäufer-Kundenakte.
 * Nutzt buildDealerPortalDocumentsOverview() – keine sensiblen Finanzwerte.
 * @param {object} lead
 */
export function buildCustomerAkteApplicationDocumentsCardModel(lead = {}) {
  if (!hasApplicationDocumentsContext(lead)) {
    return { visible: false };
  }

  const overview = buildDealerPortalDocumentsOverview(lead);
  const { actions, moreActions } = buildApplicationDocumentsActions({
    selfDisclosureStatus: overview.selfDisclosure.status,
    evidence: overview.evidence,
    hasUploadLink: overview.hasUploadLink,
    allDone: overview.allDone,
  });

  return {
    visible: true,
    title: 'Antrag & Unterlagen',
    subline: overview.summaryLabel,
    selfDisclosureLabel: mapDealerSelfDisclosureStatusLabel(
      overview.selfDisclosure.status,
      overview.selfDisclosure.progress,
    ),
    evidenceSummaryLine: buildDealerEvidenceSummaryLine(overview.evidence),
    lastActivityLabel: formatLastSavedLabel(overview.lastActivityAt),
    actions,
    moreActions,
  };
}

/**
 * @param {object} lead
 */
export function buildCustomerPortalDocumentsModel(lead = {}) {
  const paymentType = lead.paymentType ?? lead.wish?.paymentType ?? 'leasing';
  const summary = computeUnterlagenSummary(lead, paymentType);
  const uploadUrl = summary.data?.uploadLink?.url ?? null;

  const slots = summary.slots.map((slot) => {
    const statusId = summary.items[slot.id]?.status ?? UNTERLAGEN_STATUS.open.id;
    const statusMeta = UNTERLAGEN_STATUS[statusId] ?? UNTERLAGEN_STATUS.open;
    return {
      id: slot.id,
      label: slot.label,
      optional: Boolean(slot.optional),
      status: statusId,
      statusLabel: statusMeta.label,
      done: DONE_DOCUMENT_STATUSES.has(statusId),
    };
  });

  const evidenceSlots = slots.filter((slot) => !DIGITAL_SLOT_IDS.has(slot.id));
  const evidenceItems = evidenceSlots.map(buildEvidenceItem);
  const evidenceGroups = groupEvidenceItems(evidenceItems);

  const rawSelfDisclosure = buildSelfDisclosureCardModel(lead);
  const selfDisclosureCard = mapSelfDisclosureCardForDocumentsArea(rawSelfDisclosure);

  const sdType = rawSelfDisclosure.type ?? lead?.crm?.selfDisclosure?.type ?? null;
  const recommendedEvidence = sdType
    ? (RECOMMENDED_EVIDENCE_LABELS[sdType] ?? [])
    : RECOMMENDED_EVIDENCE_LABELS[SELF_DISCLOSURE_TYPES.PRIVATE];

  const openCount = evidenceGroups.open.length;
  const uploadedCount = evidenceGroups.uploaded.length;
  const checkedCount = evidenceGroups.checked.length;
  const allDone = !isSelfDisclosureOpenForCustomer(selfDisclosureCard.status) && openCount === 0;

  const evidence = {
    total: evidenceSlots.length,
    open: openCount,
    uploaded: uploadedCount,
    checked: checkedCount,
    uploadUrl,
    hasUploadLink: Boolean(uploadUrl),
    groups: evidenceGroups,
  };

  const summaryLabel = buildSummaryLabel(selfDisclosureCard, evidence);
  const uploadAction = resolveUploadAction({
    uploadUrl,
    openCount,
    allDone,
  });

  const documentsArea = {
    headline: 'Ihre Unterlagen',
    subline: DOCUMENTS_AREA_SUBLINE,
    summaryLabel,
    selfDisclosureCard,
    evidence,
    recommendedEvidence,
    uploadAction,
    allDone,
  };

  const badgeCount = countDocumentsBadge(selfDisclosureCard, evidenceGroups);

  return {
    headline: summary.headline,
    doneCount: summary.doneCount,
    totalCount: summary.totalCount,
    openCount: badgeCount ?? 0,
    badgeCount,
    hasUploadLink: Boolean(uploadUrl),
    uploadUrl,
    slots,
    selfDisclosure: rawSelfDisclosure,
    documentsArea,
    subline: summaryLabel,
  };
}

/**
 * @param {object} lead
 * @param {object} [options]
 */
export function buildCustomerPortalShellModel(lead = {}, options = {}) {
  const messageCount = options.messageCount ?? countVisibleMessages(lead);
  const documents = buildCustomerPortalDocumentsModel(lead);
  const advisor = buildCustomerPortalAdvisorModel(lead);

  const badges = {
    messageCount: messageCount > 0 ? messageCount : null,
    documentsOpenCount: documents.badgeCount,
  };

  return {
    navSections: PORTAL_NAV_SECTIONS,
    defaultSection: PORTAL_NAV_IDS.OFFERS,
    badges,
    documents,
    advisor,
  };
}
