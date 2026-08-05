/**
 * Kompakte Fahrzeuganzeige ohne Duplikate:
 * „Kia EV2 Air · Rot“ statt „Kia EV2 Air / Kia EV2 · Rot · EV2 Air“.
 */

const TRIM_RE = /\b(gt-?\s*line|air|earth|spirit|vision|core|drivewise|x-?\s*line(?:\s*\d+)?)\b/i;

/**
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function normalizeTrimToken(raw) {
  if (raw == null) return null;
  const s = String(raw).replace(/\s+/g, ' ').trim();
  if (!s) return null;
  if (/^gt-?\s*line$/i.test(s)) return 'GT-Line';
  if (/^x-?\s*line(?:\s*(\d+))?$/i.test(s)) {
    const m = s.match(/^x-?\s*line(?:\s*(\d+))?$/i);
    return m?.[1] ? `X-Line ${m[1]}` : 'X-Line';
  }
  if (/^cor$/i.test(s)) return 'Core';
  return s.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bGt-Line\b/g, 'GT-Line');
}

/**
 * @param {string|null|undefined} raw
 * @returns {{ make: string|null, model: string|null, trim: string|null, color: string|null }}
 */
export function parseVehicleLabelParts(raw = '') {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text) return { make: null, model: null, trim: null, color: null };

  const chunks = text.split(/\s*[·|/]\s*/).map((c) => c.trim()).filter(Boolean);
  let make = null;
  let model = null;
  let trim = null;
  let color = null;

  for (const chunk of chunks) {
    const lower = chunk.toLowerCase();
    if (/^(rot|schwarz|weiß|weiss|blau|grau|silber|grün|gruen|orange|beige|bronze)$/i.test(chunk)) {
      color = color || chunk.replace(/\b\w/, (c) => c.toUpperCase());
      continue;
    }
    if (/^kia$/i.test(chunk)) {
      make = 'Kia';
      continue;
    }
    const kiaModel = chunk.match(/\b(?:kia\s+)?(ev\s?[2-9]|picanto|sportage|xceed|ceed|niro|sorento|stonic|rio|seltos|k4)\b/i);
    if (kiaModel) {
      make = make || 'Kia';
      const modelRaw = kiaModel[1].replace(/\s+/g, '');
      model = /^ev\d$/i.test(modelRaw)
        ? modelRaw.toUpperCase()
        : modelRaw.charAt(0).toUpperCase() + modelRaw.slice(1).toLowerCase();
      const after = chunk.slice(kiaModel.index + kiaModel[0].length);
      const trimInChunk = after.match(TRIM_RE);
      if (trimInChunk) trim = normalizeTrimToken(trimInChunk[1]);
      continue;
    }
    if (TRIM_RE.test(chunk) && !/\bev\s?[2-9]\b/i.test(chunk)) {
      trim = normalizeTrimToken(chunk.match(TRIM_RE)?.[1] || chunk);
      continue;
    }
    if (!model && !/leasing|finanz|monat|km|angebot/i.test(lower)) {
      model = chunk.replace(/^kia\s+/i, '');
    }
  }

  if (!trim) {
    const trimMatch = text.match(TRIM_RE);
    if (trimMatch) trim = normalizeTrimToken(trimMatch[1]);
  }
  if (!color) {
    const colorMatch = text.match(/\b(rot|schwarz|weiß|weiss|blau|grau|silber|grün|gruen|orange|beige|bronze)\b/i);
    if (colorMatch) {
      color = colorMatch[1].replace(/\b\w/, (c) => c.toUpperCase()).replace(/^Weiss$/i, 'Weiß');
    }
  }

  return { make, model, trim, color };
}

/**
 * @param {{
 *   make?: string|null,
 *   model?: string|null,
 *   trim?: string|null,
 *   color?: string|null,
 *   label?: string|null,
 * }|string|null} input
 * @returns {string|null}
 */
export function normalizeVehicleDisplayLabel(input) {
  if (input == null) return null;
  if (typeof input === 'string') {
    const parts = parseVehicleLabelParts(input);
    return assembleVehicleLabel(parts) || String(input).replace(/\s+/g, ' ').trim() || null;
  }
  const fromLabel = input.label ? parseVehicleLabelParts(input.label) : {
    make: null, model: null, trim: null, color: null,
  };
  return assembleVehicleLabel({
    make: input.make || fromLabel.make || 'Kia',
    model: input.model || fromLabel.model,
    trim: normalizeTrimToken(input.trim) || fromLabel.trim,
    color: input.color || fromLabel.color,
  });
}

function assembleVehicleLabel({ make, model, trim, color }) {
  if (!model && !trim) return null;
  const head = [make || 'Kia', model, trim].filter(Boolean).join(' ');
  if (color) return `${head} · ${color}`;
  return head;
}
