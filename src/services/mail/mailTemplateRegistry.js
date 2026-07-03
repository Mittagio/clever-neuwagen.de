/**
 * Zentrale Mail-Vorlagen – nur hier pflegen, nicht in UI-Texten.
 */

export const MAIL_TEMPLATE_IDS = {
  CUSTOMER_LOGIN_CODE: 'customer-login-code',
  DEALER_LOGIN_CODE: 'dealer-login-code',
  CUSTOMER_INQUIRY_RECEIVED: 'customer-inquiry-received',
  DEALER_INQUIRY_NOTIFICATION: 'dealer-inquiry-notification',
  /** Alias für Flow-Dokumentation */
  DEALER_NEW_INQUIRY: 'dealer-inquiry-notification',
  CUSTOMER_OFFER_LINK: 'customer-offer-link',
  CUSTOMER_DOCUMENTS_SELF_DISCLOSURE: 'customer-documents-self-disclosure',
  DEALER_ONBOARDING_CONFIRMED: 'dealer-onboarding-confirmed',
  DEALER_APPROVED: 'dealer-approved',
};

/** @type {readonly { id: string, name: string, subject: string, body: string, variables: string[] }[]} */
export const MAIL_TEMPLATES = [
  {
    id: MAIL_TEMPLATE_IDS.CUSTOMER_LOGIN_CODE,
    name: 'Login-Code Kunde',
    subject: 'Ihr Zugangscode für Clever Neuwagen',
    body: `Guten Tag {{customerName}},

Ihr Anmeldecode: {{code}}
Gültig für {{validMinutes}} Minuten.

{{portalUrl}}

Mit freundlichen Grüßen
{{dealerName}}
Clever Neuwagen`,
    variables: ['customerName', 'code', 'validMinutes', 'portalUrl', 'dealerName'],
  },
  {
    id: MAIL_TEMPLATE_IDS.DEALER_LOGIN_CODE,
    name: 'Login-Code Händler',
    subject: 'Ihr Händler-Zugangscode – Clever Neuwagen',
    body: `Guten Tag {{contactName}},

Ihr Anmeldecode für {{dealerName}}: {{code}}
Gültig für {{validMinutes}} Minuten.

{{loginUrl}}

Clever Neuwagen`,
    variables: ['contactName', 'dealerName', 'code', 'validMinutes', 'loginUrl'],
  },
  {
    id: MAIL_TEMPLATE_IDS.CUSTOMER_INQUIRY_RECEIVED,
    name: 'Kundenanfrage eingegangen',
    subject: 'Ihre Anfrage ist eingegangen – {{vehicleTitle}}',
    body: `Guten Tag {{customerName}},

vielen Dank für Ihre Anfrage zum {{vehicleTitle}}.
Wir melden uns in Kürze bei Ihnen.

Ihr Ansprechpartner: {{dealerName}}
{{dealerPhone}}

Clever Neuwagen`,
    variables: ['customerName', 'vehicleTitle', 'dealerName', 'dealerPhone'],
  },
  {
    id: MAIL_TEMPLATE_IDS.DEALER_INQUIRY_NOTIFICATION,
    name: 'Händler: neue Anfrage',
    subject: 'Neue Kundenanfrage – {{vehicleTitle}}',
    body: `Guten Tag {{contactName}},

neue Anfrage für {{dealerName}}:

Kunde: {{customerName}}
Fahrzeug: {{vehicleTitle}}
Kontakt: {{customerEmail}} · {{customerPhone}}

Bitte im Verkaufsassistenten bearbeiten:
{{crmUrl}}

Clever Neuwagen`,
    variables: ['contactName', 'dealerName', 'customerName', 'vehicleTitle', 'customerEmail', 'customerPhone', 'crmUrl'],
  },
  {
    id: MAIL_TEMPLATE_IDS.CUSTOMER_OFFER_LINK,
    name: 'Angebotslink an Kunde',
    subject: 'Ihr Angebot: {{vehicleTitle}}',
    body: `Guten Tag {{customerName}},

anbei Ihr Angebot von {{dealerName}} für den {{vehicleTitle}}.

{{offerUrl}}

{{rateLine}}

Bei Fragen melden Sie sich gerne.

Clever Neuwagen`,
    variables: ['customerName', 'dealerName', 'vehicleTitle', 'offerUrl', 'rateLine'],
  },
  {
    id: MAIL_TEMPLATE_IDS.CUSTOMER_DOCUMENTS_SELF_DISCLOSURE,
    name: 'Dokumente / Selbstauskunft',
    subject: 'Unterlagen & Selbstauskunft – {{vehicleTitle}}',
    body: `Guten Tag {{customerName}},

für Ihr Angebot zum {{vehicleTitle}} benötigen wir noch Unterlagen.

Selbstauskunft: {{selfDisclosureUrl}}
Dokumente hochladen: {{documentsUrl}}

Ihr Ansprechpartner: {{dealerName}}

Clever Neuwagen`,
    variables: ['customerName', 'vehicleTitle', 'selfDisclosureUrl', 'documentsUrl', 'dealerName'],
  },
  {
    id: MAIL_TEMPLATE_IDS.DEALER_ONBOARDING_CONFIRMED,
    name: 'Händler-Onboarding bestätigt',
    subject: 'Ihre Registrierung bei Clever Neuwagen',
    body: `Guten Tag {{contactName}},

vielen Dank für Ihre Registrierung als {{dealerName}}.
Wir prüfen Ihre Angaben und melden uns nach Freigabe.

Status: {{statusLabel}}

Clever Neuwagen`,
    variables: ['contactName', 'dealerName', 'statusLabel'],
  },
  {
    id: MAIL_TEMPLATE_IDS.DEALER_APPROVED,
    name: 'Händler freigeschaltet',
    subject: 'Willkommen bei Clever Neuwagen – Ihr Konto ist aktiv',
    body: `Guten Tag {{contactName}},

Ihr Händlerkonto {{dealerName}} wurde freigeschaltet.

Login: {{loginUrl}}
Marken: {{brands}}

Viel Erfolg mit Clever Neuwagen!`,
    variables: ['contactName', 'dealerName', 'loginUrl', 'brands'],
  },
];

export function getMailTemplate(templateId) {
  return MAIL_TEMPLATES.find((t) => t.id === templateId) ?? null;
}

export function listMailTemplates() {
  return [...MAIL_TEMPLATES];
}

export function assertAllCoreTemplatesPresent() {
  return Object.values(MAIL_TEMPLATE_IDS).every((id) => Boolean(getMailTemplate(id)));
}
