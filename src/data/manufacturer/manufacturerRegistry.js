import { kiaSportage } from '../models/kia/sportage.js';
import { kiaEv2 } from './kia/ev2.js';
import { kiaEv3 } from './kia/ev3.js';
import { kiaEv4 } from './kia/ev4.js';
import { kiaEv5 } from './kia/ev5.js';
import { kiaEv6 } from './kia/ev6.js';
import { kiaEv9 } from './kia/ev9.js';
import { kiaPicanto } from './kia/picanto.js';
import { kiaNiro } from './kia/niro.js';
import { kiaCeed } from './kia/ceed.js';
import { kiaStonic } from './kia/stonic.js';
import { kiaXceed } from './kia/xceed.js';

/** Zentrale Herstellerdatenbank – von Platform Admin gepflegt */
export const MANUFACTURER_MODELS = {
  sportage: {
    key: 'sportage',
    brand: 'Kia',
    model: 'Sportage',
    label: 'Kia Sportage',
    data: kiaSportage,
    engine: 'sportage',
    defaultTrimId: 'spirit',
    defaultEngineId: 'tgi-hybrid-2wd',
  },
  ev2: {
    key: 'ev2',
    brand: 'Kia',
    model: 'EV2',
    label: 'Kia EV2',
    data: kiaEv2,
    engine: 'ev2',
    defaultTrimId: 'earth',
    defaultEngineId: 'ev-long',
  },
  ev3: {
    key: 'ev3',
    brand: 'Kia',
    model: 'EV3',
    label: 'Kia EV3',
    data: kiaEv3,
    engine: 'ev3',
    defaultTrimId: 'earth',
    defaultEngineId: 'ev-long',
  },
  ev4: {
    key: 'ev4',
    brand: 'Kia',
    model: 'EV4',
    label: 'Kia EV4',
    data: kiaEv4,
    engine: 'ev4',
    defaultTrimId: 'earth',
    defaultEngineId: 'ev-long',
  },
  ev5: {
    key: 'ev5',
    brand: 'Kia',
    model: 'EV5',
    label: 'Kia EV5',
    data: kiaEv5,
    engine: 'ev5',
    defaultTrimId: 'earth',
    defaultEngineId: 'ev-long',
  },
  ev6: {
    key: 'ev6',
    brand: 'Kia',
    model: 'EV6',
    label: 'Kia EV6',
    data: kiaEv6,
    engine: 'ev6',
    defaultTrimId: 'earth',
    defaultEngineId: 'ev-long',
  },
  ev9: {
    key: 'ev9',
    brand: 'Kia',
    model: 'EV9',
    label: 'Kia EV9',
    data: kiaEv9,
    engine: 'ev9',
    defaultTrimId: 'earth',
    defaultEngineId: 'ev-long-rwd',
  },
  stonic: {
    key: 'stonic',
    brand: 'Kia',
    model: 'Stonic',
    label: 'Kia Stonic',
    data: kiaStonic,
    engine: 'stonic',
    defaultTrimId: 'spirit',
    defaultEngineId: 'tgi-dct',
  },
  xceed: {
    key: 'xceed',
    brand: 'Kia',
    model: 'XCeed',
    label: 'Kia XCeed',
    data: kiaXceed,
    engine: 'xceed',
    defaultTrimId: 'spirit',
    defaultEngineId: 'tgi-dct-150',
  },
  picanto: {
    key: 'picanto',
    brand: 'Kia',
    model: 'Picanto',
    label: 'Kia Picanto',
    data: kiaPicanto,
    engine: 'picanto',
    defaultTrimId: 'vision',
    defaultEngineId: 'mt5',
  },
  niro: {
    key: 'niro',
    brand: 'Kia',
    model: 'Niro',
    label: 'Kia Niro',
    data: kiaNiro,
    engine: 'niro',
    defaultTrimId: 'spirit',
    defaultEngineId: 'hybrid',
  },
  ceed: {
    key: 'ceed',
    brand: 'Kia',
    model: 'Ceed',
    label: 'Kia Ceed',
    data: kiaCeed,
    engine: 'ceed',
    defaultTrimId: 'spirit',
    defaultEngineId: 't-gdi',
  },
};

export function normalizeManufacturerKey(brand, model) {
  const m = (model ?? '').toLowerCase();
  if (m.includes('sportage') && (m.includes('phev') || m.includes('plug-in'))) return 'sportage-phev';
  if (m.includes('sportage') && m.includes('hybrid')) return 'sportage-hybrid';
  if (m.includes('sportage')) return 'sportage';
  if (m.includes('ev2')) return 'ev2';
  if (m.includes('ev3')) return 'ev3';
  if (m.includes('ev4') && m.includes('fastback')) return 'ev4-fastback';
  if (m.includes('ev4')) return 'ev4';
  if (m.includes('ev5') && m.includes('gt')) return 'ev5-gt';
  if (m.includes('ev5')) return 'ev5';
  if (m.includes('ev6') && m.includes('gt')) return 'ev6-gt';
  if (m.includes('ev6')) return 'ev6';
  if (m.includes('ev9') && m.includes('gt')) return 'ev9-gt';
  if (m.includes('ev9')) return 'ev9';
  if (m.includes('sorento') && (m.includes('phev') || m.includes('plug-in'))) return 'sorento-phev';
  if (m.includes('sorento') && m.includes('hybrid')) return 'sorento-hybrid';
  if (m.includes('sorento')) return 'sorento';
  if (m.includes('picanto')) return 'picanto';
  if (m.includes('niro')) return 'niro';
  if (m.includes('ceed')) return 'ceed';
  if (m.includes('stonic')) return 'stonic';
  if (m.includes('seltos')) return 'seltos';
  if (m.includes('xceed')) return 'xceed';
  if (m.includes('k4') && m.includes('sportswagon')) return 'k4-sportswagon';
  if (m.includes('k4')) return 'k4';
  if (MANUFACTURER_MODELS[m]) return m;
  return null;
}

export function getManufacturerModel(brand, model) {
  const key = normalizeManufacturerKey(brand, model);
  return key ? MANUFACTURER_MODELS[key] ?? null : null;
}

export function listManufacturerModels() {
  return Object.values(MANUFACTURER_MODELS);
}

export function getManufacturerTrims(modelKey) {
  return MANUFACTURER_MODELS[modelKey]?.data?.trims ?? [];
}

export function getManufacturerPackages(modelKey) {
  return MANUFACTURER_MODELS[modelKey]?.data?.packages ?? [];
}

export function getManufacturerEquipment(modelKey) {
  return MANUFACTURER_MODELS[modelKey]?.data?.equipment ?? [];
}

export function getManufacturerAccessories(modelKey) {
  return MANUFACTURER_MODELS[modelKey]?.data?.accessories ?? [];
}
