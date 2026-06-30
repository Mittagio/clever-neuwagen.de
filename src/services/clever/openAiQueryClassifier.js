/**
 * OpenAI Klassifikation – nur serverseitig (process.env.OPENAI_API_KEY).
 */
import { CLASSIFICATION_JSON_SCHEMA, normalizeClassification } from './customerQueryTypes.js';

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
            '- advice_question: allgemeine Beratung (Warum Wärmepumpe, Allrad, Leasing vs Finanzierung)',
            '- special_check_question: Zubehör, Nachrüstung, Montage – Autohaus muss prüfen',
            'featureId wenn erkennbar: heat_pump, heated_seats, camera_360, towbar, awd',
            'modelKey wenn erkennbar: ev3, ev4, ev5, ev6, ev9, sportage, sorento, ...',
            'shouldShowModels: true nur bei vehicle_wish oder klarer Modellfrage mit Weiterführung',
            'shouldAskForContact: true bei special_check_question oder sehr unsicher',
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
