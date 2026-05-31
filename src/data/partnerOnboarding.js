import { brands as catalogBrands } from './adminCatalog.js';

export const PARTNER_BRANDS = catalogBrands.map((b) => ({
  id: b.id,
  name: b.name,
  status: b.status,
  available: b.status === 'active',
  modelCount: b.modelCount,
}));

export const ONBOARDING_STEPS = [
  { id: 1, label: 'Händlerdaten' },
  { id: 2, label: 'Marken' },
  { id: 3, label: 'Rabatte' },
  { id: 4, label: 'Leasingfaktoren' },
  { id: 5, label: 'Lieferzeiten' },
  { id: 6, label: 'Veröffentlichung' },
];

export const DISCOUNT_FIELDS = [
  { key: 'standard', label: 'Standard' },
  { key: 'corporateBenefits', label: 'Corporate Benefits' },
  { key: 'schwerbehindert', label: 'Schwerbehindert' },
  { key: 'oeffentlicherDienst', label: 'Öffentlicher Dienst' },
  { key: 'gewerbe', label: 'Gewerbe' },
];

export const LEASING_TERMS = [36, 48, 60];
export const LEASING_MILEAGES = [10000, 15000, 20000];

export const DEFAULT_ONBOARDING = {
  step: 1,
  published: false,
  dealer: {
    name: '',
    plz: '',
    city: '',
    address: '',
    contactName: '',
    phone: '',
    email: '',
  },
  slug: '',
  brands: ['kia'],
  discounts: {
    standard: 12,
    corporateBenefits: 15,
    schwerbehindert: 18,
    oeffentlicherDienst: 14,
    gewerbe: 13,
  },
  leasingFactors: {
    36: { 10000: 0.68, 15000: 0.72, 20000: 0.78 },
    48: { 10000: 0.58, 15000: 0.64, 20000: 0.71 },
    60: { 10000: 0.55, 15000: 0.6, 20000: 0.67 },
  },
  deliveryTimes: {
    default: '4–6 Wochen',
    byBrand: { kia: '4–6 Wochen' },
  },
  preparationFee: 1290,
  subdomain: null,
  publishedAt: null,
};
