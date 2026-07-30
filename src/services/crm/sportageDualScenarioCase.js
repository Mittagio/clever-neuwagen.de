/**
 * Demo: Sportage – eine Fahrzeugspur, zwei kommerzielle Szenarien
 * (Leasing 36/10k/0€ + Finanzierung 60/10k/4.000€).
 */
import {
  COMMERCIAL_CUSTOMER_TYPE,
  COMMERCIAL_SCENARIO_SOURCE,
  COMMERCIAL_SCENARIO_TYPE,
} from './commercialScenarios.js';
import { VEHICLE_TRACK_STATUS } from './vehicleTrack.js';
import { VEHICLE_OFFER_STATUS } from '../vehicleOffer.js';

export const SPORTAGE_DUAL_LEAD_ID = 'lead-demo-sportage-dual';
export const SPORTAGE_DUAL_TRACK_ID = 'vc-sportage-dual';

export const SPORTAGE_DUAL_SCENARIO_IDS = {
  LEASING: 'leasing-1',
  FINANCING: 'financing-1',
};

export const SPORTAGE_DUAL_OFFER_IDS = {
  LEASING: 'vo-sportage-dual-leasing-1',
  FINANCING: 'vo-sportage-dual-financing-1',
};

const PDF_STUB = 'data:application/pdf;base64,JVBERi0xLjAK';

function isoHoursAgo(nowMs, hours) {
  return new Date(nowMs - hours * 60 * 60 * 1000).toISOString();
}

export const SPORTAGE_DUAL_SCENARIOS = [
  {
    id: SPORTAGE_DUAL_SCENARIO_IDS.LEASING,
    type: COMMERCIAL_SCENARIO_TYPE.LEASING,
    customerType: COMMERCIAL_CUSTOMER_TYPE.PRIVATE,
    termMonths: 36,
    annualMileage: 10000,
    mileagePerYear: 10000,
    downPayment: 0,
    source: COMMERCIAL_SCENARIO_SOURCE.CUSTOMER_MESSAGE,
    vehicleTrackId: SPORTAGE_DUAL_TRACK_ID,
  },
  {
    id: SPORTAGE_DUAL_SCENARIO_IDS.FINANCING,
    type: COMMERCIAL_SCENARIO_TYPE.FINANCING,
    customerType: COMMERCIAL_CUSTOMER_TYPE.PRIVATE,
    termMonths: 60,
    annualMileage: 10000,
    mileagePerYear: 10000,
    downPayment: 4000,
    source: COMMERCIAL_SCENARIO_SOURCE.CUSTOMER_MESSAGE,
    vehicleTrackId: SPORTAGE_DUAL_TRACK_ID,
  },
];

/**
 * @param {{
 *   now?: number,
 *   phase?: 'draft' | 'ready' | 'sent',
 *   id?: string,
 * }} [options]
 */
export function createSportageDualScenarioLead(options = {}) {
  const nowMs = options.now ?? Date.now();
  const phase = options.phase ?? 'ready';
  const id = options.id ?? SPORTAGE_DUAL_LEAD_ID;
  const scenarios = SPORTAGE_DUAL_SCENARIOS.map((s) => ({ ...s }));

  const offerReady = phase === 'ready' || phase === 'sent';
  const sentAt = phase === 'sent' ? isoHoursAgo(nowMs, 2) : null;

  const leasingOffer = {
    id: SPORTAGE_DUAL_OFFER_IDS.LEASING,
    vehicleCardId: SPORTAGE_DUAL_TRACK_ID,
    vehicleTrackId: SPORTAGE_DUAL_TRACK_ID,
    commercialScenarioId: SPORTAGE_DUAL_SCENARIO_IDS.LEASING,
    status: offerReady
      ? (phase === 'sent' ? VEHICLE_OFFER_STATUS.SENT : VEHICLE_OFFER_STATUS.PDF_UPLOADED)
      : VEHICLE_OFFER_STATUS.DRAFT,
    version: 1,
    monthlyRate: offerReady ? 389 : null,
    termMonths: 36,
    mileagePerYear: 10000,
    downPayment: 0,
    checked: offerReady,
    verified: offerReady,
    pdf: offerReady
      ? {
        fileName: 'Sportage_Leasing_36_10k.pdf',
        dataUrl: PDF_STUB,
        uploadedAt: isoHoursAgo(nowMs, 4),
      }
      : null,
    sentAt,
    tracking: { openCount: 0, lastOpenedAt: null, firstOpenedAt: null },
  };

  const financingOffer = {
    id: SPORTAGE_DUAL_OFFER_IDS.FINANCING,
    vehicleCardId: SPORTAGE_DUAL_TRACK_ID,
    vehicleTrackId: SPORTAGE_DUAL_TRACK_ID,
    commercialScenarioId: SPORTAGE_DUAL_SCENARIO_IDS.FINANCING,
    status: offerReady
      ? (phase === 'sent' ? VEHICLE_OFFER_STATUS.SENT : VEHICLE_OFFER_STATUS.PDF_UPLOADED)
      : VEHICLE_OFFER_STATUS.DRAFT,
    version: 1,
    monthlyRate: offerReady ? 429 : null,
    termMonths: 60,
    mileagePerYear: 10000,
    downPayment: 4000,
    balloonPayment: offerReady ? 12500 : null,
    checked: offerReady,
    verified: offerReady,
    pdf: offerReady
      ? {
        fileName: 'Sportage_Finanzierung_60_10k.pdf',
        dataUrl: PDF_STUB,
        uploadedAt: isoHoursAgo(nowMs, 4),
      }
      : null,
    sentAt,
    tracking: { openCount: 0, lastOpenedAt: null, firstOpenedAt: null },
  };

  const vehicleOffers = offerReady
    ? {
      [SPORTAGE_DUAL_OFFER_IDS.LEASING]: leasingOffer,
      [SPORTAGE_DUAL_OFFER_IDS.FINANCING]: financingOffer,
    }
    : {
      [SPORTAGE_DUAL_OFFER_IDS.LEASING]: leasingOffer,
      [SPORTAGE_DUAL_OFFER_IDS.FINANCING]: financingOffer,
    };

  return {
    id,
    createdAt: isoHoursAgo(nowMs, 6),
    updatedAt: isoHoursAgo(nowMs, 1),
    status: phase === 'sent' ? 'angebotVersendet' : 'inBearbeitung',
    source: 'demo',
    demo: true,
    sportageDualScenario: true,
    name: 'Julia Weber',
    contact: {
      name: 'Julia Weber',
      phone: '+49 170 9988776',
      email: 'julia.weber@demo-mail.de',
      plz: '70174',
      preferredContact: 'email',
    },
    vehicle: {
      brand: 'Kia',
      model: 'Sportage',
      trim: 'Vision',
      engine: '1.6 T-GDI Hybrid',
      label: 'Kia Sportage Vision',
    },
    // Legacy primary (first scenario) – nicht die zweite Wahrheit
    paymentType: 'leasing',
    desiredRate: 389,
    currentRate: offerReady ? 389 : null,
    wish: {
      paymentType: 'leasing',
      termMonths: 36,
      mileagePerYear: 10000,
      downPayment: 0,
      customerType: COMMERCIAL_CUSTOMER_TYPE.PRIVATE,
      commercialScenarios: scenarios,
    },
    notes: 'Demo Dual-Szenario · eine Sportage-Spur · Leasing + Finanzierung',
    history: [
      {
        id: 'sportage-dual-h1',
        at: isoHoursAgo(nowMs, 6),
        type: 'system',
        text: 'Demo-Lead Julia Weber · Sportage Dual-Szenario',
      },
      {
        id: 'sportage-dual-h2',
        at: isoHoursAgo(nowMs, 5),
        type: 'note',
        text: 'Kunde wünscht Leasing (36/10k/0€) und Finanzierung (60/10k/4.000€) zum Vergleich',
      },
    ],
    crm: {
      commercialScenarios: scenarios,
      customerTruth: {
        customerType: COMMERCIAL_CUSTOMER_TYPE.PRIVATE,
        configurationAttached: true,
        deliveryTimeOpen: true,
        deliveryTimePlaceholder: 'Die Lieferzeit wird aktuell noch geprüft.',
      },
      vehicleConfigurations: [
        {
          id: SPORTAGE_DUAL_TRACK_ID,
          brand: 'Kia',
          model: 'Sportage',
          modelKey: 'sportage',
          trimLabel: 'Vision',
          configurationAttached: true,
          configSnapshot: { trim: 'Vision', powertrain: '1.6 T-GDI Hybrid' },
          vehicleTrack: {
            status: VEHICLE_TRACK_STATUS.ACTIVE,
            offerIds: [
              SPORTAGE_DUAL_OFFER_IDS.LEASING,
              SPORTAGE_DUAL_OFFER_IDS.FINANCING,
            ],
            activeOfferId: SPORTAGE_DUAL_OFFER_IDS.LEASING,
            lastActivityAt: isoHoursAgo(nowMs, 1),
          },
          createdAt: isoHoursAgo(nowMs, 6),
          updatedAt: isoHoursAgo(nowMs, 1),
        },
      ],
      vehicleOffers,
      customerOfferInteractions: {},
    },
  };
}

export function cloneSportageDualScenarioLead(options = {}) {
  return JSON.parse(JSON.stringify(createSportageDualScenarioLead(options)));
}
