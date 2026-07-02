/**
 * BYD – geprüfte technische Stammdaten.
 * PDFs: scripts/pdf-extract/byd/*.txt (noch anzulegen)
 * modelKey: byd-{modell}  z. B. byd-atto-3, byd-dolphin, byd-seal
 */
import { defineModelProfile, TECHNICAL_CONFIDENCE } from '../../verifiedTechnicalDataSchema.js';

/** @type {import('../../verifiedTechnicalDataSchema.js').VerifiedTechnicalModelProfile[]} */
export const BYD_VERIFIED_TECHNICAL_PROFILES = [
  // defineModelProfile({
  //   brandKey: 'byd',
  //   brand: 'BYD',
  //   modelKey: 'byd-atto-3',
  //   modelLabel: 'BYD Atto 3',
  //   sourceDocument: 'BYD Atto 3 Preisliste Deutschland',
  //   sourceFile: 'scripts/pdf-extract/byd/BYD-Germany-Atto-3-Preisliste.txt',
  //   confidence: TECHNICAL_CONFIDENCE.VERIFIED,
  //   variants: [
  //     { trimLabel: 'Comfort', powerPs: 204, driveType: 'FWD', towing: tow(750, 750, 75) },
  //   ],
  // }),
];

export const BYD_MODELS_PENDING_PDF = [
  { modelKey: 'byd-atto-3', model: 'Atto 3' },
  { modelKey: 'byd-dolphin', model: 'Dolphin' },
  { modelKey: 'byd-seal', model: 'Seal' },
  { modelKey: 'byd-tang', model: 'Tang' },
];
