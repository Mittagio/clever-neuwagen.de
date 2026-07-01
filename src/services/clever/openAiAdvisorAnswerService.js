/**
 * OpenAI als zentrale Verstehens- und Antwortschicht – strukturiertes Output-Schema.
 */
import { DATA_CONFIDENCE, DEALER_DISCLAIMER } from './customerQueryTypes.js';

const OPENAI_MODEL = process.env.OPENAI_QUERY_MODEL || 'gpt-4o-mini';

function getApiKey() {
  return process.env.OPENAI_API_KEY ?? null;
}

export const ADVISOR_ANSWER_SCHEMA = {
  name: 'clever_advisor_answer',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      queryType: { type: 'string' },
      answerType: { type: 'string' },
      headline: { type: 'string' },
      shortAnswer: { type: 'string' },
      sections: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            body: { type: 'string' },
          },
          required: ['title', 'body'],
        },
      },
      modelKeys: {
        type: 'array',
        items: { type: 'string' },
      },
      competitorModels: {
        type: 'array',
        items: { type: 'string' },
      },
      topics: {
        type: 'array',
        items: { type: 'string' },
      },
      dataConfidence: {
        type: 'string',
        enum: Object.values(DATA_CONFIDENCE),
      },
      needsDealerCheck: { type: 'boolean' },
      shouldOfferKiaBridge: { type: 'boolean' },
      kiaBridge: { type: 'string' },
      dealerHint: { type: 'string' },
      followUpSuggestions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            label: { type: 'string' },
            query: { type: 'string' },
          },
          required: ['label', 'query'],
        },
      },
      extractedSignals: {
        type: 'array',
        items: { type: 'string' },
      },
      ctaPrimary: { type: 'string' },
      ctaSecondary: { type: 'string' },
    },
    required: [
      'queryType',
      'answerType',
      'headline',
      'shortAnswer',
      'sections',
      'modelKeys',
      'competitorModels',
      'topics',
      'dataConfidence',
      'needsDealerCheck',
      'shouldOfferKiaBridge',
      'kiaBridge',
      'dealerHint',
      'followUpSuggestions',
      'extractedSignals',
      'ctaPrimary',
      'ctaSecondary',
    ],
  },
};

/**
 * @param {object} params
 */
export async function answerWithOpenAiAdvisor({
  query = '',
  classification = {},
  sessionContext = {},
  routing = {},
  cleverFacts = null,
  dataGap = null,
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
      temperature: 0.42,
      messages: [
        {
          role: 'system',
          content: [
            'Du bist Clever, der KI-Berater eines Kia-Autohauses in Deutschland.',
            'Antworte auf Deutsch, hilfreich und wie ein guter Auto-Chatbot – der Kunde soll nicht denken, Clever weiß weniger als ChatGPT.',
            'VERBOTEN: „Das weiß ich nicht“, „Keine Antwort gefunden“, „Bitte nur Verkäufer fragen“ als alleinige Antwort.',
            'Stattdessen: allgemeine Orientierung geben, Unsicherheit transparent („Nach allgemeinem Datenstand …“), Kia-/Autohaus-Bezug, nächste Schritte.',
            'VERBOTEN zu erfinden: Händlerpreise, Leasingraten, Verfügbarkeit, verbindliche Ausstattungspakete.',
            'Bei Preis/Leasing/Verfügbarkeit: dataConfidence=needs_dealer_check, keine Zahlen schätzen.',
            'Fremdmarken (Zeekr, BYD, Mercedes …): nur kurz allgemein einordnen – KEIN ausführlicher Fremdmarken-Flow.',
            'Fremdmarken: keine Follow-ups wie „Mehr Infos zum Mercedes“ oder Fremdmarken-Angebote.',
            'Stattdessen: Brücke zu allowedBrands des Autohauses (dealerBrandScope in session).',
            'Eigene Händlermarken dürfen ausführlich beraten werden.',
            'Formulierung freundlich: nicht „führen wir nicht“, sondern „keine verbindliche Auskunft – Alternativen aus unserer Markenwelt“.',
            'followUpSuggestions: max. 4, konkret und klickbar formuliert.',
            'extractedSignals: kurze Tags für CRM (z.B. „Reichweite wichtig“, „Fremdmarkenvergleich“).',
            'sections: optional 0–3 Abschnitte mit title/body.',
            'shortAnswer: 2–5 Sätze Hauptantwort.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            query,
            classification,
            routingReason: routing.reason,
            dataGap,
            cleverFacts,
            session: {
              modelsInFocus: sessionContext.modelsInFocus ?? [],
              comparedModels: sessionContext.comparedModels ?? [],
              previousQueries: sessionContext.previousQueries ?? [],
              brandScope: sessionContext.brandScope ?? null,
              brandAnalysis: sessionContext.brandAnalysis ?? null,
            },
          }),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: ADVISOR_ANSWER_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI advisor answer ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  const parsed = JSON.parse(content);
  const sectionText = (parsed.sections ?? [])
    .map((s) => `${s.title}: ${s.body}`)
    .join(' ');

  return {
    kind: 'general_knowledge',
    subkind: 'openai_advisor',
    structured: parsed,
    headline: parsed.headline,
    shortAnswer: parsed.shortAnswer,
    usefulWhen: (parsed.sections ?? []).map((s) => s.body).slice(0, 3),
    narrative: sectionText ? [sectionText] : [],
    kiaBridge: parsed.kiaBridge,
    dealerHint: parsed.dealerHint,
    competitorMentions: parsed.competitorModels ?? [],
    kiaAlternatives: parsed.modelKeys ?? [],
    primaryModelKey: parsed.modelKeys?.[0] ?? classification.modelKey ?? null,
    followUpSuggestions: (parsed.followUpSuggestions ?? []).map((item) => ({
      label: item.label,
      query: item.query,
      type: parsed.queryType ?? classification.queryType,
      target: null,
    })),
    extractedSignals: parsed.extractedSignals ?? [],
    dataConfidence: parsed.dataConfidence ?? DATA_CONFIDENCE.GENERAL,
    needsDealerCheck: Boolean(parsed.needsDealerCheck),
    ctaPrimary: parsed.ctaPrimary,
    ctaSecondary: parsed.ctaSecondary,
    topics: parsed.topics ?? [],
    sources: ['openai_advisor_layer'],
    disclaimer: DEALER_DISCLAIMER,
  };
}

export function isOpenAiAdvisorAvailable() {
  return Boolean(getApiKey());
}
