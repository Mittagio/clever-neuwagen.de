export const BILLING_PROVISION_EVENT = 'cn:billing-provision-released';

export function emitProvisionReleased(payload) {
  window.dispatchEvent(
    new CustomEvent(BILLING_PROVISION_EVENT, { detail: payload }),
  );
}

export function buildProvisionReleasedEvent(lead, amount = 49) {
  return {
    type: 'success_fee_released',
    leadId: lead.id,
    dealerId: lead.dealerId ?? 'autohaus-trinkle',
    amount,
    provisionReleasedAt: new Date().toISOString(),
    customerName: lead.contact?.name ?? 'Kunde',
    vehicle: lead.vehicle?.label ?? 'Fahrzeug',
  };
}
