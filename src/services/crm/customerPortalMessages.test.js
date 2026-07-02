/**
 * Kundenportal – Thread-Ansicht und Nachricht senden
 */
import assert from 'node:assert/strict';
import {
  addCustomerMessage,
  buildCustomerPortalMessageThreads,
  formatPortalMessageText,
  MESSAGE_CHANNEL,
  MESSAGE_DIRECTION,
  MESSAGE_STATUS,
  sendCustomerPortalInboundMessage,
} from './customerMessageService.js';
import {
  applyCustomerLinkEvent,
  CUSTOMER_LINK_EVENTS,
} from './customerLinkOfferService.js';
import {
  applyCustomerPortalMessage,
  buildPortfolioCustomerContext,
  prepareCustomerOfferPortfolio,
} from './customerOfferPortfolioService.js';
import { createOfferSelectionGroup } from '../sales/offerSelectionGroup.js';
import {
  __resetInboxStoreForTests,
  INBOX_EVENT_TYPES,
  listInboxItems,
} from './cleverInboxService.js';

__resetInboxStoreForTests([]);

const ev3Group = createOfferSelectionGroup({
  modelKey: 'ev3',
  modelLabel: 'Kia EV3',
  wishConditions: { paymentType: 'cash' },
});

const lead = {
  id: 'lead-portal-msg',
  contact: { name: 'Tom Kunde' },
  crm: { offerSelectionGroups: [ev3Group], reservedModels: [] },
  history: [],
};

const prepared = prepareCustomerOfferPortfolio({
  lead,
  offerSelectionGroups: [ev3Group],
  vehicleCards: [],
  origin: 'http://localhost:5173',
});
assert.ok(prepared.ok);

let workingLead = {
  ...lead,
  crm: {
    ...lead.crm,
    customerOfferPortfolio: prepared.portfolio,
  },
};

const offerUnitId = prepared.portfolio.items[0]?.vehicleCardId
  ?? prepared.portfolio.items[0]?.id
  ?? null;

// A) Kundenportal zeigt nur visibleToCustomer Messages
const withInternal = addCustomerMessage({
  lead: workingLead,
  direction: MESSAGE_DIRECTION.OUTBOUND,
  channel: MESSAGE_CHANNEL.CLEVER,
  status: MESSAGE_STATUS.SENT,
  text: 'Interne Notiz: Schufa schlecht',
  visibleToCustomer: false,
});
workingLead = withInternal.lead;

const withVisibleInbound = addCustomerMessage({
  lead: workingLead,
  direction: MESSAGE_DIRECTION.INBOUND,
  channel: MESSAGE_CHANNEL.CLEVER,
  status: MESSAGE_STATUS.RECEIVED,
  text: 'Sind Winterreifen dabei?',
  relatedOfferId: offerUnitId,
  visibleToCustomer: true,
  createdByName: 'Tom Kunde',
});
workingLead = withVisibleInbound.lead;

const withVisibleOutbound = addCustomerMessage({
  lead: workingLead,
  threadId: withVisibleInbound.message.threadId,
  direction: MESSAGE_DIRECTION.OUTBOUND,
  channel: MESSAGE_CHANNEL.CLEVER,
  status: MESSAGE_STATUS.SENT,
  text: 'Winterreifen kann ich separat anbieten.',
  relatedOfferId: offerUnitId,
  visibleToCustomer: true,
  createdByName: 'Verkäufer',
});
workingLead = withVisibleOutbound.lead;

const threads = buildCustomerPortalMessageThreads(workingLead);
const allPortalMessages = threads.flatMap((thread) => thread.messages);
assert.equal(allPortalMessages.length, 2);
assert.ok(allPortalMessages.every((entry) => entry.text));
assert.ok(allPortalMessages.some((entry) => entry.text.includes('Winterreifen dabei')));
assert.ok(allPortalMessages.some((entry) => entry.text.includes('separat anbieten')));

const context = buildPortfolioCustomerContext(workingLead);
assert.equal(context.messageThreads.length, threads.length);

// B) Interne / sensitive / visibleToCustomer false Messages erscheinen nicht
assert.equal(formatPortalMessageText({ visibleToCustomer: false, text: 'Geheim' }), null);
assert.equal(formatPortalMessageText({ visibleToCustomer: true, text: 'Monatliches Einkommen 5.000' }), null);
assert.ok(!allPortalMessages.some((entry) => /schufa|einkommen/i.test(entry.text)));

// C) Nachricht senden erzeugt inbound customerMessage mit channel clever
const sent = applyCustomerPortalMessage(workingLead, {
  text: 'Wann kann ich probefahren?',
});
assert.ok(sent.ok);
assert.equal(sent.message.channel, MESSAGE_CHANNEL.CLEVER);
assert.equal(sent.message.direction, MESSAGE_DIRECTION.INBOUND);
assert.equal(sent.message.status, MESSAGE_STATUS.RECEIVED);
assert.equal(sent.message.visibleToCustomer, true);

// D) Nachricht senden erzeugt customer_message Inbox Item
assert.equal(sent.inboxItem?.type, INBOX_EVENT_TYPES.CUSTOMER_MESSAGE);
assert.ok(listInboxItems({ leadId: lead.id }).some((item) => item.type === INBOX_EVENT_TYPES.CUSTOMER_MESSAGE));

// E) Chronologische Reihenfolge stimmt
const portalThreads = buildCustomerPortalMessageThreads(sent.lead);
const generalThread = portalThreads.find((thread) => thread.title === 'Allgemeine Fragen');
assert.ok(generalThread);
assert.equal(generalThread.messages[generalThread.messages.length - 1].text, 'Wann kann ich probefahren?');
const offerThread = portalThreads.find((thread) => thread.messages.length === 2);
assert.ok(offerThread);
assert.ok(
  new Date(offerThread.messages[0].createdAt) <= new Date(offerThread.messages[1].createdAt),
);

// F) Bestehende Angebotsfrage erzeugt weiterhin customerQuestion + customerMessage
const linkLead = {
  id: 'lead-link-portal',
  contact: { name: 'Lisa Kunde' },
  crm: {
    customerOfferInteractions: {},
    vehicleOffers: {
      'card-ev3': {
        vehicleCardId: 'card-ev3',
        status: 'sent',
        tracking: { openCount: 0 },
      },
    },
  },
  history: [],
};

__resetInboxStoreForTests([]);
const questionResult = applyCustomerLinkEvent(linkLead, 'card-ev3', CUSTOMER_LINK_EVENTS.QUESTION, {
  questionText: 'Ist Ladekabel dabei?',
});
assert.ok(questionResult.ok);
assert.equal(questionResult.interaction.customerQuestions.length, 1);
assert.equal(questionResult.inboxItem?.type, INBOX_EVENT_TYPES.CUSTOMER_MESSAGE);
assert.equal(questionResult.inboxItem?.title, 'Neue Nachricht zum Angebot');
assert.equal(questionResult.lead.crm.customerMessages?.length, 1);
assert.equal(questionResult.customerMessageInboxItem?.type, INBOX_EVENT_TYPES.CUSTOMER_MESSAGE);
assert.ok(!listInboxItems({ leadId: linkLead.id }).some((item) => item.type === INBOX_EVENT_TYPES.OFFER_QUESTION));

const directSend = sendCustomerPortalInboundMessage({
  lead: workingLead,
  text: 'Noch eine allgemeine Frage',
  customerName: 'Tom Kunde',
});
assert.ok(directSend.message);
assert.equal(directSend.message.channel, MESSAGE_CHANNEL.CLEVER);

console.log('customerPortalMessages.test.js: ok');
