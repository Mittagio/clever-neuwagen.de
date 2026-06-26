import express from 'express';
import { listPilotLeads, upsertPilotLead } from './pilotLeadsStore.js';
import {
  applyCustomerLinkEvent,
  buildCustomerOfferLinkContext,
  CUSTOMER_LINK_EVENTS,
  parseOnlineOfferLinkContext,
  resolveLeadFromOfferLink,
} from '../src/services/crm/customerLinkOfferService.js';

const router = express.Router();

const ALLOWED_EVENTS = new Set(Object.values(CUSTOMER_LINK_EVENTS));

function resolveContextFromRequest(req) {
  const query = req.query ?? {};
  const body = req.body ?? {};
  return parseOnlineOfferLinkContext({
    leadId: body.leadId ?? query.leadId ?? null,
    vehicleCardId: body.vehicleCardId ?? body.cardId ?? query.cardId ?? query.vehicleCardId ?? null,
    modelSlug: body.modelSlug ?? query.modelSlug ?? '',
    customerSlug: body.customerSlug ?? query.customerSlug ?? '',
    pathname: body.pathname ?? query.pathname ?? '',
  });
}

function findLeadContext(req) {
  const context = resolveContextFromRequest(req);
  const data = listPilotLeads();
  return {
    context,
    ...resolveLeadFromOfferLink(data.leads, context),
  };
}

router.get('/customer-offer-link/context', (req, res) => {
  const { lead, vehicleCardId } = findLeadContext(req);
  if (!lead?.id || !vehicleCardId) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }
  return res.json({
    ok: true,
    context: buildCustomerOfferLinkContext(lead, vehicleCardId),
  });
});

router.post('/customer-offer-link/event', express.json({ limit: '32kb' }), (req, res) => {
  const eventType = req.body?.eventType;
  if (!ALLOWED_EVENTS.has(eventType)) {
    return res.status(400).json({ ok: false, error: 'invalid_event' });
  }

  const { lead, vehicleCardId } = findLeadContext(req);
  if (!lead?.id || !vehicleCardId) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }

  const result = applyCustomerLinkEvent(lead, vehicleCardId, eventType, {
    questionText: req.body?.questionText,
    syncInbox: false,
  });

  if (!result.ok) {
    return res.status(400).json(result);
  }

  upsertPilotLead(result.lead);

  return res.json({
    ok: true,
    leadId: result.lead.id,
    vehicleCardId: result.vehicleCardId,
    eventType: result.eventType,
    interaction: result.interaction,
    vehicleOffer: result.vehicleOffer,
    inboxItem: result.inboxItem,
    context: buildCustomerOfferLinkContext(result.lead, result.vehicleCardId),
  });
});

export default router;
