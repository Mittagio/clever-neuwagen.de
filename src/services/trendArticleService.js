/**
 * Trendseiten – Artikel aus Intelligence + KI-Berater generieren
 */
import { getAdvisorRecommendations, formatAdvisorRate } from './advisorEngine.js';
import { getTrendTemplate, TREND_TEMPLATES } from '../data/trendCatalog.js';
import { generateGuideArticle } from './guideArticleService.js';
import { getGuideArticle } from '../data/guideCatalog.js';
import { calculateCleverScore } from './cleverScore.js';
import {
  hasLiveIntelligenceData,
  getLiveSearchBehavior,
  getLiveComparisonRanking,
  getLiveFamilyIndex,
  getLiveElectroIndex,
  getLiveBestDeals,
  getLiveLeasingTrends,
} from './intelligenceAnalytics.js';
import { generateIntelligenceTrendPages } from './intelligenceTrendPages.js';
import {
  isTrendPublished,
  getPublishedTrendPages,
} from './trendPublishService.js';

const DEFAULT_PERIOD = '7d';

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

function resolveMileageLabel(mileageId) {
  const map = {
    'under-10k': '10.000',
    '10k-15k': '15.000',
    '15k-20k': '20.000',
    'over-20k': '20.000+',
  };
  return map[mileageId] ?? '15.000';
}

function recFromIndexEntry(entry, conditions, profile) {
  const all = getAdvisorRecommendations(profile, conditions);
  const match = all.find(
    (r) => r.vehicleId === entry.vehicleId
      || r.id === entry.vehicleId
      || (entry.label && (r.fullLabel === entry.label || r.fullLabel?.includes(entry.label))),
  );
  if (match) return match;

  return {
    id: entry.vehicleId ?? entry.label,
    vehicleId: entry.vehicleId,
    fullLabel: entry.label,
    label: entry.label,
    monthlyRate: entry.rate,
    deliveryTime: `${entry.deliveryWeeks ?? 6} Wochen`,
    fuelLabel: entry.rangeKm ? 'Elektro' : '–',
    rangeKm: entry.rangeKm,
    hauspreis: null,
    rankMedal: '🥇',
    score: entry.cleverScore ?? entry.score ?? 50,
    sourceVehicle: { mock: true },
  };
}

function recFromDeal(deal, conditions, profile) {
  const all = getAdvisorRecommendations(profile, conditions);
  const match = all.find((r) => r.vehicleId === deal.vehicleId || r.id === deal.vehicleId);
  if (match) {
    return {
      ...match,
      monthlyRate: deal.rate ?? match.monthlyRate,
      cleverScore: deal.cleverScore,
    };
  }
  return {
    id: deal.vehicleId,
    vehicleId: deal.vehicleId,
    fullLabel: deal.label,
    label: deal.label,
    monthlyRate: deal.rate,
    deliveryTime: `${deal.deliveryWeeks} Wochen`,
    fuelLabel: '–',
    hauspreis: null,
    rankMedal: '🔥',
    cleverScore: deal.cleverScore,
    sourceVehicle: { mock: true },
  };
}

function rankRecommendations(recs) {
  return recs.map((item, index) => ({
    ...item,
    rank: index + 1,
    rankMedal: ['🥇', '🥈', '🥉', '4.', '5.'][index] ?? `${index + 1}.`,
  }));
}

function buildLeasingExamples(recommendations, profile) {
  return recommendations.slice(0, 4).map((rec) => ({
    label: rec.fullLabel ?? rec.label,
    rate: rec.monthlyRate,
    rateFormatted: formatAdvisorRate(rec.monthlyRate),
    termMonths: profile.termMonths ?? 48,
    mileagePerYear: resolveMileageLabel(profile.mileage),
    deliveryTime: rec.deliveryTime,
    hauspreis: rec.hauspreis,
    isLive: !rec.sourceVehicle?.mock && !!rec.engineId,
  }));
}

function buildMarketInsights(period) {
  const search = hasLiveIntelligenceData() ? getLiveSearchBehavior(period) : [];
  const comparisons = hasLiveIntelligenceData() ? getLiveComparisonRanking(period) : [];
  const leasing = hasLiveIntelligenceData() ? getLiveLeasingTrends(period) : { desiredRates: [] };

  return {
    topSearches: search.slice(0, 5),
    topComparisons: comparisons.slice(0, 3),
    topDesiredRate: leasing.desiredRates[0]?.label ?? '399 €',
    dataMode: hasLiveIntelligenceData() ? 'live' : 'demo',
  };
}

function pickFromTemplate(template, conditions, period) {
  const profile = template.profile;
  let recommendations = [];

  if (template.type === 'best-deals') {
    const deals = hasLiveIntelligenceData()
      ? getLiveBestDeals(period)
      : [];
    if (deals.length) {
      recommendations = rankRecommendations(
        deals.map((d) => recFromDeal(d, conditions, profile)),
      );
    }
  }

  if (template.type === 'electro-index') {
    const index = hasLiveIntelligenceData()
      ? getLiveElectroIndex(period)
      : [];
    if (index.length) {
      recommendations = rankRecommendations(
        index.map((e) => recFromIndexEntry(e, conditions, profile)),
      );
    }
  }

  if (template.type === 'family-index') {
    const index = hasLiveIntelligenceData()
      ? getLiveFamilyIndex(period)
      : [];
    if (index.length) {
      recommendations = rankRecommendations(
        index.map((e) => recFromIndexEntry(e, conditions, profile)),
      );
    }
  }

  if (template.type === 'budget-picks' || !recommendations.length) {
    const all = getAdvisorRecommendations(profile, conditions);
    recommendations = rankRecommendations(all.slice(0, 5));
  }

  return recommendations;
}

function buildComparisonTrend(slug, conditions, period) {
  const comparisons = hasLiveIntelligenceData()
    ? getLiveComparisonRanking(period)
    : [];
  const match = comparisons.find((c) => slugify(c.pair) === slug);
  if (!match) return null;

  const profile = {
    mileage: '10k-15k',
    household: 'couple',
    desiredRate: 400,
    fuelPreference: 'egal',
    bodyType: 'egal',
    wishes: [],
  };

  const all = getAdvisorRecommendations(profile, conditions);
  const terms = match.pair.split(' vs ').map((s) => s.trim().toLowerCase());
  const picks = all.filter((r) => {
    const label = (r.fullLabel ?? r.label ?? '').toLowerCase();
    return terms.some((t) => label.includes(t.split(' ').pop()));
  });

  const recommendations = rankRecommendations(
    picks.length >= 2 ? picks.slice(0, 3) : all.slice(0, 3),
  );

  return {
    slug,
    category: 'vergleich',
    title: `${match.pair}?`,
    metaDescription: `${match.pair}: Vergleich mit Leasingrate, Lieferzeit und Empfehlung – basierend auf ${match.count} Kundenvergleichen.`,
    intro: `${match.count} Mal wurde „${match.pair}“ in den letzten Tagen verglichen. Hier die datenbasierte Einordnung mit aktuellen Leasingbeispielen.`,
    readMinutes: 5,
    profile,
    recommendations,
    compareItems: recommendations.slice(0, 3),
    leasingExamples: buildLeasingExamples(recommendations, profile),
    marketInsights: {
      ...buildMarketInsights(period),
      highlightComparison: match,
    },
    generatedAt: new Date().toISOString(),
    dealerName: conditions.dealerName,
    type: 'comparison',
    source: 'intelligence',
    url: `/trends/${slug}`,
  };
}

function buildSearchTrend(slug, conditions, period) {
  if (!slug.startsWith('trend-')) return null;
  const search = hasLiveIntelligenceData() ? getLiveSearchBehavior(period) : [];
  const query = slug.replace(/^trend-/, '').replace(/-/g, ' ');
  const match = search.find((s) => slugify(s.query) === slug.replace(/^trend-/, ''))
    ?? search.find((s) => s.query.toLowerCase().includes(query));

  if (!match) return null;

  const profile = {
    mileage: '10k-15k',
    household: /familie/i.test(match.query) ? 'family' : 'couple',
    desiredRate: Number(match.query.match(/(\d+)/)?.[1]) || 399,
    fuelPreference: /elektro/i.test(match.query) ? 'elektro' : /hybrid/i.test(match.query) ? 'hybrid' : 'egal',
    bodyType: /suv/i.test(match.query) ? 'suv' : 'egal',
    wishes: [],
  };

  const all = getAdvisorRecommendations(profile, conditions);
  const recommendations = rankRecommendations(all.slice(0, 5));

  return {
    slug,
    category: 'markt',
    title: `Trend: ${match.query}`,
    metaDescription: `Was Kunden zu „${match.query}“ suchen – mit passenden Fahrzeugempfehlungen und Leasingbeispielen.`,
    intro: `„${match.query}“ gehört zu den häufigsten Suchanfragen (${match.count}× in den letzten Tagen). Diese Fahrzeuge passen am besten zu diesem Profil.`,
    readMinutes: 4,
    profile,
    recommendations,
    compareItems: recommendations.slice(0, 3),
    leasingExamples: buildLeasingExamples(recommendations, profile),
    marketInsights: buildMarketInsights(period),
    generatedAt: new Date().toISOString(),
    dealerName: conditions.dealerName,
    type: 'search-trend',
    source: 'intelligence',
    url: `/trends/${slug}`,
  };
}

export function generateTrendArticle(slug, conditions, period = DEFAULT_PERIOD) {
  const guideArticle = getGuideArticle(slug);
  if (guideArticle) {
    const generated = generateGuideArticle(slug, conditions);
    if (generated) {
      return {
        ...generated,
        slug,
        url: `/ratgeber/${slug}`,
        isRatgeberMirror: true,
        marketInsights: buildMarketInsights(period),
        type: 'ratgeber',
      };
    }
  }

  const template = getTrendTemplate(slug);
  if (template) {
    const recommendations = pickFromTemplate(template, conditions, period);
    return {
      ...template,
      recommendations,
      compareItems: recommendations.slice(0, 3),
      leasingExamples: buildLeasingExamples(recommendations, profileFromTemplate(template)),
      marketInsights: buildMarketInsights(period),
      generatedAt: new Date().toISOString(),
      dealerName: conditions.dealerName,
      url: `/trends/${slug}`,
      source: hasLiveIntelligenceData() ? 'intelligence' : 'advisor',
    };
  }

  if (!isTrendPublished(slug)) {
    return null;
  }

  return buildComparisonTrend(slug, conditions, period)
    ?? buildSearchTrend(slug, conditions, period);
}

function profileFromTemplate(template) {
  return template.profile;
}

export function listPublicTrendPages(period = DEFAULT_PERIOD) {
  const intelligencePages = generateIntelligenceTrendPages(period, hasLiveIntelligenceData());
  const pages = TREND_TEMPLATES.map((template) => {
    const intel = intelligencePages.find((p) => p.slug === template.slug);
    return {
      slug: template.slug,
      title: template.title,
      category: template.category,
      metaDescription: template.metaDescription,
      readMinutes: template.readMinutes,
      url: `/trends/${template.slug}`,
      status: 'published',
      priority: intel?.priority ?? 50,
      source: intel?.source === 'intelligence' ? 'intelligence' : 'trend',
    };
  });

  const seen = new Set(pages.map((p) => p.slug));

  for (const page of intelligencePages) {
    if (page.url?.startsWith('/ratgeber') && !seen.has(page.slug)) {
      seen.add(page.slug);
      const guide = getGuideArticle(page.slug);
      pages.push({
        slug: page.slug,
        title: page.title,
        category: page.category?.toLowerCase?.() ?? 'markt',
        metaDescription: guide?.metaDescription ?? page.title,
        readMinutes: guide?.readMinutes ?? 5,
        url: page.url,
        status: 'published',
        priority: page.priority,
        source: 'ratgeber',
      });
    }
  }

  for (const page of intelligencePages) {
    if (seen.has(page.slug)) continue;
    if (!isTrendPublished(page.slug)) continue;
    if (page.url?.startsWith('/ratgeber')) continue;

    seen.add(page.slug);
    const publishedMeta = getPublishedTrendPages().find((item) => item.slug === page.slug);
    pages.push({
      slug: page.slug,
      title: publishedMeta?.title ?? page.title,
      category: page.category?.toLowerCase?.() ?? 'markt',
      metaDescription: page.reason ?? page.title,
      readMinutes: 4,
      url: `/trends/${page.slug}`,
      status: 'published',
      priority: page.priority,
      source: 'intelligence',
      reason: page.reason,
      publishedAt: publishedMeta?.publishedAt,
    });
  }

  return pages.sort((a, b) => b.priority - a.priority);
}

export function buildTrendAdvisorLink(article) {
  const params = new URLSearchParams({ start: '1' });
  if (article?.profile?.desiredRate) {
    params.set('rate', String(article.profile.desiredRate));
  }
  return `/berater?${params.toString()}`;
}

export { calculateCleverScore };
