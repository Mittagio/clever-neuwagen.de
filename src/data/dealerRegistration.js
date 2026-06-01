import { BILLING_CONFIG } from './billingConfig.js';
import { PARTNER_BRANDS } from './partnerOnboarding.js';

/** Sprint 6 – Self-Service-Registrierung */
export const REGISTRATION_STEPS = [
  { id: 1, key: 'company', label: 'Firmendaten' },
  { id: 2, key: 'contact', label: 'Ansprechpartner' },
  { id: 3, key: 'brands', label: 'Marken' },
  { id: 4, key: 'package', label: 'Paket' },
  { id: 5, key: 'terms', label: 'AGB' },
  { id: 6, key: 'submit', label: 'Freigabe' },
];

export const REGISTRATION_STATUS = {
  draft: { id: 'draft', label: 'Entwurf', tone: 'muted', order: 0 },
  submitted: { id: 'submitted', label: 'Eingereicht', tone: 'info', order: 1 },
  review: { id: 'review', label: 'In Prüfung', tone: 'warning', order: 2 },
  approved: { id: 'approved', label: 'Freigegeben', tone: 'success', order: 3 },
  live: { id: 'live', label: 'Live', tone: 'success', order: 4 },
  rejected: { id: 'rejected', label: 'Abgelehnt', tone: 'danger', order: -1 },
};

/** Admin-Pipeline (Anzeige) */
export const REGISTRATION_STATUS_PIPELINE = [
  'draft',
  'submitted',
  'review',
  'approved',
  'live',
].map((id) => ({ id, ...REGISTRATION_STATUS[id] }));

export const REGISTRATION_BRANDS = PARTNER_BRANDS;

export const DEALER_PACKAGES = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Ideal für den Einstieg mit einer Marke',
    monthlyFee: BILLING_CONFIG.platformFeeMonthly,
    successProvision: BILLING_CONFIG.successProvision,
    maxBrands: 1,
    features: [
      'Händlerprofil auf clever-neuwagen.de',
      'KI-Berater & Verkaufschancen-Erfassung',
      '1 Marke freigeschaltet',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    tagline: 'Mehr Marken und höhere Sichtbarkeit',
    monthlyFee: 349,
    successProvision: BILLING_CONFIG.successProvision,
    maxBrands: 3,
    recommended: true,
    features: [
      'Alles aus Starter',
      'Bis zu 3 Marken',
      'Priorisierte Platzierung',
      'Publishing-Center',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Volle Plattform für etablierte Häuser',
    monthlyFee: 599,
    successProvision: 39,
    maxBrands: 99,
    features: [
      'Unbegrenzte Marken (nach Freigabe)',
      'Dedizierter Ansprechpartner',
      'API & Multi-Standort vorbereitet',
      'Individuelle Vertragskonditionen',
    ],
  },
];

export const DEFAULT_REGISTRATION_DRAFT = {
  step: 1,
  status: 'draft',
  company: {
    legalName: '',
    tradeName: '',
    vatId: '',
    street: '',
    zip: '',
    city: '',
  },
  contact: {
    salutation: '',
    firstName: '',
    lastName: '',
    role: '',
    email: '',
    phone: '',
  },
  brands: ['kia'],
  packageId: 'growth',
  agbAccepted: false,
  agbAcceptedAt: null,
  slug: '',
  submittedAt: null,
  applicationId: null,
};
