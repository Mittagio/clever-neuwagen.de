import { getMockChangesForModel } from '../data/priceListImport.js';

const ANALYSIS_DELAY_MS = 1800;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSummaryFromChanges(changes) {
  return {
    priceChanges: changes.filter((c) => c.type === 'price').length,
    newColors: changes.filter((c) => c.type === 'color').length,
    newPackages: changes.filter((c) => c.type === 'package').length,
    wltpUpdated: changes.some((c) => c.type === 'wltp'),
  };
}

/**
 * Analysiert eine Hersteller-Preisliste (PDF).
 * Aktuell: Mock mit simulierter Laufzeit.
 * Später: PDF → KI-Parser → strukturierte Fahrzeugdaten.
 *
 * @param {File} file – Hochgeladene Preisliste
 * @param {{ brand: string, model: string, modelYear: string }} meta
 * @returns {Promise<{ changes: import('../data/priceListImport.js').PriceListChange[], summary: object }>}
 */
export async function analyzePriceList(file, meta) {
  if (!file || file.type !== 'application/pdf') {
    throw new Error('Nur PDF-Dateien werden unterstützt.');
  }

  // Platzhalter für spätere KI-Pipeline:
  // const rawText = await extractPdfText(file);
  // const parsed = await aiParser.parse(rawText, meta);
  await delay(ANALYSIS_DELAY_MS);

  const changes = getMockChangesForModel(meta.model, meta.modelYear);
  const summary = buildSummaryFromChanges(changes);

  return {
    changes,
    summary,
    parserVersion: 'mock-v1',
    sourceFileName: file.name,
  };
}

export { buildSummaryFromChanges };
