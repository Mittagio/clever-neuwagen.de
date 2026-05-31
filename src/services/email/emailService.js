import {
  deliveryConfirmationTemplate,
  voucherTemplate,
  offerTemplate,
  invoiceTemplate,
  buildTemplateVars,
} from './emailTemplates.js';
import { sendMockEmail } from './emailAdapters/mockEmailAdapter.js';
import { sendResendEmail } from './emailAdapters/resendEmailAdapter.js';

function getProvider() {
  return import.meta.env.VITE_EMAIL_PROVIDER ?? 'mock';
}

async function dispatchEmail(payload) {
  const provider = getProvider();
  if (provider === 'resend') {
    return sendResendEmail(payload);
  }
  return sendMockEmail(payload);
}

function resolveCustomerEmail(customer, lead) {
  return customer?.email?.trim() || lead?.contact?.email?.trim() || '';
}

function resolveDealer(dealer, lead) {
  return dealer ?? { id: lead?.dealerId ?? 'autohaus-trinkle', name: 'Autohaus' };
}

export async function sendDeliveryConfirmationEmail({ lead, customer, dealer, confirmationUrl }) {
  const email = resolveCustomerEmail(customer, lead);
  if (!email) {
    return { ok: false, error: 'Keine E-Mail-Adresse beim Kunden', code: 'NO_EMAIL' };
  }

  const vars = buildTemplateVars({ lead, customer, dealer: resolveDealer(dealer, lead), confirmationUrl });
  const { subject, body, html } = deliveryConfirmationTemplate(vars);

  const result = await dispatchEmail({
    to: email,
    subject,
    body,
    html,
    meta: { type: 'delivery_confirmation', leadId: lead?.id },
  });

  return { ...result, to: email, subject };
}

export async function sendVoucherEmail({ lead, customer, dealer, voucher, partner }) {
  const email = resolveCustomerEmail(customer, lead);
  if (!email) {
    return { ok: false, error: 'Keine E-Mail-Adresse beim Kunden', code: 'NO_EMAIL' };
  }

  const vars = buildTemplateVars({
    lead,
    customer,
    dealer: resolveDealer(dealer, lead),
    voucher,
    partner,
  });
  const { subject, body, html } = voucherTemplate(vars);

  const result = await dispatchEmail({
    to: email,
    subject,
    body,
    html,
    meta: { type: 'voucher', leadId: lead?.id, voucherCode: voucher?.code },
  });

  return { ...result, to: email, subject };
}

export async function sendOfferEmail({ offer, customer, dealer }) {
  const email = customer?.email?.trim();
  if (!email) {
    return { ok: false, error: 'Keine E-Mail-Adresse', code: 'NO_EMAIL' };
  }

  const vars = buildTemplateVars({ customer, dealer, offer });
  const { subject, body, html } = offerTemplate(vars);

  return dispatchEmail({
    to: email,
    subject,
    body,
    html,
    meta: { type: 'offer', offerId: offer?.id },
  });
}

export async function sendInvoiceEmail({ invoice, dealer }) {
  const email = dealer?.billingEmail ?? dealer?.email;
  if (!email) {
    return { ok: false, error: 'Keine Händler-E-Mail', code: 'NO_EMAIL' };
  }

  const vars = buildTemplateVars({ dealer, invoice });
  const { subject, body, html } = invoiceTemplate(vars);

  return dispatchEmail({
    to: email,
    subject,
    body,
    html,
    meta: { type: 'invoice', invoiceId: invoice?.id },
  });
}

export { getProvider as getEmailProvider };
