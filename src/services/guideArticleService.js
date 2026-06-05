/**
 * Ratgeber – Artikel aus KI-Berater-Ergebnissen generieren
 */
import { getAdvisorRecommendations, formatAdvisorRate } from './advisorEngine.js';
import { buildFahrzeugeUrlFromAdvisorProfile } from './advisor/advisorRouteBridge.js';
import { getGuideArticle } from '../data/guideCatalog.js';

function enrichMockForGuide(mock, profile) {
  const fullLabel = `${mock.brand} ${mock.model} ${mock.variant}`;
  return {
    id: mock.id,
    vehicleId: mock.id,
    brand: mock.brand,
    model: mock.model,
    variant: mock.variant,
    fullLabel,
    label: `${mock.model} ${mock.variant}`,
    engineName: mock.fuelCategory === 'elektro' ? 'Elektro' : 'Hybrid',
    fuelLabel: mock.fuelCategory === 'elektro' ? 'Elektro' : mock.fuelCategory === 'hybrid' ? 'Hybrid' : 'Verbrenner',
    monthlyRate: mock.mockRate ?? 0,
    hauspreis: mock.mockHauspreis ?? 0,
    deliveryTime: mock.mockDeliveryTime ?? '6–8 Wochen',
    availabilityLabel: '🟡 Konfigurierbar',
    highlights: mock.highlights ?? [],
    reasonBullets: mock.highlights?.slice(0, 3) ?? ['Markenmodell', 'Leasing möglich'],
    rangeKm: mock.rangeKm,
    score: 50,
    isHotDeal: false,
    sourceVehicle: mock,
    engineId: mock.engineId ?? null,
    trimId: mock.trimId ?? null,
  };
}

function pickRecommendations(all, articleDef) {
  const { focusVehicleIds, supplementalVehicles = [] } = articleDef;

  let picks = [];

  if (focusVehicleIds?.length) {
    for (const vid of focusVehicleIds) {
      const match = all.find(
        (r) => r.id === vid || r.vehicleId === vid || r.id.startsWith(vid),
      );
      if (match && !picks.some((p) => p.id === match.id)) {
        picks.push(match);
      }
    }
  }

  if (picks.length < 3) {
    for (const rec of all) {
      if (picks.length >= 5) break;
      if (!picks.some((p) => p.id === rec.id)) picks.push(rec);
    }
  }

  return picks.slice(0, 5).map((item, index) => ({
    ...item,
    rank: index + 1,
    rankMedal: ['🥇', '🥈', '🥉', '4.', '5.'][index] ?? `${index + 1}.`,
  }));
}

export function generateGuideArticle(slug, conditions) {
  const articleDef = getGuideArticle(slug);
  if (!articleDef) return null;

  const profile = articleDef.profile;
  const allRecs = getAdvisorRecommendations(profile, conditions);

  const supplemental = (articleDef.supplementalVehicles ?? []).map((mock) =>
    enrichMockForGuide(mock, profile),
  );

  const merged = [...allRecs];
  for (const s of supplemental) {
    if (!merged.some((r) => r.model === s.model && r.variant === s.variant)) {
      merged.push(s);
    }
  }

  merged.sort((a, b) => b.score - a.score || a.diff - b.diff);

  const recommendations = pickRecommendations(merged, articleDef);
  const compareItems = recommendations.slice(0, 3);

  const leasingExamples = recommendations.slice(0, 4).map((rec) => ({
    label: rec.fullLabel ?? `${rec.model} ${rec.variant}`,
    rate: rec.monthlyRate,
    rateFormatted: formatAdvisorRate(rec.monthlyRate),
    termMonths: profile.termMonths ?? 48,
    mileagePerYear: resolveMileageLabel(profile.mileage),
    deliveryTime: rec.deliveryTime,
    hauspreis: rec.hauspreis,
    isLive: !rec.sourceVehicle?.mock && !!rec.engineId,
  }));

  return {
    ...articleDef,
    recommendations,
    compareItems,
    leasingExamples,
    generatedAt: new Date().toISOString(),
    dealerName: conditions.dealerName,
  };
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

export function buildAdvisorDeepLink(articleDef) {
  return buildFahrzeugeUrlFromAdvisorProfile(articleDef?.profile ?? {}, articleDef?.title ?? '');
}

export function buildConfiguratorLink(rec) {
  if (rec.engineId && rec.trimId) {
    return '/haendler/autohaus-trinkle#sportage-konfigurator';
  }
  return '/haendler/autohaus-trinkle#sportage-konfigurator';
}
