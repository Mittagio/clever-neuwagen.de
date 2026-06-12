/**
 * Clever-Antwort: Kia Elektro-Modellübersicht (Typ A – Wissensfrage).
 */
import { KIA_ELECTRIC_LINEUP } from '../../data/kia/kiaElectricLineup.js';
import { withNarrativeDefaults } from './smartAnswerNarrative.js';

/**
 * @param {string} query
 */
export function buildElectricLineupAnswer(query) {
  const narrative = KIA_ELECTRIC_LINEUP.map(
    (item) => `⚡ ${item.shortName} – ${item.tagline}`,
  );

  const modelCards = KIA_ELECTRIC_LINEUP.map((item) => ({
    modelKey: item.modelKey,
    name: item.shortName,
    bullets: [item.tagline],
  }));

  const interestOptions = [
    ...KIA_ELECTRIC_LINEUP.map((item) => ({
      modelKey: item.modelKey,
      label: item.shortName,
      cta: item.shortName,
      hasConfigurator: false,
    })),
    {
      modelKey: 'unsure',
      label: 'Unsicher',
      cta: 'Ich bin unsicher',
      hasConfigurator: false,
    },
  ];

  return withNarrativeDefaults({
    intent: 'vehicle_fact_question',
    mode: 'info',
    query,
    routingLayer: 'structured_fact',
    journeyKind: 'lineup',
    title: 'Welche E-Autos bietet Kia an?',
    lead: 'Kia bietet aktuell folgende Elektrofahrzeuge an:',
    narrative,
    modelCards,
    interestOptions,
    fitPrompt: 'Welches Fahrzeug interessiert Sie am meisten?',
    facts: [],
    highlights: [],
    matchCount: KIA_ELECTRIC_LINEUP.length,
    canShowOffers: false,
    showFitCheck: false,
    showViewModelCta: false,
    showOffersCta: false,
  });
}
