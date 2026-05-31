/**
 * Clever Intelligence API v1
 * Maschinenlesbare Schnittstelle für Dashboard, Trends und externe KI-Systeme.
 *
 * Browser: JSON unter /api/v1/intelligence/:resource?period=7d
 * Später: gleiche Struktur auf Server/Edge ausrollen.
 */

import { getIntelligenceDashboard, getIntelligenceOverview, TIME_PERIODS } from './intelligenceEngine.js';
import { hasLiveIntelligenceData, getIntelligenceEventCount } from './intelligenceAnalytics.js';
import { listPublicTrendPages } from './trendArticleService.js';
import { getPublishedTrendPages } from './trendPublishService.js';
import { generateIntelligenceTrendPages } from './intelligenceTrendPages.js';

export const INTELLIGENCE_API_VERSION = '1.0.0';

export const INTELLIGENCE_API_RESOURCES = [
  {
    id: 'manifest',
    name: 'API Manifest',
    description: 'Metadaten, verfügbare Ressourcen und Datenmodus.',
  },
  {
    id: 'overview',
    name: 'Übersicht',
    description: 'KPIs, Top-Suche, Top-Empfehlung, Best Deal.',
  },
  {
    id: 'search',
    name: 'Suchverhalten',
    description: 'Top Suchanfragen und gefragte Ausstattungen.',
  },
  {
    id: 'recommendations',
    name: 'Empfehlungen',
    description: 'KI-Berater-Empfehlungen mit Conversion.',
  },
  {
    id: 'comparisons',
    name: 'Vergleiche',
    description: 'Häufigste Fahrzeug-Paarungen.',
  },
  {
    id: 'offers',
    name: 'Angebote',
    description: 'Angebots-Pipeline und Top-Modelle.',
  },
  {
    id: 'sales',
    name: 'Verkäufe',
    description: 'Abschlüsse, Umsatz, Top-Modelle.',
  },
  {
    id: 'leasing',
    name: 'Leasing-Trends',
    description: 'Wunschraten, Laufzeiten, Kilometer.',
  },
  {
    id: 'family-index',
    name: 'Familienindex',
    description: 'Top Familienfahrzeuge mit Score.',
  },
  {
    id: 'electro-index',
    name: 'Elektroindex',
    description: 'Top Elektrofahrzeuge mit Reichweite.',
  },
  {
    id: 'delivery',
    name: 'Lieferzeit-Monitor',
    description: 'Kürzeste und längste Lieferzeiten pro Modell.',
  },
  {
    id: 'best-deals',
    name: 'Best Deals',
    description: 'Beste Angebote der Woche mit Clever Score.',
  },
  {
    id: 'trend-pages',
    name: 'Trendseiten',
    description: 'Öffentliche Trend-Inhalte und Slugs.',
  },
  {
    id: 'published-trends',
    name: 'Veröffentlichte Trends',
    description: 'Live-Trends unter /trends und offene Vorschläge.',
  },
  {
    id: 'dashboard',
    name: 'Vollständiges Dashboard',
    description: 'Alle Intelligence-Daten in einem Payload.',
  },
];

const VALID_PERIODS = new Set(TIME_PERIODS.map((p) => p.id));

function normalizePeriod(period) {
  return VALID_PERIODS.has(period) ? period : '7d';
}

function getBaseUrl() {
  if (process.env.PUBLIC_URL) {
    return process.env.PUBLIC_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://www.clever-neuwagen.de';
}

export function buildIntelligenceApiUrl(resource, period = '7d', baseUrl = getBaseUrl()) {
  const p = normalizePeriod(period);
  return `${baseUrl}/api/v1/intelligence/${resource}?period=${p}`;
}

function apiEnvelope(resource, period, data, extra = {}) {
  return {
    apiVersion: INTELLIGENCE_API_VERSION,
    resource,
    period: normalizePeriod(period),
    dataMode: hasLiveIntelligenceData() ? 'live' : 'mock',
    eventCount: getIntelligenceEventCount(),
    generatedAt: new Date().toISOString(),
    source: 'clever-neuwagen-intelligence',
    publisher: 'Clever-Neuwagen',
    license: 'Proprietary – Nutzung nur mit Zustimmung',
    data,
    links: {
      self: buildIntelligenceApiUrl(resource, period),
      dashboard: `${getBaseUrl()}/intelligence`,
      trends: `${getBaseUrl()}/trends`,
      ratgeber: `${getBaseUrl()}/ratgeber`,
      advisor: `${getBaseUrl()}/berater?start=1`,
      apiDocs: `${getBaseUrl()}/intelligence/api`,
      ...extra.links,
    },
    ...extra,
  };
}

export function getIntelligenceApiManifest(baseUrl = getBaseUrl()) {
  return apiEnvelope('manifest', '7d', {
    resources: INTELLIGENCE_API_RESOURCES.map((r) => ({
      ...r,
      href: buildIntelligenceApiUrl(r.id, '7d', baseUrl),
      periods: TIME_PERIODS.map((p) => p.id),
    })),
    usage: {
      format: 'application/json',
      example: buildIntelligenceApiUrl('overview', '7d', baseUrl),
      parameters: {
        period: 'today | 7d | 30d (Query-Parameter)',
      },
    },
  });
}

export function getIntelligenceApiResponse(resource, period = '7d', baseUrl = getBaseUrl()) {
  const p = normalizePeriod(period);
  const id = resource?.replace(/\.json$/, '') ?? 'manifest';

  if (id === 'manifest') {
    return getIntelligenceApiManifest(baseUrl);
  }

  const dashboard = getIntelligenceDashboard(p);

  const resourceMap = {
    overview: () => dashboard.overview,
    search: () => ({
      queries: dashboard.search,
      equipment: dashboard.equipmentDemand,
    }),
    recommendations: () => dashboard.recommendations,
    comparisons: () => dashboard.comparisons,
    offers: () => dashboard.offers,
    sales: () => dashboard.sales,
    leasing: () => dashboard.leasing,
    'family-index': () => dashboard.familyIndex,
    'electro-index': () => dashboard.electroIndex,
    delivery: () => dashboard.delivery,
    'best-deals': () => dashboard.bestDeals,
    'trend-pages': () => listPublicTrendPages(p),
    'published-trends': () => {
      const live = hasLiveIntelligenceData();
      const base = getBaseUrl();
      const published = getPublishedTrendPages().map((page) => ({
        ...page,
        url: `${base}/trends/${page.slug}`,
        status: 'published',
      }));
      const suggestions = generateIntelligenceTrendPages(p, live)
        .filter((page) => page.source === 'intelligence' && page.status !== 'published')
        .map((page) => ({
          slug: page.slug,
          title: page.title,
          category: page.category,
          status: page.status,
          reason: page.reason,
          priority: page.priority,
          previewUrl: `${base}/trends/${page.slug}`,
        }));
      return { published, suggestions, publicCount: published.length };
    },
    dashboard: () => ({
      overview: dashboard.overview,
      search: dashboard.search,
      equipmentDemand: dashboard.equipmentDemand,
      recommendations: dashboard.recommendations,
      comparisons: dashboard.comparisons,
      offers: dashboard.offers,
      sales: dashboard.sales,
      leasing: dashboard.leasing,
      familyIndex: dashboard.familyIndex,
      electroIndex: dashboard.electroIndex,
      delivery: dashboard.delivery,
      bestDeals: dashboard.bestDeals,
      trendPages: listPublicTrendPages(p),
      scoreWeights: dashboard.scoreWeights,
    }),
  };

  const builder = resourceMap[id];
  if (!builder) {
    const err = new Error(`Unknown resource: ${id}`);
    err.code = 'NOT_FOUND';
    err.available = INTELLIGENCE_API_RESOURCES.map((r) => r.id);
    throw err;
  }

  return apiEnvelope(id, p, builder(), {
    links: {
      trendPages: `${baseUrl}/trends`,
    },
  });
}

export function exportIntelligenceJson(resource, period = '7d') {
  return JSON.stringify(getIntelligenceApiResponse(resource, period), null, 2);
}

export function downloadIntelligenceJson(resource, period = '7d') {
  const json = exportIntelligenceJson(resource, period);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clever-intelligence-${resource}-${period}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Für LLM / RAG: kompakte Text-Zusammenfassung */
export function getIntelligenceApiSummary(period = '7d') {
  const overview = getIntelligenceOverview(period);
  const dash = getIntelligenceDashboard(period);

  return {
    summary: [
      `Clever-Neuwagen Intelligence (${overview.dataMode}, ${period})`,
      `Top-Suche: ${overview.topSearch?.query ?? '–'} (${overview.topSearch?.count ?? 0})`,
      `Top-Empfehlung: ${overview.topRecommendation?.label ?? '–'}`,
      `Top-Vergleich: ${overview.topComparison?.pair ?? '–'}`,
      `Best Deal: ${overview.bestDeal?.label ?? '–'} (Score ${overview.bestDeal?.cleverScore ?? '–'})`,
      `Familienindex #1: ${dash.familyIndex[0]?.label ?? '–'}`,
      `Elektroindex #1: ${dash.electroIndex[0]?.label ?? '–'}`,
    ].join('\n'),
    citations: listPublicTrendPages(period).slice(0, 5).map((p) => ({
      title: p.title,
      url: `${getBaseUrl()}${p.url}`,
    })),
  };
}

export function getIntelligenceApiResponseSafe(resource, period = '7d') {
  try {
    return getIntelligenceApiResponse(resource, period);
  } catch (error) {
    return {
      apiVersion: INTELLIGENCE_API_VERSION,
      error: true,
      message: error.message,
      code: error.code ?? 'ERROR',
      available: error.available ?? INTELLIGENCE_API_RESOURCES.map((r) => r.id),
      generatedAt: new Date().toISOString(),
    };
  }
}
