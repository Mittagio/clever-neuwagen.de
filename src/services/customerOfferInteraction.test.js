import assert from 'node:assert/strict';
import {
  INTEREST_STATUS,
  addCustomerQuestion,
  answerCustomerQuestion,
  countOpenQuestions,
  createEmptyInteraction,
  resolveBoardBadge,
  resolveLinkStatusLabel,
} from './customerOfferInteraction.js';
import { VEHICLE_OFFER_STATUS } from './vehicleOffer.js';

const empty = createEmptyInteraction('vc-1', 'lead-1');
assert.equal(empty.interestStatus, INTEREST_STATUS.NOT_SEEN);
assert.equal(empty.customerQuestions.length, 0);

const withQuestion = addCustomerQuestion(empty, 'Gibt es den auch in Schwarz?');
assert.equal(withQuestion.interestStatus, INTEREST_STATUS.QUESTION_ASKED);
assert.equal(countOpenQuestions(withQuestion), 1);

const qid = withQuestion.customerQuestions[0].id;
const answered = answerCustomerQuestion(withQuestion, qid, {
  answerText: 'Ja, schwarz ist verfügbar.',
  answeredBy: 'verkäufer',
});
assert.equal(answered.customerQuestions[0].status, 'answered');
assert.ok(answered.customerQuestions[0].answeredAt);
assert.equal(countOpenQuestions(answered), 0);

const sentBadge = resolveBoardBadge({}, null, { status: VEHICLE_OFFER_STATUS.SENT });
assert.equal(sentBadge.label, 'Gesendet');

const questionBadge = resolveBoardBadge({}, withQuestion, { status: VEHICLE_OFFER_STATUS.SENT });
assert.equal(questionBadge.label, 'Frage offen');
assert.equal(questionBadge.openQuestionCount, 1);

const openedBadge = resolveBoardBadge({}, null, { status: VEHICLE_OFFER_STATUS.OPENED });
assert.equal(openedBadge.label, 'Geöffnet');

assert.equal(resolveLinkStatusLabel({ status: VEHICLE_OFFER_STATUS.SENT }), 'Gesendet');
assert.equal(resolveLinkStatusLabel({ onlineLink: { url: 'https://x.de' }, status: VEHICLE_OFFER_STATUS.LINK_READY }), 'Link vorbereitet');

console.log('customerOfferInteraction.test.js: ok');
