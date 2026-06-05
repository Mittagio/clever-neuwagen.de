import { kiaSportage } from '../models/kia/sportage.js';
import { kiaEv3 } from './kia/ev3.js';
import { kiaEv4 } from './kia/ev4.js';
import { kiaPicanto } from './kia/picanto.js';
import { kiaNiro } from './kia/niro.js';
import { kiaCeed } from './kia/ceed.js';

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
  if (m.includes('sportage')) return 'sportage';
  if (m.includes('ev3')) return 'ev3';
  if (m.includes('ev4')) return 'ev4';
  if (m.includes('picanto')) return 'picanto';
  if (m.includes('niro')) return 'niro';
  if (m.includes('ceed')) return 'ceed';
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
