import { splitCustomerName } from '../dealerAiMailExtractor.js';

export const CONTACT_KIND = Object.freeze({
  PRIVATE: 'private',
  BUSINESS: 'business',
});

export const CONTACT_SALUTATION_OPTIONS = Object.freeze([
  { id: '', label: '–' },
  { id: 'Herr', label: 'Herr' },
  { id: 'Frau', label: 'Frau' },
]);

function normalizeSalutation(raw) {
  const s = String(raw || '').trim().replace(/\.$/, '');
  if (/^herr$|^hr$/i.test(s)) return 'Herr';
  if (/^frau$|^fr$/i.test(s)) return 'Frau';
  return '';
}

function looksLikeCompany(name = '') {
  return /\b(gmbh|ug|ag|kg|ohg|gbr|e\.?\s*k\.?|ltd|inc|gmbh\s*&\s*co)\b/i.test(String(name));
}

function parseBusinessDisplayName(full = '') {
  const trimmed = String(full || '').trim();
  const match = trimmed.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (match) {
    return {
      companyName: match[1].trim(),
      person: match[2].trim(),
    };
  }
  return { companyName: trimmed, person: '' };
}

/**
 * Derive structured identity from lead.contact (+ fallback name).
 */
export function deriveContactIdentity(contact = {}, fallbackName = '') {
  const rawName = String(contact?.name || fallbackName || '')
    .replace(/\s*Kunde\s*\(offen\)\s*/i, '')
    .replace(/^Kunde\s+noch\s+offen$/i, '')
    .trim();

  const storedKind = contact?.kind === CONTACT_KIND.BUSINESS
    || contact?.kind === 'business'
    || contact?.customerType === 'business'
    ? CONTACT_KIND.BUSINESS
    : (contact?.kind === CONTACT_KIND.PRIVATE || contact?.companyName
      ? (contact.companyName ? CONTACT_KIND.BUSINESS : CONTACT_KIND.PRIVATE)
      : null);

  const hasStructuredParts = Boolean(
    String(contact?.firstName || '').trim()
    || String(contact?.lastName || '').trim()
    || String(contact?.companyName || '').trim(),
  );

  // kind allein reicht nicht – sonst geht contact.name verloren (Header → „Kunde noch offen“).
  if (hasStructuredParts) {
    const kind = storedKind
      || (contact.companyName || looksLikeCompany(rawName)
        ? CONTACT_KIND.BUSINESS
        : CONTACT_KIND.PRIVATE);
    return {
      kind,
      salutation: normalizeSalutation(contact.salutation),
      firstName: String(contact.firstName || '').trim(),
      lastName: String(contact.lastName || '').trim(),
      companyName: String(contact.companyName || (kind === CONTACT_KIND.BUSINESS ? rawName : '')).trim(),
    };
  }

  if (looksLikeCompany(rawName)) {
    const parsed = parseBusinessDisplayName(rawName);
    const personSplit = splitCustomerName(parsed.person);
    return {
      kind: CONTACT_KIND.BUSINESS,
      salutation: normalizeSalutation(personSplit.salutation),
      firstName: personSplit.firstName || '',
      lastName: personSplit.lastName || '',
      companyName: parsed.companyName,
    };
  }

  const split = splitCustomerName(rawName);
  return {
    kind: storedKind === CONTACT_KIND.BUSINESS ? CONTACT_KIND.BUSINESS : CONTACT_KIND.PRIVATE,
    salutation: normalizeSalutation(split.salutation || contact?.salutation),
    firstName: split.firstName || '',
    lastName: split.lastName || '',
    companyName: storedKind === CONTACT_KIND.BUSINESS ? rawName : '',
  };
}

export function composeContactDisplayName(identity = {}) {
  const kind = identity.kind === CONTACT_KIND.BUSINESS
    ? CONTACT_KIND.BUSINESS
    : CONTACT_KIND.PRIVATE;
  const company = String(identity.companyName || '').trim();
  const first = String(identity.firstName || '').trim();
  const last = String(identity.lastName || '').trim();
  const person = [first, last].filter(Boolean).join(' ').trim();

  if (kind === CONTACT_KIND.BUSINESS) {
    if (company && person) return `${company} (${person})`;
    if (company) return company;
    if (person) return person;
    return '';
  }

  return person;
}

export function buildContactPayloadFromIdentity(identity, { phone = '', email = '', address } = {}) {
  const kind = identity?.kind === CONTACT_KIND.BUSINESS
    ? CONTACT_KIND.BUSINESS
    : CONTACT_KIND.PRIVATE;
  const salutation = normalizeSalutation(identity?.salutation);
  const firstName = String(identity?.firstName || '').trim();
  const lastName = String(identity?.lastName || '').trim();
  const companyName = kind === CONTACT_KIND.BUSINESS
    ? String(identity?.companyName || '').trim()
    : '';
  const display = composeContactDisplayName({
    kind,
    salutation,
    firstName,
    lastName,
    companyName,
  });

  return {
    name: display || 'Kunde (offen)',
    salutation: salutation || null,
    firstName: firstName || null,
    lastName: lastName || null,
    companyName: companyName || null,
    kind,
    phone: String(phone || '').trim(),
    email: String(email || '').trim(),
    ...(address !== undefined ? { address } : {}),
  };
}
