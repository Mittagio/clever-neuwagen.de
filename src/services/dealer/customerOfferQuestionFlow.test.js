/**
 * Kundenfrage beantworten – Flow aus Clever Eingang
 */
import assert from 'node:assert/strict';
import {
  answerCustomerQuestion,
  addCustomerQuestion,
  countOpenQuestions,
  createEmptyInteraction,
  INTEREST_STATUS,
  resolveBoardBadge,
} from '../customerOfferInteraction.js';
import { applyCustomerOfferQuestionAnswer } from '../dealer/customerOfferQuestionAnswerService.js';
import { buildQuestionAnswerAkteUrl } from '../crm/cleverInboxQuestionRoute.js';
import {
  __clearInboxTestMode,
  __resetInboxStoreForTests,
  createInboxItem,
  INBOX_EVENT_TYPES,
  INBOX_STATUS,
  listInboxItems,
  markInboxDoneForQuestion,
} from '../crm/cleverInboxService.js';
import { buildCleverActionRecommendation } from '../crm/cleverActionEngine.js';
import { CLEVER_ACTION_IDS } from '../crm/cleverActionEngine.js';
import { buildVehicleOpportunityCards } from '../customerAkte.js';

// A) answerCustomerQuestion
const base = createEmptyInteraction('vc-ev6', 'lead-1');
const withQ = addCustomerQuestion(base, 'Winterreifen dabei?');
const questionId = withQ.customerQuestions[0].id;
const answered = answerCustomerQuestion(withQ, questionId, {
  answerText: 'Winterreifen kann ich separat anbieten.',
  answeredBy: 'seller-1',
});

assert.equal(answered.customerQuestions[0].status, 'answered');
assert.equal(answered.customerQuestions[0].answerText, 'Winterreifen kann ich separat anbieten.');
assert.ok(answered.customerQuestions[0].answeredAt);
assert.equal(answered.customerQuestions[0].answeredBy, 'seller-1');
assert.equal(countOpenQuestions(answered), 0);
assert.equal(answered.interestStatus, INTEREST_STATUS.NOT_SEEN);

const opened = { ...withQ, openedAt: '2026-01-01T10:00:00.000Z', interestStatus: INTEREST_STATUS.QUESTION_ASKED };
const answeredOpened = answerCustomerQuestion(opened, questionId, { answerText: 'Ja, möglich.' });
assert.equal(answeredOpened.interestStatus, INTEREST_STATUS.OPENED);

// B) CleverInbox Route
const inboxItem = {
  id: 'inbox-q-1',
  type: INBOX_EVENT_TYPES.OFFER_QUESTION,
  leadId: 'lead-1',
  offerId: 'vc-ev6',
  metadata: { questionId: 'cq-123' },
};
const url = buildQuestionAnswerAkteUrl('lead-1', inboxItem);
assert.match(url, /sheet=question_answer/);
assert.match(url, /offerId=vc-ev6/);
assert.match(url, /questionId=cq-123/);
assert.match(url, /inboxItemId=inbox-q-1/);

const fallbackUrl = buildQuestionAnswerAkteUrl('lead-1', {
  id: 'inbox-x',
  type: INBOX_EVENT_TYPES.CONTACT_REQUESTED,
  leadId: 'lead-1',
});
assert.match(fallbackUrl, /sheet=antworten/);
assert.doesNotMatch(fallbackUrl, /questionId=/);

// C) applyCustomerOfferQuestionAnswer
const lead = {
  id: 'lead-1',
  contact: { name: 'Max' },
  crm: {
    customerOfferInteractions: {
      'vc-ev6': withQ,
    },
  },
};
const saveResult = applyCustomerOfferQuestionAnswer({
  lead,
  offerId: 'vc-ev6',
  questionId,
  answerText: 'Winterreifen sind optional.',
});
assert.equal(saveResult.ok, true);
assert.match(saveResult.historyText, /Winterreifen dabei/);
assert.match(saveResult.historyText, /Winterreifen sind optional/);
const savedQ = saveResult.leadPatch.crm.customerOfferInteractions['vc-ev6'].customerQuestions[0];
assert.equal(savedQ.status, 'answered');

// D) Inbox erledigen
__resetInboxStoreForTests([]);
const item = createInboxItem({
  type: INBOX_EVENT_TYPES.OFFER_QUESTION,
  title: 'Kundenfrage offen',
  message: '„Winterreifen dabei?“',
  leadId: 'lead-1',
  customerId: 'lead-1',
  offerId: 'vc-ev6',
  metadata: { questionId, dedupeKey: `offer-question:lead-1:vc-ev6:${questionId}` },
});
assert.equal(item.status, INBOX_STATUS.OPEN);

const done = markInboxDoneForQuestion({ inboxItemId: item.id });
assert.equal(done.status, INBOX_STATUS.DONE);

__resetInboxStoreForTests([item]);
const doneFallback = markInboxDoneForQuestion({ leadId: 'lead-1', questionId });
assert.equal(doneFallback.status, INBOX_STATUS.DONE);

// E) Beantwortete Frage nicht mehr priorisiert
const answeredLead = {
  id: 'lead-1',
  contact: { name: 'Max' },
  crm: {
    customerOfferInteractions: {
      'vc-ev6': answeredOpened,
    },
    vehicleOffers: {},
  },
};
const cards = buildVehicleOpportunityCards({ lead: answeredLead });
const reco = buildCleverActionRecommendation({
  lead: answeredLead,
  vehicleCards: cards,
  inboxItems: [],
});
assert.notEqual(reco?.actionId, CLEVER_ACTION_IDS.OFFER_QUESTION_ANSWER);

const openBadge = resolveBoardBadge({}, withQ, null);
assert.equal(openBadge.label, 'Frage offen');
const doneBadge = resolveBoardBadge({}, answeredOpened, null);
assert.notEqual(doneBadge.label, 'Frage offen');

__clearInboxTestMode();
console.log('customerOfferQuestionFlow.test.js: OK');
