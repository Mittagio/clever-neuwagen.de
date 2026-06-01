import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  normalizeDealerConditions,
  resolveModelConditions,
  hasUnpublishedChanges,
  LEASING_TERM_OPTIONS,
  LEASING_MILEAGE_OPTIONS,
} from '../data/dealerConditionsSchema.js';
import { DEFAULT_DEALER_ID, getDealerSeed, DEALER_REGISTRY } from '../data/dealers/index.js';
import {
  createEmptyInventoryItem,
  normalizeInventoryItem,
} from '../logic/inventoryService.js';

const STORAGE_KEY = 'clever-neuwagen-dealer-store-v2';
const STORE_VERSION = 2;

const DealerConditionsContext = createContext(null);

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createDealerPair(seed) {
  const normalized = normalizeDealerConditions(seed);
  return {
    draftConditions: deepClone(normalized),
    publishedConditions: deepClone(normalized),
  };
}

function loadStore() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.version === STORE_VERSION && parsed.dealers) {
        return parsed;
      }
      if (parsed.dealerId || parsed.discountsByModel) {
        const normalized = normalizeDealerConditions(parsed);
        const dealerId = normalized.dealerId ?? DEFAULT_DEALER_ID;
        return {
          version: STORE_VERSION,
          dealers: {
            [dealerId]: {
              draftConditions: normalized,
              publishedConditions: deepClone(normalized),
            },
          },
        };
      }
    }
  } catch {
    /* Fallback */
  }

  const dealers = {};
  for (const entry of Object.values(DEALER_REGISTRY)) {
    dealers[entry.id] = createDealerPair(entry.seed);
  }
  return {
    version: STORE_VERSION,
    dealers,
  };
}

function saveStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function getDealerPair(store, dealerId = DEFAULT_DEALER_ID) {
  if (store.dealers[dealerId]) return store.dealers[dealerId];
  const seed = getDealerSeed(dealerId);
  if (DEALER_REGISTRY[dealerId]) {
    return createDealerPair(seed);
  }
  return store.dealers[DEFAULT_DEALER_ID];
}

function updateModelMap(prev, mapKey, modelId, updater) {
  const current = prev[mapKey]?.[modelId] ?? {};
  return {
    ...prev,
    [mapKey]: {
      ...prev[mapKey],
      [modelId]: typeof updater === 'function' ? updater(current) : updater,
    },
  };
}

function patchDraft(store, dealerId, updater) {
  const pair = getDealerPair(store, dealerId);
  const nextDraft = typeof updater === 'function'
    ? updater(deepClone(pair.draftConditions))
    : normalizeDealerConditions({ ...pair.draftConditions, ...updater });

  nextDraft.syncStatus = hasUnpublishedChanges(nextDraft, pair.publishedConditions)
    ? 'draft_pending'
    : pair.publishedConditions.syncStatus;

  return {
    ...store,
    dealers: {
      ...store.dealers,
      [dealerId]: {
        ...pair,
        draftConditions: nextDraft,
      },
    },
  };
}

export function DealerConditionsProvider({ children }) {
  const [store, setStore] = useState(loadStore);
  const [publishToast, setPublishToast] = useState(null);
  const [draftSavedAt, setDraftSavedAt] = useState(null);

  useEffect(() => {
    saveStore(store);
    setDraftSavedAt(new Date().toISOString());
  }, [store]);

  useEffect(() => {
    function onStorage(event) {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          setStore(JSON.parse(event.newValue));
        } catch {
          /* ignorieren */
        }
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const getDraftConditions = useCallback((dealerId = DEFAULT_DEALER_ID) => {
    return getDealerPair(store, dealerId).draftConditions;
  }, [store]);

  const getPublishedConditions = useCallback((dealerId = DEFAULT_DEALER_ID) => {
    return getDealerPair(store, dealerId).publishedConditions;
  }, [store]);

  const getDealerConditions = useCallback((dealerId = DEFAULT_DEALER_ID, view = 'published') => {
    const pair = getDealerPair(store, dealerId);
    return view === 'draft' ? pair.draftConditions : pair.publishedConditions;
  }, [store]);

  const getLastPublishedAt = useCallback((dealerId = DEFAULT_DEALER_ID) => {
    return getDealerPair(store, dealerId).publishedConditions.lastPublishedAt ?? null;
  }, [store]);

  const hasDraftChanges = useCallback((dealerId = DEFAULT_DEALER_ID) => {
    const pair = getDealerPair(store, dealerId);
    return hasUnpublishedChanges(pair.draftConditions, pair.publishedConditions);
  }, [store]);

  const updateDealerConditions = useCallback((dealerId, updater) => {
    setStore((prev) => patchDraft(prev, dealerId, updater));
  }, []);

  const publishDealerChanges = useCallback((dealerId = DEFAULT_DEALER_ID) => {
    const now = new Date().toISOString();
    setStore((prev) => {
      const pair = getDealerPair(prev, dealerId);
      const published = deepClone(pair.draftConditions);
      published.lastPublishedAt = now;
      published.syncStatus = 'synchronized';
      published.dealerPageOnline = true;

      const draft = deepClone(published);
      draft.syncStatus = 'synchronized';

      return {
        ...prev,
        dealers: {
          ...prev.dealers,
          [dealerId]: {
            draftConditions: draft,
            publishedConditions: published,
          },
        },
      };
    });
    setPublishToast('Änderungen wurden veröffentlicht.');
    setTimeout(() => setPublishToast(null), 4000);
    return now;
  }, []);

  const discardDraft = useCallback((dealerId = DEFAULT_DEALER_ID) => {
    setStore((prev) => {
      const pair = getDealerPair(prev, dealerId);
      return {
        ...prev,
        dealers: {
          ...prev.dealers,
          [dealerId]: {
            ...pair,
            draftConditions: deepClone(pair.publishedConditions),
          },
        },
      };
    });
  }, []);

  const defaultPair = getDealerPair(store, DEFAULT_DEALER_ID);
  const publishedConditions = defaultPair.publishedConditions;
  const draftConditions = defaultPair.draftConditions;

  const api = useMemo(() => ({
    store,
    dealerId: DEFAULT_DEALER_ID,

    /** Kunden-Seiten: veröffentlichte Konditionen */
    conditions: publishedConditions,
    publishedConditions,

    /** Backend: Entwurf */
    draftConditions,
    draftSavedAt,
    publishToast,

    getDealerConditions,
    getDraftConditions,
    getPublishedConditions,
    getLastPublishedAt,
    hasDraftChanges,
    hasUnpublishedChanges: (dealerId = DEFAULT_DEALER_ID) => hasDraftChanges(dealerId),
    updateDealerConditions,
    publishDealerChanges,
    discardDraft,

    getConditionsForModel(modelId = 'sportage', view = 'published') {
      const source = view === 'draft' ? draftConditions : publishedConditions;
      return resolveModelConditions(source, modelId);
    },

    get sportageConditions() {
      return resolveModelConditions(publishedConditions, 'sportage');
    },

    get draftSportageConditions() {
      return resolveModelConditions(draftConditions, 'sportage');
    },

    updateDiscount(modelId, key, value) {
      const num = value === '' || value == null
        ? null
        : Math.max(0, Math.min(50, Number(value) || 0));
      updateDealerConditions(DEFAULT_DEALER_ID, (prev) =>
        updateModelMap(prev, 'discountsByModel', modelId, (current) => ({
          ...current,
          [key]: num,
        })),
      );
    },

    updateLeasingFactor(modelId, termMonths, kmPerYear, value) {
      const factor = value === '' || value == null
        ? null
        : Math.max(0.01, Math.min(2, Number(value) || 0));
      updateDealerConditions(DEFAULT_DEALER_ID, (prev) => {
        const term = Number(termMonths);
        const km = Number(kmPerYear);
        const modelFactors = { ...(prev.leasingFactorsByModel?.[modelId] ?? {}) };
        const termFactors = { ...(modelFactors[term] ?? {}) };
        if (factor == null) {
          delete termFactors[km];
        } else {
          termFactors[km] = factor;
        }
        return updateModelMap(prev, 'leasingFactorsByModel', modelId, {
          ...modelFactors,
          [term]: termFactors,
        });
      });
    },

    saveLeasingTerm(modelId, termMonths) {
      return { termMonths, modelId, savedAt: new Date().toISOString() };
    },

    updateFinance(modelId, field, value) {
      updateDealerConditions(DEFAULT_DEALER_ID, (prev) =>
        updateModelMap(prev, 'financeByModel', modelId, (current) => ({
          ...current,
          [field]: value,
        })),
      );
    },

    updateFinanceFinalPayment(modelId, termMonths, value) {
      const percent = value === '' || value == null ? null : Math.max(0, Math.min(100, Number(value) || 0));
      updateDealerConditions(DEFAULT_DEALER_ID, (prev) =>
        updateModelMap(prev, 'financeByModel', modelId, (current) => {
          const finalPaymentPercent = { ...(current.finalPaymentPercent ?? {}) };
          if (percent == null) {
            delete finalPaymentPercent[termMonths];
          } else {
            finalPaymentPercent[termMonths] = percent;
          }
          return { ...current, finalPaymentPercent };
        }),
      );
    },

    updateDelivery(modelId, field, value) {
      updateDealerConditions(DEFAULT_DEALER_ID, (prev) =>
        updateModelMap(prev, 'deliveryByModel', modelId, (current) => ({
          ...current,
          [field]: value,
        })),
      );
    },

    updateModel(modelId, partial) {
      updateDealerConditions(DEFAULT_DEALER_ID, (prev) => ({
        ...prev,
        activeModels: prev.activeModels.map((m) =>
          m.id === modelId ? { ...m, ...partial } : m,
        ),
      }));
    },

    updateModelContact(modelId, field, value) {
      updateDealerConditions(DEFAULT_DEALER_ID, (prev) => ({
        ...prev,
        activeModels: prev.activeModels.map((m) =>
          m.id === modelId
            ? { ...m, contact: { ...m.contact, [field]: value } }
            : m,
        ),
      }));
    },

    updatePreparationFee(value) {
      updateDealerConditions(DEFAULT_DEALER_ID, (prev) => ({
        ...prev,
        preparationFee: Math.max(0, Number(value) || 0),
      }));
    },

    addInventoryItem(item = createEmptyInventoryItem()) {
      updateDealerConditions(DEFAULT_DEALER_ID, (prev) => ({
        ...prev,
        inventoryVehicles: [
          ...(prev.inventoryVehicles ?? []),
          normalizeInventoryItem({
            visibleOnLanding: true,
            internalNote: '',
            packageIds: [],
            ...item,
          }),
        ],
      }));
    },

    updateInventoryItem(id, partial) {
      updateDealerConditions(DEFAULT_DEALER_ID, (prev) => ({
        ...prev,
        inventoryVehicles: (prev.inventoryVehicles ?? []).map((item) =>
          item.id === id ? normalizeInventoryItem({ ...item, ...partial }) : item,
        ),
      }));
    },

    removeInventoryItem(id) {
      updateDealerConditions(DEFAULT_DEALER_ID, (prev) => ({
        ...prev,
        inventoryVehicles: (prev.inventoryVehicles ?? []).filter((item) => item.id !== id),
      }));
    },

    publishChanges() {
      return publishDealerChanges(DEFAULT_DEALER_ID);
    },

    resetToDefaults() {
      const seed = getDealerSeed(DEFAULT_DEALER_ID);
      setStore({
        version: STORE_VERSION,
        dealers: {
          [DEFAULT_DEALER_ID]: createDealerPair(seed),
        },
      });
    },

    updateFinancing(field, value) {
      if (field === 'effectiveRate') {
        updateDealerConditions(DEFAULT_DEALER_ID, (prev) =>
          updateModelMap(prev, 'financeByModel', 'sportage', (current) => ({
            ...current,
            interestRate: Number(value) || 0,
          })),
        );
      } else if (field === 'downPaymentPercent') {
        updateDealerConditions(DEFAULT_DEALER_ID, (prev) =>
          updateModelMap(prev, 'financeByModel', 'sportage', (current) => ({
            ...current,
            downPaymentPercent: Number(value) || 0,
          })),
        );
      }
    },

    updateDeliveryTime(value) {
      updateDealerConditions(DEFAULT_DEALER_ID, (prev) =>
        updateModelMap(prev, 'deliveryByModel', 'sportage', (current) => ({
          ...current,
          defaultDeliveryTime: value,
        })),
      );
    },

    publishFromOnboarding(profile) {
      const slug = profile.slug ?? DEFAULT_DEALER_ID;
      updateDealerConditions(slug, (prev) => normalizeDealerConditions({
        ...prev,
        dealerId: slug,
        slug,
        subdomain: profile.subdomain ?? `${slug}.clever-neuwagen.de`,
        dealerName: profile.dealer.name,
        plz: profile.dealer.plz,
        city: profile.dealer.city,
        address: profile.dealer.address ?? '',
        brands: profile.brands ?? [],
        discountsByModel: {
          ...prev.discountsByModel,
          sportage: { ...prev.discountsByModel?.sportage, ...profile.discounts },
        },
        leasingFactorsByModel: {
          ...prev.leasingFactorsByModel,
          sportage: profile.leasingFactors ?? prev.leasingFactorsByModel?.sportage,
        },
        deliveryByModel: {
          ...prev.deliveryByModel,
          sportage: {
            ...prev.deliveryByModel?.sportage,
            defaultDeliveryTime: profile.deliveryTimes?.default ?? prev.deliveryByModel?.sportage?.defaultDeliveryTime,
          },
        },
        preparationFee: profile.preparationFee ?? prev.preparationFee,
        contact: {
          name: profile.dealer.contactName ?? '',
          phone: profile.dealer.phone ?? '',
          email: profile.dealer.email ?? '',
          role: 'Verkauf Neuwagen',
        },
        dealerPageOnline: true,
        lastPublishedAt: profile.publishedAt ?? new Date().toISOString(),
        syncStatus: 'synchronized',
      }));
      publishDealerChanges(slug);
    },
  }), [
    store,
    publishedConditions,
    draftConditions,
    draftSavedAt,
    publishToast,
    getDealerConditions,
    getDraftConditions,
    getPublishedConditions,
    getLastPublishedAt,
    hasDraftChanges,
    updateDealerConditions,
    publishDealerChanges,
    discardDraft,
  ]);

  return (
    <DealerConditionsContext.Provider value={api}>
      {children}
    </DealerConditionsContext.Provider>
  );
}

export function useDealerConditions(options = {}) {
  const ctx = useContext(DealerConditionsContext);
  if (!ctx) {
    throw new Error('useDealerConditions muss innerhalb von DealerConditionsProvider verwendet werden');
  }

  const dealerId = options.dealerId ?? DEFAULT_DEALER_ID;
  const view = options.view ?? 'published';

  if (view === 'draft') {
    return {
      ...ctx,
      conditions: ctx.getDraftConditions(dealerId),
      draftConditions: ctx.getDraftConditions(dealerId),
      publishedConditions: ctx.getPublishedConditions(dealerId),
    };
  }

  if (dealerId !== DEFAULT_DEALER_ID) {
    const published = ctx.getPublishedConditions(dealerId);
    return {
      ...ctx,
      conditions: published,
      publishedConditions: published,
      draftConditions: ctx.getDraftConditions(dealerId),
    };
  }

  return ctx;
}

/** Nur veröffentlichte Konditionen – für Kunden-Seiten */
export function usePublishedDealerConditions(dealerId = DEFAULT_DEALER_ID) {
  return useDealerConditions({ dealerId, view: 'published' });
}

/** Entwurf – nur Backend */
export function useDraftDealerConditions(dealerId = DEFAULT_DEALER_ID) {
  return useDealerConditions({ dealerId, view: 'draft' });
}

export { LEASING_TERM_OPTIONS, LEASING_MILEAGE_OPTIONS, DEFAULT_DEALER_ID };
