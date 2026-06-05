/** URL-Bau für /fahrzeuge – ohne schwere Service-Abhängigkeiten. */

export function buildFahrzeugeSearchUrl(filters = {}) {
  const params = new URLSearchParams();
  if (filters.query) params.set('query', filters.query);
  if (filters.city) params.set('city', filters.city);
  if (filters.plz) params.set('plz', filters.plz);
  if (filters.locLabel) params.set('locLabel', filters.locLabel);
  if (filters.locSkip) params.set('locSkip', '1');
  if (filters.radius != null) params.set('radius', String(filters.radius));
  if (filters.maxRate != null) params.set('maxRate', String(filters.maxRate));
  if (filters.maxPrice != null) params.set('maxPrice', String(filters.maxPrice));
  if (filters.type && filters.type !== 'all') params.set('type', filters.type);
  if (filters.fuel) params.set('fuel', filters.fuel);
  if (filters.payment) params.set('payment', filters.payment);
  if (filters.model) params.set('model', filters.model);
  if (filters.trim) params.set('trim', filters.trim);
  if (filters.household) params.set('household', filters.household);
  if (filters.termMonths && filters.termMonths !== 48) params.set('term', String(filters.termMonths));
  if (filters.mileagePerYear && filters.mileagePerYear !== 10000) {
    params.set('mileageYear', String(filters.mileagePerYear));
  }
  if (filters.sort && filters.sort !== 'best') params.set('sort', filters.sort);
  if (filters.seo) params.set('seo', filters.seo);
  if (filters.brand) params.set('brand', filters.brand);
  if (filters.availability) params.set('availability', filters.availability);
  if (filters.features?.length) params.set('features', filters.features.join(','));
  if (filters.rangeKmMin != null) params.set('rangeKm', String(filters.rangeKmMin));
  if (filters.towCapacityKg != null) params.set('towKg', String(filters.towCapacityKg));
  if (filters.transmission) params.set('transmission', filters.transmission);
  if (filters.intentStructured) params.set('structured', '1');
  if (filters.powerPsTarget != null) {
    params.set('powerPs', String(filters.powerPsTarget));
    if (filters.powerPsMin != null) params.set('powerPsMin', String(filters.powerPsMin));
    if (filters.powerPsMax != null) params.set('powerPsMax', String(filters.powerPsMax));
  }
  if (filters.excludedBrands?.length) {
    params.set('excludeBrand', filters.excludedBrands.join(','));
  }
  if (filters.excludedModels?.length) {
    params.set('excludeModel', filters.excludedModels.join(','));
  }
  if (filters.useCase) params.set('useCase', filters.useCase);
  if (filters.dealer) params.set('dealer', filters.dealer);
  const qs = params.toString();
  return `/fahrzeuge${qs ? `?${qs}` : ''}`;
}
