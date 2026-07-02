/**
 * Admin-Präsentation: Kia-Preislisten-Abgleich (Stufe 1).
 */
import {
  buildKiaTechnicalSyncReport,
  summarizeKiaSyncReport,
} from '../../data/technical/kiaPricelistSyncService.js';

export function formatKiaSyncReportForAdmin(report) {
  if (!report) {
    return {
      available: false,
      headline: 'Noch kein Abgleich durchgeführt',
      tone: 'neutral',
      summary: null,
      rows: [],
      pending: [],
    };
  }

  const headline = summarizeKiaSyncReport(report);
  return {
    available: true,
    generatedAt: report.generatedAt,
    source: report.source,
    headline: headline.headline,
    tone: headline.tone,
    summary: report.summary,
    rows: (report.rows ?? []).map((row) => ({
      modelKey: row.modelKey,
      model: row.model,
      status: row.status,
      statusLabel: row.statusLabel,
      uiTone: row.uiTone,
      downloadUrl: row.downloadUrl,
      profileBrakedKg: row.profileBrakedKg,
      extractedBrakedKg: row.extracted?.brakedKg ?? [],
      sourceChanged: Boolean(row.sourceChanged),
      downloadedAt: row.downloadedAt,
      error: row.error,
    })),
    pending: (report.pending ?? []).map((item) => ({
      modelKey: item.modelKey,
      model: item.model,
      note: item.note,
      downloadUrl: item.downloadUrl,
      statusLabel: item.statusLabel,
      uiTone: item.uiTone,
    })),
  };
}

export { buildKiaTechnicalSyncReport, summarizeKiaSyncReport };
