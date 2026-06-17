/**
 * Clever Selbstauskunft – Online-Flow & Status
 */
import {
  createSelfDisclosureSession,
  getSelfDisclosureByToken,
  buildSelfDisclosureUrl,
} from '../logic/selfDisclosureService.js';
import { initCleverUnterlagenForLead, UNTERLAGEN_STATUS } from './cleverUnterlagen.js';

export const SELBSTAUSKUNFT_STATUS = {
  not_started: { id: 'not_started', label: 'Noch nicht gestartet', tone: 'open' },
  link_sent: { id: 'link_sent', label: 'Link gesendet', tone: 'progress' },
  opened: { id: 'opened', label: 'Link geöffnet', tone: 'progress' },
  in_progress: { id: 'in_progress', label: 'In Bearbeitung', tone: 'progress' },
  completed: { id: 'completed', label: 'Ausgefüllt', tone: 'uploaded' },
  checked: { id: 'checked', label: 'Geprüft', tone: 'checked' },
};

export const SELBSTAUSKUNFT_HISTORY = {
  link_created: 'Selbstauskunft-Link erstellt',
  link_sent_whatsapp: 'Selbstauskunft-Link per WhatsApp gesendet',
  link_sent_email: 'Selbstauskunft-Link per E-Mail gesendet',
  link_sent_copy: 'Selbstauskunft-Link kopiert',
  customer_opened: 'Kunde hat Selbstauskunft geöffnet',
  customer_started: 'Kunde hat Selbstauskunft begonnen',
  submitted: 'Selbstauskunft abgesendet',
  pdf_uploaded: 'Selbstauskunft als PDF hochgeladen',
  checked: 'Selbstauskunft geprüft',
};

const FINANCE_PAYMENT_TYPES = new Set(['leasing', 'financing', 'threeWayFinancing']);

export function needsSelbstauskunft(paymentType = '') {
  return FINANCE_PAYMENT_TYPES.has(paymentType);
}

export function getSelbstauskunft(unterlagen = {}) {
  return unterlagen?.selbstauskunft ?? { status: SELBSTAUSKUNFT_STATUS.not_started.id };
}

export function getSelbstauskunftStatusUi(statusId) {
  return SELBSTAUSKUNFT_STATUS[statusId] ?? SELBSTAUSKUNFT_STATUS.not_started;
}

export function formatSelbstauskunftSummary(selbstauskunft = {}, uploadCount = 0) {
  const statusUi = getSelbstauskunftStatusUi(selbstauskunft.status);
  if (selbstauskunft.status === SELBSTAUSKUNFT_STATUS.completed.id && uploadCount > 0) {
    return `${statusUi.label} · ${uploadCount} Unterlage${uploadCount > 1 ? 'n' : ''} hochgeladen`;
  }
  return statusUi.label;
}

export function createSelbstauskunftLink(unterlagen, lead = {}, context = {}) {
  const paymentType = context.paymentType ?? lead.paymentType ?? 'leasing';
  const session = createSelfDisclosureSession({
    leadId: lead.id,
    offerCode: lead.offerCode ?? lead.referenceCode ?? context.offerCode ?? '',
    customerName: lead.contact?.name ?? context.customerName ?? '',
    customerEmail: lead.contact?.email ?? context.email ?? '',
    paymentType,
    dealerName: context.dealerName ?? 'Autohaus Trinkle',
    vehicleTitle: context.vehicleTitle ?? '',
    vehicleConditions: context.vehicleConditions ?? '',
    isGewerbe: context.isGewerbe ?? false,
  });

  const url = buildSelfDisclosureUrl(session.token);
  const base = initCleverUnterlagenForLead(lead, paymentType);

  return {
    ...base,
    ...unterlagen,
    selbstauskunft: {
      ...(unterlagen.selbstauskunft ?? {}),
      status: SELBSTAUSKUNFT_STATUS.link_sent.id,
      link: {
        url,
        token: session.token,
        sessionId: session.id,
        createdAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };
}

export function applySelbstauskunftSessionToUnterlagen(unterlagen, session) {
  if (!session) return unterlagen;
  const uploadCount = Object.keys(session.uploads ?? {}).length;
  const nextStatus = session.status ?? unterlagen?.selbstauskunft?.status;

  const items = { ...(unterlagen?.items ?? {}) };
  if (nextStatus === SELBSTAUSKUNFT_STATUS.completed.id) {
    items.selbstauskunft = {
      ...(items.selbstauskunft ?? {}),
      status: UNTERLAGEN_STATUS.uploaded.id,
      source: 'online',
      submittedAt: session.submittedAt,
    };
  } else if (nextStatus === SELBSTAUSKUNFT_STATUS.checked.id) {
    items.selbstauskunft = {
      ...(items.selbstauskunft ?? {}),
      status: UNTERLAGEN_STATUS.checked.id,
      source: items.selbstauskunft?.source ?? 'online',
    };
  }

  return {
    ...unterlagen,
    selbstauskunft: {
      ...(unterlagen?.selbstauskunft ?? {}),
      status: nextStatus,
      formData: session.formData ?? unterlagen?.selbstauskunft?.formData,
      uploads: session.uploads ?? unterlagen?.selbstauskunft?.uploads,
      uploadCount,
      openedAt: session.openedAt ?? unterlagen?.selbstauskunft?.openedAt,
      startedAt: session.startedAt ?? unterlagen?.selbstauskunft?.startedAt,
      submittedAt: session.submittedAt ?? unterlagen?.selbstauskunft?.submittedAt,
      updatedAt: new Date().toISOString(),
    },
    items,
    updatedAt: new Date().toISOString(),
  };
}

export function syncSelbstauskunftFromToken(unterlagen, token) {
  const session = getSelfDisclosureByToken(token);
  return applySelbstauskunftSessionToUnterlagen(unterlagen, session);
}

export function markSelbstauskunftChecked(unterlagen) {
  return {
    ...unterlagen,
    selbstauskunft: {
      ...(unterlagen?.selbstauskunft ?? {}),
      status: SELBSTAUSKUNFT_STATUS.checked.id,
      updatedAt: new Date().toISOString(),
    },
    items: {
      ...(unterlagen?.items ?? {}),
      selbstauskunft: {
        ...(unterlagen?.items?.selbstauskunft ?? {}),
        status: UNTERLAGEN_STATUS.checked.id,
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

export function buildSelbstauskunftShareMessage({ customerName = '', url = '' } = {}) {
  const first = customerName.split(/\s+/)[0] || 'Hallo';
  return `Hallo ${first}, hier können Sie Ihre Selbstauskunft online ausfüllen und Unterlagen hochladen: ${url}`;
}

export function getCustomerUploadSlots(isGewerbe = false) {
  if (isGewerbe) {
    return [
      { id: 'gewerbenachweis', label: 'Gewerbenachweis', required: true },
      { id: 'ausweis_ansprechpartner', label: 'Ausweis Ansprechpartner', required: true },
      { id: 'handelsregister', label: 'Handelsregisterauszug', optional: true },
      { id: 'bank_firma', label: 'Bankverbindung Firma', required: true },
      { id: 'sonstiges', label: 'Sonstiges', optional: true },
    ];
  }
  return [
    { id: 'ausweis_vorderseite', label: 'Ausweis Vorderseite', required: true },
    { id: 'ausweis_rueckseite', label: 'Ausweis Rückseite', required: true },
    { id: 'gehaltsnachweis', label: 'Gehaltsnachweis', required: true },
    { id: 'kontoauszug', label: 'Kontoauszug', optional: true },
    { id: 'bankverbindung', label: 'Bankverbindung / IBAN', required: true },
    { id: 'sonstiges', label: 'Sonstiges', optional: true },
  ];
}

export const EMPTY_SELBSTAUSKUNFT_FORM = {
  personal: {
    name: '',
    address: '',
    birthDate: '',
    phone: '',
    email: '',
  },
  employment: {
    type: '',
    employer: '',
    netIncome: '',
    employedSince: '',
  },
  housing: {
    situation: 'miete',
    monthlyCost: '',
  },
  bank: {
    iban: '',
    accountHolder: '',
  },
  vehicle: {
    confirmed: false,
  },
};

export function shouldShowSelbstauskunftCta(vehicleCards = [], paymentType = '') {
  const pt = paymentType || vehicleCards[0]?.paymentType;
  if (!needsSelbstauskunft(pt)) return false;
  return vehicleCards.some((c) => ['draft', 'sent', 'opened', 'accepted', 'link_ready'].includes(c.offer?.status))
    || vehicleCards.length > 0;
}
