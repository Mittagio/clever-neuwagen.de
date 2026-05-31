const LAUNCH_STORAGE_KEY = 'clever-neuwagen-launch-admin';
export const AUDIT_EVENT = 'cn:audit-updated';

export function appendAuditEntry(entry) {
  try {
    const raw = localStorage.getItem(LAUNCH_STORAGE_KEY);
    const state = raw ? JSON.parse(raw) : { auditLog: [] };
    const auditLog = [
      {
        id: entry.id ?? `aud-${Date.now()}`,
        actor: entry.actor ?? 'System',
        actorRole: entry.actorRole ?? 'system',
        action: entry.action,
        target: entry.target ?? '',
        type: entry.type ?? 'system',
        createdAt: entry.createdAt ?? new Date().toISOString(),
      },
      ...(state.auditLog ?? []),
    ];
    localStorage.setItem(LAUNCH_STORAGE_KEY, JSON.stringify({ ...state, auditLog }));
    window.dispatchEvent(new CustomEvent(AUDIT_EVENT));
    return auditLog[0];
  } catch {
    return null;
  }
}

export function auditDeliveryEmailSent(lead, email) {
  return appendAuditEntry({
    type: 'delivery_confirmation_email_sent',
    actor: 'System',
    action: `Auslieferungsbestätigung per E-Mail an ${email} gesendet`,
    target: lead?.id ?? '',
  });
}

export function auditVoucherEmailSent(lead, partnerName) {
  return appendAuditEntry({
    type: 'voucher_email_sent',
    actor: 'System',
    action: `20 € Gutschein (${partnerName}) per E-Mail versendet`,
    target: lead?.id ?? '',
  });
}

export function auditProvisionReleased(lead, amount) {
  return appendAuditEntry({
    type: 'success_fee_released',
    actor: 'System',
    action: `Provision ${amount} € freigegeben`,
    target: lead?.id ?? '',
  });
}
