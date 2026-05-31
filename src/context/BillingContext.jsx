import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLeads } from './LeadsContext.jsx';
import { BILLING_CONFIG } from '../data/billingConfig.js';
import {
  BILLING_DEALERS,
  DEMO_DELIVERY_CONFIRMATIONS,
  DEMO_INVOICES,
  DEMO_INVOICE_COUNTER,
  buildDemoBulkDeliveries,
} from '../data/demoBilling.js';
import {
  mergeDeliveries,
  computeDashboardKpis,
  computeAllDealerSummaries,
  computeDealerMonthSummary,
  computeBillingAnalytics,
  buildInvoiceForDealer,
  generateInvoiceNumber,
} from '../logic/billingEngine.js';
import { BILLING_PROVISION_EVENT } from '../services/billing/billingEventService.js';

const STORAGE_KEY = 'clever-neuwagen-billing';

function loadBillingState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* Fallback */
  }
  return {
    deliveries: [...DEMO_DELIVERY_CONFIRMATIONS, ...buildDemoBulkDeliveries()],
    invoices: [...DEMO_INVOICES],
    invoiceCounter: DEMO_INVOICE_COUNTER,
    selectedMonth: BILLING_CONFIG.defaultMonth,
    billingEvents: [],
  };
}

function saveBillingState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const BillingContext = createContext(null);

export function BillingProvider({ children }) {
  const { leads } = useLeads();
  const [state, setState] = useState(loadBillingState);

  useEffect(() => {
    saveBillingState(state);
  }, [state]);

  useEffect(() => {
    function onProvisionReleased(event) {
      const payload = event.detail;
      if (!payload) return;
      setState((prev) => ({
        ...prev,
        billingEvents: [payload, ...(prev.billingEvents ?? [])].slice(0, 500),
      }));
    }
    window.addEventListener(BILLING_PROVISION_EVENT, onProvisionReleased);
    return () => window.removeEventListener(BILLING_PROVISION_EVENT, onProvisionReleased);
  }, []);

  const deliveries = useMemo(
    () => mergeDeliveries(state.deliveries, leads),
    [state.deliveries, leads],
  );

  const invoices = state.invoices;
  const billingEvents = state.billingEvents ?? [];
  const selectedMonth = state.selectedMonth ?? BILLING_CONFIG.defaultMonth;

  const api = useMemo(() => ({
    dealers: BILLING_DEALERS,
    deliveries,
    invoices,
    billingEvents,
    selectedMonth,

    setSelectedMonth(month) {
      setState((prev) => ({ ...prev, selectedMonth: month }));
    },

    getDashboard(month = selectedMonth) {
      return computeDashboardKpis(month, deliveries, invoices);
    },

    getDealerSummaries(month = selectedMonth) {
      return computeAllDealerSummaries(month, deliveries, invoices);
    },

    getDealerDetail(dealerId, month = selectedMonth) {
      return computeDealerMonthSummary(dealerId, month, deliveries, invoices);
    },

    getAnalytics(month = selectedMonth) {
      return computeBillingAnalytics(deliveries, invoices, month);
    },

    getInvoice(id) {
      return invoices.find((inv) => inv.id === id) ?? null;
    },

    getInvoicesForDealer(dealerId) {
      return invoices
        .filter((inv) => inv.dealerId === dealerId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    generateInvoice(dealerId, month = selectedMonth) {
      const existing = invoices.find((inv) => inv.dealerId === dealerId && inv.month === month);
      if (existing) return existing;

      let created = null;
      setState((prev) => {
        const invoice = buildInvoiceForDealer(
          dealerId,
          month,
          mergeDeliveries(prev.deliveries, leads),
          prev.invoiceCounter,
        );
        if (!invoice) return prev;
        created = invoice;
        return {
          ...prev,
          invoices: [...prev.invoices, invoice],
          invoiceCounter: prev.invoiceCounter + 1,
        };
      });
      return created;
    },

    generateAllInvoices(month = selectedMonth) {
      const created = [];
      setState((prev) => {
        let counter = prev.invoiceCounter;
        const merged = mergeDeliveries(prev.deliveries, leads);
        const nextInvoices = [...prev.invoices];

        for (const dealer of BILLING_DEALERS) {
          if (dealer.status !== 'active') continue;
          const exists = nextInvoices.some((inv) => inv.dealerId === dealer.id && inv.month === month);
          if (exists) continue;

          const invoice = buildInvoiceForDealer(dealer.id, month, merged, counter);
          if (!invoice) continue;
          counter += 1;
          nextInvoices.push(invoice);
          created.push(invoice);
        }

        return { ...prev, invoices: nextInvoices, invoiceCounter: counter };
      });
      return created;
    },

    updateInvoiceStatus(invoiceId, status) {
      setState((prev) => ({
        ...prev,
        invoices: prev.invoices.map((inv) =>
          inv.id === invoiceId
            ? {
                ...inv,
                status,
                paidAt: status === 'paid' ? new Date().toISOString() : inv.paidAt,
              }
            : inv,
        ),
      }));
    },

    adminConfirmDelivery(deliveryId) {
      setState((prev) => ({
        ...prev,
        deliveries: prev.deliveries.map((d) =>
          d.id === deliveryId
            ? {
                ...d,
                confirmed: true,
                confirmedAt: new Date().toISOString(),
                status: 'provisionReleased',
              }
            : d,
        ),
      }));
    },

    resetDemoData() {
      setState({
        deliveries: [...DEMO_DELIVERY_CONFIRMATIONS, ...buildDemoBulkDeliveries()],
        invoices: [...DEMO_INVOICES],
        invoiceCounter: DEMO_INVOICE_COUNTER,
        selectedMonth: BILLING_CONFIG.defaultMonth,
        billingEvents: [],
      });
    },
  }), [deliveries, invoices, billingEvents, selectedMonth, leads]);

  return (
    <BillingContext.Provider value={api}>
      {children}
    </BillingContext.Provider>
  );
}

export function useBilling() {
  const ctx = useContext(BillingContext);
  if (!ctx) {
    throw new Error('useBilling muss innerhalb von BillingProvider verwendet werden');
  }
  return ctx;
}

export { generateInvoiceNumber };
