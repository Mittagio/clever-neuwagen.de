/**
 * Fakten für technische Kia-Modellfragen aus Clever-Daten.
 */
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { KIA_CLEVER_RECORDS } from '../../data/clever/kiaCleverRecords.js';
import { getKiaFamilySpec } from '../../data/kia/kiaFamilySpecs.js';

function modelLabel(modelKey) {
  const label = KIA_MODEL_ATTRIBUTES[modelKey]?.label;
  return label ? `Kia ${label}` : `Kia ${modelKey?.toUpperCase()}`;
}

function getBestRecord(modelKey) {
  const records = KIA_CLEVER_RECORDS.filter((r) => r.modelKey === modelKey);
  if (!records.length) return null;
  return records.find((r) => r.trimId) ?? records[0];
}

function mergeTowing(record) {
  const familySpec = getKiaFamilySpec(record?.modelKey);
  return {
    brakedKg: record?.towing?.brakedKg ?? familySpec?.towCapacityKg ?? null,
    unbrakedKg: record?.towing?.unbrakedKg ?? null,
    noseWeightKg: record?.towing?.noseWeightKg ?? record?.towing?.roofLoadKg ?? null,
    roofLoadKg: record?.towing?.roofLoadKg ?? null,
  };
}

function buildTowingFacts(modelKey, topic) {
  const label = modelLabel(modelKey);
  const record = getBestRecord(modelKey);
  const towing = mergeTowing(record);
  const isVertical = topic === 'vertical_load';
  const hasVerified = isVertical
    ? towing.noseWeightKg != null
    : towing.brakedKg != null;

  if (hasVerified) {
    const lines = [];
    if (isVertical && towing.noseWeightKg != null) {
      lines.push(`Stützlast (vertikale Anhängelast): circa ${towing.noseWeightKg} kg`);
    }
    if (!isVertical && towing.brakedKg != null) {
      lines.push(`Gebremste Anhängelast: bis ${towing.brakedKg} kg`);
    }
    if (towing.unbrakedKg != null) {
      lines.push(`Ungebremste Anhängelast: bis ${towing.unbrakedKg} kg`);
    }
    if (towing.noseWeightKg != null && !isVertical) {
      lines.push(`Stützlast: circa ${towing.noseWeightKg} kg`);
    }
    return {
      kind: 'model_technical',
      topic: isVertical ? 'vertical_load' : 'towing',
      modelKey,
      hasVerifiedData: true,
      headline: isVertical ? `${label}: Stützlast` : `${label}: Anhängelast`,
      shortAnswer: `${lines.join('. ')}. Die finale Ausführung mit AHK und Zulassung prüft Ihr Autohaus.`,
      bullets: lines,
      facts: lines.map((line) => ({ label: 'Daten', value: line })),
      sources: ['kiaCleverRecords', 'kiaFamilySpecs'],
    };
  }

  return {
    kind: 'model_technical',
    topic: isVertical ? 'vertical_load' : 'towing',
    modelKey,
    hasVerifiedData: false,
    headline: isVertical ? `${label}: Stützlast` : `${label}: Anhängerbetrieb`,
    shortAnswer: `Zur Stützlast des ${label.replace('Kia ', '')} muss die konkrete Ausführung und Anhängerkupplung geprüft werden. Wichtig sind Anhängelast, Stützlast, Fahrradträger und Zulassungsdaten. Ihr Autohaus prüft die konkrete Version final.`,
    bullets: [],
    sources: ['model_technical_templates'],
  };
}

function buildSeatingFacts(modelKey) {
  const label = modelLabel(modelKey);
  const record = getBestRecord(modelKey);
  const familySpec = getKiaFamilySpec(modelKey);
  const seats = record?.family?.seats ?? familySpec?.seats ?? KIA_MODEL_ATTRIBUTES[modelKey]?.seats ?? null;

  if (modelKey === 'ev9' || modelKey === 'ev9-gt') {
    return {
      kind: 'model_technical',
      topic: 'seating',
      modelKey,
      hasVerifiedData: true,
      headline: `${label}: Sitzplätze`,
      shortAnswer: 'Der Kia EV9 ist je nach Version als 6- oder 7-Sitzer erhältlich. Er hat drei Sitzreihen. Der 7-Sitzer ist meist flexibler für Familie, der 6-Sitzer komfortabler in Reihe 2. Verfügbarkeit prüft Ihr Autohaus final.',
      bullets: ['6- oder 7-Sitzer je nach Version', 'Drei Sitzreihen'],
      facts: [
        { label: 'Varianten', value: '6- oder 7-Sitzer' },
        { label: 'Sitzreihen', value: '3 Reihen' },
      ],
      sources: ['kiaFamilySpecs', 'model_technical_templates'],
    };
  }

  if (seats != null) {
    return {
      kind: 'model_technical',
      topic: 'seating',
      modelKey,
      hasVerifiedData: true,
      headline: `${label}: Sitzplätze`,
      shortAnswer: `Der ${label} bietet nach hinterlegten Daten ${seats} Sitzplätze. Die konkrete Ausstattungslinie prüft Ihr Autohaus final.`,
      bullets: [`${seats} Sitzplätze`],
      facts: [{ label: 'Sitze', value: `${seats}` }],
      sources: ['kiaCleverRecords', 'kiaModelAttributes'],
    };
  }

  return {
    kind: 'model_technical',
    topic: 'seating',
    modelKey,
    hasVerifiedData: false,
    headline: `${label}: Sitzplätze`,
    shortAnswer: `Die Sitzplatzanzahl beim ${label.replace('Kia ', '')} hängt von der Ausstattungslinie ab. Ihr Autohaus nennt die verfügbaren Varianten final.`,
    bullets: [],
    sources: ['model_technical_templates'],
  };
}

function buildIsofixFacts(modelKey) {
  const label = modelLabel(modelKey);
  const record = getBestRecord(modelKey);
  const familySpec = getKiaFamilySpec(modelKey);
  const count = record?.family?.isofixRearCount ?? familySpec?.isofixRearCount ?? null;
  const hasRear = record?.family?.isofixRear ?? familySpec?.isofixRear ?? null;

  if (count != null && hasRear) {
    return {
      kind: 'model_technical',
      topic: 'isofix',
      modelKey,
      hasVerifiedData: true,
      headline: `${label}: Isofix`,
      shortAnswer: `Beim ${label} sind nach hinterlegten Daten ${count} Isofix-Befestigung${count === 1 ? '' : 'en'} auf den äußeren Rücksitzen vorgesehen. Ihr Autohaus bestätigt die genaue Anzahl und Position final.`,
      bullets: [`${count}× Isofix hinten`],
      facts: [{ label: 'Isofix', value: `${count}× hinten` }],
      sources: ['kiaCleverRecords', 'kiaFamilySpecs'],
    };
  }

  return {
    kind: 'model_technical',
    topic: 'isofix',
    modelKey,
    hasVerifiedData: false,
    headline: `${label}: Isofix`,
    shortAnswer: `Beim ${label.replace('Kia ', '')} ist für Familien wichtig, die Isofix-Punkte der konkreten Version zu prüfen. In der Regel sitzen Isofix-Befestigungen auf den äußeren Rücksitzen. Ihr Autohaus bestätigt die genaue Anzahl und Position final.`,
    bullets: [],
    sources: ['model_technical_templates'],
  };
}

function buildChargingFacts(modelKey) {
  const label = modelLabel(modelKey);
  const record = getBestRecord(modelKey);
  const electric = record?.electric ?? {};
  const dcKw = electric.dcKw ?? null;
  const chargeMin = electric.dcCharge10_80Min ?? null;
  const has800V = electric.has800V ?? false;

  if (dcKw != null || chargeMin != null) {
    const lines = [];
    if (dcKw != null) lines.push(`DC-Schnellladen: bis ${dcKw} kW${has800V ? ' (800-V-Architektur)' : ''}`);
    if (chargeMin != null) lines.push(`Ladezeit 10–80 %: circa ${chargeMin} Minuten (Herstellerangabe, abhängig von Bedingungen)`);
    return {
      kind: 'model_technical',
      topic: 'charging_speed',
      modelKey,
      hasVerifiedData: true,
      headline: `${label}: Ladegeschwindigkeit`,
      shortAnswer: `${lines.join('. ')}. Temperatur, Ladestand und Ladesäule beeinflussen die reale Zeit.`,
      bullets: lines,
      facts: lines.map((line) => ({ label: 'Laden', value: line })),
      sources: ['kiaCleverRecords'],
    };
  }

  return {
    kind: 'model_technical',
    topic: 'charging_speed',
    modelKey,
    hasVerifiedData: false,
    headline: `${label}: Ladegeschwindigkeit`,
    shortAnswer: 'Die Ladegeschwindigkeit hängt von Akku, Temperatur, Ladestand und Ladesäule ab. Wichtig sind DC-Ladeleistung und die 10–80-%-Zeit. Ihr Autohaus prüft die konkrete Version final.',
    bullets: [],
    sources: ['model_technical_templates'],
  };
}

const TECHNICAL_TOPICS = new Set([
  'vertical_load', 'towing', 'seating', 'seats', 'isofix', 'family_seating', 'charging_speed', 'charging',
]);

/**
 * @param {object} classification
 * @param {string} [query]
 */
export function buildModelTechnicalFacts(classification = {}, query = '') {
  const { modelKey, topic } = classification;
  if (!modelKey || !topic || !TECHNICAL_TOPICS.has(topic)) return null;

  switch (topic) {
    case 'vertical_load':
    case 'towing':
      return buildTowingFacts(modelKey, topic);
    case 'seating':
    case 'seats':
      return buildSeatingFacts(modelKey);
    case 'isofix':
    case 'family_seating':
      return buildIsofixFacts(modelKey);
    case 'charging_speed':
    case 'charging':
      return buildChargingFacts(modelKey);
    default:
      return null;
  }
}
