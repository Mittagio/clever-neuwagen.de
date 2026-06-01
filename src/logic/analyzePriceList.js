import { buildSummaryFromChanges } from './analyzePriceListSummary.js';
import { extractFileContent } from './priceListFileReader.js';
import { parsePriceListWithAi } from './priceListAiParser.js';

const ANALYSIS_DELAY_MS = 1200;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Analysiert Hersteller-Preisliste (PDF, Excel, CSV) mit KI-Parser-Demo.
 */
export async function analyzePriceList(file, meta) {
  const content = await extractFileContent(file);
  await delay(ANALYSIS_DELAY_MS);

  const parsed = parsePriceListWithAi(
    { ...content, fileName: file.name },
    meta,
  );

  const summary = {
    ...buildSummaryFromChanges(parsed.changes),
    detectedModels: parsed.detected.models,
    detectedTrims: parsed.detected.trims?.length ?? 0,
    rangeUpdates: parsed.detected.ranges ?? 0,
  };

  return {
    changes: parsed.changes,
    summary,
    parserVersion: parsed.parserVersion,
    sourceFileName: file.name,
    fileFormat: content.format,
    kiDetected: parsed.detected,
  };
}

export { buildSummaryFromChanges } from './analyzePriceListSummary.js';
