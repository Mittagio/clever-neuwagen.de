/**
 * OpenAI als zentrale Allgemeinwissen-Schicht – mit Kia-Brücke und Daten-Grenzen.
 */
import { DEALER_DISCLAIMER } from './customerQueryTypes.js';

const OPENAI_MODEL = process.env.OPENAI_QUERY_MODEL || 'gpt-4o-mini';

function getApiKey() {
  return process.env.OPENAI_API_KEY ?? null;
}

const ANSWER_SCHEMA = {
  name: 'general_car_knowledge_answer',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      lead: { type: 'string' },
      bullets: {
        type: 'array',
        items: { type: 'string' },
      },
      kiaBridge: { type: 'string' },
      dealerHint: { type: 'string' },
      competitorMentions: {
        type: 'array',
        items: { type: 'string' },
      },
      kiaModelKeys: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['title', 'lead', 'bullets', 'kiaBridge', 'dealerHint', 'competitorMentions', 'kiaModelKeys'],
  },
};

/**
 * @param {object} params
 */
export async function answerWithOpenAiGeneralKnowledge({
  query = '',
  classification = {},
  sessionContext = {},
  routing = {},
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
      temperature: 0.45,
      messages: [
        {
          role: 'system',
          content: [
            'Du bist Clever, der KI-Berater eines Kia-Autohauses in Deutschland.',
            'Antworte auf Deutsch, sachlich und hilfreich – ähnlich wie ein guter Auto-Chatbot.',
            'Gib eine echte Einschätzung. Sage NIEMALS „Das weiß ich nicht“ oder „Keine Antwort gefunden“.',
            'VERBOTEN zu erfinden oder als sicher zu nennen:',
            '- konkrete Händlerpreise oder Leasingraten',
            '- Verfügbarkeit oder Lieferzeiten',
            '- verbindliche Ausstattungspakete',
            '- exakte WLTP-Werte ohne Kennzeichnung als Richtwert',
            'Bei solchen Punkten: „Das prüft Ihr Autohaus final.“',
            'Nach der allgemeinen Einschätzung IMMER eine Kia-Brücke (kiaBridge):',
            'Welche Kia-Modelle (EV3, EV4, EV5, EV6, EV9, Sportage, Sorento …) passen als Alternative.',
            'Fremdmarken-Vergleiche sind erlaubt (Zeekr, BYD, Mercedes, …).',
            'Max. 3 bullets mit klaren Punkten.',
            'lead: 2–4 Sätze Hauptantwort.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            query,
            queryType: classification.queryType,
            topic: classification.topic,
            adviceTopicId: classification.adviceTopicId,
            routingReason: routing.reason,
            session: {
              modelsInFocus: sessionContext.modelsInFocus ?? [],
              comparedModels: sessionContext.comparedModels ?? [],
            },
          }),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: ANSWER_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI general knowledge ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  const parsed = JSON.parse(content);
  return {
    kind: 'general_knowledge',
    subkind: 'openai',
    headline: parsed.title,
    shortAnswer: parsed.lead,
    usefulWhen: parsed.bullets ?? [],
    kiaBridge: parsed.kiaBridge,
    dealerHint: parsed.dealerHint,
    competitorMentions: parsed.competitorMentions ?? [],
    kiaAlternatives: parsed.kiaModelKeys ?? [],
    primaryModelKey: parsed.kiaModelKeys?.[0] ?? null,
    sources: ['openai_general_knowledge'],
    disclaimer: DEALER_DISCLAIMER,
  };
}

export function isOpenAiGeneralKnowledgeAvailable() {
  return Boolean(getApiKey());
}
