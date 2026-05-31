import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_VOUCHER_PARTNERS } from '../data/voucherPartners.js';

const STORAGE_KEY = 'clever-neuwagen-voucher-partners';

const VoucherPartnersContext = createContext(null);

function mergeWithDefaults(stored) {
  const ids = new Set(stored.map((p) => p.id));
  const missing = DEFAULT_VOUCHER_PARTNERS.filter((p) => !ids.has(p.id));
  return missing.length ? [...stored, ...missing] : stored;
}

function loadPartners() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return mergeWithDefaults(parsed);
    }
  } catch {
    /* Fallback */
  }
  return [...DEFAULT_VOUCHER_PARTNERS];
}

function savePartners(partners) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(partners));
}

export function loadPartnersFromStorage() {
  return loadPartners();
}

export function VoucherPartnersProvider({ children }) {
  const [partners, setPartners] = useState(loadPartners);

  useEffect(() => {
    savePartners(partners);
  }, [partners]);

  useEffect(() => {
    function onStorage(event) {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          setPartners(JSON.parse(event.newValue));
        } catch {
          /* ignorieren */
        }
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const api = useMemo(() => ({
    partners,

    updatePartner(id, partial) {
      setPartners((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...partial } : p)),
      );
    },

    toggleAssignment(id, driveType) {
      setPartners((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const has = p.assignment.includes(driveType);
          return {
            ...p,
            assignment: has
              ? p.assignment.filter((d) => d !== driveType)
              : [...p.assignment, driveType],
          };
        }),
      );
    },

    toggleActive(id) {
      setPartners((prev) =>
        prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p)),
      );
    },

    resetToDefaults() {
      setPartners([...DEFAULT_VOUCHER_PARTNERS]);
    },
  }), [partners]);

  return (
    <VoucherPartnersContext.Provider value={api}>
      {children}
    </VoucherPartnersContext.Provider>
  );
}

export function useVoucherPartners() {
  const ctx = useContext(VoucherPartnersContext);
  if (!ctx) {
    throw new Error('useVoucherPartners muss innerhalb von VoucherPartnersProvider verwendet werden');
  }
  return ctx;
}
