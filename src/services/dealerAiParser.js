/**
 * Dealer AI – regelbasierte Mock-Erkennung (später LLM / Whisper)
 */
import { sportage } from '../data/kiaSportage.js';
import { resolveTrimId, resolveEngineId, resolveColorId } from '../data/models/kia/sportageAdapter.js';
import { matchSuggestedModels } from './dealerAiModelMatcher.js';
import {
  enrichFieldsFromCustomerMail,
  preprocessCustomerMail,
} from './dealerAiMailExtractor.js';
import {
  DEALER_AI_MONTHLY_BUDGET_VALUES,
  DEALER_AI_PURCHASE_BUDGET_VALUES,
  formatBudgetDisplay,
} from './dealerAiBudget.js';

export { formatBudgetDisplay };

export const DEALER_AI_ACTIONS = {
  create_offer: {
    id: 'create_offer',
    label: 'Angebot erstellen',
    description: 'Angebot im Angebotssystem anlegen',
  },
  create_customer_offer: {
    id: 'create_customer_offer',
    label: 'Kundenangebot vorbereiten',
    description: 'Personalisiertes Angebot mit Verkaufschancen-Verknüpfung',
  },
  show_suggestions: {
    id: 'show_suggestions',
    label: 'Fahrzeugvorschläge anzeigen',
    description: 'Passende Modelle prüfen und mit dem Kunden besprechen',
  },
  calculate_rate: {
    id: 'calculate_rate',
    label: 'Leasingrate berechnen',
    description: 'Grobe Rate auf Basis der erkannten Konditionen prüfen',
  },
  draft_reply: {
    id: 'draft_reply',
    label: 'Rückfrage an Kunden formulieren',
    description: 'Kurze Rückfrage als Entwurf vorbereiten',
  },
  create_cash_offer: {
    id: 'create_cash_offer',
    label: 'Barangebot erstellen',
    description: 'Kaufangebot mit Barpreis vorbereiten',
  },
  create_leasing_offer: {
    id: 'create_leasing_offer',
    label: 'Leasingangebot erstellen',
    description: 'Leasingangebot mit Laufzeit und Kilometer',
  },
  create_financing_offer: {
    id: 'create_financing_offer',
    label: 'Finanzierungsangebot erstellen',
    description: 'Finanzierung mit Rate und Anzahlung',
  },
  create_three_way_offer: {
    id: 'create_three_way_offer',
    label: '3-Wege-Finanzierung erstellen',
    description: 'Finanzierung mit Schlussrate und Rückgabeoption',
  },
  create_sales_opportunity: {
    id: 'create_sales_opportunity',
    label: 'Verkaufschance erstellen',
    description: 'Kundenwunsch als Verkaufschance im System anlegen',
  },
  publish_online: {
    id: 'publish_online',
    label: 'Fahrzeug online stellen',
    description: 'Auf Händlerseite & Landingpage sichtbar machen',
  },
  create_inventory: {
    id: 'create_inventory',
    label: 'Lagerfahrzeug anlegen',
    description: 'Bestand mit Status Lager / Vorlauf / Bestellt',
  },
  generate_listing: {
    id: 'generate_listing',
    label: 'Inserat generieren',
    description: 'mobile.de, Leasingmarkt, WhatsApp & E-Mail Texte',
  },
};

/** Standard-Leasinglaufzeiten (Monate) – immer Laufzeit, nie Monatsrate */
export const LEASE_TERM_MONTHS = [12, 24, 36, 42, 48, 60];

/** Verkäufer-Dropdown Laufzeit */
export const DEALER_AI_TERM_OPTIONS = [24, 36, 42, 48, 60];

/** Verkäufer-Dropdown Kilometer/Jahr */
export const DEALER_AI_MILEAGE_OPTIONS = [5000, 10000, 15000, 20000, 25000, 30000];

/** Verkäufer-Budget-Chips (€/Monat) */
export const DEALER_AI_BUDGET_OPTIONS = DEALER_AI_MONTHLY_BUDGET_VALUES;

/** Wunschpreis-Chips für Kauf (€) */
export const DEALER_AI_CASH_PRICE_OPTIONS = DEALER_AI_PURCHASE_BUDGET_VALUES;

export const PAYMENT_TYPE_LABELS = {
  leasing: 'Leasing',
  cash: 'Kauf / Barzahlung',
  financing: 'Finanzierung',
  threeWayFinancing: '3-Wege-Finanzierung',
  unknown: 'Noch unklar',
};

export const DEALER_AI_PAYMENT_OPTIONS = [
  'leasing',
  'cash',
  'financing',
  'threeWayFinancing',
  'unknown',
];

export const DEALER_AI_DELIVERY_DATE_OPTIONS = [
  'sofort',
  'diese Woche',
  'nächste Woche',
  'diesen Monat',
  'nächsten Monat',
];

/** Verkäufer-Aktionen (Dropdown) */
export const DEALER_AI_SELLER_ACTIONS = [
  'create_sales_opportunity',
  'create_offer',
  'create_cash_offer',
  'create_leasing_offer',
  'create_financing_offer',
  'create_three_way_offer',
  'show_suggestions',
  'draft_reply',
];

export const DEALER_AI_EXAMPLES = [
  {
    id: 'ex1',
    label: 'Sportage Vision Hybrid',
    text: 'Stell mir einen Kia Sportage Vision Hybrid mit 48 Monaten, 15.000 km, Corporate Benefits und 4.000 € Anzahlung online.',
  },
  {
    id: 'ex2',
    label: 'Lagerfahrzeug GT-Line',
    text: 'Ich habe drei Sportage GT-Line in Schwarz auf Lager, einer mit Glasdach, sofort verfügbar.',
  },
  {
    id: 'ex3',
    label: 'EV3 Earth Leasing',
    text: 'EV3 Earth, Frost Blue, Wärmepumpe, Liefertermin August, Leasing ab 329 €.',
  },
  {
    id: 'ex4',
    label: 'Angebot für Kunden',
    text: 'Erstelle mir für Herrn Müller ein Angebot für einen Sportage Spirit, 48 Monate, 15.000 km, Wunschrate 350 €.',
  },
];

const WORD_NUMBERS = {
  ein: 1, eine: 1, einer: 1, zwei: 2, drei: 3, vier: 4, fünf: 5,
};

const TRIM_ALIASES = [
  { re: /\bgt[\s-]?line\b/i, id: 'gt-line', label: 'GT-Line' },
  { re: /\bblack[\s-]?edition\b/i, id: 'black-edition', label: 'Black Edition' },
  { re: /\bvision\b/i, id: 'vision', label: 'Vision' },
  { re: /\bspirit\b/i, id: 'spirit', label: 'Spirit' },
  { re: /\bcore\b/i, id: 'core', label: 'Core' },
  { re: /\bearth\b/i, id: 'earth', label: 'Earth' },
  { re: /\bair\b/i, id: 'air', label: 'Air' },
  { re: /\blight\b/i, id: 'light', label: 'Light' },
  { re: /\blong[\s-]?range\b/i, id: null, label: 'Long Range' },
];

const MOTOR_ALIASES = [
  { re: /\bhybrid\b/i, id: 'tgi-hybrid-2wd', label: 'Hybrid' },
  { re: /\bplug[\s-]?in|phev\b/i, id: 'tgi-hybrid-awd', label: 'Plug-in Hybrid' },
  { re: /\bdiesel\b/i, id: 'crdi-dct-2wd', label: 'Diesel' },
  { re: /\bbenzin|benziner|t-gdi|tgi\b/i, id: 'tgi-dct-2wd', label: 'Benzin' },
  { re: /\belektro|ev\b/i, id: null, label: 'Elektro' },
];

const COLOR_ALIASES = [
  { re: /\bschwarz|panthera|zilin\b/i, id: 'zilinaschwarz', label: 'Schwarz' },
  { re: /\bweiß|weiss|carrara|deluxe\b/i, id: 'carraraweiss', label: 'Weiß' },
  { re: /\bgrau|wolfgrau|silber|lunar\b/i, id: 'wolfgrau', label: 'Grau' },
  { re: /\bblau|blueflame|frost\b/i, id: 'blueflame', label: 'Blau' },
  { re: /\brot|magmarot\b/i, id: 'magmarot', label: 'Rot' },
  { re: /\bgrün|green\b/i, id: 'experience-green', label: 'Grün' },
];

const PACKAGE_ALIASES = [
  { re: /\bwinter[\s-]?connect\b/i, id: 'winter-connect', label: 'Winter-Connect-Paket' },
  { re: /\bglasdach|panorama\b/i, id: 'p4-panorama', label: 'Panorama-Glasschiebedach' },
  { re: /\bwärmepumpe|waermepumpe\b/i, id: null, label: 'Wärmepumpe' },
  { re: /\bdrivewise|assist\b/i, id: 'p5-drivewise', label: 'DriveWise Paket' },
  { re: /\bkomfort\b/i, id: 'p1-comfort', label: 'Komfort-Paket' },
  { re: /\bharman|sound\b/i, id: 'p3-sound', label: 'Sound-Paket' },
];

const CUSTOMER_GROUP_ALIASES = [
  { re: /corporate\s*benefits?/i, id: 'corporate', label: 'Corporate Benefits' },
  { re: /\bbehörde|behoerde|öffentlich/i, id: 'public', label: 'Behörde / Öffentlich' },
  { re: /\bgewerbe|business|firma\b/i, id: 'business', label: 'Gewerbe' },
];

function normalizeText(text) {
  return text
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumber(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseMileage(text) {
  const m = text.match(/(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*(?:km|kilometer)/i);
  if (!m) return null;
  return parseNumber(m[1].replace(/\s/g, ''));
}

function isLeaseTermMonth(value) {
  return LEASE_TERM_MONTHS.includes(Number(value));
}

function parseTermMonths(text) {
  const yearWord = text.match(/\b(ein|zwei|drei|vier|fünf|sechs)\s*jahr(?:e|en)?\b/i);
  if (yearWord) {
    const map = { ein: 12, zwei: 24, drei: 36, vier: 48, fünf: 60, sechs: 72 };
    const months = map[yearWord[1].toLowerCase()];
    if (months) return months;
  }

  const explicit = text.match(/(\d+)\s*monat/i);
  if (explicit) return Number(explicit[1]);

  const afterKm = text.match(
    /(?:\d{1,3}(?:[.\s]\d{3})*|\d+)\s*km(?:\s*\/\s*(?:jahr|a))?[^0-9]{0,12}(12|24|36|48|60)\b/i,
  );
  if (afterKm) return Number(afterKm[1]);

  const trailing = text.match(/(?:^|\s)(12|24|36|48|60)\s*$/i);
  if (trailing) return Number(trailing[1]);

  const leaseBundle = text.match(/\b(12|24|36|48|60)\s+(?:\d{1,3}(?:[.\s]\d{3})*|\d+)\s*km/i);
  if (leaseBundle) return Number(leaseBundle[1]);

  if (/leasing|finanzier/i.test(text)) {
    const inLeasingContext = text.match(/\b(12|24|36|48|60)\b(?!\s*€)/i);
    if (inLeasingContext) return Number(inLeasingContext[1]);
  }

  return null;
}

function parseDownPayment(text) {
  const m = text.match(/(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*(?:€|euro)?\s*anzahlung/i)
    ?? text.match(/anzahlung\s*(?:von\s*)?(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*(?:€|euro)?/i);
  if (!m) return null;
  return parseNumber(m[1].replace(/\s/g, ''));
}

export function parseBatteryKwhFromText(text) {
  const m = String(text ?? '').match(/\b(\d+(?:[,.]\d+)?)\s*kwh\b/i);
  if (!m) return null;
  const value = parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(value) ? Math.round(value) : null;
}

export function batteryLabelFromKwh(kwh) {
  if (kwh == null) return null;
  if (kwh >= 75) return '81 kWh';
  if (kwh >= 55 && kwh < 75) return '58 kWh';
  return `${kwh} kWh`;
}

export function parseAllDownPaymentsFromText(text) {
  const values = [];
  const raw = String(text ?? '');
  for (const m of raw.matchAll(/(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*(?:€|euro)?\s*anzahlung/gi)) {
    const n = parseNumber(m[1].replace(/\s/g, ''));
    if (n != null) values.push(n);
  }
  for (const m of raw.matchAll(/anzahlung\s*(?:von\s*)?(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*(?:€|euro)?/gi)) {
    const n = parseNumber(m[1].replace(/\s/g, ''));
    if (n != null) values.push(n);
  }
  return [...new Set(values)];
}

export function parseAllMileagesFromText(text) {
  const values = [];
  for (const m of String(text ?? '').matchAll(/(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*(?:km|kilometer)/gi)) {
    const n = parseNumber(m[1].replace(/\s/g, ''));
    if (n != null && n >= 5000 && n <= 50000) values.push(n);
  }
  return [...new Set(values)];
}

function stripAnzahlungForRateParsing(text = '') {
  return String(text)
    .replace(/(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*(?:€|euro)?\s*anzahlung/gi, ' ')
    .replace(/anzahlung\s*(?:von\s*)?(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*(?:€|euro)?/gi, ' ');
}

function euroAmountIsAnzahlung(text = '', matchIndex = 0, matchLength = 0) {
  const slice = text.slice(Math.max(0, matchIndex - 18), matchIndex + matchLength + 18).toLowerCase();
  return /anzahlung/.test(slice);
}

function hasRateBudgetKeyword(snippet = '') {
  return /\b(budget|rate|monat|monatlich|mtl|wunschrate|leasing\s*ab|max\.?|bis\s+\d{2,4}\s*€|€\s*\/\s*monat|pro\s+monat)\b/i.test(snippet);
}

function parseDesiredRate(text, termMonths = null, paymentType = null) {
  const source = stripAnzahlungForRateParsing(text);
  const lower = source.toLowerCase();
  const isCashContext = paymentType === 'cash'
    || /\b(kauf|barkauf|barzahlung|bar(?:\s|-)?preis|kaufpreis)\b/i.test(lower);
  if (isCashContext) return null;

  const isFinancing = paymentType === 'financing' || paymentType === 'threeWayFinancing';

  const budgetBis = source.match(/budget\s*(?:bis|bis\s+zu|max\.?|höchstens|ca\.?)?\s*(\d{2,4})\s*€/i);
  if (budgetBis) return parseNumber(budgetBis[1]);

  const labeled = source.match(/(?:wunschrate|leasing\s*ab)\s*(?:ab\s*)?(\d{2,4})\s*€/i);
  if (labeled) return parseNumber(labeled[1]);

  const financingRate = source.match(/(?:ca\.?|ungefähr|unfähr)\s*(\d{2,4})\s*(?:€|euro)(?:\s*rate)?/i)
    ?? source.match(/(\d{2,4})\s*(?:€|euro)\s*rate/i);
  if (financingRate) return parseNumber(financingRate[1]);

  const rateWord = source.match(/\brate\s*(?:ab\s*)?(\d{2,4})\s*€/i);
  if (rateWord) return parseNumber(rateWord[1]);

  const aroundEuro = source.match(/(?:um\s*(?:die|ca\.?)?\s*)?(\d{2,4})\s*(?:€|euro)(?:\s*im\s*monat|\s*\/\s*monat)?/i);
  if (aroundEuro) {
    const absoluteIndex = source.indexOf(aroundEuro[0]);
    if (!euroAmountIsAnzahlung(text, absoluteIndex, aroundEuro[0].length)) {
      const val = parseNumber(aroundEuro[1]);
      const snippet = source.slice(Math.max(0, absoluteIndex - 24), absoluteIndex + aroundEuro[0].length + 24);
      if (val != null && val >= 500 && !hasRateBudgetKeyword(snippet)) {
        /* große Beträge ohne Rate-Kontext sind keine Monatsrate */
      } else if (val != null && (isFinancing || !(termMonths === val && isLeaseTermMonth(val)))) {
        return val;
      }
    }
  }

  const euroMonth = source.match(/(\d{2,4})\s*€\s*(?:\/|pro\s*)?(?:monat|mt)/i);
  if (euroMonth) {
    const val = parseNumber(euroMonth[1]);
    if (val != null && (isFinancing || !(termMonths === val && isLeaseTermMonth(val)))) return val;
  }

  return null;
}

function parseDesiredPrice(text) {
  const bis = text.match(/\bbis\s*(?:zu\s*)?(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*(?:€|euro)/i);
  if (bis) {
    const value = parseNumber(bis[1].replace(/\s/g, ''));
    if (value != null) return value;
  }
  const patterns = [
    /(?:kauf|barkauf|barzahlung|bar(?:\s|-)?preis|kaufpreis)\s*(?:bis|bis\s+zu|max\.?|ca\.?|ungefähr|ab)?\s*(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*(?:€|euro)?/i,
    /(?:barpreis|kaufpreis|wunschpreis|budget)\s*(?:bis|von|ca\.?|ab)?\s*(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*€?/i,
    /unter\s*(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*€/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return parseNumber(m[1].replace(/\s/g, ''));
  }
  return null;
}

function parseBalloonPayment(text) {
  const m = text.match(/schlussrate\s*(?:von\s*)?(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*€?/i);
  if (!m) return null;
  return parseNumber(m[1].replace(/\s/g, ''));
}

const MONTH_NAMES = [
  'januar', 'februar', 'märz', 'maerz', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'dezember',
];

function monthPattern() {
  return MONTH_NAMES.join('|');
}

function parseDesiredDeliveryDate(text) {
  if (/sofort\s*(?:verfügbar|lieferbar|da|möglich)?/i.test(text)
    || /fahrzeug\s+soll\s+sofort/i.test(text)) {
    return 'sofort';
  }
  if (/nächste\s*woche|naechste\s*woche|übergabe[^\n.]{0,30}nächste\s*woche/i.test(text)) {
    return 'nächste Woche';
  }
  if (/diese\s*woche/i.test(text)) return 'diese Woche';
  if (/diesen\s*monat|ende\s+des\s+monats/i.test(text)) return 'diesen Monat';
  if (/nächsten\s*monat/i.test(text)) return 'nächsten Monat';

  const months = monthPattern();
  const beginning = text.match(new RegExp(`anfang\\s+(${months})`, 'i'));
  if (beginning) {
    const label = beginning[1].replace(/^maerz$/i, 'März');
    return `Anfang ${label.charAt(0).toUpperCase()}${label.slice(1)}`;
  }

  const endOf = text.match(new RegExp(`(?:bis\\s+)?ende\\s+(${months})`, 'i'));
  if (endOf) {
    const label = endOf[1].replace(/^maerz$/i, 'März');
    return `Ende ${label.charAt(0).toUpperCase()}${label.slice(1)}`;
  }

  const buyIn = text.match(new RegExp(`(?:kaufen|kaufdatum|zulassung|lieferung|übergabe|abholung)[^\\n.]{0,40}(?:im|in|bis)\\s+(${months})`, 'i'));
  if (buyIn) {
    const label = buyIn[1].replace(/^maerz$/i, 'März');
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  const latest = text.match(new RegExp(`lieferung\\s+spätestens\\s+im\\s+(${months})`, 'i'));
  if (latest) {
    const label = latest[1].replace(/^maerz$/i, 'März');
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  const monthYear = text.match(new RegExp(`\\b(${months})\\s+(20\\d{2})\\b`, 'i'));
  if (monthYear) {
    const label = monthYear[1].replace(/^maerz$/i, 'März');
    return `${label.charAt(0).toUpperCase()}${label.slice(1)} ${monthYear[2]}`;
  }

  return null;
}

function parsePaymentType(text, fields) {
  const lower = text.toLowerCase();

  if (/3[\s-]?wege|drei[\s-]?wege|schlussrate|rückgabeoption|rueckgabeoption|ähnlich\s+leasing\s+mit\s+rückgabe/i.test(lower)) {
    return 'threeWayFinancing';
  }
  if (/\bfinanzier(?:ung|en|ungsangebot)?\b/i.test(lower) && !/\bleasing\b/i.test(lower)) {
    return 'financing';
  }
  if (/\b(kauf|kaufen|barkauf|bar\s*kaufen|barpreis|kaufangebot|barzahlung|bar\s*zahlen)\b/i.test(lower)) {
    return 'cash';
  }
  if (/\bleasing\b/i.test(lower)) {
    return 'leasing';
  }
  if (fields.termMonths || fields.mileagePerYear) {
    return 'leasing';
  }
  if (fields.desiredRate && !fields.desiredPrice) {
    return fields.balloonPayment ? 'threeWayFinancing' : 'financing';
  }
  return 'unknown';
}

export function suggestActionForPaymentType(paymentType) {
  switch (paymentType) {
    case 'cash': return 'create_cash_offer';
    case 'leasing': return 'create_leasing_offer';
    case 'financing': return 'create_financing_offer';
    case 'threeWayFinancing': return 'create_three_way_offer';
    default: return 'create_sales_opportunity';
  }
}

function parseQuantity(text) {
  const word = text.match(/\b(ein|eine|einer|zwei|drei|vier|fünf)\b/i);
  if (word) return WORD_NUMBERS[word[1].toLowerCase()] ?? null;
  const num = text.match(/\b(\d+)\s*(?:stück|fahrzeug|sportage|ev3)/i);
  return num ? Number(num[1]) : null;
}

const CUSTOMER_NAME_BLOCKLIST = new Set([
  'keine förderung',
  'förderung',
  'wohnmobil',
  'gebrauchtwagen',
  'budget',
  'farbe blau',
  'farbe schwarz',
  'farbe weiß',
  'farbe rot',
  'farbe grau',
  'kunde noch offen',
  'kunde offen',
]);

const CUSTOMER_NAME_BLOCK_WORDS = new Set([
  'keine',
  'förderung',
  'foerderung',
  'wohnmobil',
  'gebrauchtwagen',
  'budget',
  'farbe',
  'batterie',
  'leasing',
  'finanzierung',
  'hybrid',
  'elektro',
  'sportage',
  'sorento',
  'soul',
  'golf',
  'kia',
  'vw',
  'audi',
  'bmw',
  'ledig',
  'kinder',
  'corporate',
  'benefits',
]);

/** Häufige deutsche Orte – nicht als Personenname verwenden */
const GERMAN_CITY_NAMES = new Set([
  'aalen', 'schorndorf', 'stuttgart', 'hamburg', 'berlin', 'münchen', 'munich',
  'köln', 'koln', 'frankfurt', 'düsseldorf', 'dusseldorf', 'nürnberg', 'nurnberg',
  'leipzig', 'dresden', 'hannover', 'bremen', 'essen', 'dortmund', 'duisburg',
  'bochum', 'wuppertal', 'bielefeld', 'bonn', 'münster', 'munster', 'karlsruhe',
  'mannheim', 'augsburg', 'wiesbaden', 'freiburg', 'heidelberg', 'ulm', 'ulm',
  'heilbronn', 'pforzheim', 'reutlingen', 'esslingen', 'ludwigsburg', 'göppingen',
  'goeppingen', 'waiblingen', 'fellbach', 'leonberg', 'sindelfingen', 'böblingen',
]);

function isLikelyCityName(value = '') {
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return false;
  return GERMAN_CITY_NAMES.has(normalized);
}

const STREET_LINE_RE = /^(.+?\s)(\d+[a-zA-Z]?(?:\/\d+[a-zA-Z]?)?)$/;
const PLZ_LINE_RE = /^(\d{5})$/;

function isMonthYearLine(line = '') {
  const months = monthPattern();
  return new RegExp(`^(${months})\\s+(20\\d{2})$`, 'i').test(String(line).trim());
}

function looksLikeGermanStreetName(street = '') {
  return /straße|str\.|strasse|weg|allee|platz|ring|gasse|damm|ufer|steig|chaussee|markt|hof/i.test(String(street));
}

function splitTextLines(text = '') {
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isBlockedCustomerName(fullName = '') {
  const normalized = String(fullName).trim().toLowerCase();
  if (!normalized) return true;
  if (CUSTOMER_NAME_BLOCKLIST.has(normalized)) return true;
  const parts = normalized.split(/\s+/);
  if (parts.some((part) => CUSTOMER_NAME_BLOCK_WORDS.has(part))) return true;
  if (/\d|@|€|\.de\b|0\d{2,}/.test(normalized)) return true;
  return false;
}

function looksLikePersonNameLine(line = '') {
  const trimmed = String(line).trim();
  if (!trimmed || trimmed.length > 48) return false;
  if (isBlockedCustomerName(trimmed)) return false;
  if (/^\+?\d[\d\s\-/().]{6,}\d$/.test(trimmed.replace(/\s/g, ''))) return false;
  if (/@|<|>/.test(trimmed)) return false;
  if (/€|\bbis\s+\d|farbe\b|batterie|förderung|wohnmobil|gw\b|e-?soul|leasing|corporate/i.test(trimmed)) return false;
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1 && isLikelyCityName(parts[0])) return false;
  if (parts.length < 2) return false;
  if (parts.some((part) => isLikelyCityName(part))) return false;
  return /^[A-ZÄÖÜ][a-zäöüß-]+(?:\s+[A-ZÄÖÜ][a-zäöüß-]+){1,2}$/.test(trimmed);
}

function parseQuotedCustomerName(text = '') {
  const match = String(text).match(/['"]([A-ZÄÖÜa-zäöüß][^'"]{2,48})['"]/);
  if (!match) return null;
  const fullName = match[1].trim();
  if (isBlockedCustomerName(fullName)) return null;
  const parts = fullName.split(/\s+/);
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ') || null,
    fullName,
    confidence: 0.98,
  };
}

export function formatCustomerAddressLine({
  street = '',
  houseNumber = '',
  postalCode = '',
  city = '',
} = {}) {
  const line1 = [street, houseNumber].filter(Boolean).join(' ');
  const line2 = [postalCode, city].filter(Boolean).join(' ');
  if (line1 && line2) return `${line1} · ${line2}`;
  return line1 || line2 || '';
}

export function parseCustomerAddressFromText(text = '') {
  const lines = splitTextLines(text);
  let postalCode = null;
  let city = null;
  let street = null;
  let houseNumber = null;

  const skipLine = (line) => /@|<|>|leasing|corporate|ledig|kinder|audi\s|bmw\s|ev\d/i.test(line)
    || isMonthYearLine(line);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (skipLine(line)) continue;

    const plzOnly = line.match(PLZ_LINE_RE);
    if (plzOnly) {
      postalCode = plzOnly[1];
      const prev = lines[index - 1];
      const next = lines[index + 1];
      if (prev && !skipLine(prev) && !STREET_LINE_RE.test(prev) && !PLZ_LINE_RE.test(prev)) {
        if (isLikelyCityName(prev) || /^[A-ZÄÖÜ]/.test(prev)) city = city ?? prev;
      }
      if (next && !skipLine(next) && !STREET_LINE_RE.test(next) && !PLZ_LINE_RE.test(next)) {
        if (isLikelyCityName(next) || /^[A-ZÄÖÜ]/.test(next)) city = city ?? next;
      }
      continue;
    }

    const streetMatch = line.match(STREET_LINE_RE);
    if (streetMatch && !/\d{5}/.test(line) && !isMonthYearLine(line)) {
      const nextStreet = streetMatch[1].trim();
      const nextHouse = streetMatch[2];
      const shouldReplace = !street
        || (looksLikeGermanStreetName(nextStreet) && !looksLikeGermanStreetName(street));
      if (shouldReplace) {
        street = nextStreet;
        houseNumber = nextHouse;
      }
      continue;
    }

    if (!city && (isLikelyCityName(line) || (/^[A-ZÄÖÜ][a-zäöüß-]+$/.test(line) && line.length < 24))) {
      const neighborIsAddress = [lines[index - 1], lines[index + 1]].some((neighbor) => (
        neighbor && (PLZ_LINE_RE.test(neighbor) || STREET_LINE_RE.test(neighbor))
      ));
      if (neighborIsAddress) city = line;
    }
  }

  if (!street && !postalCode && !city) return null;

  return {
    street,
    houseNumber,
    postalCode,
    city,
    formatted: formatCustomerAddressLine({ street, houseNumber, postalCode, city }),
  };
}

export function parseNameFromEmail(email = '') {
  const local = String(email).split('@')[0]?.trim();
  if (!local || local.length < 4) return null;
  const cleaned = local.replace(/[._-]+/g, ' ').trim();
  if (!/^[a-zäöüß]+(?:\s+[a-zäöüß]+)?$/i.test(cleaned)) return null;
  const parts = cleaned.split(/\s+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
  if (isBlockedCustomerName(parts.join(' '))) return null;
  return {
    firstName: parts[0] ?? null,
    lastName: parts.slice(1).join(' ') || null,
    fullName: parts.join(' '),
    confidence: 0.45,
  };
}

export function parseStructuredCustomerName(text = '') {
  const quoted = parseQuotedCustomerName(text);
  if (quoted) return quoted;

  const lines = splitTextLines(text);
  const phone = parseCustomerPhone(text);
  const email = parseCustomerEmail(text);
  const phoneDigits = phone?.replace(/\D/g, '') ?? '';

  for (let index = 0; index < Math.min(lines.length, 4); index += 1) {
    const line = lines[index];
    if (email && line.toLowerCase() === email.toLowerCase()) continue;
    if (phoneDigits && line.replace(/\D/g, '').includes(phoneDigits.slice(-8))) continue;
    if (!looksLikePersonNameLine(line)) continue;
    const parts = line.split(/\s+/);
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' ') || null,
      fullName: line,
      confidence: index === 0 ? 0.95 : 0.8,
    };
  }

  if (email) {
    const derived = parseNameFromEmail(email);
    if (derived) return derived;
  }

  return null;
}

export function parseWishDateFromText(text = '') {
  const match = String(text).match(/\b(\d{1,2})[.\-/](\d{1,2})[.\-/](20\d{2})\b/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    return {
      iso: `${year}-${month}-${day}`,
      label: `${day}.${month}.${year}`,
      precision: 'day',
    };
  }

  const monthYear = String(text).match(new RegExp(`\\b(${monthPattern()})\\s+(20\\d{2})\\b`, 'i'));
  if (monthYear) {
    const label = monthYear[1].replace(/^maerz$/i, 'März');
    const pretty = `${label.charAt(0).toUpperCase()}${label.slice(1)} ${monthYear[2]}`;
    return {
      iso: null,
      label: pretty,
      precision: 'month',
    };
  }

  return null;
}

export function parseBatteryPowerFromText(text = '') {
  const match = String(text).match(/\b(\d+(?:[,.]\d+)?)\s*k(?:w|wh)\b/i);
  if (!match) return null;
  const value = parseFloat(match[1].replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

export function parseColorPreferenceFromText(text = '') {
  const labeled = String(text).match(/\bfarbe\s+(blau|schwarz|weiß|weiss|grau|rot|grün|gruen)/i);
  if (labeled) return labeled[1].toLowerCase().replace('weiss', 'weiß').replace('gruen', 'grün');
  if (/schwarz(?:es)?\s+auto|auto\s+schwarz/i.test(text)) return 'schwarz';
  if (/weiß(?:es)?\s+auto|auto\s+weiß/i.test(text)) return 'weiß';
  if (/grau(?:es)?\s+auto/i.test(text)) return 'grau';
  if (/rot(?:es)?\s+auto/i.test(text)) return 'rot';
  if (/blau(?:es)?\s+auto|auto\s+blau/i.test(text)) return 'blau';
  return null;
}

export function parseBudgetMaxFromText(text = '') {
  const patterns = [
    /\bbis\s*(?:zu\s*)?(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*(?:€|euro)/i,
    /(?:budget|preis|kaufpreis|wunschpreis)\s*(?:bis|max\.?|ca\.?)?\s*(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*(?:€|euro)?/i,
  ];
  for (const re of patterns) {
    const match = String(text).match(re);
    if (!match) continue;
    const value = parseNumber(match[1].replace(/\s/g, ''));
    if (value != null) return value;
  }
  return null;
}

export function parseUsedVehicleHint(text = '') {
  return /\b(?:gw|gebrauchtwagen|used)\b/i.test(text);
}

export function parseModelHintFromText(text = '') {
  const lower = String(text).toLowerCase();
  if (/e[\s-]?soul/.test(lower)) return { brand: 'Kia', model: 'e-Soul', modelKey: 'esoul', used: /\bgw\b|gebrauchtwagen/i.test(lower) };
  if (/ev\s*2|ev2/.test(lower)) return { brand: 'Kia', model: 'EV2', modelKey: 'ev2', used: false };
  if (/ev\s*3|ev3/.test(lower)) return { brand: 'Kia', model: 'EV3', modelKey: 'ev3', used: false };
  if (/sportage/.test(lower)) return { brand: 'Kia', model: 'Sportage', modelKey: 'sportage', used: /\bgw\b|gebrauchtwagen/i.test(lower) };
  if (/\bniro\b/.test(lower)) return { brand: 'Kia', model: 'Niro', modelKey: 'niro', used: false };
  return null;
}

export function parseCustomerName(text) {
  const structured = parseStructuredCustomerName(text);
  if (structured?.fullName) return structured.fullName;

  const kundeMatch = text.match(/\bkunde\s+([A-ZÄÖÜ][a-zäöüß-]+(?:\s+[A-ZÄÖÜ][a-zäöüß-]+)?)/i);
  if (kundeMatch && !isBlockedCustomerName(kundeMatch[1].trim())) return kundeMatch[1].trim();

  const patterns = [
    /(?:für|an)\s+(?:herrn|frau|hr\.|fr\.)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)/i,
    /(?:für)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)\s+(?:ein|eine|einen)/i,
    /(?:kunde|name|von|absender)[:\s]+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)/i,
    /^([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)\s*(?:<|$|\n)/m,
  ];

  for (const re of patterns) {
    const match = text.match(re);
    if (!match) continue;
    const candidate = match[1].trim();
    if (!isBlockedCustomerName(candidate)) return candidate;
  }

  return null;
}

function normalizePhone(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/[^\d+]/g, '');
  if (cleaned.length < 8) return null;
  if (cleaned.startsWith('0049')) return `+49 ${cleaned.slice(4)}`;
  if (cleaned.startsWith('49') && cleaned.length > 10) return `+49 ${cleaned.slice(2)}`;
  if (cleaned.startsWith('0')) {
    const spaced = cleaned.replace(/^0(\d{2,4})(\d+)/, '0$1 $2');
    return spaced.length > 6 ? spaced : cleaned;
  }
  return cleaned;
}

export function parseCustomerPhone(text) {
  const labeled = text.match(/(?:tel(?:efon)?|mobil|handy|fon|📞)\s*[:\-]?\s*([+]?\d[\d\s\-/().]{7,}\d)/i);
  if (labeled) return normalizePhone(labeled[1]);

  const linePhone = text.match(/(?:^|\n)\s*(0\d{2,5}[\s\-/]?\d{4,10})\s*(?:\n|$)/m);
  if (linePhone) return normalizePhone(linePhone[1]);

  const inline = text.match(/\b(0\s*1[567]\d[\s\-/]?\d{3,4}[\s\-/]?\d{4,6})\b/)
    ?? text.match(/\b(\+49\s*1[567]\d[\s\-/]?\d{3,4}[\s\-/]?\d{4,6})\b/);
  return inline ? normalizePhone(inline[1]) : null;
}

export function parseCustomerEmail(text) {
  const labeled = text.match(/(?:e-?mail|mail|✉)\s*[:\-]?\s*([^\s@]+@[^\s@]+\.[^\s@]+)/i);
  if (labeled) return labeled[1].toLowerCase();

  const inline = text.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
  return inline ? inline[1].toLowerCase() : null;
}

export function parseLeasingEndDate(text) {
  const months = monthPattern();
  const patterns = [
    new RegExp(`leasing(?:ende|vertrag| läuft| endet)[^\\n.]{0,50}(?:im|in|bis)\\s+(${months})(?:\\s+(20\\d{2}))?`, 'i'),
    new RegExp(`leasingende\\s*(?:im|in)?\\s*(${months})(?:\\s+(20\\d{2}))?`, 'i'),
    new RegExp(`vertrag\\s+endet\\s+(?:im|in)\\s+(${months})(?:\\s+(20\\d{2}))?`, 'i'),
    /leasingende\s*(20\d{2})/i,
    new RegExp(`(?:bis\\s+)?ende\\s+(${months})\\s+(20\\d{2})`, 'i'),
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const month = m[1]?.replace(/^maerz$/i, 'März');
    const year = m[2] ?? null;
    if (month && /^\d{4}$/.test(month)) return month;
    if (month) {
      const label = month.charAt(0).toUpperCase() + month.slice(1);
      return year ? `${label} ${year}` : label;
    }
  }
  return null;
}

export function parseVehicleChangeIntent(text) {
  return /fahrzeugwechsel|neues\s+auto|leasingerneuerung|leasing[\s-]?erneuerung|auto\s+wechseln|fahrzeug\s+erneuern/i.test(text);
}

export function parseImmediateAvailability(text) {
  return /sofort\s+verfügbar|sofort\s+lieferbar|sofort\s+da|auf\s+lager|lagerwagen|sofort\s+möglich/i.test(text);
}

function parseBodyType(text) {
  if (/\bsuv\b/i.test(text)) return 'SUV';
  if (/crossover/i.test(text)) return 'Crossover';
  if (/kombi|tourer/i.test(text)) return 'Kombi';
  if (/limousine|sedan/i.test(text)) return 'Limousine';
  return null;
}

function parseTransmission(text) {
  if (/automatik|automat/i.test(text)) return 'Automatik';
  if (/schalt/i.test(text)) return 'Schaltgetriebe';
  return null;
}

function parseMaxLengthMm(text) {
  const labeled = text.match(/(?:größe|groesse|länge|laenge|bis)[^\d]{0,24}(\d+[,.]\d+)\s*m/i);
  const plain = text.match(/(\d+[,.]\d+)\s*m(?:\s*(?:länge|laenge|fahrzeug))?/i);
  const raw = labeled?.[1] ?? plain?.[1];
  if (!raw) return null;
  const meters = Number(raw.replace(',', '.'));
  return Number.isFinite(meters) ? Math.round(meters * 1000) : null;
}

function parseRequiredEquipment(text) {
  const items = [];
  if (/rückfahrkamera|rueckfahrkamera|rearview/i.test(text)) items.push('Rückfahrkamera');
  if (/sitzheizung/i.test(text)) items.push('Sitzheizung');
  if (/panorama|glasdach/i.test(text)) items.push('Panoramadach');
  if (/navi|navigation/i.test(text)) items.push('Navigation');
  return items;
}

function parseDeliveryTime(text) {
  if (/sofort\s*(?:verfügbar|lieferbar|da)/i.test(text)) {
    return { label: 'Sofort verfügbar', type: 'lager', eta: null };
  }
  const monthMatch = text.match(/liefertermin\s+(januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember)/i);
  if (monthMatch) {
    const monthMap = {
      januar: 0, februar: 1, märz: 2, maerz: 2, april: 3, mai: 4, juni: 5,
      juli: 6, august: 7, september: 8, oktober: 9, november: 10, dezember: 11,
    };
    const month = monthMap[monthMatch[1].toLowerCase()];
    const year = new Date().getMonth() <= month ? new Date().getFullYear() : new Date().getFullYear() + 1;
    const eta = new Date(year, month, 15).toISOString().slice(0, 10);
    return { label: `Liefertermin ${monthMatch[1]}`, type: 'vorlauf', eta };
  }
  const weeks = text.match(/(\d+)\s*(?:wochen|wo\.?)/i);
  if (weeks) {
    return { label: `${weeks[1]} Wochen`, type: 'vorlauf', eta: null };
  }
  return null;
}

function matchAlias(list, text) {
  for (const entry of list) {
    if (entry.re.test(text)) return entry;
  }
  return null;
}

function detectBrandModel(text) {
  const lower = text.toLowerCase();
  if (/ev\s*2|ev2/.test(lower)) {
    return { brand: 'Kia', model: 'EV2', modelId: 'ev2' };
  }
  if (/ev\s*3|ev3/.test(lower)) {
    return { brand: 'Kia', model: 'EV3', modelId: 'ev3' };
  }
  if (/ev\s*4|ev4/.test(lower)) {
    return { brand: 'Kia', model: 'EV4', modelId: 'ev4' };
  }
  if (/ev\s*5|ev5/.test(lower)) {
    return { brand: 'Kia', model: 'EV5', modelId: 'ev5' };
  }
  if (/ev\s*6|ev6/.test(lower)) {
    return { brand: 'Kia', model: 'EV6', modelId: 'ev6' };
  }
  if (/ev\s*9|ev9/.test(lower)) {
    return { brand: 'Kia', model: 'EV9', modelId: 'ev9' };
  }
  if (/e[\s-]?soul/.test(lower)) {
    return { brand: 'Kia', model: 'e-Soul', modelId: 'esoul' };
  }
  if (/sportage/.test(lower)) {
    return { brand: 'Kia', model: 'Sportage', modelId: 'sportage' };
  }
  if (/\bniro\b/.test(lower)) {
    return { brand: 'Kia', model: 'Niro', modelId: 'niro' };
  }
  if (/\bxceed\b/.test(lower)) {
    return { brand: 'Kia', model: 'XCeed', modelId: 'xceed' };
  }
  if (/\bstonic\b/.test(lower)) {
    return { brand: 'Kia', model: 'Stonic', modelId: 'stonic' };
  }
  if (/kia/.test(lower)) {
    return { brand: 'Kia', model: 'Sportage', modelId: 'sportage' };
  }
  return { brand: null, model: null, modelId: null };
}

function detectAction(text, fields) {
  const lower = text.toLowerCase();

  if (/mobile\.?de|leasingmarkt|inserat|text\s*erzeug|whatsapp[\s-]?text|e[\s-]?mail[\s-]?text/.test(lower)) {
    return 'generate_listing';
  }
  if (/\b(lager|auf lager|bestand)\b/.test(lower) && (fields.quantity > 1 || /lagerfahrzeug|anlegen/.test(lower))) {
    return 'create_inventory';
  }
  if (/sofort verfügbar|auf lager/.test(lower) && !fields.customerName && fields.paymentType !== 'cash') {
    return 'create_inventory';
  }
  if (/fahrzeugvorschläge|fahrzeugvorschlaege|passende modelle/i.test(lower)) {
    return 'show_suggestions';
  }
  if (/rückfrage|rueckfrage/i.test(lower)) {
    return 'draft_reply';
  }
  if (fields.paymentType && fields.paymentType !== 'unknown') {
    return suggestActionForPaymentType(fields.paymentType);
  }
  if (fields.customerName || /für herrn|für frau|kundenangebot/.test(lower)) {
    return 'create_customer_offer';
  }
  if (/online stellen|einstellen|veröffentlichen|auf die seite|landingpage|händlerseite/.test(lower)) {
    return 'publish_online';
  }
  if (/angebot/.test(lower)) {
    return 'create_offer';
  }
  if (/lagerfahrzeug/.test(lower)) {
    return 'create_inventory';
  }
  return 'create_offer';
}

function resolveSportageConfig(fields) {
  if (fields.modelId !== 'sportage' && fields.model !== 'Sportage') {
    return fields;
  }

  const trimMatch = fields.trimId ?? resolveTrimId(
    sportage.trims.find((t) => t.name.toLowerCase() === (fields.trimLabel ?? '').toLowerCase())?.id,
  );
  const engineMatch = fields.engineId ?? resolveEngineId(fields.engineId);
  const colorMatch = fields.colorId ?? resolveColorId(fields.colorId);

  const trimId = fields.trimId
    ?? (trimMatch && sportage.trims.some((t) => t.id === trimMatch) ? trimMatch : 'vision');
  let engineId = fields.engineId;
  if (engineId && sportage.engines.some((e) => e.id === engineId)) {
    /* ok */
  } else if (/hybrid/i.test(fields.motorLabel ?? '')) {
    engineId = 'tgi-hybrid-2wd';
  } else {
    engineId = sportage.engines.find((e) => e.id === 'tgi-hybrid-2wd')?.id ?? sportage.engines[0]?.id;
  }

  const colorId = fields.colorId && sportage.colors.some((c) => c.id === fields.colorId)
    ? fields.colorId
    : sportage.colors[0]?.id;

  const trim = sportage.trims.find((t) => t.id === trimId);
  const engine = sportage.engines.find((e) => e.id === engineId);
  const color = sportage.colors.find((c) => c.id === colorId);

  return {
    ...fields,
    trimId,
    engineId,
    colorId,
    trimLabel: trim?.name ?? fields.trimLabel,
    motorLabel: engine?.name ?? fields.motorLabel,
    colorLabel: color?.name ?? fields.colorLabel,
    packageIds: fields.packageIds ?? [],
  };
}

export function parseDealerAiInput(rawText) {
  const mailCtx = preprocessCustomerMail(rawText);
  const inquirySource = mailCtx.inquiryText?.trim() || mailCtx.cleaned?.trim() || String(rawText ?? '').trim();
  const text = normalizeText(inquirySource.length >= 8 ? inquirySource : rawText);
  const addressSource = inquirySource.length >= 8 ? inquirySource : String(rawText ?? '').trim();
  const modelOnlySelection = Boolean(detectBrandModel(text ?? '').modelId) && (text?.length ?? 0) >= 4;
  if (!text || (text.length < 8 && !modelOnlySelection)) {
    return { ok: false, error: 'Bitte beschreiben Sie Fahrzeug, Konditionen oder gewünschte Aktion.' };
  }

  const brandModel = detectBrandModel(text);
  const trimHit = matchAlias(TRIM_ALIASES, text);
  const motorHit = matchAlias(MOTOR_ALIASES, text);
  const colorHit = matchAlias(COLOR_ALIASES, text);
  const packages = PACKAGE_ALIASES.filter((p) => p.re.test(text));
  const customerGroupHit = matchAlias(CUSTOMER_GROUP_ALIASES, text);
  const delivery = parseDeliveryTime(text);
  const quantity = parseQuantity(text) ?? 1;
  const termMonths = parseTermMonths(text);
  const customerAddress = parseCustomerAddressFromText(addressSource);

  let fields = {
    brand: brandModel.brand,
    model: brandModel.model,
    modelId: brandModel.modelId,
    trimId: trimHit?.id ?? null,
    trimLabel: trimHit?.label ?? null,
    engineId: motorHit?.id ?? null,
    motorLabel: motorHit?.label ?? null,
    colorId: colorHit?.id ?? null,
    colorLabel: colorHit?.label ?? null,
    packageIds: packages.map((p) => p.id).filter(Boolean),
    packageLabels: packages.map((p) => p.label),
    stockStatus: delivery?.type ?? (/lager|sofort/.test(text.toLowerCase()) ? 'lager' : null),
    stockStatusLabel: delivery?.type === 'lager' ? 'Lager' : delivery?.type === 'vorlauf' ? 'Vorlauf' : null,
    deliveryTime: delivery?.label ?? null,
    deliveryEta: delivery?.eta ?? null,
    termMonths,
    mileagePerYear: parseMileage(text),
    downPayment: parseDownPayment(text),
    balloonPayment: parseBalloonPayment(text),
    customerGroup: customerGroupHit?.id ?? null,
    customerGroupLabel: customerGroupHit?.label ?? null,
    desiredRate: null,
    desiredPrice: parseDesiredPrice(text),
    desiredDeliveryDate: parseDesiredDeliveryDate(text),
    customerName: parseCustomerName(text),
    customerPhone: parseCustomerPhone(text),
    customerEmail: parseCustomerEmail(text),
    customerAddress: customerAddress?.formatted ?? null,
    addressStreet: customerAddress?.street ?? null,
    addressHouseNumber: customerAddress?.houseNumber ?? null,
    addressPostalCode: customerAddress?.postalCode ?? null,
    addressCity: customerAddress?.city ?? null,
    leasingEndDate: parseLeasingEndDate(text),
    vehicleChangeIntent: parseVehicleChangeIntent(text),
    immediateAvailability: parseImmediateAvailability(text),
    bodyType: parseBodyType(text),
    transmission: parseTransmission(text),
    maxLengthMm: parseMaxLengthMm(text),
    requiredEquipment: parseRequiredEquipment(text),
    quantity,
    rawText: text,
    paymentType: 'unknown',
    batteryKwh: parseBatteryKwhFromText(text),
    batteryLabel: null,
  };

  if (fields.batteryKwh != null) {
    fields.batteryLabel = batteryLabelFromKwh(fields.batteryKwh);
    if (fields.batteryKwh >= 75) fields.engineId = fields.engineId ?? 'ev-long';
    else if (fields.batteryKwh <= 60) fields.engineId = fields.engineId ?? 'ev-std';
  }

  fields.paymentType = parsePaymentType(text, fields);

  const lower = text.toLowerCase();
  const hasRateKeyword = /\b(rate|monat|monatlich|leasing|finanzierung|im\s+monat|monatsrate)\b/i.test(lower);
  const hasCashKeyword = /\b(kauf|barkauf|barzahlung|bar(?:\s|-)?preis|kaufpreis)\b/i.test(lower);

  if (fields.paymentType === 'cash') {
    fields.desiredPrice = fields.desiredPrice ?? parseDesiredPrice(text);
    fields.desiredRate = null;
  } else if (fields.paymentType !== 'unknown') {
    fields.desiredRate = parseDesiredRate(text, termMonths, fields.paymentType);
    fields.desiredPrice = null;
  } else if (hasCashKeyword && !hasRateKeyword) {
    fields.desiredPrice = fields.desiredPrice ?? parseDesiredPrice(text);
    fields.desiredRate = null;
  } else {
    fields.desiredRate = parseDesiredRate(text, termMonths, fields.paymentType);
    if (fields.desiredRate) fields.desiredPrice = null;
  }

  if (fields.modelId === 'sportage' || fields.model === 'Sportage') {
    fields = resolveSportageConfig(fields);
  }

  fields = enrichFieldsFromCustomerMail(rawText, fields, mailCtx);

  const action = detectAction(text, fields);
  const actionMeta = DEALER_AI_ACTIONS[action];

  const displayFields = buildDisplayFields(fields, actionMeta);
  const customerWishSummary = buildCustomerWishSummary(fields);
  const shortForm = buildCustomerWishShortForm(fields);
  const suggestedModels = matchSuggestedModels(fields);

  return {
    ok: true,
    fields,
    action,
    actionLabel: actionMeta?.label ?? action,
    actionDescription: actionMeta?.description ?? '',
    displayFields,
    customerWishSummary,
    shortForm,
    suggestedModels,
    confidence: estimateConfidence(fields, action),
  };
}

function buildDisplayFields(fields, actionMeta) {
  const rows = [];
  const add = (label, value) => {
    if (value != null && value !== '' && value !== false) {
      rows.push({ label, value });
    }
  };

  add('Marke', fields.brand);
  add('Modell', fields.model);
  add('Ausstattung', fields.trimLabel);
  add('Batterie', fields.batteryLabel);
  add('Antrieb', fields.motorLabel);
  add('Farbe', fields.colorLabel);
  if (fields.packageLabels?.length) add('Pakete', fields.packageLabels.join(', '));
  add('Lagerstatus', fields.stockStatusLabel);
  add('Lieferzeit', fields.deliveryTime);
  if (fields.termMonths) add('Laufzeit', `${fields.termMonths} Monate`);
  if (fields.mileagePerYear) add('Kilometer', `${fields.mileagePerYear.toLocaleString('de-DE')} km/Jahr`);
  add('Kundengruppe', fields.customerGroupLabel);
  if (fields.downPayment) add('Anzahlung', `${fields.downPayment.toLocaleString('de-DE')} €`);
  if (fields.desiredRate) add('Budget / Rate', `bis ${fields.desiredRate} €/Monat`);
  else if (fields.desiredPrice) add('Budget / Kaufpreis', `bis ${fields.desiredPrice.toLocaleString('de-DE')} €`);
  add('Kunde', fields.customerName);
  add('Telefon', fields.customerPhone);
  add('E-Mail', fields.customerEmail);
  if (fields.leasingEndDate) add('Leasingende', fields.leasingEndDate);
  if (fields.vehicleChangeIntent) add('Fahrzeugwechsel', 'ja');
  if (fields.immediateAvailability) add('Verfügbarkeit', 'Sofort verfügbar');
  if (fields.quantity > 1) add('Anzahl', `${fields.quantity} Fahrzeuge`);
  add('Aktion', actionMeta?.label);

  return rows;
}

function formatLengthLabel(maxLengthMm) {
  if (!maxLengthMm) return null;
  const meters = (maxLengthMm / 1000).toFixed(2).replace('.', ',');
  return `maximal ca. ${meters} m Fahrzeuglänge`;
}

export function formatPaymentDisplay(fields = {}) {
  const pt = fields.paymentType ?? 'unknown';
  if (pt === 'unknown') return 'Noch unklar';
  return PAYMENT_TYPE_LABELS[pt] ?? 'Noch unklar';
}

export function formatDeliveryDisplay(fields = {}) {
  const v = fields.desiredDeliveryDate;
  if (v == null || v === '') return 'offen';
  return String(v);
}

export function formatCustomerDisplayName(name) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed || trimmed === 'Kunde (offen)') return null;
  return trimmed;
}

export function buildSalesDoneVehicleLine(fields = {}) {
  const brand = fields.brand ?? 'Kia';
  const model = String(fields.model ?? '').replace(/^Kia\s+/i, '').trim();
  const vehicle = model ? `${brand} ${model}` : brand;
  const payment = formatPaymentDisplay(fields);
  if (payment === 'Noch unklar') return vehicle;
  const paymentShort = payment.replace(' / Barzahlung', '');
  return `${vehicle} · ${paymentShort}`;
}

export function buildCompactWishSummary(fields = {}) {
  const parts = [];

  if (fields.model) {
    parts.push(String(fields.model).replace(/^Kia\s+/i, ''));
  } else if (fields.bodyType) {
    parts.push(fields.bodyType);
  }

  if (fields.motorLabel && !fields.model) {
    parts.push(fields.motorLabel);
  }

  const pt = fields.paymentType ?? 'unknown';
  if (pt !== 'unknown') {
    const label = PAYMENT_TYPE_LABELS[pt];
    parts.push(label?.replace(' / Barzahlung', '').replace('Kauf / Barzahlung', 'Kauf') ?? label);
  }

  if (fields.mileagePerYear && (pt === 'leasing' || pt === 'threeWayFinancing')) {
    parts.push(`${fields.mileagePerYear.toLocaleString('de-DE')} km`);
  }

  const budget = formatBudgetDisplay(fields);
  if (budget !== 'offen') parts.push(budget);

  if (pt === 'unknown') {
    parts.push('Angebotsart offen');
  }

  const delivery = formatDeliveryDisplay(fields);
  if (delivery === 'offen') {
    parts.push('Übergabe offen');
  } else {
    parts.push(delivery);
  }

  return parts.join(' · ') || 'Noch offen';
}

export function buildCustomerWishSummary(fields) {
  const rows = [];
  const add = (label, value) => {
    if (value != null && value !== '' && value !== false) {
      rows.push({ label, value });
    }
  };

  add('Fahrzeugart', fields.bodyType);
  add('Motor', fields.motorLabel);
  add('Getriebe', fields.transmission);
  add('Größe', formatLengthLabel(fields.maxLengthMm));
  if (fields.requiredEquipment?.length) {
    add('Pflichtausstattung', fields.requiredEquipment.join(', '));
  }
  add('Marke', fields.brand);
  add('Modell', fields.model);
  add('Ausstattung', fields.trimLabel);
  add('Farbe', fields.colorLabel);
  if (fields.packageLabels?.length) add('Pakete', fields.packageLabels.join(', '));
  add('Kundengruppe', fields.customerGroupLabel);
  add('Kunde', fields.customerName);

  return rows;
}

export function buildCustomerWishShortForm(fields) {
  const parts = [];
  const vehicle = [
    fields.brand && fields.model ? `${fields.brand} ${fields.model}` : fields.model,
    fields.motorLabel,
    fields.bodyType,
    fields.transmission ? `mit ${fields.transmission}` : null,
    formatLengthLabel(fields.maxLengthMm),
  ].filter(Boolean).join(', ');

  if (vehicle) parts.push(`Anfrage: ${vehicle}`);

  const paymentLabel = PAYMENT_TYPE_LABELS[fields.paymentType];
  if (paymentLabel && fields.paymentType !== 'unknown') {
    parts.push(`Angebotsart: ${paymentLabel}`);
  }

  if (fields.paymentType === 'cash') {
    if (fields.desiredPrice) parts.push(`Wunschpreis ca. ${fields.desiredPrice.toLocaleString('de-DE')} €`);
  } else if (fields.paymentType === 'leasing' || fields.paymentType === 'threeWayFinancing') {
    const leasing = [];
    if (fields.desiredRate) leasing.push(`Rate um ${fields.desiredRate} € monatlich`);
    if (fields.termMonths) leasing.push(`bei ${fields.termMonths} Monaten`);
    if (fields.mileagePerYear) leasing.push(`${fields.mileagePerYear.toLocaleString('de-DE')} km/Jahr`);
    if (leasing.length) parts.push(leasing.join(', '));
  } else if (fields.paymentType === 'financing') {
    const fin = [];
    if (fields.desiredRate) fin.push(`ca. ${fields.desiredRate} €/Monat`);
    if (fields.downPayment) fin.push(`mit ${fields.downPayment.toLocaleString('de-DE')} € Anzahlung`);
    if (fields.termMonths) fin.push(`${fields.termMonths} Monate`);
    if (fin.length) parts.push(`Finanzierung: ${fin.join(', ')}`);
  }

  if (fields.desiredDeliveryDate) {
    parts.push(`Übergabe: ${fields.desiredDeliveryDate}`);
  }

  if (fields.requiredEquipment?.length) {
    parts.push(`Ausstattung: ${fields.requiredEquipment.join(', ')}`);
  }

  return parts.join('. ').trim() || fields.rawText?.slice(0, 280) || '';
}

function rebuildParsed(parsed, fields, action) {
  const actionMeta = DEALER_AI_ACTIONS[action] ?? DEALER_AI_ACTIONS.create_offer;
  return {
    ...parsed,
    action,
    actionLabel: actionMeta.label,
    actionDescription: actionMeta.description,
    fields,
    displayFields: buildDisplayFields(fields, actionMeta),
    customerWishSummary: buildCustomerWishSummary(fields),
    shortForm: buildCustomerWishShortForm(fields),
    suggestedModels: matchSuggestedModels(fields),
    confidence: estimateConfidence(fields, action),
  };
}

function estimateConfidence(fields, action) {
  let score = 0.35;
  if (fields.brand && fields.model) score += 0.2;
  if (fields.trimLabel || fields.trimId) score += 0.1;
  if (fields.motorLabel || fields.engineId) score += 0.1;
  if (fields.paymentType && fields.paymentType !== 'unknown') score += 0.15;
  if (fields.paymentType === 'cash') {
    if (fields.desiredPrice) score += 0.05;
  } else if (fields.paymentType === 'leasing' || fields.paymentType === 'threeWayFinancing') {
    if (fields.termMonths || fields.mileagePerYear || fields.desiredRate) score += 0.1;
  } else if (fields.paymentType === 'financing') {
    if (fields.desiredRate || fields.downPayment) score += 0.1;
  }
  if (fields.desiredDeliveryDate) score += 0.05;
  if (action) score += 0.05;
  return Math.min(0.98, Math.round(score * 100) / 100);
}

export function getActionsForPaymentType(paymentType) {
  const base = ['create_sales_opportunity', 'show_suggestions', 'draft_reply'];
  switch (paymentType) {
    case 'cash':
      return ['create_sales_opportunity', 'create_cash_offer', 'create_offer', ...base.slice(1)];
    case 'leasing':
      return ['create_sales_opportunity', 'create_leasing_offer', 'create_offer', ...base.slice(1)];
    case 'financing':
      return ['create_sales_opportunity', 'create_financing_offer', 'create_offer', ...base.slice(1)];
    case 'threeWayFinancing':
      return ['create_sales_opportunity', 'create_three_way_offer', 'create_offer', ...base.slice(1)];
    default:
      return DEALER_AI_SELLER_ACTIONS;
  }
}

export function getRecognizedSummary(parsed) {
  if (!parsed?.ok) return null;
  return parsed.displayFields;
}

/**
 * Erkannte Felder manuell anpassen (Dropdowns/Chips) und Anzeige aktualisieren.
 * @param {object} parsed
 * @param {object} patch
 */
export function applyDealerAiFields(parsed, patch) {
  if (!parsed?.ok) return parsed;

  let action = patch.action ?? parsed.action;
  const fields = {
    ...parsed.fields,
    ...patch,
  };
  delete fields.action;

  if (patch.paymentType && !patch.action) {
    action = suggestActionForPaymentType(patch.paymentType);
  }

  if (patch.paymentType === 'cash') {
    fields.desiredRate = null;
  } else if (patch.paymentType && patch.paymentType !== 'unknown') {
    fields.desiredPrice = null;
  }

  if (fields.desiredRate != null && fields.desiredRate === fields.termMonths && isLeaseTermMonth(fields.termMonths)) {
    fields.desiredRate = null;
  }

  return rebuildParsed(parsed, fields, action);
}

/**
 * Laufzeit manuell setzen (Verkäufer-Dropdown) und Anzeige aktualisieren.
 * @param {object} parsed
 * @param {number|null} termMonths
 */
export function applyDealerAiTermMonths(parsed, termMonths) {
  return applyDealerAiFields(parsed, { termMonths: termMonths ? Number(termMonths) : null });
}
