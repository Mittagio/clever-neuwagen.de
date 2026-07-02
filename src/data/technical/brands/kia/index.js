/**
 * Kia – geprüfte technische Stammdaten (Aggregator).
 */
import { KIA_TOWING_PROFILES } from './towingProfiles.js';

/** @type {import('../../verifiedTechnicalDataSchema.js').VerifiedTechnicalModelProfile[]} */
export const KIA_VERIFIED_TECHNICAL_PROFILES = [
  ...KIA_TOWING_PROFILES,
];
