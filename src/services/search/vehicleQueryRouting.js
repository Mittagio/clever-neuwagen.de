/**
 * Hybrid-Routing: welche Schicht beantwortet welche Anfrage.
 *
 * structured_fact  – Fragenkatalog + Clever-Stammdaten (kein LLM)
 * structured_estimate – berechenbare Schätzung aus Maßen (kein LLM)
 * advisory         – Beratungsthemen (regelbasiert, später LLM-Formulierung)
 * lexicon          – Ranking / Filter über Modell-Lexikon
 * data_gap         – ehrlicher Fallback + Admin
 * vehicle_search   – normale Fahrzeugsuche
 */

/** @typedef {'structured_fact'|'structured_estimate'|'advisory'|'lexicon'|'data_gap'|'vehicle_search'} QueryRoutingLayer */

/** @type {Record<QueryRoutingLayer, { label: string, description: string }>} */
export const QUERY_ROUTING_LAYERS = {
  structured_fact: {
    label: 'Stammdaten',
    description: 'Fragenkatalog → Clever Record → feste Antwort',
  },
  structured_estimate: {
    label: 'Schätzung',
    description: 'Berechnung aus Kofferraum/Maßen, transparent als Annäherung',
  },
  advisory: {
    label: 'Beratung',
    description: 'Regelbasierte Kaufberatung (Leasing, Förderung, Vergleich)',
  },
  lexicon: {
    label: 'Lexikon',
    description: 'Ranking und Filter über alle Modelle',
  },
  data_gap: {
    label: 'Datenlücke',
    description: 'Keine Daten → Benachrichtigen → Admin pflegt Stammdaten',
  },
  vehicle_search: {
    label: 'Suche',
    description: 'CleverQuote-Fahrzeugsuche',
  },
};

/**
 * @param {object} analysis – Ergebnis von analyzeVehicleQuery
 * @param {object} [answer] – gebaute Antwort (optional)
 * @returns {QueryRoutingLayer}
 */
export function resolveQueryRoutingLayer(analysis, answer = null) {
  if (!analysis) return 'vehicle_search';

  if (analysis.intent === 'vehicle_search') return 'vehicle_search';
  if (analysis.estimate) return 'structured_estimate';
  if (analysis.lineup === 'electric') return 'structured_fact';

  if (analysis.intent === 'vehicle_compare_question') return 'advisory';

  if (analysis.intent === 'vehicle_fact_question') {
    if (answer?.dataGap) return 'data_gap';
    if (analysis.fact?.field) return 'structured_fact';
    if (analysis.advisory) return 'advisory';
    if (analysis.lexiconRanking) return 'lexicon';
    return 'data_gap';
  }

  return 'vehicle_search';
}
