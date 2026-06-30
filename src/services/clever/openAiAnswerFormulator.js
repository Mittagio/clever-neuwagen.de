/**
 * OpenAI Formulierung – nur aus übergebenen Fakten, serverseitig.
 */
import { DEALER_DISCLAIMER } from './customerQueryTypes.js';

const OPENAI_MODEL = process.env.OPENAI_QUERY_MODEL || 'gpt-4o-mini';

function getApiKey() {
  return process.env.OPENAI_API_KEY ?? null;
}

/**
 * @param {object} params
 */
export async function formulateWithOpenAi({
  query = '',
  classification = {},
  facts = {},
} = {}) {
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
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: [
            'Du formulierst eine ruhige, sachliche Antwort für Autokunden auf Deutsch.',
            'Nutze AUSSCHLIESSLICH die Fakten aus facts – erfinde keine Preise, Raten, Serienausstattung oder Verfügbarkeit.',
            'Maximal 4 kurze Sätze.',
            `Schließe immer mit diesem Hinweis ab: "${DEALER_DISCLAIMER}"`,
            'Antworte als JSON: { "title": string, "body": string }',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            query,
            queryType: classification.queryType,
            topic: classification.topic,
            facts,
          }),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'customer_query_answer',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              body: { type: 'string' },
            },
            required: ['title', 'body'],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI formulation ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  const parsed = JSON.parse(content);
  return {
    title: parsed.title,
    body: parsed.body,
    disclaimer: DEALER_DISCLAIMER,
    source: 'openai',
  };
}
