/**
 * Händlerkonditionen – Schema, Defaults, Migration, Auflösung pro Modell
 * Fahrzeugstammdaten bleiben read-only (src/data/models/).
 */

function kiaCatalogEntry(id, name, { ev = false, pbv = false } = {}) {
  return {
    id,
    brand: 'Kia',
    name,
    status: 'active',
    active: true,
    showOnDealerPage: true,
    syncToLanding: true,
    defaultDeliveryTime: pbv ? '8–12 Wochen' : ev ? '6–8 Wochen' : '4–6 Wochen',
  };
}

/** Alle Kia-Modelllinien für Pilot-LIVE (PDF + Registry) */
export const DEALER_MODEL_CATALOG = [
  kiaCatalogEntry('picanto', 'Picanto'),
  kiaCatalogEntry('stonic', 'Stonic'),
  kiaCatalogEntry('xceed', 'XCeed'),
  kiaCatalogEntry('k4', 'K4'),
  kiaCatalogEntry('k4-sportswagon', 'K4 Sportswagon'),
  kiaCatalogEntry('ceed', 'Ceed'),
  kiaCatalogEntry('niro', 'Niro Hybrid'),
  kiaCatalogEntry('seltos', 'Seltos'),
  kiaCatalogEntry('sportage', 'Sportage'),
  kiaCatalogEntry('sportage-hybrid', 'Sportage Hybrid'),
  kiaCatalogEntry('sportage-phev', 'Sportage Plug-in Hybrid'),
  kiaCatalogEntry('sorento', 'Sorento'),
  kiaCatalogEntry('sorento-hybrid', 'Sorento Hybrid'),
  kiaCatalogEntry('sorento-phev', 'Sorento Plug-in Hybrid'),
  kiaCatalogEntry('ev2', 'EV2', { ev: true }),
  kiaCatalogEntry('ev3', 'EV3', { ev: true }),
  kiaCatalogEntry('ev4', 'EV4', { ev: true }),
  kiaCatalogEntry('ev4-fastback', 'EV4 Fastback', { ev: true }),
  kiaCatalogEntry('ev5', 'EV5', { ev: true }),
  kiaCatalogEntry('ev5-gt', 'EV5 GT', { ev: true }),
  kiaCatalogEntry('ev6', 'EV6', { ev: true }),
  kiaCatalogEntry('ev6-gt', 'EV6 GT', { ev: true }),
  kiaCatalogEntry('ev9', 'EV9', { ev: true }),
  kiaCatalogEntry('ev9-gt', 'EV9 GT', { ev: true }),
  kiaCatalogEntry('pv5-passenger', 'PV5 Passenger', { ev: true, pbv: true }),
  kiaCatalogEntry('pv5-cargo-l2h1', 'PV5 Cargo L2H1', { ev: true, pbv: true }),
  kiaCatalogEntry('pv5-chassis-cab', 'PV5 Chassis Cab', { ev: true, pbv: true }),
  kiaCatalogEntry('pv5-crew', 'PV5 Crew', { ev: true, pbv: true }),
];

export const LEASING_TERM_OPTIONS = [12, 18, 24, 30, 36, 42, 48, 54, 60];

export const LEASING_MILEAGE_OPTIONS = Array.from(
  { length: (30000 - 5000) / 2500 + 1 },
  (_, i) => 5000 + i * 2500,
);

export const FINANCE_TERM_OPTIONS = Array.from({ length: 49 }, (_, i) => 12 + i);

export const DISCOUNT_GROUP_FIELDS = [
  { key: 'standard', label: 'Standardrabatt', required: true },
  { key: 'corporateBenefits', label: 'Corporate Benefits' },
  { key: 'schwerbehindert', label: 'Schwerbehindert' },
  { key: 'oeffentlicherDienst', label: 'Öffentlicher Dienst' },
  { key: 'gewerbe', label: 'Gewerbe' },
  { key: 'aktion', label: 'Aktionsrabatt' },
];

export const DELIVERY_STATUS_OPTIONS = [
  { id: 'konfigurierbar', label: 'Konfigurierbar', chip: '🟡 4–6 Wochen' },
  { id: 'lager', label: 'Lagerfahrzeug vorhanden', chip: '🟢 Sofort verfügbar' },
  { id: 'vorlauf', label: 'Vorlauf vorhanden', chip: '🔵 Bestellfahrzeug' },
  { id: 'bestellbar', label: 'Bestellung möglich', chip: '🔵 Bestellfahrzeug' },
  { id: 'nicht_verfuegbar', label: 'Derzeit nicht verfügbar', chip: '⚪ Auf Anfrage' },
];

const DEFAULT_SPORTAGE_LF_48 = {
  5000: 0.54,
  7500: 0.56,
  10000: 0.58,
  12500: 0.61,
  15000: 0.64,
  17500: 0.67,
  20000: 0.71,
  22500: 0.75,
  25000: 0.79,
  27500: 0.82,
  30000: 0.85,
};

function defaultSportageDiscounts() {
  return {
    standard: 12,
    corporateBenefits: 15,
    schwerbehindert: 18,
    oeffentlicherDienst: 14,
    gewerbe: 13,
    aktion: null,
  };
}

function defaultSportageLeasingFactors() {
  return {
    36: { 10000: 0.68, 15000: 0.72, 20000: 0.78 },
    48: { ...DEFAULT_SPORTAGE_LF_48 },
    60: { 10000: 0.55, 15000: 0.6, 20000: 0.67 },
  };
}

function defaultSportageFinance() {
  return {
    interestRate: 4.99,
    downPaymentPercent: 20,
    finalPaymentPercent: {
      36: 60,
      48: 50,
      60: 40,
    },
  };
}

function defaultSportageDelivery() {
  return {
    defaultDeliveryTime: '4–6 Wochen',
    availabilityStatus: 'konfigurierbar',
  };
}

export function buildDefaultActiveModels(contact = {}) {
  return DEALER_MODEL_CATALOG.map((m) => ({
    ...m,
    contact: m.id === 'sportage'
      ? {
          name: contact.name ?? 'Max Trinkle',
          role: contact.role ?? 'Verkauf Neuwagen',
          phone: contact.phone ?? '',
          email: contact.email ?? '',
        }
      : { name: '', role: 'Verkauf Neuwagen', phone: '', email: '' },
  }));
}

/**
 * Erzeugt vollständige Händlerkonditionen aus Legacy-Flat-Struktur.
 */
export function buildDealerConditionsFromLegacy(legacy = {}) {
  const contact = legacy.contact ?? {};
  return {
    dealerId: legacy.dealerId ?? 'autohaus-trinkle',
    dealerName: legacy.dealerName ?? 'Autohaus Trinkle',
    city: legacy.city ?? '',
    plz: legacy.plz ?? '',
    address: legacy.address ?? '',
    contact,
    preparationFee: legacy.preparationFee ?? 1290,

    activeModels: legacy.activeModels ?? buildDefaultActiveModels(contact),

    discountsByModel: legacy.discountsByModel ?? {
      sportage: legacy.discounts
        ? { ...defaultSportageDiscounts(), ...legacy.discounts, aktion: legacy.discounts.aktion ?? null }
        : defaultSportageDiscounts(),
    },

    leasingFactorsByModel: legacy.leasingFactorsByModel ?? {
      sportage: legacy.leasingFactors ?? defaultSportageLeasingFactors(),
    },

    financeByModel: legacy.financeByModel ?? {
      sportage: legacy.financeRates
        ? {
            interestRate: legacy.financeRates.interestRate ?? 4.99,
            downPaymentPercent: legacy.financing?.downPaymentPercent ?? 20,
            finalPaymentPercent: legacy.financeRates.finalPaymentPercent ?? {},
          }
        : defaultSportageFinance(),
    },

    deliveryByModel: legacy.deliveryByModel ?? {
      sportage: {
        defaultDeliveryTime: legacy.deliveryTime ?? '4–6 Wochen',
        availabilityStatus: 'konfigurierbar',
      },
    },

    inventoryVehicles: legacy.inventoryVehicles ?? legacy.inventory ?? [],

    modelSettingsByModel: legacy.modelSettingsByModel ?? {},

    lastPublishedAt: legacy.lastPublishedAt ?? legacy.publishedAt ?? null,
    dealerPageOnline: legacy.dealerPageOnline ?? legacy.published ?? true,
    syncStatus: legacy.syncStatus ?? 'synchronized',
  };
}

export function normalizeDealerConditions(raw = {}) {
  const merged = buildDealerConditionsFromLegacy(raw);

  merged.activeModels = (merged.activeModels ?? []).map((m) => {
    const catalog = DEALER_MODEL_CATALOG.find((c) => c.id === m.id);
    return { ...catalog, ...m };
  });

  if (merged.activeModels.length < DEALER_MODEL_CATALOG.length) {
    const existingIds = new Set(merged.activeModels.map((m) => m.id));
    for (const catalogModel of DEALER_MODEL_CATALOG) {
      if (!existingIds.has(catalogModel.id)) {
        merged.activeModels.push({
          ...catalogModel,
          contact: { name: '', role: 'Verkauf Neuwagen', phone: '', email: '' },
        });
      }
    }
  }

  merged.inventoryVehicles = (merged.inventoryVehicles ?? []).map((item) => ({
    visibleOnLanding: item.visibleOnLanding !== false,
    internalNote: item.internalNote ?? '',
    packageIds: item.packageIds ?? [],
    ...item,
  }));

  merged.modelSettingsByModel = merged.modelSettingsByModel ?? {};

  return merged;
}

/** Rabatt für Berechnung – leere Felder fallen auf Standard zurück */
export function resolveDiscountsForModel(discountsByModel = {}, modelId = 'sportage') {
  const modelDiscounts = discountsByModel[modelId] ?? {};
  const standard = Number(modelDiscounts.standard) || 0;
  const resolved = { standard };

  for (const { key } of DISCOUNT_GROUP_FIELDS) {
    if (key === 'standard') continue;
    const raw = modelDiscounts[key];
    resolved[key] = raw == null || raw === '' ? standard : Number(raw) || standard;
  }

  return {
    resolved,
    configured: modelDiscounts,
    isConfigured: (key) => {
      if (key === 'standard') return modelDiscounts.standard != null && modelDiscounts.standard !== '';
      return modelDiscounts[key] != null && modelDiscounts[key] !== '';
    },
  };
}

/** Aufgelöste Konditionen für Konfigurator / Preisrechner (Modell-spezifisch) */
export function resolveModelConditions(conditions, modelId = 'sportage') {
  const base = normalizeDealerConditions(conditions);
  const { resolved: discounts } = resolveDiscountsForModel(base.discountsByModel, modelId);
  const leasingFactors = base.leasingFactorsByModel?.[modelId] ?? {};
  const finance = base.financeByModel?.[modelId] ?? defaultSportageFinance();
  const delivery = base.deliveryByModel?.[modelId] ?? defaultSportageDelivery();

  const inventory = (base.inventoryVehicles ?? []).filter(
    (v) => !v.model || v.model.toLowerCase() === modelId || v.model === 'Sportage' && modelId === 'sportage',
  );

  return {
    ...base,
    discounts,
    leasingFactors,
    financeResidualsByModel: base.financeResidualsByModel ?? {},
    financeRates: {
      interestRate: finance.interestRate,
      finalPaymentPercent: finance.finalPaymentPercent ?? {},
    },
    financing: {
      effectiveRate: finance.interestRate,
      downPaymentPercent: finance.downPaymentPercent ?? 20,
      durationMonths: FINANCE_TERM_OPTIONS.filter((t) => finance.finalPaymentPercent?.[t] != null),
    },
    deliveryTime: delivery.defaultDeliveryTime ?? '4–6 Wochen',
    deliveryStatus: delivery.availabilityStatus,
    inventory,
  };
}

export function countMissingLeasingFactors(conditions, modelId = 'sportage') {
  const factors = conditions.leasingFactorsByModel?.[modelId] ?? {};
  let missing = 0;
  for (const term of LEASING_TERM_OPTIONS) {
    for (const km of LEASING_MILEAGE_OPTIONS) {
      if (factors[term]?.[km] == null) missing += 1;
    }
  }
  return missing;
}

export function formatPublishedAt(iso) {
  if (!iso) return 'Noch nicht veröffentlicht';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getModelLabel(modelId) {
  const m = DEALER_MODEL_CATALOG.find((c) => c.id === modelId);
  return m ? `${m.brand} ${m.name}` : modelId;
}

export function getModelStatusLabel(model) {
  if (model.active) return 'aktiv';
  if (model.status === 'preparing') return 'in Vorbereitung';
  return 'inaktiv';
}

/** Tiefe Gleichheit für Draft/Publish-Vergleich */
export function conditionsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function hasUnpublishedChanges(draft, published) {
  return !conditionsEqual(draft, published);
}

export function getSyncStatusLabel(draft, published) {
  if (!published?.lastPublishedAt) return { id: 'pending', label: 'Noch nicht veröffentlicht', emoji: '🟡' };
  if (hasUnpublishedChanges(draft, published)) {
    return { id: 'draft', label: 'Entwurf vorhanden', emoji: '🟡' };
  }
  if (published.syncStatus === 'error') {
    return { id: 'error', label: 'Fehler', emoji: '🔴' };
  }
  return { id: 'synchronized', label: 'Synchronisiert', emoji: '🟢' };
}

/** Änderungen seit letzter Veröffentlichung (Kurzliste) */
export function getChangesSincePublish(draft, published) {
  const changes = [];

  const draftLf = draft?.leasingFactorsByModel?.sportage?.[48]?.[15000];
  const pubLf = published?.leasingFactorsByModel?.sportage?.[48]?.[15000];
  if (draftLf !== pubLf && (draftLf != null || pubLf != null)) {
    changes.push({
      id: 'lf-48-15000',
      label: 'Leasingfaktor 48 Mt. / 15.000 km',
      from: pubLf ?? '–',
      to: draftLf ?? '–',
    });
  }

  const draftStd = draft?.discountsByModel?.sportage?.standard;
  const pubStd = published?.discountsByModel?.sportage?.standard;
  if (draftStd !== pubStd) {
    changes.push({
      id: 'discount-standard',
      label: 'Standardrabatt',
      from: pubStd != null ? `${pubStd} %` : '–',
      to: draftStd != null ? `${draftStd} %` : '–',
    });
  }

  const draftInv = draft?.inventoryVehicles?.length ?? 0;
  const pubInv = published?.inventoryVehicles?.length ?? 0;
  if (draftInv !== pubInv) {
    changes.push({
      id: 'inventory-count',
      label: 'Lager & Vorlauf',
      from: `${pubInv} Fahrzeuge`,
      to: `${draftInv} Fahrzeuge`,
    });
  }

  if (changes.length === 0 && hasUnpublishedChanges(draft, published)) {
    changes.push({ id: 'other', label: 'Weitere Konditionen', from: '–', to: 'Geändert' });
  }

  return changes;
}

export function getLeasingFactorSnapshot(conditions, modelId = 'sportage', term = 48, km = 15000) {
  return conditions?.leasingFactorsByModel?.[modelId]?.[term]?.[km] ?? null;
}
