/**
 * Screenshot-Interpret → Seller-Turn-Seed (Inbound-ähnlich, kein Auto-Persist).
 */
import { humanReadableScreenshotSource } from './extractScreenshotInquiryFacts.js';

/**
 * Baut einen Paste-ähnlichen Interpret-Seed, den interpretSellerInput / Inbound versteht.
 * @param {object} interpreted – Ergebnis von interpretComposerScreenshot
 */
export function buildScreenshotInterpretSeed(interpreted = {}) {
  const sourceLabel = interpreted.sourceLabel
    || humanReadableScreenshotSource(interpreted.sourceKind);
  const lines = [
    `${sourceLabel}:`,
    '',
  ];

  if (interpreted.customerName) {
    lines.push(`Name: ${interpreted.customerName}`);
  }
  if (interpreted.phone) {
    lines.push(`Telefon: ${interpreted.phone}`);
  }
  if (interpreted.email) {
    lines.push(`E-Mail: ${interpreted.email}`);
  }
  if (interpreted.as24OfferId) {
    lines.push(`AutoScout24-Angebotsnummer: ${interpreted.as24OfferId}`);
  }
  if (interpreted.vehicleLabel) {
    lines.push(`Fahrzeuginteresse: ${interpreted.vehicleLabel}`);
  }

  const wishParts = [];
  if (interpreted.paymentType === 'leasing') wishParts.push('Leasing');
  if (interpreted.termMonths != null) wishParts.push(`${interpreted.termMonths} Monate`);
  if (interpreted.annualMileage != null) {
    wishParts.push(`${interpreted.annualMileage} km`);
  }
  if (wishParts.length) {
    lines.push(`Kundenwunsch: ${wishParts.join(', ')}`);
  }

  for (const q of interpreted.openQuestions || []) {
    lines.push(`Offene Frage (Verkäufer): ${q}`);
  }

  const transcript = String(interpreted.transcript || '').trim();
  if (transcript) {
    lines.push('', '--- Screenshot-Text ---', transcript.slice(0, 2500));
  }

  return lines.filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n').trim();
}

/**
 * @param {{
 *   interpreted?: object,
 *   file?: { name?: string, type?: string },
 *   fileName?: string,
 * }} params
 */
export function prepareComposerScreenshotTurnInput(params = {}) {
  const interpreted = params.interpreted || {};
  const fileName = params.fileName
    || interpreted.fileName
    || params.file?.name
    || 'screenshot.jpg';
  const ok = Boolean(interpreted.ok) && !interpreted.softAttach;
  const sourceKind = interpreted.sourceKind || 'screenshot';
  const sourceLabel = interpreted.sourceLabel
    || humanReadableScreenshotSource(sourceKind);

  const interpretSeed = ok ? buildScreenshotInterpretSeed(interpreted) : '';
  const draftSeed = `Foto angehängt: ${fileName}`;

  const attachment = {
    kind: 'screenshot',
    mimeType: params.file?.type || interpreted.mimeType || 'image/jpeg',
    fileName,
    sourceType: sourceKind,
    extractionMethod: interpreted.method || null,
    detailLabel: sourceLabel,
    extractedText: ok ? String(interpreted.transcript || '').slice(0, 4000) : '',
  };

  if (!ok) {
    return {
      kind: 'screenshot',
      ok: false,
      softAttach: true,
      needsManualDescribe: true,
      interpretSeed: '',
      draftSeed,
      attachment,
      workingContextLabel: fileName,
      feedbackOk: null,
      feedbackManual: interpreted.warning
        || 'Screenshot konnte nicht gelesen werden – bitte kurz beschreiben und absenden.',
      sourceLabel,
      facts: [],
      diagnostics: interpreted.diagnostics || null,
    };
  }

  return {
    kind: 'screenshot',
    ok: true,
    softAttach: false,
    needsManualDescribe: false,
    interpretSeed,
    draftSeed: interpretSeed,
    attachment,
    workingContextLabel: sourceLabel,
    workingContextDetailLabel: fileName,
    feedbackOk: `${sourceLabel} – bitte Angaben prüfen`,
    feedbackManual: null,
    sourceLabel,
    facts: interpreted.facts || [],
    diagnostics: interpreted.diagnostics || null,
  };
}
