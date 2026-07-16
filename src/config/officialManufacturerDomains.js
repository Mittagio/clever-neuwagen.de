/**
 * Offizielle Herstellerdomains für Clever Websuche (Stufe 2).
 * Keine Drittquellen, Händlerseiten oder Foren.
 */
import { MANUFACTURER_MODELS } from '../data/manufacturer/manufacturerRegistry.js';

export const OFFICIAL_MANUFACTURER_DOMAINS = {
  kia: ['kia.com', 'press.kia.com'],
  hyundai: ['hyundai.com', 'hyundai.news'],
  byd: ['byd.com', 'bydauto.com'],
};

/** @param {string} brandKey */
export function getAllowedDomainsForBrand(brandKey) {
  const key = String(brandKey ?? '').toLowerCase();
  return OFFICIAL_MANUFACTURER_DOMAINS[key] ?? [];
}

/** @param {string} url */
export function extractDomainFromUrl(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * @param {string} url
 * @param {string} brandKey
 */
export function isAllowedOfficialDomain(url, brandKey) {
  const domain = extractDomainFromUrl(url);
  if (!domain) return false;
  const allowed = getAllowedDomainsForBrand(brandKey);
  return allowed.some((entry) => domain === entry || domain.endsWith(`.${entry}`));
}

/** @param {string} modelKey */
export function resolveBrandKeyFromModelKey(modelKey) {
  const record = MANUFACTURER_MODELS[String(modelKey ?? '').toLowerCase()];
  if (record?.brand) {
    return String(record.brand).toLowerCase();
  }
  return 'kia';
}
