/**
 * Anhängelast/Stützlast aus Preislisten-PDF-Text extrahieren.
 * Wiederverwendbar für Kia, BYD, Suzuki, KGM (gleiche Tabellenstruktur).
 */

/**
 * @param {string} raw
 * @returns {number | null}
 */
export function parseGermanKgNumber(raw) {
  const token = String(raw ?? '').trim();
  if (!token || /keine/i.test(token)) return null;

  // OCR-Fix: "75011" → 750
  if (/^\d{4,5}$/.test(token) && token.endsWith('11')) {
    const fixed = parseInt(token.slice(0, -2), 10);
    if (fixed > 0 && fixed < 5000) return fixed;
  }

  const european = token.match(/^(\d{1,3}(?:\.\d{3})+)$/);
  if (european) {
    return parseInt(european[1].replace(/\./g, ''), 10);
  }

  const mixed = token.replace(/[^\d.]/g, '');
  if (!mixed) return null;

  if (/^\d{1,3}\.\d{3}$/.test(mixed)) {
    return parseInt(mixed.replace('.', ''), 10);
  }

  const digits = mixed.replace(/\./g, '');
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n) || n <= 0 || n > 10000) return null;
  return n;
}

/**
 * @param {string} line
 * @returns {number[]}
 */
export function parseKgListFromLine(line) {
  const text = String(line ?? '');
  const parts = text.split(/[\t\s]+/).filter(Boolean);
  const values = [];
  for (const part of parts) {
    if (/gebremst|ungebremst|anhängelast|anhänger|zulässige|stützlast|dachlast/i.test(part)) continue;
    const kg = parseGermanKgNumber(part);
    if (kg != null) values.push(kg);
  }
  return values;
}

/**
 * @param {string} text
 * @returns {{ brakedKg: number[], unbrakedKg: number[], noseWeightKg: number | null, roofLoadKg: number | null, notPermitted: boolean }}
 */
export function extractTowingFromPdfText(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  const result = {
    brakedKg: [],
    unbrakedKg: [],
    noseWeightKg: null,
    roofLoadKg: null,
    notPermitted: false,
  };

  for (const line of lines) {
    const flat = line.replace(/\t/g, ' ').trim();

    if (/anhängelast.*keine|keine.*anhängelast/i.test(flat)) {
      result.notPermitted = true;
    }

    if (/^ungebremst\b/i.test(flat) || /anhängelast\s*\(ungebremst\)/i.test(flat)) {
      const rest = flat
        .replace(/^ungebremst[:\s]*/i, '')
        .replace(/.*\(ungebremst\)[^)]*\)\s*/i, '');
      const vals = parseKgListFromLine(rest);
      if (vals.length) result.unbrakedKg = vals;
      continue;
    }

    if (/^gebremst\b/i.test(flat) || /anhängelast\s*\(gebremst\)/i.test(flat)) {
      const rest = flat
        .replace(/^gebremst[:\s]*/i, '')
        .replace(/.*\(gebremst\)\s*/i, '');
      const vals = parseKgListFromLine(rest);
      if (vals.length) result.brakedKg = vals;
      continue;
    }

    if (/stützlast/i.test(flat) && !/vertikal/i.test(flat)) {
      const vals = parseKgListFromLine(flat.replace(/.*stützlast[:\s]*/i, ''));
      if (vals.length) result.noseWeightKg = vals[0];
      continue;
    }

    if (/dachlast/i.test(flat)) {
      const vals = parseKgListFromLine(flat.replace(/.*dachlast[:\s]*/i, ''));
      if (vals.length) result.roofLoadKg = vals[0];
    }
  }

  return result;
}

/**
 * @param {{ brakedKg: number[], unbrakedKg: number[], noseWeightKg: number | null, roofLoadKg: number | null, notPermitted: boolean }} extracted
 * @param {number} [index]
 */
export function buildTowingVariantFromExtract(extracted, index = 0) {
  if (extracted.notPermitted && !extracted.brakedKg.length) {
    return { brakedKg: 0, unbrakedKg: 0, noseWeightKg: null, roofLoadKg: null, permitted: false };
  }
  const braked = extracted.brakedKg[index] ?? extracted.brakedKg[0] ?? null;
  const unbraked = extracted.unbrakedKg[index] ?? extracted.unbrakedKg[0] ?? null;
  return {
    brakedKg: braked,
    unbrakedKg: unbraked,
    noseWeightKg: extracted.noseWeightKg,
    roofLoadKg: extracted.roofLoadKg,
    permitted: braked != null && braked > 0,
  };
}
