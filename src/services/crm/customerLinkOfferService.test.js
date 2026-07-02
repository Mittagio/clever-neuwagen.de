/**
 * Kundenlink-Rückkanal – Events, CRM und Inbox
 */
import assert from 'node:assert/strict';
import {
  applyCustomerLinkEvent,
  CUSTOMER_LINK_EVENTS,
  resolveLeadFromOfferLink,
} from './customerLinkOfferService.js';
import {
  __clearInboxTestMode,
  __resetInboxStoreForTests,
  INBOX_EVENT_TYPES,
  listInboxItems,
} from './cleverInboxService.js';
import { INTEREST_STATUS } from '../customerOfferInteraction.js';
import { VEHICLE_OFFER_STATUS } from '../vehicleOffer.js';
import { buildVehicleOpportunityCards } from '../customerAkte.js';
import {
  buildCleverActionRecommendation,
  CLEVER_ACTION_IDS,
} from './cleverActionEngine.js';

const lead = {
  id: 'lead-link-1',
  contact: { name: 'Max Müller' },
  paymentType: 'leasing',
  crm: {
    reservedModels: [{ id: 'card-ev3', name: 'EV3', modelKey: 'ev3', trimLabel: 'Earth' }],
    vehicleOffers: {
      'card-ev3': {
        vehicleCardId: 'card-ev3',
        status: VEHICLE_OFFER_STATUS.SENT,
        onlineLink: {
          url: 'http://localhost:3001/angebot/online/ev3-earth/max-muller?leadId=lead-link-1&cardId=card-ev3',
        },
        tracking: { openCount: 0 },
      },
    },
  },
  history: [],
};

__resetInboxStoreForTests([]);

const resolved = resolveLeadFromOfferLink([lead], {
  leadId: 'lead-link-1',
  vehicleCardId: 'card-ev3',
});
assert.equal(resolved.lead?.id, 'lead-link-1');
assert.equal(resolved.vehicleCardId, 'card-ev3');

const opened = applyCustomerLinkEvent(lead, 'card-ev3', CUSTOMER_LINK_EVENTS.OPENED);
assert.ok(opened.ok);
assert.equal(opened.interaction.interestStatus, INTEREST_STATUS.OPENED);
assert.equal(opened.vehicleOffer.tracking.openCount, 1);
assert.equal(opened.inboxItem?.type, INBOX_EVENT_TYPES.OFFER_OPENED);

let current = opened.lead;
const interested = applyCustomerLinkEvent(current, 'card-ev3', CUSTOMER_LINK_EVENTS.INTERESTED);
assert.ok(interested.ok);
assert.equal(interested.interaction.interestStatus, INTEREST_STATUS.INTERESTED);
assert.equal(interested.inboxItem?.type, INBOX_EVENT_TYPES.OFFER_INTERESTED);

current = interested.lead;
const question = applyCustomerLinkEvent(current, 'card-ev3', CUSTOMER_LINK_EVENTS.QUESTION, {
  questionText: 'Ist Winterreifen-Paket dabei?',
});
assert.ok(question.ok);
assert.equal(question.interaction.interestStatus, INTEREST_STATUS.QUESTION_ASKED);
assert.equal(question.interaction.customerQuestions.length, 1);
assert.equal(question.inboxItem?.type, INBOX_EVENT_TYPES.OFFER_QUESTION);
assert.equal(question.inboxItem?.status, 'open');

const inbox = listInboxItems({ leadId: lead.id });
assert.ok(inbox.some((item) => item.type === INBOX_EVENT_TYPES.OFFER_OPENED));
assert.ok(inbox.some((item) => item.type === INBOX_EVENT_TYPES.OFFER_INTERESTED));
assert.ok(inbox.some((item) => item.type === INBOX_EVENT_TYPES.OFFER_QUESTION));
assert.ok(inbox.some((item) => item.type === INBOX_EVENT_TYPES.CUSTOMER_MESSAGE));
assert.equal(question.lead.crm.customerMessages?.length, 1);

const cards = buildVehicleOpportunityCards({
  lead: question.lead,
  reservedModels: question.lead.crm.reservedModels,
});
const recommendation = buildCleverActionRecommendation({
  lead: question.lead,
  vehicleCards: cards,
});
assert.equal(recommendation?.actionId, CLEVER_ACTION_IDS.OFFER_QUESTION_ANSWER);

const declined = applyCustomerLinkEvent(lead, 'card-ev3', CUSTOMER_LINK_EVENTS.DECLINED);
assert.ok(declined.ok);
assert.equal(declined.inboxItem?.type, INBOX_EVENT_TYPES.OFFER_DECLINED);

__clearInboxTestMode();

console.log('customerLinkOfferService.test.js: OK');
