/**
 * OpenAI Intent Parser – vorbereitet für Structured Outputs.
 * Aktuell: lokaler Parser (searchProfile). OpenAI nur wenn API-Key gesetzt.
 */

import { buildSearchProfile, SEARCH_PROFILE_JSON_SCHEMA } from './searchProfile.js';
import { parseSearchIntent } from './searchIntentParser.js';
import { normalizeFeatureIdsToInternal } from './canonicalFeatureIds.js';

function mergeRemoteProfile(localProfile, remote) {
  const budget = remote.budget ?? null;
  return {
    ...localProfile,
    fuel: remote.fuel ?? localProfile.fuel,
    minRangeKm: remote.minRangeKm ?? localProfile.minRangeKm,
    rangeKmMin: remote.minRangeKm ?? localProfile.rangeKmMin,
    seatsMin: remote.seatsMin ?? localProfile.seatsMin,
    requiredFeatures: normalizeFeatureIdsToInternal(
      remote.requiredFeatures?.length ? remote.requiredFeatures : localProfile.requiredFeatures,
    ),
    softPreferences: remote.softPreferences ?? localProfile.softPreferences,
    maxMonthlyRate: budget?.maxMonthlyRate ?? localProfile.maxMonthlyRate,
    maxPrice: budget?.maxPrice ?? localProfile.maxPrice,
    payment: budget?.type ?? localProfile.payment,
    confidence: remote.confidence ?? localProfile.confidence,
  };
}

/**
 * Parst Kundenwunsch → SearchProfile.
 * OpenAI darf NUR das Profil liefern, nie Fahrzeuge auswählen.
 *
 * @param {string} query
 * @param {object} [options]
 * @param {boolean} [options.useOpenAi] – erzwingt API (falls konfiguriert)
 */
export async function parseCustomerSearchProfile(query, options = {}) {
  const localIntent = parseSearchIntent(query);
  const localProfile = buildSearchProfile({ query, intent: localIntent });

  const apiKey = typeof import.meta !== 'undefined'
    ? import.meta.env?.VITE_OPENAI_API_KEY
    : process.env?.OPENAI_API_KEY;

  if (!options.useOpenAi || !apiKey) {
    return {
      profile: localProfile,
      source: 'local',
      intent: localIntent,
    };
  }

  try {
    const remote = await fetchOpenAiStructuredProfile(query, apiKey);
    const merged = mergeRemoteProfile(localProfile, remote);
    return {
      profile: merged,
      source: 'openai',
      intent: localIntent,
    };
  } catch {
    return {
      profile: localProfile,
      source: 'local_fallback',
      intent: localIntent,
    };
  }
}

/** Synchroner Einstieg – nutzt lokalen Parser (Produktion ohne API). */
export function parseCustomerSearchProfileSync(query, extras = {}) {
  const intent = extras.intent ?? parseSearchIntent(query);
  return {
    profile: buildSearchProfile({ query, intent, ...extras }),
    source: 'local',
    intent,
  };
}

async function fetchOpenAiStructuredProfile(query, apiKey) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Du übersetzt Autokundenwünsche in ein strukturiertes Suchprofil (SearchProfile JSON). '
            + 'Du wählst KEINE Fahrzeuge aus, berechnest KEINE CleverQuote und erfindest KEINE Ausstattung. '
            + 'Mappe Kundenbegriffe auf interne Feature-IDs: camera_360, heat_pump, heated_front_seats, electric_tailgate.',
        },
        { role: 'user', content: query },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: SEARCH_PROFILE_JSON_SCHEMA,
      },
    }),
  });

  if (!response.ok) throw new Error(`OpenAI ${response.status}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  return JSON.parse(content);
}

export { SEARCH_PROFILE_JSON_SCHEMA };
