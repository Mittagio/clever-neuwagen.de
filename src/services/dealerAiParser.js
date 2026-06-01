/**
 * Dealer AI – regelbasierte Mock-Erkennung (später LLM / Whisper)
 */
import { sportage } from '../data/kiaSportage.js';
import { resolveTrimId, resolveEngineId, resolveColorId } from '../data/models/kia/sportageAdapter.js';

export const DEALER_AI_ACTIONS = {
  create_offer: {
    id: 'create_offer',
    label: 'Angebot erstellen',
    description: 'Angebot im Angebotssystem anlegen',
  },
  create_customer_offer: {
    id: 'create_customer_offer',
    label: 'Kundenangebot erstellen',
    description: 'Personalisiertes Angebot mit Verkaufschancen-Verknüpfung',
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
  { re: /\bearth\b/i, id: null, label: 'Earth' },
  { re: /\bair\b/i, id: null, label: 'Air' },
  { re: /\blong[\s-]?range\b/i, id: null, label: 'Long Range' },
];

const MOTOR_ALIASES = [
  { re: /\bhybrid\b/i, id: 'tgi-hybrid-2wd', label: 'Hybrid' },
  { re: /\bplug[\s-]?in|phev\b/i, id: 'tgi-hybrid-awd', label: 'Plug-in Hybrid' },
  { re: /\bdiesel\b/i, id: 'crdi-dct-2wd', label: 'Diesel' },
  { re: /\bbenzin|t-gdi|tgi\b/i, id: 'tgi-dct-2wd', label: 'Benzin T-GDI' },
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

function parseTermMonths(text) {
  const m = text.match(/(\d+)\s*monat/i);
  return m ? Number(m[1]) : null;
}

function parseDownPayment(text) {
  const m = text.match(/(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*€?\s*anzahlung/i)
    ?? text.match(/anzahlung\s*(?:von\s*)?(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*€?/i);
  if (!m) return null;
  return parseNumber(m[1].replace(/\s/g, ''));
}

function parseDesiredRate(text) {
  const m = text.match(/(?:wunschrate|leasing\s*ab|rate)\s*(?:ab\s*)?(\d{2,4})\s*€?/i)
    ?? text.match(/(\d{2,4})\s*€?\s*(?:monat|mt|\/mt)/i);
  if (!m) return null;
  return parseNumber(m[1]);
}

function parseQuantity(text) {
  const word = text.match(/\b(ein|eine|einer|zwei|drei|vier|fünf)\b/i);
  if (word) return WORD_NUMBERS[word[1].toLowerCase()] ?? null;
  const num = text.match(/\b(\d+)\s*(?:stück|fahrzeug|sportage|ev3)/i);
  return num ? Number(num[1]) : null;
}

function parseCustomerName(text) {
  const m = text.match(/(?:für|an)\s+(?:herrn|frau|hr\.|fr\.)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)/i)
    ?? text.match(/(?:für)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)\s+(?:ein|eine|einen)/i);
  return m ? m[1].trim() : null;
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
  if (/ev\s*3|ev3/.test(lower)) {
    return { brand: 'Kia', model: 'EV3', modelId: 'ev3' };
  }
  if (/ev\s*4|ev4/.test(lower)) {
    return { brand: 'Kia', model: 'EV4', modelId: 'ev4' };
  }
  if (/sportage/.test(lower)) {
    return { brand: 'Kia', model: 'Sportage', modelId: 'sportage' };
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
  if (/sofort verfügbar|auf lager/.test(lower) && !fields.customerName) {
    return 'create_inventory';
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
  const text = normalizeText(rawText);
  if (!text || text.length < 8) {
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
    termMonths: parseTermMonths(text),
    mileagePerYear: parseMileage(text),
    downPayment: parseDownPayment(text),
    customerGroup: customerGroupHit?.id ?? null,
    customerGroupLabel: customerGroupHit?.label ?? null,
    desiredRate: parseDesiredRate(text),
    customerName: parseCustomerName(text),
    quantity,
    rawText: text,
  };

  if (fields.modelId === 'sportage' || fields.model === 'Sportage') {
    fields = resolveSportageConfig(fields);
  }

  const action = detectAction(text, fields);
  const actionMeta = DEALER_AI_ACTIONS[action];

  const displayFields = buildDisplayFields(fields, actionMeta);

  return {
    ok: true,
    fields,
    action,
    actionLabel: actionMeta?.label ?? action,
    actionDescription: actionMeta?.description ?? '',
    displayFields,
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
  add('Antrieb', fields.motorLabel);
  add('Farbe', fields.colorLabel);
  if (fields.packageLabels?.length) add('Pakete', fields.packageLabels.join(', '));
  add('Lagerstatus', fields.stockStatusLabel);
  add('Lieferzeit', fields.deliveryTime);
  if (fields.termMonths) add('Laufzeit', `${fields.termMonths} Monate`);
  if (fields.mileagePerYear) add('Kilometer', `${fields.mileagePerYear.toLocaleString('de-DE')} km/Jahr`);
  add('Kundengruppe', fields.customerGroupLabel);
  if (fields.downPayment) add('Anzahlung', `${fields.downPayment.toLocaleString('de-DE')} €`);
  if (fields.desiredRate) add('Wunschrate', `${fields.desiredRate} €/Monat`);
  add('Kunde', fields.customerName);
  if (fields.quantity > 1) add('Anzahl', `${fields.quantity} Fahrzeuge`);
  add('Aktion', actionMeta?.label);

  return rows;
}

function estimateConfidence(fields, action) {
  let score = 0.35;
  if (fields.brand && fields.model) score += 0.2;
  if (fields.trimLabel || fields.trimId) score += 0.15;
  if (fields.motorLabel || fields.engineId) score += 0.1;
  if (fields.termMonths || fields.mileagePerYear || fields.desiredRate) score += 0.1;
  if (action) score += 0.1;
  return Math.min(0.98, Math.round(score * 100) / 100);
}

export function getRecognizedSummary(parsed) {
  if (!parsed?.ok) return null;
  return parsed.displayFields;
}
