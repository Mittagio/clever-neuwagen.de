/**
 * Natural-language Intent für Clever Magic Offer.
 * ERKENNEN ≠ ERFINDEN – fehlende Werte bleiben null.
 */

function normalize(text = '') {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/€/g, ' euro ')
    .replace(/,/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseEuroAmount(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function parseDeNumber(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

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
  const pctMatch = blob.match(/(\d{1,2}(?:\.\d+)?)\s*(?:%|prozent)/i)
    ?? blob.match(/(?:rabatt|nachlass)\s*(?:von\s*)?(\d{1,2}(?:\.\d+)?)/i);
  if (pctMatch) discountPercent = Number(pctMatch[1]);

  let discountAmount = null;
  const absDiscount = blob.match(/(?:rabatt|nachlass)\s*(?:von\s*)?(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{1,2})?)\s*(?:€|euro)/i);
  if (absDiscount && discountPercent == null) {
    discountAmount = parseEuroAmount(absDiscount[1]);
  }

  let transferCost = null;
  const transferMatch = blob.match(/(?:ueberfuehrung|uberfuhrung|überführung)\s*(?:von\s*)?(\d{3,5}(?:[.,]\d{1,2})?)\s*(?:€|euro)?/i)
    ?? blob.match(/(?:plus|und)\s+(\d{3,5}(?:[.,]\d{1,2})?)\s*(?:€|euro)?\s*(?:ueberfuehrung|uberfuhrung|überführung)?/i)
    ?? blob.match(/(\d{3,5}(?:[.,]\d{1,2})?)\s*(?:€|euro)?\s*(?:ueberfuehrung|uberfuhrung|überführung)/i);
  if (transferMatch) transferCost = parseEuroAmount(transferMatch[1]);

  let monthlyRate = null;
  const rateMatch = blob.match(/(\d{2,4}(?:[.,]\d{1,2})?)\s*(?:€|euro)?\s*(?:\/\s*monat|pro\s+monat|mtl\.?|monatlich)/i)
    ?? blob.match(/(?:rate|leasing)\s*(?:von\s*)?(\d{2,4}(?:[.,]\d{1,2})?)\s*(?:€|euro)?/i);
  if (rateMatch) monthlyRate = parseEuroAmount(rateMatch[1]);

  let durationMonths = null;
  const termMatch = blob.match(/(\d{2})\s*monate?/i);
  if (termMatch) durationMonths = Number(termMatch[1]);

  // „329 Euro, 36 Monate“ ohne explizites „/Monat“
  if (monthlyRate == null && durationMonths != null) {
    const bareRate = blob.match(/(?:^|[,;\s])(\d{2,3}(?:[.,]\d{1,2})?)\s*(?:€|euro)(?!\s*(?:ueberfuehrung|uberfuhrung|überführung|anzahlung|schluss))/i);
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
  const downMatch = blob.match(/(?:anzahlung|sonderzahlung)\s*(?:von\s*)?(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{1,2})?)\s*(?:€|euro)?/i)
    ?? blob.match(/(?:keine|ohne|0)\s*(?:€|euro)?\s*(?:anzahlung|sonderzahlung)/i);
  if (downMatch) {
    if (/keine|ohne|^0$/i.test(downMatch[0]) || /keine|ohne/.test(blob) && /anzahlung|sonderzahlung/.test(blob) && !downMatch[1]) {
      downPayment = 0;
    } else if (downMatch[1]) {
      downPayment = parseEuroAmount(downMatch[1]);
    }
  }
  if (/\b(?:keine|ohne|0)\s*(?:€|euro)?\s*(?:sonderzahlung|anzahlung)\b/.test(blob)) {
    downPayment = 0;
  }

  let finalPayment = null;
  const balloonMatch = blob.match(/(?:schlussrate|schlusszahlung|ballon)\s*(?:von\s*)?(\d{1,3}(?:[.\s]\d{3})+(?:[.,]\d{1,2})?|\d{4,6}(?:[.,]\d{1,2})?)\s*(?:€|euro)?/i)
    ?? blob.match(/(\d{1,3}(?:[.\s]\d{3})+(?:[.,]\d{1,2})?|\d{4,6}(?:[.,]\d{1,2})?)\s*(?:€|euro)?\s*(?:schlussrate|schlusszahlung|ballon)/i);
  if (balloonMatch) finalPayment = parseEuroAmount(balloonMatch[1]);

  let effectiveInterestRate = null;
  const interestMatch = blob.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:%|prozent)\s*(?:effektiv|p\.?\s*a\.?|jahreszins)/i)
    ?? blob.match(/(?:effektiv(?:er)?\s*(?:jahres)?zins|sollzins)\s*(?:von\s*)?(\d{1,2}(?:[.,]\d{1,2})?)/i);
  if (interestMatch) effectiveInterestRate = parseDeNumber(interestMatch[1]);

  let offerType = null;
  if (/\bkauf\b|\bbar\b|\bbarkauf\b/.test(blob) && monthlyRate == null) {
    offerType = 'purchase';
  }
  if (discountPercent != null && monthlyRate == null && !/\bleasing\b|\bfinanzierung\b/.test(blob)) {
    offerType = 'purchase';
  }
  if (/\bfinanzierung\b|\bschlussrate\b|\beffektiv/.test(blob) || finalPayment != null) {
    offerType = 'financing';
  }
  if (
    /\bleasing\b/.test(blob)
    || (monthlyRate != null && durationMonths != null && finalPayment == null && offerType !== 'financing')
    || (durationMonths != null && annualMileageKm != null && monthlyRate == null && discountPercent == null && offerType !== 'financing')
  ) {
    offerType = 'leasing';
  }

  let modelHint = null;
  const modelMatch = blob.match(/\b(ev\s*[234569]|ev9|sportage|ceed|picanto|niro|sorento|stonic|xceed|soul)\b/i);
  if (modelMatch) {
    modelHint = modelMatch[1].replace(/\s+/g, '').toLowerCase();
  }

  let trimHint = null;
  if (/\bgt[\s-]?line\b/.test(blob)) trimHint = 'gt-line';
  else if (/\bearth\b/.test(blob)) trimHint = 'earth';
  else if (/\bair\b/.test(blob)) trimHint = 'air';
  else if (/\bspirit\b/.test(blob)) trimHint = 'spirit';
  else if (/\bvision\b/.test(blob)) trimHint = 'vision';

  let colorHint = null;
  const colorPatterns = [
    [/terracotta/, 'terracotta'],
    [/snow\s*white(?:\s*pearl)?|schneeweiss/, 'snowwhitepearl'],
    [/clear\s*white|klarweiss|clearwhite/, 'clearwhite'],
    [/aurora\s*black|schwarz/, 'aurorablackpearl'],
    [/shale\s*grey|schiefergrau/, 'shalegrey'],
    [/frost\s*blue/, 'frostblue'],
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
      packageKeys,
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
