/**
 * Gültigkeit & Status für Konditionen, Leasingfaktoren und Aktionen
 */

export const CONDITION_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  INCOMPLETE: 'incomplete',
};

export const CONDITION_STATUS_LABELS = {
  [CONDITION_STATUS.DRAFT]: 'Entwurf',
  [CONDITION_STATUS.ACTIVE]: 'Aktiv',
  [CONDITION_STATUS.EXPIRED]: 'Abgelaufen',
  [CONDITION_STATUS.INCOMPLETE]: 'Unvollständig',
};

export function parseValidityDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isWithinValidity({ validFrom, validUntil } = {}, now = new Date()) {
  const from = parseValidityDate(validFrom);
  const until = parseValidityDate(validUntil);
  if (from && now < from) return false;
  if (until && now > until) return false;
  return true;
}

export function resolveValidityStatus(record = {}, { isComplete = true, isPublished = false } = {}, now = new Date()) {
  if (!isComplete) {
    return CONDITION_STATUS.INCOMPLETE;
  }
  if (!isWithinValidity(record, now)) {
    const until = parseValidityDate(record.validUntil);
    if (until && now > until) return CONDITION_STATUS.EXPIRED;
    if (!isPublished) return CONDITION_STATUS.DRAFT;
    return CONDITION_STATUS.EXPIRED;
  }
  if (!isPublished) return CONDITION_STATUS.DRAFT;
  return CONDITION_STATUS.ACTIVE;
}

export function buildValidityFields(record = {}) {
  return {
    validFrom: record.validFrom ?? '',
    validUntil: record.validUntil ?? '',
  };
}
