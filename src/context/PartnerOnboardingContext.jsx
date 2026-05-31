import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_ONBOARDING } from '../data/partnerOnboarding.js';
import { buildSubdomain, slugifyDealerName } from '../logic/partnerOnboarding.js';

const STORAGE_KEY = 'clever-neuwagen-partner-onboarding';

const PartnerOnboardingContext = createContext(null);

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_ONBOARDING, ...JSON.parse(raw) };
  } catch {
    /* Fallback */
  }
  return { ...DEFAULT_ONBOARDING };
}

function saveDraft(draft) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function PartnerOnboardingProvider({ children }) {
  const [draft, setDraft] = useState(loadDraft);

  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  const api = useMemo(() => ({
    draft,

    setStep(step) {
      setDraft((prev) => ({ ...prev, step }));
    },

    updateDealer(fields) {
      setDraft((prev) => {
        const dealer = { ...prev.dealer, ...fields };
        const slug = fields.name != null
          ? slugifyDealerName(fields.name)
          : prev.slug;
        return { ...prev, dealer, slug };
      });
    },

    setSlug(slug) {
      setDraft((prev) => ({ ...prev, slug: slugifyDealerName(slug) }));
    },

    toggleBrand(brandId) {
      setDraft((prev) => {
        const has = prev.brands.includes(brandId);
        const brands = has
          ? prev.brands.filter((id) => id !== brandId)
          : [...prev.brands, brandId];
        const byBrand = { ...prev.deliveryTimes.byBrand };
        if (!has && !byBrand[brandId]) {
          byBrand[brandId] = prev.deliveryTimes.default;
        }
        if (has) delete byBrand[brandId];
        return {
          ...prev,
          brands,
          deliveryTimes: { ...prev.deliveryTimes, byBrand },
        };
      });
    },

    updateDiscount(key, value) {
      const num = Math.max(0, Math.min(50, Number(value) || 0));
      setDraft((prev) => ({
        ...prev,
        discounts: { ...prev.discounts, [key]: num },
      }));
    },

    updateLeasingFactor(termMonths, kmPerYear, value) {
      const factor = Math.max(0.01, Math.min(2, Number(value) || 0));
      setDraft((prev) => ({
        ...prev,
        leasingFactors: {
          ...prev.leasingFactors,
          [termMonths]: {
            ...prev.leasingFactors[termMonths],
            [kmPerYear]: factor,
          },
        },
      }));
    },

    updateDefaultDeliveryTime(value) {
      setDraft((prev) => ({
        ...prev,
        deliveryTimes: { ...prev.deliveryTimes, default: value },
      }));
    },

    updateBrandDeliveryTime(brandId, value) {
      setDraft((prev) => ({
        ...prev,
        deliveryTimes: {
          ...prev.deliveryTimes,
          byBrand: { ...prev.deliveryTimes.byBrand, [brandId]: value },
        },
      }));
    },

    updatePreparationFee(value) {
      setDraft((prev) => ({
        ...prev,
        preparationFee: Math.max(0, Number(value) || 0),
      }));
    },

    markPublished(subdomain) {
      setDraft((prev) => ({
        ...prev,
        published: true,
        subdomain,
        publishedAt: new Date().toISOString(),
        step: 6,
      }));
    },

    resetDraft() {
      setDraft({ ...DEFAULT_ONBOARDING });
    },
  }), [draft]);

  return (
    <PartnerOnboardingContext.Provider value={api}>
      {children}
    </PartnerOnboardingContext.Provider>
  );
}

export function usePartnerOnboarding() {
  const ctx = useContext(PartnerOnboardingContext);
  if (!ctx) {
    throw new Error('usePartnerOnboarding muss innerhalb von PartnerOnboardingProvider verwendet werden');
  }
  return ctx;
}

export { buildSubdomain };
