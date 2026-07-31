/**
 * Arbeits-Lead für globalen Seller-Turn auflösen (Slice 3).
 * Deterministisch über leadsSnapshot – kein erfundener Kunde.
 */
import { resolveCustomersFromInput } from './globalCustomerResolve.js';
import { extractNamedCustomerFromInput } from './resolveAssistantContext.js';

/**
 * @param {{
 *   lead?: object,
 *   sellerInput?: string,
 *   leadsSnapshot?: object[],
 *   intents?: object[],
 * }} params
 * @returns {{
 *   workingLead: object,
 *   resolution: object|null,
 *   customerSearchResults: object[]|null,
 *   ambiguous: boolean,
 *   resolved: boolean,
 * }}
 */
export function resolveWorkingLeadForTurn(params = {}) {
  const lead = params.lead?.id ? params.lead : null;
  const leads = Array.isArray(params.leadsSnapshot) ? params.leadsSnapshot : [];
  const sellerInput = String(params.sellerInput || '');

  if (lead?.id) {
    return {
      workingLead: lead,
      resolution: null,
      customerSearchResults: null,
      ambiguous: false,
      resolved: true,
    };
  }

  if (!leads.length) {
    return {
      workingLead: params.lead || {},
      resolution: null,
      customerSearchResults: null,
      ambiguous: false,
      resolved: false,
    };
  }

  const named = extractNamedCustomerFromInput(sellerInput);
  const resolution = resolveCustomersFromInput(sellerInput, leads, { limit: 6 });

  if (resolution.status === 'ambiguous') {
    return {
      workingLead: {},
      resolution,
      customerSearchResults: resolution.results || [],
      ambiguous: true,
      resolved: false,
    };
  }

  if (resolution.status === 'unique' && resolution.lead?.id) {
    return {
      workingLead: resolution.lead,
      resolution,
      customerSearchResults: resolution.results || [],
      ambiguous: false,
      resolved: true,
    };
  }

  // Fallback: nur Nachname aus Input gegen Snapshot
  if (named) {
    const soft = resolveCustomersFromInput(`Öffne ${named}`, leads, { limit: 6 });
    if (soft.status === 'unique' && soft.lead?.id) {
      return {
        workingLead: soft.lead,
        resolution: soft,
        customerSearchResults: soft.results || [],
        ambiguous: false,
        resolved: true,
      };
    }
    if (soft.status === 'ambiguous') {
      return {
        workingLead: {},
        resolution: soft,
        customerSearchResults: soft.results || [],
        ambiguous: true,
        resolved: false,
      };
    }
  }

  return {
    workingLead: params.lead || {},
    resolution,
    customerSearchResults: resolution?.results || null,
    ambiguous: false,
    resolved: false,
  };
}

/**
 * Prepared-Offer Working-Context-Item für Handoff (keine Customer Truth).
 * @param {{
 *   customerId?: string|null,
 *   customerName?: string|null,
 *   vehicleLabel?: string|null,
 *   model?: string|null,
 *   trim?: string|null,
 *   offerType?: string|null,
 *   purchasePrice?: number|null,
 *   messageDraft?: string|null,
 * }} prepared
 */
export function buildPreparedOfferWorkingContext(prepared = {}) {
  const price = prepared.purchasePrice != null
    ? `${Number(prepared.purchasePrice).toLocaleString('de-DE')} €`
    : null;
  const offerTypeLabel = prepared.offerType === 'leasing'
    ? 'Leasing'
    : prepared.offerType === 'financing'
      ? 'Finanzierung'
      : 'Kauf';
  const vehicle = prepared.vehicleLabel
    || [prepared.model, prepared.trim].filter(Boolean).join(' ')
    || 'Angebot';
  const shortLabel = [vehicle.replace(/^Kia\s+/i, ''), offerTypeLabel, price]
    .filter(Boolean)
    .join(' · ');

  return {
    id: `prepared-offer:${prepared.customerId || 'draft'}:${vehicle}`,
    kind: 'prepared_offer',
    oneShot: true,
    offerId: null,
    customerId: prepared.customerId || null,
    label: shortLabel,
    shortLabel,
    detail: prepared.messageDraft
      ? 'Nachricht vorbereitet'
      : 'Angebot vorbereitet',
    preparedOffer: {
      customerId: prepared.customerId || null,
      customerName: prepared.customerName || null,
      vehicle: {
        model: prepared.model || null,
        trim: prepared.trim || null,
        label: vehicle,
      },
      offerType: prepared.offerType || 'cash',
      purchasePrice: prepared.purchasePrice ?? null,
      source: 'seller_input',
      needsSellerConfirmation: true,
      messageDraft: prepared.messageDraft || null,
    },
  };
}
