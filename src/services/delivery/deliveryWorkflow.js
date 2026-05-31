import { BILLING_DEALERS } from '../../data/demoBilling.js';
import { DELIVERY_REWARDS } from '../../data/deliveryRewards.js';
import { BILLING_CONFIG } from '../../data/billingConfig.js';
import {
  generateDeliveryToken,
  buildDeliveryConfirmUrl,
  isDeliveryTokenExpired,
} from '../../logic/deliveryConfirmation.js';
import { buildGiftOptionsForLead, applyVoucherSelection } from '../../logic/partnerAssignment.js';
import { sendDeliveryConfirmationEmail, sendVoucherEmail } from '../email/emailService.js';
import {
  buildVoucherRecord,
  markVoucherSent,
  isVoucherAlreadySent,
} from '../voucher/voucherService.js';
import {
  auditDeliveryEmailSent,
  auditVoucherEmailSent,
  auditProvisionReleased,
} from '../audit/auditService.js';
import {
  emitProvisionReleased,
  buildProvisionReleasedEvent,
} from '../billing/billingEventService.js';

export function resolveDealerForLead(lead) {
  const id = lead?.dealerId ?? 'autohaus-trinkle';
  return BILLING_DEALERS.find((d) => d.id === id) ?? { id, name: 'Autohaus' };
}

export function validateDeliveryToken(lead) {
  const dc = lead?.deliveryConfirmation;
  if (!dc?.token) {
    return { valid: false, code: 'INVALID_TOKEN', message: 'Link ungültig' };
  }
  if (isDeliveryTokenExpired(dc)) {
    return { valid: false, code: 'EXPIRED_TOKEN', message: 'Link abgelaufen' };
  }
  return { valid: true };
}

/** Flow 1: Lead → Ausgeliefert → Bestätigungs-E-Mail */
export async function runDeliveryConfirmationFlow(lead) {
  const dc = lead.deliveryConfirmation;
  if (dc?.sentAt && dc?.status === 'sent' && !dc?.emailError) {
    return { ok: false, code: 'ALREADY_SENT', lead };
  }

  const email = lead.contact?.email?.trim();
  if (!email) {
    const patch = {
      deliveryConfirmation: {
        ...(dc ?? {}),
        status: 'error',
        emailError: 'Keine E-Mail-Adresse beim Kunden',
        errorAt: new Date().toISOString(),
      },
    };
    return { ok: false, code: 'NO_EMAIL', leadPatch: patch, historyText: 'Fehler: Keine Kunden-E-Mail für Auslieferungsbestätigung' };
  }

  const token = dc?.token ?? generateDeliveryToken();
  const confirmationUrl = buildDeliveryConfirmUrl(token);
  const dealer = resolveDealerForLead(lead);

  const emailResult = await sendDeliveryConfirmationEmail({
    lead,
    customer: lead.contact,
    dealer,
    confirmationUrl,
  });

  const now = new Date().toISOString();

  if (!emailResult.ok) {
    return {
      ok: false,
      code: 'EMAIL_FAILED',
      leadPatch: {
        deliveryConfirmation: {
          ...(dc ?? {}),
          token,
          confirmationUrl,
          email,
          status: 'error',
          emailError: emailResult.error ?? 'Mailversand fehlgeschlagen',
          errorAt: now,
        },
      },
      historyText: `Fehler beim E-Mail-Versand: ${emailResult.error}`,
    };
  }

  auditDeliveryEmailSent(lead, email);

  return {
    ok: true,
    leadPatch: {
      deliveryConfirmation: {
        token,
        sentAt: emailResult.sentAt ?? now,
        emailMessageId: emailResult.messageId,
        confirmationUrl,
        email,
        status: 'sent',
        response: dc?.response ?? null,
        respondedAt: dc?.respondedAt ?? null,
        confirmedAt: dc?.confirmedAt ?? null,
        rewards: dc?.rewards ?? null,
        voucher: dc?.voucher ?? null,
        emailError: null,
      },
    },
    historyText: `Auslieferungsbestätigung per E-Mail an ${email} gesendet.`,
  };
}

/** Flow 2: Kunde bestätigt Ja/Nein */
export function runDeliveryConfirmResponse(lead, response, partners) {
  const validation = validateDeliveryToken(lead);
  if (!validation.valid) {
    return { ok: false, code: validation.code, message: validation.message };
  }

  const dc = lead.deliveryConfirmation;
  if (dc?.response) {
    return { ok: false, code: 'ALREADY_RESPONDED', lead };
  }

  const now = new Date().toISOString();

  if (response === 'yes') {
    const rewards = buildGiftOptionsForLead(lead, partners);
    return {
      ok: true,
      leadPatch: {
        status: 'auslieferung_bestaetigt',
        deliveryConfirmation: {
          ...dc,
          response: 'yes',
          respondedAt: now,
          confirmedAt: now,
          status: 'confirmed',
          rewards,
        },
      },
      historyText: 'Auslieferung bestätigt (Kunde: Ja) · Gutschein-Auswahl offen',
    };
  }

  return {
    ok: true,
    leadPatch: {
      deliveryConfirmation: {
        ...dc,
        response: 'no',
        respondedAt: now,
        status: 'declined',
        rewards: null,
      },
    },
    historyText: 'Kunde: Fahrzeug noch nicht erhalten (Nein)',
  };
}

/** Flow 3: Gutschein wählen + E-Mail + Provision */
export async function runVoucherSelectionFlow(lead, partnerId, partners) {
  const validation = validateDeliveryToken(lead);
  if (!validation.valid) {
    return { ok: false, code: validation.code, message: validation.message };
  }

  const dc = lead.deliveryConfirmation;
  if (dc?.response !== 'yes') {
    return { ok: false, code: 'NOT_CONFIRMED', message: 'Auslieferung nicht bestätigt' };
  }

  if (isVoucherAlreadySent(dc.voucher)) {
    return { ok: false, code: 'VOUCHER_ALREADY_SENT', lead };
  }

  const partner = partners.find((p) => p.id === partnerId);
  if (!partner) {
    return { ok: false, code: 'PARTNER_MISSING', message: 'Gutscheinpartner nicht gefunden' };
  }

  const rewards = applyVoucherSelection(dc.rewards, partnerId, partners);
  const voucher = buildVoucherRecord(partner);
  const dealer = resolveDealerForLead(lead);

  const emailResult = await sendVoucherEmail({
    lead,
    customer: lead.contact,
    dealer,
    voucher,
    partner,
  });

  const sentVoucher = markVoucherSent(voucher, emailResult);
  const now = new Date().toISOString();
  const provisionAmount = dc.rewards?.provision ?? DELIVERY_REWARDS.provision ?? BILLING_CONFIG.successProvision;

  if (!emailResult.ok) {
    return {
      ok: false,
      code: 'VOUCHER_EMAIL_FAILED',
      leadPatch: {
        deliveryConfirmation: {
          ...dc,
          rewards,
          voucher: sentVoucher,
        },
      },
      historyText: `Gutschein gewählt, aber E-Mail fehlgeschlagen: ${emailResult.error}`,
    };
  }

  auditVoucherEmailSent(lead, partner.name);
  auditProvisionReleased(lead, provisionAmount);
  const billingEvent = buildProvisionReleasedEvent(lead, provisionAmount);
  emitProvisionReleased(billingEvent);

  return {
    ok: true,
    leadPatch: {
      deliveryConfirmation: {
        ...dc,
        rewards,
        voucher: sentVoucher,
        voucherSentAt: sentVoucher.sentAt,
        provisionReleased: true,
        provisionReleasedAt: now,
        provisionAmount,
        billingStatus: 'billable',
      },
    },
    historyText: `20 € Gutschein ${partner.name} per E-Mail versendet (Code: ${sentVoucher.code}). Provision ${provisionAmount} € freigegeben.`,
    billingEvent,
  };
}

/** Retry: Bestätigungs-E-Mail */
export async function retryDeliveryConfirmationEmail(lead) {
  const dc = lead.deliveryConfirmation ?? {};
  const cleared = {
    ...lead,
    deliveryConfirmation: { ...dc, emailError: null, status: dc.response ? dc.status : 'pending' },
  };
  return runDeliveryConfirmationFlow(cleared);
}

/** Retry: Gutschein-E-Mail (Partner muss bereits gewählt sein) */
export async function retryVoucherEmail(lead, partners) {
  const dc = lead.deliveryConfirmation;
  const partnerId = dc?.voucher?.partnerId ?? dc?.rewards?.selectedPartnerId;
  if (!partnerId) {
    return { ok: false, code: 'NO_PARTNER', message: 'Kein Gutschein gewählt' };
  }
  if (isVoucherAlreadySent(dc.voucher)) {
    return { ok: false, code: 'VOUCHER_ALREADY_SENT' };
  }

  const partner = partners.find((p) => p.id === partnerId);
  if (!partner) {
    return { ok: false, code: 'PARTNER_MISSING' };
  }

  const voucher = buildVoucherRecord(partner, {
    partnerId,
    partnerName: partner.name,
    selectedAt: dc.voucher?.selectedAt ?? new Date().toISOString(),
  });

  const dealer = resolveDealerForLead(lead);
  const emailResult = await sendVoucherEmail({
    lead,
    customer: lead.contact,
    dealer,
    voucher,
    partner,
  });

  const sentVoucher = markVoucherSent(voucher, emailResult);
  const now = new Date().toISOString();
  const provisionAmount = dc.provisionAmount ?? dc.rewards?.provision ?? BILLING_CONFIG.successProvision;

  if (!emailResult.ok) {
    return {
      ok: false,
      code: 'VOUCHER_EMAIL_FAILED',
      leadPatch: {
        deliveryConfirmation: { ...dc, voucher: sentVoucher },
      },
      historyText: `Gutschein-E-Mail erneut fehlgeschlagen: ${emailResult.error}`,
    };
  }

  auditVoucherEmailSent(lead, partner.name);
  if (!dc.provisionReleased) {
    auditProvisionReleased(lead, provisionAmount);
    emitProvisionReleased(buildProvisionReleasedEvent(lead, provisionAmount));
  }

  return {
    ok: true,
    leadPatch: {
      deliveryConfirmation: {
        ...dc,
        voucher: sentVoucher,
        voucherSentAt: sentVoucher.sentAt,
        provisionReleased: true,
        provisionReleasedAt: dc.provisionReleasedAt ?? now,
        provisionAmount,
        billingStatus: 'billable',
      },
    },
    historyText: `Gutschein ${partner.name} erneut per E-Mail versendet.`,
  };
}
