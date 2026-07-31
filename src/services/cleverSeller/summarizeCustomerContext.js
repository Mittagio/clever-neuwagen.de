/**
 * Kundenkontext-Zusammenfassung für den Global Composer (Slice 2).
 * Nutzt buildCustomerUnderstanding + Tracks – keine erfundenen Sätze.
 */
import { buildCustomerUnderstanding } from '../dealer/customerUnderstanding.js';
import { buildGoldenMoment } from '../journey/goldenMoment.js';
import {
  buildCustomerCardSummary,
  resolveCustomersFromInput,
} from './globalCustomerResolve.js';

/**
 * @param {{
 *   lead?: object,
 *   leadsSnapshot?: object[],
 *   sellerInput?: string,
 * }} params
 */
export function summarizeCustomerContext(params = {}) {
  const sellerInput = String(params.sellerInput || '').trim();
  const leads = Array.isArray(params.leadsSnapshot) ? params.leadsSnapshot : [];
  let lead = params.lead?.id ? params.lead : null;
  let resolution = null;

  if (!lead?.id && leads.length) {
    resolution = resolveCustomersFromInput(sellerInput, leads, { limit: 4 });
    if (resolution.status === 'ambiguous') {
      return {
        ok: true,
        status: 'ambiguous_customer',
        message: 'Mehrere Kunden gefunden – bitte einen auswählen.',
        customerSearchResults: resolution.results,
        customerSummary: null,
      };
    }
    if (resolution.status === 'none' || resolution.status === 'missing_query') {
      return {
        ok: true,
        status: 'no_customer',
        message: resolution.message || 'Für welchen Kunden soll ich zusammenfassen?',
        customerSearchResults: [],
        customerSummary: null,
      };
    }
    lead = resolution.lead;
  }

  if (!lead?.id) {
    return {
      ok: false,
      status: 'missing_customer',
      message: 'Für welchen Kunden soll ich zusammenfassen?',
      customerSummary: null,
    };
  }

  const card = buildCustomerCardSummary(lead);
  let understanding = null;
  try {
    understanding = buildCustomerUnderstanding(lead);
  } catch {
    understanding = null;
  }

  let goldenMoment = null;
  try {
    goldenMoment = buildGoldenMoment(lead);
  } catch {
    goldenMoment = null;
  }

  const v = understanding?.verstaendnis || {};
  const vehiclesCompared = (v.vehicles || card?.vehicles || [])
    .map((item) => (typeof item === 'string' ? item : item.label || item.model || item.line))
    .filter(Boolean);

  const important = [
    ...(v.priorities || []),
    ...(card?.requirementLabels || []),
  ].filter(Boolean);
  const uniqueImportant = [...new Set(important)].slice(0, 8);

  const openPoints = [
    ...(v.openPoints || []),
    ...(goldenMoment?.primaryLabel ? [goldenMoment.primaryLabel] : []),
  ].filter(Boolean);

  const deferred = (card?.deferredLines || []).slice(0, 4);
  const favorite = card?.favoriteLine || null;

  // Keine Offer-Raten als Customer Truth ausgeben
  const summary = {
    customerId: lead.id,
    customerName: card?.customerName || lead.contact?.name || 'Kunde',
    paymentLabel: card?.paymentLabel || null,
    vehiclesCompared,
    favorite,
    deferred,
    important: uniqueImportant,
    openPoints: [...new Set(openPoints)].slice(0, 5),
    concerns: (v.concerns || []).slice(0, 4),
    sourceType: 'customer_truth',
    lines: [
      vehiclesCompared.length ? `Vergleicht: ${vehiclesCompared.join(' · ')}` : null,
      favorite ? `Aktuell: ${favorite}` : null,
      uniqueImportant.length ? `Wichtig: ${uniqueImportant.join(' · ')}` : null,
      deferred.length ? `Zurückgestellt: ${deferred.join(' · ')}` : null,
      openPoints[0] ? `Offen: ${openPoints[0]}` : null,
    ].filter(Boolean),
  };

  return {
    ok: true,
    status: 'ok',
    message: null,
    resolvedCustomer: {
      id: lead.id,
      name: summary.customerName,
    },
    customerSearchResults: resolution?.results || [],
    customerSummary: summary,
    goldenMoment,
    card,
  };
}
