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

  return (
    <CustomerInquiryModal
      title={title}
      inquirySummary={{ lines, pricing: displayPrice?.raw }}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
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
