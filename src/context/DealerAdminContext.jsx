import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useBilling } from './BillingContext.jsx';
import {
  DEMO_DEALERS,
  DEMO_DEALER_ACTIVITIES,
  DEMO_APPROVALS,
  DEMO_NOTIFICATIONS,
} from '../data/demoDealerAdmin.js';
import {
  computeOperatorKpis,
  mergeDealerWithBilling,
  countModelsForDealer,
  getBrandLabels,
} from '../logic/dealerAdminEngine.js';
import { getPackageById } from '../logic/dealerRegistration.js';

const STORAGE_KEY = 'clever-neuwagen-dealer-admin';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* Fallback */
  }
  return {
    dealers: DEMO_DEALERS,
    activities: DEMO_DEALER_ACTIVITIES,
    approvals: DEMO_APPROVALS,
    notifications: DEMO_NOTIFICATIONS,
  };
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const DealerAdminContext = createContext(null);

export function DealerAdminProvider({ children }) {
  const { getDealerSummaries, invoices, selectedMonth } = useBilling();
  const [state, setState] = useState(loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const billingSummaries = useMemo(
    () => getDealerSummaries(selectedMonth),
    [getDealerSummaries, selectedMonth],
  );

  const dealers = useMemo(() => {
    return state.dealers.map((dealer) => {
      const billing = billingSummaries.find((s) => s.dealerId === dealer.id);
      return mergeDealerWithBilling(dealer, billing);
    });
  }, [state.dealers, billingSummaries]);

  const api = useMemo(() => ({
    dealers,
    activities: state.activities,
    approvals: state.approvals,
    notifications: state.notifications,

    getDealer(id) {
      return dealers.find((d) => d.id === id) ?? null;
    },

    getDealerActivities(dealerId) {
      return state.activities
        .filter((a) => a.dealerId === dealerId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    getPendingApprovals() {
      return state.approvals
        .filter((a) => a.status === 'pending')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    getOnboardingDealers() {
      return dealers
        .filter((d) => d.onboardingStep < 5 || d.status === 'draft' || d.status === 'review')
        .sort((a, b) => b.onboardingStep - a.onboardingStep);
    },

    approveItem(approvalId) {
      const approval = state.approvals.find((a) => a.id === approvalId);
      if (!approval) return;

      setState((prev) => {
        let nextDealers = prev.dealers;
        let nextActivities = prev.activities;

        if (approval.type === 'registration' && approval.dealerId) {
          nextDealers = prev.dealers.map((d) =>
            d.id === approval.dealerId
              ? { ...d, status: 'review', onboardingStep: Math.max(d.onboardingStep, 3) }
              : d,
          );
        }
        if (approval.type === 'brand' && approval.dealerId && approval.meta?.brandId) {
          nextDealers = prev.dealers.map((d) => {
            if (d.id !== approval.dealerId) return d;
            const brands = d.brands.includes(approval.meta.brandId)
              ? d.brands
              : [...d.brands, approval.meta.brandId];
            return { ...d, brands, status: d.status === 'review' ? 'active' : d.status, onboardingStep: 5 };
          });
        }

        nextActivities = [
          {
            id: `act-${Date.now()}`,
            dealerId: approval.dealerId ?? 'platform',
            action: `Freigabe: ${approval.title}`,
            createdAt: new Date().toISOString(),
          },
          ...prev.activities,
        ];

        return {
          ...prev,
          dealers: nextDealers,
          activities: nextActivities,
          approvals: prev.approvals.map((a) =>
            a.id === approvalId ? { ...a, status: 'approved' } : a,
          ),
          notifications: prev.notifications.map((n) =>
            n.approvalId === approvalId ? { ...n, read: true } : n,
          ),
        };
      });
    },

    rejectItem(approvalId) {
      setState((prev) => ({
        ...prev,
        approvals: prev.approvals.map((a) =>
          a.id === approvalId ? { ...a, status: 'rejected' } : a,
        ),
        notifications: prev.notifications.map((n) =>
          n.approvalId === approvalId ? { ...n, read: true } : n,
        ),
      }));
    },

    updateDealerStatus(dealerId, status) {
      setState((prev) => ({
        ...prev,
        dealers: prev.dealers.map((d) =>
          d.id === dealerId ? { ...d, status } : d,
        ),
        activities: [
          {
            id: `act-${Date.now()}`,
            dealerId,
            action: `Status geändert: ${status}`,
            createdAt: new Date().toISOString(),
          },
          ...prev.activities,
        ],
      }));
    },

    toggleDealerBrand(dealerId, brandId, enabled) {
      setState((prev) => ({
        ...prev,
        dealers: prev.dealers.map((d) => {
          if (d.id !== dealerId) return d;
          const brands = enabled
            ? [...new Set([...d.brands, brandId])]
            : d.brands.filter((b) => b !== brandId);
          return { ...d, brands };
        }),
      }));
    },

    toggleDealerModel(dealerId, brandId, modelId, enabled) {
      setState((prev) => ({
        ...prev,
        dealers: prev.dealers.map((d) => {
          if (d.id !== dealerId) return d;
          const models = { ...d.models };
          const list = models[brandId] ?? [];
          models[brandId] = enabled
            ? [...new Set([...list, modelId])]
            : list.filter((m) => m !== modelId);
          return { ...d, models };
        }),
      }));
    },

    advanceOnboarding(dealerId) {
      setState((prev) => ({
        ...prev,
        dealers: prev.dealers.map((d) => {
          if (d.id !== dealerId) return d;
          const step = Math.min(5, d.onboardingStep + 1);
          const status = step >= 5 ? 'active' : d.status;
          return { ...d, onboardingStep: step, status };
        }),
      }));
    },

    markNotificationsRead() {
      setState((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) => ({ ...n, read: true })),
      }));
    },

    resetDemoData() {
      setState({
        dealers: DEMO_DEALERS,
        activities: DEMO_DEALER_ACTIVITIES,
        approvals: DEMO_APPROVALS,
        notifications: DEMO_NOTIFICATIONS,
      });
    },

    createFromRegistration(application) {
      const pkg = getPackageById(application.packageId);
      const dealerId = application.slug;
      if (!dealerId) return;

      setState((prev) => {
        if (prev.dealers.some((d) => d.id === dealerId)) {
          return prev;
        }

        const companyName = application.company.legalName?.trim()
          || application.company.tradeName?.trim();
        const contactPerson = `${application.contact.firstName} ${application.contact.lastName}`.trim();
        const address = `${application.company.street}, ${application.company.zip} ${application.company.city}`;

        const newDealer = {
          id: dealerId,
          companyName,
          contactPerson,
          email: application.contact.email,
          phone: application.contact.phone,
          address,
          city: application.company.city,
          status: 'draft',
          registrationStatus: 'submitted',
          brands: [...application.brands],
          models: {},
          contract: {
            startDate: null,
            type: `Paket ${pkg.name}`,
            platformFee: pkg.monthlyFee,
            provisionModel: `${pkg.successProvision} € pro bestätigter Auslieferung`,
            cancellationStatus: 'Warte auf Freigabe',
          },
          stats: { leads: 0, offers: 0, sales: 0, monthlyRevenue: 0 },
          onboardingStep: 1,
          packageId: application.packageId,
          registrationId: application.id,
          createdAt: application.submittedAt ?? new Date().toISOString(),
        };

        const approval = {
          id: `appr-reg-${dealerId}`,
          type: 'registration',
          title: `Neue Registrierung: ${companyName}`,
          dealerId,
          status: 'pending',
          createdAt: application.submittedAt ?? new Date().toISOString(),
          meta: { registrationId: application.id, packageId: application.packageId },
        };

        const notification = {
          id: `notif-reg-${dealerId}`,
          text: `Neue Händlerregistrierung: ${companyName}`,
          approvalId: approval.id,
          read: false,
          createdAt: approval.createdAt,
        };

        return {
          ...prev,
          dealers: [...prev.dealers, newDealer],
          approvals: [approval, ...prev.approvals],
          notifications: [notification, ...prev.notifications],
          activities: [
            {
              id: `act-reg-${Date.now()}`,
              dealerId,
              action: 'Self-Service-Registrierung eingereicht',
              createdAt: approval.createdAt,
            },
            ...prev.activities,
          ],
        };
      });
    },

    syncRegistrationStatus(dealerId, registrationStatus) {
      setState((prev) => {
        const dealer = prev.dealers.find((d) => d.id === dealerId);
        if (!dealer) return prev;

        let status = dealer.status;
        let onboardingStep = dealer.onboardingStep;

        switch (registrationStatus) {
          case 'submitted':
            status = 'draft';
            onboardingStep = Math.max(onboardingStep, 1);
            break;
          case 'review':
            status = 'review';
            onboardingStep = Math.max(onboardingStep, 3);
            break;
          case 'approved':
            status = 'review';
            onboardingStep = Math.max(onboardingStep, 4);
            break;
          case 'live':
            status = 'active';
            onboardingStep = 5;
            break;
          case 'rejected':
            status = 'blocked';
            break;
          default:
            break;
        }

        const contract = registrationStatus === 'live'
          ? {
              ...dealer.contract,
              startDate: new Date().toISOString().slice(0, 10),
              cancellationStatus: 'Unbefristet',
            }
          : dealer.contract;

        return {
          ...prev,
          dealers: prev.dealers.map((d) =>
            d.id === dealerId
              ? { ...d, status, registrationStatus, onboardingStep, contract }
              : d,
          ),
          activities: [
            {
              id: `act-${Date.now()}`,
              dealerId,
              action: `Onboarding-Status: ${registrationStatus}`,
              createdAt: new Date().toISOString(),
            },
            ...prev.activities,
          ],
          approvals: registrationStatus === 'approved' || registrationStatus === 'live'
            ? prev.approvals.map((a) =>
                a.dealerId === dealerId && a.type === 'registration' && a.status === 'pending'
                  ? { ...a, status: 'approved' }
                  : a,
              )
            : prev.approvals,
        };
      });
    },

    countModelsForDealer,
    getBrandLabels,
  }), [dealers, state.activities, state.approvals, state.notifications]);

  return (
    <DealerAdminContext.Provider value={api}>
      {children}
    </DealerAdminContext.Provider>
  );
}

export function useDealerAdmin() {
  const ctx = useContext(DealerAdminContext);
  if (!ctx) {
    throw new Error('useDealerAdmin muss innerhalb von DealerAdminProvider verwendet werden');
  }
  return ctx;
}

export function useOperatorKpis(importMetrics) {
  const { dealers, approvals } = useDealerAdmin();
  const { invoices } = useBilling();
  return useMemo(
    () => computeOperatorKpis(dealers, approvals, importMetrics, invoices),
    [dealers, approvals, importMetrics, invoices],
  );
}
