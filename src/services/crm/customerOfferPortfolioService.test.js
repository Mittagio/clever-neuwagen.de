/**
 * Portfolio-Kundenlink – Tests
 */
import assert from 'node:assert/strict';
import {
  applyPortfolioEvent,
  buildPortfolioItems,
  buildPortfolioShareMessage,
  PORTFOLIO_DECLINE_REASONS,
  PORTFOLIO_EVENTS,
  PORTFOLIO_REACTION_STATUS,
  PORTFOLIO_STATUS,
  prepareCustomerOfferPortfolio,
  resolvePortfolioFromRequest,
} from './customerOfferPortfolioService.js';
import { createOfferSelectionGroup } from '../sales/offerSelectionGroup.js';
import { __clearInboxTestMode, __resetInboxStoreForTests, listInboxItems } from './cleverInboxService.js';

__resetInboxStoreForTests([]);

const ev3Group = createOfferSelectionGroup({
  modelKey: 'ev3',
  modelLabel: 'Kia EV3',
  wishConditions: { paymentType: 'cash' },
});
assert.ok(ev3Group, 'EV3-Gruppe erzeugt');

const ev6Group = createOfferSelectionGroup({
  modelKey: 'ev6',
  modelLabel: 'Kia EV6',
  wishConditions: { paymentType: 'leasing', termMonths: 48, mileagePerYear: 10000 },
});
assert.ok(ev6Group, 'EV6-Gruppe erzeugt');

const lead = {
  id: 'lead-portfolio-1',
  contact: { name: 'Anna Schmidt', phone: '01701234567', email: 'anna@example.de' },
  crm: {
    offerSelectionGroups: [ev3Group, ev6Group],
    reservedModels: [],
  },
  history: [],
};

const items = buildPortfolioItems({
  lead,
  offerSelectionGroups: [ev3Group, ev6Group],
  vehicleCards: [],
});
assert.ok(items.length >= 4, 'Mehrere Varianten aus zwei Modellen');

const prepared = prepareCustomerOfferPortfolio({
  lead,
  offerSelectionGroups: [ev3Group, ev6Group],
  vehicleCards: [],
  origin: 'http://localhost:5173',
});
assert.ok(prepared.ok);
assert.ok(prepared.portfolio.url.includes('/angebot/auswahl/anna-schmidt'));
assert.ok(prepared.portfolio.url.includes('token='));
assert.equal(prepared.itemCount, items.length);

const leadWithPortfolio = {
  ...lead,
  crm: {
    ...lead.crm,
    customerOfferPortfolio: prepared.portfolio,
  },
};

const resolved = resolvePortfolioFromRequest([leadWithPortfolio], {
  leadId: lead.id,
  token: prepared.portfolio.token,
  customerSlug: 'anna-schmidt',
});
assert.equal(resolved.lead?.id, lead.id);
assert.ok(resolved.portfolio?.items?.length);

const opened = applyPortfolioEvent(
  leadWithPortfolio,
  null,
  PORTFOLIO_EVENTS.OPENED,
  { token: prepared.portfolio.token },
);
assert.ok(opened.ok);
assert.equal(opened.portfolio.status, PORTFOLIO_STATUS.OPENED);
assert.equal(opened.portfolio.tracking.openCount, 1);

const firstItemId = prepared.portfolio.items[0].id;
const interested = applyPortfolioEvent(
  opened.lead,
  firstItemId,
  PORTFOLIO_EVENTS.OFFER_INTERESTED,
  { token: prepared.portfolio.token },
);
assert.ok(interested.ok);
assert.equal(
  interested.portfolio.items[0].customerReaction.status,
  PORTFOLIO_REACTION_STATUS.INTERESTED,
);

const ev6Item = prepared.portfolio.items.find((item) => item.modelLabel.includes('EV6')) ?? prepared.portfolio.items[1];
const declined = applyPortfolioEvent(
  interested.lead,
  ev6Item.id,
  PORTFOLIO_EVENTS.OFFER_DECLINED,
  {
    token: prepared.portfolio.token,
    declineReason: 'too_expensive',
    declineNote: 'EV6 zu teuer',
  },
);
assert.ok(declined.ok);
const declinedItem = declined.portfolio.items.find((item) => item.id === ev6Item.id);
assert.equal(declinedItem.customerReaction.status, PORTFOLIO_REACTION_STATUS.DECLINED);
assert.equal(declinedItem.customerReaction.declineReason, 'too_expensive');

const callRequest = applyPortfolioEvent(
  declined.lead,
  firstItemId,
  PORTFOLIO_EVENTS.OFFER_CALL_REQUEST,
  { token: prepared.portfolio.token },
);
assert.ok(callRequest.ok);

const moreInfo = applyPortfolioEvent(
  callRequest.lead,
  firstItemId,
  PORTFOLIO_EVENTS.OFFER_MORE_INFO,
  { token: prepared.portfolio.token, questionText: 'Ist Winterreifen-Paket dabei?' },
);
assert.ok(moreInfo.ok);

const shareMsg = buildPortfolioShareMessage({
  customerName: 'Anna Schmidt',
  itemCount: 3,
  url: prepared.portfolio.url,
  summaryLines: prepared.portfolio.items.map((i) => i.summaryLine).filter(Boolean),
});
assert.ok(shareMsg.includes('Anna'));
assert.ok(shareMsg.includes('3 Optionen'));
assert.ok(shareMsg.includes('👉'));

assert.equal(PORTFOLIO_DECLINE_REASONS.too_expensive, 'Zu teuer');

const inbox = listInboxItems({ leadId: lead.id });
assert.ok(inbox.length >= 3, 'Inbox-Einträge für Portfolio-Events');

__clearInboxTestMode();

console.log('customerOfferPortfolioService.test.js: OK');
