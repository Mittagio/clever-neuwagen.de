/**
 * Clever-Antwort: Feature-Übersicht über mehrere Modelle (Typ A – Wissensfrage).
 */
import { buildKiaTowbarLineup } from '../../data/kia/kiaFeatureLineup.js';
import { withNarrativeDefaults } from './smartAnswerNarrative.js';

/** @typedef {import('../search/featureLineupQuestion.js').FeatureLineupId} FeatureLineupId */

/**
 * @param {FeatureLineupId} featureId
 * @param {string} query
 */
export function buildFeatureLineupAnswer(featureId, query) {
  if (featureId === 'towbar') {
    return buildTowbarLineupAnswer(query);
  }

  return null;
}

/**
 * @param {string} query
 */
function buildTowbarLineupAnswer(query) {
  const lineup = buildKiaTowbarLineup();
  const narrative = lineup.map((item) => `🚙 ${item.shortName} – ${item.tagline}`);

  const modelCards = lineup.map((item) => ({
    modelKey: item.modelKey,
    name: item.shortName,
    bullets: [item.tagline, 'AHK als Zubehör oder Ausstattung'],
  }));

  const chipModels = lineup.filter((item) => [
    'ev9', 'ev6', 'ev5', 'ev4', 'ev3', 'sportage', 'sorento',
  ].includes(item.modelKey));

  const interestOptions = [
    ...chipModels.map((item) => ({
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

  const monitorsHitch = /monit|überwach|ueberwach/i.test(query);
  const leadExtra = monitorsHitch
    ? ' Beim Rangieren unterstützen viele Modelle mit Rückfahrkamera oder Assistenzpaket – die Kupplung selbst wird nicht dauerhaft „überwacht“, aber das Einhängen lässt sich so leichter kontrollieren.'
    : '';

  return withNarrativeDefaults({
    intent: 'vehicle_fact_question',
    mode: 'info',
    query,
    routingLayer: 'structured_fact',
    journeyKind: 'lineup',
    title: 'Bei welchem Kia gibt es eine Anhängerkupplung?',
    lead:
      `Eine Anhängerkupplung ist bei Kia als Zubehör oder Ausstattung verfügbar – je nach Modell mit unterschiedlicher Anhängelast:${leadExtra}`,
    narrative,
    modelCards,
    interestOptions,
    fitPrompt: 'Welches Modell interessiert Sie für den Anhängerbetrieb?',
    tip: 'Nicht jedes Modell hat serienmäßig AHK – wir prüfen Montage und Verfügbarkeit im Bestand.',
    facts: [],
    highlights: [],
    matchCount: lineup.length,
    canShowOffers: false,
    showFitCheck: false,
    showViewModelCta: false,
    showOffersCta: false,
  });
}
