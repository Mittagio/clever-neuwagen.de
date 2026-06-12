/**
 * Berechenbare Schätzungen – transparent, ohne LLM-Halluzination.
 */
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { getCleverRecordForModelKey } from '../admin/vehicleStammdatenOverrideService.js';
import { shortModelName, withNarrativeDefaults } from './smartAnswerNarrative.js';

/** Liter Kofferraum – typischer zusammengeklappter Kinderwagen */
const STROLLER_SPACE_L = 380;
/** Liter – große Hundebox (M–L) */
const DOG_CRATE_SPACE_L = 420;

/**
 * @param {number | null | undefined} trunkL
 * @param {number} neededL
 */
function fitVerdict(trunkL, neededL) {
  if (trunkL == null) return null;
  if (trunkL >= neededL + 80) return 'likely';
  if (trunkL >= neededL - 40) return 'tight';
  return 'unlikely';
}

const VERDICT_TEXT = {
  likely: 'Nach unserer Schätzung sollte das gut passen.',
  tight: 'Es könnte knapp werden – Rücksitze umklappen oder Maße vor Ort prüfen.',
  unlikely: 'Nach den Daten eher unwahrscheinlich – bitte Maße Ihres Gepäcks mit dem Kofferraum vergleichen.',
};

/**
 * @param {import('./vehicleEstimateMatcher.js').EstimateMatch} match
 * @param {string} query
 */
export function buildVehicleEstimateAnswer(match, query) {
  const record = getCleverRecordForModelKey(match.modelKey);
  const name = shortModelName(match.modelKey);
  const trunkL = record?.family?.trunkL ?? null;

  const neededL = match.estimateType === 'dog_crate_fit' ? DOG_CRATE_SPACE_L : STROLLER_SPACE_L;
  const verdict = fitVerdict(trunkL, neededL);

  if (!trunkL) {
    return withNarrativeDefaults({
      intent: 'vehicle_fact_question',
      mode: 'estimate',
      estimate: true,
      dataGap: true,
      query,
      title: `${match.category} – Kia ${name}`,
      lead: 'Vielen Dank für Ihre Frage.',
      narrative: [
        'Für eine Schätzung brauchen wir das Kofferraumvolumen – das liegt uns für dieses Modell noch nicht vor.',
        'Wir recherchieren das gerne für Sie.',
      ],
      openQuestion: {
        query,
        modelKey: match.modelKey,
        intentId: null,
        category: match.category,
        field: 'trunkVolume',
      },
      showNotifyCta: true,
      notifyCta: 'Benachrichtigen, sobald die Antwort verfügbar ist',
      facts: [],
      highlights: [],
      matchCount: 0,
      canShowOffers: true,
      showViewModelCta: true,
      viewModelCta: `${name} genauer ansehen`,
      primaryModelKey: match.modelKey,
      primaryModelLabel: KIA_MODEL_ATTRIBUTES[match.modelKey]?.label ?? name,
    });
  }

  const subject = match.estimateType === 'dog_crate_fit'
    ? 'eine typische Hundebox'
    : 'ein typischer Kombi-Kinderwagen';

  return withNarrativeDefaults({
    intent: 'vehicle_fact_question',
    mode: 'estimate',
    estimate: true,
    query,
    title: `Passt ${subject} in den Kia ${name}?`,
    lead: `📐 Schätzung – kein Ersatz für Ihr konkretes Modell.`,
    narrative: [
      `Der Kofferraum fasst ${trunkL} Liter (Herstellerangabe).`,
      `Als Richtwert rechnen wir mit ca. ${neededL} Litern für ${subject}.`,
      verdict ? VERDICT_TEXT[verdict] : null,
      'Bitte prüfen Sie Ihre exakten Maße vor dem Kauf – das ist eine Annäherung.',
    ].filter(Boolean),
    facts: [
      { label: 'Kofferraum', value: `${trunkL} Liter` },
      { label: 'Richtwert Bedarf', value: `ca. ${neededL} Liter` },
    ],
    highlights: [],
    matchCount: 1,
    canShowOffers: true,
    showViewModelCta: true,
    viewModelCta: `${name} genauer ansehen`,
    primaryModelKey: match.modelKey,
    primaryModelLabel: KIA_MODEL_ATTRIBUTES[match.modelKey]?.label ?? name,
  });
}
