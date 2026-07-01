/**
 * Follow-ups innerhalb der Händler-Markenwelt.
 */
import { QUERY_TYPES } from './customerQueryTypes.js';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import {
  filterFollowUpsForBrandScope,
  getDealerAlternativeModelKeys,
  getDealerBrandLabels,
} from './dealerBrandScope.js';

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
export function buildBrandScopedFollowUps({
  facts = {},
  classification = {},
  brandScope = {},
  analysis = {},
} = {}) {
  const alts = facts.kiaAlternatives?.length
    ? facts.kiaAlternatives
    : getDealerAlternativeModelKeys(brandScope);
  const suggestions = [];
  const push = (item) => {
    if (suggestions.length < 4 && !suggestions.some((s) => s.label === item.label)) {
      suggestions.push(item);
    }
  };

  if (facts.subkind === 'foreign_zeekr_charging_brief') {
    if (alts.includes('ev6')) push(querySuggestion('Mit Kia EV6 vergleichen', 'Kia EV6 Ladegeschwindigkeit', 'model_detail_question', 'ev6'));
    if (alts.includes('ev9')) push(querySuggestion('Mit Kia EV9 vergleichen', 'Kia EV9 Ladegeschwindigkeit', 'model_detail_question', 'ev9'));
    push(querySuggestion('Ladegeschwindigkeit erklären', 'Was bedeutet DC-Schnellladen?', 'general_car_question'));
    push(contactSuggestion());
    return filterFollowUpsForBrandScope(suggestions, brandScope);
  }

  if (facts.subkind === 'foreign_mercedes_eqb') {
    if (alts.includes('ev5')) push(querySuggestion('Mit Kia EV5 vergleichen', 'Mehr Infos zum Kia EV5', 'model_detail_question', 'ev5'));
    if (alts.includes('ev9')) push(querySuggestion('Mit Kia EV9 vergleichen', 'Mehr Infos zum Kia EV9', 'model_detail_question', 'ev9'));
    push(querySuggestion('Passende Modelle unserer Marken anzeigen', 'Passende Modelle unseres Autohauses', 'vehicle_wish'));
    push(contactSuggestion());
    return filterFollowUpsForBrandScope(suggestions, brandScope);
  }

  if (facts.subkind === 'zeekr_vs_byd_scoped') {
    if (alts.includes('ev4')) push(querySuggestion('Mit Kia EV4 vergleichen', 'Mehr Infos zum Kia EV4', 'model_detail_question', 'ev4'));
    if (alts.includes('ev5')) push(querySuggestion('Mit Kia EV5 vergleichen', 'Mehr Infos zum Kia EV5', 'model_detail_question', 'ev5'));
    push(querySuggestion('Elektro vs Plug-in-Hybrid erklären', 'Was ist besser Plug-in-Hybrid oder Elektro?', 'general_car_comparison'));
    push(contactSuggestion());
    return filterFollowUpsForBrandScope(suggestions, brandScope);
  }

  if (facts.subkind === 'gle_vs_ev9_scoped' || (facts.primaryModelKey === 'ev9' && analysis.isMixedWithAllowed)) {
    push(querySuggestion('EV9 Angebot anfragen', 'Ich möchte ein EV9 Angebot anfragen', 'purchase_intent', 'offer'));
    push(querySuggestion('EV9 technische Daten', 'Mehr Infos zum Kia EV9', 'model_detail_question', 'ev9'));
    push(querySuggestion('Fahrprofil eingeben', 'Ich möchte mein Fahrprofil angeben', 'purchase_intent', 'profile'));
    push(contactSuggestion());
    return filterFollowUpsForBrandScope(suggestions, brandScope);
  }

  if (facts.subkind === 'byd_dealer_foreign_compare') {
    push(querySuggestion('Mehr Infos zum BYD Seal 6', 'Mehr Infos zum BYD Seal 6', 'model_detail_question', 'seal'));
    push(querySuggestion('BYD Seal 6 Angebot anfragen', 'Ich möchte ein BYD Seal 6 Angebot anfragen', 'purchase_intent', 'offer'));
    push(querySuggestion('BYD Alternativen anzeigen', 'BYD Modelle Übersicht', 'vehicle_wish'));
    push(contactSuggestion());
    return filterFollowUpsForBrandScope(suggestions, brandScope);
  }

  if (facts.disallowForeignDetail || facts.brandScopeMode) {
    for (const alt of alts.slice(0, 2)) {
      const label = modelLabel(alt);
      const prefix = brandScope.primaryBrand === 'kia' ? 'Kia ' : '';
      push(querySuggestion(`Mit ${prefix}${label} vergleichen`, `Mehr Infos zum ${prefix}${label}`.trim(), 'model_detail_question', alt));
    }
    push(querySuggestion('Passende Modelle unserer Marken anzeigen', `Passende ${getDealerBrandLabels(brandScope).join('/')}-Modelle`, 'vehicle_wish'));
    push(contactSuggestion());
    return filterFollowUpsForBrandScope(suggestions, brandScope);
  }

  if (classification.queryType === QUERY_TYPES.COMPETITOR_QUESTION
    || classification.queryType === QUERY_TYPES.COMPETITOR_COMPARISON) {
    for (const alt of alts.slice(0, 2)) {
      push(querySuggestion(`Mit ${modelLabel(alt)} vergleichen`, `Mehr Infos zum ${modelLabel(alt)}`, 'model_detail_question', alt));
    }
    push(querySuggestion('Passende Modelle unserer Marken anzeigen', 'Passende Modelle unseres Autohauses', 'vehicle_wish'));
    push(contactSuggestion());
    return filterFollowUpsForBrandScope(suggestions, brandScope);
  }

  return null;
}
