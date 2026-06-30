/**
 * OpenAI Klassifikation – nur serverseitig (process.env.OPENAI_API_KEY).
 */
import { CLASSIFICATION_JSON_SCHEMA, normalizeClassification } from './customerQueryTypes.js';
import { listAdviceTopicsForOpenAi } from './adviceTopicsRegistry.js';

const OPENAI_MODEL = process.env.OPENAI_QUERY_MODEL || 'gpt-4o-mini';

function getApiKey() {
  return process.env.OPENAI_API_KEY ?? null;
}

/**
 * @param {string} query
 * @param {object} [context]
 */
export async function classifyWithOpenAi(query = '', context = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return null;
  }

  const adviceTopics = listAdviceTopicsForOpenAi();

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: [
            'Du klassifizierst Kundenanfragen eines Kia-Autohauses.',
            'Antworte NUR als JSON.',
            'queryType:',
            '- vehicle_wish: Fahrzeug suchen (Budget, Typ, Ausstattung als Filter)',
            '- model_equipment_question: konkretes Modell + Technik/Ausstattung',
            '- competitor_comparison: Fremdmarken-Vergleich (Zeekr vs BYD, Mercedes GLE vs EV9)',
            '- general_car_comparison: allgemeiner Antriebsvergleich (Diesel vs Elektro, Hybrid vs PHEV)',
            '- general_car_question: allgemeine Auto-Frage ohne Kia-Spezialdaten',
            '- purchase_intent: Kunde will Kontakt, Angebot oder Probefahrt',
            'Bei Fremdmarken: general_knowledge erlaubt – keine Händlerpreise erfinden.',
            'Bei advice_question: adviceTopicId aus der Topic-Liste setzen (z. B. ev_towing_range, heat_pump).',
            'adviceTopicId null wenn kein Topic passt → topic: unmatched_advice',
            'Beratungsfragen NICHT als vehicle_wish klassifizieren.',
            'ranking_question: Best-of/Ranking (größter Kofferraum, zieht am meisten, am weitesten)',
            '- comparison_question: zwei Modelle vergleichen (EV4 oder EV5 größer)',
            '- special_check_question: Zubehör, Nachrüstung, Montage – Autohaus muss prüfen',
            '- unknown: nicht eindeutig',
            'rankingMetric wenn ranking: trunk_volume, wltp_range, towing, length',
            'comparisonModels: Array mit zwei modelKeys bei Vergleich',
            'featureId wenn erkennbar: heat_pump, heated_seats, camera_360, towbar, awd',
            'modelKey wenn erkennbar: ev3, ev4, ev5, ev6, ev9, sportage, sorento, ...',
            'shouldShowModels: false bei advice_question (keine Modellkarten als Hauptantwort)',
            'shouldAskForContact: true bei special_check_question oder advice mit needsDealerCheck',
            `Beratungsthemen: ${JSON.stringify(adviceTopics)}`,
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            query,
            context: {
              page: context.page ?? null,
              modelKey: context.modelKey ?? null,
              activeChipIds: context.activeChipIds ?? [],
            },
          }),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: CLASSIFICATION_JSON_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI classification ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  const parsed = JSON.parse(content);
  return normalizeClassification({ ...parsed, source: 'openai' });
}

export function isOpenAiConfigured() {
  return Boolean(getApiKey());
}
