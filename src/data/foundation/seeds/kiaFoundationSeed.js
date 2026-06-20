/**
 * Kia – vollständiger Foundation-Seed (12 Verkaufsassistent-Modelle)
 */
import { kiaSportage } from '../../models/kia/sportage.js';
import { kiaEv2 } from '../../manufacturer/kia/ev2.js';
import { kiaEv3 } from '../../manufacturer/kia/ev3.js';
import { kiaEv4 } from '../../manufacturer/kia/ev4.js';
import { kiaEv5 } from '../../manufacturer/kia/ev5.js';
import { kiaEv6 } from '../../manufacturer/kia/ev6.js';
import { kiaEv9 } from '../../manufacturer/kia/ev9.js';
import { kiaPicanto } from '../../manufacturer/kia/picanto.js';
import { kiaNiro } from '../../manufacturer/kia/niro.js';
import { kiaCeed } from '../../manufacturer/kia/ceed.js';
import { kiaStonic } from '../../manufacturer/kia/stonic.js';
import { kiaXceed } from '../../manufacturer/kia/xceed.js';
import { MANUFACTURER_MODELS } from '../../manufacturer/manufacturerRegistry.js';
import { importLegacyModelToFoundation, mergeFoundationDatabases } from '../legacyFoundationImporter.js';

const KIA_META = { manufacturerId: 'kia', manufacturerName: 'Kia' };

const LEGACY_MODELS = [
  { legacy: kiaSportage, modelId: 'sportage' },
  { legacy: kiaEv2, modelId: 'ev2' },
  { legacy: kiaEv3, modelId: 'ev3' },
  { legacy: kiaEv4, modelId: 'ev4' },
  { legacy: kiaEv5, modelId: 'ev5' },
  { legacy: kiaEv6, modelId: 'ev6' },
  { legacy: kiaEv9, modelId: 'ev9' },
  { legacy: kiaStonic, modelId: 'stonic' },
  { legacy: kiaXceed, modelId: 'xceed' },
  { legacy: kiaNiro, modelId: 'niro' },
  { legacy: kiaPicanto, modelId: 'picanto' },
  { legacy: kiaCeed, modelId: 'ceed' },
];

function modelYearIdFor(legacy, modelId) {
  const year = legacy.modelYear ?? 'unknown';
  return `${modelId}-${year}`;
}

export const KIA_MODEL_YEAR_BY_KEY = Object.fromEntries(
  LEGACY_MODELS.map(({ legacy, modelId }) => [
    modelId,
    modelYearIdFor(legacy, modelId),
  ]),
);

export const KIA_FOUNDATION_DEFAULTS = Object.fromEntries(
  Object.entries(MANUFACTURER_MODELS).map(([key, entry]) => [
    key,
    { defaultTrimId: entry.defaultTrimId, defaultEngineId: entry.defaultEngineId },
  ]),
);

export const kiaFoundationSeed = mergeFoundationDatabases(
  ...LEGACY_MODELS.map(({ legacy, modelId }) => importLegacyModelToFoundation(legacy, {
    ...KIA_META,
    modelId,
    modelYearId: modelYearIdFor(legacy, modelId),
  })),
);

export default kiaFoundationSeed;
