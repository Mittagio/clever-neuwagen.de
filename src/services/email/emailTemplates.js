/** Zentrale E-Mail-Vorlagen – Variablen wie /admin/email */

export const EMAIL_LEGAL_VOUCHER =
  'Der Gutschein wird freiwillig durch Clever-Neuwagen bereitgestellt und steht nicht im Zusammenhang mit dem Kaufvertrag zwischen Kunde und Händler.';

export const EMAIL_TEMPLATE_IDS = {
  delivery: 'delivery',
  voucher: 'voucher',
  offer: 'offer',
  invoice: 'invoice',
};

function replaceVars(text, vars) {
  return Object.entries(vars).reduce(
    (out, [key, val]) => out.replaceAll(`{{${key}}}`, val ?? ''),
    text,
  );
}

export function deliveryConfirmationTemplate(vars) {
  const subject = replaceVars(
    'Haben Sie Ihr {{fahrzeug}} erhalten?',
    vars,
  );
  const body = [
    replaceVars('Hallo {{kunde}},', vars),
    '',
    replaceVars('Ihr {{fahrzeug}} bei {{haendler}} wurde als ausgeliefert markiert.', vars),
    '',
    'Bitte bestätigen Sie kurz, ob Sie Ihr Fahrzeug erhalten haben:',
    '',
    `Ja: ${vars.confirmationUrl}?antwort=ja`,
    `Nein: ${vars.confirmationUrl}?antwort=nein`,
    '',
    'Vielen Dank',
    'Ihr Clever-Neuwagen Team',
  ].join('\n');
  return { subject, body, html: body.replace(/\n/g, '<br>') };
}

export function voucherTemplate(vars) {
  const subject = replaceVars('Ihr {{value}} € Gutschein von Clever-Neuwagen', vars);
  const body = [
    replaceVars('Hallo {{kunde}},', vars),
    '',
    'vielen Dank für die Bestätigung Ihrer Auslieferung!',
    '',
    replaceVars('Ihr Gutschein für {{fahrzeug}}:', vars),
    '',
    replaceVars('Partner: {{partner}}', vars),
    replaceVars('Wert: {{value}} €', vars),
    replaceVars('Code: {{voucherCode}}', vars),
    replaceVars('Gültig: {{validity}}', vars),
    '',
    EMAIL_LEGAL_VOUCHER,
    '',
    'Freundliche Grüße',
    'Clever-Neuwagen',
  ].join('\n');
  return { subject, body, html: body.replace(/\n/g, '<br>') };
}

export function offerTemplate(vars) {
  const subject = replaceVars('Ihr Angebot: {{fahrzeug}}', vars);
  const body = [
    replaceVars('Hallo {{kunde}},', vars),
    '',
    replaceVars('hier ist Ihr Angebot für {{fahrzeug}} bei {{haendler}}.', vars),
    replaceVars('Rate: {{rate}}', vars),
    '',
    replaceVars('Angebot ansehen: {{angebot}}', vars),
    '',
    'Freundliche Grüße',
    replaceVars('{{dealerName}}', vars),
  ].join('\n');
  return { subject, body, html: body.replace(/\n/g, '<br>') };
}

export function invoiceTemplate(vars) {
  const subject = replaceVars('Rechnung {{invoiceNumber}} – Clever-Neuwagen', vars);
  const body = [
    replaceVars('Hallo {{dealerName}},', vars),
    '',
    replaceVars('anbei Ihre Rechnung {{invoiceNumber}} für {{month}}.', vars),
    replaceVars('Betrag: {{amount}}', vars),
    '',
    'Freundliche Grüße',
    'Clever-Neuwagen Abrechnung',
  ].join('\n');
  return { subject, body, html: body.replace(/\n/g, '<br>') };
}

export function buildTemplateVars({ lead, customer, dealer, confirmationUrl, voucher, partner, offer, invoice }) {
  const c = customer ?? lead?.contact ?? {};
  const v = lead?.vehicle ?? {};
  return {
    kunde: c.name?.trim() || 'Kunde',
    fahrzeug: v.label ?? 'Ihr Fahrzeug',
    haendler: dealer?.name ?? 'Ihr Autohaus',
    dealerName: dealer?.name ?? 'Ihr Autohaus',
    angebot: offer?.url ?? '',
    rate: offer?.rate ?? (lead?.currentRate ? `${lead.currentRate} €/Monat` : ''),
    confirmationUrl: confirmationUrl ?? '',
    voucherCode: voucher?.code ?? '',
    partner: partner?.name ?? voucher?.partnerName ?? '',
    value: voucher?.value ?? 20,
    validity: voucher?.validityLabel ?? partner?.validityLabel ?? '',
    invoiceNumber: invoice?.invoiceNumber ?? '',
    month: invoice?.month ?? '',
    amount: invoice?.amount != null ? `${invoice.amount} €` : '',
  };
}
