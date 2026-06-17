/**
 * Fahrzeug-Angebot (Online-PDF) – Status & Hilfen pro Karte in der Kundenakte
 */

export const VEHICLE_OFFER_STATUS = {
  DRAFT: 'draft',
  PDF_UPLOADED: 'pdf_uploaded',
  LINK_READY: 'link_ready',
  SENT: 'sent',
  OPENED: 'opened',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
};

export const VEHICLE_OFFER_STATUS_UI = {
  draft: {
    badge: 'Entwurf',
    banner: 'Das Angebot ist noch nicht gesendet.',
    tone: 'draft',
    bannerTone: 'draft',
  },
  pdf_uploaded: {
    badge: 'PDF hochgeladen',
    banner: 'Angebot hinterlegt – jetzt Link erstellen.',
    tone: 'ready',
    bannerTone: 'draft',
  },
  link_ready: {
    badge: 'Link bereit',
    banner: 'Online-Link ist bereit.',
    tone: 'ready',
    bannerTone: 'ready',
  },
  sent: {
    badge: 'Gesendet',
    banner: 'Das Angebot wurde an den Kunden gesendet.',
    tone: 'sent',
    bannerTone: 'sent',
  },
  opened: {
    badge: 'Geöffnet',
    banner: 'Kunde hat das Angebot geöffnet.',
    tone: 'opened',
    bannerTone: 'opened',
  },
  accepted: {
    badge: 'Angenommen',
    banner: 'Kunde hat zugesagt.',
    tone: 'accepted',
    bannerTone: 'sent',
  },
  rejected: {
    badge: 'Abgelehnt',
    banner: 'Kunde hat abgesagt.',
    tone: 'rejected',
    bannerTone: 'draft',
  },
};

export const VEHICLE_OFFER_HISTORY = {
  pdf_uploaded: 'Angebot-PDF hochgeladen',
  link_created: 'Online-Link erstellt',
  sent_email: 'Angebot per E-Mail gesendet',
  sent_whatsapp: 'Angebot per WhatsApp gesendet',
  opened: 'Kunde hat Angebot geöffnet',
  accepted: 'Angebot angenommen',
  rejected: 'Angebot abgelehnt',
};

function slugify(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function buildOnlineOfferUrl({ modelName = '', customerName = '' } = {}) {
  const model = slugify(modelName.replace(/^kia\s*/i, '')) || 'angebot';
  const customer = slugify(customerName) || 'kunde';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://kia-angebote.de';
  return `${origin}/angebot/online/${model}/${customer}`;
}

export function formatFileSize(bytes = 0) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatUploadWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 0) return `Heute ${time}`;
  if (diffDays === 1) return `Gestern ${time}`;
  return `${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} ${time}`;
}

export function formatOpenedTracking(tracking = {}) {
  const count = tracking.openCount ?? 0;
  if (!count) return 'Noch nicht geöffnet';
  const last = tracking.lastOpenedAt ? formatUploadWhen(tracking.lastOpenedAt) : '';
  if (count === 1) return `Kunde hat Angebot geöffnet · ${last}`;
  return `${count}x geöffnet · Zuletzt: ${last}`;
}

export function createVehicleOfferFromCard(card = {}, existing = null) {
  if (existing) return { ...existing };
  return {
    id: `vo-${card.id}`,
    vehicleCardId: card.id,
    status: VEHICLE_OFFER_STATUS.DRAFT,
    pdf: null,
    onlineLink: null,
    tracking: { openCount: 0, lastOpenedAt: null, firstOpenedAt: null },
    sentVia: null,
    sentAt: null,
    downPayment: 0,
    deliveryFee: 990,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function getVehicleOffer(lead = {}, card = {}) {
  const stored = lead?.crm?.vehicleOffers?.[card.id];
  return createVehicleOfferFromCard(card, stored);
}

export function mergeVehicleOffersPatch(lead = {}, vehicleCardId, patch) {
  const current = lead?.crm?.vehicleOffers ?? {};
  const prev = current[vehicleCardId] ?? {};
  return {
    ...current,
    [vehicleCardId]: {
      ...prev,
      ...patch,
      vehicleCardId,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function attachPdfToOffer(offer, file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        ...offer,
        status: VEHICLE_OFFER_STATUS.PDF_UPLOADED,
        pdf: {
          fileName: file.name,
          uploadedAt: new Date().toISOString(),
          sizeBytes: file.size,
          dataUrl: reader.result,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function createOnlineLinkForOffer(offer, { modelName, customerName } = {}) {
  const url = buildOnlineOfferUrl({ modelName, customerName });
  return {
    ...offer,
    status: VEHICLE_OFFER_STATUS.LINK_READY,
    onlineLink: { url, createdAt: new Date().toISOString() },
  };
}

export function markOfferSent(offer, via = 'email') {
  return {
    ...offer,
    status: VEHICLE_OFFER_STATUS.SENT,
    sentVia: via,
    sentAt: new Date().toISOString(),
  };
}

export function recordOfferOpened(offer) {
  const count = (offer.tracking?.openCount ?? 0) + 1;
  const now = new Date().toISOString();
  return {
    ...offer,
    status: VEHICLE_OFFER_STATUS.OPENED,
    tracking: {
      openCount: count,
      firstOpenedAt: offer.tracking?.firstOpenedAt ?? now,
      lastOpenedAt: now,
    },
  };
}

export function enrichCardWithVehicleOffer(card = {}, vehicleOffers = {}) {
  const vo = vehicleOffers[card.id];
  if (!vo) return card;
  return {
    ...card,
    vehicleOffer: vo,
    offer: {
      ...(card.offer ?? {}),
      status: vo.status,
      openedAt: vo.tracking?.lastOpenedAt,
      code: vo.onlineLink?.url,
    },
  };
}

export function buildOfferShareMessage({ customerName = '', vehicleTitle = '', url = '' } = {}) {
  const first = customerName.split(/\s+/)[0] || 'Hallo';
  return `Hallo ${first}, hier ist dein Angebot für ${vehicleTitle}: ${url}`;
}

export async function copyOfferLink(url) {
  if (!url || !navigator.clipboard?.writeText) return false;
  await navigator.clipboard.writeText(url);
  return true;
}

export function buildOfferWhatsappHref(phone, message) {
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  const normalized = digits.startsWith('0') ? `49${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function buildOfferMailtoHref(email, subject, body) {
  if (!email?.trim()) return null;
  return `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
