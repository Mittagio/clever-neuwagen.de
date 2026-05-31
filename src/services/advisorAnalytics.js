const STORAGE_KEY = 'clever-neuwagen-advisor-analytics';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* */ }
  return { sessions: 0, desiredRates: {}, bodyTypes: {}, fuelTypes: {}, recommendations: {}, lastUpdated: null };
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, lastUpdated: new Date().toISOString() }));
}

function increment(map, key) {
  if (!key) return;
  map[key] = (map[key] ?? 0) + 1;
}

function topEntries(map, limit = 5) {
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([label, count]) => ({ label, count }));
}

export function recordAdvisorSession(profile, recommendations = []) {
  const data = load();
  data.sessions += 1;
  increment(data.desiredRates, String(profile.desiredRate ?? ''));
  increment(data.bodyTypes, profile.bodyType ?? 'egal');
  increment(data.fuelTypes, profile.fuelPreference ?? 'egal');
  for (const rec of recommendations.slice(0, 3)) {
    increment(data.recommendations, rec.fullLabel ?? rec.label);
  }
  save(data);
  return data;
}

export function getAdvisorAnalytics() {
  const data = load();
  return {
    sessions: data.sessions,
    topDesiredRates: topEntries(data.desiredRates),
    topBodyTypes: topEntries(data.bodyTypes),
    topRecommendations: topEntries(data.recommendations),
    lastUpdated: data.lastUpdated,
  };
}
