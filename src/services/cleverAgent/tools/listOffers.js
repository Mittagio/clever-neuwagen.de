/**
 * Tools: list_offers / get_offer – READ
 */
import { buildCleverCustomerContext } from '../cleverContextBuilder.js';
import { getVehicleOfferById, listStoredVehicleOffers } from '../../vehicleOffer.js';

export const listOffersToolDef = {
  name: 'list_offers',
  kind: 'read',
  description: 'Listet vorhandene Angebote / Offer-Shells des aktuellen Kunden. Erstellt nichts Neues.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {},
  },
};

export const getOfferToolDef = {
  name: 'get_offer',
  kind: 'read',
  description: 'Liest ein konkretes Angebot (oder das aktuelle/selected). Kein neues Angebot.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      offerId: { type: ['string', 'null'], description: 'Optional. Leer = aktuelles/selected Angebot.' },
    },
  },
};

export function executeListOffers(runtime = {}) {
  const ctx = buildCleverCustomerContext(runtime.lead || {}, {
    workingContext: runtime.workingContext,
    currentOffer: runtime.currentOffer,
  });
  return {
    ok: true,
    offers: ctx.currentOffers,
    selectedOfferId: ctx.selectedOffer?.offerId || null,
    count: ctx.currentOffers.length,
  };
}

export function executeGetOffer(runtime = {}, args = {}) {
  const lead = runtime.lead || {};
  const offerId = args.offerId || runtime.currentOffer?.offerId || runtime.workingContext?.offerId || null;

  if (offerId) {
    const stored = getVehicleOfferById(lead, offerId);
    if (stored) {
      return {
        ok: true,
        offer: {
          offerId: stored.id,
          modelName: stored.modelName || stored.boardOffer?.vehicleTitle || null,
          modelKey: stored.modelKey || null,
          paymentType: stored.paymentType || stored.boardOffer?.payment?.type || null,
          termMonths: stored.termMonths ?? null,
          mileagePerYear: stored.mileagePerYear ?? null,
          downPayment: stored.downPayment ?? null,
          monthlyRate: stored.monthlyRate ?? null,
          status: stored.status || null,
        },
      };
    }
    const fromList = listStoredVehicleOffers(lead).find((o) => o.id === offerId);
    if (fromList) {
      return {
        ok: true,
        offer: {
          offerId: fromList.id,
          monthlyRate: fromList.monthlyRate ?? null,
          termMonths: fromList.termMonths ?? null,
          mileagePerYear: fromList.mileagePerYear ?? null,
          downPayment: fromList.downPayment ?? null,
          status: fromList.status || null,
        },
      };
    }
  }

  const ctx = buildCleverCustomerContext(lead, {
    workingContext: runtime.workingContext,
    currentOffer: runtime.currentOffer,
  });
  if (!ctx.selectedOffer) {
    return {
      ok: false,
      error: 'no_offer',
      message: 'Für diesen Kunden ist aktuell kein Angebot hinterlegt.',
    };
  }
  return { ok: true, offer: ctx.selectedOffer };
}
