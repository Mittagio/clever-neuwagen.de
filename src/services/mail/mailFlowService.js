/**
 * Produktive Mail-Flows – zentrale Anbindung für Kernfälle.
 */
import { sendTemplatedMail } from './mailOutboxService.js';
import { MAIL_TEMPLATE_IDS } from './mailTemplateRegistry.js';
import { formatOfferRate } from '../../logic/offerService.js';

export const MAIL_FLOW = {
  CUSTOMER_LOGIN_CODE: 'customer-login-code',
  CUSTOMER_OFFER_LINK: 'customer-offer-link',
  CUSTOMER_INQUIRY: 'customer-inquiry',
};

const DEFAULT_VALID_MINUTES = 10;
const DEFAULT_DEALER_NOTIFY_EMAIL = 'info@clever-neuwagen.de';

export function buildCrmLeadUrl(leadId, origin = '') {
  const base = origin
    || (typeof window !== 'undefined' ? window.location.origin : 'https://www.clever-neuwagen.de');
  return `${base}/verkaufsassistent?lead=${encodeURIComponent(leadId)}`;
}

export function resolveInquiryDealerContext(lead = {}, overrides = {}) {
  const dealerName = overrides.dealerName
    ?? lead.dealerName
    ?? lead.dealer?.name
    ?? 'Ihr Autohaus';
  const dealerPhone = overrides.dealerPhone
    ?? lead.dealer?.phone
    ?? lead.dealer?.contact?.phone
    ?? '–';
  const dealerEmail = overrides.dealerEmail
    ?? lead.dealer?.email
    ?? lead.dealer?.contact?.email
    ?? DEFAULT_DEALER_NOTIFY_EMAIL;
  const contactName = overrides.contactName
    ?? lead.ownerName
    ?? lead.dealer?.contact?.name
    ?? 'Team';
  return { dealerName, dealerPhone, dealerEmail, contactName };
}

export function resolveVehicleTitle(lead = {}, fallback = 'Ihr Wunschfahrzeug') {
  return lead.vehicle?.label
    ?? lead.vehicle?.model
    ?? lead.inquiryBrief?.vehicleTitle
    ?? fallback;
}

/**
 * Flow 1: Kunden-Login-Code (Passwortlos / Kundenportal).
 */
export async function sendCustomerLoginCodeMail({
  to,
  customerName = 'Kunde',
  code,
  portalUrl = '',
  dealerName = 'Clever Neuwagen',
  validMinutes = DEFAULT_VALID_MINUTES,
  meta = {},
} = {}) {
  const email = String(to ?? '').trim();
  if (!email || !code) {
    return { ok: false, error: 'E-Mail oder Code fehlt', code: 'INVALID_INPUT' };
  }

  return sendTemplatedMail({
    templateId: MAIL_TEMPLATE_IDS.CUSTOMER_LOGIN_CODE,
    to: email,
    variables: {
      customerName,
      code,
      validMinutes,
      portalUrl: portalUrl || '–',
      dealerName,
    },
    meta: { ...meta, flow: MAIL_FLOW.CUSTOMER_LOGIN_CODE },
  });
}

/**
 * Flow 2: Angebotslink an Kunde.
 */
export async function sendCustomerOfferLinkMail({
  to,
  customerName = 'Kunde',
  dealerName = 'Ihr Autohaus',
  vehicleTitle = 'Ihr Fahrzeug',
  offerUrl,
  rateLine = '–',
  meta = {},
} = {}) {
  const email = String(to ?? '').trim();
  if (!email || !offerUrl) {
    return { ok: false, error: 'E-Mail oder Angebotslink fehlt', code: 'INVALID_INPUT' };
  }

  return sendTemplatedMail({
    templateId: MAIL_TEMPLATE_IDS.CUSTOMER_OFFER_LINK,
    to: email,
    variables: {
      customerName,
      dealerName,
      vehicleTitle,
      offerUrl,
      rateLine,
    },
    meta: { ...meta, flow: MAIL_FLOW.CUSTOMER_OFFER_LINK },
  });
}

export async function sendCustomerOfferLinkMailFromOffer(offer, offerUrl, meta = {}) {
  if (!offer?.customer?.email) {
    return { ok: false, error: 'Keine Kunden-E-Mail', code: 'NO_EMAIL' };
  }
  return sendCustomerOfferLinkMail({
    to: offer.customer.email,
    customerName: offer.customer.name ?? 'Kunde',
    dealerName: offer.dealer?.name ?? offer.dealer?.contact?.name ?? 'Ihr Autohaus',
    vehicleTitle: offer.vehicle?.label ?? 'Ihr Fahrzeug',
    offerUrl,
    rateLine: formatOfferRate(offer.pricing),
    meta: { ...meta, offerCode: offer.code },
  });
}

/**
 * Flow 3: Kundenanfrage – Bestätigung an Kunde + Benachrichtigung an Händler.
 */
export async function sendCustomerInquiryMails({
  lead,
  dealerContext = {},
  origin = '',
} = {}) {
  if (!lead?.id) {
    return { ok: false, error: 'Lead fehlt', code: 'NO_LEAD' };
  }

  const dealer = resolveInquiryDealerContext(lead, dealerContext);
  const vehicleTitle = resolveVehicleTitle(lead);
  const crmUrl = buildCrmLeadUrl(lead.id, origin);
  const customerEmail = lead.contact?.email?.trim();
  const customerName = lead.contact?.name ?? 'Kunde';
  const customerPhone = lead.contact?.phone ?? '–';

  const results = { customer: null, dealer: null };

  if (customerEmail) {
    results.customer = await sendTemplatedMail({
      templateId: MAIL_TEMPLATE_IDS.CUSTOMER_INQUIRY_RECEIVED,
      to: customerEmail,
      variables: {
        customerName,
        vehicleTitle,
        dealerName: dealer.dealerName,
        dealerPhone: dealer.dealerPhone,
      },
      meta: { leadId: lead.id, flow: MAIL_FLOW.CUSTOMER_INQUIRY, role: 'customer' },
    });
  }

  if (dealer.dealerEmail) {
    results.dealer = await sendTemplatedMail({
      templateId: MAIL_TEMPLATE_IDS.DEALER_INQUIRY_NOTIFICATION,
      to: dealer.dealerEmail,
      variables: {
        contactName: dealer.contactName,
        dealerName: dealer.dealerName,
        customerName,
        vehicleTitle,
        customerEmail: customerEmail ?? '–',
        customerPhone,
        crmUrl,
      },
      meta: { leadId: lead.id, flow: MAIL_FLOW.CUSTOMER_INQUIRY, role: 'dealer' },
    });
  }

  const customerOk = !customerEmail || results.customer?.ok === true;
  const dealerOk = !dealer.dealerEmail || results.dealer?.ok === true;

  return {
    ok: customerOk && dealerOk,
    results,
    error: !customerOk
      ? results.customer?.error
      : (!dealerOk ? results.dealer?.error : null),
  };
}

export function applyOfferMailDelivery(offer, mailResult) {
  if (!offer) return offer;
  return {
    ...offer,
    mailDelivery: {
      status: mailResult?.ok ? 'sent' : 'failed',
      templateId: MAIL_TEMPLATE_IDS.CUSTOMER_OFFER_LINK,
      outboxMailId: mailResult?.entry?.id ?? null,
      error: mailResult?.error ?? mailResult?.entry?.error ?? null,
      attemptedAt: new Date().toISOString(),
    },
  };
}

export function applyPortfolioMailDelivery(portfolio, mailResult, templateId = MAIL_TEMPLATE_IDS.CUSTOMER_LOGIN_CODE) {
  if (!portfolio) return portfolio;
  return {
    ...portfolio,
    mailDelivery: {
      status: mailResult?.ok ? 'sent' : 'failed',
      templateId,
      outboxMailId: mailResult?.entry?.id ?? null,
      error: mailResult?.error ?? mailResult?.entry?.error ?? null,
      attemptedAt: new Date().toISOString(),
    },
  };
}
