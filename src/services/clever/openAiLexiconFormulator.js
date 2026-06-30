/**
 * OpenAI Formulierung für Verkäufer-Lexikon – nur aus Lexikon-Fakten, serverseitig.
 */
const OPENAI_MODEL = process.env.OPENAI_QUERY_MODEL || 'gpt-4o-mini';

function getApiKey() {
  return process.env.OPENAI_API_KEY ?? null;
}

/**
 * @param {object} params
 */
export async function formulateLexiconWithOpenAi({
  query = '',
  result = {},
} = {}) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const facts = {
    title: result.title ?? result.modelTitle ?? null,
    fieldLabel: result.fieldLabel ?? null,
    shortAnswer: result.shortAnswer ?? null,
    primaryFacts: result.primaryFacts ?? [],
    availabilityByTrim: result.availabilityByTrim ?? [],
    relatedFacts: result.relatedFacts ?? [],
    source: result.source ?? null,
    confidence: result.confidence ?? null,
    modelKey: result.modelKey ?? null,
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: [
            'Du formulierst eine kurze Verkäufer-Zusammenfassung auf Deutsch für das Clever-Lexikon.',
            'Ton: sachlich, präzise, intern für Verkäufer – keine Kundenansprache, kein Marketing.',
            'Nutze AUSSCHLIESSLICH die Fakten aus facts – erfinde keine Verfügbarkeit, Pakete oder technischen Werte.',
            'Maximal 2–3 Sätze. Nenne Modell und Kernbefund klar.',
            'Antworte als JSON: { "summary": string }',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({ query, facts }),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'lexicon_seller_summary',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              summary: { type: 'string' },
            },
            required: ['summary'],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI lexicon formulation ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  const parsed = JSON.parse(content);
  const summary = String(parsed.summary ?? '').trim();
  if (!summary) return null;

  return { summary, source: 'openai' };
}
