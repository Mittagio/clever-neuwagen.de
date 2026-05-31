import { DELIVERY_REWARDS } from '../../data/deliveryRewards.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomSuffix(length = 4) {
  return Array.from({ length }, () =>
    CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
  ).join('');
}

/** Partner-Kürzel für Demo-Codes: CN-ARAL-20-XXXX */
function partnerSlug(partner) {
  const name = (partner?.name ?? partner?.id ?? 'PARTNER').toUpperCase();
  return name.replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'PARTNER';
}

export function generateVoucherCode(partner, value = DELIVERY_REWARDS.fuelVoucher) {
  return `CN-${partnerSlug(partner)}-${value}-${randomSuffix(4)}`;
}

export function buildVoucherRecord(partner, overrides = {}) {
  const value = partner?.voucherValue ?? DELIVERY_REWARDS.fuelVoucher;
  return {
    partnerId: partner.id,
    partnerName: partner.name,
    partnerType: partner.type,
    value,
    code: generateVoucherCode(partner, value),
    validityLabel: partner.validityLabel ?? `${partner.validityDays ?? 90} Tage`,
    selectedAt: new Date().toISOString(),
    sentAt: null,
    emailMessageId: null,
    status: 'pending',
    ...overrides,
  };
}

export function markVoucherSent(voucher, emailResult) {
  if (!emailResult?.ok) {
    return {
      ...voucher,
      status: 'error',
      error: emailResult?.error ?? 'Versand fehlgeschlagen',
      lastAttemptAt: new Date().toISOString(),
    };
  }
  return {
    ...voucher,
    status: 'sent',
    sentAt: emailResult.sentAt ?? new Date().toISOString(),
    emailMessageId: emailResult.messageId,
    error: null,
  };
}

export function canSendVoucher(voucher) {
  return voucher?.status !== 'sent';
}

export function isVoucherAlreadySent(voucher) {
  return voucher?.status === 'sent' && !!voucher?.sentAt;
}
