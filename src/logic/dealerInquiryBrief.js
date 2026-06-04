import { formatCurrency } from './marketplaceService.js';
import { formatDealerDeliveryLabel } from './discoveryDisplay.js';
import { partitionCleverQuoteItems } from '../services/cleverQuote/cleverQuoteService.js';
import { getFeatureLabel } from '../data/features/featureCatalog.js';

function wishLabelsFromSelection(detailSelection, recommendationResult) {
  const ids = detailSelection?.selectedFeatures ?? [];
  return ids.map((id) =>
    recommendationResult?.includedFeatures?.find((f) => f.id === id)?.label
    ?? recommendationResult?.requestedFeatures?.find((f) => f.id === id)?.label
    ?? getFeatureLabel(id)
    ?? id,
  );
}

function buildVariantBlock(detailSelection, displayPrice, pricing) {
  const payment = pricing?.payment ?? detailSelection?.paymentMode ?? 'leasing';
  const normalized = payment === 'financing' ? 'finance' : payment;
  const termMonths = detailSelection?.termMonths ?? pricing?.termMonths ?? 48;
  const mileagePerYear = detailSelection?.mileagePerYear ?? pricing?.mileagePerYear ?? 10000;
  const downPayment = detailSelection?.downPayment ?? pricing?.downPayment ?? 0;

  const lines = [];
  const paymentLabels = {
    leasing: 'Leasing',
    finance: 'Finanzierung',
    cash: 'Kauf',
  };

  if (normalized === 'leasing') {
    lines.push(`Leasing · ${termMonths} Monate`);
    lines.push(`${Number(mileagePerYear).toLocaleString('de-DE')} km/Jahr`);
    lines.push(downPayment > 0 ? `${formatCurrency(downPayment)} Anzahlung` : '0 € Anzahlung');
  } else if (normalized === 'finance') {
    lines.push(`Finanzierung · ${termMonths} Monate`);
    if (downPayment > 0) lines.push(`${formatCurrency(downPayment)} Anzahlung`);
  } else if (normalized === 'cash') {
    lines.push('Kaufpreis');
  }

  return {
    payment: normalized,
    paymentLabel: paymentLabels[normalized] ?? paymentLabels.leasing,
    termMonths,
    mileagePerYear,
    downPayment,
    priceLabel: displayPrice?.label ?? '',
    priceSubtitle: displayPrice?.subtitle ?? lines.join(' · '),
    lines,
  };
}

function buildCleverQuoteSnapshot(cleverQuote) {
  if (!cleverQuote) return null;
  const { fulfilled, packageNeeded, missing, uncertain } = partitionCleverQuoteItems(cleverQuote);
  return {
    percent: cleverQuote.percent ?? null,
    matched: cleverQuote.matched ?? fulfilled.length,
    scorableTotal: cleverQuote.scorableTotal ?? null,
    fulfilled: fulfilled.map((i) => ({ id: i.id, label: i.label })),
    optional: packageNeeded.map((i) => ({ id: i.id, label: i.label })),
    missing: missing.map((i) => ({ id: i.id, label: i.label })),
    uncertain: uncertain.map((i) => ({ id: i.id, label: i.label })),
    trustNote: cleverQuote.trustNote ?? null,
  };
}

/**
 * Sprint 40 – Strukturierter Händler-Brief (Anfragequalität statt Anfrageanzahl)
 */
export function buildDealerInquiryBrief({
  contactName = '',
  displayTitle,
  displayPrice,
  detailSelection,
  recommendationResult,
  cleverQuote,
  wishes,
  wishAlternatives = [],
  dealer,
  vehicle,
  pricing,
}) {
  const cqSnapshot = buildCleverQuoteSnapshot(cleverQuote);
  const budgetMax = wishes?.budget?.maxMonthlyRate ?? null;
  const selectedWishLabels = wishLabelsFromSelection(detailSelection, recommendationResult);

  const fulfilledWishes = cqSnapshot?.fulfilled?.map((i) => i.label)
    ?? selectedWishLabels.map((l) => l);
  const optionalWishes = cqSnapshot?.optional?.map((i) => i.label) ?? [];

  const alternatives = wishAlternatives.slice(0, 3).map((alt) => ({
    title: alt.title,
    cleverQuotePercent: alt.matched && alt.total
      ? Math.round((alt.matched / alt.total) * 100)
      : null,
    priceLabel: alt.priceLabel ?? '',
    slug: alt.slug,
  }));

  const variant = buildVariantBlock(detailSelection, displayPrice, pricing);
  const deliveryLabel = formatDealerDeliveryLabel(dealer, vehicle);

  return {
    customerName: contactName?.trim() ?? '',
    cleverQuotePercent: cqSnapshot?.percent ?? null,
    cleverQuoteSnapshot: cqSnapshot,
    budget: budgetMax
      ? { maxMonthly: budgetMax, label: `bis ${budgetMax} €/Monat` }
      : null,
    wishes: {
      fulfilled: fulfilledWishes,
      optional: optionalWishes,
      selected: selectedWishLabels,
    },
    recommended: {
      title: displayTitle ?? vehicle?.title ?? '',
      slug: vehicle?.slug ?? '',
    },
    alternatives,
    variant,
    deliveryLabel,
    deliveryImportant: Boolean(deliveryLabel && !/sofort/i.test(deliveryLabel)),
    dealer: dealer?.name
      ? { name: dealer.name, distanceKm: dealer.distanceKm ?? null }
      : null,
    packageRecommendation: recommendationResult?.requiredPackages?.[0]?.name ?? null,
  };
}

/** Flache Zeilen für Historie / Legacy notes */
export function formatDealerInquiryBriefLines(brief) {
  if (!brief) return [];
  const lines = [];
  if (brief.customerName) lines.push(brief.customerName);
  if (brief.cleverQuotePercent != null) lines.push(`${brief.cleverQuotePercent} % CleverQuote`);
  if (brief.budget?.label) lines.push(`Budget: ${brief.budget.label}`);
  if (brief.wishes?.fulfilled?.length) {
    lines.push('Wünsche erfüllt:');
    brief.wishes.fulfilled.forEach((w) => lines.push(`✓ ${w}`));
  }
  if (brief.wishes?.optional?.length) {
    lines.push('Optional / Paket:');
    brief.wishes.optional.forEach((w) => lines.push(`+ ${w}`));
  }
  if (brief.cleverQuoteSnapshot?.missing?.length) {
    lines.push('Nicht erfüllt:');
    brief.cleverQuoteSnapshot.missing.forEach((i) => lines.push(`✗ ${i.label}`));
  }
  if (brief.cleverQuoteSnapshot?.uncertain?.length) {
    lines.push('Unklar:');
    brief.cleverQuoteSnapshot.uncertain.forEach((i) => lines.push(`? ${i.label}`));
  }
  if (brief.packageRecommendation) lines.push(`Paket: ${brief.packageRecommendation}`);
  if (brief.dealer?.name) {
    const dist = brief.dealer.distanceKm != null ? ` (${brief.dealer.distanceKm} km)` : '';
    lines.push(`Händler: ${brief.dealer.name}${dist}`);
  }
  if (brief.recommended?.title) lines.push(`Empfohlen: ${brief.recommended.title}`);
  if (brief.alternatives?.length) {
    lines.push('Alternativen:');
    brief.alternatives.forEach((a) => {
      const pct = a.cleverQuotePercent != null ? ` (${a.cleverQuotePercent} %)` : '';
      lines.push(`${a.title}${pct}`);
    });
  }
  if (brief.variant?.lines?.length) {
    lines.push('Gewählte Zahlungsart:');
    brief.variant.lines.forEach((l) => lines.push(l));
  } else if (brief.variant?.paymentLabel) {
    lines.push(`Gewählte Zahlungsart: ${brief.variant.paymentLabel}`);
  }
  if (brief.variant?.priceLabel) lines.push(brief.variant.priceLabel);
  if (brief.deliveryLabel) lines.push(brief.deliveryLabel);
  return lines;
}

export function getLeadBriefPreview(brief) {
  if (!brief) return null;
  const parts = [];
  if (brief.cleverQuotePercent != null) parts.push(`${brief.cleverQuotePercent} %`);
  if (brief.budget?.maxMonthly) parts.push(`Budget ${brief.budget.maxMonthly} €`);
  const topWish = brief.wishes?.fulfilled?.[0];
  if (topWish) parts.push(topWish);
  return parts.join(' · ') || brief.recommended?.title || null;
}
