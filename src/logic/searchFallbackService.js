import { filterMarketplaceVehicles } from './marketplaceService.js';

function queryText(filters) {
  return (filters.query ?? '').toLowerCase();
}

function isElectroSearch(filters) {
  const q = queryText(filters);
  return filters.fuel === 'elektro'
    || filters.type === 'elektro'
    || /elektro|ev\b|strom/.test(q);
}

function isSuvSearch(filters) {
  const q = queryText(filters);
  return filters.type === 'suv' || /suv|familien/.test(q);
}

function isUnrealisticElectroQuery(filters) {
  const q = queryText(filters);
  return isElectroSearch(filters)
    && (/1\.?000\s*km|1000\s*km/.test(q) || (filters.maxRate != null && filters.maxRate <= 500));
}

function isEightSeaterQuery(filters) {
  const q = queryText(filters);
  return /8\s*sitz|acht\s*sitz|8-sitz/.test(q);
}

function isTightBudgetQuery(filters) {
  return filters.maxPrice != null && filters.maxPrice <= 30000;
}

function buildCandidateSuggestions(filters) {
  const suggestions = [];
  const q = queryText(filters);

  if (isUnrealisticElectroQuery(filters)) {
    suggestions.push(
      {
        id: 'ev-range-500',
        label: 'Elektroautos über 500 km Reichweite',
        emoji: '⚡',
        patch: { fuel: 'elektro', type: 'elektro', maxRate: null, maxPrice: null },
      },
      {
        id: 'ev-rate-600',
        label: 'Elektroautos bis 600 €',
        emoji: '⚡',
        patch: { fuel: 'elektro', type: 'elektro', maxRate: 600, maxPrice: null },
      },
      {
        id: 'ev-suv',
        label: 'SUV Elektrofahrzeuge',
        emoji: '⚡',
        patch: { fuel: 'elektro', type: 'suv', maxRate: null, model: '' },
      },
      {
        id: 'ev-available',
        label: 'Sofort verfügbare Elektroautos',
        emoji: '⚡',
        patch: { fuel: 'elektro', type: 'elektro', sort: 'available', maxRate: null },
      },
    );
  }

  if (isEightSeaterQuery(filters) || (isSuvSearch(filters) && isTightBudgetQuery(filters))) {
    suggestions.push(
      {
        id: 'seven-seater',
        label: '7-Sitzer anzeigen',
        patch: { type: 'suv', model: 'Sorento', maxPrice: null, fuel: '' },
      },
      {
        id: 'budget-up',
        label: 'Budget erhöhen',
        patch: { maxPrice: 40000, maxRate: null },
      },
      {
        id: 'family-suv',
        label: 'Große Familienfahrzeuge',
        patch: { type: 'suv', household: 'family', maxPrice: null, model: '' },
      },
      {
        id: 'all-suv',
        label: 'Alle SUV anzeigen',
        patch: { type: 'suv', maxPrice: null, maxRate: null, fuel: '', model: '' },
      },
    );
  }

  if (/kleinwagen|mini|city/i.test(q) || filters.type === 'kleinwagen') {
    suggestions.push(
      {
        id: 'small-budget',
        label: 'Kleinwagen bis 20.000 €',
        patch: { type: 'kleinwagen', maxPrice: 20000, maxRate: null },
      },
      {
        id: 'kombi-alt',
        label: 'Kombi-Angebote anzeigen',
        patch: { type: 'kombi', maxPrice: null, model: '' },
      },
    );
  }

  if (filters.maxRate != null) {
    const relaxed = Math.min(filters.maxRate + 100, 600);
    if (relaxed > filters.maxRate) {
      suggestions.push({
        id: 'rate-relax',
        label: `Leasing bis ${relaxed} €`,
        patch: { maxRate: relaxed },
      });
    }
  }

  if (filters.radius != null && filters.radius <= 25) {
    suggestions.push({
      id: 'radius-50',
      label: 'Radius auf 50 km erweitern',
      patch: { radius: 50 },
    });
  }

  if (filters.radius != null && filters.radius < 100) {
    suggestions.push({
      id: 'radius-100',
      label: '100 km Radius',
      patch: { radius: 100 },
    });
  }

  if (filters.radius != null) {
    suggestions.push({
      id: 'radius-de',
      label: 'Deutschlandweit suchen',
      patch: { radius: null },
    });
  }

  if (!suggestions.length) {
    suggestions.push(
      { id: 'suv-all', label: 'SUV-Angebote anzeigen', patch: { type: 'suv', maxRate: null, fuel: '' } },
      { id: 'elektro-all', label: 'Elektroautos anzeigen', emoji: '⚡', patch: { fuel: 'elektro', type: 'elektro', maxRate: null } },
      { id: 'sort-best', label: 'Empfehlung in der Nähe', patch: { sort: 'best', maxRate: null, maxPrice: null, type: 'all', fuel: '' } },
    );
  }

  const seen = new Set();
  return suggestions.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function countMatches(vehicles, filters, patch) {
  return filterMarketplaceVehicles(vehicles, { ...filters, ...patch }).length;
}

export function buildSearchFallbackSuggestions(filters, vehicles) {
  const candidates = buildCandidateSuggestions(filters);
  return candidates.filter((item) => countMatches(vehicles, filters, item.patch) > 0);
}
