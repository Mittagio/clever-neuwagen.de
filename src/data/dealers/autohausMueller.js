/**
 * Autohaus Müller – Händlerkonditionen (Seed)
 */
import { buildDealerConditionsFromLegacy } from '../dealerConditionsSchema.js';

export const AUTOHAUS_MUELLER_ID = 'autohaus-mueller';

export const autohausMuellerSeed = buildDealerConditionsFromLegacy({
  dealerId: AUTOHAUS_MUELLER_ID,
  slug: AUTOHAUS_MUELLER_ID,
  subdomain: 'autohaus-mueller.clever-neuwagen.de',
  dealerName: 'Autohaus Müller',
  city: 'Stuttgart',
  plz: '70173',
  address: 'Hauptstraße 45',

  contact: {
    name: 'Thomas Müller',
    role: 'Verkaufsleitung Neuwagen',
    phone: '+49 711 987654',
    email: 'kontakt@autohaus-mueller.de',
  },

  brands: ['kia', 'toyota'],

  discounts: {
    standard: 11,
    corporateBenefits: 14,
    schwerbehindert: 17,
    oeffentlicherDienst: 13,
    gewerbe: 12,
  },

  leasingFactors: {
    36: { 10000: 0.7, 15000: 0.74, 20000: 0.8 },
    48: { 10000: 0.6, 15000: 0.66, 20000: 0.73 },
    60: { 10000: 0.57, 15000: 0.62, 20000: 0.69 },
  },

  financing: {
    effectiveRate: 4.29,
    durationMonths: [36, 48, 60],
    downPaymentPercent: 20,
  },

  financeRates: {
    interestRate: 5.29,
    finalPaymentPercent: { 36: 58, 48: 48, 60: 38 },
  },

  preparationFee: 1190,
  deliveryTime: '6–8 Wochen',

  inventory: [
    {
      id: 'inv-m-001',
      type: 'lager',
      model: 'Sportage',
      engineId: 'tgi-hybrid-2wd',
      trimId: 'vision',
      colorId: 'carraraweiss',
      color: 'Carraraweiß',
      equipment: 'Vision',
      vin: 'KNADM5A30S6999001',
      eta: null,
      location: 'Stuttgart Ausstellung',
      visibleOnLanding: true,
    },
  ],

  lastPublishedAt: '2026-04-10T08:00:00.000Z',
  dealerPageOnline: true,
  syncStatus: 'synchronized',
});

export default autohausMuellerSeed;
