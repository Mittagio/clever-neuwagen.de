const STORAGE_KEY = 'clever-neuwagen-compare-slugs';
const MAX_ITEMS = 3;

export function loadCompareSlugs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(Boolean).slice(0, MAX_ITEMS) : [];
  } catch {
    return [];
  }
}

export function saveCompareSlugs(slugs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs.slice(0, MAX_ITEMS)));
}

export function toggleCompareSlug(slug) {
  const current = loadCompareSlugs();
  if (current.includes(slug)) {
    const next = current.filter((s) => s !== slug);
    saveCompareSlugs(next);
    return { slugs: next, added: false };
  }
  const next = [...current, slug].slice(-MAX_ITEMS);
  saveCompareSlugs(next);
  return { slugs: next, added: true };
}

export function isInCompare(slug) {
  return loadCompareSlugs().includes(slug);
}
