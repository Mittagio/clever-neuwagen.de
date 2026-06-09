/**
 * Verfügbarkeit als Ranking-Präferenz (Boost), nicht als harter Ausschluss in der Beratung.
 */

export function normalizeAvailabilityPreference(value) {
  if (!value) return null;
  if (value === 'sofort_verfuegbar') return 'sofort';
  return value;
}

export function vehicleMeetsAvailabilityPreference(vehicle = {}, preference = null) {
  const pref = normalizeAvailabilityPreference(preference);
  if (!pref) return false;
  if (pref === 'sofort') {
    return vehicle.availability === 'sofort'
      || vehicle.stockStatus === 'lager'
      || /sofort|lager/i.test(vehicle.deliveryTime ?? '');
  }
  return vehicle.availability === pref;
}

/**
 * @param {object} a – Match mit vehicle
 * @param {object} b
 * @param {string|null} preference
 * @returns {number} negativ = a zuerst
 */
export function compareAvailabilityPreference(a, b, preference = null) {
  const pref = normalizeAvailabilityPreference(preference);
  if (!pref) return 0;
  const aVehicle = a.vehicle ?? a;
  const bVehicle = b.vehicle ?? b;
  const aOk = vehicleMeetsAvailabilityPreference(aVehicle, pref);
  const bOk = vehicleMeetsAvailabilityPreference(bVehicle, pref);
  if (aOk === bOk) return 0;
  return aOk ? -1 : 1;
}
