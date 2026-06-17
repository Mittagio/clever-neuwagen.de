/** Standard-Hinweis bei Leasing-, Finanzierungs- und Angebotsraten */
export const RATE_DISCLAIMER =
  'Unverbindliche Beispielrechnung. Maßgeblich ist ausschließlich das schriftliche Angebot des jeweiligen Händlers.';

export const LEGAL_OPERATOR = {
  name: 'Mike Quach',
  street: 'Langäcker 2',
  zip: '73635',
  city: 'Rudersberg',
  email: 'info@clever-neuwagen.de',
  phone: null,
  vatId: null,
  legalForm: null,
  tradeRegister: null,
};

export const LEGAL_PLACEHOLDERS = {
  phone: '[Telefonnummer – wird ergänzt]',
  vatId: '[USt-ID – wird ergänzt]',
  legalForm: '[Rechtsform – wird ergänzt]',
  tradeRegister: '[Handelsregister – wird ergänzt]',
};

export const COOKIE_CONSENT_KEY = 'clever-neuwagen-cookie-consent';

export const LEGAL_FOOTER_LINKS = [
  { to: '/legal/impressum', label: 'Impressum' },
  { to: '/legal/datenschutz', label: 'Datenschutz' },
  { to: '/legal/agb', label: 'AGB' },
  { to: '/legal/haendler-agb', label: 'Händler-AGB' },
  { to: 'mailto:info@clever-neuwagen.de', label: 'Kontakt', external: true },
  { to: '/partner/register', label: 'Für Händler' },
  { to: '/account', label: 'Mein Konto' },
];

export const LEGAL_NAV = [
  { to: '/legal/impressum', label: 'Impressum' },
  { to: '/legal/datenschutz', label: 'Datenschutz' },
  { to: '/legal/agb', label: 'AGB' },
  { to: '/legal/haendler-agb', label: 'Händler-AGB' },
];

/** Rechtliches im Verkäufer-App-Flow (Menü „Mehr“) */
export const DEALER_APP_LEGAL_LINKS = [
  ...LEGAL_NAV,
  { to: 'mailto:info@clever-neuwagen.de', label: 'Kontakt', external: true },
];

export const LEGAL_SEO = {
  impressum: {
    title: 'Impressum',
    description: 'Impressum und Anbieterkennzeichnung von Clever-Neuwagen – Mike Quach, Rudersberg.',
    path: '/legal/impressum',
  },
  datenschutz: {
    title: 'Datenschutz',
    description: 'Datenschutzerklärung von Clever-Neuwagen: Verarbeitung personenbezogener Daten gemäß DSGVO.',
    path: '/legal/datenschutz',
  },
  agb: {
    title: 'AGB',
    description: 'Allgemeine Geschäftsbedingungen für Nutzer von Clever-Neuwagen – Vermittlungsplattform für Neuwagenangebote.',
    path: '/legal/agb',
  },
  haendlerAgb: {
    title: 'Händler-AGB',
    description: 'Nutzungsbedingungen für teilnehmende Händler auf der Plattform Clever-Neuwagen.',
    path: '/legal/haendler-agb',
  },
};
