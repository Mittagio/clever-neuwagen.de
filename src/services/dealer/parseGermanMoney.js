/**
 * Shared de-DE money / amount parsing for Magic Offer + PDF intake.
 * Correct: 152,36 → 152.36; 6.000 → 6000; 1.290,00 → 1290
 * Never do naive comma→dot then strip all dots (that turns 152,36 into 15236).
 */

/** @typedef {{ value: number|null, ambiguous?: boolean, candidates?: number[], reason?: string }} GermanMoneyParseResult */

/**
 * Parse a German (or already-normalized) money/amount fragment to a number.
 * @param {string|number|null|undefined} raw
 * @returns {number|null}
 */
export function parseGermanMoney(raw) {
  const result = parseGermanMoneyDetailed(raw);
  return result.value;
}

/**
 * @param {string|number|null|undefined} raw
 * @returns {GermanMoneyParseResult}
 */
export function parseGermanMoneyDetailed(raw) {
  if (raw == null || raw === '') return { value: null };
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? { value: raw } : { value: null };
  }

  let s = String(raw).trim();
  if (!s) return { value: null };

  s = s
    .replace(/€/g, '')
    .replace(/\b(?:eur|euro)\b/gi, '')
    .replace(/\s/g, '')
    .replace(/[^\d.,-]/g, '');

  if (!s || s === '-' || s === '.' || s === ',') return { value: null };

  const negative = s.startsWith('-');
  if (negative) s = s.slice(1);

  let value = null;
  let ambiguous = false;
  /** @type {number[]} */
  let candidates = [];
  let reason;

  if (s.includes(',') && s.includes('.')) {
    // Classic DE: 1.290,00 or rare EN: 1,290.00
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      // 1.290,00
      value = Number(s.replace(/\./g, '').replace(',', '.'));
    } else {
      // 1,290.00
      value = Number(s.replace(/,/g, ''));
    }
  } else if (s.includes(',')) {
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3) {
      // Ambiguous: "1,290" (EN thousand) vs unlikely DE
      const asThousand = Number(parts[0] + parts[1]);
      const asDecimal = Number(`${parts[0]}.${parts[1]}`);
      candidates = [asThousand, asDecimal].filter((n) => Number.isFinite(n));
      value = asThousand;
      ambiguous = true;
      reason = 'comma_thousands_or_decimal';
    } else {
      // 152,36 or 6,5
      value = Number(s.replace(/\./g, '').replace(',', '.'));
    }
  } else if (s.includes('.')) {
    const parts = s.split('.');
    const last = parts[parts.length - 1];
    if (parts.length === 2 && last.length <= 2) {
      // 152.36 (already normalized) or 6.5
      value = Number(s);
    } else if (parts.length === 2 && last.length === 3) {
      // 6.000 → 6000; 15.236 → 15236 (or misread 152,36)
      const asThousand = Number(parts.join(''));
      const asDecimalMisread = Number(`${parts[0]}.${parts[1].slice(0, 2)}`); // 15.23 – weak
      const asCentShift = asThousand / 100; // 152.36 from 15236
      value = asThousand;
      if (asCentShift >= 50 && asCentShift <= 2500 && asThousand > 2500) {
        ambiguous = true;
        candidates = [asCentShift, asThousand];
        reason = 'dot_thousands_or_cent_shift';
      }
    } else if (parts.length > 2) {
      if (last.length <= 2) {
        value = Number(parts.slice(0, -1).join('') + '.' + last);
      } else {
        value = Number(parts.join(''));
      }
    } else {
      value = Number(s);
    }
  } else {
    value = Number(s);
  }

  if (!Number.isFinite(value)) return { value: null };
  if (negative) value = -value;
  if (ambiguous && candidates.length) {
    candidates = candidates.map((c) => (negative ? -c : c));
  }

  return {
    value,
    ...(ambiguous ? { ambiguous: true, candidates, reason } : {}),
  };
}

/**
 * Plausibility checks for commercial leasing/finance fields.
 * @param {{
 *   monthlyRate?: number|null,
 *   downPayment?: number|null,
 *   vehiclePrice?: number|null,
 *   offerType?: string|null,
 * }} fields
 * @returns {{ warnings: string[], flags: Record<string, boolean> }}
 */
export function assessCommercialPlausibility(fields = {}) {
  const warnings = [];
  const flags = {
    monthlyRateImplausible: false,
    downPaymentImplausible: false,
  };

  const rate = fields.monthlyRate != null ? Number(fields.monthlyRate) : null;
  const down = fields.downPayment != null ? Number(fields.downPayment) : null;
  const vehicle = fields.vehiclePrice != null ? Number(fields.vehiclePrice) : null;
  const isLeaseOrFinance = fields.offerType === 'leasing'
    || fields.offerType === 'financing'
    || fields.offerType === 'finance';

  if (rate != null && Number.isFinite(rate) && isLeaseOrFinance) {
    if (rate > 2500) {
      flags.monthlyRateImplausible = true;
      const maybe = rate / 100;
      warnings.push(
        maybe >= 50 && maybe <= 2500
          ? `Monatsrate ${formatEuroDe(rate)} wirkt unrealistisch – gemeint ${formatEuroDe(maybe)}?`
          : `Monatsrate ${formatEuroDe(rate)} liegt über dem üblichen Leasing-Rahmen (~50–2.500 €).`,
      );
    } else if (rate > 0 && rate < 50) {
      flags.monthlyRateImplausible = true;
      warnings.push(`Monatsrate ${formatEuroDe(rate)} liegt unter dem üblichen Leasing-Rahmen (~50–2.500 €).`);
    }
  }

  if (down != null && Number.isFinite(down) && down > 0) {
    if (vehicle != null && Number.isFinite(vehicle) && vehicle > 0 && down > vehicle * 1.5) {
      flags.downPaymentImplausible = true;
      warnings.push(
        `Anzahlung ${formatEuroDe(down)} wirkt unrealistisch gegenüber Fahrzeugpreis ${formatEuroDe(vehicle)}.`,
      );
    } else if (down >= 100000) {
      flags.downPaymentImplausible = true;
      const maybe = down / 100;
      warnings.push(
        maybe >= 500 && maybe <= 50000
          ? `Anzahlung ${formatEuroDe(down)} wirkt unrealistisch – gemeint ${formatEuroDe(maybe)}?`
          : `Anzahlung ${formatEuroDe(down)} wirkt unrealistisch hoch.`,
      );
    }
  }

  return { warnings, flags };
}

/**
 * @param {number} value
 * @returns {string}
 */
export function formatEuroDe(value) {
  if (value == null || !Number.isFinite(Number(value))) return '–';
  return `${Number(value).toLocaleString('de-DE', {
    minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : 2,
    maximumFractionDigits: 2,
  })} €`;
}
