/**
 * Wording & Darstellung Kunden-Beratung (unverbindlich, Verkäufer prüft).
 */
import { getEquipmentWishChip } from '../../data/features/equipmentWishChips.js';
import { getCustomerAdvisorWishChip } from '../../data/features/customerAdvisorChipGroups.js';

export const CUSTOMER_ADVISOR_COPY = {
  wishesHeadline: (modelName) => `Was ist Ihnen beim ${modelName} wichtig?`,
  wishesSubline: 'Wählen Sie einfach aus – das Autohaus prüft die passende Variante.',
  showAssessmentCta: 'Clever Einschätzung anzeigen',
  assessmentTitle: 'Clever Einschätzung',
  couldFitTitle: 'Das könnte passen',
  directionTitle: 'Passende Richtung',
  reserveCta: 'Für Verkäufer vormerken',
  disclaimer: 'Die finale Ausstattung und Verfügbarkeit prüft Ihr Autohaus.',
  disclaimerAlt: 'Clever grenzt nur ein – Ihr Autohaus bestätigt die passende Variante.',
  completionHeadline: 'Clever hat eine Richtung gefunden',
  completionText: 'Clever kennt viele Fahrzeugdaten – Ihr Verkäufer kennt die passende Lösung.',
  completionHint: 'Die finale Ausstattung, Verfügbarkeit und Rate bestätigt Ihr Autohaus.',
  contactCta: 'Experte soll mich kontaktieren',
  editCta: 'Angaben ändern',
  fulfilledHeading: 'Erfüllt wahrscheinlich',
  checkHeading: 'Bitte prüfen',
};

const TRIM_ROLE_BY_PATTERN = [
  { pattern: /\bair\b/i, role: 'preisbewusste Richtung' },
  { pattern: /\bearth\b/i, role: 'ausgewogene Richtung' },
  { pattern: /\bgt[- ]?line\b/i, role: 'viel Ausstattung / Design' },
  { pattern: /\bcore\b/i, role: 'preisbewusste Richtung' },
  { pattern: /\bvision\b/i, role: 'ausgewogene Richtung' },
  { pattern: /\bspirit\b/i, role: 'viel Ausstattung / Design' },
];

/**
 * @param {{ trimName?: string, trimId?: string }} trim
 * @param {number} index
 * @param {number} total
 */
export function resolveCustomerTrimRole(trim, index = 0, total = 1) {
  const hay = `${trim.trimName ?? ''} ${trim.trimId ?? ''}`;
  for (const { pattern, role } of TRIM_ROLE_BY_PATTERN) {
    if (pattern.test(hay)) return role;
  }
  if (total <= 1) return 'passende Richtung';
  if (index === 0) return 'preisbewusste Richtung';
  if (index === total - 1) return 'viel Ausstattung / Design';
  if (index === 1 && total >= 3) return 'ausgewogene Richtung';
  return 'passende Richtung';
}

/**
 * @param {object} line
 * @param {number} index
 * @param {number} total
 */
export function presentCustomerTrimLine(line, index, total) {
  const openPoints = [
    ...(line.uncertain ?? []).map((item) => `${item} – vom Autohaus prüfen lassen`),
    ...(line.missing ?? []),
    ...(line.packageNeeded ?? []).map((item) => `Paket: ${item}`),
    'Paketverfügbarkeit',
  ].filter(Boolean);

  const uniqueOpen = [...new Set(openPoints)].slice(0, 4);

  return {
    ...line,
    badge: null,
    recommended: false,
    roleLabel: resolveCustomerTrimRole(line, index, total),
    description: resolveCustomerTrimRole(line, index, total),
    fulfilledHeading: CUSTOMER_ADVISOR_COPY.fulfilledHeading,
    checkHeading: CUSTOMER_ADVISOR_COPY.checkHeading,
    fulfilledItems: line.fulfilled ?? [],
    openPoints: uniqueOpen,
    ctaLabel: CUSTOMER_ADVISOR_COPY.reserveCta,
  };
}

/**
 * @param {object} analysis
 * @param {string} modelLabel
 */
export function buildCustomerAssessmentSummary(analysis, modelLabel = '') {
  const lines = analysis.trimLines ?? [];
  if (!lines.length) {
    return {
      headline: CUSTOMER_ADVISOR_COPY.assessmentTitle,
      directionLabel: modelLabel,
      reasons: ['Ihre Wünsche werden vom Autohaus geprüft'],
      openPoints: [],
      trimIds: [],
      isMultiDirection: false,
    };
  }

  const sorted = [...lines].sort((a, b) => (b.matchPercent ?? 0) - (a.matchPercent ?? 0));
  const top = sorted[0];
  const second = sorted[1];
  const closeSecond = second
    && top.matchPercent != null
    && second.matchPercent != null
    && top.matchPercent - second.matchPercent <= 12;

  const trimNames = closeSecond
    ? [top.trimName, second.trimName]
    : [top.trimName];

  const directionLabel = trimNames
    .map((name) => (modelLabel ? `${modelLabel} ${name}`.trim() : name))
    .join(' oder ');

  const reasons = [];
  if (analysis.hasWishes) {
    reasons.push('viele Ihrer Wünsche werden abgedeckt');
  }
  const role = resolveCustomerTrimRole(top, lines.findIndex((l) => l.trimId === top.trimId), lines.length);
  if (role.includes('ausgewogen')) {
    reasons.push('gute Mischung aus Preis und Ausstattung');
  } else if (role.includes('preisbewusst')) {
    reasons.push('eher preisbewusste Ausstattungslinie');
  } else if (role.includes('Ausstattung')) {
    reasons.push('eher umfangreiche Ausstattung und Design');
  }

  if (closeSecond) {
    reasons.push('Ihre Wünsche betreffen Ausstattung, die je nach Linie unterschiedlich ist');
    reasons.push('das Autohaus prüft die passende Kombination');
  }

  const uncertain = [...new Set(lines.flatMap((l) => l.uncertain ?? []))].slice(0, 3);
  uncertain.forEach((item) => {
    reasons.push(`${item} bitte vom Autohaus prüfen lassen`);
  });

  const openPoints = [
    ...new Set([
      ...(top.missing ?? []),
      ...(top.uncertain ?? []),
      ...(lines.flatMap((l) => l.missing ?? [])),
    ]),
  ].slice(0, 5);

  return {
    headline: closeSecond ? CUSTOMER_ADVISOR_COPY.directionTitle : CUSTOMER_ADVISOR_COPY.couldFitTitle,
    directionLabel,
    reasons: reasons.slice(0, 4),
    openPoints,
    trimIds: closeSecond ? [top.trimId, second.trimId] : [top.trimId],
    isMultiDirection: Boolean(closeSecond),
  };
}

/**
 * @param {string[]} selectedChipIds
 * @param {object[]} searchedFeatures
 */
export function resolveSelectedWishLabels(selectedChipIds = [], searchedFeatures = []) {
  const labels = selectedChipIds.map((id) => {
    const chip = getCustomerAdvisorWishChip(id) ?? getEquipmentWishChip(id);
    return chip?.label ?? id;
  });
  for (const item of searchedFeatures) {
    if (item?.label && !labels.includes(item.label)) labels.push(item.label);
  }
  return labels;
}

/**
 * @param {object} params
 */
export function buildCustomerWishPayload({
  modelKey,
  modelLabel,
  selectedChipIds = [],
  searchedFeatures = [],
  analysis = {},
  reservedTrimId = null,
  reservedTrimName = null,
  possibleTrimIds = [],
  openCheckpoints = [],
}) {
  const assessment = buildCustomerAssessmentSummary(analysis, modelLabel);
  const trimLines = analysis.trimLines ?? [];
  const reservedLine = trimLines.find((l) => l.trimId === reservedTrimId);

  return {
    source: 'customer_advisor',
    modelKey,
    modelLabel,
    selectedChips: resolveSelectedWishLabels(selectedChipIds, searchedFeatures),
    selectedChipIds,
    searchTerms: searchedFeatures.map((f) => f.label ?? f.query ?? f.id).filter(Boolean),
    possibleTrims: possibleTrimIds.length
      ? possibleTrimIds.map((id) => trimLines.find((l) => l.trimId === id)?.trimName ?? id)
      : assessment.trimIds.map((id) => trimLines.find((l) => l.trimId === id)?.trimName ?? id),
    reservedTrim: reservedTrimName ?? reservedLine?.trimName ?? null,
    reservedTrimId,
    openCheckpoints: openCheckpoints.length
      ? openCheckpoints
      : assessment.openPoints,
    assessmentHeadline: assessment.headline,
    assessmentDirection: assessment.directionLabel,
    assessmentReasons: assessment.reasons,
    statusHint: 'Kunde wünscht Kontakt',
  };
}
