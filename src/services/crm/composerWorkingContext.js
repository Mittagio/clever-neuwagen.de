/**
 * Arbeitskontext über dem Composer (Cursor-Anhänge): Angebote, Dokumente, …
 * Steuert, worüber Clever gerade spricht – ohne den Verlauf zu verstopfen.
 */
import {
  formatVehicleCardConditions,
  formatVehicleCardPrice,
  formatVehicleCardTitle,
} from '../customerAkte.js';

export const WORKING_CONTEXT_KINDS = {
  OFFER: 'offer',
  DOCUMENT: 'document',
};

/**
 * @param {object} card
 * @param {object} [lead]
 * @returns {{ id: string, kind: string, offerId: string, label: string, detail: string|null, card: object }}
 */
export function buildOfferWorkingContextItem(card = {}, lead = null) {
  void lead;
  const offerId = String(card.id || card.configurationId || '').trim();
  const title = formatVehicleCardTitle(card).replace(/^Kia\s+/i, '').trim() || 'Angebot';
  const conditions = formatVehicleCardConditions(card);
  const price = formatVehicleCardPrice(card);
  const detailParts = [conditions, price].filter(Boolean);
  const shortCond = (() => {
    const parts = [];
    if (card.termMonths) parts.push(`${card.termMonths} M`);
    if (card.mileagePerYear) {
      parts.push(`${Number(card.mileagePerYear).toLocaleString('de-DE')} km`);
    }
    if (card.downPayment != null && card.downPayment !== '') {
      const az = Number(card.downPayment);
      parts.push(Number.isFinite(az)
        ? `${az.toLocaleString('de-DE')} € AZ`
        : `${card.downPayment} AZ`);
    }
    return parts.join(' · ') || null;
  })();

  return {
    id: `offer:${offerId || title}`,
    kind: WORKING_CONTEXT_KINDS.OFFER,
    offerId: offerId || null,
    label: `${title} Angebot`,
    shortLabel: shortCond ? `${title} · ${shortCond}` : `${title} Angebot`,
    detail: detailParts.join(' · ') || null,
    card,
  };
}

/**
 * @param {{ id?: string, slotId?: string, label?: string, fileName?: string|null, status?: string|null }} doc
 */
export function buildDocumentWorkingContextItem(doc = {}) {
  const docId = String(doc.id || doc.slotId || '').trim();
  const label = String(doc.label || doc.fileName || 'Dokument').trim();
  const fileName = doc.fileName ? String(doc.fileName) : null;
  return {
    id: docId.startsWith('doc:') || docId.startsWith('slot:')
      ? docId
      : `doc:${docId || label}`,
    kind: WORKING_CONTEXT_KINDS.DOCUMENT,
    documentId: docId || null,
    slotId: doc.slotId || null,
    label,
    shortLabel: fileName && fileName !== label ? `${label} · ${fileName}` : label,
    detail: fileName || doc.status || null,
    document: doc,
  };
}

/**
 * Anhängbare Dokumente aus Slot-Uploads + strukturierten Akte-Docs.
 * @param {object} lead
 * @param {object} [unterlagenSummary]
 */
export function listAttachableAkteDocuments(lead = {}, unterlagenSummary = null) {
  const summary = unterlagenSummary
    || {
      slots: [],
      items: lead?.crm?.cleverUnterlagen?.items ?? {},
    };
  const done = new Set(['uploaded', 'checked', 'replaced']);
  const docs = [];

  for (const slot of summary.slots ?? []) {
    const item = summary.items?.[slot.id] ?? lead?.crm?.cleverUnterlagen?.items?.[slot.id];
    if (!item) continue;
    if (!(item.fileName || item.dataUrl || done.has(item.status))) continue;
    docs.push({
      id: `slot:${slot.id}`,
      slotId: slot.id,
      label: slot.label || slot.id,
      fileName: item.fileName || null,
      status: item.status || null,
    });
  }

  const structured = lead?.crm?.cleverUnterlagen?.documents;
  if (Array.isArray(structured)) {
    for (const entry of structured) {
      if (!entry?.id && !entry?.fileName) continue;
      docs.push({
        id: `doc:${entry.id || entry.fileName}`,
        slotId: entry.categoryId || null,
        label: entry.label || entry.categoryLabel || entry.fileName || 'Dokument',
        fileName: entry.fileName || null,
        status: entry.status || null,
      });
    }
  }

  return docs;
}

/**
 * @param {object} item
 * @returns {{ offerId: string|null, title: string, termMonths: number|null, mileagePerYear: number|null, monthlyRate: number|null, paymentType: string|null, summary: string }}
 */
export function toCurrentOfferContext(item = null) {
  if (!item || item.kind !== WORKING_CONTEXT_KINDS.OFFER) return null;
  const card = item.card || {};
  return {
    offerId: item.offerId || card.id || null,
    title: formatVehicleCardTitle(card),
    termMonths: card.termMonths ?? null,
    mileagePerYear: card.mileagePerYear ?? null,
    monthlyRate: card.desiredRate ?? null,
    paymentType: card.paymentType ?? null,
    summary: item.detail || item.shortLabel || item.label,
  };
}

/**
 * Ersetzt gleichartigen Kontext oder hängt an (max. 4).
 * @param {object[]} items
 * @param {object} next
 */
export function upsertWorkingContextItem(items = [], next = null) {
  if (!next?.id) return Array.isArray(items) ? items : [];
  const list = Array.isArray(items) ? items.filter((i) => i?.id !== next.id) : [];
  if (next.kind === WORKING_CONTEXT_KINDS.OFFER) {
    // Ein aktives Angebot als Primärkontext – ältere Offer-Pills ersetzen
    const withoutOffers = list.filter((i) => i.kind !== WORKING_CONTEXT_KINDS.OFFER);
    return [next, ...withoutOffers].slice(0, 4);
  }
  return [next, ...list].slice(0, 4);
}

export function removeWorkingContextItem(items = [], itemId = '') {
  return (Array.isArray(items) ? items : []).filter((i) => i?.id !== itemId);
}

export function findOfferWorkingContext(items = []) {
  return (Array.isArray(items) ? items : []).find((i) => i?.kind === WORKING_CONTEXT_KINDS.OFFER) || null;
}
