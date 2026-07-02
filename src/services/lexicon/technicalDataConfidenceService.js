/**
 * Source-Confidence für technische Lexikon-Werte.
 * Harte Zahlen nur bei confidence === 'verified'.
 */
import { getCleverRecordForModelKey } from '../admin/vehicleStammdatenOverrideService.js';
import { getKiaTechnicalSpec } from '../../data/kia/kiaTechnicalSpecs.js';
import { getPricelistBatteryKwh } from '../../data/kia/pricelistBatteryLookup.js';
import {
  formatVerifiedSourceLine,
  getVerifiedTechnicalProfile,
  listTechnicalDataGapsForModel,
  matchVerifiedVariants,
  parseVariantHintsFromQuery,
} from '../../data/technical/verifiedTechnicalDataRegistry.js';

/** @typedef {'manufacturer_price_list' | 'manufacturer_data_sheet' | 'manual_verified' | 'equipment_import' | 'technicalData' | 'openai_general' | 'fallback_template'} TechnicalSourceType */

/** @typedef {'verified' | 'partially_verified' | 'unverified' | 'needs_review'} TechnicalConfidence */

/**
 * @typedef {object} TechnicalResolution
 * @property {boolean} ok
 * @property {TechnicalConfidence} confidence
 * @property {TechnicalSourceType | null} sourceType
 * @property {string | null} sourceLine
 * @property {string | null} statusLabel
 * @property {boolean} needsReview
 * @property {boolean} showHardNumber
 * @property {string | null} primaryValue
 * @property {string} shortAnswer
 * @property {Array<{ trim: string, label: string, value?: string }>} availabilityByTrim
 * @property {string[]} warnings
 * @property {string[]} reviewHints
 * @property {object} [meta]
 */

function formatKg(kg) {
  return `${Number(kg).toLocaleString('de-DE')} kg`;
}

function buildNeedsReview({
  shortAnswer,
  reviewHints = [],
  warnings = [],
  sourceType = 'fallback_template',
  meta = {},
}) {
  return {
    ok: false,
    confidence: 'needs_review',
    sourceType,
    sourceLine: null,
    statusLabel: 'Prüfung nötig',
    needsReview: true,
    showHardNumber: false,
    primaryValue: null,
    shortAnswer,
    availabilityByTrim: [],
    warnings,
    reviewHints,
    meta,
  };
}

function buildVerified({
  primaryValue,
  shortAnswer,
  sourceLine,
  sourceType = 'manufacturer_price_list',
  availabilityByTrim = [],
  warnings = [],
  meta = {},
}) {
  return {
    ok: true,
    confidence: 'verified',
    sourceType,
    sourceLine,
    statusLabel: 'Geprüft',
    needsReview: false,
    showHardNumber: Boolean(primaryValue),
    primaryValue,
    shortAnswer,
    availabilityByTrim,
    warnings,
    reviewHints: [],
    meta,
  };
}

/**
 * @param {string} modelKey
 * @param {string} query
 * @param {string} [brandKey]
 */
function resolveTowing(modelKey, query, brandKey = 'kia') {
  const hints = parseVariantHintsFromQuery(query);
  const { matched, profile, powerPsMismatch } = matchVerifiedVariants(modelKey, hints, brandKey);

  if (powerPsMismatch && profile) {
    const knownPs = [...new Set(profile.variants.map((v) => v.powerPs).filter(Boolean))];
    const knownKw = [...new Set(profile.variants.map((v) => v.powerKw).filter(Boolean))];
    return buildNeedsReview({
      shortAnswer: `Für diese Motorisierung liegt kein geprüfter Wert vor (${hints.powerPs} PS beim ${profile.modelLabel.replace('Kia ', '')} nicht hinterlegt).`,
      reviewHints: [
        knownPs.length
          ? `Geprüfte PS-Varianten: ${knownPs.join(', ')} PS`
          : 'Bitte Motorisierung in der Preisliste prüfen.',
        knownKw.length ? `Alternativ nach kW fragen, z. B. ${knownKw.join(' oder ')} kW.` : null,
        'Preislisten-Import oder Stammdaten ergänzen.',
      ].filter(Boolean),
      meta: { topic: 'towing', powerPsMismatch: true, requestedPs: hints.powerPs },
    });
  }

  if (!profile || matched.length === 0) {
    const record = getCleverRecordForModelKey(modelKey);
    if (record?.towing?.brakedKg != null) {
      return buildNeedsReview({
        shortAnswer: 'Für diese Version liegt Clever aktuell kein geprüfter Wert vor. Bitte Datenquelle ergänzen oder Preislisten-Import prüfen.',
        reviewHints: [
          `Stammdaten enthalten ${formatKg(record.towing.brakedKg)} (ungeprüft, nicht anzeigen).`,
          'Quelle: Clever-Stammdaten ohne Preislisten-Verifikation',
        ],
        sourceType: 'technicalData',
        meta: { topic: 'towing', unverifiedRecordKg: record.towing.brakedKg },
      });
    }
    return buildNeedsReview({
      shortAnswer: 'Für diese Version liegt Clever aktuell kein geprüfter Wert vor. Bitte Datenquelle ergänzen oder Preislisten-Import prüfen.',
      reviewHints: ['Anhängelast in Preisliste oder Stammdaten hinterlegen.'],
      meta: { topic: 'towing' },
    });
  }

  if (matched.length === 1) {
    const v = matched[0];
    if (v.towing?.permitted === false) {
      return buildVerified({
        primaryValue: 'Nicht zulässig',
        shortAnswer: 'Laut Kia-Preisliste ist keine Anhängelast zulässig.',
        sourceLine: formatVerifiedSourceLine(profile),
        meta: { topic: 'towing', notPermitted: true },
      });
    }
    const kg = v.towing?.brakedKg;
    if (kg == null) {
      return buildNeedsReview({
        shortAnswer: 'Anhängelast in der geprüften Quelle nicht gefunden.',
        meta: { topic: 'towing' },
      });
    }
    const variantHint = v.trimLabel ? ` (${v.trimLabel})` : '';
    return buildVerified({
      primaryValue: `${formatKg(kg)} (gebremst)`,
      shortAnswer: `Anhängelast gebremst${variantHint} – geprüft nach Kia-Preisliste Deutschland.`,
      sourceLine: formatVerifiedSourceLine(profile),
      availabilityByTrim: v.towing?.noseWeightKg
        ? [{ trim: 'Stützlast', label: `${formatKg(v.towing.noseWeightKg)}` }]
        : [],
      meta: { topic: 'towing', variant: v },
    });
  }

  const rows = matched
    .filter((v) => v.towing?.brakedKg != null)
    .map((v) => ({
      trim: v.trimLabel ?? v.driveType ?? 'Variante',
      label: `${formatKg(v.towing.brakedKg)} gebremst`,
      value: v.towing.noseWeightKg ? `Stützlast ${formatKg(v.towing.noseWeightKg)}` : undefined,
    }));

  if (!rows.length) {
    return buildNeedsReview({
      shortAnswer: 'Anhängelast je Motorisierung in der Preisliste nicht eindeutig.',
      meta: { topic: 'towing' },
    });
  }

  if (hints.powerPs == null && hints.driveType == null && rows.length > 1) {
    return {
      ok: true,
      confidence: 'verified',
      sourceType: 'manufacturer_price_list',
      sourceLine: formatVerifiedSourceLine(profile),
      statusLabel: 'Geprüft',
      needsReview: false,
      showHardNumber: false,
      primaryValue: null,
      shortAnswer: 'Anhängelast je Motorisierung – geprüfte Werte aus der Kia-Preisliste.',
      availabilityByTrim: rows,
      warnings: ['Bitte Motorisierung für die Kundenberatung konkretisieren.'],
      reviewHints: [],
      meta: { topic: 'towing', multiVariant: true },
    };
  }

  const first = matched.find((v) => v.towing?.brakedKg != null);
  return buildVerified({
    primaryValue: first ? `${formatKg(first.towing.brakedKg)} (gebremst)` : null,
    shortAnswer: 'Anhängelast gebremst – geprüft nach Kia-Preisliste.',
    sourceLine: formatVerifiedSourceLine(profile),
    availabilityByTrim: rows.length > 1 ? rows : [],
    meta: { topic: 'towing' },
  });
}

/**
 * @param {string} modelKey
 */
function resolveBattery(modelKey) {
  const fromList = getPricelistBatteryKwh(modelKey);
  if (fromList?.batteryOptionsKwh?.length) {
    const value = fromList.batteryOptionsKwh.length > 1
      ? `${fromList.batteryOptionsKwh.map((k) => `${k} kWh`).join(' / ')}\nje nach Variante`
      : `${fromList.batteryOptionsKwh[0]} kWh`;
    return buildVerified({
      primaryValue: value,
      shortAnswer: 'Batteriekapazität aus Kia-Preisliste Deutschland.',
      sourceLine: 'Quelle: Kia Preisliste Deutschland · Batteriedaten',
      sourceType: 'manufacturer_price_list',
      meta: { topic: 'battery' },
    });
  }

  const record = getCleverRecordForModelKey(modelKey);
  const e = record?.electric;
  if (e?.batteryNetKwh || e?.batteryGrossKwh || e?.batteryOptionsKwh?.length) {
    return buildNeedsReview({
      shortAnswer: 'Batteriedaten in Clever-Stammdaten vorhanden, aber nicht preislisten-verifiziert.',
      reviewHints: ['Preislisten-Import für Batteriekapazität prüfen.'],
      sourceType: 'technicalData',
      meta: { topic: 'battery' },
    });
  }

  return buildNeedsReview({
    shortAnswer: 'Batteriekapazität in Clever noch nicht geprüft hinterlegt.',
    reviewHints: ['Preislisten-Import oder Stammdaten ergänzen.'],
    meta: { topic: 'battery' },
  });
}

/**
 * @param {string} modelKey
 * @param {string} topicId
 */
function resolveDimensionTopic(modelKey, topicId) {
  const record = getCleverRecordForModelKey(modelKey);
  const spec = getKiaTechnicalSpec(modelKey);
  const d = record?.dimensions ?? {};
  const map = {
    length: { mm: d.lengthMm ?? spec?.lengthMm, label: 'Länge' },
    width: { mm: d.widthMm ?? spec?.widthMm, label: 'Breite' },
    height: { mm: d.heightMm ?? spec?.heightMm, label: 'Höhe' },
    wheelbase: { mm: d.wheelbaseMm ?? spec?.wheelbaseMm, label: 'Radstand' },
    trunk: { mm: null, liters: record?.family?.trunkL ?? spec?.trunkL, label: 'Kofferraum' },
    range: { km: record?.electric?.wltpRangeKm ?? spec?.electricRangeKm, label: 'Reichweite' },
  };
  const entry = map[topicId];
  if (!entry) {
    return buildNeedsReview({ shortAnswer: 'Technische Angabe nicht gefunden.', meta: { topic: topicId } });
  }

  let primaryValue = null;
  if (entry.liters != null) {
    primaryValue = `${entry.liters.toLocaleString('de-DE')} Liter`;
  } else if (entry.km != null) {
    primaryValue = `${entry.km} km (WLTP)`;
  } else if (entry.mm != null) {
    primaryValue = `${(entry.mm / 1000).toFixed(2).replace('.', ',')} m`;
  }

  if (!primaryValue) {
    return buildNeedsReview({
      shortAnswer: `${entry.label} in Clever noch nicht geprüft hinterlegt.`,
      reviewHints: ['Preisliste oder Stammdaten ergänzen.'],
      meta: { topic: topicId },
    });
  }

  const hasPricelistProfile = Boolean(getVerifiedTechnicalProfile(modelKey));
  const confidence = hasPricelistProfile ? 'partially_verified' : 'partially_verified';
  return {
    ok: true,
    confidence,
    sourceType: 'manufacturer_data_sheet',
    sourceLine: hasPricelistProfile
      ? 'Quelle: Kia Stammdaten / Preisliste (Maße)'
      : 'Quelle: Kia Stammdaten (nicht varianten-geprüft)',
    statusLabel: confidence === 'verified' ? 'Geprüft' : 'Teilweise geprüft',
    needsReview: false,
    showHardNumber: true,
    primaryValue,
    shortAnswer: `${entry.label} nach Herstellerangabe – vor Angebot final prüfen.`,
    availabilityByTrim: [],
    warnings: confidence !== 'verified' ? ['Variantenabhängig – vor Angebot final prüfen.'] : [],
    reviewHints: [],
    meta: { topic: topicId },
  };
}

/**
 * @param {string} modelKey
 * @param {string} query
 */
function resolveCharging(modelKey) {
  const record = getCleverRecordForModelKey(modelKey);
  const dc = record?.electric?.dcKw;
  if (dc != null) {
    return buildVerified({
      primaryValue: `bis ${dc} kW (DC-Schnellladung)`,
      shortAnswer: 'DC-Ladeleistung aus geprüften Stammdaten.',
      sourceLine: 'Quelle: Clever-Stammdaten (Trim-Override)',
      sourceType: 'manual_verified',
      meta: { topic: 'charging' },
    });
  }

  return buildNeedsReview({
    shortAnswer: 'Ladeleistung in Clever noch nicht geprüft hinterlegt.',
    reviewHints: ['DC-kW aus Preisliste oder Stammdaten ergänzen.'],
    meta: { topic: 'charging' },
  });
}

/**
 * @param {string} modelKey
 */
function resolvePowertrain(modelKey) {
  const record = getCleverRecordForModelKey(modelKey);
  const pt = record?.basis?.powertrain;
  if (!pt) {
    return buildNeedsReview({
      shortAnswer: 'Antriebsart nicht hinterlegt.',
      meta: { topic: 'powertrain' },
    });
  }
  const label = String(pt).replace('elektro', 'Elektro').replace('plugin-hybrid', 'Plug-in-Hybrid');
  return {
    ok: true,
    confidence: 'partially_verified',
    sourceType: 'technicalData',
    sourceLine: 'Quelle: Clever-Stammdaten',
    statusLabel: 'Teilweise geprüft',
    needsReview: false,
    showHardNumber: true,
    primaryValue: label,
    shortAnswer: 'Antriebsart nach Modelllinie.',
    availabilityByTrim: [],
    warnings: [],
    reviewHints: [],
    meta: { topic: 'powertrain' },
  };
}

/**
 * @param {object} params
 * @param {string} params.modelKey
 * @param {string} params.topicId
 * @param {string} [params.query]
 * @param {string} [params.brandKey]
 * @returns {TechnicalResolution}
 */
export function resolveTechnicalAttribute({ modelKey, topicId, query = '', brandKey = 'kia' }) {
  switch (topicId) {
    case 'towing':
      return resolveTowing(modelKey, query, brandKey);
    case 'battery':
      return resolveBattery(modelKey);
    case 'charging':
      return resolveCharging(modelKey);
    case 'powertrain':
      return resolvePowertrain(modelKey);
    case 'range':
      return resolveDimensionTopic(modelKey, 'range');
    case 'trunk':
      return resolveDimensionTopic(modelKey, 'trunk');
    case 'length':
    case 'width':
    case 'height':
    case 'wheelbase':
      return resolveDimensionTopic(modelKey, topicId);
    default:
      return buildNeedsReview({
        shortAnswer: 'Technische Angabe nicht gefunden.',
        meta: { topic: topicId },
      });
  }
}

/**
 * Datenquellen-Dokumentation (Lexikon).
 * @returns {Record<string, string>}
 */
export function getTechnicalDataSourceMap() {
  return {
    towing: 'verifiedTechnicalDataRegistry (Preisliste je Marke) → manual_verified → Clever Records (Hinweis)',
    noseWeight: 'verifiedTechnicalDataRegistry (Preisliste)',
    battery: 'pricelist-imports → pricelistBatteryLookup',
    range: 'Clever Records / kiaTechnicalSpecs (teilweise geprüft)',
    trunk: 'Clever Records / kiaTechnicalSpecs (teilweise geprüft)',
    charging: 'Trim-Overrides mit dcKw / Preisliste',
    equipment: 'equipmentImport JSON → modelEquipmentData → globalFeatureCatalog',
    packages: 'manufacturerRegistry / equipmentImport',
    brands: 'kia (src/data/technical/brands/kia/)',
  };
}

/**
 * @param {string} modelKey
 * @param {string} [brandKey]
 */
export function listTechnicalDataGaps(modelKey, brandKey = 'kia') {
  return listTechnicalDataGapsForModel(modelKey, brandKey);
}
