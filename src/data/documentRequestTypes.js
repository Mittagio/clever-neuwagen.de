import { DOCUMENT_TYPES } from './documentTypes.js';

/** Unterlagen-Slots für den Angebotsdialog (Phase 3) */
export const OFFER_DOCUMENT_SLOTS = [
  { id: 'personalausweis', label: 'Personalausweis', kind: 'upload' },
  { id: 'gehaltsnachweise', label: 'Gehaltsnachweise (2–3 Monate)', kind: 'upload' },
  { id: 'fuehrerschein', label: 'Führerschein', kind: 'upload' },
  { id: 'selbstauskunft', label: 'Digitale Selbstauskunft', kind: 'form' },
];

export const DOCUMENT_REQUEST_STATUS = {
  open: { id: 'open', label: 'Offen' },
  partial: { id: 'partial', label: 'Teilweise eingereicht' },
  completed: { id: 'completed', label: 'Vollständig' },
  expired: { id: 'expired', label: 'Abgelaufen' },
};

export const SLOT_STATUS = {
  pending: 'pending',
  uploaded: 'uploaded',
  completed: 'completed',
};

export function getOfferSlotLabel(slotId) {
  return OFFER_DOCUMENT_SLOTS.find((s) => s.id === slotId)?.label
    ?? DOCUMENT_TYPES.find((d) => d.id === slotId)?.label
    ?? slotId;
}

export function getDefaultRequestSlots() {
  return OFFER_DOCUMENT_SLOTS.map((s) => s.id);
}
