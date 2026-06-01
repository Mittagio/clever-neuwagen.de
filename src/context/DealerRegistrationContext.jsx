import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_REGISTRATION_DRAFT } from '../data/dealerRegistration.js';
import {
  buildRegistrationSlug,
  getNextRegistrationStatus,
  validateRegistrationStep,
} from '../logic/dealerRegistration.js';
import { useDealerAdmin } from './DealerAdminContext.jsx';

const DRAFT_KEY = 'clever-neuwagen-dealer-registration-draft';
const APPLICATIONS_KEY = 'clever-neuwagen-dealer-registrations';

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return { ...DEFAULT_REGISTRATION_DRAFT, ...JSON.parse(raw) };
  } catch {
    /* Fallback */
  }
  return { ...DEFAULT_REGISTRATION_DRAFT };
}

function loadApplications() {
  try {
    const raw = localStorage.getItem(APPLICATIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* Fallback */
  }
  return [];
}

function saveDraft(draft) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function saveApplications(list) {
  localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(list));
}

const DealerRegistrationContext = createContext(null);

export function DealerRegistrationProvider({ children }) {
  const { createFromRegistration, syncRegistrationStatus } = useDealerAdmin();
  const [draft, setDraft] = useState(loadDraft);
  const [applications, setApplications] = useState(loadApplications);

  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  useEffect(() => {
    saveApplications(applications);
  }, [applications]);

  const updateSlugFromCompany = useCallback((company) => {
    const slug = buildRegistrationSlug(company);
    return slug;
  }, []);

  const api = useMemo(() => ({
    draft,
    applications,

    setStep(step) {
      setDraft((prev) => ({ ...prev, step }));
    },

    updateCompany(fields) {
      setDraft((prev) => {
        const company = { ...prev.company, ...fields };
        const slug = buildRegistrationSlug(company);
        return { ...prev, company, slug };
      });
    },

    updateContact(fields) {
      setDraft((prev) => ({
        ...prev,
        contact: { ...prev.contact, ...fields },
      }));
    },

    toggleBrand(brandId) {
      setDraft((prev) => {
        const has = prev.brands.includes(brandId);
        const brands = has
          ? prev.brands.filter((id) => id !== brandId)
          : [...prev.brands, brandId];
        return { ...prev, brands };
      });
    },

    setPackageId(packageId) {
      setDraft((prev) => ({ ...prev, packageId }));
    },

    setAgbAccepted(accepted) {
      setDraft((prev) => ({
        ...prev,
        agbAccepted: accepted,
        agbAcceptedAt: accepted ? new Date().toISOString() : null,
      }));
    },

    resetDraft() {
      setDraft({ ...DEFAULT_REGISTRATION_DRAFT });
    },

    getApplication(id) {
      return applications.find((a) => a.id === id) ?? null;
    },

    getApplicationsByStatus(status) {
      return applications.filter((a) => a.status === status);
    },

    submitApplication() {
      const err = validateRegistrationStep(6, draft);
      if (err) return { ok: false, error: err };

      const now = new Date().toISOString();
      const application = {
        ...draft,
        id: draft.applicationId ?? `reg-${Date.now()}`,
        status: 'submitted',
        submittedAt: now,
        updatedAt: now,
        createdAt: draft.createdAt ?? now,
      };

      setApplications((prev) => {
        const idx = prev.findIndex((a) => a.id === application.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = application;
          return next;
        }
        return [application, ...prev];
      });

      setDraft((prev) => ({
        ...prev,
        status: 'submitted',
        applicationId: application.id,
        submittedAt: now,
      }));

      createFromRegistration(application);

      return { ok: true, application };
    },

    advanceApplicationStatus(applicationId) {
      const app = applications.find((a) => a.id === applicationId);
      if (!app) return;
      const nextStatus = getNextRegistrationStatus(app.status);
      if (!nextStatus || nextStatus === 'draft') return;

      const updatedAt = new Date().toISOString();
      setApplications((prev) =>
        prev.map((a) =>
          a.id === applicationId ? { ...a, status: nextStatus, updatedAt } : a,
        ),
      );
      syncRegistrationStatus(app.slug, nextStatus);
    },

    rejectApplication(applicationId, reason = '') {
      const app = applications.find((a) => a.id === applicationId);
      if (!app) return;
      const updatedAt = new Date().toISOString();
      setApplications((prev) =>
        prev.map((a) =>
          a.id === applicationId
            ? { ...a, status: 'rejected', rejectReason: reason, updatedAt }
            : a,
        ),
      );
      syncRegistrationStatus(app.slug, 'rejected');
    },

    validateStep: validateRegistrationStep,
    updateSlugFromCompany,
  }), [draft, applications, createFromRegistration, syncRegistrationStatus, updateSlugFromCompany]);

  return (
    <DealerRegistrationContext.Provider value={api}>
      {children}
    </DealerRegistrationContext.Provider>
  );
}

export function useDealerRegistration() {
  const ctx = useContext(DealerRegistrationContext);
  if (!ctx) {
    throw new Error('useDealerRegistration muss innerhalb von DealerRegistrationProvider verwendet werden');
  }
  return ctx;
}
