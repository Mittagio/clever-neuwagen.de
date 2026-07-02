import express from 'express';
import { listPilotLeads, upsertPilotLead } from './pilotLeadsStore.js';
import {
  applyPortfolioEvent,
  applyCustomerPortalMessage,
  applyCustomerPortalSelfDisclosureSave,
  applyCustomerPortalSelfDisclosureStart,
  applyCustomerPortalSelfDisclosureSubmit,
  buildPortfolioCustomerContext,
  getCustomerPortalSelfDisclosureInterview,
  PORTFOLIO_EVENTS,
  resolvePortfolioFromRequest,
} from '../src/services/crm/customerOfferPortfolioService.js';
import {
  recordCustomerPortalAccessOpened,
  recordCustomerPortalAccessViewed,
  verifyCustomerPortalAccessCode,
} from '../src/services/crm/customerPortalAccessService.js';

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
  const accessVerified = req.query?.accessVerified === 'true';
  return res.json({
    ok: true,
    context: buildPortfolioCustomerContext(lead, { accessVerified }),
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

router.post('/customer-offer-portfolio/message', express.json({ limit: '16kb' }), (req, res) => {
  const text = req.body?.text;
  const { lead, portfolio } = findPortfolioContext(req);
  if (!lead?.id || !portfolio) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }

  const result = applyCustomerPortalMessage(lead, { text });
  if (!result.ok) {
    return res.status(400).json(result);
  }

  upsertPilotLead(result.lead);

  return res.json({
    ok: true,
    leadId: result.lead.id,
    message: result.message,
    inboxItem: result.inboxItem,
    context: result.context,
  });
});

router.post('/customer-offer-portfolio/access/open', express.json({ limit: '8kb' }), (req, res) => {
  const { lead, portfolio } = findPortfolioContext(req);
  if (!lead?.id || !portfolio) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }

  const opened = recordCustomerPortalAccessOpened(lead);
  const nextLead = opened.historyText
    ? { ...opened.lead, history: opened.lead.history }
    : opened.lead;
  upsertPilotLead(nextLead);

  return res.json({
    ok: true,
    changed: opened.changed,
    context: buildPortfolioCustomerContext(nextLead, {
      accessVerified: req.body?.accessVerified === true,
    }),
    portalAccess: opened.access,
  });
});

router.post('/customer-offer-portfolio/access/verify', express.json({ limit: '8kb' }), (req, res) => {
  const { lead, portfolio } = findPortfolioContext(req);
  if (!lead?.id || !portfolio) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }

  const result = verifyCustomerPortalAccessCode(lead, req.body?.code);
  if (!result.ok) {
    return res.status(400).json(result);
  }

  upsertPilotLead(result.lead);

  return res.json({
    ok: true,
    context: buildPortfolioCustomerContext(result.lead, { accessVerified: true }),
    portalAccess: result.access,
  });
});

router.post('/customer-offer-portfolio/access/viewed', express.json({ limit: '8kb' }), (req, res) => {
  const { lead, portfolio } = findPortfolioContext(req);
  if (!lead?.id || !portfolio) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }

  const viewed = recordCustomerPortalAccessViewed(lead);
  upsertPilotLead(viewed.lead);

  return res.json({
    ok: true,
    changed: viewed.changed,
    context: buildPortfolioCustomerContext(viewed.lead, { accessVerified: true }),
    portalAccess: viewed.access,
  });
});

router.get('/customer-offer-portfolio/self-disclosure', (req, res) => {
  const { lead, portfolio } = findPortfolioContext(req);
  if (!lead?.id || !portfolio) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }

  const result = getCustomerPortalSelfDisclosureInterview(lead);
  return res.json({
    ok: true,
    interview: result.interview,
    context: result.context,
  });
});

router.post('/customer-offer-portfolio/self-disclosure/start', express.json({ limit: '16kb' }), (req, res) => {
  const { lead, portfolio } = findPortfolioContext(req);
  if (!lead?.id || !portfolio) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }

  const result = applyCustomerPortalSelfDisclosureStart(lead, { type: req.body?.type });
  if (!result.ok) {
    return res.status(400).json(result);
  }

  upsertPilotLead(result.lead);

  return res.json({
    ok: true,
    selfDisclosure: result.selfDisclosure,
    interview: result.interview,
    context: result.context,
  });
});

router.post('/customer-offer-portfolio/self-disclosure/save', express.json({ limit: '64kb' }), (req, res) => {
  const { lead, portfolio } = findPortfolioContext(req);
  if (!lead?.id || !portfolio) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }

  const result = applyCustomerPortalSelfDisclosureSave(lead, {
    stepId: req.body?.stepId,
    data: req.body?.data ?? {},
    advance: req.body?.advance !== false,
  });
  if (!result.ok) {
    return res.status(400).json(result);
  }

  upsertPilotLead(result.lead);

  return res.json({
    ok: true,
    selfDisclosure: result.selfDisclosure,
    nextStep: result.nextStep,
    interview: result.interview,
    context: result.context,
  });
});

router.post('/customer-offer-portfolio/self-disclosure/submit', express.json({ limit: '8kb' }), (req, res) => {
  const { lead, portfolio } = findPortfolioContext(req);
  if (!lead?.id || !portfolio) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }

  const result = applyCustomerPortalSelfDisclosureSubmit(lead);
  if (!result.ok) {
    return res.status(400).json(result);
  }

  upsertPilotLead(result.lead);

  return res.json({
    ok: true,
    selfDisclosure: result.selfDisclosure,
    inboxItem: result.inboxItem,
    interview: result.interview,
    context: result.context,
  });
});

export default router;
