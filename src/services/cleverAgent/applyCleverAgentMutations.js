/**
 * Wendet Clever-Agent-Mutationen auf einen Lead an (Client).
 */
export function applyCleverAgentMutations(lead = {}, mutations = []) {
  let next = lead;
  let messageDraft = null;
  let portfolio = null;

  for (const mutation of mutations) {
    if (!mutation || typeof mutation !== 'object') continue;

    if (mutation.type === 'apply_lead_patch' && mutation.leadPatch) {
      const patch = mutation.leadPatch;
      next = {
        ...next,
        ...patch,
        contact: { ...(next.contact || {}), ...(patch.contact || {}) },
        wish: { ...(next.wish || {}), ...(patch.wish || {}) },
        vehicle: { ...(next.vehicle || {}), ...(patch.vehicle || {}) },
        crm: {
          ...(next.crm || {}),
          ...(patch.crm || {}),
          vehicleOffers: {
            ...(next.crm?.vehicleOffers || {}),
            ...(patch.crm?.vehicleOffers || {}),
          },
          vehicleConfigurations: patch.crm?.vehicleConfigurations
            ?? next.crm?.vehicleConfigurations,
          reservedModels: patch.crm?.reservedModels ?? next.crm?.reservedModels,
          offers: patch.crm?.offers ?? next.crm?.offers,
          customerOfferPortfolio: patch.crm?.customerOfferPortfolio
            ?? next.crm?.customerOfferPortfolio,
        },
        updatedAt: new Date().toISOString(),
      };
    }

    if (mutation.type === 'set_message_draft' && mutation.messageDraft) {
      messageDraft = mutation.messageDraft;
    }

    if (mutation.type === 'set_customer_link' && mutation.portfolio) {
      portfolio = mutation.portfolio;
      next = {
        ...next,
        crm: {
          ...(next.crm || {}),
          customerOfferPortfolio: mutation.portfolio,
        },
      };
    }
  }

  return {
    lead: next,
    messageDraft,
    portfolio,
  };
}
