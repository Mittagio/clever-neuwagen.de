/**
 * Shared Live-Edit field meta (no inbound/patch imports – avoids cycles).
 */
import { SELLER_FACT_SOURCE } from './sellerFactTypes.js';

export const LIVE_EDIT_EDITOR = Object.freeze({
  TEXT: 'text',
  NAME: 'name',
  PHONE: 'phone',
  EMAIL: 'email',
  VEHICLE: 'vehicle',
  TERM: 'term',
  KM: 'km',
  MONEY: 'money',
  PAYMENT: 'payment',
  COLOR: 'color',
  EQUIPMENT: 'equipment',
});

export const FIELD_EDITOR_MAP = Object.freeze({
  customerName: LIVE_EDIT_EDITOR.NAME,
  phone: LIVE_EDIT_EDITOR.PHONE,
  mobile: LIVE_EDIT_EDITOR.PHONE,
  email: LIVE_EDIT_EDITOR.EMAIL,
  vehicleInterest: LIVE_EDIT_EDITOR.VEHICLE,
  vehicleInterestMulti: LIVE_EDIT_EDITOR.VEHICLE,
  termMonths: LIVE_EDIT_EDITOR.TERM,
  durationMonths: LIVE_EDIT_EDITOR.TERM,
  annualMileage: LIVE_EDIT_EDITOR.KM,
  mileagePerYear: LIVE_EDIT_EDITOR.KM,
  downPayment: LIVE_EDIT_EDITOR.MONEY,
  paymentType: LIVE_EDIT_EDITOR.PAYMENT,
  preferredColor: LIVE_EDIT_EDITOR.COLOR,
  color: LIVE_EDIT_EDITOR.COLOR,
  exteriorColor: LIVE_EDIT_EDITOR.COLOR,
  equipment: LIVE_EDIT_EDITOR.EQUIPMENT,
  mustHaveEquipment: LIVE_EDIT_EDITOR.EQUIPMENT,
});

export const FIELD_DISPLAY = Object.freeze({
  customerName: 'Name',
  phone: 'Telefon',
  mobile: 'Telefon',
  email: 'E-Mail',
  vehicleInterest: 'Modell',
  vehicleInterestMulti: 'Modell',
  termMonths: 'Laufzeit',
  durationMonths: 'Laufzeit',
  annualMileage: 'Kilometer',
  mileagePerYear: 'Kilometer',
  downPayment: 'Anzahlung',
  paymentType: 'Zahlungsart',
  preferredColor: 'Farbe',
  color: 'Farbe',
  exteriorColor: 'Farbe',
  equipment: 'Ausstattung',
  mustHaveEquipment: 'Ausstattung',
});

export const PAYMENT_OPTIONS = Object.freeze([
  { id: 'leasing', label: 'Leasing' },
  { id: 'financing', label: 'Finanzierung' },
  { id: 'cash', label: 'Barkauf' },
]);

export const IDENTITY_FIELDS = new Set(['customerName', 'phone', 'mobile', 'email']);

export function resolveLiveEditEditor(field) {
  return FIELD_EDITOR_MAP[field] || null;
}

export function isLiveEditableField(field) {
  return Boolean(resolveLiveEditEditor(field));
}

export function liveEditFieldLabel(field) {
  return FIELD_DISPLAY[field] || 'Wert';
}

/**
 * Structured chip for review UI (field binding for live-edit).
 */
export function buildEditableFactChip({
  field,
  label,
  value = null,
  fact = null,
  source = 'clever',
} = {}) {
  const chipLabel = String(label || fact?.label || '').trim();
  if (!chipLabel || !field) return null;
  const editor = resolveLiveEditEditor(field);
  const needsConfirmation = Boolean(fact?.needsConfirmation);
  return {
    label: chipLabel,
    field,
    value: value != null ? value : (fact?.value ?? chipLabel),
    source: needsConfirmation
      ? source
      : (fact?.source === SELLER_FACT_SOURCE.MANUAL_EDIT ? 'seller' : source),
    needsConfirmation,
    editable: Boolean(editor),
    editor,
    title: needsConfirmation
      ? 'Unsicher – antippen zum Korrigieren'
      : (editor ? 'Antippen zum Korrigieren' : 'Von Clever erkannt'),
  };
}

/**
 * @param {{ fieldLabel?: string, verb?: string, field?: string }} [opts]
 */
export function buildFactCorrectedMicroConfirm({
  fieldLabel = null,
  verb = 'geändert',
  field = null,
} = {}) {
  const name = fieldLabel || liveEditFieldLabel(field);
  return {
    text: `${name} ${verb}`,
    undoLabel: 'Rückgängig',
    field: field || null,
  };
}
