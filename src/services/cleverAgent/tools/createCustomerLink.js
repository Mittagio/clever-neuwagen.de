/**
 * Tool: create_customer_link – WRITE (Prepare Portfolio-Link, kein Auto-Send)
 */
import { prepareCustomerOfferPortfolio } from '../../crm/customerOfferPortfolioService.js';
import { buildVehicleOpportunityCards } from '../../customerAkte.js';

export const createCustomerLinkToolDef = {
  name: 'create_customer_link',
  kind: 'write',
  description:
    'Bereitet einen Kundenlink / Angebots-Portfolio-Link vor. Sendet ihn NICHT automatisch.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      origin: { type: ['string', 'null'], description: 'Optionaler Origin für die URL.' },
    },
  },
};

export function executeCreateCustomerLink(runtime = {}, args = {}) {
  const lead = runtime.lead || {};
  let vehicleCards = [];
  try {
    vehicleCards = buildVehicleOpportunityCards({
      lead,
      configurations: lead?.crm?.vehicleConfigurations || [],
      reservedModels: lead?.crm?.reservedModels || [],
    }) || [];
  } catch {
    vehicleCards = [];
  }

  const prepared = prepareCustomerOfferPortfolio({
    lead,
    offerSelectionGroups: lead?.crm?.offerSelectionGroups || [],
    vehicleCards,
    origin: args.origin || null,
  });

  if (!prepared?.ok) {
    return {
      ok: false,
      error: prepared?.error || 'prepare_failed',
      message: prepared?.error === 'no_items'
        ? 'Es gibt noch keine Angebote für einen Kundenlink.'
        : 'Kundenlink konnte nicht vorbereitet werden.',
    };
  }

  const leadPatch = {
    crm: {
      ...(lead.crm || {}),
      customerOfferPortfolio: prepared.portfolio,
      offerSelectionGroups: prepared.offerSelectionGroups,
    },
  };

  return {
    ok: true,
    status: 'prepared',
    portfolio: {
      url: prepared.portfolio.url,
      token: prepared.portfolio.token,
      itemCount: prepared.itemCount,
      status: prepared.portfolio.status,
    },
    mutations: [
      {
        type: 'apply_lead_patch',
        leadPatch,
      },
      {
        type: 'set_customer_link',
        portfolio: prepared.portfolio,
      },
    ],
    artifacts: [
      {
        type: 'customer_link',
        label: 'Kundenlink öffnen',
        data: { url: prepared.portfolio.url },
      },
    ],
    suggestedActions: [
      { action: 'send_customer_link', label: 'Link an Kunden senden' },
    ],
    message: `Kundenlink vorbereitet (${prepared.itemCount} Angebot${prepared.itemCount === 1 ? '' : 'e'}). Noch nicht gesendet.`,
  };
}
