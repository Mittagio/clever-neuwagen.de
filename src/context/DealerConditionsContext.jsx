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
import { appendChangeHistory } from '../services/dealer/dealerChangeHistory.js';
import { archiveModelSettingsForMonth } from '../services/dealer/dealerCopyConditions.js';
import { resolveModelSettings } from '../services/dealer/dealerVehicleManagement.js';

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

function withModelHistory(prev, modelId, summary, field = null) {
  return {
    ...prev,
    ...appendChangeHistory(prev, {
      modelId,
      summary,
      field,
      actor: 'Händler',
      actorRole: 'dealerAdmin',
    }),
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
      let draft = deepClone(pair.draftConditions);

      for (const model of draft.activeModels ?? []) {
        const settings = resolveModelSettings(draft, model.id);
        draft = {
          ...draft,
          ...archiveModelSettingsForMonth(draft, model.id, settings),
        };
      }

      const published = deepClone(draft);
      published.lastPublishedAt = now;
      published.syncStatus = 'synchronized';
      published.dealerPageOnline = true;

      draft = deepClone(published);
      draft.syncStatus = 'synchronized';
      draft = {
        ...draft,
        ...appendChangeHistory(draft, {
          summary: 'Konditionen veröffentlicht',
          actor: 'Händler',
          actorRole: 'dealerAdmin',
        }),
      };

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

    updateLeasingFactor(modelId, termMonths, kmPerYear, value, trimId = null) {
      const factor = value === '' || value == null
        ? null
        : Math.max(0.01, Math.min(2, Number(value) || 0));
      updateDealerConditions(DEFAULT_DEALER_ID, (prev) => {
        const term = Number(termMonths);
        const km = Number(kmPerYear);
        const modelFactors = { ...(prev.leasingFactorsByModel?.[modelId] ?? {}) };

        let updated;
        if (trimId) {
          const trimFactors = { ...(modelFactors[trimId] ?? {}) };
          const termFactors = { ...(trimFactors[term] ?? {}) };
          if (factor == null) {
            delete termFactors[km];
          } else {
            termFactors[km] = factor;
          }
          updated = updateModelMap(prev, 'leasingFactorsByModel', modelId, {
            ...modelFactors,
            [trimId]: {
              ...trimFactors,
              [term]: termFactors,
            },
          });
        } else {
          const termFactors = { ...(modelFactors[term] ?? {}) };
          if (factor == null) {
            delete termFactors[km];
          } else {
            termFactors[km] = factor;
          }
          updated = updateModelMap(prev, 'leasingFactorsByModel', modelId, {
            ...modelFactors,
            [term]: termFactors,
          });
        }

        const trimLabel = trimId ? ` (${trimId})` : '';
        return withModelHistory(
          updated,
          modelId,
          `Leasingfaktor ${term}/${km}${trimLabel} geändert`,
          'leasingFactor',
        );
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

    updateFinanceCondition(modelId, trimId, termMonths, downPayment, value) {
      const term = Number(termMonths);
      const down = Number(downPayment);
      updateDealerConditions(DEFAULT_DEALER_ID, (prev) => {
        const modelStore = { ...(prev.financeConditionsByModel?.[modelId] ?? {}) };
        const trimStore = { ...(modelStore[trimId] ?? {}) };
        const termStore = { ...(trimStore[term] ?? {}) };

        if (value == null) {
          delete termStore[down];
        } else {
          termStore[down] = value;
        }

        const updated = {
          ...prev,
          financeConditionsByModel: {
            ...(prev.financeConditionsByModel ?? {}),
            [modelId]: {
              ...modelStore,
              [trimId]: {
                ...trimStore,
                [term]: termStore,
              },
            },
          },
        };

        return withModelHistory(
          updated,
          modelId,
          `Finanzierung ${term}/${down}${trimId ? ` (${trimId})` : ''} geändert`,
          'financeCondition',
        );
      });
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

    updateModelSettings(modelId, partial) {
      updateDealerConditions(DEFAULT_DEALER_ID, (prev) => {
        const updated = updateModelMap(prev, 'modelSettingsByModel', modelId, (current) => ({
          ...current,
          ...partial,
          paymentDiscounts: partial.paymentDiscounts
            ? { ...(current.paymentDiscounts ?? {}), ...partial.paymentDiscounts }
            : current.paymentDiscounts,
          preparationFee: partial.preparationFee
            ? { ...(current.preparationFee ?? {}), ...partial.preparationFee }
            : current.preparationFee,
          trimConditions: partial.trimConditions
            ? { ...(current.trimConditions ?? {}), ...partial.trimConditions }
            : current.trimConditions,
        }));
        return withModelHistory(updated, modelId, 'Konditionen geändert', Object.keys(partial).join(', '));
      });
    },

    addCustomTargetGroup(group) {
      updateDealerConditions(DEFAULT_DEALER_ID, (prev) => ({
        ...prev,
        customTargetGroups: [...(prev.customTargetGroups ?? []), group],
      }));
    },

    addModelPromotion(modelId, promotion) {
      updateDealerConditions(DEFAULT_DEALER_ID, (prev) => {
        const updated = updateModelMap(prev, 'modelSettingsByModel', modelId, (current) => ({
          ...current,
          promotions: [...(current.promotions ?? []), promotion],
        }));
        return withModelHistory(updated, modelId, `Aktion angelegt: ${promotion.title}`, 'promotion');
      });
    },

    updateModelPromotion(modelId, promotionId, partial) {
      updateDealerConditions(DEFAULT_DEALER_ID, (prev) => {
        const updated = updateModelMap(prev, 'modelSettingsByModel', modelId, (current) => ({
          ...current,
          promotions: (current.promotions ?? []).map((p) => (
            p.id === promotionId ? { ...p, ...partial } : p
          )),
        }));
        return withModelHistory(updated, modelId, 'Aktion bearbeitet', promotionId);
      });
    },

    removeModelPromotion(modelId, promotionId) {
      updateDealerConditions(DEFAULT_DEALER_ID, (prev) => {
        const updated = updateModelMap(prev, 'modelSettingsByModel', modelId, (current) => ({
          ...current,
          promotions: (current.promotions ?? []).filter((p) => p.id !== promotionId),
        }));
        return withModelHistory(updated, modelId, 'Aktion entfernt', promotionId);
      });
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
