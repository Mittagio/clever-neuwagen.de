/**
 * KI-Verkaufsassistent – Analytics (localStorage)
 * Speichert häufige Wunschraten, Fahrzeugarten und Top-Empfehlungen.
 */

const STORAGE_KEY = 'clever-neuwagen-assistant-analytics';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* Fallback */
  }
  return {
    sessions: 0,
    desiredRates: {},
    vehicleTypes: {},
    fuelPreferences: {},
    recommendations: {},
    lastUpdated: null,
  };
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...data,
    lastUpdated: new Date().toISOString(),
  }));
}

function increment(map, key) {
  if (!key) return;
  map[key] = (map[key] ?? 0) + 1;
}

function topEntries(map, limit = 5) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

export function recordAssistantSession(input, recommendations = []) {
  const data = load();
  data.sessions += 1;

  increment(data.desiredRates, String(input.desiredRate ?? input.rate ?? ''));
  increment(data.vehicleTypes, input.vehicleType ?? 'egal');
  increment(data.fuelPreferences, input.fuelPreference ?? 'egal');

  for (const rec of recommendations.slice(0, 3)) {
    const key = rec.fullLabel ?? rec.label ?? rec.vehicleId ?? rec.id;
    increment(data.recommendations, key);
  }

  save(data);
  return data;
}

export function getAssistantAnalytics() {
  const data = load();
  return {
    sessions: data.sessions,
    topDesiredRates: topEntries(data.desiredRates),
    topVehicleTypes: topEntries(data.vehicleTypes),
    topRecommendations: topEntries(data.recommendations),
    lastUpdated: data.lastUpdated,
  };
}

export function resetAssistantAnalytics() {
  localStorage.removeItem(STORAGE_KEY);
}
