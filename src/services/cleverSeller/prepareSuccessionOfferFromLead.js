/**
 * Slice 18: Nachfolgeangebot aus Favorit + bestätigtem Altvertrag vorbereiten.
 * Keine erfundenen Raten – nur Track-/Contract-Daten. Kein Auto-Send.
 */
import {
  listCustomerVehicleTracks,
  sortTracksForOverview,
  VEHICLE_TRACK_STATUS,
} from '../crm/vehicleTrack.js';
import { buildGoldenMoment, GOLDEN_MOMENT_TYPE } from '../journey/goldenMoment.js';
import {
  evaluateContractGoldenSignals,
  getPrimaryCustomerContract,
} from './contractGoldenSignals.js';
import {
  createExtractedFact,
} from './cleverSellerTurnResultSchema.js';
import {
  SELLER_FACT_CLASS,
} from './sellerFactTypes.js';

/**
 * @param {string} [text]
 * @returns {boolean}
 */
export function isPrepareSuccessionOfferCue(text = '') {
  const t = String(text || '');
  if (!/\b(nachfolgeangebot|wechselangebot|anschlussangebot|nachfolge[-\s]?leasing)\b/i.test(t)) {
    return false;
  }
  return /\b(bereit(?:e|en)?|erstell(?:e|en)?|mach(?:e|en)?|vorbereit\w*|start(?:e|en)?)\b/i.test(t)
    || /\bnachfolgeangebot\b/i.test(t);
}

/**
 * @param {object} [lead]
 * @param {{ now?: Date|string|number, goldenMoment?: object|null }} [options]
 */
export function prepareSuccessionOfferFromLead(lead = {}, options = {}) {
  const now = options.now || new Date();
  const moment = options.goldenMoment || buildGoldenMoment(lead, { now });
  const signals = moment?.contractSignals || evaluateContractGoldenSignals(lead, { now });
  const tracks = sortTracksForOverview(listCustomerVehicleTracks(lead));
  const favorite = tracks.find((t) => t.status === VEHICLE_TRACK_STATUS.FAVORITE)
    || signals?.favorite
    || null;
  const contract = getPrimaryCustomerContract(lead) || signals?.contract || null;

  if (!favorite?.modelKey && !favorite?.model && !favorite?.modelLabel) {
    return {
      ok: false,
      reason: 'no_favorite',
      message: 'Kein Favoritenfahrzeug für das Nachfolgeangebot.',
      facts: [],
      goldenMoment: moment,
    };
  }

  const modelKey = favorite.modelKey
    || favorite.config?.modelKey
    || String(favorite.model || favorite.modelLabel || '')
      .toLowerCase()
      .replace(/^kia\s+/i, '')
      .trim()
    || null;
  const modelLabel = favorite.modelLabel
    || favorite.displayName
    || [favorite.brand || favorite.config?.brand || 'Kia', favorite.model || favorite.config?.model].filter(Boolean).join(' ')
    || 'Favorit';
  const leasing = favorite.leasingData
    || favorite.config?.leasingData
    || favorite.activeOffer?.leasingData
    || {};
  const monthlyRate = favorite.monthlyRate
    ?? leasing.calculatedRate
    ?? leasing.monthlyRate
    ?? favorite.vehicleOffer?.monthlyRate
    ?? favorite.activeOffer?.monthlyRate
    ?? null;
  const termMonths = favorite.termMonths
    ?? leasing.termMonths
    ?? contract?.commercialTerms?.termMonths
    ?? null;
  const annualMileage = favorite.annualMileage
    ?? leasing.mileagePerYear
    ?? leasing.annualMileage
    ?? contract?.commercialTerms?.annualMileage
    ?? null;
  const downPayment = favorite.downPayment
    ?? leasing.downPayment
    ?? contract?.commercialTerms?.downPayment
    ?? null;

  if (monthlyRate == null || !Number.isFinite(Number(monthlyRate))) {
    return {
      ok: false,
      reason: 'missing_rate',
      message: `Für ${modelLabel} fehlt eine Leasingrate – bitte Rate oder Bank-PDF ergänzen.`,
      facts: [],
      goldenMoment: moment,
      favorite,
      contract,
    };
  }

  const facts = [
    createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_INTEREST,
      field: 'vehicleInterest',
      value: {
        make: favorite.brand || 'Kia',
        modelKey,
        model: favorite.model || modelLabel,
        trim: favorite.trim || null,
      },
      label: modelLabel,
      confidence: 0.95,
      source: 'favorite_track',
    }),
    createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'paymentType',
      value: 'leasing',
      label: 'Leasing (Nachfolge)',
      confidence: 0.95,
      source: 'favorite_track',
    }),
    createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'desiredRate',
      value: Number(monthlyRate),
      label: `Rate: ${Number(monthlyRate).toLocaleString('de-DE')} €/Monat`,
      confidence: 0.92,
      source: 'favorite_track',
    }),
    createExtractedFact({
      factClass: SELLER_FACT_CLASS.OFFER_INSTRUCTION,
      field: 'monthlyBudget',
      value: Number(monthlyRate),
      label: `Monatsrate ${Number(monthlyRate).toLocaleString('de-DE')} €`,
      confidence: 0.92,
      source: 'favorite_track',
    }),
  ];

  if (termMonths != null) {
    facts.push(createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'termMonths',
      value: Number(termMonths),
      label: `${Number(termMonths)} Monate`,
      confidence: 0.9,
      source: 'favorite_track',
    }));
  }
  if (annualMileage != null) {
    facts.push(createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'annualMileage',
      value: Number(annualMileage),
      label: `${Number(annualMileage).toLocaleString('de-DE')} km/Jahr`,
      confidence: 0.9,
      source: 'favorite_track',
    }));
  }
  if (downPayment != null) {
    facts.push(createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'downPayment',
      value: Number(downPayment),
      label: `Anzahlung ${Number(downPayment).toLocaleString('de-DE')} €`,
      confidence: 0.88,
      source: 'favorite_track',
    }));
  }

  return {
    ok: true,
    reason: null,
    message: null,
    facts,
    goldenMoment: moment?.type === GOLDEN_MOMENT_TYPE.CONTRACT_SUCCESSION
      ? moment
      : (moment || null),
    favorite,
    contract,
    vehicleLabel: modelLabel,
    monthlyRate: Number(monthlyRate),
    termMonths: termMonths != null ? Number(termMonths) : null,
    annualMileage: annualMileage != null ? Number(annualMileage) : null,
    succession: true,
    mutatesCustomer: false,
  };
}
