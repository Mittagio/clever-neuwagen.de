import { sportage, formatPrice, getUpe } from '../data/kiaSportage.js';
import { RATE_DISCLAIMER } from '../constants/legal.js';
import { calculatePrice } from './priceCalculator.js';

const LEASING_DEFAULTS = {
  termMonths: 48,
  mileagePerYear: 10000,
  downPayment: 0,
  customerGroup: 'standard',
};

function fmt(value) {
  return formatPrice(value);
}

function getEngine(engineId) {
  return sportage.engines.find((e) => e.id === engineId);
}

function getTrim(trimId) {
  return sportage.trims.find((t) => t.id === trimId);
}

function getColor(colorId) {
  return sportage.colors.find((c) => c.id === colorId);
}

function getWltp(engineId) {
  return sportage.wltp.find((w) => w.engineId === engineId);
}

/**
 * mobile.de-Titel – kompakt, keyword-reich
 */
function buildMobileTitle(config) {
  const engine = getEngine(config.engineId);
  const trim = getTrim(config.trimId);
  const color = getColor(config.colorId);
  const highlights = sportage.equipment[config.trimId]?.standard?.slice(0, 3) ?? [];
  const extras = highlights.map((h) => {
    if (h.includes('LED')) return 'LED';
    if (h.includes('Kamera')) return 'Rückfahrkamera';
    if (h.includes('Navigation')) return 'Navi';
    return null;
  }).filter(Boolean);

  const parts = [
    `${sportage.brand} ${sportage.model}`,
    engine?.name,
    trim?.name,
    color?.name,
    ...extras,
    `${sportage.modelYear}`,
  ].filter(Boolean);

  let title = parts.join(' | ');
  if (title.length > 80) {
    title = `${sportage.brand} ${sportage.model} ${engine?.name} ${trim?.name} ${sportage.modelYear}`;
  }
  return title.slice(0, 80);
}

function buildLeasingExample(config, conditions) {
  const price = calculatePrice(
    {
      ...config,
      paymentType: 'leasing',
      ...LEASING_DEFAULTS,
      selectedPackageIds: config.packageIds ?? [],
    },
    conditions,
  );

  return [
    'LEASINGBEISPIEL',
    '',
    `${sportage.brand} ${sportage.model} ${getTrim(config.trimId)?.name}`,
    `${getEngine(config.engineId)?.name} · ${getColor(config.colorId)?.name}`,
    '',
    `Monatliche Rate: ${fmt(price.leasingRate)}`,
    `Laufzeit: ${LEASING_DEFAULTS.termMonths} Monate`,
    `Laufleistung: ${LEASING_DEFAULTS.mileagePerYear.toLocaleString('de-DE')} km/Jahr`,
    `Anzahlung: ${fmt(LEASING_DEFAULTS.downPayment)}`,
    `Bereitstellung: ${fmt(price.preparationFee)}`,
    '',
    `Bruttolistenpreis: ${fmt(price.configurationPrice)}`,
    `Effektiver Jahreszins: ${conditions.financing?.effectiveRate ?? 3.99} %`,
    '',
    'Unverbindliches Leasingbeispiel der Kia Leasing GmbH bzw. des Anbieters.',
    'Bonität vorausgesetzt. Alle Preise inkl. MwSt.',
  ].join('\n');
}

function buildFinanceExample(config, conditions) {
  const basePrice = calculatePrice(
    {
      ...config,
      paymentType: 'cash',
      selectedPackageIds: config.packageIds ?? [],
    },
    conditions,
  );

  const downPaymentPercent = conditions.financing?.downPaymentPercent ?? 20;
  const downPayment = Math.round(basePrice.cashPrice * downPaymentPercent / 100);

  const financePrice = calculatePrice(
    {
      ...config,
      paymentType: 'finance',
      termMonths: 60,
      downPayment,
      selectedPackageIds: config.packageIds ?? [],
    },
    conditions,
  );

  return [
    'FINANZIERUNGSBEISPIEL',
    '',
    `${sportage.brand} ${sportage.model} ${getTrim(config.trimId)?.name}`,
    '',
    `Monatliche Rate: ${fmt(financePrice.financeRate)}`,
    `Laufzeit: 60 Monate`,
    `Anzahlung: ${fmt(downPayment)} (${conditions.financing?.downPaymentPercent ?? 20} %)`,
    `Schlussrate: ca. ${fmt(financePrice.financeBalloon)}`,
    `Effektiver Jahreszins: ${conditions.financing?.effectiveRate ?? 3.99} %`,
    `Nettodarlehensbetrag: ${fmt(financePrice.cashPrice - downPayment)}`,
    '',
    RATE_DISCLAIMER,
    'Bonität vorausgesetzt. Alle Preise inkl. MwSt.',
  ].join('\n');
}

function buildWltpBlock(engineId) {
  const engine = getEngine(engineId);
  const wltp = getWltp(engineId);
  if (!wltp || !engine) return 'WLTP-Daten nicht verfügbar.';

  const lines = [
    'VERBRAUCHS- UND EMMISSIONSWERTE (WLTP)',
    '',
    `Motor: ${engine.name} (${engine.power} ${engine.powerUnit})`,
    '',
    `Kraftstoffverbrauch kombiniert: ${wltp.consumptionCombined.min}–${wltp.consumptionCombined.max} ${wltp.consumptionCombined.unit}`,
    `CO₂-Emissionen kombiniert: ${wltp.co2Combined.min}–${wltp.co2Combined.max} ${wltp.co2Combined.unit}`,
    `Effizienzklasse: ${wltp.efficiencyClass}`,
  ];

  if (wltp.electricRange) {
    lines.push(
      `Elektrische Reichweite: ${wltp.electricRange.min}–${wltp.electricRange.max} ${wltp.electricRange.unit}`,
    );
  }

  lines.push(
    '',
    'Die angegebenen Werte wurden nach dem WLTP-Prüfverfahren ermittelt.',
  );

  return lines.join('\n');
}

function buildSerienausstattung(trimId) {
  const eq = sportage.equipment[trimId]?.standard ?? [];
  return [
    'SERIENAUSSTATTUNG',
    '',
    ...eq.map((item) => `• ${item}`),
  ].join('\n');
}

function buildSonderausstattung(config) {
  const color = getColor(config.colorId);
  const packages = (config.packageIds ?? [])
    .map((id) => sportage.packages.find((p) => p.id === id))
    .filter(Boolean);
  const optional = sportage.equipment[config.trimId]?.optional ?? [];

  const lines = ['SONDERAUSSTATTUNG', ''];

  if (color) {
    lines.push(`• Lackierung: ${color.name}${color.price ? ` (+${fmt(color.price)})` : ''}`);
  }

  packages.forEach((pkg) => {
    lines.push(`• ${pkg.name}: ${pkg.description} (+${fmt(pkg.price)})`);
  });

  optional.forEach((item) => {
    lines.push(`• ${item} (optional)`);
  });

  if (lines.length === 2) {
    lines.push('• Keine zusätzliche Sonderausstattung gewählt');
  }

  return lines.join('\n');
}

function buildAnsprechpartner(conditions) {
  const c = conditions.contact ?? {};
  return [
    'ANSPRECHPARTNER',
    '',
    conditions.dealerName,
    c.name ? `${c.name}${c.role ? ` – ${c.role}` : ''}` : '',
    c.phone ? `Tel.: ${c.phone}` : '',
    c.email ? `E-Mail: ${c.email}` : '',
    conditions.address ? `${conditions.address}` : '',
    `${conditions.plz} ${conditions.city}`,
  ].filter(Boolean).join('\n');
}

function buildRechtstext(conditions) {
  return [
    'RECHTLICHE HINWEISE',
    '',
    `${sportage.brand} ${sportage.model} – Abbildungen können Sonderausstattungen zeigen.`,
    '',
    'Alle Angaben ohne Gewähr. Irrtümer und Zwischenverkauf vorbehalten.',
    'Verbindliches Angebot nur schriftlich durch den Händler.',
    '',
    'Leasing- und Finanzierungsbeispiele sind unverbindlich und bonitätsabhängig.',
    'Anbieter: ' + (conditions.dealerName ?? 'Autohaus'),
    '',
    `Stand: ${sportage.admin.priceListDate} · Preisliste ${sportage.admin.priceListSource}`,
    '',
    'Es gelten die AGB des jeweiligen Anbieters und des Händlers.',
  ].join('\n');
}

export const LISTING_BLOCK_KEYS = [
  { id: 'mobileTitle', label: 'mobile.de Titel', short: 'Titel' },
  { id: 'leasingExample', label: 'Leasingbeispiel', short: 'Leasing' },
  { id: 'financeExample', label: 'Finanzierungsbeispiel', short: 'Finanzierung' },
  { id: 'wltpBlock', label: 'WLTP Block', short: 'WLTP' },
  { id: 'serienausstattung', label: 'Serienausstattung', short: 'Serie' },
  { id: 'sonderausstattung', label: 'Sonderausstattung', short: 'Sonder' },
  { id: 'ansprechpartner', label: 'Ansprechpartner', short: 'Kontakt' },
  { id: 'rechtstext', label: 'Rechtstext', short: 'Recht' },
];

export function generateListingBlocks(config, conditions) {
  const normalized = {
    engineId: config.engineId ?? sportage.engines[0].id,
    trimId: config.trimId ?? sportage.trims[0].id,
    colorId: config.colorId ?? sportage.colors[0].id,
    packageIds: config.packageIds ?? [],
  };

  return {
    mobileTitle: buildMobileTitle(normalized),
    leasingExample: buildLeasingExample(normalized, conditions),
    financeExample: buildFinanceExample(normalized, conditions),
    wltpBlock: buildWltpBlock(normalized.engineId),
    serienausstattung: buildSerienausstattung(normalized.trimId),
    sonderausstattung: buildSonderausstattung(normalized),
    ansprechpartner: buildAnsprechpartner(conditions),
    rechtstext: buildRechtstext(conditions),
    meta: {
      upe: getUpe(normalized.trimId, normalized.engineId),
      vehicle: `${sportage.brand} ${sportage.model}`,
    },
  };
}

export const GENERATOR_VEHICLES = [
  {
    id: 'sportage',
    label: 'Kia Sportage',
    defaultConfig: {
      engineId: 'tgi-hybrid-2wd',
      trimId: 'spirit',
      colorId: 'wolfgrau',
      packageIds: ['p1-comfort'],
    },
  },
];
