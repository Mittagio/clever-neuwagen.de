/** Abrechnungs-Konfiguration – später Admin-konfigurierbar */
export const BILLING_CONFIG = {
  platformFeeMonthly: 199,
  successProvision: 49,
  vatRate: 0.19,
  currency: 'EUR',
  defaultMonth: '2026-05',
  invoicePrefix: 'CN-INV',
};

export const PAYMENT_STATUS = {
  paid: { id: 'paid', label: 'Bezahlt', emoji: '🟢', tone: 'success' },
  open: { id: 'open', label: 'Offen', emoji: '🟡', tone: 'warning' },
  reminder: { id: 'reminder', label: 'Erinnerung', emoji: '🟠', tone: 'reminder' },
  dunning: { id: 'dunning', label: 'Mahnung', emoji: '🔴', tone: 'danger' },
};

export const DEALER_BILLING_STATUS = {
  active: { id: 'active', label: 'Aktiv' },
  paused: { id: 'paused', label: 'Pausiert' },
  inactive: { id: 'inactive', label: 'Inaktiv' },
};

export const DELIVERY_STATUS = {
  pending: { id: 'pending', label: 'Warte auf Bestätigung' },
  sent: { id: 'sent', label: 'Link gesendet' },
  confirmed: { id: 'confirmed', label: 'Bestätigt' },
  declined: { id: 'declined', label: 'Abgelehnt' },
  voucherPending: { id: 'voucherPending', label: 'Gutschein ausstehend' },
  provisionReleased: { id: 'provisionReleased', label: 'Provision freigegeben' },
  billable: { id: 'billable', label: 'Abrechenbar' },
  error: { id: 'error', label: 'Fehler' },
};

/** Gutschein-Vorlagen (Admin /admin/rewards) */
export const REWARD_TEMPLATES = [
  {
    id: 'fuel-verbrenner',
    driveType: 'verbrenner',
    label: 'Verbrenner',
    voucherType: 'fuel',
    title: 'Tankgutschein',
    amount: 20,
  },
  {
    id: 'fuel-hybrid',
    driveType: 'hybrid',
    label: 'Hybrid',
    voucherType: 'fuel',
    title: 'Tankgutschein',
    amount: 20,
  },
  {
    id: 'charging-elektro',
    driveType: 'elektro',
    label: 'Elektro',
    voucherType: 'charging',
    title: 'Ladegutschein',
    amount: 20,
  },
];

/** Partner-Vorbereitung (Anzeige in Rewards-Admin) */
export const REWARD_PARTNER_PREP = [
  { id: 'aral', name: 'Aral', type: 'fuel', status: 'ready' },
  { id: 'shell', name: 'Shell', type: 'fuel', status: 'ready' },
  { id: 'esso', name: 'Esso', type: 'fuel', status: 'ready' },
  { id: 'enbw', name: 'EnBW', type: 'charging', status: 'ready' },
  { id: 'ionity', name: 'Ionity', type: 'charging', status: 'ready' },
];

/** Zahlungs-Provider – vorbereitet, nicht aktiv */
export const PAYMENT_PROVIDERS_PREP = [
  { id: 'stripe', label: 'Stripe', active: false },
  { id: 'sepa', label: 'SEPA-Lastschrift', active: false },
  { id: 'datev', label: 'DATEV Export', active: false },
  { id: 'lexoffice', label: 'Lexoffice', active: false },
];

export function formatBillingMonth(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const label = new Date(year, month - 1, 1).toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatMoney(amount, { compact = false } = {}) {
  const n = Number(amount) || 0;
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: compact ? 0 : 2,
  }).format(n);
}
