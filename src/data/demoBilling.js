import { BILLING_CONFIG } from './billingConfig.js';

/** Händler-Stamm für Abrechnung (Demo + Live-Erweiterung) */
export const BILLING_DEALERS = [
  { id: 'autohaus-trinkle', name: 'Autohaus Trinkle', city: 'Heilbronn', status: 'active' },
  { id: 'autohaus-mueller', name: 'Autohaus Müller', city: 'Stuttgart', status: 'active' },
  { id: 'autohaus-stuttgart', name: 'Autohaus Stuttgart', city: 'Stuttgart', status: 'active' },
  { id: 'autohaus-ulm', name: 'Autohaus Ulm', city: 'Ulm', status: 'active' },
  { id: 'autohaus-heidelberg', name: 'Autohaus Heidelberg', city: 'Heidelberg', status: 'active' },
  { id: 'autohaus-karlsruhe', name: 'Autohaus Karlsruhe', city: 'Karlsruhe', status: 'active' },
  { id: 'autohaus-mannheim', name: 'Autohaus Mannheim', city: 'Mannheim', status: 'active' },
  { id: 'autohaus-ludwigsburg', name: 'Autohaus Ludwigsburg', city: 'Ludwigsburg', status: 'active' },
  { id: 'autohaus-reutlingen', name: 'Autohaus Reutlingen', city: 'Reutlingen', status: 'active' },
  { id: 'autohaus-heilbronn-sued', name: 'Autohaus Heilbronn Süd', city: 'Heilbronn', status: 'active' },
  { id: 'autohaus-schwaebisch', name: 'Autohaus Schwäbisch Gmünd', city: 'Schwäbisch Gmünd', status: 'active' },
  { id: 'autohaus-pforzheim', name: 'Autohaus Pforzheim', city: 'Pforzheim', status: 'paused' },
];

const MONTH = BILLING_CONFIG.defaultMonth;
const PROV = BILLING_CONFIG.successProvision;

/** Demo-Auslieferungen Mai 2026 */
export const DEMO_DELIVERY_CONFIRMATIONS = [
  {
    id: 'del-001',
    leadId: 'billing-lead-001',
    dealerId: 'autohaus-trinkle',
    customerId: 'cust-mueller',
    customerName: 'Herr Müller',
    vehicle: 'Kia EV3 Earth',
    deliveryDate: '2026-08-15',
    confirmed: false,
    confirmedAt: null,
    provisionAmount: PROV,
    month: MONTH,
    status: 'pending',
  },
  {
    id: 'del-002',
    leadId: 'billing-lead-002',
    dealerId: 'autohaus-trinkle',
    customerName: 'Sarah Klein',
    customerId: 'cust-klein',
    vehicle: 'Kia Sportage Vision',
    deliveryDate: '2026-05-08',
    confirmed: true,
    confirmedAt: '2026-05-09T10:00:00.000Z',
    provisionAmount: PROV,
    month: MONTH,
    status: 'provisionReleased',
  },
  {
    id: 'del-003',
    leadId: 'billing-lead-003',
    dealerId: 'autohaus-trinkle',
    customerName: 'Thomas Weber',
    customerId: 'cust-weber',
    vehicle: 'Kia EV3 Earth',
    deliveryDate: '2026-05-12',
    confirmed: true,
    confirmedAt: '2026-05-13T14:30:00.000Z',
    provisionAmount: PROV,
    month: MONTH,
    status: 'provisionReleased',
  },
  {
    id: 'del-004',
    leadId: 'billing-lead-004',
    dealerId: 'autohaus-trinkle',
    customerName: 'Lisa Hoffmann',
    customerId: 'cust-hoffmann',
    vehicle: 'Kia Sportage GT-Line',
    deliveryDate: '2026-05-18',
    confirmed: true,
    confirmedAt: '2026-05-19T09:15:00.000Z',
    provisionAmount: PROV,
    month: MONTH,
    status: 'provisionReleased',
  },
  {
    id: 'del-005',
    leadId: 'billing-lead-005',
    dealerId: 'autohaus-trinkle',
    customerName: 'Markus Braun',
    customerId: 'cust-braun',
    vehicle: 'Kia EV4 Earth',
    deliveryDate: '2026-05-22',
    confirmed: true,
    confirmedAt: '2026-05-23T11:00:00.000Z',
    provisionAmount: PROV,
    month: MONTH,
    status: 'provisionReleased',
  },
  {
    id: 'del-006',
    leadId: 'billing-lead-006',
    dealerId: 'autohaus-mueller',
    customerName: 'Anna Schmidt',
    customerId: 'cust-schmidt',
    vehicle: 'Kia Sportage Vision',
    deliveryDate: '2026-05-05',
    confirmed: true,
    confirmedAt: '2026-05-06T16:00:00.000Z',
    provisionAmount: PROV,
    month: MONTH,
    status: 'provisionReleased',
  },
  {
    id: 'del-007',
    leadId: 'billing-lead-007',
    dealerId: 'autohaus-mueller',
    customerName: 'Peter Wagner',
    customerId: 'cust-wagner',
    vehicle: 'Kia EV3 Long Range',
    deliveryDate: '2026-05-14',
    confirmed: true,
    confirmedAt: '2026-05-15T08:45:00.000Z',
    provisionAmount: PROV,
    month: MONTH,
    status: 'provisionReleased',
  },
];

/** Weitere Demo-Verkäufe für Dashboard-KPIs (38 gesamt) */
export function buildDemoBulkDeliveries() {
  const dealers = BILLING_DEALERS.filter((d) => d.status === 'active' && d.id !== 'autohaus-trinkle' && d.id !== 'autohaus-mueller');
  const vehicles = ['Kia Sportage Vision', 'Kia EV3 Earth', 'Kia EV4 Earth', 'Kia Sportage GT-Line'];
  const items = [];
  let idx = 8;

  for (const dealer of dealers) {
    const count = dealer.id === 'autohaus-stuttgart' ? 4 : 3;
    for (let i = 0; i < count; i += 1) {
      items.push({
        id: `del-${String(idx).padStart(3, '0')}`,
        leadId: `billing-lead-${String(idx).padStart(3, '0')}`,
        dealerId: dealer.id,
        customerName: `Kunde ${idx}`,
        customerId: `cust-${idx}`,
        vehicle: vehicles[idx % vehicles.length],
        deliveryDate: `2026-05-${String(5 + (idx % 20)).padStart(2, '0')}`,
        confirmed: true,
        confirmedAt: `2026-05-${String(6 + (idx % 20)).padStart(2, '0')}T12:00:00.000Z`,
        provisionAmount: PROV,
        month: MONTH,
        status: 'provisionReleased',
      });
      idx += 1;
    }
  }
  return items;
}

/** Demo-Rechnungen Mai 2026 */
export const DEMO_INVOICES = [
  {
    id: 'inv-001',
    invoiceNumber: 'CN-INV-2026-00001',
    dealerId: 'autohaus-trinkle',
    month: MONTH,
    platformFee: BILLING_CONFIG.platformFeeMonthly,
    successFees: 196,
    amount: 395,
    vat: 75.05,
    status: 'open',
    createdAt: '2026-05-25T08:00:00.000Z',
    deliveryIds: ['del-002', 'del-003', 'del-004', 'del-005'],
  },
  {
    id: 'inv-002',
    invoiceNumber: 'CN-INV-2026-00002',
    dealerId: 'autohaus-mueller',
    month: MONTH,
    platformFee: BILLING_CONFIG.platformFeeMonthly,
    successFees: 98,
    amount: 297,
    vat: 56.43,
    status: 'paid',
    createdAt: '2026-05-25T08:00:00.000Z',
    paidAt: '2026-05-28T14:00:00.000Z',
    deliveryIds: ['del-006', 'del-007'],
  },
];

export const DEMO_INVOICE_COUNTER = 2;
