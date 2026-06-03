import CustomerInquiryModal from '../customer/CustomerInquiryModal.jsx';

/**
 * Anfrage-Modal mit strukturierter Zusammenfassung aus detailSelection + recommendationResult.
 */
export default function InquirySummaryModal({
  open,
  title,
  detailSelection,
  recommendationResult,
  displayPrice,
  displayTitle,
  dealer,
  onClose,
  onSubmit,
}) {
  if (!open) return null;

  const lines = buildStructuredSummary({
    displayTitle,
    detailSelection,
    recommendationResult,
    displayPrice,
    dealer,
  });
  const compact = buildCompactSummary({
    displayTitle,
    detailSelection,
    recommendationResult,
    displayPrice,
    dealer,
  });

  return (
    <CustomerInquiryModal
      title={title}
      inquirySummary={{ lines, compact, pricing: displayPrice?.raw }}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

export function buildCompactSummary({
  displayTitle,
  detailSelection,
  recommendationResult,
  displayPrice,
  dealer,
}) {
  const wishLabels = detailSelection.selectedFeatures?.map((id) =>
    recommendationResult?.includedFeatures?.find((f) => f.id === id)?.label
    ?? recommendationResult?.requestedFeatures?.find((f) => f.id === id)?.label
    ?? id,
  ) ?? [];

  const bullets = [];
  wishLabels.slice(0, 2).forEach((w) => bullets.push(w));
  if (dealer?.name) {
    bullets.push(`${dealer.name}${dealer.distanceKm != null ? ` · ${dealer.distanceKm} km` : ''}`);
  }

  return {
    vehicleTitle: displayTitle,
    priceLabel: displayPrice?.label ?? '',
    priceSubtitle: displayPrice?.subtitle ?? '',
    bullets: bullets.filter(Boolean).slice(0, 3),
  };
}

function buildStructuredSummary({
  displayTitle,
  detailSelection,
  recommendationResult,
  displayPrice,
  dealer,
}) {
  const lines = [`Sie fragen an:`, displayTitle];

  if (displayPrice?.subtitle) {
    lines.push(displayPrice.subtitle);
  }
  lines.push(displayPrice?.label ?? '');

  const wishes = detailSelection.selectedFeatures?.map((id) =>
    recommendationResult?.includedFeatures?.find((f) => f.id === id)?.label
    ?? recommendationResult?.requestedFeatures?.find((f) => f.id === id)?.label
    ?? id,
  ) ?? [];

  if (wishes.length) {
    lines.push('Ihre Wünsche:');
    wishes.forEach((w) => lines.push(`· ${w}`));
  }

  const serial = recommendationResult?.includedFeatures ?? [];
  if (serial.length) {
    lines.push('Bereits enthalten:');
    serial.forEach((f) => lines.push(`· ${f.label}`));
  }

  const pkg = recommendationResult?.requiredPackages?.[0];
  if (pkg) {
    lines.push('Empfohlenes Paket:');
    lines.push(`· ${pkg.name}`);
    const bonus = pkg.features.filter((f) => f.reason === 'bonus');
    if (bonus.length) {
      lines.push('Zusätzlich enthalten:');
      bonus.forEach((f) => lines.push(`· ${f.label}`));
    }
  }

  if (dealer?.name) {
    lines.push(`Händler: ${dealer.name} · ${dealer.distanceKm} km`);
  }

  return lines;
}
