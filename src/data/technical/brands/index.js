/**
 * Marken-Registry – geprüfte technische Daten.
 * Aktuell: nur Kia. Weitere Marken später unter brands/{marke}/ anlegen.
 */
import { KIA_VERIFIED_TECHNICAL_PROFILES } from './kia/index.js';

/** @typedef {import('../verifiedTechnicalDataSchema.js').VerifiedTechnicalModelProfile} VerifiedTechnicalModelProfile */

/**
 * @type {Record<string, { label: string, profiles: VerifiedTechnicalModelProfile[] }>}
 */
export const VERIFIED_TECHNICAL_BRAND_REGISTRIES = {
  kia: { label: 'Kia', profiles: KIA_VERIFIED_TECHNICAL_PROFILES },
};

/** @type {VerifiedTechnicalModelProfile[]} */
export const ALL_VERIFIED_TECHNICAL_PROFILES = KIA_VERIFIED_TECHNICAL_PROFILES;
