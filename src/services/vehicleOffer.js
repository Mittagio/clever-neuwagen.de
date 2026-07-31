/**
 * Fahrzeug-Angebot (Online-PDF) – Status & Hilfen pro Karte in der Kundenakte
 *
 * Internal prep lifecycle (Angebot prüfen / PDF-Confirm):
 *   draft → prepared (seller confirms & saves from preview)
 * Later customer-facing steps (Composer owns messaging):
 *   selected_for_customer / sent — do not invent parallel systems here.
 * Existing link_ready / sent / opened remain for legacy online-link flows.
 */

export const VEHICLE_OFFER_STATUS = {
  DRAFT: 'draft',
  /** Seller confirmed commercial data and filed offer in Kundenakte */
  PREPARED: 'prepared',
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
    banner: 'Das Angebot ist noch nicht geprüft.',
    tone: 'draft',
    bannerTone: 'draft',
  },
  prepared: {
    badge: 'Vorbereitet',
    banner: 'Angebot geprüft und in der Kundenakte abgelegt.',
    tone: 'ready',
    bannerTone: 'ready',
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
  prepared: 'Angebot geprüft und abgelegt',
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

export function buildOnlineOfferUrl({
  modelName = '',
  customerName = '',
  leadId = null,
  vehicleCardId = null,
} = {}) {
  const model = slugify(modelName.replace(/^kia\s*/i, '')) || 'angebot';
  const customer = slugify(customerName) || 'kunde';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://kia-angebote.de';
  const base = `${origin}/angebot/online/${model}/${customer}`;
  const params = new URLSearchParams();
  if (leadId) params.set('leadId', leadId);
  if (vehicleCardId) params.set('cardId', vehicleCardId);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
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
  if (existing) {
    return {
      version: 1,
      versions: [],
      replacedByOfferId: null,
      vehicleTrackId: existing.vehicleTrackId ?? card.id,
      ...existing,
    };
  }
  return {
    id: `vo-${card.id}`,
    vehicleCardId: card.id,
    vehicleTrackId: card.id,
    status: VEHICLE_OFFER_STATUS.DRAFT,
    version: 1,
    versions: [],
    replacedByOfferId: null,
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

/**
 * Neue Angebotsversion – überschreibt v1 nicht; Snapshot in versions[].
 * PDF / originalPdf der alten Version bleiben in versions[] erhalten.
 */
export function createNextOfferVersion(offer = {}, patch = {}) {
  const currentVersion = Number(offer.version) || 1;
  const snapshot = {
    version: currentVersion,
    status: offer.status,
    monthlyRate: offer.monthlyRate ?? offer.boardOffer?.payment?.monthlyRate ?? null,
    termMonths: offer.termMonths ?? offer.boardOffer?.payment?.termMonths ?? null,
    annualMileage: offer.mileagePerYear
      ?? offer.boardOffer?.payment?.mileagePerYear
      ?? null,
    downPayment: offer.downPayment ?? 0,
    pdf: offer.pdf ?? null,
    originalPdf: offer.source?.originalPdf ?? offer.pdf ?? null,
    source: offer.source ?? null,
    sentAt: offer.sentAt ?? null,
    openedAt: offer.tracking?.firstOpenedAt ?? null,
    snapshotAt: new Date().toISOString(),
  };
  const nextVersion = currentVersion + 1;
  const baseId = String(offer.id || `vo-${offer.vehicleCardId || 'offer'}`).replace(/-v\d+$/, '');
  const nextId = `${baseId}-v${nextVersion}`;
  const previousPdfs = [
    ...(Array.isArray(offer.source?.previousPdfs) ? offer.source.previousPdfs : []),
    ...(offer.source?.originalPdf || offer.pdf
      ? [offer.source?.originalPdf ?? offer.pdf]
      : []),
  ];
  const nextSource = patch.source
    ? {
      ...offer.source,
      ...patch.source,
      previousPdfs: patch.source.previousPdfs ?? previousPdfs,
    }
    : {
      ...(offer.source ?? {}),
      previousPdfs,
    };
  return {
    ...offer,
    ...patch,
    id: nextId,
    version: nextVersion,
    status: VEHICLE_OFFER_STATUS.DRAFT,
    replacedByOfferId: null,
    versions: [...(Array.isArray(offer.versions) ? offer.versions : []), snapshot],
    source: nextSource,
    sentAt: null,
    sentVia: null,
    tracking: { openCount: 0, lastOpenedAt: null, firstOpenedAt: null },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Bestehendes vorbereitetes Angebot erneut speichern → Version + prepared.
 */
export function improvePreparedOffer(existingOffer = {}, patch = {}) {
  const bumped = createNextOfferVersion(existingOffer, patch);
  return markOfferPrepared(bumped);
}

/** Angebot gilt als „bereits abgelegt“ und braucht bei erneutem Speichern eine Version. */
export function shouldBumpOfferVersionOnSave(existingOffer = null) {
  if (!existingOffer || typeof existingOffer !== 'object') return false;
  const status = existingOffer.status;
  if (
    status === VEHICLE_OFFER_STATUS.PREPARED
    || status === VEHICLE_OFFER_STATUS.PDF_UPLOADED
    || status === VEHICLE_OFFER_STATUS.LINK_READY
    || status === VEHICLE_OFFER_STATUS.SENT
    || status === VEHICLE_OFFER_STATUS.OPENED
    || status === VEHICLE_OFFER_STATUS.ACCEPTED
  ) {
    return true;
  }
  if (Number(existingOffer.version) > 1) return true;
  if (Array.isArray(existingOffer.versions) && existingOffer.versions.length > 0) return true;
  return Boolean(existingOffer.pdf?.dataUrl || existingOffer.pdf?.url || existingOffer.preparedAt);
}

export function getVehicleOffer(lead = {}, card = {}) {
  const stored = lead?.crm?.vehicleOffers?.[card.id];
  return createVehicleOfferFromCard(card, stored);
}

/**
 * Flat map of all stored offers (cardId-keyed legacy + offerId-keyed scenario offers).
 * @param {object} lead
 * @returns {object[]}
 */
export function listStoredVehicleOffers(lead = {}) {
  const map = lead?.crm?.vehicleOffers ?? {};
  return Object.values(map).filter((offer) => offer && typeof offer === 'object');
}

/**
 * Offers bound to a vehicle track (via vehicleTrackId / vehicleCardId / track.offerIds).
 */
export function listOffersForVehicleTrack(lead = {}, trackId) {
  if (!trackId) return [];
  const map = lead?.crm?.vehicleOffers ?? {};
  const config = (lead?.crm?.vehicleConfigurations ?? []).find((c) => c.id === trackId);
  const metaIds = Array.isArray(config?.vehicleTrack?.offerIds)
    ? config.vehicleTrack.offerIds
    : [];

  const byMeta = metaIds.map((id) => map[id]).filter(Boolean);
  if (byMeta.length) return byMeta;

  const byField = listStoredVehicleOffers(lead).filter((offer) => (
    offer.vehicleTrackId === trackId
    || offer.vehicleCardId === trackId
  ));
  if (byField.length) return byField;

  const legacy = map[trackId];
  return legacy ? [legacy] : [];
}

export function getOfferByCommercialScenarioId(lead = {}, scenarioId, trackId = null) {
  if (!scenarioId) return null;
  const pool = trackId
    ? listOffersForVehicleTrack(lead, trackId)
    : listStoredVehicleOffers(lead);
  return pool.find((offer) => offer.commercialScenarioId === scenarioId) ?? null;
}

export function getVehicleOfferById(lead = {}, offerId) {
  if (!offerId) return null;
  const map = lead?.crm?.vehicleOffers ?? {};
  if (map[offerId]) return map[offerId];
  return listStoredVehicleOffers(lead).find((o) => o.id === offerId) ?? null;
}

/**
 * Create a scenario-bound offer shell (does not replace cardId legacy entry).
 */
export function createVehicleOfferForScenario({
  trackId,
  scenarioId,
  offerId = null,
  existing = null,
  patch = {},
} = {}) {
  if (existing) {
    return {
      version: 1,
      versions: [],
      replacedByOfferId: null,
      ...existing,
      vehicleTrackId: existing.vehicleTrackId ?? trackId,
      vehicleCardId: existing.vehicleCardId ?? trackId,
      commercialScenarioId: existing.commercialScenarioId ?? scenarioId,
      ...patch,
    };
  }
  const id = offerId || `vo-${trackId}-${scenarioId}`;
  return {
    id,
    vehicleCardId: trackId,
    vehicleTrackId: trackId,
    commercialScenarioId: scenarioId,
    status: VEHICLE_OFFER_STATUS.DRAFT,
    version: 1,
    versions: [],
    replacedByOfferId: null,
    pdf: null,
    onlineLink: null,
    tracking: { openCount: 0, lastOpenedAt: null, firstOpenedAt: null },
    sentVia: null,
    sentAt: null,
    downPayment: 0,
    deliveryFee: 990,
    monthlyRate: null,
    termMonths: null,
    mileagePerYear: null,
    balloonPayment: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...patch,
  };
}

/**
 * Offer is ready for dual-send / portal (PDF, prepared, or calculated rate present).
 */
export function isScenarioOfferReady(offer = null) {
  if (!offer) return false;
  if (offer.pdf?.dataUrl || offer.pdf?.url || offer.pdf?.fileName) return true;
  const status = offer.status;
  if (
    status === VEHICLE_OFFER_STATUS.PREPARED
    || status === VEHICLE_OFFER_STATUS.PDF_UPLOADED
    || status === VEHICLE_OFFER_STATUS.LINK_READY
    || status === VEHICLE_OFFER_STATUS.SENT
    || status === VEHICLE_OFFER_STATUS.OPENED
    || status === VEHICLE_OFFER_STATUS.ACCEPTED
  ) {
    return true;
  }
  const rate = offer.monthlyRate ?? offer.boardOffer?.payment?.monthlyRate;
  return rate != null && Number.isFinite(Number(rate));
}

/** Mark offer as prepared after seller confirm & save from Angebot prüfen. */
export function markOfferPrepared(offer = {}) {
  return {
    ...offer,
    status: VEHICLE_OFFER_STATUS.PREPARED,
    preparedAt: offer.preparedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
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

/**
 * Patch / upsert by offer id (preferred for scenario-bound offers).
 * Also syncs track.offerIds when vehicleTrackId is known.
 */
export function mergeVehicleOfferById(lead = {}, offerId, patch = {}) {
  if (!offerId) return lead;
  const current = lead?.crm?.vehicleOffers ?? {};
  const prev = current[offerId] ?? {};
  const nextOffer = {
    ...prev,
    ...patch,
    id: offerId,
    vehicleCardId: patch.vehicleCardId ?? prev.vehicleCardId ?? patch.vehicleTrackId ?? prev.vehicleTrackId,
    vehicleTrackId: patch.vehicleTrackId ?? prev.vehicleTrackId ?? patch.vehicleCardId ?? prev.vehicleCardId,
    commercialScenarioId: patch.commercialScenarioId ?? prev.commercialScenarioId ?? null,
    updatedAt: new Date().toISOString(),
  };

  let nextLead = {
    ...lead,
    crm: {
      ...(lead.crm ?? {}),
      vehicleOffers: {
        ...current,
        [offerId]: nextOffer,
      },
    },
  };

  const trackId = nextOffer.vehicleTrackId;
  if (trackId) {
    const configs = nextLead.crm.vehicleConfigurations ?? [];
    nextLead = {
      ...nextLead,
      crm: {
        ...nextLead.crm,
        vehicleConfigurations: configs.map((config) => {
          if (config.id !== trackId) return config;
          const prevTrack = config.vehicleTrack && typeof config.vehicleTrack === 'object'
            ? config.vehicleTrack
            : {};
          const offerIds = Array.isArray(prevTrack.offerIds) ? [...prevTrack.offerIds] : [];
          if (!offerIds.includes(offerId)) offerIds.push(offerId);
          return {
            ...config,
            vehicleTrack: {
              ...prevTrack,
              offerIds,
              activeOfferId: prevTrack.activeOfferId ?? offerId,
              lastActivityAt: new Date().toISOString(),
            },
            updatedAt: new Date().toISOString(),
          };
        }),
      },
    };
  }

  return nextLead;
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

export function createOnlineLinkForOffer(offer, {
  modelName,
  customerName,
  leadId = null,
  vehicleCardId = null,
} = {}) {
  const url = buildOnlineOfferUrl({ modelName, customerName, leadId, vehicleCardId });
  return {
    ...offer,
    status: VEHICLE_OFFER_STATUS.LINK_READY,
    onlineLink: {
      url,
      createdAt: new Date().toISOString(),
      leadId: leadId ?? null,
      vehicleCardId: vehicleCardId ?? offer.vehicleCardId ?? null,
    },
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

export function buildSmsHref(phone, message) {
  const digits = String(phone).replace(/\D/g, '');
  if (!digits || !message?.trim()) return null;
  return `sms:${digits}?body=${encodeURIComponent(message)}`;
}

export function buildOfferMailtoHref(email, subject, body) {
  if (!email?.trim()) return null;
  return `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
