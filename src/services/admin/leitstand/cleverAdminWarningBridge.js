/**
 * Schlanke Bridge: OCR-/Magic-Warnungen → Admin-Leitstand (nur Browser).
 * Kein Einfluss auf Verkäufer-Return-Werte.
 */

function tryRecord(entry) {
  if (typeof window === 'undefined') return;
  import('./adminLeitstandStore.js')
    .then(({ recordAdminCleverWarning }) => recordAdminCleverWarning(entry))
    .catch(() => {});
}

/**
 * @param {{ error?: string|null, status?: string, fileName?: string|null, message?: string|null }} payload
 */
export function logOcrAdminWarning(payload = {}) {
  const status = payload.status ?? 'ocr_failed';
  tryRecord({
    kind: 'ocr',
    title: status === 'ocr_empty' ? 'OCR ohne brauchbaren Text' : 'OCR-/Dokument-Fehler',
    detail: [payload.fileName, payload.error || payload.message].filter(Boolean).join(' · ') || status,
    severity: 'urgent',
    entityType: 'ocr',
    mirrorActivity: false,
  });
}

/**
 * @param {{ writer?: string|null, warnings?: string[], remoteEnabled?: boolean }} payload
 */
export function logMagicFallbackAdminWarning(payload = {}) {
  const warnings = payload.warnings ?? [];
  const writer = payload.writer ?? '';
  const isFallback = /fallback/i.test(String(writer))
    || warnings.some((w) => /openai|key_missing|magic_flag|fallback/i.test(String(w)));
  if (!isFallback && payload.remoteEnabled !== false) return;

  tryRecord({
    kind: 'magic',
    title: 'Magic / OpenAI Fallback',
    detail: warnings.slice(0, 3).join(', ')
      || (payload.remoteEnabled === false ? 'Magic-Flag aus · lokaler Fallback' : writer || 'fallback'),
    severity: 'warn',
    entityType: 'magic',
    mirrorActivity: false,
  });
}

/**
 * Grounding/Preisliste fehlt – nur Admin-Hinweis, kein Einfluss auf Verkäufer-Return.
 * @param {{ reason?: string|null, message?: string|null, modelKey?: string|null }} payload
 */
export function logPriceListGroundingAdminWarning(payload = {}) {
  tryRecord({
    kind: 'pricelist',
    title: 'Grounding / Preisliste unvollständig',
    detail: [
      payload.modelKey ? `Modell ${payload.modelKey}` : null,
      payload.reason || null,
      payload.message || null,
    ].filter(Boolean).join(' · ') || 'Preisliste oder Modellzuordnung fehlt',
    severity: 'warn',
    entityType: 'pricelist',
    mirrorActivity: false,
  });
}
