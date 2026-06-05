import { formatMatchDeliveryLabel } from '../../logic/discoveryDisplay.js';
import { buildAdvisorWhyBullets } from '../sales/advisorRanking.js';

/**
 * Sprint 37 – „Warum empfehlen wir dieses Fahrzeug?“ (vergleichend im Beratermodus)
 */
export function buildWishMatchBullets(match, { wishes, maxReasons = 5, allMatches, chipIds } = {}) {
  if (match?.cleverQuote?.advisorMode || (allMatches?.length ?? 0) > 1) {
    const advisorBullets = buildAdvisorWhyBullets(match, {
      wishes,
      allMatches: allMatches ?? [],
      maxReasons,
      chipIds: chipIds ?? [],
    });
    if (advisorBullets.length) return advisorBullets;
  }
  const bullets = [];
  const seen = new Set();
  const vehicle = match?.vehicle ?? {};
  const cq = match?.cleverQuote;
  const budgetMax = wishes?.budget?.maxMonthlyRate;
  const rate = match?.displayRate ?? match?.bestOffer?.monthlyRate ?? vehicle.monthlyRate;

  function push(text) {
    const key = text.toLowerCase();
    if (!text || seen.has(key)) return;
    seen.add(key);
    bullets.push(text);
  }

  const items = cq?.items ?? [];
  items
    .filter((i) => i.status === 'fulfilled' && i.label)
    .forEach((i) => push(`${i.label} bereits enthalten`));

  if (!items.length && match?.matchedFeatures?.length) {
    match.matchedFeatures.forEach((f) => {
      const label = typeof f === 'string' ? f : f.label ?? f.id;
      push(`${label} bereits enthalten`);
    });
  }

  const range = Number(vehicle.rangeKm ?? vehicle.wltpRange);
  if (Number.isFinite(range) && range > 0) {
    push(`${range} km Reichweite`);
  }

  if (budgetMax && rate != null && rate <= budgetMax) {
    push(`Unter Ihrem Budget von ${budgetMax} €`);
  }

  const delivery = formatMatchDeliveryLabel(match);
  if (delivery) push(delivery);

  if (bullets.length >= maxReasons) return bullets.slice(0, maxReasons);

  const fallback = buildRecommendReasons(match, { wishes, maxReasons });
  fallback.forEach((r) => {
    if (bullets.length < maxReasons) push(r);
  });

  return bullets.slice(0, maxReasons);
}

export function buildRecommendReasons(match, { wishes, maxReasons = 5 } = {}) {
  const reasons = [];
  const cq = match?.cleverQuote;
  const vehicle = match?.vehicle ?? {};

  if (cq?.percent != null && cq.scorableTotal > 0 && !reasons.length) {
    reasons.push(`Erfüllt ${cq.matched} von ${cq.scorableTotal} prüfbaren Wünschen`);
  }

  const budgetMax = wishes?.budget?.maxMonthlyRate;
  const rate = match?.displayRate ?? match?.bestOffer?.monthlyRate ?? vehicle.monthlyRate;
  if (budgetMax && rate != null && rate <= budgetMax) {
    reasons.push('Liegt im gewünschten Budget');
  }

  if (wishes?.powertrain === 'elektro' && vehicle.powertrain === 'elektro') {
    const range = Number(vehicle.rangeKm ?? vehicle.wltpRange);
    if (Number.isFinite(range) && range >= 400) {
      reasons.push('Starke Reichweite im Budget');
    } else if (Number.isFinite(range)) {
      reasons.push(`${range} km Reichweite (WLTP)`);
    }
  }

  if (cq?.items?.some((i) => i.id === 'heat_pump' && i.fulfilled)) {
    reasons.push('Wärmepumpe verfügbar');
  }

  if (match?.kiaMeta?.cleverQuoteFull) {
    reasons.push('Ausstattung über Kia-Registry verifiziert');
  } else if (cq?.uncertainCount > 0) {
    reasons.push(`${cq.uncertainCount} Wunsch${cq.uncertainCount === 1 ? '' : 'wünsche'} derzeit nicht sicher prüfbar`);
  }

  if (vehicle.discountPercent >= 10) {
    reasons.push('Attraktives Preis-Leistungs-Verhältnis');
  }

  if (vehicle.availability === 'sofort' || /sofort/i.test(vehicle.deliveryTime ?? '')) {
    reasons.push('Kurzfristig verfügbar');
  }

  return reasons.slice(0, maxReasons);
}
