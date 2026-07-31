/**
 * Slice 16: Sensible OCR-/Scan-Passagen vor Intake minimieren (kein Modellaufruf).
 * Entfernt typische Geheimnisse; erfindet keine Vertragswerte.
 */

const IBAN_RE = /\b[A-Z]{2}\d{2}(?:[ ]?\d{4}){3,8}\b/gi;
const AUSWEIS_RE = /\b(?:Personalausweis|Reisepass|Ausweisnr\.?|Ausweis-?Nr\.?)\s*[:.]?\s*[A-Z0-9]{6,}/gi;
const SCHUFA_RE = /\b(?:SCHUFA|Bonität|Score)\b[^\n]{0,80}/gi;
const GEHALT_RE = /\b(?:Gehalt|Nettoeinkommen|Bruttogehalt)\s*[:.]?\s*\d[\d.\s]{2,}\s*(?:€|EUR|euro)?\b/gi;

/**
 * @param {string} [text]
 * @returns {{ text: string, redacted: string[] }}
 */
export function minimizeSensitiveOcrText(text = '') {
  const redacted = [];
  let next = String(text || '');

  const apply = (re, label) => {
    if (!re.test(next)) return;
    re.lastIndex = 0;
    next = next.replace(re, () => {
      redacted.push(label);
      return `[${label} entfernt]`;
    });
    re.lastIndex = 0;
  };

  apply(IBAN_RE, 'IBAN');
  apply(AUSWEIS_RE, 'Ausweis');
  apply(SCHUFA_RE, 'Bonität');
  apply(GEHALT_RE, 'Gehalt');

  return {
    text: next.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(),
    redacted: [...new Set(redacted)],
  };
}
