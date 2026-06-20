/**
 * Kia Sportage MY2027 – Foundation-Seed aus Legacy-Registry.
 */
import { kiaSportage } from '../../models/kia/sportage.js';
import { importLegacyModelToFoundation } from '../legacyFoundationImporter.js';

export const kiaSportageFoundationSeed = importLegacyModelToFoundation(kiaSportage, {
  manufacturerId: 'kia',
  manufacturerName: 'Kia',
  modelId: 'sportage',
  modelYearId: 'sportage-2027',
});

export default kiaSportageFoundationSeed;
