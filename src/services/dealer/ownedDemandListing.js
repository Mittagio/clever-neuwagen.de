/**
 * Owned Demand MVP: veröffentlichte Händlerkondition → Fahrzeugseite → Lead → Concept Draft.
 * Kein neues Lager. Der Pilot-Pool bleibt die Fahrzeugseite.
 */
import { getKiaTrinklePilotStock } from '../../data/kia/kiaTrinkleStock.js';
import { ensureConceptOfferDraftFromCapture } from '../cleverSeller/ensureConceptOfferDraftFromCapture.js';
import { getOfferDraftById } from '../cleverSeller/cleverWorkingDraft.js';

export const OWNED_DEALER_SITE_SOURCE = 'owned_dealer_site';

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function paymentDiscountKey(paymentType = 'leasing') {
  if (paymentType === 'cash' || paymentType === 'purchase') return 'cash';
  if (paymentType === 'financing' || paymentType === 'finance') return 'financing';
  return 'leasing';
}

/**
 * Nur explizit gespeicherte Händlerkondition. Kein Default aus resolveModelSettings.
 * @returns {number|null}
 */
export function resolvePublishedDiscountPercent(conditions = {}, modelKey = '', paymentType = 'leasing') {
  const key = String(modelKey || '').toLowerCase();
  if (!key) return null;
  const stored = conditions?.modelSettingsByModel?.[key]?.paymentDiscounts?.[paymentDiscountKey(paymentType)];
  const fromPayment = num(stored);
  if (fromPayment != null) return fromPayment;
  const fromModel = num(conditions?.discountsByModel?.[key]?.standard);
  if (fromModel != null) return fromModel;
  const offer = conditions?.ownedVehicleOffer;
  if (offer?.published && String(offer.modelKey || '').toLowerCase() === key) {
    return num(offer.discountPercent);
  }
  return null;
}

export function ownedPublishReady(spec = {}) {
  return ['listPriceGross', 'discountPercent', 'termMonths', 'annualMileage', 'downPayment']
    .every((key) => num(spec[key]) != null);
}

function firstLeasingPair(conditions = {}, modelKey = '') {
  const factors = conditions?.leasingFactorsByModel?.[modelKey];
  if (!factors || typeof factors !== 'object') return { termMonths: null, annualMileage: null };
  const termKey = factors[48] ? '48' : Object.keys(factors).find((key) => factors[key] && typeof factors[key] === 'object');
  if (!termKey) return { termMonths: null, annualMileage: null };
  const kmMap = factors[termKey];
  const kmKey = kmMap[15000] != null ? '15000' : Object.keys(kmMap)[0];
  return {
    termMonths: num(termKey),
    annualMileage: num(kmKey),
  };
}

/**
 * Vorbelegung aus veröffentlichter Kondition, sonst aus Modellkondition und Pilot-Listing.
 * Fehlende Werte bleiben leer. Die UI erfindet sie nicht.
 */
export function previewOwnedVehiclePublish(conditions = {}, model = {}, pool = getKiaTrinklePilotStock()) {
  const modelKey = String(model.id || model.modelKey || '').toLowerCase();
  const listing = matchPilotListing({
    modelKey,
    trimId: model.trimId || (modelKey.startsWith('ev') ? 'earth' : undefined),
  }, pool);
  const offer = conditions?.ownedVehicleOffer;
  const same = Boolean(
    offer?.published
    && offer.modelKey === modelKey
    && listing?.slug
    && offer.slug === listing.slug,
  );
  const fromFactors = firstLeasingPair(conditions, modelKey);
  const listFromSettings = num(conditions?.modelSettingsByModel?.[modelKey]?.listPrice);
  const spec = {
    dealerSlug: listing?.dealerSlug || conditions.dealerId || 'autohaus-trinkle',
    modelKey,
    model: model.name || listing?.model || modelKey.toUpperCase(),
    trim: listing?.trim || null,
    trimId: listing?.trimId || null,
    slug: listing?.slug || null,
    listPriceGross: same
      ? num(offer.listPriceGross)
      : (listFromSettings ?? num(listing?.listPriceGross)),
    discountPercent: same
      ? num(offer.discountPercent)
      : resolvePublishedDiscountPercent(conditions, modelKey, offer?.paymentType || 'leasing'),
    termMonths: same ? num(offer.termMonths) : fromFactors.termMonths,
    annualMileage: same ? num(offer.annualMileage) : fromFactors.annualMileage,
    downPayment: same ? num(offer.downPayment) : null,
    paymentType: same ? (offer.paymentType || 'leasing') : 'leasing',
    validUntil: same ? (offer.validUntil || '') : '',
  };
  return {
    listing,
    alreadyPublished: same,
    publicPath: spec.slug ? `/fahrzeug/${spec.slug}` : null,
    spec,
  };
}

export function matchPilotListing(spec = {}, pool = getKiaTrinklePilotStock()) {
  if (spec.slug) {
    return pool.find((item) => item.slug === spec.slug) ?? null;
  }
  const modelKey = String(spec.modelKey || '').toLowerCase();
  const trimId = String(spec.trimId || spec.trim || '').toLowerCase();
  if (!modelKey) return null;
  return pool.find((item) => (
    String(item.modelKey || '').toLowerCase() === modelKey
    && (!trimId || String(item.trimId || item.trim || '').toLowerCase() === trimId)
  )) ?? null;
}

/**
 * Schreibt die eine Verkaufskondition in die bestehenden Händlerkonditionen.
 * Publish des Dealers kopiert dieses Objekt mit (draft → published).
 */
export function publishOwnedVehicleOffer(conditions = {}, spec = {}) {
  const listing = spec.slug ? null : matchPilotListing(spec);
  const modelKey = String(spec.modelKey || listing?.modelKey || '').toLowerCase();
  const discountPercent = num(spec.discountPercent);
  const listPriceGross = num(spec.listPriceGross ?? spec.listPrice);
  const paymentType = spec.paymentType || 'leasing';
  const offer = {
    id: spec.id || `owned-${modelKey}-${String(spec.trimId || listing?.trimId || 'offer').toLowerCase()}`,
    published: true,
    dealerSlug: spec.dealerSlug || listing?.dealerSlug || 'autohaus-trinkle',
    slug: spec.slug || listing?.slug || null,
    modelKey,
    model: spec.model || listing?.model || modelKey.toUpperCase(),
    trim: spec.trim || listing?.trim || null,
    trimId: spec.trimId || listing?.trimId || null,
    listPriceGross,
    discountPercent,
    termMonths: num(spec.termMonths),
    annualMileage: num(spec.annualMileage ?? spec.mileagePerYear),
    downPayment: num(spec.downPayment) ?? 0,
    paymentType,
    validUntil: spec.validUntil || null,
    publishedAt: spec.publishedAt || new Date().toISOString(),
  };

  const prevSettings = conditions.modelSettingsByModel?.[modelKey] ?? {};
  return {
    ...conditions,
    discountsByModel: {
      ...(conditions.discountsByModel || {}),
      [modelKey]: {
        ...(conditions.discountsByModel?.[modelKey] || {}),
        standard: discountPercent,
      },
    },
    modelSettingsByModel: {
      ...(conditions.modelSettingsByModel || {}),
      [modelKey]: {
        ...prevSettings,
        listPrice: listPriceGross,
        paymentDiscounts: {
          ...(prevSettings.paymentDiscounts || {}),
          cash: discountPercent,
          leasing: discountPercent,
          financing: discountPercent,
        },
      },
    },
    ownedVehicleOffer: offer,
    dealerPageOnline: conditions.dealerPageOnline !== false,
    lastPublishedAt: offer.publishedAt,
  };
}

function overlayDiscount(vehicle, discountPercent) {
  const listPrice = num(vehicle.listPriceGross);
  return {
    ...vehicle,
    discountPercent,
    discountSource: 'dealer_conditions',
    cashPrice: listPrice != null
      ? Math.round(listPrice * (1 - discountPercent / 100))
      : vehicle.cashPrice,
    monthlyRateAuthority: 'display_estimate',
  };
}

/**
 * Öffentliche Karte. defaultDiscount() bleibt nur, wenn keine veröffentlichte Kondition da ist.
 * Die geschätzte monthlyRate bleibt Anzeige.
 */
export function presentOwnedVehicle(vehicle, conditions = null) {
  if (!vehicle) return vehicle;
  const offer = conditions?.ownedVehicleOffer;
  const modelKey = String(vehicle.modelKey || '').toLowerCase();
  const offerMatches = Boolean(
    offer?.published
    && (
      (offer.slug && vehicle.slug === offer.slug)
      || (
        !offer.slug
        && modelKey === String(offer.modelKey || '').toLowerCase()
        && (!offer.trimId || String(vehicle.trimId || '').toLowerCase() === String(offer.trimId).toLowerCase())
      )
    ),
  );

  if (offerMatches) {
    const discount = resolvePublishedDiscountPercent(conditions, offer.modelKey, offer.paymentType)
      ?? num(offer.discountPercent);
    const listPrice = num(offer.listPriceGross) ?? num(vehicle.listPriceGross);
    const next = overlayDiscount(
      { ...vehicle, listPriceGross: listPrice, modelKey: offer.modelKey || vehicle.modelKey },
      discount,
    );
    return {
      ...next,
      trim: offer.trim || vehicle.trim,
      trimId: offer.trimId || vehicle.trimId,
      ownedCommercial: {
        id: offer.id,
        dealerSlug: offer.dealerSlug,
        slug: offer.slug || vehicle.slug,
        modelKey: offer.modelKey,
        model: offer.model,
        trim: offer.trim,
        trimId: offer.trimId,
        listPriceGross: listPrice,
        discountPercent: discount,
        termMonths: offer.termMonths,
        annualMileage: offer.annualMileage,
        downPayment: offer.downPayment,
        paymentType: offer.paymentType,
        validUntil: offer.validUntil || null,
        rate: null,
      },
    };
  }

  const publishedDiscount = resolvePublishedDiscountPercent(conditions, modelKey, 'leasing');
  if (publishedDiscount == null) return vehicle;
  return overlayDiscount(vehicle, publishedDiscount);
}

function uid(prefix = 'lead') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function commercialFromVehicle(vehicle = {}) {
  return vehicle.ownedCommercial || null;
}

/**
 * Anfrage von der eigenen Fahrzeugseite. Rate bleibt null.
 */
export function createLeadFromOwnedDealerSite({
  vehicle,
  contact = {},
  page = null,
  campaign = null,
} = {}) {
  const commercial = commercialFromVehicle(vehicle);
  if (!commercial) {
    throw new Error('owned_dealer_site erfordert eine veröffentlichte Händlerkondition');
  }
  const now = new Date().toISOString();
  const modelKey = commercial.modelKey;
  const lead = {
    id: uid('owned'),
    createdAt: now,
    updatedAt: now,
    status: 'neu',
    source: OWNED_DEALER_SITE_SOURCE,
    dealerId: commercial.dealerSlug,
    dealerSlug: commercial.dealerSlug,
    listingSlug: commercial.slug,
    marketplaceSlug: commercial.slug,
    page: page || null,
    campaign: campaign || null,
    contact: {
      name: contact.name?.trim?.() || contact.name || '',
      phone: contact.phone?.trim?.() || contact.phone || '',
      email: contact.email?.trim?.() || contact.email || '',
    },
    vehicle: {
      brand: vehicle.brand || 'Kia',
      model: commercial.model || vehicle.model,
      modelKey,
      trim: commercial.trim,
      trimId: commercial.trimId,
      label: [commercial.model || vehicle.model, commercial.trim].filter(Boolean).join(' '),
      slug: commercial.slug,
    },
    paymentType: commercial.paymentType || 'leasing',
    desiredRate: null,
    currentRate: null,
    ownedCommercial: { ...commercial, rate: null },
    commercialConditionId: commercial.id,
    wish: {
      modelKey,
      trim: commercial.trim,
      paymentType: commercial.paymentType || 'leasing',
      termMonths: commercial.termMonths,
      mileagePerYear: commercial.annualMileage,
      annualMileage: commercial.annualMileage,
      downPayment: commercial.downPayment,
      discountPercent: commercial.discountPercent,
      listPriceGross: commercial.listPriceGross,
      commercialScenarios: [{
        id: `cs-${commercial.id}`,
        type: commercial.paymentType || 'leasing',
        paymentType: commercial.paymentType || 'leasing',
        termMonths: commercial.termMonths,
        mileagePerYear: commercial.annualMileage,
        annualMileage: commercial.annualMileage,
        downPayment: commercial.downPayment,
        discountPercent: commercial.discountPercent,
        listPriceGross: commercial.listPriceGross,
        rate: null,
        monthlyRate: null,
        rateAuthority: 'non_authoritative',
      }],
    },
    crm: {
      needProfile: {
        selectedModelKey: modelKey,
      },
    },
    history: [{
      id: uid('hist'),
      at: now,
      type: 'system',
      text: `Anfrage auf eigenes ${commercial.model || modelKey}-Angebot`,
    }],
  };

  return seedOwnedConceptDraft(lead);
}

export function seedOwnedConceptDraft(lead = {}) {
  const commercial = lead.ownedCommercial;
  if (!commercial?.modelKey) return lead;
  const facts = [
    {
      field: 'vehicleInterest',
      needsConfirmation: false,
      value: {
        modelKey: commercial.modelKey,
        model: commercial.model || commercial.modelKey,
        trim: commercial.trim || null,
      },
    },
    { field: 'paymentType', needsConfirmation: false, value: commercial.paymentType || 'leasing' },
    { field: 'termMonths', needsConfirmation: false, value: commercial.termMonths },
    { field: 'annualMileage', needsConfirmation: false, value: commercial.annualMileage },
    { field: 'downPayment', needsConfirmation: false, value: commercial.downPayment },
    { field: 'discountPercent', needsConfirmation: false, value: commercial.discountPercent },
  ];
  const ensured = ensureConceptOfferDraftFromCapture(lead, facts, {
    modelKey: commercial.modelKey,
    sellerInput: '',
    force: true,
    createNewAlternative: !lead?.crm?.cleverWorkingState?.currentOfferDraftId,
  });
  const draft = getOfferDraftById(ensured.lead, ensured.offerDraftId);
  if (!draft) return ensured.lead;
  const scenario = {
    ...(draft.commercialScenario || lead.wish?.commercialScenarios?.[0] || {}),
    discountPercent: commercial.discountPercent,
    listPriceGross: commercial.listPriceGross,
    termMonths: commercial.termMonths,
    annualMileage: commercial.annualMileage,
    mileagePerYear: commercial.annualMileage,
    downPayment: commercial.downPayment,
    paymentType: commercial.paymentType || 'leasing',
    rate: null,
    monthlyRate: null,
    rateAuthority: 'non_authoritative',
  };
  const offerDrafts = {
    ...(ensured.lead.crm?.cleverWorkingState?.offerDrafts || {}),
    [draft.offerDraftId]: {
      ...draft,
      rate: null,
      monthlyRate: null,
      commercialScenario: scenario,
    },
  };
  return {
    ...ensured.lead,
    desiredRate: null,
    currentRate: null,
    crm: {
      ...ensured.lead.crm,
      cleverWorkingState: {
        ...(ensured.lead.crm?.cleverWorkingState || {}),
        offerDrafts,
        currentOfferDraft: {
          ...(ensured.lead.crm.cleverWorkingState?.currentOfferDraft || {}),
          ...offerDrafts[draft.offerDraftId],
        },
      },
    },
  };
}
