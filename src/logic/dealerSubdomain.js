import { buildSubdomain } from './partnerOnboarding.js';

export const SUBDOMAIN_BASE = 'clever-neuwagen.de';

/** Reserviert – keine Händlerseiten */
export const RESERVED_SUBDOMAINS = new Set([
  'www',
  'admin',
  'portal',
  'api',
  'app',
  'mail',
  'staging',
  'dev',
]);

/** Bekannte Händler-Subdomains (Slug = Subdomain-Label) */
export const DEALER_SUBDOMAIN_SLUGS = [
  'autohaus-trinkle',
  'autohaus-mueller',
  'autohaus-stuttgart',
  'autohaus-beispiel',
];

export function isKnownDealerSlug(slug) {
  return DEALER_SUBDOMAIN_SLUGS.includes(slug);
}

/** localhost, 127.0.0.1 und private LAN-IPs (Handy im gleichen WLAN). */
export function isLocalNetworkHost(hostname = '') {
  const host = (hostname || '').toLowerCase();
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1') return true;
  if (host.endsWith('.localhost')) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  return false;
}

/**
 * Ermittelt Händler-Slug aus Host (Produktion) oder ?dealer= (localhost).
 * @param {string} [hostname]
 * @param {string} [search]
 */
export function getDealerSlugFromHost(
  hostname = typeof window !== 'undefined' ? window.location.hostname : '',
  search = typeof window !== 'undefined' ? window.location.search : '',
) {
  const params = new URLSearchParams(search);
  const queryDealer = params.get('dealer')?.trim().toLowerCase();
  if (queryDealer && isKnownDealerSlug(queryDealer)) {
    return queryDealer;
  }

  const host = (hostname || '').toLowerCase();

  if (isLocalNetworkHost(host)) {
    return null;
  }

  // autohaus-trinkle.clever-neuwagen.de
  if (host.endsWith(`.${SUBDOMAIN_BASE}`)) {
    const sub = host.slice(0, -(SUBDOMAIN_BASE.length + 1));
    if (sub && !sub.includes('.') && !RESERVED_SUBDOMAINS.has(sub) && isKnownDealerSlug(sub)) {
      return sub;
    }
  }

  // Dev: autohaus-trinkle.localhost
  if (host.endsWith('.localhost')) {
    const sub = host.replace(/\.localhost$/, '');
    if (isKnownDealerSlug(sub)) return sub;
  }

  return null;
}

export function isDealerSubdomainHost(hostname) {
  return Boolean(getDealerSlugFromHost(hostname));
}

export function buildDealerSubdomainUrl(slug) {
  if (!slug) return null;
  if (typeof window !== 'undefined' && isLocalNetworkHost(window.location.hostname)) {
    return `${window.location.origin}/haendler/${slug}`;
  }
  return `https://${buildSubdomain(slug)}`;
}

export function getMainSiteUrl(path = '/') {
  if (typeof window !== 'undefined' && isLocalNetworkHost(window.location.hostname)) {
    return `${window.location.origin}${path}`;
  }
  return `https://www.${SUBDOMAIN_BASE}${path}`;
}
