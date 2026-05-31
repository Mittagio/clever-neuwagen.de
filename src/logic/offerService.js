import { sportage, formatPrice } from '../data/kiaSportage.js';
import { calculatePrice } from './priceCalculator.js';
import { OFFER_SOURCES } from '../data/offerTypes.js';

const OFFER_BASE_URL = 'https://clever-neuwagen.de/offer';

export function generateOfferNumber(existingOffers = []) {
  const year = new Date().getFullYear();
  const prefix = `CN-${year}-`;
  let max = 0;

  const list = Array.isArray(existingOffers)
    ? existingOffers
    : existingOffers instanceof Set
      ? [...existingOffers].map((code) => ({ code }))
      : [];

  for (const offer of list) {
    const codeStr = typeof offer === 'string' ? offer : offer.code;
    const match = String(codeStr ?? '').match(/^CN-(\d{4})-(\d+)$/i);
    if (match && Number(match[1]) === year) {
      max = Math.max(max, Number(match[2]));
    }
  }

  return `${prefix}${String(max + 1).padStart(5, '0')}`;
}

/** @deprecated – nutze generateOfferNumber */
export function generateOfferCode(existingCodes = new Set()) {
  const list = [...existingCodes].map((code) => ({ code }));
  return generateOfferNumber(list);
}

export function buildOfferUrl(code) {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/offer/${encodeURIComponent(code)}`;
  }
  return `${OFFER_BASE_URL}/${encodeURIComponent(code)}`;
}

function defaultValidUntil() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString();
}

function buildDealerSnapshot(conditions) {
  const sportageModel = conditions.activeModels?.find((m) => m.id === 'sportage');
  return {
    name: conditions.dealerName,
    city: conditions.city,
    plz: conditions.plz,
    address: conditions.address ?? '',
    contact: sportageModel?.contact ?? conditions.contact ?? {},
  };
}

function buildConfigLines(config, price) {
  const engine = sportage.engines.find((e) => e.id === config.engineId);
  const trim = sportage.trims.find((t) => t.id === config.trimId);
  const color = sportage.colors.find((c) => c.id === config.colorId);
  const packages = (config.selectedPackageIds ?? [])
    .map((id) => sportage.packages.find((p) => p.id === id))
    .filter(Boolean);

  return [
    engine ? `Motor: ${engine.name} (${engine.powerPs ?? engine.power} PS)` : null,
    trim ? `Ausstattung: ${trim.name}` : null,
    color ? `Farbe: ${color.name}${color.priceGross || color.price ? ` (+${formatPrice(color.priceGross ?? color.price)})` : ''}` : null,
    packages.length ? `Pakete: ${packages.map((p) => p.name).join(', ')}` : null,
    config.customerGroup && config.customerGroup !== 'standard'
      ? `Kundengruppe: ${config.customerGroup}` : null,
    config.termMonths ? `Laufzeit: ${config.termMonths} Monate` : null,
    config.mileagePerYear ? `Laufleistung: ${config.mileagePerYear.toLocaleString('de-DE')} km/Jahr` : null,
    config.downPayment > 0 ? `Anzahlung: ${formatPrice(config.downPayment)}` : null,
    price?.breakdown?.accessoriesPrice > 0 ? `Zubehör: +${formatPrice(price.breakdown.accessoriesPrice)}` : null,
  ].filter(Boolean);
}

function buildPricingBlock(config, price) {
  const paymentType = config.paymentType ?? 'leasing';
  const rate = paymentType === 'finance'
    ? price.financeRate
    : paymentType === 'cash'
      ? price.cashPrice
      : price.leasingRate;

  return {
    paymentType,
    rate,
    leasingRate: price.leasingRate,
    financeRate: price.financeRate,
    cashPrice: price.cashPrice,
    hauspreis: price.hauspreis ?? price.housePrice,
    configurationPrice: price.configurationPrice,
    termMonths: config.termMonths ?? 48,
    mileagePerYear: config.mileagePerYear ?? 10000,
    downPayment: config.downPayment ?? 0,
    preparationFee: price.preparationFee,
    discountPercent: price.discountPercent,
    discountAmount: price.discountAmount,
    finalPayment: price.finalPayment,
  };
}

function createTrackingMock(sent = false) {
  const now = new Date();
  if (!sent) {
    return {
      sentAt: null,
      openedAt: null,
      lastViewedAt: null,
      openCount: 0,
      events: [],
    };
  }

  const sentAt = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();
  const openedAt = new Date(now.getTime() - 3.8 * 60 * 60 * 1000).toISOString();
  const lastViewedAt = new Date(now.getTime() - 45 * 60 * 1000).toISOString();

  return {
    sentAt,
    openedAt,
    lastViewedAt,
    openCount: 3,
    events: [
      { type: 'sent', at: sentAt, label: 'Angebot versendet' },
      { type: 'opened', at: openedAt, label: 'Angebot geöffnet' },
      { type: 'viewed', at: lastViewedAt, label: 'Zuletzt angesehen' },
    ],
  };
}

export function createOffer({
  config = {},
  customer = {},
  conditions,
  existingOffers = [],
  source = 'manual',
  status = 'entwurf',
  leadId = null,
  price: priceOverride = null,
}) {
  const fullConfig = {
    model: 'Sportage',
    customerGroup: 'standard',
    paymentType: 'leasing',
    termMonths: 48,
    mileagePerYear: 10000,
    downPayment: 0,
    selectedPackageIds: [],
    selectedAccessoryIds: [],
    ...config,
  };

  const price = priceOverride ?? calculatePrice(
    { ...fullConfig, dealerConditions: conditions },
    conditions,
  );

  const engine = sportage.engines.find((e) => e.id === fullConfig.engineId);
  const trim = sportage.trims.find((t) => t.id === fullConfig.trimId);
  const color = sportage.colors.find((c) => c.id === fullConfig.colorId);
  const code = generateOfferNumber(existingOffers);
  const isSent = status === 'versendet' || status === 'geoeffnet';

  return {
    code,
    id: `offer-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    validUntil: defaultValidUntil(),
    status,
    source,
    leadId,
    customer: {
      name: customer.name?.trim() ?? '',
      email: customer.email?.trim() ?? '',
      phone: customer.phone?.trim() ?? '',
    },
    vehicle: {
      brand: sportage.brand,
      model: sportage.model,
      trim: trim?.name ?? '',
      trimId: trim?.id,
      bodyType: 'suv',
      engine: engine?.name ?? '',
      color: color?.name ?? '',
      label: `${sportage.brand} ${sportage.model} ${trim?.name ?? ''}`.trim(),
    },
    configuration: {
      lines: buildConfigLines(fullConfig, price),
      config: { ...fullConfig },
    },
    pricing: buildPricingBlock(fullConfig, price),
    deliveryTime: price.deliveryTime ?? conditions.deliveryTime,
    availability: price.availability ?? null,
    dealer: buildDealerSnapshot(conditions),
    tracking: createTrackingMock(isSent),
  };
}

export function createOfferFromConfig(config, price, conditions, customer = {}, existingOffers = []) {
  const list = Array.isArray(existingOffers)
    ? existingOffers
    : [...(existingOffers ?? [])].map((code) => ({ code }));
  return createOffer({
    config,
    customer,
    conditions,
    existingOffers: list,
    source: 'configurator',
    price,
  });
}

export function createOfferFromAdvisor(customer, rec, conditions, existingOffers = []) {
  const salesPayload = {
    brand: rec.brand,
    model: rec.model,
    variant: rec.variant,
    engineId: rec.engineId,
    trimId: rec.trimId,
    colorId: rec.colorId,
    monthlyRate: rec.monthlyRate,
    availabilityLabel: rec.availabilityLabel,
    deliveryTime: rec.deliveryTime,
    hauspreis: rec.hauspreis,
  };

  const offer = createOfferFromSales(customer, salesPayload, conditions, existingOffers);

  return {
    ...offer,
    source: 'advisor',
    vehicle: {
      ...offer.vehicle,
      brand: rec.brand ?? offer.vehicle.brand,
      model: rec.model ?? offer.vehicle.model,
      trimId: rec.trimId,
      bodyType: rec.bodyType ?? offer.vehicle.bodyType,
      label: rec.fullLabel ?? offer.vehicle.label,
    },
  };
}

export function createOfferFromSales(customer, salesOffer, conditions, existingOffers = []) {
  const list = Array.isArray(existingOffers)
    ? existingOffers
    : [...(existingOffers ?? [])].map((code) => ({ code }));

  if (salesOffer.engineId && salesOffer.trimId) {
    const config = {
      engineId: salesOffer.engineId,
      trimId: salesOffer.trimId,
      colorId: salesOffer.colorId ?? 'carraraweiss',
      selectedPackageIds: salesOffer.packageIds ?? [],
      customerGroup: 'standard',
      paymentType: 'leasing',
      termMonths: customer.termMonths ?? 48,
      mileagePerYear: customer.mileagePerYear ?? 10000,
      downPayment: customer.downPayment ?? 0,
    };
    let price = calculatePrice({ ...config, model: 'Sportage', dealerConditions: conditions }, conditions);
    const rate = salesOffer.monthlyRate ?? salesOffer.staticRate;
    if (rate != null) {
      price = { ...price, leasingRate: rate, primaryRate: rate };
    }
    const offer = createOffer({
      config,
      customer,
      conditions,
      existingOffers: list,
      source: 'sales',
      status: 'entwurf',
      price,
    });
    if (salesOffer.availabilityLabel) {
      offer.availability = { label: salesOffer.availabilityLabel, type: 'lager' };
    }
    if (salesOffer.deliveryTime) {
      offer.deliveryTime = salesOffer.deliveryTime;
    }
    if (salesOffer.hauspreis) {
      offer.pricing.hauspreis = salesOffer.hauspreis;
    }
    return offer;
  }

  const mockRate = salesOffer.monthlyRate ?? salesOffer.staticRate ?? salesOffer.mockRate ?? 0;
  const offer = createOffer({
    config: {
      paymentType: 'leasing',
      termMonths: customer.termMonths ?? 48,
      mileagePerYear: customer.mileagePerYear ?? 10000,
      downPayment: customer.downPayment ?? 0,
    },
    customer,
    conditions,
    existingOffers: list,
    source: 'sales',
    status: 'entwurf',
    price: {
      hauspreis: salesOffer.hauspreis ?? salesOffer.mockHauspreis ?? 0,
      cashPrice: salesOffer.hauspreis ?? salesOffer.mockHauspreis ?? 0,
      leasingRate: mockRate,
      financeRate: salesOffer.pricing?.financeRate ?? Math.round(mockRate * 1.28),
      primaryRate: mockRate,
      preparationFee: conditions.preparationFee,
      deliveryTime: salesOffer.deliveryTime ?? salesOffer.mockDeliveryTime ?? conditions.deliveryTime,
      configurationPrice: salesOffer.hauspreis ?? 0,
    },
  });

  offer.vehicle = {
    brand: salesOffer.brand ?? 'Kia',
    model: salesOffer.model ?? 'Sportage',
    trim: salesOffer.variant ?? '',
    trimId: salesOffer.trimId,
    bodyType: salesOffer.bodyType ?? 'suv',
    engine: offer.vehicle.engine,
    color: offer.vehicle.color,
    label: `${salesOffer.brand ?? 'Kia'} ${salesOffer.model ?? ''} ${salesOffer.variant ?? ''}`.trim(),
  };

  if (!offer.configuration.lines.length) {
    offer.configuration.lines = [
      `${salesOffer.model} ${salesOffer.variant}`,
      `Laufzeit: ${customer.termMonths} Monate`,
      `Laufleistung: ${Number(customer.mileagePerYear).toLocaleString('de-DE')} km/Jahr`,
    ];
  }

  return offer;
}

export function markOfferSent(offer) {
  const now = new Date().toISOString();
  return {
    ...offer,
    status: offer.status === 'entwurf' ? 'versendet' : offer.status,
    updatedAt: now,
    tracking: {
      ...offer.tracking,
      sentAt: offer.tracking?.sentAt ?? now,
      events: [
        ...(offer.tracking?.events ?? []),
        { type: 'sent', at: now, label: 'Angebot versendet' },
      ],
    },
  };
}

export function recordOfferView(offer) {
  const now = new Date().toISOString();
  const isFirstOpen = !offer.tracking?.openedAt;
  const events = [...(offer.tracking?.events ?? [])];

  if (isFirstOpen) {
    events.push({ type: 'opened', at: now, label: 'Angebot geöffnet' });
  }
  events.push({ type: 'viewed', at: now, label: 'Angebot angesehen' });

  return {
    ...offer,
    status: ['entwurf', 'versendet'].includes(offer.status) ? 'geoeffnet' : offer.status,
    updatedAt: now,
    tracking: {
      ...offer.tracking,
      openedAt: offer.tracking?.openedAt ?? now,
      lastViewedAt: now,
      openCount: (offer.tracking?.openCount ?? 0) + 1,
      events,
    },
  };
}

export function formatOfferRate(pricing) {
  if (!pricing?.rate && pricing?.rate !== 0) return '–';
  const formatted = formatPrice(pricing.rate);
  return pricing.paymentType === 'cash' ? formatted : `${formatted}/Monat`;
}

export function getPaymentLabel(paymentType) {
  if (paymentType === 'finance') return 'Finanzierungsrate';
  if (paymentType === 'cash') return 'Kaufpreis';
  return 'Leasingrate';
}

export function buildOfferEmailContent(offer, url) {
  const subject = `Ihr Angebot ${offer.code} – ${offer.vehicle.label}`;
  const body = [
    `Guten Tag${offer.customer.name ? ` ${offer.customer.name}` : ''},`,
    '',
    `hier ist Ihr persönliches Angebot für den ${offer.vehicle.label}:`,
    '',
    `${getPaymentLabel(offer.pricing.paymentType)}: ${formatOfferRate(offer.pricing)}`,
    `Hauspreis: ${formatPrice(offer.pricing.hauspreis)}`,
    `Lieferzeit: ${offer.deliveryTime}`,
    '',
    `Angebot online ansehen: ${url}`,
    '',
    `Angebotsnummer: ${offer.code}`,
    '',
    `Freundliche Grüße`,
    offer.dealer.contact?.name ?? offer.dealer.name,
    offer.dealer.contact?.phone ?? '',
  ].join('\n');

  return { subject, body, mailto: `mailto:${offer.customer.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
}

export function buildOfferWhatsAppMessage(offer, url) {
  return [
    `🚗 Ihr ${offer.vehicle.label}`,
    '',
    `${getPaymentLabel(offer.pricing.paymentType)}: ${formatOfferRate(offer.pricing)}`,
    `Lieferzeit: ${offer.deliveryTime}`,
    '',
    `👉 Angebot ansehen: ${url}`,
    '',
    `${offer.dealer.name} · ${offer.code}`,
  ].join('\n');
}

export function buildWhatsAppSendUrl(offer, url, dealerPhone) {
  const message = buildOfferWhatsAppMessage(offer, url);
  const digits = (dealerPhone ?? offer.dealer.contact?.phone ?? '').replace(/\D/g, '');
  const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(message)}`;
}

export async function copyOfferLink(url) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return true;
  }
  return false;
}

export function printOfferPdf() {
  window.print();
}

export function getOffersForCustomer(offers, customer) {
  const email = customer.email?.trim().toLowerCase();
  const phone = customer.phone?.replace(/\D/g, '');
  if (!email && !phone) return [];

  return offers.filter((o) => {
    const oEmail = o.customer.email?.trim().toLowerCase();
    const oPhone = o.customer.phone?.replace(/\D/g, '');
    return (email && oEmail === email) || (phone && oPhone && oPhone === phone);
  });
}

export function formatTrackingDate(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getSourceLabel(source) {
  return OFFER_SOURCES[source] ?? source ?? '–';
}
