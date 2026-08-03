/**
 * Schlanker Preislisten-/Datenpflege-Status für Admin-Leitstand.
 * Zentrale sieht Quellen, Versionsstand, Imports, Konflikte – Verkäufer pflegt nichts.
 */
import { KIA_PRICE_LIST_META } from '../../../data/kia/kiaOfficialPriceList.js';
import { KIA_PDF_IMPORT_META } from '../../../data/kia/kiaPriceListRegistry.js';
import { getBrandDashboard } from '../../../data/vehicleDataService.js';
import { loadStammdatenOverrides } from '../vehicleStammdatenOverrideService.js';
import { countPendingReleases } from './adminReleaseCenter.js';

function formatDeDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('de-DE');
  } catch {
    return null;
  }
}

function formatDeDay(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('de-DE');
  } catch {
    return String(iso);
  }
}

/**
 * Metriken aus Import-Records (ohne React-Context).
 * @param {object[]} records
 * @param {{ reviewImport?: object|null, analyzeError?: string|null }} [opts]
 */
export function computeImportMetricsFromRecords(records = [], opts = {}) {
  const reviewImport = opts.reviewImport ?? null;
  const allRecords = reviewImport
    && !records.some((i) => i.id === reviewImport.id)
    ? [reviewImport, ...records]
    : [...records];

  const approved = allRecords.filter((i) => i.status === 'approved');
  const pending = reviewImport
    ? 1
    : allRecords.filter((i) => i.status === 'review' || i.status === 'pending' || i.status === 'analyzing').length;
  const rejected = allRecords.filter((i) => i.status === 'rejected').length;
  const lastApproved = [...approved].sort(
    (a, b) => new Date(b.approvedAt ?? b.uploadedAt) - new Date(a.approvedAt ?? a.uploadedAt),
  )[0] ?? null;

  return {
    total: allRecords.length,
    pending,
    rejected,
    analyzeFailed: opts.analyzeError ? 1 : 0,
    lastUpdate: lastApproved?.approvedAt ?? lastApproved?.uploadedAt ?? null,
    lastLabel: lastApproved
      ? [lastApproved.brand, lastApproved.model, lastApproved.version].filter(Boolean).join(' ')
      : null,
    lastSource: lastApproved?.sourceFile?.name ?? null,
  };
}

/**
 * @param {Record<string, object>|null|undefined} overrides
 */
export function countStammdatenOverrides(overrides = null) {
  const map = overrides ?? loadStammdatenOverrides();
  return Object.keys(map ?? {}).filter(Boolean).length;
}

/**
 * Katalog-Stand aus Kia-Quellen (ohne Secrets).
 */
export function readPriceListCatalogStand({
  officialMeta = KIA_PRICE_LIST_META,
  pdfMeta = KIA_PDF_IMPORT_META,
} = {}) {
  return {
    sourceLabel: officialMeta?.sourceLabel ?? 'Hersteller-Preisliste',
    sourceUrl: officialMeta?.sourceUrl ?? null,
    validUntil: officialMeta?.validUntil ?? null,
    importedAt: officialMeta?.importedAt ?? pdfMeta?.importedAt ?? null,
    pdfModelCount: pdfMeta?.modelCount ?? null,
    publisher: officialMeta?.publisher ?? null,
  };
}

/**
 * Marken mit Prüfbedarf (review/outdated).
 */
export function summarizeCatalogReviewStats(brands = null) {
  const list = brands ?? getBrandDashboard();
  let review = 0;
  let outdated = 0;
  for (const brand of list) {
    review += brand.stats?.review ?? 0;
    outdated += brand.stats?.outdated ?? 0;
  }
  return { review, outdated, total: review + outdated };
}

/**
 * @typedef {object} PriceListCareStatus
 * @property {'ok'|'warn'|'error'|'unknown'} overall
 * @property {'ok'|'Freigabe nötig'} approvalLabel
 * @property {{ status: string, detail: string, href?: string }} signal
 * @property {object[]} items
 * @property {object} summary
 */

/**
 * Baut den schlanken Pflege-/Freigabe-Status für System-Leitstand.
 * @param {object} [input]
 * @returns {PriceListCareStatus}
 */
export function buildPriceListCareStatus({
  importMetrics = {},
  overrideCount = null,
  pendingReleases = null,
  catalogStand = null,
  brandReview = null,
} = {}) {
  const pending = Number(importMetrics.pending ?? 0) || 0;
  const rejected = Number(importMetrics.rejected ?? 0) || 0;
  const analyzeFailed = Number(importMetrics.analyzeFailed ?? 0) || 0;
  const failedLike = rejected + analyzeFailed;
  const lastUpdate = importMetrics.lastUpdate ?? null;
  const lastLabel = importMetrics.lastLabel ?? null;
  const lastSource = importMetrics.lastSource ?? null;

  const overrides = overrideCount == null ? countStammdatenOverrides() : Number(overrideCount) || 0;
  const releases = pendingReleases == null ? countPendingReleases() : Number(pendingReleases) || 0;
  const catalog = catalogStand ?? readPriceListCatalogStand();
  const reviewStats = brandReview ?? summarizeCatalogReviewStats();
  const conflictCount = (reviewStats.total ?? 0) + releases;

  const hasHardIssue = failedLike > 0 || (reviewStats.outdated ?? 0) > 0;
  const needsApproval = pending > 0
    || releases > 0
    || overrides > 0
    || (reviewStats.review ?? 0) > 0
    || hasHardIssue;

  let overall = 'ok';
  if (!lastUpdate && !catalog.importedAt) {
    overall = 'unknown';
  }
  if (needsApproval) {
    overall = 'warn';
  }
  if (hasHardIssue) {
    overall = 'error';
  }

  const approvalLabel = needsApproval ? 'Freigabe nötig' : 'ok';

  const standDetail = [
    lastLabel,
    lastUpdate ? formatDeDate(lastUpdate) : null,
  ].filter(Boolean).join(' · ')
    || (catalog.importedAt ? `Katalog ${formatDeDay(catalog.importedAt)}` : 'kein Import-Stand');

  const catalogDetail = [
    catalog.sourceLabel,
    catalog.importedAt ? `Stand ${formatDeDay(catalog.importedAt)}` : null,
    catalog.validUntil ? `gültig bis ${formatDeDay(catalog.validUntil)}` : null,
    catalog.pdfModelCount != null ? `${catalog.pdfModelCount} PDF-Modelle` : null,
  ].filter(Boolean).join(' · ');

  const conflictDetail = conflictCount
    ? [
      releases ? `${releases} Release(s)` : null,
      reviewStats.review ? `${reviewStats.review} Modell(e) prüfen` : null,
      reviewStats.outdated ? `${reviewStats.outdated} veraltet` : null,
    ].filter(Boolean).join(' · ')
    : 'Keine';

  const items = [
    {
      id: 'approval',
      label: 'Freigabe-Status',
      status: approvalLabel === 'ok' ? 'ok' : hasHardIssue ? 'error' : 'warn',
      detail: approvalLabel,
    },
    {
      id: 'last-import',
      label: 'Letzter Preislistenstand',
      status: lastUpdate || catalog.importedAt ? (pending ? 'warn' : 'ok') : 'unknown',
      detail: standDetail,
    },
    {
      id: 'catalog-source',
      label: 'Quelle / Version',
      status: catalog.importedAt ? 'ok' : 'unknown',
      detail: catalogDetail || '–',
    },
    {
      id: 'open-imports',
      label: 'Offene Imports',
      status: pending ? 'warn' : 'ok',
      detail: pending ? `${pending} zur Freigabe` : 'Keine',
    },
    {
      id: 'failed-imports',
      label: 'Fehlgeschlagen / abgelehnt',
      status: failedLike ? 'error' : 'ok',
      detail: failedLike
        ? [
          rejected ? `${rejected} abgelehnt` : null,
          analyzeFailed ? `${analyzeFailed} Analysefehler` : null,
        ].filter(Boolean).join(' · ')
        : 'Keine',
    },
    {
      id: 'conflicts',
      label: 'Konflikte / Prüfung',
      status: conflictCount
        ? ((reviewStats.outdated ?? 0) > 0 ? 'error' : 'warn')
        : 'ok',
      detail: conflictDetail,
    },
    {
      id: 'overrides',
      label: 'Overrides (ungeprüft)',
      status: overrides > 0 ? 'warn' : 'ok',
      detail: overrides > 0
        ? `${overrides} Stammdaten-Override(s) aktiv`
        : 'Keine',
    },
  ];

  if (lastSource) {
    items.splice(2, 0, {
      id: 'last-source-file',
      label: 'Letzte Quelldatei',
      status: 'ok',
      detail: lastSource,
    });
  }

  const signalParts = [];
  if (approvalLabel !== 'ok') signalParts.push(approvalLabel);
  if (pending) signalParts.push(`${pending} Import offen`);
  if (failedLike) signalParts.push(`${failedLike} fehlgeschlagen`);
  if (overrides) signalParts.push(`${overrides} Override`);
  if (conflictCount && !pending) signalParts.push(`${conflictCount} Prüfung`);
  if (!signalParts.length) {
    signalParts.push(lastUpdate
      ? `ok · ${formatDeDate(lastUpdate)}`
      : catalog.importedAt
        ? `ok · Katalog ${formatDeDay(catalog.importedAt)}`
        : 'kein Stand');
  }

  return {
    overall,
    approvalLabel,
    signal: {
      status: overall === 'unknown' ? 'unknown' : overall,
      detail: signalParts.join(' · '),
      href: '/admin/daten',
    },
    items,
    summary: {
      pending,
      rejected,
      analyzeFailed,
      failedLike,
      lastUpdate,
      lastLabel,
      lastSource,
      overrideCount: overrides,
      pendingReleases: releases,
      conflictCount,
      catalog,
      brandReview: reviewStats,
      needsApproval,
    },
  };
}
