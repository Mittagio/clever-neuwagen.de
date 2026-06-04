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

export function buildInquiryChecklist({
  displayTitle,
  detailSelection,
  displayPrice,
  dealer,
}) {
  const wishCount = detailSelection?.selectedFeatures?.length ?? 0;
  const termLabel = displayPrice?.subtitle
    ?? (detailSelection?.termMonths
      ? `${detailSelection.termMonths} Monate`
      : null);

  return [
    { label: 'Fahrzeug', value: displayTitle, done: Boolean(displayTitle) },
    { label: 'Ausstattung', value: wishCount ? `${wishCount} Wünsche` : 'Serienausstattung', done: true },
    { label: 'Preis', value: displayPrice?.label ?? '', done: Boolean(displayPrice?.label) },
    { label: 'Laufzeit', value: termLabel ?? 'Standard', done: true },
    { label: 'Ihre Wünsche', value: wishCount ? 'übermittelt' : 'optional', done: wishCount > 0 },
    { label: 'Händler', value: dealer?.name ?? '', done: Boolean(dealer?.name) },
  ].filter((item) => item.done || item.label === 'Ihre Wünsche');
}

export function buildCompactSummary({
  displayTitle,
  detailSelection,
  recommendationResult,
  displayPrice,
  dealer,
}) {
  const checklist = buildInquiryChecklist({
    displayTitle,
    detailSelection,
    displayPrice,
    dealer,
  });

  return {
    vehicleTitle: displayTitle,
    priceLabel: displayPrice?.label ?? '',
    priceSubtitle: displayPrice?.subtitle ?? '',
    checklist,
    bullets: checklist.map((c) => `${c.label}: ${c.value}`).slice(0, 5),
  };
}

function buildStructuredSummary({
  displayTitle,
  detailSelection,
  recommendationResult,
  displayPrice,
  dealer,
}) {
  const lines = ['Der Händler erhält folgende Informationen:'];

  buildInquiryChecklist({ displayTitle, detailSelection, displayPrice, dealer }).forEach((item) => {
    if (item.value) lines.push(`✓ ${item.label}: ${item.value}`);
  });

  const wishes = detailSelection.selectedFeatures?.map((id) =>
    recommendationResult?.includedFeatures?.find((f) => f.id === id)?.label
    ?? recommendationResult?.requestedFeatures?.find((f) => f.id === id)?.label
    ?? id,
  ) ?? [];

  if (wishes.length) {
    lines.push('Ausstattungswünsche im Detail:');
    wishes.forEach((w) => lines.push(`· ${w}`));
  }

  const pkg = recommendationResult?.requiredPackages?.[0];
  if (pkg) {
    lines.push(`Empfohlenes Paket: ${pkg.name}`);
  }

  return lines;
}
