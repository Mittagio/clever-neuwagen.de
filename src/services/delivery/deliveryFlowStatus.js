/** Auslieferungs-Flow Status für Lead, Admin Deliveries, Pilot */

export const DELIVERY_FLOW_STEPS = [
  { id: 'link_sent', label: 'Auslieferungslink gesendet' },
  { id: 'confirmed', label: 'Kunde hat Fahrzeug bestätigt' },
  { id: 'voucher_selected', label: 'Gutschein gewählt' },
  { id: 'voucher_sent', label: 'Gutschein versendet' },
  { id: 'provision', label: 'Provision freigegeben' },
  { id: 'billing', label: 'Abrechnung' },
];

export function getDeliveryFlowSteps(dc, invoiceLinked = false) {
  if (!dc) {
    return DELIVERY_FLOW_STEPS.map((s) => ({ ...s, done: false, state: 'pending' }));
  }

  const linkSent = !!dc.sentAt && dc.status !== 'error';
  const linkError = dc.status === 'error' || !!dc.emailError;
  const confirmed = dc.response === 'yes' || dc.status === 'confirmed';
  const voucherSelected = !!dc.rewards?.selectedPartnerId || !!dc.voucher?.partnerId;
  const voucherSent = dc.voucher?.status === 'sent' || !!dc.voucherSentAt;
  const voucherError = dc.voucher?.status === 'error';
  const provisionReleased = !!dc.provisionReleased;
  const billable = dc.billingStatus === 'billable' || provisionReleased;
  const billed = dc.billingStatus === 'invoiced' || invoiceLinked;

  return [
    {
      id: 'link_sent',
      label: 'Auslieferungslink gesendet',
      done: linkSent && !linkError,
      state: linkError ? 'error' : linkSent ? 'done' : 'pending',
      hint: linkError ? dc.emailError : dc.sentAt ? new Date(dc.sentAt).toLocaleDateString('de-DE') : null,
    },
    {
      id: 'confirmed',
      label: 'Kunde hat Fahrzeug bestätigt',
      done: confirmed,
      state: dc.response === 'no' ? 'declined' : confirmed ? 'done' : 'pending',
    },
    {
      id: 'voucher_selected',
      label: 'Gutschein gewählt',
      done: voucherSelected,
      state: voucherSelected ? 'done' : confirmed ? 'pending' : 'pending',
      hint: dc.voucher?.partnerName ?? null,
    },
    {
      id: 'voucher_sent',
      label: 'Gutschein versendet',
      done: voucherSent,
      state: voucherError ? 'error' : voucherSent ? 'done' : voucherSelected ? 'pending' : 'pending',
      hint: voucherError ? dc.voucher?.error : dc.voucher?.code ?? null,
    },
    {
      id: 'provision',
      label: 'Provision freigegeben',
      done: provisionReleased,
      state: provisionReleased ? 'done' : 'pending',
      hint: dc.provisionAmount ? `${dc.provisionAmount} €` : null,
    },
    {
      id: 'billing',
      label: billed ? 'Abrechnung erledigt' : 'Abrechnung offen',
      done: billed,
      state: billable && !billed ? 'billable' : billed ? 'done' : 'pending',
    },
  ];
}

export function getVoucherPilotStatus(leads, deliveries) {
  const withDelivery = leads.filter((l) => l.deliveryConfirmation?.sentAt);
  if (!withDelivery.length) {
    return { status: 'offen', label: 'Noch keine Auslieferung', done: false };
  }

  const anySent = withDelivery.some((l) => l.deliveryConfirmation?.voucher?.status === 'sent');
  const anySelected = withDelivery.some((l) => l.deliveryConfirmation?.rewards?.selectedPartnerId);
  const anyProvision = deliveries.some((d) => d.status === 'provisionReleased');

  if (anyProvision || anySent) {
    return { status: 'versendet', label: 'Gutschein versendet · Provision freigegeben', done: true };
  }
  if (anySelected) {
    return { status: 'gewählt', label: 'Gutschein gewählt · Versand ausstehend', done: false };
  }
  return { status: 'offen', label: 'Warte auf Kundenbestätigung', done: false };
}
