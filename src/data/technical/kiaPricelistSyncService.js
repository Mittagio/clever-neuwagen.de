/**
 * Kia-Preislisten: Online-Abgleich (Download → Text → Anhängelast vs. Registry).
 * Wird von CLI-Skript und Admin-API genutzt.
 */
import { KIA_PDF_SOURCE_CATALOG, KIA_MODELS_PENDING_PDF } from './brands/kia/pdfSourceCatalog.js';
import { extractTowingFromPdfText } from './extractTowingFromPdfText.js';
import { KIA_TOWING_PROFILES } from './brands/kia/towingProfiles.js';

/** @typedef {'ok'|'mismatch'|'missing_file'|'no_profile'|'parse_failed'|'source_changed'|'pending_profile'} SyncRowStatus */

/**
 * @typedef {object} KiaSyncRow
 * @property {string} brandKey
 * @property {string} modelKey
 * @property {string} model
 * @property {string} stem
 * @property {string} file
 * @property {string} [pdfFile]
 * @property {string} [downloadUrl]
 * @property {SyncRowStatus} status
 * @property {string} uiTone
 * @property {string} statusLabel
 * @property {object | null} extracted
 * @property {number[]} profileBrakedKg
 * @property {boolean} profileFound
 * @property {string | null} [contentHash]
 * @property {string | null} [previousHash]
 * @property {boolean} [sourceChanged]
 * @property {string | null} [downloadedAt]
 * @property {string | null} [error]
 */

export const KIA_SYNC_STATUS_LABELS = {
  ok: 'Abgeglichen',
  mismatch: 'Abweichung',
  missing_file: 'Datei fehlt',
  no_profile: 'Kein Profil',
  parse_failed: 'Parser fehlgeschlagen',
  source_changed: 'Quelle geändert',
  pending_profile: 'PDF verfügbar, Profil fehlt',
};

export const KIA_SYNC_STATUS_TONE = {
  ok: 'success',
  mismatch: 'danger',
  missing_file: 'warning',
  no_profile: 'warning',
  parse_failed: 'warning',
  source_changed: 'warning',
  pending_profile: 'neutral',
};

function profileBrakedValues(profile) {
  return (profile?.variants ?? [])
    .map((v) => v.towing?.brakedKg)
    .filter((kg) => kg != null && kg > 0);
}

/**
 * @param {SyncRowStatus} status
 */
export function getKiaSyncStatusMeta(status) {
  return {
    status,
    statusLabel: KIA_SYNC_STATUS_LABELS[status] ?? status,
    uiTone: KIA_SYNC_STATUS_TONE[status] ?? 'neutral',
  };
}

/**
 * @param {import('./brands/kia/pdfSourceCatalog.js').KiaPdfSourceEntry} entry
 * @param {{ text?: string, contentHash?: string | null, previousHash?: string | null, downloadedAt?: string | null, error?: string }} [options]
 * @returns {KiaSyncRow}
 */
export function compareKiaTowingFromText(entry, options = {}) {
  const text = options.text ?? '';
  const profile = KIA_TOWING_PROFILES.find((p) => p.modelKey === entry.modelKey);
  const profileValues = profileBrakedValues(profile);
  const sourceChanged = Boolean(
    options.contentHash
    && options.previousHash
    && options.contentHash !== options.previousHash,
  );

  if (!text.trim()) {
    const status = /** @type {SyncRowStatus} */ ('missing_file');
    return {
      brandKey: 'kia',
      ...entry,
      ...getKiaSyncStatusMeta(status),
      extracted: null,
      profileBrakedKg: profileValues,
      profileFound: Boolean(profile),
      contentHash: options.contentHash ?? null,
      previousHash: options.previousHash ?? null,
      sourceChanged,
      downloadedAt: options.downloadedAt ?? null,
      error: options.error ?? null,
    };
  }

  const extracted = extractTowingFromPdfText(text);
  const extractedValues = extracted.brakedKg;

  let status = /** @type {SyncRowStatus} */ ('ok');
  if (!profile) status = 'no_profile';
  else if (!extractedValues.length && !extracted.notPermitted) status = 'parse_failed';
  else if (profileValues.length && extractedValues.length) {
    const profileSet = new Set(profileValues);
    const match = extractedValues.every((v) => profileSet.has(v));
    if (!match) status = 'mismatch';
  }

  if (sourceChanged && status === 'ok') {
    status = 'source_changed';
  }

  return {
    brandKey: 'kia',
    ...entry,
    ...getKiaSyncStatusMeta(status),
    extracted,
    profileBrakedKg: profileValues,
    profileFound: Boolean(profile),
    contentHash: options.contentHash ?? null,
    previousHash: options.previousHash ?? null,
    sourceChanged,
    downloadedAt: options.downloadedAt ?? null,
    error: options.error ?? null,
  };
}

/**
 * @param {Record<string, string>} [textByFile]
 * @param {Record<string, { hash?: string, downloadedAt?: string }>} [manifestByStem]
 */
export function buildKiaTechnicalSyncReport(textByFile = {}, manifestByStem = {}) {
  const rows = KIA_PDF_SOURCE_CATALOG.map((entry) => {
    const text = textByFile[entry.file] ?? '';
    const manifest = manifestByStem[entry.stem] ?? {};
    return compareKiaTowingFromText(entry, {
      text,
      contentHash: manifest.hash ?? null,
      previousHash: manifest.previousHash ?? manifest.hash ?? null,
      downloadedAt: manifest.downloadedAt ?? null,
      error: manifest.error ?? null,
    });
  });

  const pending = KIA_MODELS_PENDING_PDF.map((item) => ({
    ...item,
    ...getKiaSyncStatusMeta('pending_profile'),
    hasDownloadUrl: Boolean(item.downloadUrl),
  }));

  const summary = {
    ok: rows.filter((r) => r.status === 'ok').length,
    mismatch: rows.filter((r) => r.status === 'mismatch').length,
    missing: rows.filter((r) => r.status === 'missing_file').length,
    noProfile: rows.filter((r) => r.status === 'no_profile').length,
    parseFailed: rows.filter((r) => r.status === 'parse_failed').length,
    sourceChanged: rows.filter((r) => r.sourceChanged || r.status === 'source_changed').length,
    pendingProfiles: pending.length,
    total: rows.length,
  };

  return {
    brandKey: 'kia',
    generatedAt: new Date().toISOString(),
    source: 'kia.com Preislisten (DE)',
    rows,
    pending,
    summary,
  };
}

/**
 * @param {ReturnType<typeof buildKiaTechnicalSyncReport>} report
 */
export function summarizeKiaSyncReport(report) {
  const { summary } = report;
  if (summary.mismatch > 0) {
    return {
      headline: `${summary.mismatch} Abweichung(en) – Registry prüfen`,
      tone: 'danger',
    };
  }
  if (summary.sourceChanged > 0) {
    return {
      headline: `${summary.sourceChanged} Quelle(n) geändert – Abgleich empfohlen`,
      tone: 'warning',
    };
  }
  if (summary.missing > 0 || summary.parseFailed > 0) {
    return {
      headline: `${summary.missing + summary.parseFailed} Datei(en) fehlen oder sind nicht parsebar`,
      tone: 'warning',
    };
  }
  return {
    headline: `${summary.ok} von ${summary.total} Modellen abgeglichen`,
    tone: 'success',
  };
}
