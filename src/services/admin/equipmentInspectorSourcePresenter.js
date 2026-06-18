/**
 * Verkäuferansicht: Quellen-Details für Ausstattungsmerkmale (Inspector-only).
 */
import { getGlobalFeatureById } from '../../data/features/globalFeatureCatalog.js';
import { FEATURE_AVAILABILITY_STATUS as S } from '../../data/features/modelEquipmentSchema.js';

const CONFIDENCE_RANK = {
  manual_verified: 1000,
  high: 300,
  medium: 200,
  low: 100,
};

/**
 * @param {import('../../data/features/modelEquipmentSchema.js').EquipmentSourceRef | string | null | undefined} sourceRef
 */
export function normalizeInspectorSourceRef(sourceRef) {
  if (!sourceRef) {
    return { document: null, section: null, page: null, rawText: null, url: null };
  }
  if (typeof sourceRef === 'string') {
    return { document: sourceRef, section: null, page: null, rawText: null, url: null };
  }
  return {
    document: sourceRef.document ?? null,
    section: sourceRef.section ?? null,
    page: sourceRef.page ?? null,
    rawText: sourceRef.rawText ?? null,
    url: sourceRef.url ?? null,
  };
}

/**
 * @param {object} sourceBlock
 */
export function hasInspectableSource(sourceBlock) {
  if (!sourceBlock) return false;
  return Boolean(
    sourceBlock.document
    || sourceBlock.section
    || sourceBlock.rawText
    || sourceBlock.page != null
    || sourceBlock.url,
  );
}

/**
 * @param {string} status
 * @param {string | null} [packageName]
 */
export function describeInspectorFeatureStatus(status, packageName = null) {
  if (status === S.STANDARD) return 'serienmäßig verfügbar';
  if (status === S.AVAILABLE) return 'verfügbar';
  if (status === S.OPTIONAL) return 'optional verfügbar';
  if (status === S.PACKAGE_REQUIRED) {
    return packageName ? `über ${packageName} erhältlich` : 'über Paket erhältlich';
  }
  if (status === S.NOT_AVAILABLE) return 'nicht verfügbar';
  return 'unklar';
}

/**
 * @param {object} entry
 * @param {object} [profileSource]
 */
export function buildSourceBlockFromEntry(entry, profileSource = null) {
  const sourceRef = normalizeInspectorSourceRef(entry.sourceRef);
  const entrySource = entry.source ?? null;

  return {
    document: sourceRef.document,
    sourceType: entrySource?.type ?? profileSource?.type ?? null,
    validFrom: entrySource?.validFrom ?? profileSource?.validFrom ?? null,
    page: sourceRef.page,
    section: sourceRef.section,
    rawText: sourceRef.rawText,
    url: sourceRef.url,
    confidence: entry.confidence ?? entrySource?.confidence ?? profileSource?.confidence ?? 'medium',
    trimId: entry.trimId ?? null,
    trimName: entry.trimName ?? entry.trimId ?? null,
    status: entry.status ?? null,
    packageName: entry.packageName ?? null,
    isManualVerified: entry.confidence === 'manual_verified'
      || entrySource?.type === 'admin_override'
      || entrySource?.confidence === 'manual_verified',
  };
}

/**
 * @param {object} sourceBlock
 */
export function getSourceSortPriority(sourceBlock) {
  const confidenceKey = sourceBlock.isManualVerified
    ? 'manual_verified'
    : (sourceBlock.confidence ?? 'medium');
  const confidenceScore = CONFIDENCE_RANK[confidenceKey] ?? CONFIDENCE_RANK.medium;
  const validFromTs = Date.parse(sourceBlock.validFrom ?? '') || 0;
  return confidenceScore * 1_000_000_000_000 + validFromTs;
}

/**
 * @param {object[]} sourceBlocks
 */
export function sortSourceBlocks(sourceBlocks) {
  return [...sourceBlocks].sort((a, b) => getSourceSortPriority(b) - getSourceSortPriority(a));
}

/**
 * @param {object[]} sourceBlocks
 */
export function detectSourceContradictions(sourceBlocks) {
  const statusByTrim = new Map();

  for (const block of sourceBlocks) {
    if (!block.trimId || !block.status) continue;
    const key = block.trimId;
    if (!statusByTrim.has(key)) statusByTrim.set(key, new Set());
    statusByTrim.get(key).add(block.status);
  }

  for (const statuses of statusByTrim.values()) {
    if (statuses.size > 1) return true;
  }

  const allStatuses = new Set(sourceBlocks.map((block) => block.status).filter(Boolean));
  return allStatuses.size > 1;
}

/**
 * @param {object} detail
 */
export function buildFeatureSourceCopyText(detail) {
  const modelLine = [detail.brand, detail.model, detail.modelYear].filter(Boolean).join(' ');
  const statusText = describeInspectorFeatureStatus(detail.status, detail.packageName);
  const primary = detail.sources[0];

  const parts = [
    `${modelLine} – ${detail.featureLabel}: ${statusText}.`,
  ];

  if (primary?.document) {
    const sourceBits = [`Quelle: ${primary.document}`];
    if (primary.section) sourceBits.push(`Abschnitt ${primary.section}`);
    if (primary.page != null) sourceBits.push(`Seite ${primary.page}`);
    parts.push(`${sourceBits.join(', ')}.`);
  } else {
    parts.push('Keine Quelle hinterlegt.');
  }

  if (primary?.confidence) {
    parts.push(`Confidence: ${primary.confidence}.`);
  }

  return parts.join(' ');
}

/**
 * @param {object} params
 * @param {object} params.row
 * @param {object} params.context
 * @param {object[]} [params.reviewItems]
 */
export function buildFeatureSourceDetailFromRow({ row, context, reviewItems = [] }) {
  const entry = (context.profile?.featureAvailability ?? []).find(
    (item) => item.featureId === row.featureId && item.trimId === row.trimId,
  ) ?? {
    featureId: row.featureId,
    trimId: row.trimId,
    trimName: row.trimName,
    status: row.status,
    packageName: row.packageName,
    confidence: row.confidence,
    sourceRef: {
      document: row.sourceDocument,
      section: row.sourceSection,
      page: row.sourcePage,
      rawText: row.rawText,
      url: row.sourceUrl,
    },
  };

  const sourceBlock = buildSourceBlockFromEntry(entry, context.source);
  const sources = sortSourceBlocks([sourceBlock]);
  const contradictory = detectSourceContradictions(sources);
  const hasReviewContradiction = reviewItems.some(
    (item) => item.type === 'contradiction' && item.featureId === row.featureId,
  );

  const detail = {
    featureLabel: row.featureLabel,
    featureId: row.featureId,
    brand: context.brand,
    model: context.model,
    modelYear: context.modelYear,
    trimName: row.trimName,
    trimId: row.trimId,
    status: row.status,
    statusDescription: describeInspectorFeatureStatus(row.status, row.packageName),
    packageName: row.packageName,
    confidence: row.confidence,
    hasSource: hasInspectableSource(sourceBlock),
    contradictory: contradictory || hasReviewContradiction,
    contradictionNote: (contradictory || hasReviewContradiction)
      ? 'Es gibt widersprüchliche Quellen.'
      : null,
    sources,
  };

  return {
    ...detail,
    copyText: buildFeatureSourceCopyText(detail),
  };
}

/**
 * @param {object} searchResult
 * @param {object} context
 */
export function buildFeatureSourceDetailFromSearch(searchResult, context) {
  const entries = searchResult.internalEntries ?? [];
  const sourceBlocks = sortSourceBlocks(
    entries.map((entry) => buildSourceBlockFromEntry(entry, context.source)),
  );
  const contradictory = detectSourceContradictions(sourceBlocks);
  const hasReviewContradiction = (context.openReviewItems ?? []).some(
    (item) => item.type === 'contradiction' && item.featureId === searchResult.feature.id,
  );
  const primaryEntry = entries[0] ?? {};
  const packageName = primaryEntry.packageName
    ?? searchResult.availability?.availablePackages?.[0]?.name
    ?? null;

  const detail = {
    featureLabel: searchResult.feature.label,
    featureId: searchResult.feature.id,
    brand: context.brand,
    model: context.model,
    modelYear: context.modelYear,
    trimName: entries.length === 1 ? (primaryEntry.trimName ?? primaryEntry.trimId) : 'Mehrere Trims',
    trimId: entries.length === 1 ? primaryEntry.trimId : null,
    status: searchResult.availability?.modelStatus ?? primaryEntry.status,
    statusDescription: searchResult.customerCopy?.statusLine
      ?? describeInspectorFeatureStatus(primaryEntry.status, packageName),
    packageName,
    confidence: searchResult.availability?.confidence ?? primaryEntry.confidence ?? 'medium',
    hasSource: sourceBlocks.some(hasInspectableSource),
    contradictory: contradictory || hasReviewContradiction,
    contradictionNote: (contradictory || hasReviewContradiction)
      ? 'Es gibt widersprüchliche Quellen.'
      : null,
    sources: sourceBlocks,
  };

  return {
    ...detail,
    copyText: buildFeatureSourceCopyText(detail),
  };
}

/**
 * @param {object} row
 * @param {object} context
 */
export function canShowSourceForRow(row, context) {
  const detail = buildFeatureSourceDetailFromRow({
    row,
    context,
    reviewItems: context.openReviewItems ?? [],
  });
  return detail.hasSource;
}
