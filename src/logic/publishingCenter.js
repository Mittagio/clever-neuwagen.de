import { sportage } from '../data/kiaSportage.js';
import { calculatePrice } from './priceCalculator.js';
import { generateListingBlocks } from './listingGenerator.js';
import {
  appendLegalBlockToText,
  validateVehicleCompliance,
} from './complianceShield.js';

const LEASING_DEFAULTS = {
  termMonths: 48,
  mileagePerYear: 10000,
  downPayment: 0,
  customerGroup: 'standard',
};

function getTrim(trimId) {
  return sportage.trims.find((t) => t.id === trimId);
}

function getEngine(engineId) {
  return sportage.engines.find((e) => e.id === engineId);
}

function buildVehicleHeadline(config, conditions) {
  const trim = getTrim(config.trimId);
  const engine = getEngine(config.engineId);
  const price = calculatePrice(
    {
      ...config,
      paymentType: 'leasing',
      ...LEASING_DEFAULTS,
      selectedPackageIds: config.packageIds ?? [],
    },
    conditions,
  );

  return {
    trim,
    engine,
    leasingRate: price.leasingRate,
    cashPrice: price.cashPrice,
    delivery: conditions.deliveryTime?.[config.trimId] ?? conditions.defaultDelivery ?? '4–6 Wochen',
    inventoryLabel: config.inventoryLabel ?? 'Auf Anfrage',
  };
}

function wltpFooter(validation) {
  if (validation?.requiredLegalBlock) return validation.requiredLegalBlock;
  return '';
}

export const PUBLISHING_CHANNELS = [
  { id: 'mobile', label: 'mobile.de', icon: '📋', buttonLabel: 'mobile.de Text kopieren' },
  { id: 'leasingmarkt', label: 'Leasingmarkt', icon: '📋', buttonLabel: 'Leasingmarkt Text kopieren' },
  { id: 'facebook', label: 'Facebook', icon: '📋', buttonLabel: 'Facebook Post kopieren' },
  { id: 'instagram', label: 'Instagram', icon: '📋', buttonLabel: 'Instagram Post kopieren' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '📋', buttonLabel: 'WhatsApp Text kopieren' },
  { id: 'email', label: 'E-Mail', icon: '📋', buttonLabel: 'E-Mail Text kopieren' },
  { id: 'homepage', label: 'Homepage', icon: '📋', buttonLabel: 'Homepage Text kopieren' },
];

export function generatePublishingTexts(config, conditions) {
  const vehicleRef = {
    engineId: config.engineId,
    trimId: config.trimId,
    brand: 'Kia',
    model: 'Sportage',
  };
  const validation = validateVehicleCompliance(vehicleRef);

  if (!validation.publishable) {
    return { texts: null, validation };
  }

  const blocks = generateListingBlocks(config, conditions, { skipComplianceAppend: true });
  const head = buildVehicleHeadline(config, conditions);
  const vehicleLine = `${sportage.brand} ${sportage.model} ${head.trim?.name} · ${head.engine?.name}`;
  const rateLine = head.leasingRate != null
    ? `ab ${head.leasingRate.toLocaleString('de-DE')} €/Monat*`
    : `ab ${head.cashPrice?.toLocaleString('de-DE')} €`;
  const footer = wltpFooter(validation);

  const baseExtras = [
    `Lieferzeit: ${head.delivery}`,
    `Status: ${head.inventoryLabel}`,
    blocks.serienausstattung.split('\n').slice(2, 5).map((l) => l.replace(/^• /, '')).join(' · '),
  ].filter(Boolean).join('\n');

  const texts = {
    mobile: [
      blocks.mobileTitle,
      '',
      vehicleLine,
      rateLine,
      baseExtras,
      '',
      blocks.leasingExample,
      '',
      blocks.wltpBlock,
      '',
      blocks.rechtstext,
    ].join('\n'),

    leasingmarkt: [
      `${vehicleLine} – Leasing`,
      rateLine,
      `Laufzeit ${LEASING_DEFAULTS.termMonths} Monate · ${LEASING_DEFAULTS.mileagePerYear.toLocaleString('de-DE')} km/J`,
      head.delivery,
      '',
      blocks.leasingExample,
      '',
      footer,
    ].join('\n'),

    facebook: [
      `🚗 ${vehicleLine}`,
      `${rateLine} | ${head.delivery}`,
      '',
      '✨ Highlights:',
      ...blocks.serienausstattung.split('\n').slice(2, 6).map((l) => l),
      '',
      `📍 ${conditions.dealerName}, ${conditions.city}`,
      'Jetzt Beratung anfragen – Link in Bio / clever-neuwagen.de',
      '',
      footer,
    ].join('\n'),

    instagram: [
      `${sportage.brand} ${sportage.model} ${head.trim?.name} ✨`,
      `${rateLine.replace('*', '')} · ${head.delivery}`,
      '',
      '#Kia #Neuwagen #Leasing #Elektro #SUV',
      '',
      footer,
    ].join('\n'),

    whatsapp: [
      `Hallo! Unser Angebot:`,
      `${vehicleLine}`,
      `${rateLine}`,
      `Lieferzeit: ${head.delivery}`,
      '',
      'Ausstattung u. a.:',
      ...blocks.serienausstattung.split('\n').slice(2, 5),
      '',
      'Unverbindlich – gerne Termin vereinbaren.',
      conditions.contact?.phone ? `Tel. ${conditions.contact.phone}` : '',
    ].filter(Boolean).join('\n'),

    email: [
      `Betreff: ${vehicleLine} – Ihr Angebot`,
      '',
      'Guten Tag,',
      '',
      `vielen Dank für Ihr Interesse am ${vehicleLine}.`,
      '',
      rateLine,
      `Lieferzeit: ${head.delivery}`,
      '',
      blocks.leasingExample,
      '',
      blocks.ansprechpartner,
      '',
      'Mit freundlichen Grüßen',
      conditions.dealerName,
    ].join('\n'),

    homepage: [
      `<h2>${vehicleLine}</h2>`,
      `<p><strong>${rateLine}</strong> · ${head.delivery}</p>`,
      `<ul>`,
      ...blocks.serienausstattung.split('\n').slice(2, 8).map((l) => `<li>${l.replace(/^• /, '')}</li>`),
      `</ul>`,
      `<p><small>${footer}</small></p>`,
    ].join('\n'),
  };

  const withLegal = {};
  Object.keys(texts).forEach((key) => {
    withLegal[key] = appendLegalBlockToText(texts[key], validation);
  });

  return { texts: withLegal, validation };
}

export const PUBLISHING_VEHICLES = [
  {
    id: 'sportage-spirit',
    label: 'Kia Sportage Spirit',
    defaultConfig: {
      engineId: 'tgi-hybrid-2wd',
      trimId: 'spirit',
      colorId: 'wolfgrau',
      packageIds: ['p1-comfort'],
      inventoryLabel: '🟢 Lagerfahrzeug',
    },
  },
  {
    id: 'sportage-gtline',
    label: 'Kia Sportage GT-Line',
    defaultConfig: {
      engineId: 'tgi-hybrid-awd',
      trimId: 'gt-line',
      colorId: 'blueflame-schwarz',
      packageIds: [],
      inventoryLabel: '🟡 Vorlauf',
    },
  },
];
