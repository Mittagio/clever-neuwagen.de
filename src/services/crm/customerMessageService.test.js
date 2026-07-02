/**
 * Clever Nachrichten Stufe 1 – customerMessageService
 */
import assert from 'node:assert/strict';
import {
  addCustomerMessage,
  buildInboxItemFromCustomerMessage,
  getCustomerMessageStore,
  MESSAGE_CHANNEL,
  MESSAGE_DIRECTION,
  MESSAGE_STATUS,
  mirrorInboundCustomerQuestion,
  sanitizeCustomerVisibleText,
  sendCleverChannelMessage,
} from './customerMessageService.js';
import {
  __resetInboxStoreForTests,
  INBOX_EVENT_TYPES,
  listInboxItems,
  syncInboxItemsFromLead,
} from './cleverInboxService.js';
import {
  applyCustomerLinkEvent,
  CUSTOMER_LINK_EVENTS,
} from './customerLinkOfferService.js';
import { buildInboxActionAkteUrl } from './cleverInboxQuestionRoute.js';

const baseLead = {
  id: 'lead-msg-1',
  contact: { name: 'Anna Kunde' },
  crm: {
    vehicleOffers: {
      'card-ev3': { vehicleCardId: 'card-ev3' },
    },
  },
  history: [],
};

__resetInboxStoreForTests([]);

// A) addCustomerMessage erzeugt inbound message mit channel clever
const inbound = addCustomerMessage({
  lead: baseLead,
  direction: MESSAGE_DIRECTION.INBOUND,
  channel: MESSAGE_CHANNEL.CLEVER,
  status: MESSAGE_STATUS.RECEIVED,
  text: 'Ist Ladekabel dabei?',
  relatedOfferId: 'card-ev3',
  visibleToCustomer: true,
  createdByName: 'Anna Kunde',
});
assert.ok(inbound.message);
assert.equal(inbound.message.channel, MESSAGE_CHANNEL.CLEVER);
assert.equal(inbound.message.direction, MESSAGE_DIRECTION.INBOUND);
assert.equal(inbound.message.status, MESSAGE_STATUS.RECEIVED);
assert.ok(inbound.message.threadId);

// B) Kundenlink-Frage erzeugt weiterhin customerQuestion und zusätzlich inbound customerMessage
const linkLead = {
  ...baseLead,
  crm: {
    ...baseLead.crm,
    customerOfferInteractions: {},
    vehicleOffers: {
      'card-ev3': {
        vehicleCardId: 'card-ev3',
        status: 'sent',
        tracking: { openCount: 0 },
      },
    },
  },
};

const questionResult = applyCustomerLinkEvent(linkLead, 'card-ev3', CUSTOMER_LINK_EVENTS.QUESTION, {
  questionText: 'Gibt es Winterreifen?',
});
assert.ok(questionResult.ok);
assert.equal(questionResult.interaction.customerQuestions.length, 1);
assert.equal(questionResult.inboxItem?.type, INBOX_EVENT_TYPES.CUSTOMER_MESSAGE);
assert.equal(questionResult.inboxItem?.title, 'Neue Nachricht zum Angebot');

const store = getCustomerMessageStore(questionResult.lead);
assert.equal(store.messages.length, 1);
assert.equal(store.messages[0].channel, MESSAGE_CHANNEL.CLEVER);
assert.equal(store.messages[0].direction, MESSAGE_DIRECTION.INBOUND);
assert.ok(questionResult.customerMessageInboxItem);
assert.equal(questionResult.customerMessageInboxItem.type, INBOX_EVENT_TYPES.CUSTOMER_MESSAGE);
assert.equal(questionResult.customerMessageInboxItem.id, questionResult.inboxItem?.id);

const openInbox = listInboxItems({ leadId: linkLead.id, status: 'open' });
assert.equal(
  openInbox.filter((item) => item.type === INBOX_EVENT_TYPES.CUSTOMER_MESSAGE).length,
  1,
);
assert.ok(!openInbox.some((item) => item.type === INBOX_EVENT_TYPES.OFFER_QUESTION));

// C) Clever Nachrichten "In Clever senden" erzeugt outbound customerMessage
const sent = sendCleverChannelMessage({
  lead: questionResult.lead,
  text: 'Winterreifen kann ich separat anbieten.',
  threadId: store.messages[0].threadId,
  relatedOfferId: 'card-ev3',
  createdByName: 'Max Verkäufer',
});
assert.ok(sent.message);
assert.equal(sent.message.direction, MESSAGE_DIRECTION.OUTBOUND);
assert.equal(sent.message.channel, MESSAGE_CHANNEL.CLEVER);
assert.equal(sent.message.status, MESSAGE_STATUS.SENT);
assert.equal(sent.message.visibleToCustomer, true);

// D) customer_message Inbox Item wird erzeugt
const mirrored = mirrorInboundCustomerQuestion({
  lead: baseLead,
  text: 'Wann kann ich probefahren?',
  relatedOfferId: 'card-ev3',
  relatedQuestionId: 'cq-test',
});
assert.ok(mirrored.inboxItem);
assert.equal(mirrored.inboxItem.type, INBOX_EVENT_TYPES.CUSTOMER_MESSAGE);
assert.equal(mirrored.inboxItem.title, 'Neue Nachricht zum Angebot');
assert.equal(mirrored.inboxItem.metadata.source, 'customer_portal');
assert.equal(mirrored.inboxItem.metadata.offerId, 'card-ev3');
const inboxItems = listInboxItems({ leadId: baseLead.id });
assert.ok(inboxItems.some((item) => item.type === INBOX_EVENT_TYPES.CUSTOMER_MESSAGE));

// E) Antworten auf customer_message öffnet Clever Nachrichten mit threadId
const replyUrl = buildInboxActionAkteUrl('lead-msg-1', {
  id: 'inbox-cm-1',
  type: INBOX_EVENT_TYPES.CUSTOMER_MESSAGE,
  leadId: 'lead-msg-1',
  offerId: 'card-ev3',
  metadata: {
    threadId: mirrored.message.threadId,
    messageId: mirrored.message.id,
    questionId: 'cq-test',
    suggestedIntent: 'answer_customer_question',
  },
});
assert.match(replyUrl, /sheet=antworten/);
assert.match(replyUrl, /threadId=/);
assert.match(replyUrl, /messageId=/);
assert.match(replyUrl, /intentId=answer_customer_question/);
assert.match(replyUrl, /offerId=card-ev3/);
assert.match(replyUrl, /questionId=cq-test/);

// G) Allgemeine Nachricht ohne questionId öffnet freie Antwort
const freeReplyUrl = buildInboxActionAkteUrl('lead-msg-1', {
  id: 'inbox-cm-free',
  type: INBOX_EVENT_TYPES.CUSTOMER_MESSAGE,
  leadId: 'lead-msg-1',
  metadata: {
    threadId: 'thread-free',
    messageId: 'msg-free',
    suggestedIntent: 'free_reply',
  },
});
assert.match(freeReplyUrl, /intentId=free_reply/);
assert.doesNotMatch(freeReplyUrl, /questionId=/);

// H) syncInboxItemsFromLead erzeugt kein offer_question bei vorhandenem customer_message
__resetInboxStoreForTests(openInbox);
syncInboxItemsFromLead(questionResult.lead);
const afterSync = listInboxItems({ leadId: linkLead.id, status: 'open' });
assert.ok(!afterSync.some((item) => item.type === INBOX_EVENT_TYPES.OFFER_QUESTION));
assert.equal(
  afterSync.filter((item) => item.type === INBOX_EVENT_TYPES.CUSTOMER_MESSAGE).length,
  1,
);

// F) WhatsApp/E-Mail extern markieren nicht automatisch als sent
const beforeExternal = getCustomerMessageStore(sent.lead).messages.length;
assert.equal(beforeExternal, 2);
const noAutoSent = addCustomerMessage({
  lead: sent.lead,
  direction: MESSAGE_DIRECTION.OUTBOUND,
  channel: MESSAGE_CHANNEL.WHATSAPP,
  status: MESSAGE_STATUS.OPENED_EXTERNAL,
  text: 'Kurze Rückmeldung per WhatsApp',
  visibleToCustomer: false,
});
assert.equal(noAutoSent.message.status, MESSAGE_STATUS.OPENED_EXTERNAL);
assert.notEqual(noAutoSent.message.status, MESSAGE_STATUS.SENT);

// G) visibleToCustomer true zeigt keine internal_sensitive Facts im Text
assert.equal(sanitizeCustomerVisibleText('Monatliches Einkommen liegt bei 4.000 €'), '');
const blocked = addCustomerMessage({
  lead: baseLead,
  direction: MESSAGE_DIRECTION.OUTBOUND,
  channel: MESSAGE_CHANNEL.CLEVER,
  status: MESSAGE_STATUS.SENT,
  text: 'Interne Notiz: Schufa schlecht',
  visibleToCustomer: true,
});
assert.equal(blocked.message, null);
assert.equal(blocked.error, 'sensitive_or_empty');

const inboxFromMessage = buildInboxItemFromCustomerMessage({
  lead: mirrored.lead,
  message: mirrored.message,
  thread: mirrored.thread,
});
assert.equal(inboxFromMessage.type, INBOX_EVENT_TYPES.CUSTOMER_MESSAGE);

console.log('customerMessageService.test.js: ok');
