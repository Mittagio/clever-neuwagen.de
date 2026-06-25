/**
 * Vorberatung – Zusammenfassung, Richtung, CRM-Payload.
 */
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import {
  getPreConsultOptionLabel,
  PRECONSULT_EQUIPMENT_OPTIONS,
  PRECONSULT_PRIORITY_OPTIONS,
  PRECONSULT_USAGE_OPTIONS,
} from '../../data/dealer/customerPreConsultationSteps.js';
import { analyzeEquipmentWishSelection } from '../configuration/equipmentWishAdvisor.js';
import { buildCustomerAssessmentSummary } from './customerAdvisorPresentation.js';

const FUEL_LABELS = {
  electric: 'Elektro',
  hybrid: 'Hybrid',
  plugin_hybrid: 'Plug-in-Hybrid',
  combustion: 'Verbrenner',
};

const BODY_LABELS = {
  suv: 'SUV',
  kleinwagen: 'Kleinwagen',
  limousine: 'Limousine',
  kombi: 'Kombi',
  van: 'Van',
};

/**
 * @param {string} modelKey
 */
export function buildModelTypeLine(modelKey) {
  const attrs = KIA_MODEL_ATTRIBUTES[String(modelKey ?? '').toLowerCase()];
  if (!attrs) return null;
  const fuel = FUEL_LABELS[attrs.fuel] ?? '';
  const body = BODY_LABELS[attrs.bodyType] ?? attrs.bodyClass ?? '';
  if (fuel && body) return `${fuel}-${body}`;
  return fuel || body || null;
}

/**
 * @param {object} params
 */
export function collectPreConsultationChipIds({
  priorityIds = [],
  usageIds = [],
  equipmentIds = [],
}) {
  const ids = new Set();
  const addFromOptions = (selected, options) => {
    for (const id of selected) {
      const opt = options.find((o) => o.id === id);
      if (opt?.chipIds?.length) {
        opt.chipIds.forEach((cid) => ids.add(cid));
      } else {
        ids.add(id);
      }
    }
  };
  addFromOptions(priorityIds, PRECONSULT_PRIORITY_OPTIONS);
  addFromOptions(usageIds, PRECONSULT_USAGE_OPTIONS);
  addFromOptions(equipmentIds, PRECONSULT_EQUIPMENT_OPTIONS);
  return [...ids];
}

/**
 * @param {object} params
 */
export function buildPreConsultationSummaryLines({
  modelLabel,
  priorityIds = [],
  usageIds = [],
  equipmentIds = [],
  searchedFeatures = [],
  openCheckpoints = [],
}) {
  const lines = [modelLabel.replace(/^Kia\s+/i, 'Kia ').trim()];
  for (const id of priorityIds) {
    lines.push(getPreConsultOptionLabel(id, PRECONSULT_PRIORITY_OPTIONS));
  }
  for (const id of usageIds) {
    lines.push(getPreConsultOptionLabel(id, PRECONSULT_USAGE_OPTIONS));
  }
  for (const id of equipmentIds) {
    const label = getPreConsultOptionLabel(id, PRECONSULT_EQUIPMENT_OPTIONS);
    lines.push(`${label} wichtig`);
  }
  for (const item of searchedFeatures) {
    const term = item?.label ?? item?.query;
    if (term) lines.push(term);
  }
  for (const point of openCheckpoints) {
    if (point && !lines.includes(point)) lines.push(`${point} bitte prüfen`);
  }
  return [...new Set(lines.filter(Boolean))];
}

/**
 * @param {object} params
 */
export function inferPreConsultationDirection({
  brand,
  model,
  modelKey,
  chipIds = [],
  searchedFeatures = [],
  modelLabel = '',
}) {
  const analysis = analyzeEquipmentWishSelection(
    brand,
    model,
    chipIds,
    { modelKey, searchedFeatures },
  );
  const assessment = buildCustomerAssessmentSummary(analysis, modelLabel);
  const trimLines = analysis.trimLines ?? [];
  const openPoints = assessment.openPoints ?? [];

  let directionText = assessment.directionLabel;
  if (directionText && !directionText.toLowerCase().includes('prüfen')) {
    directionText = `${directionText} prüfen`;
  }
  if (!directionText && trimLines.length) {
    const names = trimLines.slice(0, 2).map((l) => l.trimName).filter(Boolean);
    if (names.length) {
      directionText = `${modelLabel} ${names.join(' oder ')} prüfen`.trim();
    }
  }

  return {
    analysis,
    assessment,
    directionText,
    possibleTrims: assessment.trimIds.map(
      (id) => trimLines.find((l) => l.trimId === id)?.trimName ?? id,
    ),
    openCheckpoints: openPoints,
  };
}

/**
 * @param {object} params
 */
export function buildPreConsultationWishPayload({
  modelKey,
  modelLabel,
  priorityIds = [],
  usageIds = [],
  equipmentIds = [],
  searchedFeatures = [],
  brand = 'Kia',
  model = '',
}) {
  const chipIds = collectPreConsultationChipIds({ priorityIds, usageIds, equipmentIds });
  const { directionText, possibleTrims, openCheckpoints, assessment } = inferPreConsultationDirection({
    brand,
    model,
    modelKey,
    chipIds,
    searchedFeatures,
    modelLabel,
  });

  const summaryLines = buildPreConsultationSummaryLines({
    modelLabel,
    priorityIds,
    usageIds,
    equipmentIds,
    searchedFeatures,
    openCheckpoints,
  });

  const priorityLabels = priorityIds.map((id) => getPreConsultOptionLabel(id, PRECONSULT_PRIORITY_OPTIONS));
  const usageLabels = usageIds.map((id) => getPreConsultOptionLabel(id, PRECONSULT_USAGE_OPTIONS));
  const equipmentLabels = equipmentIds.map((id) => getPreConsultOptionLabel(id, PRECONSULT_EQUIPMENT_OPTIONS));

  return {
    source: 'customer_advisor',
    modelKey,
    modelLabel,
    modelInterest: modelLabel,
    consultationType: 'pre_consultation',
    priorities: priorityLabels,
    priorityIds,
    usage: usageLabels,
    usageIds,
    equipment: equipmentLabels,
    equipmentIds,
    selectedChips: [...priorityLabels, ...usageLabels, ...equipmentLabels],
    selectedChipIds: chipIds,
    searchTerms: searchedFeatures.map((f) => f.label ?? f.query ?? f.id).filter(Boolean),
    possibleTrims,
    possibleDirection: directionText,
    openCheckpoints,
    summaryLines,
    assessmentDirection: directionText,
    assessmentHeadline: assessment.headline,
    statusHint: 'Beratung angefragt',
    nextStepHint: 'Expertenkontakt aufnehmen',
  };
}
