/**
 * Clever Wissen + Spezialfragen – Integrationstests
 */
import assert from 'node:assert/strict';
import {
  createLearningRequest,
  LEARNING_REQUEST_STATUSES,
  LEARNING_SOURCE_AREAS,
  listLearningRequests,
  resetLearningRequestsStore,
} from './cleverLearningRequestService.js';
import {
  approveCleverKnowledgeAnswer,
  createCleverKnowledgeAnswer,
  findApprovedKnowledgeAnswer,
  findPendingKnowledgeAnswer,
  KNOWLEDGE_ANSWER_STATUS,
  KNOWLEDGE_CONFIDENCE,
  resetCleverKnowledgeStore,
  saveSellerKnowledgeAnswerFromLead,
} from './cleverKnowledgeAnswerService.js';
import {
  buildSpecialQuestionAkteChips,
  detectSpecialCustomerQuestion,
} from '../dealer/specialCustomerQuestionService.js';
import { createLeadFromSpecialQuestion } from '../dealer/specialCustomerQuestionLeadService.js';
import {
  buildCleverActionRecommendation,
  CLEVER_ACTION_IDS,
} from '../crm/cleverActionEngine.js';

resetLearningRequestsStore();
resetCleverKnowledgeStore();

const QUESTION = 'Kann ich beim EV4 Windabweiser montieren?';

// 1. Spezialfrage erzeugt LearningRequest
const special = detectSpecialCustomerQuestion(QUESTION, {
  modelKey: 'ev4',
  modelLabel: 'Kia EV4',
});
assert.ok(special);
assert.equal(special.category, 'Zubehör');
assert.equal(special.modelKey, 'ev4');
assert.equal(special.status, 'needs_dealer_check');

const learning = createLearningRequest({
  query: QUESTION,
  modelKey: 'ev4',
  modelLabel: 'Kia EV4',
  sourceArea: LEARNING_SOURCE_AREAS.CUSTOMER_ADVISOR,
  pageContext: 'Kunden-Beratung',
});
assert.equal(learning.created, true);
assert.equal(learning.request.status, LEARNING_REQUEST_STATUSES.OPEN);

// Lead + Kundenakte
const lead = createLeadFromSpecialQuestion({
  contact: { name: 'Max', phone: '0171', email: '' },
  specialCustomerQuestion: { ...special, learningRequestId: learning.request.id },
  dealerConditions: { dealerId: 'demo', dealerName: 'Demo Autohaus' },
});
assert.equal(lead.crm.nextStepLabel, 'Kundenfrage beantworten');
assert.equal(lead.specialCustomerQuestion.rawText, QUESTION);

// 8. Kundenakte zeigt Next Step „Kundenfrage beantworten“
const recoBefore = buildCleverActionRecommendation({ lead, vehicleCards: [], customerName: 'Max' });
assert.equal(recoBefore.actionId, CLEVER_ACTION_IDS.ANSWER_CUSTOMER_QUESTION);
assert.match(recoBefore.explanation, /spezielle Frage/i);

const chips = buildSpecialQuestionAkteChips(lead.specialCustomerQuestion);
assert.ok(chips.includes('Zubehörfrage'));
assert.ok(chips.some((c) => /Windabweiser prüfen/.test(c)));

// 2. Verkäufer kann Antwort speichern
const saved = saveSellerKnowledgeAnswerFromLead({
  lead,
  answerText: 'Ja, Windabweiser können als Zubehör montiert werden. Bitte nur freigegebenes Zubehör verwenden.',
  sourceNote: 'Zubehörkatalog',
  learnForClever: true,
  userId: 'seller-1',
  userName: 'Anna',
});
assert.equal(saved.ok, true);

// 3. Antwort wird mit status pending_review gespeichert
assert.equal(saved.answer.status, KNOWLEDGE_ANSWER_STATUS.PENDING_REVIEW);
assert.equal(saved.answer.confidence, KNOWLEDGE_CONFIDENCE.SELLER_ANSWERED);

// 4. Antwort ist mit originalLearningRequestId verknüpft
assert.equal(saved.answer.originalLearningRequestId, learning.request.id);

// 10. LearningRequest wechselt auf in_review
const lrInReview = listLearningRequests().find((item) => item.id === learning.request.id);
assert.equal(lrInReview.status, LEARNING_REQUEST_STATUSES.IN_REVIEW);

// 7. Nicht freigegebene Antwort wird nicht als sichere Kundenantwort ausgespielt
const pendingLookup = findPendingKnowledgeAnswer('EV4 Windabweiser', 'ev4');
assert.ok(pendingLookup);
const approvedLookupBefore = findApprovedKnowledgeAnswer('EV4 Windabweiser', 'ev4');
assert.equal(approvedLookupBefore, null);

// 5. Antwort kann Admin freigeben
const approved = approveCleverKnowledgeAnswer(saved.answer.id);
assert.equal(approved.status, KNOWLEDGE_ANSWER_STATUS.APPROVED);
assert.equal(approved.confidence, KNOWLEDGE_CONFIDENCE.ADMIN_VERIFIED);

// 10b. LearningRequest resolved nach Freigabe
const lrResolved = listLearningRequests().find((item) => item.id === learning.request.id);
assert.equal(lrResolved.status, LEARNING_REQUEST_STATUSES.RESOLVED);

// 6. Freigegebene Antwort wird im Lexikon gefunden
const approvedLookup = findApprovedKnowledgeAnswer('EV4 Windabweiser', 'ev4');
assert.ok(approvedLookup);
assert.match(approvedLookup.answerText, /Windabweiser/i);

// 9. Nach Antwortspeicherung – Next Step wechselt bei beantwortetem Lead
const leadAnswered = {
  ...lead,
  specialQuestionAnswer: {
    answerText: saved.answer.answerText,
    knowledgeAnswerId: saved.answer.id,
    savedAt: new Date().toISOString(),
    sentAt: null,
  },
};
const recoAfter = buildCleverActionRecommendation({ lead: leadAnswered, vehicleCards: [], customerName: 'Max' });
assert.equal(recoAfter.actionId, CLEVER_ACTION_IDS.SEND_CUSTOMER_ANSWER);

// Zusätzlich: createCleverKnowledgeAnswer direkt
resetCleverKnowledgeStore();
const direct = createCleverKnowledgeAnswer({
  questionText: 'Passt eine Hundebox in den EV3?',
  answerText: 'Das hängt von der Boxgröße ab.',
  modelKey: 'ev3',
  modelLabel: 'Kia EV3',
  category: 'Familie / Hund',
  status: KNOWLEDGE_ANSWER_STATUS.PENDING_REVIEW,
});
assert.equal(direct.ok, true);

console.log('cleverKnowledgeAnswerService.test.js: ok');
