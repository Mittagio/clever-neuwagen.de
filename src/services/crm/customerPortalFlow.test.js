/**
 * Kundenportal End-to-End: Link → Code-Mail → Verify → Reaktion → Journey/Admin
 */
process.env.NODE_ENV = 'test';
process.env.MAIL_TRANSPORT = 'mock';

import assert from 'node:assert/strict';
import { resetMailOutboxForTests } from '../mail/mailOutboxStore.js';
import { listMailOutbox, MAIL_TEMPLATE_IDS } from '../mail/mailOutboxService.js';
import { sendCustomerLoginCodeMail } from '../mail/mailFlowService.js';
import { buildAdminTaskQueue } from '../admin/leitstand/adminTaskQueue.js';
import { evaluateJourney } from '../journey/journeyEngine.js';
import { buildCleverMessageContext } from '../communication/cleverMessageContext.js';
import { renderCleverMessageTemplate, MESSAGE_TEMPLATE_IDS } from '../communication/cleverMessageTemplates.js';
import { INTEREST_STATUS, getCustomerOfferInteraction } from '../customerOfferInteraction.js';
import { createOfferSelectionGroup } from '../sales/offerSelectionGroup.js';
import {
  PORTAL_ACCESS_STATUS,
  getCustomerPortalAccess,
  markCustomerPortalAccessSent,
  prepareCustomerPortalAccess,
  recordCustomerPortalAccessLinkCopied,
  recordCustomerPortalAccessOpened,
  recordCustomerPortalAccessViewed,
  verifyCustomerPortalAccessCode,
  buildPortalReactionSummary,
} from './customerPortalAccessService.js';
import {
  PORTFOLIO_EVENTS,
  applyPortfolioEvent,
  prepareCustomerOfferPortfolio,
} from './customerOfferPortfolioService.js';

resetMailOutboxForTests([]);

const ev3Group = createOfferSelectionGroup({
  modelKey: 'ev3',
  modelLabel: 'Kia EV3',
  wishConditions: { paymentType: 'leasing', termMonths: 48, annualKm: 10000 },
});

const baseLead = {
  id: 'lead-portal-flow',
  contact: { name: 'Tom Kunde', email: 'tom@example.de', phone: '01701234567' },
  crm: { offerSelectionGroups: [ev3Group], reservedModels: [] },
  history: [],
};

const preparedPortfolio = prepareCustomerOfferPortfolio({
  lead: baseLead,
  offerSelectionGroups: [ev3Group],
  vehicleCards: [],
  origin: 'http://localhost:5173',
});
assert.ok(preparedPortfolio.ok);

const portalPrepared = prepareCustomerPortalAccess(baseLead, {
  portfolioUrl: preparedPortfolio.portfolio.url,
  email: 'tom@example.de',
  accessToken: preparedPortfolio.portfolio.token,
});
assert.ok(portalPrepared.ok);
assert.equal(getCustomerPortalAccess(portalPrepared.lead)?.status, PORTAL_ACCESS_STATUS.PREPARED);

// 1. Link kopieren ≠ versendet
const copied = recordCustomerPortalAccessLinkCopied(portalPrepared.lead);
assert.equal(getCustomerPortalAccess(copied.lead)?.status, PORTAL_ACCESS_STATUS.PREPARED);

// 2. Code-Mail erzeugen
const access = getCustomerPortalAccess(copied.lead);
const mailResult = await sendCustomerLoginCodeMail({
  to: 'tom@example.de',
  customerName: 'Tom',
  code: access.accessCode,
  portalUrl: access.portfolioUrl,
  dealerName: 'Autohaus Test',
  meta: { flow: 'portfolio-share', leadId: baseLead.id, portfolioId: preparedPortfolio.portfolio.id },
});
assert.equal(mailResult.ok, true);
assert.equal(listMailOutbox()[0].templateId, MAIL_TEMPLATE_IDS.CUSTOMER_LOGIN_CODE);

const sent = markCustomerPortalAccessSent(copied.lead, { via: 'email' });
assert.equal(getCustomerPortalAccess(sent.lead)?.status, PORTAL_ACCESS_STATUS.SENT);

// 3. Code verifizieren
const opened = recordCustomerPortalAccessOpened(sent.lead);
const verified = verifyCustomerPortalAccessCode(opened.lead, access.accessCode);
assert.ok(verified.ok);
assert.equal(getCustomerPortalAccess(verified.lead)?.status, PORTAL_ACCESS_STATUS.CODE_VERIFIED);

let flowLead = {
  ...verified.lead,
  crm: {
    ...verified.lead.crm,
    customerOfferPortfolio: preparedPortfolio.portfolio,
  },
};

// 4. Portal geöffnet → Journey aktiv
const openedEvent = applyPortfolioEvent(flowLead, '', PORTFOLIO_EVENTS.OPENED, {
  token: preparedPortfolio.portfolio.token,
});
assert.ok(openedEvent.ok);
flowLead = openedEvent.lead;

const viewed = recordCustomerPortalAccessViewed(flowLead);
flowLead = viewed.lead;
assert.equal(getCustomerPortalAccess(flowLead)?.status, PORTAL_ACCESS_STATUS.VIEWED);

const journey = evaluateJourney(flowLead);
assert.ok(journey.signals?.portalActive || journey.timeline?.some((e) => e.kind === 'portal'));

// 5. Interesse → Verkäufer sieht Reaktion + Interaction-Sync
const offerUnitId = preparedPortfolio.portfolio.items[0].id;
const interested = applyPortfolioEvent(flowLead, offerUnitId, PORTFOLIO_EVENTS.OFFER_INTERESTED, {
  token: preparedPortfolio.portfolio.token,
});
assert.ok(interested.ok);
flowLead = interested.lead;
assert.equal(buildPortalReactionSummary(flowLead), 'Kunde interessiert');
const cardId = preparedPortfolio.portfolio.items[0].vehicleCardId
  ?? preparedPortfolio.portfolio.items[0].id;
const interaction = getCustomerOfferInteraction(flowLead, cardId);
assert.equal(interaction?.interestStatus, INTEREST_STATUS.INTERESTED);

// 6. Rückfrage → Inbox
const question = applyPortfolioEvent(flowLead, offerUnitId, PORTFOLIO_EVENTS.OFFER_MORE_INFO, {
  token: preparedPortfolio.portfolio.token,
  questionText: 'Gibt es auch Winterreifen?',
});
assert.ok(question.ok);
assert.ok(question.inboxItem);
assert.match(question.lead.history?.at(-1)?.text ?? '', /Winterreifen/);

// 7. Clever-Nachricht enthält Portal-URL
const msgCtx = buildCleverMessageContext({ lead: flowLead, journey });
assert.equal(msgCtx.portalUrl, access.portfolioUrl);
const msgText = renderCleverMessageTemplate(msgCtx, MESSAGE_TEMPLATE_IDS.GENERAL_FOLLOWUP);
assert.match(msgText, /auswahl/i);

// 8. Fehlerhafte Mail → Admin-Task mit Lead-Kontext
resetMailOutboxForTests([]);
await sendCustomerLoginCodeMail({
  to: 'fail@example.de',
  customerName: 'Fail',
  code: '111111',
  meta: { simulateFailure: true, failureReason: 'SMTP Timeout', leadId: baseLead.id },
});
const tasks = buildAdminTaskQueue({});
const mailTask = tasks.find((t) => t.category === 'Mail');
assert.ok(mailTask);
assert.match(mailTask.subtitle, /lead-portal-flow/i);
assert.match(mailTask.href, /lead-portal-flow/);

console.log('customerPortalFlow.test.js: ok');
