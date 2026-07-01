/**
 * Clever Eingang – Frag-Clever-Kontaktanfragen
 */
import assert from 'node:assert/strict';
import {
  __clearInboxTestMode,
  __resetInboxStoreForTests,
  createInboxItem,
  INBOX_EVENT_TYPES,
  listInboxItems,
} from '../crm/cleverInboxService.js';
import {
  buildAdvisorInboxMessage,
  buildAdvisorInboxTopics,
  createAdvisorContactInboxItem,
  hasAdvisorContactInboxItem,
} from './advisorInboxService.js';
import { createLeadFromAdvisorConversation } from './advisorConversationLeadService.js';
import {
  appendAdvisorExchange,
  createCustomerAdvisorSession,
} from '../clever/customerAdvisorSession.js';

__resetInboxStoreForTests([]);

const session = createCustomerAdvisorSession('autohaus-trinkle');
const withExchange = appendAdvisorExchange(session, 'Gibt es den EV9 neu und was wäre die Lieferzeit?', {
  classification: { queryType: 'vehicle_wish', topic: 'advisor_profile_assessment' },
  smartAnswer: { title: 'Kia EV9 – Verfügbarkeit' },
  extractedSignals: ['EV9', 'Lieferzeit', 'Angebot gewünscht'],
});

const lead = createLeadFromAdvisorConversation({
  contact: { name: 'Max Mustermann', phone: '0123', email: 'm@test.de' },
  advisorSession: withExchange,
  dealerConditions: { dealerId: 'autohaus-trinkle' },
  intentType: 'contact',
});

// A) Inbox Item wird erstellt
const item = createAdvisorContactInboxItem(lead);
assert.ok(item, 'Inbox Item soll erstellt werden');
assert.equal(item.type, INBOX_EVENT_TYPES.ADVISOR_CONTACT_REQUEST);
assert.equal(item.title, 'Neue Frage aus Frag Clever');
assert.equal(item.actionLabel, 'Antworten');
assert.equal(item.actionTarget, 'reply');
assert.equal(item.leadId, lead.id);
assert.equal(item.sourceArea, 'customer_advisor');
assert.match(item.message, /EV9/i);
assert.match(item.message, /Lieferzeit/i);

// B) Themen aus extractedSignals
const topics = buildAdvisorInboxTopics({
  advisorConversation: {
    extractedSignals: [
      { id: '1', label: 'EV9 interessiert' },
      { id: '2', label: 'Familie' },
      { id: '3', label: 'Sorento Diesel Alternative' },
    ],
  },
});
assert.ok(topics.includes('EV9 interessiert'));
assert.ok(topics.includes('Familie'));

assert.match(buildAdvisorInboxMessage(lead), /EV9/i);

// C) Dedup
const second = createAdvisorContactInboxItem(lead);
assert.equal(second.id, item.id);
const all = listInboxItems({ leadId: lead.id, type: INBOX_EVENT_TYPES.ADVISOR_CONTACT_REQUEST });
assert.equal(all.length, 1);

assert.equal(hasAdvisorContactInboxItem(lead.id), true);

// D) Kein Item ohne Advisor-Gespräch
__resetInboxStoreForTests([]);
const plainLead = { id: 'lead-plain', contact: { name: 'Test' }, source: 'search' };
assert.equal(createAdvisorContactInboxItem(plainLead), null);
assert.equal(listInboxItems().length, 0);

// E) Normale Angebots-Interaktion unverändert
const offerItem = createInboxItem({
  type: INBOX_EVENT_TYPES.OFFER_INTERESTED,
  title: 'Kunde interessiert sich',
  message: 'EV6 GT-Line',
  leadId: 'lead-offer',
  customerId: 'lead-offer',
  metadata: { dedupeKey: 'offer:lead-offer:card-1' },
});
assert.equal(offerItem.type, INBOX_EVENT_TYPES.OFFER_INTERESTED);
assert.equal(listInboxItems({ type: INBOX_EVENT_TYPES.OFFER_INTERESTED }).length, 1);
assert.equal(listInboxItems({ type: INBOX_EVENT_TYPES.ADVISOR_CONTACT_REQUEST }).length, 0);

// Fallback message
assert.equal(
  buildAdvisorInboxMessage({ id: 'x' }),
  'Kunde hat über Frag Clever eine Frage gestellt.',
);

__clearInboxTestMode();
console.log('advisorInboxService.test.js: OK');
