/**
 * Follow-up-Vorschläge nach jeder Clever-Antwort.
 */
import { QUERY_TYPES, RANKING_METRICS } from './customerQueryTypes.js';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { getAdviceTopicById } from './adviceTopicsRegistry.js';
import { filterFollowUpsForBrandScope } from './dealerBrandScope.js';
import { buildMixedIntentFollowUps } from './mixedIntentAnswerBuilder.js';

function modelLabel(modelKey) {
  return KIA_MODEL_ATTRIBUTES[modelKey]?.label ?? modelKey?.toUpperCase();
}

function contactSuggestion(label = 'Verkäufer dazu fragen') {
  return {
    label,
    query: 'Ich möchte dazu vom Autohaus beraten werden',
    type: 'purchase_intent',
    target: 'contact',
  };
}

function querySuggestion(label, query, type, target = null) {
  return { label, query, type, target };
}

/**
 * @param {object} params
 */
export function buildFollowUpSuggestions({
  classification = {},
  facts = {},
  smartAnswer = null,
  sessionContext = {},
  brandScope = null,
  brandAnalysis = null,
} = {}) {
  const suggestions = [];
  const push = (item) => {
    if (suggestions.length < 4 && !suggestions.some((s) => s.label === item.label)) {
      suggestions.push(item);
    }
  };

  if (facts.kind === 'mixed_intent' || classification.queryType === QUERY_TYPES.MIXED_INTENT) {
    for (const item of buildMixedIntentFollowUps(classification)) push(item);
    return suggestions;
  }

  if (facts.kind === 'advisor_profile' || classification.topic === 'advisor_profile_assessment') {
    push(querySuggestion('EV5 oder EV9 für Familie mit Hund?', 'EV5 oder EV9 für Familie mit Hund vergleichen', 'comparison_question', 'ev5'));
    push(querySuggestion('Wie weit komme ich elektrisch mit Wohnwagen?', 'Wie weit komme ich mit einem Elektroauto und Wohnwagen?', 'advice_question', 'ev_towing_range'));
    push(querySuggestion('Welche Kia Elektroautos dürfen Anhänger ziehen?', 'Welcher Kia zieht am meisten?', 'ranking_question', 'towing'));
    push(querySuggestion('Verkäufer soll meinen Wohnwagen prüfen', 'Verkäufer soll mich beraten', 'purchase_intent', 'contact'));
    return suggestions;
  }

  if (facts.kind === 'model_technical') {
    const label = modelLabel(facts.modelKey);
    if (facts.topic === 'vertical_load' || facts.topic === 'towing') {
      push(querySuggestion(`${label} Anhängerbetrieb erklären`, `${label} Anhängelast und Reichweite`, 'model_equipment_question', facts.modelKey));
      push(querySuggestion('Reicht das für Fahrradträger?', 'Reicht die Stützlast für Fahrradträger?', 'advice_question', 'trailer_load'));
      push(querySuggestion('Welche Kia ziehen am meisten?', 'Welcher Kia zieht am meisten?', 'ranking_question', 'towing'));
      push(contactSuggestion('Verkäufer dazu fragen'));
      return suggestions;
    }
    if (facts.topic === 'seating') {
      push(querySuggestion('6- oder 7-Sitzer erklären', `${label} 6 oder 7 Sitzer`, 'model_equipment_question', facts.modelKey));
      push(querySuggestion(`${label} als Familienauto prüfen`, `${label} als Familienauto`, 'advice_question', 'family_luggage'));
      push(querySuggestion('Kofferraum mit 7 Sitzen', `${label} Kofferraum`, 'model_equipment_question', facts.modelKey));
      push(contactSuggestion('Verkäufer dazu fragen'));
      return suggestions;
    }
    if (facts.topic === 'isofix') {
      push(querySuggestion(`${label} als Familienauto prüfen`, `${label} als Familienauto`, 'advice_question', 'family_luggage'));
      push(querySuggestion('Kofferraum mit Kindersitzen', `${label} Kofferraum`, 'model_equipment_question', facts.modelKey));
      push(querySuggestion(`AHK beim ${label.replace('Kia ', '')} prüfen`, `${label} Anhängelast`, 'model_equipment_question', facts.modelKey));
      push(contactSuggestion('Verkäufer dazu fragen'));
      return suggestions;
    }
    if (facts.topic === 'charging_speed') {
      push(querySuggestion('Laden 10–80 % erklären', 'Wie lange dauert Schnellladen 10 bis 80 Prozent?', 'advice_question', 'charging_speed'));
      push(querySuggestion(`${label} mit EV9 Ladeleistung vergleichen`, 'EV6 oder EV9 Ladegeschwindigkeit vergleichen', 'comparison_question', `${facts.modelKey},ev9`));
      push(querySuggestion('Welche Kia laden am schnellsten?', 'Welcher Kia lädt am schnellsten?', 'ranking_question', 'charging'));
      push(contactSuggestion('Verkäufer dazu fragen'));
      return suggestions;
    }
  }

  const focus = sessionContext.modelsInFocus?.[sessionContext.modelsInFocus.length - 1]
    ?? classification.modelKey
    ?? facts.modelKey
    ?? smartAnswer?.primaryModelKey
    ?? null;

  if (facts.kind === 'general_knowledge') {
    if (facts.subkind === 'zeekr_vs_byd') {
      push(querySuggestion('Mit Kia EV4 vergleichen', 'EV4 Reichweite und Ausstattung', 'comparison_question', 'ev4'));
      push(querySuggestion('Reichweite im Alltag schätzen', 'Wie schätze ich E-Reichweite im Alltag ein?', 'general_car_question'));
      push(querySuggestion('Plug-in-Hybrid vs Elektro erklären', 'Was ist besser Plug-in-Hybrid oder Elektro?', 'general_car_comparison'));
      push(contactSuggestion('Verkäufer dazu fragen'));
      return suggestions;
    }
    if (facts.subkind === 'gle_vs_ev9' || facts.primaryModelKey === 'ev9') {
      push(querySuggestion('EV9 Angebot anfragen', 'Ich möchte ein EV9 Angebot anfragen', 'purchase_intent', 'offer'));
      push(querySuggestion('Anhängerbetrieb vergleichen', 'EV9 Anhängelast und Reichweite', 'model_detail_question', 'ev9'));
      push(querySuggestion('Kosten Diesel vs Elektro vergleichen', 'Diesel oder Elektro Kosten vergleichen', 'general_car_comparison'));
      push(querySuggestion('Fahrprofil eingeben', 'Ich möchte mein Fahrprofil angeben', 'purchase_intent', 'profile'));
      return suggestions.slice(0, 4);
    }
    if (facts.subkind === 'diesel_vs_ev') {
      push(querySuggestion('Fahrprofil eingeben', 'Ich möchte mein Fahrprofil angeben', 'purchase_intent', 'profile'));
      push(querySuggestion('Kia EV6 als Alternative', 'Mehr Infos zum Kia EV6', 'model_detail_question', 'ev6'));
      push(querySuggestion('Sorento Diesel Alternative', 'Mehr Infos zum Sorento', 'model_detail_question', 'sorento'));
      push(contactSuggestion('Autohaus soll mich beraten'));
      return suggestions;
    }
    if (facts.subkind === 'towing_range') {
      push(querySuggestion('Anhängergewicht eingeben', 'Wie wirkt Anhängergewicht auf Reichweite?', 'advice_question', 'ev_towing_range'));
      push(querySuggestion('Kia mit Anhängelast anzeigen', 'Elektroauto mit Anhängelast', 'vehicle_search', 'towbar'));
      push(querySuggestion('EV9 Anhängerbetrieb erklären', 'EV9 Anhängelast und Reichweite', 'model_detail_question', 'ev9'));
      push(contactSuggestion('Verkäufer dazu fragen'));
      return suggestions;
    }
    if (facts.subkind === 'zeekr_charging') {
      push(querySuggestion('Mit Kia EV6 vergleichen', 'Kia EV6 Ladegeschwindigkeit', 'model_detail_question', 'ev6'));
      push(querySuggestion('Mit Kia EV9 vergleichen', 'Kia EV9 Ladegeschwindigkeit', 'model_detail_question', 'ev9'));
      push(querySuggestion('Ladegeschwindigkeit erklären', 'Was bedeutet DC-Schnellladen?', 'general_car_question'));
      push(contactSuggestion('Verkäufer dazu fragen'));
      return suggestions;
    }
    if (facts.subkind === 'ev4_power_outlets' || facts.subkind === 'model_equipment_gap') {
      push(querySuggestion('EV4 Ausstattung prüfen', 'EV4 Ausstattung je Linie', 'model_equipment_question', 'ev4'));
      push(querySuggestion('V2L erklären', 'Was ist V2L beim Elektroauto?', 'general_car_question'));
      push(querySuggestion('EV4 Angebot anfragen', 'Ich möchte ein EV4 Angebot anfragen', 'purchase_intent', 'offer'));
      push(contactSuggestion('Verkäufer dazu fragen'));
      return suggestions;
    }
    for (const alt of facts.kiaAlternatives ?? []) {
      push(querySuggestion(`Kia ${modelLabel(alt)} Alternative`, `Mehr Infos zum Kia ${modelLabel(alt)}`, 'model_detail_question', alt));
    }
    push(contactSuggestion('Verkäufer dazu fragen'));
    return suggestions.slice(0, 4);
  }

  if (facts.kind === 'dealer_data_required') {
    push(querySuggestion('Angebot anfragen', 'Ich möchte ein Angebot anfragen', 'purchase_intent', 'offer'));
    push(contactSuggestion('Anfrage ans Autohaus senden'));
    return suggestions;
  }

  if (classification.queryType === QUERY_TYPES.COMPETITOR_COMPARISON) {
    push(querySuggestion('Kia Alternative anzeigen', 'Welche Kia E-Autos haben viel Reichweite?', 'general_car_question'));
    push(querySuggestion('Mit Kia EV4 vergleichen', 'Mehr Infos zum Kia EV4', 'model_detail_question', 'ev4'));
    push(querySuggestion('Reichweite im Alltag schätzen', 'Wie schätze ich Reichweite im Alltag ein?', 'general_car_question'));
    push(contactSuggestion('Verkäufer dazu fragen'));
    return suggestions;
  }

  if (classification.queryType === QUERY_TYPES.GENERAL_CAR_COMPARISON
    || classification.queryType === QUERY_TYPES.GENERAL_CAR_QUESTION) {
    push(querySuggestion('Fahrprofil eingeben', 'Ich möchte mein Fahrprofil angeben', 'purchase_intent', 'profile'));
    push(querySuggestion('Kia Alternative anzeigen', 'Elektroauto Kia Übersicht', 'general_car_question'));
    push(contactSuggestion('Autohaus soll mich beraten'));
    return suggestions.slice(0, 4);
  }

  if (facts.kind === 'clarification_largest_ev') {
    push(querySuggestion('Nach Außenmaßen sortieren', 'welches elektroauto ist das größte', 'ranking_question', RANKING_METRICS.LENGTH));
    push(querySuggestion('Nach Kofferraum sortieren', 'welcher kia den größten kofferraum?', 'ranking_question', RANKING_METRICS.TRUNK_VOLUME));
    push(querySuggestion('7-Sitzer anzeigen', 'welches elektroauto hat 7 sitze', 'ranking_question', 'seats'));
    push(querySuggestion('Mehr Infos zum EV9', 'Mehr Infos zum Kia EV9', 'model_detail_question', 'ev9'));
    return suggestions;
  }

  if (facts.kind === 'model_detail' && facts.modelKey) {
    const label = modelLabel(facts.modelKey);
    push(querySuggestion(`Beste ${label}-Variante für Familie`, `Beste ${label}-Variante für Familie`, 'advice_question', facts.modelKey));
    if (facts.modelKey === 'ev9') {
      push(querySuggestion('RWD oder AWD erklären', 'EV9 RWD oder AWD – was ist besser?', 'advice_question', 'ev9'));
      push(querySuggestion('EV9 mit Sorento vergleichen', 'EV9 mit Sorento Diesel vergleichen', 'comparison_question', 'ev9,sorento'));
    }
    push(querySuggestion(`${label} Angebot anfragen`, 'Ich möchte ein Angebot anfragen', 'purchase_intent', 'offer'));
    push(contactSuggestion('Verkäufer dazu fragen'));
    return suggestions.slice(0, 4);
  }

  if (facts.kind === 'family_variant_advice' && facts.modelKey) {
    const label = modelLabel(facts.modelKey);
    push(querySuggestion('6- oder 7-Sitzer entscheiden', `${label} 6 oder 7 Sitzer`, 'advice_question', facts.modelKey));
    push(querySuggestion('RWD oder AWD erklären', `${label} RWD oder AWD`, 'advice_question', facts.modelKey));
    if (facts.modelKey === 'ev9') {
      push(querySuggestion('EV9 mit Sorento vergleichen', 'EV9 mit Sorento Diesel vergleichen', 'comparison_question', 'ev9,sorento'));
    }
    push(contactSuggestion('Verkäufer dazu fragen'));
    return suggestions.slice(0, 4);
  }

  if (classification.queryType === QUERY_TYPES.ADVICE_QUESTION) {
    const topic = getAdviceTopicById(classification.adviceTopicId ?? facts.adviceTopicId);
    if (classification.adviceTopicId === 'ev_towing_range' || facts.adviceTopicId === 'ev_towing_range') {
      push(querySuggestion('Anhängergewicht eingeben', 'Wie wirkt sich Anhängergewicht auf die Reichweite aus?', 'advice_question', 'ev_towing_range'));
      push(querySuggestion('Passende Kia mit Anhängelast anzeigen', 'Elektroauto mit Anhängelast', 'vehicle_search', 'towbar'));
      push(querySuggestion('EV9 Anhängerbetrieb erklären', 'EV9 Anhängelast und Reichweite', 'model_detail_question', 'ev9'));
      push(contactSuggestion('Verkäufer dazu fragen'));
      return suggestions;
    }
    for (const rq of topic?.relatedQuestions ?? facts.relatedQuestions ?? []) {
      push(querySuggestion(rq.label, rq.query, 'advice_question', rq.id));
    }
    push(contactSuggestion());
    return suggestions.slice(0, 4);
  }

  if (classification.queryType === QUERY_TYPES.RANKING_QUESTION) {
    const top = facts.ranking?.matches?.[0];
    if (top?.modelKey) {
      push(querySuggestion(`Mehr Infos zum ${modelLabel(top.modelKey)}`, `Mehr Infos zum Kia ${modelLabel(top.modelKey)}`, 'model_detail_question', top.modelKey));
    }
    push(querySuggestion('Modelle vergleichen', focus && top?.modelKey
      ? `${modelLabel(top.modelKey)} mit anderem Modell vergleichen`
      : 'EV4 oder EV5 größer?', 'comparison_question'));
    push(querySuggestion('Passende Modelle anzeigen', 'Elektroauto SUV', 'vehicle_search'));
    push(contactSuggestion('Autohaus soll mich beraten'));
    return suggestions.slice(0, 4);
  }

  if (classification.queryType === QUERY_TYPES.COMPARISON_QUESTION) {
    const [a, b] = classification.comparisonModels ?? [];
    if (a && b) {
      push(querySuggestion(`Kosten ${modelLabel(a)} vs ${modelLabel(b)} vergleichen`, `Kosten ${modelLabel(a)} vs ${modelLabel(b)}`, 'comparison_question', `${a},${b}`));
      push(querySuggestion('Anhängerbetrieb vergleichen', `${modelLabel(a)} ${modelLabel(b)} Anhängelast vergleichen`, 'comparison_question', `${a},${b}`));
    }
    push(querySuggestion('Fahrprofil eingeben', 'Ich möchte mein Fahrprofil angeben', 'purchase_intent', 'profile'));
    push(contactSuggestion('Verkäufer soll mich beraten'));
    return suggestions.slice(0, 4);
  }

  if (classification.queryType === QUERY_TYPES.MODEL_EQUIPMENT_QUESTION && focus) {
    push(querySuggestion(`Mehr Infos zum ${modelLabel(focus)}`, `Mehr Infos zum Kia ${modelLabel(focus)}`, 'model_detail_question', focus));
    push(querySuggestion('Technische Daten anzeigen', `${modelLabel(focus)} technische Daten`, 'model_detail_question', focus));
    push(querySuggestion('Passende Modelle anzeigen', 'Ähnliche Kia Modelle', 'vehicle_search'));
    push(contactSuggestion());
    return suggestions.slice(0, 4);
  }

  if (smartAnswer?.relatedTopics?.length) {
    for (const topic of smartAnswer.relatedTopics.slice(0, 3)) {
      push(querySuggestion(topic.label, topic.query, 'advice_question', topic.id));
    }
  }

  push(contactSuggestion('Autohaus soll mich beraten'));
  const result = suggestions.slice(0, 4);
  return brandScope ? filterFollowUpsForBrandScope(result, brandScope) : result;
}
