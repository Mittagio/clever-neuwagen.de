/**
 * Trendseiten veröffentlichen – Draft/Vorschlag → Live unter /trends
 */

import {
  loadPublishedTrendStore,
  savePublishedTrendStore,
} from './trendPublishAdapter.js';
import { getTrendTemplate } from '../data/trendCatalog.js';
import { getGuideArticle } from '../data/guideCatalog.js';

export const PUBLISHED_TRENDS_EVENT = 'clever-published-trends-update';

export function getPublishedTrendPages() {
  return loadPublishedTrendStore().pages ?? [];
}

export function getPublishedTrendSlugs() {
  return new Set(getPublishedTrendPages().map((page) => page.slug));
}

export function getPublishedTrendMeta(slug) {
  return getPublishedTrendPages().find((page) => page.slug === slug) ?? null;
}

export function isTrendPublished(slug) {
  return getPublishedTrendSlugs().has(slug);
}

export function isPublicTrendSlug(slug) {
  if (!slug) return false;
  if (getGuideArticle(slug)) return true;
  if (getTrendTemplate(slug)) return true;
  return isTrendPublished(slug);
}

export function applyPublishedStatusToTrendPages(pages) {
  const publishedMap = new Map(
    getPublishedTrendPages().map((page) => [page.slug, page]),
  );

  return pages.map((page) => {
    const published = publishedMap.get(page.slug);
    if (!published) return page;

    const isRatgeber = page.url?.startsWith('/ratgeber');
    return {
      ...page,
      status: 'published',
      url: isRatgeber ? page.url : `/trends/${page.slug}`,
      publishedAt: published.publishedAt,
      publishedReason: published.reason ?? page.reason,
    };
  });
}

export function publishTrendPage(page) {
  const store = loadPublishedTrendStore();
  const entry = {
    slug: page.slug,
    title: page.title,
    category: page.category,
    reason: page.reason ?? null,
    publishedAt: new Date().toISOString(),
    source: page.source ?? 'intelligence',
  };

  const idx = store.pages.findIndex((item) => item.slug === page.slug);
  if (idx >= 0) {
    store.pages[idx] = { ...store.pages[idx], ...entry };
  } else {
    store.pages.push(entry);
  }

  store.lastUpdated = new Date().toISOString();
  savePublishedTrendStore(store);
  syncPublishedTrendsToServer(store);
  return entry;
}

export function unpublishTrendPage(slug) {
  const store = loadPublishedTrendStore();
  store.pages = store.pages.filter((page) => page.slug !== slug);
  store.lastUpdated = new Date().toISOString();
  savePublishedTrendStore(store);
  syncPublishedTrendsToServer(store);
}

function syncPublishedTrendsToServer(store) {
  if (typeof fetch === 'undefined') return;
  fetch('/api/v1/trends/published', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pages: store.pages, mode: 'replace' }),
  }).catch(() => { /* offline */ });
}

export async function syncPublishedTrends() {
  if (typeof fetch === 'undefined') {
    return { ok: false, reason: 'no-fetch' };
  }

  try {
    const res = await fetch('/api/v1/trends/published');
    if (!res.ok) {
      return { ok: false, reason: 'server-unavailable' };
    }

    const remote = await res.json();
    const local = loadPublishedTrendStore();
    const mergedPages = mergePublishedPages(local.pages, remote.pages ?? []);

    const merged = {
      pages: mergedPages,
      lastUpdated: new Date().toISOString(),
    };

    savePublishedTrendStore(merged);

    if (!publishedStoresEqual(merged, remote)) {
      await fetch('/api/v1/trends/published', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: merged.pages, mode: 'replace' }),
      });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(PUBLISHED_TRENDS_EVENT));
      window.dispatchEvent(new CustomEvent('clever-intelligence-update'));
    }

    return { ok: true, count: merged.pages.length };
  } catch {
    return { ok: false, reason: 'offline' };
  }
}

function mergePublishedPages(localPages, remotePages) {
  const map = new Map();
  for (const page of [...remotePages, ...localPages]) {
    if (!page?.slug) continue;
    const existing = map.get(page.slug);
    if (!existing) {
      map.set(page.slug, page);
      continue;
    }
    const existingAt = new Date(existing.publishedAt ?? 0).getTime();
    const nextAt = new Date(page.publishedAt ?? 0).getTime();
    map.set(page.slug, nextAt >= existingAt ? page : existing);
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

function publishedStoresEqual(a, b) {
  const pagesA = a?.pages ?? [];
  const pagesB = b?.pages ?? [];
  if (pagesA.length !== pagesB.length) return false;
  const slugsA = new Set(pagesA.map((page) => page.slug));
  for (const page of pagesB) {
    if (!slugsA.has(page.slug)) return false;
  }
  return true;
}
