/**
 * Sprint 34 Phase A – „Warum empfehlen wir …?“
 */
export function buildRecommendReasons(match, { wishes, maxReasons = 5 } = {}) {
  const reasons = [];
  const cq = match?.cleverQuote;
  const vehicle = match?.vehicle ?? {};

  if (cq?.percent != null && cq.scorableTotal > 0) {
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
