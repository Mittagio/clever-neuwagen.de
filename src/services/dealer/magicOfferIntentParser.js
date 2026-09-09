/**
 * Natural-language Intent für Clever Magic Offer.
 * ERKENNEN ≠ ERFINDEN – fehlende Werte bleiben null.
 */
import { parseGermanMoney } from './parseGermanMoney.js';

function normalize(text = '') {
  return String(text ?? '')
    .toLowerCase()
    // ß bleibt bei NFD erhalten – sonst matcht „schneeweiß“ nicht „schneeweiss“
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/€/g, ' euro ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Benannte Kia-Pakete (Bank-PDF) → P-Codes wie im Konfigurator MJ27 */
const NAMED_PACKAGE_ALIASES = [
  { re: /\bupgrade[\s-]?paket\b/, key: 'P5', label: 'Upgrade-Paket' },
  { re: /\bwinter[\s-]?connect(?:[\s-]?paket)?\b/, key: 'P3', label: 'Winter-Connect-Paket' },
  { re: /\bbusiness[\s-]?paket\b/, key: 'P4', label: 'Business-Paket' },
  { re: /\bdrivewise[\s-]?park(?:[\s-]?paket)?\b/, key: 'P6', label: 'DriveWise-Park-Paket' },
  { re: /\bdesign[\s-]?paket\b/, key: 'P7', label: 'Design-Paket' },
  { re: /\btechnologie[\s-]?paket\b|\btechnology[\s-]?paket\b/, key: 'technology', label: 'Technology-Paket' },
  { re: /\bkomfort[\s-]?paket\b|\bcomfort[\s-]?paket\b/, key: 'P11', label: 'Comfort-Paket' },
  { re: /\bglasdach[\s-]?paket\b/, key: 'P12', label: 'Glasdach-Paket' },
];

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
  const packageLabels = [];
  const pushPackage = (key, label = null) => {
    if (!key) return;
    if (!packageKeys.includes(key)) packageKeys.push(key);
    if (label && !packageLabels.includes(label)) packageLabels.push(label);
  };
  for (const match of blob.matchAll(/\bp\s*([1-9]\d?)\b/gi)) {
    pushPackage(`P${match[1]}`);
  }
  for (const entry of NAMED_PACKAGE_ALIASES) {
    if (entry.re.test(blob)) pushPackage(entry.key, entry.label);
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
    const pctIdx = blob.indexOf(rawPct);
    const pctCtx = pctIdx >= 0 ? blob.slice(Math.max(0, pctIdx - 28), pctIdx + rawPct.length + 8) : rawPct;
    const isInterestOrTax = Boolean(interestOrTaxPct)
      && String(interestOrTaxPct[1]) === String(pctMatch[1]);
    const nearTaxOrInterest = /(?:effektiv|jahreszins|sollzins|mwst|ust|mehrwert|leasingfaktor|faktor)/i.test(rawPct)
      || /(?:leasingfaktor|leasing\s*faktor)/i.test(pctCtx)
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
  let monthlyRateBasis = null;
  let monthlyTotalRate = null;
  let financeLeaseRate = null;
  let logisticsMonthlyRate = null;

  // HAP: „Monatliche Gesamtrate … <langer Satz> 759,46 EUR“ – Fenster groß genug
  const totalRateMatch = blob.match(
    new RegExp(`monatliche\\s+gesamtrate[\\s\\S]{0,320}?${MONEY_FRAG}\\s*(?:€|euro|eur)?`, 'i'),
  );
  if (totalRateMatch) {
    monthlyTotalRate = parseEuroAmount(totalRateMatch[1]);
  }
  const financeRateMatch = blob.match(
    new RegExp(`monatsrate\\s+finanzleasing\\s*${MONEY_FRAG}\\s*(?:€|euro|eur)?`, 'i'),
  );
  if (financeRateMatch) {
    financeLeaseRate = parseEuroAmount(financeRateMatch[1]);
  }
  const logisticsRateMatch = blob.match(
    new RegExp(`monatsrate\\s+logistik\\s*${MONEY_FRAG}\\s*(?:€|euro|eur)?`, 'i'),
  );
  if (logisticsRateMatch) {
    logisticsMonthlyRate = parseEuroAmount(logisticsRateMatch[1]);
  }

  // Primary = Gesamtrate wenn PDF sie nennt; nie Finanzleasing als Gesamtrate ausgeben
  const rateMatch = monthlyTotalRate != null
    ? totalRateMatch
    : (
      financeRateMatch
      ?? blob.match(
        new RegExp(`${MONEY_FRAG}\\s*(?:€|euro|eur)?\\s*(?:\\/\\s*monat|pro\\s+monat|mtl\\.?|monatlich)`, 'i'),
      )
      ?? blob.match(
        new RegExp(`(?:brutto|netto)[\\s-]*(?:monats)?rate\\s*(?:von\\s*)?${MONEY_FRAG}\\s*(?:€|euro|eur)?`, 'i'),
      )
      ?? blob.match(
        new RegExp(`(?:monats)?rate\\s*(?:brutto|netto)\\s*(?:von\\s*)?${MONEY_FRAG}\\s*(?:€|euro|eur)?`, 'i'),
      )
      ?? blob.match(
        new RegExp(`(?:rate|leasing)\\s*(?:von\\s*)?${MONEY_FRAG}\\s*(?:€|euro|eur)?`, 'i'),
      )
      ?? blob.match(
        new RegExp(`${MONEY_FRAG}\\s*(?:€|euro|eur)?\\s*(?:brutto|netto)\\s*(?:\\/\\s*monat|pro\\s+monat|mtl\\.?|monatlich)?`, 'i'),
      )
    );
  if (monthlyTotalRate != null) {
    monthlyRate = monthlyTotalRate;
  } else if (rateMatch) {
    monthlyRate = parseEuroAmount(rateMatch[1]);
  }
  if (rateMatch || monthlyTotalRate != null) {
    const rateCtx = String(totalRateMatch?.[0] || rateMatch?.[0] || '');
    if (/\bnetto\b/i.test(rateCtx)) monthlyRateBasis = 'net';
    else if (/\bbrutto\b/i.test(rateCtx)) monthlyRateBasis = 'gross';
  }
  // Kontext um die Rate: „Monatsrate 329 € netto“ / „Netto-Rate“ / Bank „ohne USt“
  if (monthlyRate != null && monthlyRateBasis == null) {
    if (
      /\b(?:netto[\s-]*(?:monats)?rate|(?:monats)?rate[\s\S]{0,24}netto)\b/i.test(blob)
      || /\balle\s+preise\s+ohne\s+ust\b/.test(blob)
      || /\bohne\s+ust\b/.test(blob)
    ) {
      monthlyRateBasis = 'net';
    } else if (/\b(?:brutto[\s-]*(?:monats)?rate|(?:monats)?rate[\s\S]{0,24}brutto)\b/i.test(blob)) {
      monthlyRateBasis = 'gross';
    }
  }

  let listPrice = null;
  let listPriceBasis = null;
  // Gesamt-/Anschaffungspreis vor Grundlistenpreis; UVP auch in Klammern
  const upeMatch = blob.match(
    new RegExp(`(?:gesamtlistenpreis|anschaffungspreis)[^\\d]{0,48}${MONEY_FRAG}\\s*(?:€|euro|eur)?`, 'i'),
  )
    ?? blob.match(
      new RegExp(`gesamtpreis\\s*\\(?\\s*uvp\\s*\\)?[^\\d]{0,24}${MONEY_FRAG}\\s*(?:€|euro|eur)?`, 'i'),
    )
    ?? blob.match(
      new RegExp(`\\(\\s*uvp\\s*\\)[^\\d]{0,24}${MONEY_FRAG}\\s*(?:€|euro|eur)?`, 'i'),
    )
    ?? blob.match(
      new RegExp(`(?:upe|uvp|fahrzeugpreis|barpreis)\\s*(?:brutto|netto)?\\s*(?:von\\s*)?${MONEY_FRAG}\\s*(?:€|euro|eur)?`, 'i'),
    )
    ?? blob.match(
      new RegExp(`(?:^|[^a-z])listenpreis\\s*(?:brutto|netto)?\\s*(?:von\\s*)?${MONEY_FRAG}\\s*(?:€|euro|eur)?`, 'i'),
    )
    ?? blob.match(
      new RegExp(`${MONEY_FRAG}\\s*(?:€|euro|eur)?\\s*(?:upe|uvp|listenpreis)\\s*(?:brutto|netto)?`, 'i'),
    );
  if (upeMatch) {
    listPrice = parseEuroAmount(upeMatch[1] || upeMatch[2]);
    const upeCtx = String(upeMatch[0] || '');
    if (/\bnetto\b/i.test(upeCtx) || /\bohne\s+ust\b/.test(blob)) listPriceBasis = 'net';
    else if (/\bbrutto\b/i.test(upeCtx) || /\binkl\.?\s*19\s*%?\s*mwst\b/.test(blob)) listPriceBasis = 'gross';
  }

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
  const kmCandidates = [
    ...blob.matchAll(/laufleistung(?:\s*\/\s*jahr)?[^\d]{0,40}(\d{1,3}(?:[.\s]\d{3})*)\s*(?:km|kilometer)/gi),
    ...blob.matchAll(/(\d{1,3}(?:[.\s]\d{3})*)\s*(?:km|kilometer)\s*(?:\/?\s*jahr|pro\s*jahr|p\.?\s*a\.?)/gi),
    ...blob.matchAll(/(\d{1,3}(?:[.\s]\d{3})*)\s*(?:km|kilometer)/gi),
  ];
  for (const kmMatch of kmCandidates) {
    const rawNum = String(kmMatch[1]).replace(/\./g, '').replace(/\s/g, '');
    const value = Number(rawNum);
    if (!Number.isFinite(value)) continue;
    const start = kmMatch.index ?? blob.indexOf(kmMatch[0]);
    const before = blob.slice(Math.max(0, start - 12), start);
    // Verbrauchszeile „kWh/100 km“ / „/100 km“ nie als Jahres-km
    if (/kwh\s*\/\s*$/.test(before) || /\/\s*$/.test(before)) continue;
    if (value < 1000) continue;
    if (value > 100000) continue;
    annualMileageKm = value;
    break;
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
  else if (/\bgt\b/.test(blob)) trimHint = 'gt';

  const equipmentKeys = [];
  if (/\bwarmepumpe\b/.test(blob) || /(^|[^a-z0-9])wp([^a-z0-9]|$)/.test(blob)) {
    equipmentKeys.push('heat_pump');
  }
  if (/\bahk\b|\banhaenger(?:kupplung)?\b|\banhänger(?:kupplung)?\b/.test(blob)) {
    equipmentKeys.push('towbar');
  }
  // Zubehör aus PDF (kein Katalog-Package)
  const winterWheelsMatch = raw.match(/Winterr[aä]der(?:\s+\d+\s*Zoll)?/i)
    || blob.match(/winterr[aä]der(?:\s+\d+\s*zoll)?/i);
  if (winterWheelsMatch) {
    const winterLabel = String(winterWheelsMatch[0] || '').replace(/\s+/g, ' ').trim();
    if (winterLabel) pushPackage('winter_wheels', /zoll/i.test(winterLabel) ? winterLabel : 'Winterräder');
  }

  let transmissionRequirement = null;
  if (/\bautomatik(?:getriebe)?\b|\bdct\b|\bdsg\b/.test(blob)) {
    transmissionRequirement = 'automatic';
  } else if (/\bschaltgetriebe\b|\bschalter\b|\b\bmt6?\b/.test(blob)) {
    transmissionRequirement = 'manual';
  }

  let colorHint = null;
  const lackierungCue = blob.match(
    /(?:lackierung|farbe\s*aussen|farbe\s+aussen|aussenfarbe)\s*:?\s*([a-z0-9äöü\s-]{3,40})/i,
  );
  const colorPatterns = [
    [/terracotta/, 'terracotta'],
    [/snow\s*white(?:\s*pearl)?|schneeweiss(?:\s*uni)?/, 'snowwhitepearl'],
    [/clear\s*white|klarweiss|clearwhite/, 'clearwhite'],
    [/(?:^|[^a-z])(weiss|white)(?:[^a-z]|$)/i, 'white'],
    [/aurora\s*black|schwarz/, 'aurorablackpearl'],
    [/shale\s*grey|schiefergrau/, 'shalegrey'],
    [/frost\s*blue|\bblau\b/, 'frostblue'],
    [/ivory\s*silver/, 'ivorysilver'],
    [/aventurine\s*green/, 'aventurinegreen'],
    [/wolf\s*gr[ae]y|wolfgray/, 'wolfgray'],
  ];
  const colorSearchBlob = lackierungCue?.[1]
    ? normalize(lackierungCue[1])
    : blob;
  for (const [re, id] of colorPatterns) {
    if (re.test(colorSearchBlob) || (lackierungCue && re.test(blob))) {
      colorHint = id;
      break;
    }
  }

  let motorHint = null;
  // „Allradantrieb“ hat keine Wortgrenze nach allrad
  const hasAwd = /\bawd\b|\ballrad/.test(blob);
  if (/\b84\s*kwh\b/.test(blob)) {
    motorHint = hasAwd ? 'ev-84-awd' : 'ev-84';
  } else if (/\blong\s*range\b|\b81[,.]?4\s*-?\s*kwh\b|\b81[,.]?4\b/.test(blob)) {
    motorHint = 'ev-long';
  } else if (
    /\bstandard\s*range\b/.test(blob)
    || /\b58[,.]?3\s*-?\s*kwh\b/.test(blob)
    || /\b58\s*kwh\b/.test(blob)
    || /\b58[,.]?3\b/.test(blob)
  ) {
    motorHint = 'ev-std';
  }
  if (motorHint === 'ev-long' && hasAwd) {
    motorHint = 'ev-long-awd';
  } else if (!motorHint && hasAwd) {
    motorHint = 'ev-long-awd';
  }

  return {
    rawText: raw,
    offerType,
    vehicleRequest: {
      modelHint,
      trimHint,
      motorHint,
      transmissionRequirement,
      packageKeys,
      packageLabels,
      equipmentKeys,
      colorHint,
    },
    commercialInput: {
      discountPercent,
      discountAmount,
      transferCost,
      monthlyRate,
      monthlyRateBasis,
      monthlyTotalRate,
      financeLeaseRate,
      logisticsMonthlyRate,
      listPrice,
      listPriceBasis,
      durationMonths,
      annualMileageKm,
      specialPayment: downPayment,
      downPayment,
      finalPayment,
      effectiveInterestRate,
    },
  };
}
