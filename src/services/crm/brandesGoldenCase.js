/**
 * Herr Brandes – Golden-Moment Demo-Seed (Multi-Offer DoD).
 * Notizzettel = Kundenwahrheit (Leasing 48 / 15.000 / 0 € AZ).
 * Spuren leben auf vehicleConfigurations; deferred wird nicht gelöscht.
 */
import {
  applyTrackFeedbackFacts,
  REJECTION_REASON,
  VEHICLE_TRACK_STATUS,
} from './vehicleTrack.js';
import { VEHICLE_OFFER_STATUS } from '../vehicleOffer.js';

export const BRANDES_LEAD_ID = 'lead-demo-brandes';

export const BRANDES_TRACK_IDS = {
  TIVOLI: 'vc-tivoli',
  XCEED: 'vc-xceed',
  SPORTAGE: 'vc-sportage',
};

const PDF_STUB = 'data:application/pdf;base64,JVBERi0xLjAK';

function isoHoursAgo(nowMs, hours) {
  return new Date(nowMs - hours * 60 * 60 * 1000).toISOString();
}

function buildBaseConfigurations() {
  return [
    {
      id: BRANDES_TRACK_IDS.TIVOLI,
      brand: 'Kia',
      model: 'Tivoli',
      modelKey: 'tivoli',
      paymentType: 'leasing',
      leasingData: {
        calculatedRate: 329,
        termMonths: 48,
        mileagePerYear: 15000,
        downPayment: 0,
      },
      vehicleTrack: { status: VEHICLE_TRACK_STATUS.OPEN },
    },
    {
      id: BRANDES_TRACK_IDS.XCEED,
      brand: 'Kia',
      model: 'XCeed',
      modelKey: 'xceed',
      paymentType: 'leasing',
      leasingData: {
        calculatedRate: 347,
        termMonths: 48,
        mileagePerYear: 15000,
        downPayment: 0,
      },
      vehicleTrack: { status: VEHICLE_TRACK_STATUS.OPEN },
    },
    {
      id: BRANDES_TRACK_IDS.SPORTAGE,
      brand: 'Kia',
      model: 'Sportage',
      modelKey: 'sportage',
      paymentType: 'leasing',
      leasingData: {
        calculatedRate: 389,
        termMonths: 48,
        mileagePerYear: 15000,
        downPayment: 0,
      },
      vehicleTrack: { status: VEHICLE_TRACK_STATUS.OPEN },
    },
  ];
}

function buildVehicleOffers(nowMs) {
  const sentAt = isoHoursAgo(nowMs, 24);
  const openedAt = isoHoursAgo(nowMs, 12);
  return {
    [BRANDES_TRACK_IDS.TIVOLI]: {
      id: 'vo-tivoli',
      status: VEHICLE_OFFER_STATUS.SENT,
      sentAt,
      version: 1,
      pdf: { fileName: 'Tivoli_Brandes.pdf', dataUrl: PDF_STUB },
    },
    [BRANDES_TRACK_IDS.XCEED]: {
      id: 'vo-xceed',
      status: VEHICLE_OFFER_STATUS.OPENED,
      sentAt,
      version: 1,
      tracking: { openCount: 1, firstOpenedAt: openedAt, lastOpenedAt: openedAt },
      pdf: { fileName: 'XCeed_Brandes.pdf', dataUrl: PDF_STUB },
    },
    [BRANDES_TRACK_IDS.SPORTAGE]: {
      id: 'vo-sportage',
      status: VEHICLE_OFFER_STATUS.SENT,
      sentAt,
      version: 1,
      pdf: { fileName: 'Sportage_Brandes.pdf', dataUrl: PDF_STUB },
    },
  };
}

/** Seller-/Portal-Feedback, das den Golden Moment auslöst. */
export const BRANDES_GOLDEN_TRACK_FEEDBACK = [
  {
    trackId: BRANDES_TRACK_IDS.SPORTAGE,
    status: VEHICLE_TRACK_STATUS.DEFERRED,
    rejectionReason: REJECTION_REASON.PRICE_TOO_HIGH,
  },
  {
    trackId: BRANDES_TRACK_IDS.XCEED,
    status: VEHICLE_TRACK_STATUS.FAVORITE,
    preferredColor: 'Rot',
    deliveryTimeImportance: 'high',
    customerRequirements: ['AHK wichtig', 'Rot', 'Lieferzeit wichtig'],
  },
];

/**
 * @param {{
 *   now?: number,
 *   phase?: 'sent' | 'golden',
 *   id?: string,
 * }} [options]
 * @returns {object} lead
 */
export function createBrandesGoldenCaseLead(options = {}) {
  const nowMs = options.now ?? Date.now();
  const phase = options.phase ?? 'golden';
  const id = options.id ?? BRANDES_LEAD_ID;

  const lead = {
    id,
    createdAt: isoHoursAgo(nowMs, 48),
    updatedAt: isoHoursAgo(nowMs, 2),
    status: 'angebotVersendet',
    source: 'demo',
    demo: true,
    brandesGoldenCase: true,
    name: 'Herr Brandes',
    contact: {
      name: 'Herr Brandes',
      phone: '+49 170 1122334',
      email: 'herr.brandes@demo-mail.de',
      plz: '70173',
      preferredContact: 'phone',
    },
    vehicle: {
      brand: 'Kia',
      model: 'XCeed',
      label: 'Kia XCeed',
    },
    paymentType: 'leasing',
    desiredRate: 347,
    currentRate: 347,
    // Notizzettel-Wahrheit (keine zweite Wahrheit in Tracks)
    wish: {
      paymentType: 'leasing',
      termMonths: 48,
      mileagePerYear: 15000,
      downPayment: 0,
    },
    notes: 'Demo Golden Moment · Wunsch: Leasing 48 Monate / 15.000 km / 0 € AZ',
    history: [
      {
        id: 'brandes-h1',
        at: isoHoursAgo(nowMs, 48),
        type: 'system',
        text: 'Demo-Lead Herr Brandes · Multi-Offer Golden Moment',
      },
      {
        id: 'brandes-h2',
        at: isoHoursAgo(nowMs, 24),
        type: 'offer',
        text: 'Drei Angebote versendet: Tivoli 329 € · XCeed 347 € · Sportage 389 €',
      },
    ],
    crm: {
      vehicleConfigurations: buildBaseConfigurations(),
      vehicleOffers: buildVehicleOffers(nowMs),
      customerOfferInteractions: {},
    },
  };

  if (phase === 'sent') {
    return lead;
  }

  return applyTrackFeedbackFacts(lead, BRANDES_GOLDEN_TRACK_FEEDBACK);
}

/** Deep-clone für Demo-Load ohne Shared-State. */
export function cloneBrandesGoldenCaseLead(options = {}) {
  return JSON.parse(JSON.stringify(createBrandesGoldenCaseLead(options)));
}
