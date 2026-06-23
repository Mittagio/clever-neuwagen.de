/**
 * Normalisierte Kundenadresse – API-ready, CRM-persistent.
 */

export const DEFAULT_COUNTRY = 'Deutschland';

export function createEmptyAddress() {
  return normalizeAddressResult({});
}

/**
 * @param {object} result
 * @returns {import('./locationTypes.js').CustomerAddress}
 */
export function normalizeAddressResult(result = {}) {
  const street = String(result.street ?? '').trim();
  const houseNumber = String(result.houseNumber ?? '').trim();
  const postalCode = String(result.postalCode ?? '').trim();
  const city = String(result.city ?? '').trim();
  const country = String(result.country ?? DEFAULT_COUNTRY).trim() || DEFAULT_COUNTRY;
  const lat = Number.isFinite(Number(result.lat)) ? Number(result.lat) : null;
  const lng = Number.isFinite(Number(result.lng)) ? Number(result.lng) : null;
  const placeId = result.placeId ?? null;
  const source = result.source ?? null;

  const formattedAddress = String(result.formattedAddress ?? '').trim()
    || formatAddressLine({ street, houseNumber, postalCode, city, country });

  return {
    street,
    houseNumber,
    postalCode,
    city,
    country,
    formattedAddress,
    lat,
    lng,
    placeId,
    source,
  };
}

export function formatAddressLine({
  street = '',
  houseNumber = '',
  postalCode = '',
  city = '',
  country = '',
} = {}) {
  const line1 = [street, houseNumber].filter(Boolean).join(' ');
  const line2 = [postalCode, city].filter(Boolean).join(' ');
  if (line1 && line2) return `${line1} · ${line2}`;
  if (line1) return line1;
  if (line2) return line2;
  if (country && country !== DEFAULT_COUNTRY) return country;
  return '';
}

export function parseFormattedAddressLine(line = '') {
  const trimmed = String(line).trim();
  if (!trimmed) return createEmptyAddress();

  const segments = trimmed.split('·').map((part) => part.trim()).filter(Boolean);
  if (segments.length === 2) {
    const streetMatch = segments[0].match(/^(.+?)\s+(\d+[a-zA-Z]?(?:\/\d+[a-zA-Z]?)?)$/);
    const plzCityMatch = segments[1].match(/^(\d{5})\s+(.+)$/);
    return normalizeAddressResult({
      street: streetMatch?.[1] ?? segments[0],
      houseNumber: streetMatch?.[2] ?? '',
      postalCode: plzCityMatch?.[1] ?? '',
      city: plzCityMatch?.[2] ?? segments[1],
      formattedAddress: trimmed,
    });
  }

  const inlinePlz = trimmed.match(/^(.+?)\s+(\d{5})\s+(.+)$/);
  if (inlinePlz) {
    const streetMatch = inlinePlz[1].match(/^(.+?)\s+(\d+[a-zA-Z]?(?:\/\d+[a-zA-Z]?)?)$/);
    return normalizeAddressResult({
      street: streetMatch?.[1] ?? inlinePlz[1],
      houseNumber: streetMatch?.[2] ?? '',
      postalCode: inlinePlz[2],
      city: inlinePlz[3],
      formattedAddress: trimmed,
    });
  }

  return normalizeAddressResult({ formattedAddress: trimmed });
}

export function addressFromLead(lead = null) {
  if (lead?.crm?.customerAddress?.formattedAddress || lead?.crm?.customerAddress?.street) {
    return normalizeAddressResult(lead.crm.customerAddress);
  }
  const formatted = lead?.crm?.address ?? lead?.contact?.address ?? '';
  return parseFormattedAddressLine(formatted);
}

export function isAddressComplete(address = {}) {
  const normalized = normalizeAddressResult(address);
  return Boolean(
    normalized.street
    && normalized.postalCode
    && normalized.city,
  );
}

export function buildAddressCacheKey(address = {}) {
  const normalized = normalizeAddressResult(address);
  return [
    normalized.street,
    normalized.houseNumber,
    normalized.postalCode,
    normalized.city,
    normalized.country,
    normalized.lat ?? '',
    normalized.lng ?? '',
  ].join('|').toLowerCase();
}

export function addressToStorageFields(address = {}) {
  const normalized = normalizeAddressResult(address);
  return {
    customerAddress: normalized,
    address: normalized.formattedAddress,
    addressStreet: normalized.street || null,
    addressHouseNumber: normalized.houseNumber || null,
    addressPostalCode: normalized.postalCode || null,
    addressCity: normalized.city || null,
  };
}
