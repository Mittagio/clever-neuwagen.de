/**
 * OpenAI Query-Normalisierung für Verkäufer-Lexikon – nur serverseitig.
 */
import { LEXICON_MODEL_ENTRIES } from '../lexicon/cleverLexiconSearchService.js';

const OPENAI_MODEL = process.env.OPENAI_QUERY_MODEL || 'gpt-4o-mini';

const MODEL_KEYS = LEXICON_MODEL_ENTRIES.map((m) => m.modelKey).join(', ');

function getApiKey() {
  return process.env.OPENAI_API_KEY ?? null;
}

/**
 * @param {string} query
 */
export async function normalizeLexiconQueryWithOpenAi(query = '') {
  const apiKey = getApiKey();
  if (!apiKey) return null;

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
            'Du normalisierst Verkäufer-Fragen für ein Kia-Fahrzeug-Lexikon.',
            'Ziel: eine kurze Suchanfrage im Format „Modell Thema“, z. B. „EV4 Wärmepumpe“ oder „Sportage Anhängelast“.',
            `Bekannte modelKeys: ${MODEL_KEYS}`,
            'intentType: technical (Batterie, Reichweite, Maße), equipment (Ausstattung), package (Paketname), unknown',
            'featureHint wenn erkennbar: heat_pump, hud, towbar, v2l, drivewise, battery, range, …',
            'Antworte NUR als JSON.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({ query }),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'lexicon_query_normalization',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              normalizedQuery: { type: 'string' },
              modelKey: { type: ['string', 'null'] },
              featureHint: { type: ['string', 'null'] },
              intentType: {
                type: 'string',
                enum: ['technical', 'equipment', 'package', 'unknown'],
              },
              confidence: { type: 'number' },
            },
            required: ['normalizedQuery', 'modelKey', 'featureHint', 'intentType', 'confidence'],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI lexicon normalization ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  const parsed = JSON.parse(content);
  return {
    normalizedQuery: String(parsed.normalizedQuery ?? '').trim() || query.trim(),
    modelKey: parsed.modelKey ?? null,
    featureHint: parsed.featureHint ?? null,
    intentType: parsed.intentType ?? 'unknown',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    source: 'openai',
  };
}
