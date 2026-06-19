/**
 * Clever Unterlagen – Slots, Status & Hilfen pro Verkaufschance
 */
import {
  createDocumentRequest,
  buildUnterlagenUrl,
} from '../logic/documentRequestService.js';

export const UNTERLAGEN_STATUS = {
  open: { id: 'open', label: 'Noch offen', tone: 'open' },
  uploaded: { id: 'uploaded', label: 'Hochgeladen', tone: 'uploaded' },
  checked: { id: 'checked', label: 'Geprüft', tone: 'checked' },
  replaced: { id: 'replaced', label: 'Ersetzt', tone: 'replaced' },
  not_needed: { id: 'not_needed', label: 'Nicht benötigt', tone: 'muted' },
};

export const UNTERLAGEN_HISTORY = {
  link_created: 'Unterlagen-Link erstellt',
  link_sent_whatsapp: 'Unterlagen-Link per WhatsApp gesendet',
  link_sent_email: 'Unterlagen-Link per E-Mail gesendet',
  uploaded_ausweis: 'Ausweis hochgeladen',
  uploaded_selbstauskunft: 'Selbstauskunft hochgeladen',
  uploaded_gehaltsnachweis: 'Gehaltsnachweis hochgeladen',
  uploaded_bank: 'Bankverbindung hochgeladen',
  checked: 'Unterlage geprüft',
  replaced: 'Unterlage ersetzt',
};

const BASE_SLOTS = {
  ausweis: { id: 'ausweis', label: 'Ausweis' },
  selbstauskunft: { id: 'selbstauskunft', label: 'Selbstauskunft' },
  gehaltsnachweis: { id: 'gehaltsnachweis', label: 'Gehaltsnachweis' },
  bankverbindung: { id: 'bankverbindung', label: 'Bankverbindung / IBAN', optional: true },
  zulassungsvollmacht: { id: 'zulassungsvollmacht', label: 'Zulassungsvollmacht', optional: true },
  sepa: { id: 'sepa', label: 'SEPA', optional: true },
  schlussrate: { id: 'schlussrate', label: 'Schlussrate / Rückgabeoption', optional: true },
  finanzierung: { id: 'finanzierung', label: 'Finanzierungsunterlagen', optional: true },
  gewerbenachweis: { id: 'gewerbenachweis', label: 'Gewerbenachweis' },
  handelsregister: { id: 'handelsregister', label: 'Handelsregisterauszug', optional: true },
  steuernummer: { id: 'steuernummer', label: 'Steuernummer', optional: true },
  ausweis_ansprechpartner: { id: 'ausweis_ansprechpartner', label: 'Ausweis Ansprechpartner' },
  bank_firma: { id: 'bank_firma', label: 'Bankverbindung Firma' },
  sonstiges: { id: 'sonstiges', label: 'Sonstiges', optional: true },
};

const SLOT_IDS_BY_PAYMENT = {
  cash: ['ausweis', 'bankverbindung', 'zulassungsvollmacht', 'sepa', 'sonstiges'],
  leasing: ['ausweis', 'selbstauskunft', 'gehaltsnachweis', 'bankverbindung', 'sonstiges'],
  financing: ['ausweis', 'selbstauskunft', 'gehaltsnachweis', 'bankverbindung', 'finanzierung', 'sonstiges'],
  threeWayFinancing: ['ausweis', 'selbstauskunft', 'gehaltsnachweis', 'bankverbindung', 'schlussrate', 'sonstiges'],
};

const GEWERBE_EXTRA = ['gewerbenachweis', 'handelsregister', 'steuernummer', 'ausweis_ansprechpartner', 'bank_firma'];

export function isGewerbeLead(lead = {}) {
  const group = lead.wish?.customerGroup ?? lead.crm?.customerGroup ?? '';
  return group === 'gewerbe' || group === 'fleet' || group === 'corporate';
}

export function getUnterlagenSlotsForLead(lead = {}, paymentType = null) {
  const pt = paymentType ?? lead.paymentType ?? lead.wish?.paymentType ?? 'leasing';
  const ids = [...(SLOT_IDS_BY_PAYMENT[pt] ?? SLOT_IDS_BY_PAYMENT.leasing)];

  if (isGewerbeLead(lead)) {
    for (const id of GEWERBE_EXTRA) {
      if (!ids.includes(id)) ids.splice(ids.length - 1, 0, id);
    }
  }

  return ids.map((id) => ({ ...BASE_SLOTS[id], id }));
}

export function getUnterlagenSubline(paymentType = 'leasing') {
  if (paymentType === 'cash') {
    return 'Unterlagen für Kauf und Zulassung vorbereiten.';
  }
  if (paymentType === 'leasing' || paymentType === 'financing' || paymentType === 'threeWayFinancing') {
    return 'Alles für Bank, Leasing und Abschluss an einem Ort.';
  }
  return 'Mit den Unterlagen ist die Bankanfrage startklar.';
}

export function getCleverUnterlagen(lead = {}) {
  return lead?.crm?.cleverUnterlagen ?? { items: {}, uploadLink: null };
}

export function initCleverUnterlagenForLead(lead = {}, paymentType = null) {
  const existing = getCleverUnterlagen(lead);
  const slots = getUnterlagenSlotsForLead(lead, paymentType);
  const items = { ...existing.items };

  for (const slot of slots) {
    if (!items[slot.id]) {
      items[slot.id] = { status: UNTERLAGEN_STATUS.open.id };
    }
  }

  return {
    ...existing,
    items,
    updatedAt: new Date().toISOString(),
  };
}

export function computeUnterlagenSummary(lead = {}, paymentType = null) {
  const data = initCleverUnterlagenForLead(lead, paymentType);
  const slots = getUnterlagenSlotsForLead(lead, paymentType);
  const doneStatuses = new Set(['uploaded', 'checked', 'replaced', 'not_needed']);
  const doneCount = slots.filter((s) => doneStatuses.has(data.items[s.id]?.status)).length;

  let headline = 'Noch keine Unterlagen';
  if (doneCount >= Math.max(1, slots.length - 1) && slots.length > 0) {
    headline = 'Fast startklar';
  } else if (doneCount > 0) {
    headline = `${doneCount} von ${slots.length} vorbereitet`;
  }

  return {
    headline,
    doneCount,
    totalCount: slots.length,
    hasUploadLink: Boolean(data.uploadLink?.url),
    items: data.items,
    slots,
    data,
  };
}

export function shouldElevateUnterlagen(vehicleCards = []) {
  return vehicleCards.some((c) => ['sent', 'opened', 'accepted'].includes(c.offer?.status));
}

const UNTERLAGEN_DONE_STATUSES = new Set(['uploaded', 'checked', 'replaced', 'not_needed']);
const FINANCE_PAYMENT_TYPES = new Set(['leasing', 'financing', 'threeWayFinancing']);

function needsSelbstauskunftForPayment(paymentType = '') {
  return FINANCE_PAYMENT_TYPES.has(paymentType);
}

function getSelbstauskunftFromData(unterlagen = {}) {
  return unterlagen?.selbstauskunft ?? { status: 'not_started' };
}

function isSelbstauskunftComplete(selbstauskunft = {}) {
  return selbstauskunft.status === 'completed' || selbstauskunft.status === 'checked';
}

export function countUnterlagenOpenTasks(lead = {}, paymentType = null) {
  const summary = computeUnterlagenSummary(lead, paymentType);
  const pt = paymentType ?? lead?.paymentType ?? 'leasing';
  const showSa = needsSelbstauskunftForPayment(pt);
  const selbstauskunft = getSelbstauskunftFromData(summary.data);
  const saComplete = isSelbstauskunftComplete(selbstauskunft);

  const openCount = summary.slots.filter((slot) => {
    if (slot.id === 'selbstauskunft' && showSa) return !saComplete;
    return !UNTERLAGEN_DONE_STATUSES.has(summary.items[slot.id]?.status);
  }).length;

  return { openCount, summary, showSa, selbstauskunft, saComplete };
}

export function buildUnterlagenHintText(lead = {}, paymentType = null) {
  const { openCount, showSa, saComplete } = countUnterlagenOpenTasks(lead, paymentType);
  if (openCount <= 0) return null;
  if (openCount === 1 && showSa && !saComplete) return 'Selbstauskunft fehlt';
  if (openCount === 1) return '1 Unterlage fehlt';
  return `${openCount} Unterlagen fehlen`;
}

export function formatUnterlagenOpenLabel(openCount, { showSa = false, saComplete = true } = {}) {
  if (openCount <= 0) return 'Alles erledigt';
  if (openCount === 1 && showSa && !saComplete) return '1 Aufgabe offen';
  return `${openCount} Aufgaben offen`;
}

export function attachFileToUnterlageSlot(unterlagen, slotId, file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        ...unterlagen,
        items: {
          ...unterlagen.items,
          [slotId]: {
            status: UNTERLAGEN_STATUS.uploaded.id,
            fileName: file.name,
            uploadedAt: new Date().toISOString(),
            sizeBytes: file.size,
            mimeType: file.type,
            dataUrl: reader.result,
          },
        },
        updatedAt: new Date().toISOString(),
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function removeUnterlageFile(unterlagen, slotId) {
  return {
    ...unterlagen,
    items: {
      ...unterlagen.items,
      [slotId]: { status: UNTERLAGEN_STATUS.open.id },
    },
    updatedAt: new Date().toISOString(),
  };
}

export function markUnterlageStatus(unterlagen, slotId, statusId) {
  return {
    ...unterlagen,
    items: {
      ...unterlagen.items,
      [slotId]: {
        ...(unterlagen.items[slotId] ?? {}),
        status: statusId,
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

export function createUnterlagenUploadLink(lead = {}, paymentType = null) {
  const slots = getUnterlagenSlotsForLead(lead, paymentType);
  const slotTypes = slots.map((s) => {
    if (s.id === 'ausweis') return 'personalausweis';
    if (s.id === 'gehaltsnachweis') return 'gehaltsnachweise';
    if (s.id === 'selbstauskunft') return 'selbstauskunft';
    return s.id;
  });

  const request = createDocumentRequest({
    leadId: lead.id,
    offerCode: lead.offerCode ?? lead.referenceCode ?? '',
    customerEmail: lead.contact?.email ?? '',
    customerName: lead.contact?.name ?? '',
    slotTypes: [...new Set(slotTypes)],
    dealerMessage: 'Bitte laden Sie die Unterlagen für Ihr Fahrzeugangebot hoch.',
  });

  const url = buildUnterlagenUrl(request.id, request.accessToken);
  const unterlagen = initCleverUnterlagenForLead(lead, paymentType);

  return {
    ...unterlagen,
    uploadLink: {
      url,
      requestId: request.id,
      token: request.accessToken,
      createdAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };
}

export function buildUnterlagenShareMessage({ customerName = '', url = '' } = {}) {
  const first = customerName.split(/\s+/)[0] || 'Hallo';
  return `Hallo ${first}, hier können Sie Ihre Unterlagen sicher hochladen: ${url}`;
}

export function historyKeyForSlot(slotId) {
  if (slotId === 'ausweis') return 'uploaded_ausweis';
  if (slotId === 'selbstauskunft') return 'uploaded_selbstauskunft';
  if (slotId === 'gehaltsnachweis') return 'uploaded_gehaltsnachweis';
  if (slotId === 'bankverbindung' || slotId === 'bank_firma') return 'uploaded_bank';
  return null;
}

export const ACCEPTED_UNTERLAGEN_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
];

export function isAcceptedUnterlagenFile(file) {
  if (!file) return false;
  if (ACCEPTED_UNTERLAGEN_TYPES.includes(file.type)) return true;
  return /\.(pdf|jpe?g|png|heic|heif)$/i.test(file.name ?? '');
}
