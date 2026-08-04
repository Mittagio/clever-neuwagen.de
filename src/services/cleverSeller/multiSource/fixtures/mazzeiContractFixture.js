/**
 * Mazzei / Vertrag_Bank – testbare Contract-Fixture ohne echtes Kunden-PDF.
 *
 * Strategie:
 * - Primär: Attachment mit `fileName` + `extractedText` (wie Smoke/OpenAI-Golden).
 * - Optional: minimale Dummy-PDF unter tests/fixtures/ für UI-Dropzone (kein OCR-Text).
 * - IBAN/Ausweis nur in REDACT_TEST_EXTRACT (Redact-Golden); UI/Smoke nutzt sanitized Extract.
 */

export const MAZZEI_CONTRACT_FILE_NAME = 'Vertrag_Bank_100000518962.pdf';

/** Redacted Extract für Smoke, UI-Abnahme und Review-Golden (keine IBAN). */
export const MAZZEI_CONTRACT_EXTRACTED_TEXT = `
Finanzierungsvertrag / 3-Wege-Finanzierung
Kunde: Sandro Mazzei
Fahrzeug: Kia Picanto
Vertragsbeginn: 30.11.2021
Vertragsende: 01.11.2025
Laufzeit 48 Monate
Gesamtkilometer 40.000 km
Monatliche Rate 83,07 €
Schlussrate 7.796,96 €
Mehrkilometer 0,05 €
Minderkilometer 0,03 €
Kinder: 1
`.trim();

/**
 * Extract inkl. sensibler Muster – nur für Redact-/Minimize-Tests.
 * Nicht in Browser-Demos oder Smoke-Logs verwenden.
 */
export const MAZZEI_CONTRACT_REDACT_TEST_EXTRACT = `
${MAZZEI_CONTRACT_EXTRACTED_TEXT}
IBAN DE89 3704 0044 0532 0130 00
Ausweisnr. L01X00T47
`.trim();

export const MAZZEI_SELLER_DUMP = [
  'Mazzei Sandro',
  'EV4 Air weiß mit AHK',
  '48 10.000 km',
  '2 Kinder Haus',
  'GW Kia Picanto',
].join('\n');

/**
 * Composer-/Smoke-Attachment wie Live-Pfad (ohne echte PDF-Bytes).
 * @param {object} [overrides]
 */
export function buildMazzeiContractAttachment(overrides = {}) {
  return {
    id: 'att-contract-1',
    kind: 'contract_pdf',
    sourceType: 'contract_pdf',
    fileName: MAZZEI_CONTRACT_FILE_NAME,
    mimeType: 'application/pdf',
    extractedText: MAZZEI_CONTRACT_EXTRACTED_TEXT,
    ...overrides,
  };
}

/**
 * Relativer Pfad zur optionalen Dummy-PDF (nur Dateiname/Dropzone; Text kommt aus extractedText).
 */
export const MAZZEI_CONTRACT_DUMMY_PDF_RELATIVE = 'tests/fixtures/Vertrag_Bank_100000518962.pdf';
