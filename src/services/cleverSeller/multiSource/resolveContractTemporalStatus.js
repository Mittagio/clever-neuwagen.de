/**
 * Zeitliche Einordnung von Vertragsdaten (ended / active / needs_confirmation).
 * Keine modellspezifische Logik.
 */

/**
 * @param {string|null} endDateIso – YYYY-MM-DD
 * @param {Date|number|string} [now]
 * @returns {{
 *   status: 'active'|'ended'|'historical_or_ended'|'status_needs_confirmation'|'unknown',
 *   endDate: string|null,
 *   label: string,
 * }}
 */
export function resolveContractTemporalStatus(endDateIso = null, now = Date.now()) {
  const end = parseIsoDate(endDateIso);
  if (!end) {
    return {
      status: 'status_needs_confirmation',
      endDate: endDateIso || null,
      label: 'Vertragsstatus unklar – bitte prüfen',
    };
  }

  const nowDate = now instanceof Date ? now : new Date(now);
  const today = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  if (endDay.getTime() < today.getTime()) {
    return {
      status: 'historical_or_ended',
      endDate: formatIso(endDay),
      label: `Der Vertrag endete laut Dokument am ${formatDe(endDay)}.`,
    };
  }

  if (endDay.getTime() === today.getTime()) {
    return {
      status: 'status_needs_confirmation',
      endDate: formatIso(endDay),
      label: `Vertragsende laut Dokument heute (${formatDe(endDay)}) – Status bitte bestätigen.`,
    };
  }

  return {
    status: 'active',
    endDate: formatIso(endDay),
    label: `Laufend bis ${formatDe(endDay)}`,
  };
}

function parseIsoDate(raw) {
  if (!raw) return null;
  const m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDe(d) {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}
