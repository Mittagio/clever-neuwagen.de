/**
 * Ober-Admin Katalog – Marken & Modelle (Clever-Neuwagen zentral)
 * Händler dürfen diese Daten nicht ändern.
 */
import {
  KIA_OFFICIAL_MODELS,
  KIA_PRICE_LIST_META,
  KIA_OFFICIAL_MODEL_ALIASES,
} from './kia/kiaOfficialPriceList.js';

export const BRAND_STATUS = {
  active: { label: 'Aktiv', className: 'status-active' },
  planned: { label: 'Geplant', className: 'status-planned' },
};

export const MODEL_STATUS = {
  complete: { label: 'Vollständig gepflegt', className: 'status-complete' },
  review: { label: 'Prüfung nötig', className: 'status-review' },
  outdated: { label: 'Veraltet', className: 'status-outdated' },
  draft: { label: 'Entwurf', className: 'status-draft' },
};

export const CHANGE_STATUS = {
  published: { label: 'Veröffentlicht', className: 'status-active' },
  review: { label: 'In Prüfung', className: 'status-review' },
  draft: { label: 'Entwurf', className: 'status-draft' },
};

export const brands = [
  { id: 'kia', name: 'Kia', status: 'active', modelCount: KIA_OFFICIAL_MODELS.length + 1 },
  { id: 'hyundai', name: 'Hyundai', status: 'planned', modelCount: 0 },
  { id: 'vw', name: 'VW', status: 'planned', modelCount: 0 },
  { id: 'bmw', name: 'BMW', status: 'planned', modelCount: 0 },
  { id: 'mercedes', name: 'Mercedes-Benz', status: 'planned', modelCount: 0 },
];

const REGISTRY_DETAIL_IDS = new Set(['sportage', 'ev3', 'ev4', 'picanto', 'niro', 'ceed']);

const REGISTRY_STATUS = {
  sportage: 'complete',
  ev3: 'review',
  ev4: 'review',
  ev5: 'draft',
  sorento: 'draft',
  picanto: 'review',
  niro: 'draft',
  ceed: 'draft',
};

function mapOfficialToAdminModel(entry) {
  const registryKey = entry.registryKey ?? entry.id;
  const status = REGISTRY_STATUS[registryKey] ?? 'draft';
  return {
    id: entry.id,
    name: entry.name,
    segment: entry.segment,
    status,
    hasDetail: REGISTRY_DETAIL_IDS.has(registryKey),
    priceFromGross: entry.priceFromGross,
    monthlyRateFrom: entry.monthlyRateFrom,
    powertrain: entry.powertrain,
    registryKey,
    priceListSource: KIA_PRICE_LIST_META.sourceLabel,
    priceListValidUntil: KIA_PRICE_LIST_META.validUntil,
  };
}

export const kiaModels = [
  ...KIA_OFFICIAL_MODELS.map(mapOfficialToAdminModel),
  {
    id: KIA_OFFICIAL_MODEL_ALIASES.ceed.id,
    name: KIA_OFFICIAL_MODEL_ALIASES.ceed.name,
    segment: 'Kompakt',
    status: 'review',
    hasDetail: false,
    priceFromGross: null,
    monthlyRateFrom: null,
    powertrain: 'verbrenner',
    registryKey: 'ceed',
    priceListSource: KIA_PRICE_LIST_META.sourceLabel,
    priceListValidUntil: KIA_PRICE_LIST_META.validUntil,
    note: KIA_OFFICIAL_MODEL_ALIASES.ceed.note,
  },
];

export const SPORTAGE_TABS = [
  { id: 'grunddaten', label: 'Grunddaten' },
  { id: 'motoren', label: 'Motoren' },
  { id: 'ausstattungen', label: 'Ausstattungen' },
  { id: 'farben', label: 'Farben' },
  { id: 'pakete', label: 'Pakete' },
  { id: 'serienausstattung', label: 'Serienausstattung' },
  { id: 'wltp', label: 'WLTP' },
  { id: 'bilder', label: 'Bilder' },
  { id: 'aenderungsverlauf', label: 'Verlauf' },
];

export const DEALER_READONLY_NOTE =
  'Händler dürfen diese Stammdaten nicht ändern. Sie dienen nur als Grundlage für Konfigurator und Angebote. Händler pflegen separat: Rabatt, Leasingfaktoren, Finanzierung, Lieferzeit, Lager/Vorlauf.';
