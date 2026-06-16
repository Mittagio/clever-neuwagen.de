/**
 * Einfache lokale Modell-Vorschläge für Dealer AI (Verkäufer-Aha-Moment).
 */

export const KIA_SUGGESTED_MODELS = [
  {
    id: 'stonic',
    name: 'Kia Stonic',
    modelKey: 'stonic',
    type: 'SUV',
    lengthMm: 4140,
    drive: ['Benzin'],
    transmission: ['Automatik'],
    priceHint: 'ab ca. 220–280 €/Monat möglich',
    badge: 'preislich interessant',
    reason: 'Kompakter SUV, Benziner, Automatik und nah am Wunschbudget.',
    bodyType: 'suv',
  },
  {
    id: 'xceed',
    name: 'Kia XCeed',
    modelKey: 'xceed',
    type: 'Crossover',
    lengthMm: 4395,
    drive: ['Benzin'],
    transmission: ['Automatik'],
    priceHint: 'ca. 250–320 €/Monat möglich',
    badge: 'passt zur Größe',
    reason: 'Crossover unter 4,50 m, Benziner und Automatik möglich.',
    bodyType: 'suv',
  },
  {
    id: 'sportage',
    name: 'Kia Sportage',
    modelKey: 'sportage',
    type: 'SUV',
    lengthMm: 4515,
    drive: ['Benzin', 'Hybrid'],
    transmission: ['Automatik'],
    priceHint: 'mit Aktion evtl. passend',
    badge: 'beliebte Alternative',
    reason: 'Etwas über 4,50 m, aber oft die naheliegende SUV-Alternative.',
    bodyType: 'suv',
  },
  {
    id: 'niro',
    name: 'Kia Niro',
    modelKey: 'niro',
    type: 'SUV',
    lengthMm: 4420,
    drive: ['Hybrid', 'Elektro'],
    transmission: ['Automatik'],
    priceHint: 'je nach Aktion ca. 280–350 €/Monat',
    badge: 'Hybrid-Alternative',
    reason: 'Falls der Kunde auch Hybrid akzeptiert, könnte der Niro interessant sein.',
    bodyType: 'suv',
  },
  {
    id: 'ev3',
    name: 'Kia EV3',
    modelKey: 'ev3',
    type: 'SUV',
    lengthMm: 4300,
    drive: ['Elektro'],
    transmission: ['Automatik'],
    priceHint: 'ca. 299–380 €/Monat möglich',
    badge: 'Elektro-Alternative',
    reason: 'Kompakter Elektro-SUV mit guter Reichweite.',
    bodyType: 'suv',
  },
  {
    id: 'ev5',
    name: 'Kia EV5',
    modelKey: 'ev5',
    type: 'SUV',
    lengthMm: 4695,
    drive: ['Elektro'],
    transmission: ['Automatik'],
    priceHint: 'ab ca. 419 €/Monat oder ab 45.990 €',
    badge: 'passt sehr gut',
    reason: 'Großer Elektro-SUV mit viel Platz für Familie und Gepäck.',
    bodyType: 'suv',
  },
  {
    id: 'ev4',
    name: 'Kia EV4',
    modelKey: 'ev4',
    type: 'Limousine',
    lengthMm: 4730,
    drive: ['Elektro'],
    transmission: ['Automatik'],
    priceHint: 'Elektro-Limousine, je nach Aktion ca. 350–450 €/Monat',
    badge: 'Elektro-Alternative',
    reason: 'Elektro-Limousine als Alternative im Kia-Sortiment.',
    bodyType: 'limousine',
  },
  {
    id: 'ev6',
    name: 'Kia EV6',
    modelKey: 'ev6',
    type: 'SUV',
    lengthMm: 4680,
    drive: ['Elektro'],
    transmission: ['Automatik'],
    priceHint: 'Premium-Elektro-SUV, je nach Aktion ca. 450–550 €/Monat',
    badge: 'Elektro-Alternative',
    reason: 'Sportlicher Elektro-Crossover mit starker Reichweite.',
    bodyType: 'suv',
  },
];

const CASH_PRICE_HINTS = {
  ev5: 'ab 45.990 € Listenpreis, Kauf/Bar möglich',
  ev3: 'ab ca. 39.990 € Listenpreis, Kauf/Bar möglich',
  ev4: 'ab ca. 42.990 € Listenpreis, Kauf/Bar möglich',
  ev6: 'ab ca. 47.990 € Listenpreis, Kauf/Bar möglich',
};

function normalizeModelId(modelId, modelName) {
  if (modelId) return String(modelId).toLowerCase();
  if (!modelName) return null;
  return String(modelName).toLowerCase().replace(/\s+/g, '');
}

function buildPrimaryMatchModel(wish) {
  const modelId = normalizeModelId(wish.modelId, wish.model);
  if (!modelId) return null;

  const catalogModel = KIA_SUGGESTED_MODELS.find(
    (m) => m.id === modelId || m.modelKey === modelId,
  );

  const label = wish.model ?? catalogModel?.name?.replace(/^Kia\s+/i, '') ?? modelId.toUpperCase();
  const isCash = wish.paymentType === 'cash';

  if (catalogModel) {
    return {
      ...catalogModel,
      matchScore: 100,
      badge: 'passt sehr gut',
      reason: `Direkt zum erkannten Wunsch „Kia ${label}“.`,
      priceHint: isCash && CASH_PRICE_HINTS[catalogModel.id]
        ? CASH_PRICE_HINTS[catalogModel.id]
        : catalogModel.priceHint,
      isPrimaryMatch: true,
    };
  }

  return {
    id: modelId,
    name: `Kia ${label}`,
    modelKey: modelId,
    type: 'SUV',
    lengthMm: null,
    drive: wish.motorLabel?.toLowerCase().includes('elektro') ? ['Elektro'] : ['Benzin'],
    transmission: ['Automatik'],
    priceHint: isCash ? 'Kauf/Bar nach Verfügbarkeit' : 'je nach Konditionen',
    badge: 'passt sehr gut',
    reason: `Direkt zum erkannten Wunsch „Kia ${label}“.`,
    bodyType: wish.bodyType ?? 'suv',
    matchScore: 100,
    isPrimaryMatch: true,
  };
}

function scoreModel(model, wish) {
  let score = 0;
  const reasons = [];

  if (wish.bodyType && /suv|crossover/i.test(wish.bodyType)) {
    if (/suv|crossover/i.test(model.type)) {
      score += 3;
    }
  }

  if (wish.motorLabel) {
    const motor = wish.motorLabel.toLowerCase();
    if (motor.includes('benzin') && model.drive.some((d) => d.toLowerCase().includes('benzin'))) {
      score += 4;
      reasons.push('Benziner möglich');
    }
    if (motor.includes('hybrid') && model.drive.some((d) => /hybrid|elektro/i.test(d))) {
      score += 2;
    }
    if (motor.includes('elektro') && model.drive.some((d) => d.toLowerCase().includes('elektro'))) {
      score += 4;
      reasons.push('Elektro möglich');
    }
  } else if (/^ev\d/i.test(model.id) || model.drive.some((d) => d.toLowerCase().includes('elektro'))) {
    if (/^ev\d/i.test(wish.modelId ?? '') || /^ev\d/i.test(wish.model ?? '')) {
      score += 5;
      reasons.push('Elektro-Wunsch');
    }
  }

  if (wish.transmission && model.transmission.includes(wish.transmission)) {
    score += 2;
  }

  if (wish.maxLengthMm) {
    if (model.lengthMm <= wish.maxLengthMm) {
      score += 4;
      reasons.push('passt zur Größe');
    } else if (model.lengthMm <= wish.maxLengthMm + 150) {
      score += 1;
      reasons.push('knapp über Länge');
    }
  }

  if (wish.desiredRate) {
    const rate = wish.desiredRate;
    if (model.id === 'stonic' && rate <= 280) score += 3;
    if (model.id === 'xceed' && rate >= 220 && rate <= 350) score += 3;
    if (model.id === 'sportage' && rate >= 250) score += 2;
    if (model.id === 'niro' && rate >= 280) score += 1;
    if (model.id === 'ev3' && rate >= 299) score += 1;
    if (model.id === 'ev5' && rate >= 419) score += 2;
  }

  if (wish.modelId && (model.id === wish.modelId || model.modelKey === wish.modelId)) {
    score += 20;
    reasons.push('direkter Modelltreffer');
  }

  if (wish.mileagePerYear && wish.mileagePerYear <= 10000 && model.id === 'stonic') {
    score += 1;
  }

  return { score, reasons };
}

/**
 * @param {object} fields – erkannte Kundenwunsch-Felder
 * @returns {Array<object>}
 */
export function matchSuggestedModels(fields) {
  const wish = fields ?? {};
  const primaryMatch = buildPrimaryMatchModel(wish);

  const ranked = KIA_SUGGESTED_MODELS.map((model) => {
    const { score, reasons } = scoreModel(model, wish);
    return {
      ...model,
      matchScore: score,
      matchReasons: reasons,
    };
  })
    .filter((m) => m.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore);

  if (primaryMatch) {
    const alternatives = ranked
      .filter((m) => m.id !== primaryMatch.id)
      .slice(0, 3);
    return [primaryMatch, ...alternatives];
  }

  if (ranked.length >= 2) return ranked.slice(0, 4);
  return KIA_SUGGESTED_MODELS.slice(0, 4).map((model) => ({
    ...model,
    matchScore: 1,
    matchReasons: [],
  }));
}
