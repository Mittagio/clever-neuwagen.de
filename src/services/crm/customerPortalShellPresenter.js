/**
 * Kundenportal – Shell-Modell für Navigation, Unterlagen und Ansprechpartner.
 */
import {
  computeUnterlagenSummary,
  UNTERLAGEN_STATUS,
} from '../cleverUnterlagen.js';
import { getCustomerMessageStore } from './customerMessageService.js';
import { buildCustomerPortalAdvisorModel } from './customerPortalAdvisorService.js';
import { buildSelfDisclosureCardModel } from './customerPortalSelfDisclosureService.js';

export const PORTAL_NAV_IDS = {
  OFFERS: 'offers',
  MESSAGES: 'messages',
  DOCUMENTS: 'documents',
  ADVISOR: 'advisor',
};

export const PORTAL_NAV_SECTIONS = [
  { id: PORTAL_NAV_IDS.OFFERS, label: 'Angebote' },
  { id: PORTAL_NAV_IDS.MESSAGES, label: 'Nachrichten', badgeKey: 'messageCount' },
  { id: PORTAL_NAV_IDS.DOCUMENTS, label: 'Unterlagen', badgeKey: 'documentsOpenCount' },
  { id: PORTAL_NAV_IDS.ADVISOR, label: 'Ansprechpartner' },
];

const DONE_DOCUMENT_STATUSES = new Set(['uploaded', 'checked', 'replaced', 'not_needed']);

function countVisibleMessages(lead = {}) {
  const store = getCustomerMessageStore(lead);
  return store.messages.filter((message) => message.visibleToCustomer).length;
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

  const openCount = slots.filter((slot) => !slot.done && !slot.optional).length;

  return {
    headline: summary.headline,
    doneCount: summary.doneCount,
    totalCount: summary.totalCount,
    openCount,
    hasUploadLink: Boolean(uploadUrl),
    uploadUrl,
    slots,
    selfDisclosure: buildSelfDisclosureCardModel(lead),
    subline: openCount > 0
      ? `${openCount} Unterlage${openCount === 1 ? '' : 'n'} noch offen`
      : 'Alle Unterlagen sind eingereicht oder nicht benötigt',
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
    documentsOpenCount: documents.openCount > 0 ? documents.openCount : null,
  };

  return {
    navSections: PORTAL_NAV_SECTIONS,
    defaultSection: PORTAL_NAV_IDS.OFFERS,
    badges,
    documents,
    advisor,
  };
}
