import { useEffect } from 'react';

const SITE_NAME = 'Clever-Neuwagen';
const DEFAULT_ORIGIN = 'https://www.clever-neuwagen.de';

function getOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return DEFAULT_ORIGIN;
}

function upsertMeta(name, content) {
  if (!content) return;
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href) {
  if (!href) return;
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Setzt document.title, meta description und canonical URL.
 */
export default function usePageSeo({ title, description, path }) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE_NAME}` : SITE_NAME;

    if (description) {
      upsertMeta('description', description);
    }

    if (path) {
      const canonical = `${getOrigin()}${path.startsWith('/') ? path : `/${path}`}`;
      upsertCanonical(canonical);
    }
  }, [title, description, path]);
}
