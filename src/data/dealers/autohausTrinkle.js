/**
 * Autohaus Trinkle – Händlerkonditionen (Seed)
 * Fahrzeugstammdaten: src/data/models/kia/sportage.js (read-only)
 */
import { buildDealerConditionsFromLegacy } from '../dealerConditionsSchema.js';

export const AUTOHAUS_TRINKLE_ID = 'autohaus-trinkle';

export const autohausTrinkleSeed = buildDealerConditionsFromLegacy({
  dealerId: AUTOHAUS_TRINKLE_ID,
  dealerName: 'Autohaus Trinkle',
  city: 'Heilbronn',
  plz: '74072',
  address: 'Willy-Brandt-Platz 5',

  contact: {
    name: 'Max Trinkle',
    role: 'Verkauf Neuwagen',
    phone: '+49 7131 123456',
    email: 'sportage@autohaus-trinkle.de',
  },

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

  financing: {
    effectiveRate: 3.99,
    durationMonths: [36, 48, 60],
    downPaymentPercent: 20,
  },

  financeRates: {
    interestRate: 4.99,
    finalPaymentPercent: {
      36: 60,
      48: 50,
      60: 40,
    },
  },

  preparationFee: 1290,
  deliveryTime: '4–6 Wochen',

  inventory: [
    {
      id: 'inv-001',
      type: 'lager',
      model: 'Sportage',
      engineId: 'tgi-hybrid-2wd',
      trimId: 'spirit',
      colorId: 'wolfgrau',
      color: 'Wolfgrau Metallic',
      equipment: 'Spirit',
      vin: 'KNADM5A30S6123456',
      eta: null,
      location: 'Heilbronn Ausstellung',
      visibleOnLanding: true,
      image: '/images/dealers/autohaus-trinkle/sportage-spirit.svg',
    },
    {
      id: 'inv-002',
      type: 'vorlauf',
      model: 'Sportage',
      engineId: 'tgi-hybrid-awd',
      trimId: 'gt-line',
      colorId: 'blueflame',
      color: 'Blueflame Metallic',
      equipment: 'GT-Line',
      vin: 'KNADM5A30S6789012',
      eta: '2026-07-15',
      location: 'Heilbronn Lager',
      visibleOnLanding: true,
    },
    {
      id: 'inv-003',
      type: 'lager',
      model: 'Sportage',
      engineId: 'crdi-dct-2wd',
      trimId: 'vision',
      colorId: 'carraraweiss',
      color: 'Carraraweiß',
      equipment: 'Vision',
      vin: 'KNADM5A30S6456789',
      eta: null,
      location: 'Heilbronn Ausstellung',
      visibleOnLanding: true,
    },
    {
      id: 'inv-004',
      type: 'bestellt',
      model: 'Sportage',
      engineId: 'tgi-dct-2wd',
      trimId: 'gt-line',
      colorId: 'magmarot',
      color: 'Magmarot Metallic',
      equipment: 'GT-Line',
      vin: '',
      eta: '2026-08-20',
      location: 'Heilbronn Werk',
      visibleOnLanding: false,
    },
    {
      id: 'inv-005',
      type: 'konfigurierbar',
      model: 'Sportage',
      engineId: 'tgi-hybrid-2wd',
      trimId: 'spirit',
      colorId: 'blueflame',
      color: 'Blueflame Metallic',
      equipment: 'Spirit',
      vin: '',
      eta: null,
      location: 'Heilbronn',
      visibleOnLanding: true,
    },
  ],

  lastPublishedAt: '2026-05-29T12:32:00.000Z',
  dealerPageOnline: true,
  syncStatus: 'synchronized',
});

export default autohausTrinkleSeed;
