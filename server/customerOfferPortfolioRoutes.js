import express from 'express';
import { listPilotLeads, upsertPilotLead } from './pilotLeadsStore.js';
import {
  applyPortfolioEvent,
  buildPortfolioCustomerContext,
  PORTFOLIO_EVENTS,
  resolvePortfolioFromRequest,
} from '../src/services/crm/customerOfferPortfolioService.js';

const router = express.Router();

const ALLOWED_EVENTS = new Set(Object.values(PORTFOLIO_EVENTS));

function findPortfolioContext(req) {
  const query = req.query ?? {};
  const body = req.body ?? {};
  const leadId = body.leadId ?? query.leadId ?? null;
  const token = body.token ?? query.token ?? null;
  const customerSlug = body.customerSlug ?? query.customerSlug ?? '';

  const data = listPilotLeads();
  return resolvePortfolioFromRequest(data.leads, { leadId, token, customerSlug });
}

router.get('/customer-offer-portfolio/context', (req, res) => {
  const { lead, portfolio } = findPortfolioContext(req);
  if (!lead?.id || !portfolio) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }
  return res.json({
    ok: true,
    context: buildPortfolioCustomerContext(lead),
  });
});

router.post('/customer-offer-portfolio/event', express.json({ limit: '32kb' }), (req, res) => {
  const eventType = req.body?.eventType;
  if (!ALLOWED_EVENTS.has(eventType)) {
    return res.status(400).json({ ok: false, error: 'invalid_event' });
  }

  const { lead, portfolio } = findPortfolioContext(req);
  if (!lead?.id || !portfolio) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }

  const result = applyPortfolioEvent(
    lead,
    req.body?.offerUnitId ?? null,
    eventType,
    {
      token: req.body?.token ?? req.query?.token ?? portfolio.token,
      declineReason: req.body?.declineReason ?? null,
      declineNote: req.body?.declineNote ?? '',
      questionText: req.body?.questionText ?? '',
    },
  );

  if (!result.ok) {
    return res.status(400).json(result);
  }

  upsertPilotLead(result.lead);

  return res.json({
    ok: true,
    leadId: result.lead.id,
    offerUnitId: result.offerUnitId,
    eventType: result.eventType,
    portfolio: result.portfolio,
    inboxItem: result.inboxItem,
    context: result.context,
  });
});

export default router;
