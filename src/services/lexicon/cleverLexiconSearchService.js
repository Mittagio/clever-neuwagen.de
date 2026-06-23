/**
 * Clever-Lexikon – Verkäufer-Schnellsuche über Konfigurator-, Ausstattungs- und Stammdaten.
 * Eine Datenbasis: globalFeatureCatalog, modelEquipmentData, Clever Records, Import-JSON.
 */
import { getCleverRecordForModelKey } from '../admin/vehicleStammdatenOverrideService.js';
import { FEATURE_AVAILABILITY_STATUS as S } from '../../data/features/modelEquipmentSchema.js';
import { getSearchableGlobalFeatures } from '../../data/features/globalFeatureCatalog.js';
import { getKiaTechnicalSpec } from '../../data/kia/kiaTechnicalSpecs.js';
import { getManufacturerModel, getManufacturerPackages } from '../../data/manufacturer/manufacturerRegistry.js';
import { resolveGlobalFeatureFromQuery } from '../configuration/globalFeatureResolver.js';
import {
  getModelEquipmentProfile,
  resolveModelFeatureAvailability,
} from '../configuration/modelEquipmentData.js';
import { getImportedModelEquipmentProfile } from '../configuration/equipmentImportRegistry.js';
import {
  buildSalesStatusHeadline,
  describeSalesTrimLine,
} from '../admin/equipmentSalesSearchService.js';

/** @typedef {'technical' | 'equipment' | 'package' | 'unknown'} LexiconIntentType */

export const LEXICON_EXAMPLE_CHIPS = [
  { id: 'ev4-battery', label: 'EV4 Batterie', query: 'EV4 Batterie' },
  { id: 'ev4-heat', label: 'EV4 Wärmepumpe', query: 'EV4 Wärmepumpe' },
  { id: 'ev3-v2l', label: 'EV3 V2L', query: 'EV3 V2L' },
  { id: 'ev3-hud', label: 'EV3 Head-up Display', query: 'EV3 Head-up Display' },
  { id: 'sportage-tow', label: 'Sportage Anhängelast', query: 'Sportage Anhängelast' },
  { id: 'sportage-drivewise', label: 'Sportage DriveWise', query: 'Sportage DriveWise' },
];

export const LEXICON_MODEL_ENTRIES = [
  { brand: 'Kia', model: 'EV2', modelKey: 'ev2', patterns: [/\bev\s*2\b/i, /\bev2\b/i] },
  { brand: 'Kia', model: 'EV3', modelKey: 'ev3', patterns: [/\bev\s*3\b/i, /\bev3\b/i] },
  { brand: 'Kia', model: 'EV4', modelKey: 'ev4', patterns: [/\bev\s*4\b/i, /\bev4\b/i] },
  { brand: 'Kia', model: 'EV4 Fastback', modelKey: 'ev4-fastback', patterns: [/\bev\s*4\s*fastback\b/i, /\bev4\s*fastback\b/i] },
  { brand: 'Kia', model: 'EV5', modelKey: 'ev5', patterns: [/\bev\s*5\b/i, /\bev5\b/i] },
  { brand: 'Kia', model: 'EV6', modelKey: 'ev6', patterns: [/\bev\s*6\b/i, /\bev6\b/i] },
  { brand: 'Kia', model: 'EV9', modelKey: 'ev9', patterns: [/\bev\s*9\b/i, /\bev9\b/i] },
  { brand: 'Kia', model: 'Sportage', modelKey: 'sportage', patterns: [/sportage/i] },
  { brand: 'Kia', model: 'Stonic', modelKey: 'stonic', patterns: [/stonic/i] },
  { brand: 'Kia', model: 'XCeed', modelKey: 'xceed', patterns: [/\bx\s*ceed\b/i, /\bxceed\b/i] },
  { brand: 'Kia', model: 'Ceed', modelKey: 'ceed', patterns: [/\bceed\b/i] },
  { brand: 'Kia', model: 'Niro', modelKey: 'niro', patterns: [/niro/i] },
  { brand: 'Kia', model: 'Picanto', modelKey: 'picanto', patterns: [/picanto/i] },
  { brand: 'Kia', model: 'Sorento', modelKey: 'sorento', patterns: [/sorento/i] },
  { brand: 'Kia', model: 'Seltos', modelKey: 'seltos', patterns: [/seltos/i] },
  { brand: 'Kia', model: 'PV5', modelKey: 'pv5-passenger', patterns: [/\bpv\s*5\b/i, /\bpv5\b/i] },
];

const TECHNICAL_TOPICS = [
  { id: 'battery', patterns: [/batterie|battery|kwh/i], label: 'Batterie' },
  { id: 'range', patterns: [/reichweite|range|wltp/i], label: 'Reichweite' },
  { id: 'trunk', patterns: [/kofferraum|trunk|gepäck|kofferraumvolumen/i], label: 'Kofferraum' },
  { id: 'length', patterns: [/länge|laenge|length|lang\b/i], label: 'Länge' },
  { id: 'width', patterns: [/breite|width/i], label: 'Breite' },
  { id: 'height', patterns: [/höhe|hoehe|height/i], label: 'Höhe' },
  { id: 'wheelbase', patterns: [/radstand|wheelbase/i], label: 'Radstand' },
  { id: 'towing', patterns: [/anhängelast|anhaenger|anhänger|towing|zuglast/i], label: 'Anhängelast' },
  { id: 'charging', patterns: [/ladeleistung|schnelllad|dc-lad|laden\b/i], label: 'Ladeleistung' },
  { id: 'powertrain', patterns: [/motor|antrieb|ps\b|leistung\b/i], label: 'Antrieb' },
];

const PACKAGE_QUERY_PATTERNS = [
  { id: 'drivewise', patterns: [/drivewise|drive.?wise/i], label: 'DriveWise' },
  { id: 'premium', patterns: [/premium\s*paket|premium-paket/i], label: 'Premium Paket' },
  { id: 'technik', patterns: [/technik\s*paket|technik-paket/i], label: 'Technik Paket' },
];

const STATUS_SHORT = {
  [S.STANDARD]: 'serienmäßig',
  [S.AVAILABLE]: 'verfügbar',
  [S.OPTIONAL]: 'optional',
  [S.PACKAGE_REQUIRED]: 'über Paket',
  [S.NOT_AVAILABLE]: 'nicht verfügbar',
  [S.UNKNOWN]: 'prüfen',
};

const DEMO_DC_KW = { ev2: 100, ev3: 128, ev4: 150, ev5: 350, ev6: 350, ev9: 350 };

function formatMm(mm) {
  if (mm == null) return null;
  return `${(mm / 1000).toFixed(2).replace('.', ',')} m`;
}

function formatLiters(l) {
  if (l == null) return null;
  return `${l.toLocaleString('de-DE')} Liter`;
}

function formatBattery(record) {
  const e = record?.electric;
  if (!e) return null;
  if (e.batteryOptionsKwh?.length) {
    return `${e.batteryOptionsKwh.map((k) => `${k} kWh`).join(' / ')}\nje nach Variante`;
  }
  if (e.batteryNetKwh) {
    return `${e.batteryNetKwh} kWh netto${e.batteryGrossKwh ? ` (${e.batteryGrossKwh} kWh brutto)` : ''}`;
  }
  if (e.batteryGrossKwh) return `${e.batteryGrossKwh} kWh`;
  return null;
}

function stripModelFromQuery(query, modelEntry) {
  let remainder = query;
  const phrases = [
    `${modelEntry.brand} ${modelEntry.model}`,
    modelEntry.model,
    modelEntry.modelKey,
    modelEntry.modelKey.replace('-', ' '),
  ].sort((a, b) => b.length - a.length);

  for (const phrase of phrases) {
    if (!phrase) continue;
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    remainder = remainder.replace(new RegExp(escaped, 'ig'), ' ').replace(/\s+/g, ' ').trim();
  }
  return remainder || query.trim();
}

function detectTechnicalTopic(text) {
  for (const topic of TECHNICAL_TOPICS) {
    if (topic.patterns.some((p) => p.test(text))) return topic;
  }
  return null;
}

function detectPackageTopic(text) {
  for (const pkg of PACKAGE_QUERY_PATTERNS) {
    if (pkg.patterns.some((p) => p.test(text))) return pkg;
  }
  return null;
}

function buildSourceLine({ record, availability, profile, isDemo = false }) {
  const importDoc = profile?.source?.documentName
    ?? availability?.sourceRefs?.find((r) => typeof r === 'string' && !r.includes('Mapping'));
  if (importDoc && typeof importDoc === 'string' && importDoc !== 'import') {
    return `Quelle: ${importDoc}`;
  }
  if (availability?.sourceRefs?.length) {
    const ref = availability.sourceRefs.find((r) => r && r !== 'trimFeatureMapping');
    if (ref === 'manufacturerRegistry') return 'Quelle: Hersteller-Konfigurator';
    if (ref === 'trimFeatureMapping') return 'Quelle: Ausstattungs-Mapping';
    if (typeof ref === 'string') return `Quelle: ${ref}`;
  }
  if (record?.basis?.priceListSource) return `Quelle: ${record.basis.priceListSource}`;
  if (isDemo) return 'Quelle: Clever-Stammdaten Demo';
  return 'Quelle: Clever-Stammdaten';
}

function buildWarnings({ confidence, modelStatus, hasData }) {
  const warnings = [];
  if (!hasData || modelStatus === S.UNKNOWN || confidence === 'low') {
    warnings.push('In den aktuellen Modelldaten noch nicht eindeutig bestätigt.');
    warnings.push('Bitte vor Angebot final prüfen.');
  }
  return warnings;
}

function trimStatusLabel(entry) {
  if (entry.status === S.PACKAGE_REQUIRED) {
    return entry.packageName ? `über ${entry.packageName}` : STATUS_SHORT[S.PACKAGE_REQUIRED];
  }
  return STATUS_SHORT[entry.status] ?? STATUS_SHORT[S.UNKNOWN];
}

function mapAvailabilityByTrim(availability) {
  if (!availability?.entries?.length) return [];
  return availability.entries.map((entry) => ({
    trim: entry.trimName ?? entry.trimId ?? '—',
    label: trimStatusLabel(entry),
    status: entry.status,
    packageName: entry.packageName ?? null,
  }));
}

function relatedTechnicalFacts(record, spec, topicId, exclude = []) {
  const facts = [];
  const d = record?.dimensions ?? {};
  const e = record?.electric ?? {};
  const f = record?.family ?? {};
  const t = record?.towing ?? {};

  const add = (id, label, value) => {
    if (!value || exclude.includes(id)) return;
    facts.push({ id, label, value });
  };

  if (topicId === 'battery') {
    add('range', 'Reichweite', e.wltpRangeKm ? `${e.wltpRangeKm} km (WLTP)` : spec?.electricRangeKm ? `${spec.electricRangeKm} km` : null);
    add('charging', 'DC-Laden', e.dcKw ? `bis ${e.dcKw} kW` : DEMO_DC_KW[record?.modelKey] ? `bis ${DEMO_DC_KW[record.modelKey]} kW (Referenz)` : null);
  } else if (topicId === 'range') {
    add('battery', 'Batterie', formatBattery(record));
    add('charging', 'DC-Laden', e.dcKw ? `bis ${e.dcKw} kW` : null);
  } else if (topicId === 'towing') {
    add('powertrain', 'Antrieb', record?.basis?.powertrain?.replace('elektro', 'Elektro') ?? null);
  } else if (topicId === 'length') {
    add('width', 'Breite', formatMm(d.widthMm ?? spec?.widthMm));
    add('height', 'Höhe', formatMm(d.heightMm ?? spec?.heightMm));
  } else if (topicId === 'trunk') {
    add('seats', 'Sitze', f.seats ? `${f.seats}` : null);
  }

  return facts.slice(0, 4);
}

/**
 * @param {string} query
 */
export function parseLexiconQuery(query) {
  const text = query?.trim() ?? '';
  const model = resolveLexiconModel(text);
  const intent = resolveLexiconIntent(text, model);
  return { query: text, model, intent };
}

/**
 * @param {string} query
 */
export function resolveLexiconModel(query) {
  const text = query?.trim() ?? '';
  if (!text) return null;

  const sorted = [...LEXICON_MODEL_ENTRIES].sort(
    (a, b) => Math.max(...b.patterns.map((p) => text.match(p)?.[0]?.length ?? 0))
      - Math.max(...a.patterns.map((p) => text.match(p)?.[0]?.length ?? 0)),
  );

  for (const entry of sorted) {
    if (entry.patterns.some((p) => p.test(text))) return entry;
  }
  return null;
}

/**
 * @param {string} query
 * @param {ReturnType<typeof resolveLexiconModel>} modelEntry
 */
export function resolveLexiconIntent(query, modelEntry = null) {
  const text = query?.trim() ?? '';
  const remainder = modelEntry ? stripModelFromQuery(text, modelEntry) : text;

  const technical = detectTechnicalTopic(remainder);
  if (technical) {
    return { type: 'technical', topic: technical, featureQuery: remainder };
  }

  const packageTopic = detectPackageTopic(remainder);
  if (packageTopic) {
    return { type: 'package', packageTopic, featureQuery: remainder };
  }

  const recognition = resolveGlobalFeatureFromQuery(remainder);
  if (recognition.type === 'match') {
    return { type: 'equipment', feature: recognition.feature, featureQuery: remainder };
  }
  if (recognition.type === 'ambiguous') {
    return {
      type: 'equipment',
      feature: recognition.suggestions?.[0] ?? null,
      ambiguous: true,
      suggestions: recognition.suggestions ?? [],
      featureQuery: remainder,
    };
  }

  if (!modelEntry) {
    const featureOnly = resolveGlobalFeatureFromQuery(text);
    if (featureOnly.type === 'match') {
      return { type: 'equipment', feature: featureOnly.feature, needsModel: true, featureQuery: text };
    }
  }

  return { type: 'unknown', featureQuery: remainder, suggestions: recognition.suggestions ?? [] };
}

/**
 * @param {object} modelEntry
 * @param {ReturnType<typeof resolveLexiconIntent>} intent
 */
export function buildTechnicalDataAnswer(modelEntry, intent) {
  const topic = intent.topic;
  const record = getCleverRecordForModelKey(modelEntry.modelKey);
  const spec = getKiaTechnicalSpec(modelEntry.modelKey);
  const profile = getImportedModelEquipmentProfile(modelEntry.modelKey);
  const modelTitle = `${modelEntry.brand} ${modelEntry.model}`;
  const fieldLabel = topic.label;

  let primaryValue = null;
  let shortAnswer = null;
  const warnings = [];

  switch (topic.id) {
    case 'battery':
      primaryValue = formatBattery(record);
      shortAnswer = primaryValue
        ? 'Batteriekapazität je nach Motorisierung/Variante.'
        : 'Batteriedaten in den Stammdaten noch nicht hinterlegt.';
      break;
    case 'range': {
      const km = record?.electric?.wltpRangeKm ?? spec?.electricRangeKm;
      primaryValue = km ? `${km} km (WLTP)` : null;
      shortAnswer = primaryValue ? 'WLTP-Reichweite nach aktuellem Datenstand.' : 'Reichweite noch nicht hinterlegt.';
      break;
    }
    case 'trunk': {
      const l = record?.family?.trunkL ?? spec?.trunkL;
      primaryValue = l ? formatLiters(l) : null;
      shortAnswer = primaryValue ? 'Kofferraumvolumen nach Herstellerangabe.' : 'Kofferraumvolumen noch nicht hinterlegt.';
      break;
    }
    case 'length':
      primaryValue = formatMm(record?.dimensions?.lengthMm ?? spec?.lengthMm);
      shortAnswer = primaryValue ? 'Fahrzeuglänge über alle Räder.' : 'Länge noch nicht hinterlegt.';
      break;
    case 'width':
      primaryValue = formatMm(record?.dimensions?.widthMm ?? spec?.widthMm);
      shortAnswer = primaryValue ? 'Fahrzeugbreite inkl. Spiegel nach Datenstand.' : 'Breite noch nicht hinterlegt.';
      break;
    case 'height':
      primaryValue = formatMm(record?.dimensions?.heightMm ?? spec?.heightMm);
      shortAnswer = primaryValue ? 'Fahrzeughöhe unbeladen.' : 'Höhe noch nicht hinterlegt.';
      break;
    case 'wheelbase':
      primaryValue = formatMm(record?.dimensions?.wheelbaseMm ?? spec?.wheelbaseMm);
      shortAnswer = primaryValue ? 'Radstand nach Herstellerangabe.' : 'Radstand noch nicht hinterlegt.';
      break;
    case 'towing': {
      const kg = record?.towing?.brakedKg;
      primaryValue = kg ? `${kg.toLocaleString('de-DE')} kg (gebremst)` : null;
      shortAnswer = primaryValue
        ? 'Anhängelast gebremst – abhängig von Motorisierung und Ausstattung.'
        : 'Anhängelast noch nicht hinterlegt.';
      break;
    }
    case 'charging': {
      const dc = record?.electric?.dcKw ?? DEMO_DC_KW[modelEntry.modelKey];
      const isDemo = !record?.electric?.dcKw && Boolean(DEMO_DC_KW[modelEntry.modelKey]);
      primaryValue = dc ? `bis ${dc} kW (DC-Schnellladung)` : null;
      shortAnswer = primaryValue ? 'Maximale DC-Ladeleistung nach Datenstand.' : 'Ladeleistung noch nicht hinterlegt.';
      if (isDemo) warnings.push('DC-Wert aus Referenzdaten – vor Angebot final prüfen.');
      break;
    }
    case 'powertrain':
      primaryValue = record?.basis?.powertrain
        ? String(record.basis.powertrain).replace('elektro', 'Elektro').replace('plugin-hybrid', 'Plug-in-Hybrid')
        : null;
      shortAnswer = primaryValue ? 'Antriebsart nach Modelllinie.' : 'Antrieb nicht hinterlegt.';
      break;
    default:
      primaryValue = null;
      shortAnswer = 'Technische Angabe nicht gefunden.';
  }

  if (!primaryValue) warnings.push(...buildWarnings({ hasData: false }));

  const relatedFacts = relatedTechnicalFacts(record, spec, topic.id, [topic.id]);

  return {
    query: null,
    model: modelEntry,
    intentType: 'technical',
    title: modelTitle,
    fieldLabel,
    shortAnswer,
    primaryFacts: primaryValue ? [{ label: fieldLabel, value: primaryValue }] : [],
    availabilityByTrim: [],
    relatedFacts,
    source: buildSourceLine({ record, profile }),
    confidence: primaryValue ? (record ? 'medium' : 'low') : 'low',
    warnings,
    modelKey: modelEntry.modelKey,
    topic: topic.id,
  };
}

/**
 * @param {object} modelEntry
 * @param {import('../../data/features/globalFeatureCatalog.js').GlobalFeature} feature
 */
export function buildEquipmentAnswer(modelEntry, feature) {
  const availability = resolveModelFeatureAvailability(
    modelEntry.brand,
    modelEntry.model,
    modelEntry.modelKey,
    feature.id,
  );
  const profile = getImportedModelEquipmentProfile(modelEntry.modelKey)
    ?? getModelEquipmentProfile(modelEntry.brand, modelEntry.model, modelEntry.modelKey);
  const record = getCleverRecordForModelKey(modelEntry.modelKey);
  const modelTitle = `${modelEntry.brand} ${modelEntry.model}`;
  const fieldLabel = feature.label;

  const availabilityByTrim = mapAvailabilityByTrim(availability);
  const hasTrimData = availabilityByTrim.length > 0;
  const modelStatus = availability?.modelStatus ?? S.UNKNOWN;
  const confidence = availability?.confidence ?? (hasTrimData ? 'medium' : 'low');

  let shortAnswer;
  if (!availability || modelStatus === S.UNKNOWN) {
    shortAnswer = `Die ${fieldLabel}-Verfügbarkeit ist beim ${modelEntry.model} abhängig von Linie und Paket.`;
  } else if (modelStatus === S.PACKAGE_REQUIRED) {
    shortAnswer = `Die ${fieldLabel} ist beim ${modelEntry.model} über ein Paket erhältlich.`;
  } else if (modelStatus === S.NOT_AVAILABLE) {
    shortAnswer = `Die ${fieldLabel} ist beim ${modelEntry.model} nach aktuellem Datenstand nicht verfügbar.`;
  } else if (modelStatus === S.STANDARD) {
    shortAnswer = `Die ${fieldLabel} ist beim ${modelEntry.model} je nach Linie serienmäßig oder über Paket verfügbar.`;
  } else {
    shortAnswer = buildSalesStatusHeadline(availability);
    shortAnswer = `Die ${fieldLabel}: ${shortAnswer}.`;
  }

  const packageNames = [...new Set(
    (availability?.availablePackages ?? []).map((p) => p.name).filter(Boolean),
  )];

  const primaryFacts = packageNames.length
    ? [{ label: 'Verfügbar über', value: packageNames.join(' / ') }]
    : hasTrimData
      ? [{ label: 'Verfügbarkeit', value: buildSalesStatusHeadline(availability) }]
      : [];

  const warnings = buildWarnings({ confidence, modelStatus, hasData: hasTrimData });

  const intentType = modelStatus === S.PACKAGE_REQUIRED || packageNames.length ? 'package' : 'equipment';

  return {
    query: null,
    model: modelEntry,
    intentType,
    title: modelTitle,
    fieldLabel,
    shortAnswer,
    primaryFacts,
    availabilityByTrim,
    relatedFacts: availability?.entries?.length
      ? availability.entries.slice(0, 6).map((e) => ({
        label: e.trimName ?? e.trimId,
        value: describeSalesTrimLine(e).replace(/^[^:]+:\s*/, ''),
      }))
      : [],
    source: buildSourceLine({ record, availability, profile }),
    confidence,
    warnings,
    modelKey: modelEntry.modelKey,
    featureId: feature.id,
  };
}

/**
 * @param {object} modelEntry
 * @param {ReturnType<typeof detectPackageTopic>} packageTopic
 */
export function buildPackageAnswer(modelEntry, packageTopic) {
  const mfg = getManufacturerModel(modelEntry.brand, modelEntry.model);
  const profile = getImportedModelEquipmentProfile(modelEntry.modelKey);
  const record = getCleverRecordForModelKey(modelEntry.modelKey);
  const modelTitle = `${modelEntry.brand} ${modelEntry.model}`;
  const fieldLabel = packageTopic.label;

  const packages = [
    ...(mfg ? getManufacturerPackages(mfg.key) : []),
    ...(profile?.packages ?? []),
  ];

  const search = packageTopic.id;
  const matched = [...new Map(
    packages
      .filter((p) => {
        const blob = `${p.id ?? ''} ${p.name ?? ''} ${p.label ?? ''}`.toLowerCase();
        return blob.includes(search);
      })
      .map((p) => [p.id, p]),
  ).values()];

  const availabilityByTrim = matched.flatMap((pkg) => {
    const trimIds = pkg.availableTrims ?? pkg.trimIds ?? [];
    if (!trimIds.length) {
      return [{ trim: '—', label: pkg.name ?? pkg.label ?? pkg.id, status: S.AVAILABLE, packageName: pkg.name }];
    }
    return trimIds.map((trimId) => ({
      trim: trimId,
      label: 'über Paket',
      status: S.PACKAGE_REQUIRED,
      packageName: pkg.name ?? pkg.label ?? pkg.id,
    }));
  });

  const shortAnswer = matched.length
    ? `${fieldLabel} ist beim ${modelEntry.model} als Paketoption hinterlegt.`
    : `${fieldLabel} ist in den aktuellen Paketdaten noch nicht eindeutig zugeordnet.`;

  return {
    query: null,
    model: modelEntry,
    intentType: 'package',
    title: modelTitle,
    fieldLabel,
    shortAnswer,
    primaryFacts: matched.length
      ? [{ label: 'Pakete', value: matched.map((p) => p.name ?? p.label ?? p.id).join(' / ') }]
      : [],
    availabilityByTrim,
    relatedFacts: [],
    source: buildSourceLine({ record, profile }),
    confidence: matched.length ? 'high' : 'low',
    warnings: matched.length ? [] : buildWarnings({ hasData: false }),
    modelKey: modelEntry.modelKey,
    packageTopic: packageTopic.id,
  };
}

function buildUnknownAnswer(query, modelEntry, intent) {
  const suggestions = [];

  if (!modelEntry) {
    suggestions.push('Bitte Modell ergänzen, z. B. „EV4 Wärmepumpe“.');
    LEXICON_MODEL_ENTRIES.slice(0, 6).forEach((m) => suggestions.push(`${m.model} …`));
  }

  if (intent.suggestions?.length) {
    intent.suggestions.slice(0, 4).forEach((f) => suggestions.push(f.label));
  } else {
    suggestions.push('Wärmepumpe', 'Batterie', 'Reichweite', 'Head-up Display');
  }

  return {
    query,
    model: modelEntry,
    intentType: 'unknown',
    title: modelEntry ? `${modelEntry.brand} ${modelEntry.model}` : 'Clever-Lexikon',
    fieldLabel: 'Nicht eindeutig',
    shortAnswer: modelEntry
      ? 'Frage konnte nicht eindeutig zugeordnet werden.'
      : 'Modell nicht erkannt.',
    primaryFacts: [],
    availabilityByTrim: [],
    relatedFacts: [],
    source: null,
    confidence: 'low',
    warnings: [],
    suggestions,
    modelKey: modelEntry?.modelKey ?? null,
  };
}

/**
 * @param {string} query
 * @returns {{ ok: boolean, question: string, error?: string, result?: object }}
 */
export function searchCleverLexicon(query) {
  const question = query?.trim() ?? '';
  if (!question) {
    return { ok: false, question, error: 'Bitte eine Frage eingeben.' };
  }

  const parsed = parseLexiconQuery(question);
  const { model, intent } = parsed;

  if (!model) {
    if (intent.type === 'equipment' && intent.needsModel && intent.feature) {
      return {
        ok: false,
        question,
        error: 'Bitte Modell ergänzen, z. B. „EV4 Wärmepumpe“.',
        result: buildUnknownAnswer(question, null, intent),
      };
    }
    return {
      ok: false,
      question,
      error: 'Modell nicht erkannt. Bitte z. B. „EV4 Wärmepumpe“ oder „Sportage Anhängelast“ eingeben.',
      result: buildUnknownAnswer(question, null, intent),
    };
  }

  let result;

  if (intent.type === 'technical') {
    result = buildTechnicalDataAnswer(model, intent);
  } else if (intent.type === 'package') {
    result = buildPackageAnswer(model, intent.packageTopic);
  } else if (intent.type === 'equipment' && intent.feature) {
    result = buildEquipmentAnswer(model, intent.feature);
  } else {
    result = buildUnknownAnswer(question, model, intent);
    return {
      ok: false,
      question,
      error: result.shortAnswer,
      result: { ...result, query: question },
    };
  }

  result.query = question;

  return {
    ok: true,
    question,
    result: {
      ...result,
      modelTitle: result.title,
      answer: result.primaryFacts[0]?.value ?? result.shortAnswer,
      extras: [
        ...result.relatedFacts.map((f) => ({ label: f.label, value: f.value })),
      ],
    },
  };
}

export function getLexiconModelSuggestions(limit = 6) {
  return LEXICON_MODEL_ENTRIES.slice(0, limit).map((m) => m.model);
}

export function getLexiconFeatureSuggestions(limit = 6) {
  return getSearchableGlobalFeatures().slice(0, limit).map((f) => f.label);
}
