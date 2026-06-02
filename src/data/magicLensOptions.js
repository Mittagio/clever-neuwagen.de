import { MARKETPLACE_TYPE_OPTIONS } from './marketplaceVehicles.js';
import { FEATURE_CATALOG } from './features/featureCatalog.js';

export const MAGIC_LENS_PAYMENT_OPTIONS = [
  { id: 'leasing', label: 'Leasing' },
  { id: 'finance', label: 'Finanzierung' },
  { id: 'cash', label: 'Kauf' },
];

export const MAGIC_LENS_RADIUS_OPTIONS = [
  { value: 25, label: '25 km' },
  { value: 50, label: '50 km' },
  { value: 100, label: '100 km' },
  { value: null, label: 'Deutschlandweit' },
];

export const MAGIC_LENS_AVAILABILITY_OPTIONS = [
  { id: 'sofort', label: 'Sofort verfügbar' },
  { id: 'bestell', label: 'Bestellfahrzeug' },
  { id: 'vorlauf', label: 'Vorführwagen' },
];

export const MAGIC_LENS_FEATURE_IDS = [
  'camera_360',
  'blind_spot',
  'towbar',
  'heated_seats',
  'parking_front',
  'panorama_roof',
];

export const MAGIC_LENS_FEATURES = FEATURE_CATALOG.filter((f) =>
  MAGIC_LENS_FEATURE_IDS.includes(f.id),
);

export const MAGIC_LENS_BODY_OPTIONS = MARKETPLACE_TYPE_OPTIONS.filter((o) => o.id !== 'all');

export const MAGIC_LENS_BRAND_OPTIONS = [
  { id: '', label: 'Alle Marken' },
  { id: 'Kia', label: 'Kia' },
  { id: 'Ford', label: 'Ford' },
  { id: 'Hyundai', label: 'Hyundai' },
];

export const MAGIC_LENS_MODELS_BY_BRAND = {
  Kia: ['Sportage', 'EV3', 'Ceed SW', 'Niro EV'],
  Ford: ['Kuga'],
  Hyundai: ['Tucson'],
};

export const MAGIC_LENS_TERM_OPTIONS = [36, 48, 60];
export const MAGIC_LENS_MILEAGE_OPTIONS = [10000, 15000, 20000, 25000];
export const MAGIC_LENS_SORT_OPTIONS = [
  { id: 'best', label: 'Beste Angebote' },
  { id: 'nearest', label: 'Nächste Händler' },
  { id: 'available', label: 'Sofort verfügbar' },
  { id: 'discount', label: 'Höchster Rabatt' },
];

export function countMagicLensActiveFilters(filters) {
  let n = 0;
  if (filters.payment) n += 1;
  if (filters.maxRate != null) n += 1;
  if (filters.maxPrice != null) n += 1;
  if (filters.brand) n += 1;
  if (filters.model) n += 1;
  if (filters.type && filters.type !== 'all') n += 1;
  if (filters.features?.length) n += filters.features.length;
  if (filters.radius != null && filters.radius !== 25) n += 1;
  if (filters.city || filters.plz) n += 1;
  if (filters.availability) n += 1;
  if (filters.termMonths && filters.termMonths !== 48) n += 1;
  if (filters.mileagePerYear && filters.mileagePerYear !== 10000) n += 1;
  if (filters.sort && filters.sort !== 'best') n += 1;
  return n;
}
