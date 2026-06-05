/**
 * Kundenkonto – Persistenz & Verknüpfung mit Angeboten/Leads
 */

export const EMPTY_CUSTOMER_DATA = {
  profile: { name: '', phone: '' },
  offers: [],
  comparisons: [],
  configurations: [],
  favorites: [],
  testDrives: [],
  documents: [],
  vehicleStatus: [],
  linkedShareTokens: [],
};

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizeCustomerData(raw) {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_CUSTOMER_DATA };
  return {
    profile: { ...EMPTY_CUSTOMER_DATA.profile, ...raw.profile },
    offers: Array.isArray(raw.offers) ? raw.offers : [],
    comparisons: Array.isArray(raw.comparisons) ? raw.comparisons : [],
    configurations: Array.isArray(raw.configurations) ? raw.configurations : [],
    favorites: Array.isArray(raw.favorites) ? raw.favorites : [],
    testDrives: Array.isArray(raw.testDrives) ? raw.testDrives : [],
    documents: Array.isArray(raw.documents) ? raw.documents : [],
    vehicleStatus: Array.isArray(raw.vehicleStatus) ? raw.vehicleStatus : [],
    linkedShareTokens: Array.isArray(raw.linkedShareTokens) ? raw.linkedShareTokens : [],
    // Legacy keys migrieren
    ...(raw.watchlist && !raw.favorites?.length
      ? { favorites: raw.watchlist.map((w) => ({ ...w, id: w.id ?? uid('fav') })) }
      : {}),
    ...(raw.requests && !raw.testDrives?.length
      ? { testDrives: raw.requests.map((r) => ({ ...r, id: r.id ?? uid('td') })) }
      : {}),
  };
}

export function buildOfferAccountEntry(offer) {
  return {
    id: uid('cust-off'),
    offerCode: offer.code,
    brand: offer.vehicle.brand,
    model: offer.vehicle.model,
    variant: offer.vehicle.trim,
    label: offer.vehicle.label,
    monthlyRate: offer.pricing?.rate ?? offer.pricing?.leasingRate,
    dealer: offer.dealer?.name ?? '',
    date: offer.createdAt ?? new Date().toISOString(),
    validUntil: offer.validUntil,
    status: 'angebot',
    source: offer.source ?? 'advisor',
  };
}

export function buildComparisonEntry(recommendations, profile) {
  const items = recommendations.slice(0, 3).map((r) => ({
    id: r.id,
    label: r.fullLabel ?? r.label,
    monthlyRate: r.monthlyRate,
    rankMedal: r.rankMedal,
  }));

  return {
    id: uid('cmp'),
    date: new Date().toISOString(),
    status: 'verglichen',
    items,
    profileSnapshot: {
      desiredRate: profile.desiredRate,
      mileage: profile.mileage,
      fuelPreference: profile.fuelPreference,
      bodyType: profile.bodyType,
    },
  };
}

export function buildTestDriveEntry(rec, contact, dealerName) {
  return {
    id: uid('td'),
    brand: rec.brand,
    model: rec.model,
    variant: rec.variant,
    label: rec.fullLabel,
    monthlyRate: rec.monthlyRate,
    dealer: dealerName,
    date: new Date().toISOString(),
    status: 'angefragt',
    contact: { ...contact },
  };
}

export function buildFavoriteEntry(rec) {
  return {
    id: uid('fav'),
    brand: rec.brand,
    model: rec.model,
    variant: rec.variant,
    label: rec.fullLabel ?? rec.label,
    monthlyRate: rec.monthlyRate,
    date: new Date().toISOString(),
    status: 'gespeichert',
    vehicleId: rec.id,
  };
}

export function buildConfigurationEntry(config, price, dealerName, labels = {}) {
  const trim = labels.trimName ?? config.trimId;
  const engine = labels.engineName ?? config.engineId;
  const color = labels.colorName ?? config.colorId;
  const rate = price?.primaryRate ?? price?.leasingRate ?? price?.financeRate ?? price?.cashPrice ?? null;

  return {
    id: uid('cfg'),
    brand: 'Kia',
    model: config.model ?? 'Sportage',
    variant: labels.variantLabel ?? trim,
    trimId: config.trimId,
    engineId: config.engineId,
    colorId: config.colorId,
    engineName: engine,
    color,
    paymentType: config.paymentType ?? 'leasing',
    termMonths: config.termMonths ?? 48,
    mileagePerYear: config.mileagePerYear ?? 10000,
    customerGroup: config.customerGroup ?? 'standard',
    monthlyRate: rate,
    configurationPrice: price?.configurationPrice,
    hauspreis: price?.hauspreis ?? price?.housePrice,
    dealer: dealerName,
    date: new Date().toISOString(),
    status: 'gespeichert',
    config: { ...config },
    offerCode: null,
  };
}

export function addConfigurationToAccount(data, entry) {
  return { ...data, configurations: [entry, ...data.configurations] };
}

export function linkConfigurationOffer(data, configId, offerCode) {
  return {
    ...data,
    configurations: data.configurations.map((c) =>
      c.id === configId ? { ...c, offerCode, status: 'angebot' } : c,
    ),
  };
}

export function buildMarketplaceSavedEntry(vehicle) {
  return {
    id: uid('cust-off'),
    offerCode: null,
    marketplaceSlug: vehicle.slug,
    brand: vehicle.brand,
    model: vehicle.model,
    label: vehicle.title,
    monthlyRate: vehicle.monthlyRate,
    dealer: vehicle.dealerName ?? '',
    date: new Date().toISOString(),
    status: 'gemerkt',
    source: 'marketplace',
  };
}

export function addMarketplaceSavedToAccount(data, vehicle) {
  const entry = buildMarketplaceSavedEntry(vehicle);
  const exists = data.offers.some((o) => o.marketplaceSlug === vehicle.slug);
  if (exists) return data;
  return { ...data, offers: [entry, ...data.offers] };
}

export function buildMarketplaceInquiryEntry(vehicle, contact, kind = 'inquiry') {
  return {
    id: uid('inq'),
    brand: vehicle.brand,
    model: vehicle.model,
    label: vehicle.title,
    monthlyRate: vehicle.monthlyRate,
    dealer: vehicle.dealerName,
    marketplaceSlug: vehicle.slug,
    date: new Date().toISOString(),
    status: kind === 'testdrive' ? 'Probefahrt angefragt' : 'Anfrage gesendet',
    contact: { ...contact },
  };
}

export function addInquiryToAccount(data, entry) {
  return { ...data, testDrives: [entry, ...data.testDrives] };
}

export function addOfferToAccount(data, offer) {
  const entry = buildOfferAccountEntry(offer);
  const exists = data.offers.some((o) => o.offerCode === offer.code);
  if (exists) return data;
  return { ...data, offers: [entry, ...data.offers] };
}

export function addComparisonToAccount(data, entry) {
  return { ...data, comparisons: [entry, ...data.comparisons] };
}

export function addTestDriveToAccount(data, entry) {
  return { ...data, testDrives: [entry, ...data.testDrives] };
}

export function addFavoriteToAccount(data, entry) {
  const exists = data.favorites.some((f) => f.vehicleId === entry.vehicleId);
  if (exists) return data;
  return { ...data, favorites: [entry, ...data.favorites] };
}

export function updateProfile(data, profile) {
  return { ...data, profile: { ...data.profile, ...profile } };
}

export function buildDocumentEntry({ offerCode, fileName, fileSize, label, vehicleLabel }) {
  return {
    id: uid('doc'),
    offerCode: offerCode ?? null,
    fileName,
    fileSize: fileSize ?? 0,
    label: label ?? fileName,
    vehicleLabel: vehicleLabel ?? '',
    uploadedAt: new Date().toISOString(),
    status: 'hochgeladen',
  };
}

export function addDocumentToAccount(data, entry) {
  return { ...data, documents: [entry, ...data.documents] };
}

export function buildVehicleStatusEntry(offer, stage = 'angebot') {
  return {
    id: uid('vs'),
    offerCode: offer.code,
    label: offer.vehicle?.label ?? `${offer.vehicle?.brand} ${offer.vehicle?.model}`,
    dealer: offer.dealer?.name ?? '',
    deliveryTime: offer.deliveryTime ?? '–',
    stage,
    updatedAt: new Date().toISOString(),
    events: [
      {
        at: new Date().toISOString(),
        label: VEHICLE_STATUS_LABELS[stage] ?? stage,
      },
    ],
  };
}

const VEHICLE_STATUS_LABELS = {
  angebot: 'Angebot erhalten',
  interessiert: 'Interesse bestätigt',
  bestellung: 'Bestellung aufgegeben',
  produktion: 'Fahrzeug in Produktion',
  transport: 'Auf dem Transportweg',
  auslieferung: 'Auslieferung geplant',
  ausgeliefert: 'Ausgeliefert',
};

export function upsertVehicleStatus(data, entry) {
  const idx = data.vehicleStatus.findIndex((v) => v.offerCode === entry.offerCode);
  if (idx >= 0) {
    const existing = data.vehicleStatus[idx];
    const events = [
      ...(existing.events ?? []),
      ...(entry.events ?? []),
    ];
    const next = [...data.vehicleStatus];
    next[idx] = { ...existing, ...entry, events };
    return { ...data, vehicleStatus: next };
  }
  return { ...data, vehicleStatus: [entry, ...data.vehicleStatus] };
}

export function updateVehicleStatusStage(data, offerCode, stage) {
  return {
    ...data,
    vehicleStatus: data.vehicleStatus.map((v) =>
      v.offerCode === offerCode
        ? {
            ...v,
            stage,
            updatedAt: new Date().toISOString(),
            events: [
              ...(v.events ?? []),
              { at: new Date().toISOString(), label: VEHICLE_STATUS_LABELS[stage] ?? stage },
            ],
          }
        : v,
    ),
  };
}

export function mergeLiveOffers(accountOffers, globalOffers, email) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return accountOffers;

  const fromGlobal = globalOffers
    .filter((o) => o.customer?.email?.trim().toLowerCase() === normalizedEmail)
    .map((o) => buildOfferAccountEntry(o));

  const codes = new Set(accountOffers.map((o) => o.offerCode));
  const merged = [...accountOffers];
  for (const entry of fromGlobal) {
    if (!codes.has(entry.offerCode)) merged.push(entry);
  }
  return merged.sort((a, b) => new Date(b.date) - new Date(a.date));
}
