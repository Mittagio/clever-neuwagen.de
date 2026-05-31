/**
 * Trendseiten – aus Intelligence-Daten + Ratgeber-Katalog
 */
import { GUIDE_ARTICLES, getGuideCategory } from '../data/guideCatalog.js';
import { applyPublishedStatusToTrendPages } from './trendPublishService.js';
import {
  getLiveSearchBehavior,
  getLiveComparisonRanking,
  getLiveFamilyIndex,
  getLiveElectroIndex,
  getLiveLeasingTrends,
  getLiveOffersIntelligence,
  hasLiveIntelligenceData,
} from './intelligenceAnalytics.js';

const YEAR = new Date().getFullYear();

const AUTO_TEMPLATES = [
  {
    slug: 'beste-leasingangebote-der-woche',
    title: 'Beste Leasingangebote der Woche',
    category: 'Leasing',
    match: ({ offers }) => offers?.created > 0,
    priority: ({ offers }) => offers.created * 2,
  },
  {
    slug: 'beste-elektroautos-2026',
    title: `Beste Elektroautos ${YEAR}`,
    category: 'Elektroautos',
    match: ({ electro, search }) => electro.length >= 2 || search.some((s) => /elektro/i.test(s.query)),
    priority: ({ electro }) => electro[0]?.demand ?? 50,
  },
  {
    slug: 'top-suv-unter-350-euro',
    title: 'Top SUV unter 350 €',
    category: 'SUV',
    match: ({ search, leasing }) =>
      search.some((s) => /suv/i.test(s.query))
      || leasing.desiredRates.some((r) => r.rate <= 350),
    priority: ({ search }) => search.find((s) => /suv|350/i.test(s.query))?.count ?? 40,
  },
];

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function categoryLabel(categoryId) {
  return getGuideCategory(categoryId)?.label ?? categoryId;
}

function estimateViews(slug, search, comparisons) {
  const searchBoost = search
    .filter((s) => slug.includes('familien') ? /familie/i.test(s.query) : true)
    .reduce((s, q) => s + q.count, 0);
  const compareBoost = comparisons
    .filter((c) => slug.includes('ev3') && c.pair?.includes('EV3'))
    .reduce((s, c) => s + c.count, 0);
  return searchBoost * 8 + compareBoost * 12;
}

function buildPublishedPages(period, ctx) {
  return GUIDE_ARTICLES.map((article) => ({
    slug: article.slug,
    title: article.title,
    category: categoryLabel(article.category),
    status: 'published',
    views: hasLiveIntelligenceData()
      ? estimateViews(article.slug, ctx.search, ctx.comparisons)
      : article.slug === 'bestes-familienauto-bis-400-euro' ? 1240 : article.slug === 'ev3-oder-ev4' ? 890 : 0,
    priority: estimateViews(article.slug, ctx.search, ctx.comparisons) || 100,
    url: `/ratgeber/${article.slug}`,
    source: 'ratgeber',
  }));
}

function buildDraftTemplates(ctx, existingSlugs) {
  const drafts = [];

  for (const template of AUTO_TEMPLATES) {
    if (existingSlugs.has(template.slug)) continue;
    if (!template.match(ctx)) continue;
    drafts.push({
      slug: template.slug,
      title: template.title,
      category: template.category,
      status: 'draft',
      views: 0,
      priority: template.priority(ctx),
      url: `/trends/${template.slug}`,
      source: 'intelligence',
      reason: 'Nachfrage im gewählten Zeitraum',
    });
  }

  return drafts;
}

function buildComparisonSuggestions(ctx, existingSlugs) {
  const suggestions = [];

  for (const comp of ctx.comparisons.slice(0, 3)) {
    const slug = slugify(comp.pair);
    if (existingSlugs.has(slug)) continue;
    const inGuide = GUIDE_ARTICLES.some((a) => comp.pair.toLowerCase().includes(a.slug.replace(/-/g, ' ')));
    if (inGuide) continue;

    suggestions.push({
      slug,
      title: `${comp.pair}?`,
      category: 'Vergleich',
      status: 'suggested',
      views: 0,
      priority: comp.count * 3,
      url: `/trends/${slug}`,
      source: 'intelligence',
      reason: `${comp.count}× verglichen`,
    });
  }

  return suggestions;
}

function buildSearchSuggestions(ctx, existingSlugs) {
  const top = ctx.search[0];
  if (!top || top.count < 2) return [];

  const slug = slugify(`trend-${top.query}`);
  if (existingSlugs.has(slug)) return [];

  const known = GUIDE_ARTICLES.some((a) =>
    top.query.toLowerCase().includes(a.title.toLowerCase().slice(0, 12)),
  );
  if (known) return [];

  return [{
    slug,
    title: `Trend: ${top.query}`,
    category: 'Suchtrend',
    status: 'suggested',
    views: 0,
    priority: top.count * 2,
    url: `/trends/${slug}`,
    source: 'intelligence',
    reason: `Top-Suche (${top.count}×)`,
  }];
}

/**
 * Trendseiten für Intelligence-Dashboard
 */
export function generateIntelligenceTrendPages(period = '7d', liveMode = false) {
  const ctx = {
    search: liveMode ? getLiveSearchBehavior(period) : [],
    comparisons: liveMode ? getLiveComparisonRanking(period) : [],
    family: liveMode ? getLiveFamilyIndex(period) : [],
    electro: liveMode ? getLiveElectroIndex(period) : [],
    leasing: liveMode ? getLiveLeasingTrends(period) : { desiredRates: [] },
    offers: liveMode ? getLiveOffersIntelligence(period) : null,
  };

  const published = buildPublishedPages(period, ctx);
  const existingSlugs = new Set(published.map((p) => p.slug));

  const drafts = liveMode
    ? [
      ...buildDraftTemplates(ctx, existingSlugs),
      ...buildComparisonSuggestions(ctx, existingSlugs),
      ...buildSearchSuggestions(ctx, existingSlugs),
    ]
    : [];

  for (const page of drafts) {
    existingSlugs.add(page.slug);
  }

  return applyPublishedStatusToTrendPages(
    [...published, ...drafts].sort((a, b) => b.priority - a.priority),
  );
}

export function getMockTrendPages() {
  return [
    { slug: 'beste-familienautos-bis-400-euro', title: 'Beste Familienautos bis 400 €', category: 'Familienautos', status: 'published', views: 1240, priority: 200, url: '/ratgeber/bestes-familienauto-bis-400-euro', source: 'ratgeber' },
    { slug: 'beste-elektroautos-2026', title: `Beste Elektroautos ${YEAR}`, category: 'Elektroautos', status: 'draft', views: 0, priority: 80, url: null, source: 'mock' },
    { slug: 'beste-leasingangebote-der-woche', title: 'Beste Leasingangebote der Woche', category: 'Leasing', status: 'draft', views: 0, priority: 70, url: null, source: 'mock' },
    { slug: 'top-suv-unter-350-euro', title: 'Top SUV unter 350 €', category: 'SUV', status: 'draft', views: 0, priority: 60, url: null, source: 'mock' },
    { slug: 'ev3-oder-ev4', title: 'EV3 oder EV4?', category: 'Elektroautos', status: 'published', views: 890, priority: 180, url: '/ratgeber/ev3-oder-ev4', source: 'ratgeber' },
  ];
}
