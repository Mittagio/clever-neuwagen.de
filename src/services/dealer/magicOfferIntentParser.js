/**
 * Natural-language Intent für Clever Magic Offer.
 * ERKENNEN ≠ ERFINDEN – fehlende Werte bleiben null.
 */
import { parseGermanMoney } from './parseGermanMoney.js';

function normalize(text = '') {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/€/g, ' euro ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string|null|undefined} raw
 * @returns {number|null}
 */
function parseEuroAmount(raw) {
  return parseGermanMoney(raw);
}

/**
 * @param {string|null|undefined} raw
 * @returns {number|null}
 */
function parseDeNumber(raw) {
  return parseGermanMoney(raw);
}

/** German money fragment: 1.290,00 | 6.000 | 152,36 | 329 (longest-first) */
const MONEY_FRAG = '(\\d{1,3}(?:\\.\\d{3})+,\\d{1,2}|\\d{1,3}(?:\\.\\d{3})+|\\d+,\\d{1,2}|\\d+)';

/**
 * @param {string} text
 * @returns {object} MagicOfferIntent
 */
export function parseMagicOfferIntent(text = '') {
  const raw = String(text ?? '').trim();
  const blob = normalize(raw);

  const packageKeys = [];
  for (const match of blob.matchAll(/\bp\s*([1-9]\d?)\b/gi)) {
    const code = `P${match[1]}`;
    if (!packageKeys.includes(code)) packageKeys.push(code);
  }

  let discountPercent = null;
  let discountAmount = null;
  // Zinsen/Steuern nicht als Rabatt-% lesen
  const interestOrTaxPct = blob.match(
    /(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:%|prozent)\s*(?:effektiv|p\.?\s*a\.?|jahreszins|mwst|ust|mehrwert)/i,
  ) || blob.match(
    /(?:effektiv(?:er)?\s*(?:jahres)?zins|sollzins|mwst|ust)\s*(?:von\s*)?(\d{1,2}(?:[.,]\d{1,2})?)/i,
  );

  const rabattPctMatch = blob.match(
    /(?:rabatt|nachlass)\s*(?:von\s*)?(\d{1,3}(?:[.,]\d+)?)\s*(?:%|prozent)/i,
  ) || blob.match(
    /(\d{1,3}(?:[.,]\d+)?)\s*(?:%|prozent)\s*(?:rabatt|nachlass)/i,
  );
  const genericPctMatch = !rabattPctMatch
    ? blob.match(/(\d{1,3}(?:[.,]\d+)?)\s*(?:%|prozent)/i)
    : null;
  const pctMatch = rabattPctMatch || genericPctMatch;
  if (pctMatch) {
    const rawPct = pctMatch[0] || '';
    const isInterestOrTax = Boolean(interestOrTaxPct)
      && String(interestOrTaxPct[1]) === String(pctMatch[1]);
    const nearTaxOrInterest = /(?:effektiv|jahreszins|sollzins|mwst|ust|mehrwert)/i.test(rawPct)
      || (
        interestOrTaxPct
        && blob.indexOf(rawPct) >= 0
        && Math.abs(blob.indexOf(rawPct) - blob.indexOf(interestOrTaxPct[0])) < 24
      );
    if (!isInterestOrTax && !nearTaxOrInterest) {
      const n = parseDeNumber(pctMatch[1]);
      // Nur plausible Rabatt-% (0–100); größere Zahlen sind kein discountPercent
      if (n != null && n >= 0 && n <= 100) discountPercent = n;
    }
  }

  const absDiscount = blob.match(
    new RegExp(`(?:rabatt|nachlass)\\s*(?:von\\s*)?${MONEY_FRAG}\\s*(?:€|euro)`, 'i'),
  );
  if (absDiscount && discountPercent == null) {
    discountAmount = parseEuroAmount(absDiscount[1]);
  }
  // „Rabatt 449“ ohne %/€ und Wert > 100 → Euro-Betrag, nicht Prozent
  if (discountPercent == null && discountAmount == null) {
    const rabattBare = blob.match(/(?:rabatt|nachlass)\s*(?:von\s*)?(\d{1,3}(?:[.,]\d+)?)/i);
    if (rabattBare) {
      const n = parseDeNumber(rabattBare[1]);
      if (n != null && n > 100) discountAmount = n;
      else if (n != null && n >= 0 && n <= 100) discountPercent = n;
    }
  }

  let transferCost = null;
  const transferMatch = blob.match(
    new RegExp(`(?:ueberfuehrung|uberfuhrung|überführung)\\s*(?:von\\s*)?${MONEY_FRAG}\\s*(?:€|euro)?`, 'i'),
  )
    ?? blob.match(
      new RegExp(`(?:plus|und)\\s+${MONEY_FRAG}\\s*(?:€|euro)?\\s*(?:ueberfuehrung|uberfuhrung|überführung)?`, 'i'),
    )
    ?? blob.match(
      new RegExp(`${MONEY_FRAG}\\s*(?:€|euro)?\\s*(?:ueberfuehrung|uberfuhrung|überführung)`, 'i'),
    );
  if (transferMatch) transferCost = parseEuroAmount(transferMatch[1]);

  let monthlyRate = null;
  const rateMatch = blob.match(
    new RegExp(`${MONEY_FRAG}\\s*(?:€|euro)?\\s*(?:\\/\\s*monat|pro\\s+monat|mtl\\.?|monatlich)`, 'i'),
  )
    ?? blob.match(
      new RegExp(`(?:rate|leasing)\\s*(?:von\\s*)?${MONEY_FRAG}\\s*(?:€|euro)?`, 'i'),
    );
  if (rateMatch) monthlyRate = parseEuroAmount(rateMatch[1]);

  let durationMonths = null;
  const termMatch = blob.match(/(\d{2})\s*monate?/i);
  if (termMatch) durationMonths = Number(termMatch[1]);

  // „329 Euro, 36 Monate“ ohne explizites „/Monat“
  if (monthlyRate == null && durationMonths != null) {
    const bareRate = blob.match(
      new RegExp(`(?:^|[,;\\s])${MONEY_FRAG}\\s*(?:€|euro)(?!\\s*(?:ueberfuehrung|uberfuhrung|überführung|anzahlung|schluss))`, 'i'),
    );
    if (bareRate) {
      const candidate = parseEuroAmount(bareRate[1]);
      if (candidate != null && candidate >= 99 && candidate <= 2500) monthlyRate = candidate;
    }
  }

  let annualMileageKm = null;
  const kmMatch = blob.match(/(\d{1,3}(?:[.\s]\d{3})*)\s*(?:km|kilometer)(?:\s*\/?\s*jahr)?/i);
  if (kmMatch) {
    annualMileageKm = Number(String(kmMatch[1]).replace(/\./g, '').replace(/\s/g, ''));
  }

  let downPayment = null;
  const downMatch = blob.match(
    new RegExp(`(?:anzahlung|sonderzahlung)\\s*(?:von\\s*)?${MONEY_FRAG}\\s*(?:€|euro)?`, 'i'),
  )
    ?? blob.match(
      new RegExp(`${MONEY_FRAG}\\s*(?:€|euro)?\\s*(?:anzahlung|sonderzahlung)`, 'i'),
    )
    ?? blob.match(/(?:keine|ohne|0)\s*(?:€|euro)?\s*(?:anzahlung|sonderzahlung)/i);
  if (downMatch) {
    if (/keine|ohne|^0$/i.test(downMatch[0]) || (/keine|ohne/.test(blob) && /anzahlung|sonderzahlung/.test(blob) && !downMatch[1])) {
      downPayment = 0;
    } else if (downMatch[1]) {
      downPayment = parseEuroAmount(downMatch[1]);
    }
  }
  if (/\b(?:keine|ohne|0)\s*(?:€|euro)?\s*(?:sonderzahlung|anzahlung)\b/.test(blob)) {
    downPayment = 0;
  }

  let finalPayment = null;
  const noFinalPayment = /\b(?:keine|ohne|0)\s*(?:€|euro)?\s*(?:schlussrate|schlusszahlung|ballon)\b/.test(blob)
    || /\b(?:schlussrate|schlusszahlung|ballon)\s*(?:keine|ohne|0)\b/.test(blob);
  const balloonMatch = !noFinalPayment
    ? (
      blob.match(
        new RegExp(`(?:schlussrate|schlusszahlung|ballon)\\s*(?:von\\s*)?${MONEY_FRAG}\\s*(?:€|euro)?`, 'i'),
      )
      ?? blob.match(
        new RegExp(`${MONEY_FRAG}\\s*(?:€|euro)?\\s*(?:schlussrate|schlusszahlung|ballon)`, 'i'),
      )
    )
    : null;
  if (balloonMatch) finalPayment = parseEuroAmount(balloonMatch[1]);

  let effectiveInterestRate = null;
  const interestMatch = blob.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:%|prozent)\s*(?:effektiv|p\.?\s*a\.?|jahreszins)/i)
    ?? blob.match(/(?:effektiv(?:er)?\s*(?:jahres)?zins|sollzins)\s*(?:von\s*)?(\d{1,2}(?:[.,]\d{1,2})?)/i);
  if (interestMatch) effectiveInterestRate = parseDeNumber(interestMatch[1]);

  let offerType = null;
  // Barkauf bei klarer Kauf-Absicht ODER reinem %-Rabatt ohne Leasing-Konditionen
  if (
    /\b(barangebot|kaufangebot|barkauf|bar\s*kauf)\b/.test(blob)
    && monthlyRate == null
    && !/\bleasing\b/.test(blob)
  ) {
    offerType = 'purchase';
  }
  if (
    discountPercent != null
    && monthlyRate == null
    && !/\bleasing\b|\bfinanzierung\b/.test(blob)
    && durationMonths == null
    && annualMileageKm == null
  ) {
    offerType = 'purchase';
  }
  if (
    (/\bfinanzierung\b|\beffektiv/.test(blob) || finalPayment != null)
    && !/\bleasing(?:angebot)?\b/.test(blob)
  ) {
    offerType = 'financing';
  }
  if (
    /\bleasing(?:angebot)?\b/.test(blob)
    || (monthlyRate != null && durationMonths != null && finalPayment == null && offerType !== 'financing')
    || (
      durationMonths != null
      && annualMileageKm != null
      && monthlyRate == null
      && offerType !== 'financing'
      && offerType !== 'purchase'
    )
  ) {
    offerType = 'leasing';
  }

  let modelHint = null;
  const modelMatch = blob.match(/\b(ev\s*[234569]|ev9|sportage|ceed|picanto|niro|sorento|stonic|xceed|soul)\b/i);
  if (modelMatch) {
    modelHint = modelMatch[1].replace(/\s+/g, '').toLowerCase();
  }

  let trimHint = null;
  if (/\bgt[\s-]?line\b|\bgtl\b/.test(blob)) trimHint = 'gt-line';
  else if (/\bearth\b/.test(blob)) trimHint = 'earth';
  else if (/\bair\b/.test(blob) || (modelHint && /\bev\d/.test(modelHint) && /\bar\b/.test(blob))) {
    trimHint = 'air';
  } else if (/\bspirit\b/.test(blob)) trimHint = 'spirit';
  else if (/\bvision\b/.test(blob)) trimHint = 'vision';
  else if (/\b(?:core|cor)\b/.test(blob)) trimHint = 'core';

  const equipmentKeys = [];
  if (/\bwarmepumpe\b/.test(blob) || /(^|[^a-z0-9])wp([^a-z0-9]|$)/.test(blob)) {
    equipmentKeys.push('heat_pump');
  }
  if (/\bahk\b|\banhaenger(?:kupplung)?\b|\banhänger(?:kupplung)?\b/.test(blob)) {
    equipmentKeys.push('towbar');
  }

  let transmissionRequirement = null;
  if (/\bautomatik(?:getriebe)?\b|\bdct\b|\bdsg\b/.test(blob)) {
    transmissionRequirement = 'automatic';
  } else if (/\bschaltgetriebe\b|\bschalter\b|\b\bmt6?\b/.test(blob)) {
    transmissionRequirement = 'manual';
  }

  let colorHint = null;
  const colorPatterns = [
    [/terracotta/, 'terracotta'],
    [/snow\s*white(?:\s*pearl)?|schneeweiss/, 'snowwhitepearl'],
    [/clear\s*white|klarweiss|clearwhite/, 'clearwhite'],
    [/(?:^|[^a-z])(weiss|weiß|white)(?:[^a-z]|$)/i, 'white'],
    [/aurora\s*black|schwarz/, 'aurorablackpearl'],
    [/shale\s*grey|schiefergrau/, 'shalegrey'],
    [/frost\s*blue|\bblau\b/, 'frostblue'],
    [/ivory\s*silver/, 'ivorysilver'],
    [/aventurine\s*green/, 'aventurinegreen'],
    [/wolf\s*gr[ae]y|wolfgray/, 'wolfgray'],
  ];
  for (const [re, id] of colorPatterns) {
    if (re.test(blob)) {
      colorHint = id;
      break;
    }
  }

  let motorHint = null;
  if (/\blong\s*range\b|\b81[,.]?4\b/.test(blob)) motorHint = 'ev-long';
  else if (/\bstandard\s*range\b|\b58[,.]?3\b/.test(blob)) motorHint = 'ev-std';
  else if (/\bawd\b|\ballrad\b/.test(blob)) motorHint = 'ev-long-awd';

  return {
    rawText: raw,
    offerType,
    vehicleRequest: {
      modelHint,
      trimHint,
      motorHint,
      transmissionRequirement,
      packageKeys,
      equipmentKeys,
      colorHint,
    },
    commercialInput: {
      discountPercent,
      discountAmount,
      transferCost,
      monthlyRate,
      durationMonths,
      annualMileageKm,
      specialPayment: downPayment,
      downPayment,
      finalPayment,
      effectiveInterestRate,
    },
  };
}
