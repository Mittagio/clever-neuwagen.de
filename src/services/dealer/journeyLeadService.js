/**
 * Phase 6 – Lead aus Customer Journey (nahezu fertiger Auftrag).
 */
import { LEAD_SOURCES } from '../../data/leadTypes.js';
import { getPurchaseTypeLabel, shouldShowAllPaymentVariants } from './purchaseTypeOptions.js';
import { getSpecialConditionLabels } from './specialConditionOptions.js';
import { buildJourneyOffers } from './journeyOfferService.js';

function uid(prefix = 'lead') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function historyEntry(text, type = 'system') {
  return {
    id: uid('hist'),
    at: new Date().toISOString(),
    type,
    text,
  };
}

function resolvePrimaryRate(offerBundle, purchaseType) {
  const p = offerBundle?.pricing;
  if (!p) return null;
  if (purchaseType === 'cash') return p.cashPrice;
  if (purchaseType === 'finance') return p.financeRate;
  if (purchaseType === 'leasing') return p.leasingRate;
  if (shouldShowAllPaymentVariants(purchaseType)) return p.leasingRate ?? p.financeRate;
  return p.leasingRate ?? p.financeRate ?? p.cashPrice;
}

function resolvePaymentTypeForLead(purchaseType) {
  if (purchaseType === 'open') return 'leasing';
  if (purchaseType === 'finance') return 'finance';
  if (purchaseType === 'cash') return 'cash';
  return purchaseType ?? 'leasing';
}

/**
 * @param {object} params
 */
export function buildJourneyInquiryBrief({
  contact,
  journeySnapshot,
  offerBundle,
  cleverQuote,
  searchQuery = '',
  dealer = null,
}) {
  const vehicle = journeySnapshot?.vehicle ?? {};
  const purchaseLabel = getPurchaseTypeLabel(journeySnapshot?.purchaseType);
  const conditionLabels = journeySnapshot?.specialConditionLabels
    ?? getSpecialConditionLabels(journeySnapshot?.specialConditions);

  const primaryOffer = offerBundle?.offers?.find(
    (o) => o.id === journeySnapshot?.purchaseType,
  ) ?? offerBundle?.offers?.[0];

  return {
    customerName: contact?.name?.trim() ?? '',
    cleverQuotePercent: cleverQuote?.percent ?? null,
    cleverQuoteSnapshot: cleverQuote
      ? {
          percent: cleverQuote.percent ?? null,
          matched: cleverQuote.matched ?? null,
          scorableTotal: cleverQuote.scorableTotal ?? null,
          trustNote: cleverQuote.trustNote ?? null,
        }
      : null,
    searchQuery: searchQuery?.trim() || null,
    recommended: {
      title: offerBundle?.vehicleTitle ?? `${vehicle.modelLabel ?? 'Kia'} ${vehicle.trimLabel ?? ''}`.trim(),
      modelKey: vehicle.modelKey ?? null,
    },
    configuration: {
      color: vehicle.colorLabel ?? null,
      powertrain: vehicle.powertrainLabel ?? null,
      trim: vehicle.trimLabel ?? null,
      packages: vehicle.packageLabels ?? [],
    },
    variant: {
      payment: resolvePaymentTypeForLead(journeySnapshot?.purchaseType),
      paymentLabel: shouldShowAllPaymentVariants(journeySnapshot?.purchaseType)
        ? 'Kauf · Finanzierung · Leasing (Vergleich)'
        : purchaseLabel,
      priceLabel: primaryOffer?.headline ?? null,
      lines: primaryOffer?.lines?.map((l) => `${l.label}: ${l.value}`) ?? [],
    },
    specialConditions: conditionLabels,
    dealer: dealer?.dealerName
      ? { name: dealer.dealerName, city: dealer.city ?? null }
      : null,
    deliveryLabel: offerBundle?.pricing?.deliveryTime
      ? `Lieferzeit: ${offerBundle.pricing.deliveryTime}`
      : null,
  };
}

/** @param {object} brief */
export function formatJourneyLeadDossierLines(brief) {
  if (!brief) return [];

  const lines = [];
  if (brief.customerName) lines.push(`Kunde: ${brief.customerName}`);
  if (brief.recommended?.title) lines.push(`Fahrzeug: ${brief.recommended.title}`);
  if (brief.configuration?.trim) lines.push(`Ausstattung: ${brief.configuration.trim}`);
  if (brief.configuration?.color) lines.push(`Farbe: ${brief.configuration.color}`);
  if (brief.configuration?.packages?.length) {
    lines.push(`Extras: ${brief.configuration.packages.join(', ')}`);
  }
  if (brief.variant?.paymentLabel) lines.push(`Kaufart: ${brief.variant.paymentLabel}`);
  if (brief.variant?.lines?.length) {
    brief.variant.lines.forEach((l) => lines.push(l));
  } else if (brief.variant?.priceLabel) {
    lines.push(brief.variant.priceLabel);
  }
  if (brief.specialConditions?.length) {
    lines.push(`Sonderkondition: ${brief.specialConditions.join(', ')}`);
  }
  if (brief.cleverQuotePercent != null) {
    lines.push(`CleverQuote: ${brief.cleverQuotePercent} %`);
  }
  if (brief.searchQuery) lines.push(`Ausgangssuche: ${brief.searchQuery}`);
  if (brief.deliveryLabel) lines.push(brief.deliveryLabel);
  return lines;
}

/**
 * @param {object} params
 */
export function createLeadFromJourney({
  contact,
  journeySnapshot,
  offerBundle,
  cleverQuote = null,
  searchQuery = '',
  dealerConditions,
  message = '',
}) {
  const vehicle = journeySnapshot?.vehicle ?? {};
  const paymentType = resolvePaymentTypeForLead(journeySnapshot?.purchaseType);
  const desiredRate = resolvePrimaryRate(offerBundle, journeySnapshot?.purchaseType);

  const inquiryBrief = buildJourneyInquiryBrief({
    contact,
    journeySnapshot,
    offerBundle,
    cleverQuote,
    searchQuery,
    dealer: dealerConditions,
  });

  const dossierLines = formatJourneyLeadDossierLines(inquiryBrief);

  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'neu',
    source: 'dealerJourney',
    dealerId: dealerConditions?.dealerId ?? dealerConditions?.slug ?? 'autohaus-trinkle',
    contact: {
      name: contact.name?.trim() ?? '',
      phone: contact.phone?.trim() ?? '',
      email: contact.email?.trim() ?? '',
    },
    vehicle: {
      brand: 'Kia',
      model: vehicle.modelLabel ?? 'Sorento',
      trim: vehicle.trimLabel ?? '',
      engine: vehicle.powertrainLabel ?? '',
      label: inquiryBrief.recommended?.title ?? 'Kia Sorento',
    },
    paymentType,
    desiredRate,
    currentRate: desiredRate,
    cleverQuotePercent: inquiryBrief.cleverQuotePercent,
    inquiryBrief,
    journeySnapshot,
    wish: {
      paymentType,
      customerGroup: journeySnapshot?.discountGroup ?? 'standard',
      termMonths: offerBundle?.pricing?.leasingTermMonths ?? 48,
      mileagePerYear: offerBundle?.pricing?.leasingMileagePerYear ?? 15000,
    },
    sonderwuensche: {
      specialConditions: journeySnapshot?.specialConditions ?? [],
      configuration: inquiryBrief.configuration,
    },
    notes: dossierLines.join('\n'),
    history: [
      historyEntry(`Anfrage über ${LEAD_SOURCES.dealerJourney}`),
      historyEntry('Journey: Beratung → Konfiguration → Kaufart → Sonderkonditionen → Angebot'),
      ...dossierLines.map((line) => historyEntry(line, 'note')),
      ...(message ? [historyEntry(`Nachricht: ${message}`, 'note')] : []),
    ],
  };
}

/**
 * @param {object} journeySnapshot
 * @param {object} dealerConditions
 */
export function prepareJourneyLeadContext(journeySnapshot, dealerConditions) {
  const offerBundle = buildJourneyOffers(journeySnapshot, dealerConditions);
  return { offerBundle };
}
