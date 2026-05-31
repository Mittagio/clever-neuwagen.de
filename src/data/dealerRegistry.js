/** Händlerstatus – Betreiber-Cockpit */
export const DEALER_STATUS = {
  active: { id: 'active', label: 'Aktiv', emoji: '🟢', tone: 'success' },
  review: { id: 'review', label: 'In Prüfung', emoji: '🟡', tone: 'warning' },
  blocked: { id: 'blocked', label: 'Gesperrt', emoji: '🔴', tone: 'danger' },
  draft: { id: 'draft', label: 'Entwurf', emoji: '⚪', tone: 'muted' },
};

export const APPROVAL_TYPES = {
  registration: { id: 'registration', label: 'Händlerregistrierung' },
  pricelist: { id: 'pricelist', label: 'Preislistenfreigabe' },
  discount: { id: 'discount', label: 'Rabattprüfung' },
  brand: { id: 'brand', label: 'Markenfreigabe' },
  invoice: { id: 'invoice', label: 'Rechnung überfällig' },
};

export const APPROVAL_STATUS = {
  pending: { id: 'pending', label: 'Offen' },
  approved: { id: 'approved', label: 'Freigegeben' },
  rejected: { id: 'rejected', label: 'Abgelehnt' },
};

export const ONBOARDING_PIPELINE = [
  { id: 1, key: 'registered', label: 'Registriert' },
  { id: 2, key: 'contract', label: 'Vertrag erhalten' },
  { id: 3, key: 'review', label: 'Prüfung' },
  { id: 4, key: 'approval', label: 'Freigabe' },
  { id: 5, key: 'live', label: 'Live' },
];

/** Marken – Admin-Freigabe für Händler */
export const PLATFORM_BRANDS = [
  { id: 'kia', name: 'Kia', active: true },
  { id: 'hyundai', name: 'Hyundai', active: false },
  { id: 'toyota', name: 'Toyota', active: false },
  { id: 'vw', name: 'VW', active: false },
  { id: 'bmw', name: 'BMW', active: false },
  { id: 'mercedes', name: 'Mercedes', active: false },
];

/** Kia-Modelle – Admin-Freigabe pro Händler */
export const KIA_MODELS = [
  { id: 'sportage', name: 'Sportage' },
  { id: 'ev3', name: 'EV3' },
  { id: 'ev4', name: 'EV4' },
  { id: 'picanto', name: 'Picanto' },
  { id: 'ceed', name: 'Ceed' },
  { id: 'sorento', name: 'Sorento' },
];

export const FUTURE_INTEGRATIONS = [
  { id: 'docusign', label: 'Digitale Vertragsunterschrift', active: false },
  { id: 'sepa', label: 'SEPA-Mandat', active: false },
  { id: 'lexoffice', label: 'Lexoffice', active: false },
  { id: 'datev', label: 'DATEV', active: false },
  { id: 'auto-approve', label: 'Automatische Händlerfreigabe', active: false },
];
