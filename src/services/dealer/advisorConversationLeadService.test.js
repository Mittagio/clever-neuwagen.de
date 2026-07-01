/**
 * Lead aus Frag-Clever-Gespräch – advisorConversation-Payload
 */
import assert from 'node:assert/strict';
import {
  appendAdvisorExchange,
  appendFollowUpClick,
  buildAdvisorOpenQuestions,
  createCustomerAdvisorSession,
} from '../clever/customerAdvisorSession.js';
import { createLeadFromAdvisorConversation } from './advisorConversationLeadService.js';
import { QUERY_TYPES } from '../clever/customerQueryTypes.js';
import { SOURCE_MODES } from './dealerSourceMode.js';

const session = createCustomerAdvisorSession('dealer-test');

let active = appendAdvisorExchange(session, 'Größtes Elektroauto?', {
  classification: { queryType: QUERY_TYPES.RANKING_QUESTION },
  smartAnswer: { title: 'Größtes Elektroauto' },
  extractedSignals: ['großes Auto'],
});

active = appendFollowUpClick(active, {
  label: 'Mehr Infos zum EV9',
  query: 'Mehr Infos zum Kia EV9',
  type: 'model_detail',
});

active = appendAdvisorExchange(active, 'Mehr Infos zum Kia EV9', {
  classification: { queryType: QUERY_TYPES.MODEL_EQUIPMENT_QUESTION, modelKey: 'ev9' },
  ui: { modelKeys: ['ev9'] },
  smartAnswer: { title: 'Kia EV9' },
});

active = appendAdvisorExchange(active, 'Beste EV9-Variante für Familie', {
  classification: { queryType: QUERY_TYPES.ADVICE_QUESTION, modelKey: 'ev9', adviceTopicId: 'family' },
  ui: { modelKeys: ['ev9'] },
  smartAnswer: { title: 'EV9 für Familie' },
});

active = appendAdvisorExchange(active, 'Und wenn ich einen Sorento Diesel nehme?', {
  classification: {
    queryType: QUERY_TYPES.COMPARISON_QUESTION,
    comparisonModels: ['ev9', 'sorento'],
  },
  ui: { modelKeys: ['ev9', 'sorento'] },
  smartAnswer: { title: 'EV9 vs Sorento Diesel' },
});

const openQuestions = buildAdvisorOpenQuestions(active);
assert.ok(openQuestions.length >= 3, 'offene Fragen aus User-Messages');
assert.ok(openQuestions.some((q) => /Sorento/i.test(q.question)));

const lead = createLeadFromAdvisorConversation({
  contact: { name: 'Test Kunde', phone: '0123', email: 't@test.de' },
  advisorSession: active,
  dealerConditions: { dealerId: 'autohaus-trinkle' },
  intentType: 'contact',
});

assert.ok(lead.advisorConversation, 'advisorConversation am Lead');
assert.equal(lead.advisorConversation.sourceMode, 'advisor_conversation');
assert.ok(lead.advisorConversation.messages.length >= 8);
assert.ok(lead.advisorConversation.summary.includes('Beratungsverlauf'));
assert.ok(lead.advisorConversation.extractedSignals.length >= 1);
assert.ok(lead.advisorConversation.openQuestions.length >= 3);
assert.equal(lead.advisorConversation.followUpsClicked.length, 1);
assert.equal(lead.crm.sourceMode, SOURCE_MODES.ADVISOR);
assert.equal(lead.crm.nextStepId, 'continue_advisor_conversation');
assert.match(lead.crm.nextStepLabel, /EV9|SORENTO|Vergleich/i);

console.log('advisorConversationLeadService.test.js: OK');
