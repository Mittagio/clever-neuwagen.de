/**
 * @deprecated Nutze src/data/technical/verifiedTechnicalDataRegistry.js
 * Abwärtskompatibilität für bestehende Imports.
 */
export {
  getVerifiedTechnicalProfile,
  matchVerifiedVariants,
  parseVariantHintsFromQuery,
  formatVerifiedSourceLine,
  listTechnicalDataGapsForModel as listTechnicalDataGaps,
  VERIFIED_TECHNICAL_DATA_FLAT as KIA_VERIFIED_TECHNICAL_DATA,
} from '../technical/verifiedTechnicalDataRegistry.js';
