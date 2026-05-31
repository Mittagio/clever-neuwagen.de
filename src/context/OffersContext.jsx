import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEMO_OFFERS } from '../data/demoOffers.js';
import {
  buildOfferUrl,
  markOfferSent,
  recordOfferView,
  getOffersForCustomer,
} from '../logic/offerService.js';
import {
  recordIntelligenceOfferCreated,
  recordIntelligenceOfferViewed,
} from '../services/intelligenceAnalytics.js';

const STORAGE_KEY = 'clever-neuwagen-offers';

const OffersContext = createContext(null);

function migrateOffer(offer) {
  if (!offer.tracking) {
    offer.tracking = {
      sentAt: offer.status !== 'entwurf' ? offer.createdAt : null,
      openedAt: null,
      lastViewedAt: null,
      openCount: 0,
      events: [],
    };
  }
  if (offer.status === 'active') offer.status = 'versendet';
  if (offer.status === 'reserved') offer.status = 'bestellung';
  return offer;
}

function loadOffers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map(migrateOffer);
      }
    }
  } catch {
    /* Fallback */
  }
  return DEMO_OFFERS.map(migrateOffer);
}

function saveOffers(offers) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(offers));
}

export function OffersProvider({ children }) {
  const [offers, setOffers] = useState(loadOffers);

  useEffect(() => {
    saveOffers(offers);
  }, [offers]);

  useEffect(() => {
    function onStorage(event) {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          setOffers(JSON.parse(event.newValue).map(migrateOffer));
        } catch {
          /* ignorieren */
        }
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const api = useMemo(() => ({
    offers,

    getOfferByCode(code) {
      if (!code) return null;
      return offers.find((o) => o.code.toUpperCase() === code.toUpperCase()) ?? null;
    },

    addOffer(offer) {
      const migrated = migrateOffer(offer);
      recordIntelligenceOfferCreated(migrated);
      setOffers((prev) => [migrated, ...prev.filter((o) => o.code !== offer.code)]);
      return migrated;
    },

    updateOffer(code, partial) {
      setOffers((prev) =>
        prev.map((o) =>
          o.code.toUpperCase() === code.toUpperCase()
            ? migrateOffer({ ...o, ...partial, updatedAt: new Date().toISOString() })
            : o,
        ),
      );
    },

    updateOfferStatus(code, status) {
      api.updateOffer(code, { status });
    },

    markSent(code) {
      setOffers((prev) =>
        prev.map((o) =>
          o.code.toUpperCase() === code.toUpperCase()
            ? migrateOffer(markOfferSent(o))
            : o,
        ),
      );
    },

    recordOpen(code) {
      setOffers((prev) =>
        prev.map((o) => {
          if (o.code.toUpperCase() !== code.toUpperCase()) return o;
          const updated = migrateOffer(recordOfferView(o));
          recordIntelligenceOfferViewed(updated);
          return updated;
        }),
      );
    },

    linkLead(code, leadId) {
      api.updateOffer(code, { leadId });
    },

    getOffersForCustomer(customer) {
      return getOffersForCustomer(offers, customer);
    },

    getExistingCodes() {
      return new Set(offers.map((o) => o.code));
    },

    getAllOffers() {
      return offers;
    },

    getOfferUrl(code) {
      return buildOfferUrl(code);
    },

    /** @deprecated */
    reserveOffer(code) {
      api.updateOfferStatus(code, 'bestellung');
    },
  }), [offers]);

  return (
    <OffersContext.Provider value={api}>
      {children}
    </OffersContext.Provider>
  );
}

export function useOffers() {
  const ctx = useContext(OffersContext);
  if (!ctx) {
    throw new Error('useOffers muss innerhalb von OffersProvider verwendet werden');
  }
  return ctx;
}
