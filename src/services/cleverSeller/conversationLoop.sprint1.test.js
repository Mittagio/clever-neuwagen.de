/**
 * Clever 2.0 Sprint 1 – Response Policy + Conversation Memory
 */
import assert from 'node:assert/strict';
import {
  CLEVER_RESPONSE_KIND,
  resolveAgentResponsePolicy,
  resolveSellerResponsePolicy,
} from '../cleverAgent/cleverAssistantResponse.js';
import {
  appendConversationTurn,
  createEmptyAgentWorkingMemory,
  getConversationHistoryForAgent,
  updateAgentWorkingMemory,
  updateMemoryFromSellerTurn,
} from '../cleverAgent/cleverAgentWorkingMemory.js';
import { routeSellerRequest } from '../cleverAgent/routeSellerRequest.js';
import { shouldShowUniversalReview } from './buildUniversalReviewModel.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';

{
  const hist = getConversationHistoryForAgent(
    appendConversationTurn(
      appendConversationTurn(createEmptyAgentWorkingMemory(), {
        role: 'user',
        text: 'Merk dir zwei Kinder',
      }),
      { role: 'assistant', text: 'Für Kai aufgenommen: 2 Kinder', kind: 'compact_confirmation' },
    ),
  );
  assert.equal(hist.length, 2);
  assert.equal(hist[0].role, 'user');
  assert.equal(hist[1].role, 'assistant');
}

{
  const lead = {
    id: 'lead-kai',
    contact: { name: 'Kai Drechsel' },
    crm: { needProfile: { understoodLabels: [] }, sellerInsights: [] },
  };
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: 'Merk dir, zwei Kinder, Hund und Blau bevorzugt.',
    customerName: 'Kai Drechsel',
  });
  const policy = resolveSellerResponsePolicy(turn);
  assert.ok(
    policy.kind === CLEVER_RESPONSE_KIND.COMPACT_CONFIRMATION
    || policy.kind === CLEVER_RESPONSE_KIND.DIRECT_ANSWER
    || (policy.kind === CLEVER_RESPONSE_KIND.PREPARED_ACTION_REVIEW && turn.rememberDecision),
    `unexpected kind ${policy.kind}`,
  );
  // Merken-Dump ohne Offer → kein Universal Review
  if (turn.rememberDecision?.mode === 'save_with_undo') {
    assert.equal(shouldShowUniversalReview(turn), false);
  }
  assert.ok(policy.message.length > 0);

  const mem = updateMemoryFromSellerTurn(null, turn, 'Merk dir, zwei Kinder, Hund und Blau bevorzugt.', policy);
  assert.ok(mem.conversationTurns.length >= 2);
}

{
  // Knowledge / Today → Direct, kein Review
  const fakeTurn = {
    assistantReply: 'Heute liegen 3 Vorgänge an.',
    todayOverview: { summaryLine: 'Heute liegen 3 Vorgänge an.' },
    preparedActions: [{ type: SELLER_TURN_INTENTS.GET_TODAY_OVERVIEW, status: 'prepared' }],
    extractedFacts: [],
  };
  assert.equal(shouldShowUniversalReview(fakeTurn), false);
  const policy = resolveSellerResponsePolicy(fakeTurn);
  assert.equal(policy.kind, CLEVER_RESPONSE_KIND.DIRECT_ANSWER);
  assert.equal(policy.showReview, false);
}

{
  const agentPolicy = resolveAgentResponsePolicy({
    ok: true,
    message: 'Gemerkt: 2 Kinder · Hund',
    toolCalls: [{ name: 'remember_customer_information' }],
    artifacts: [{ type: 'remember', data: { labels: ['2 Kinder', 'Hund'] } }],
  });
  assert.equal(agentPolicy.kind, CLEVER_RESPONSE_KIND.COMPACT_CONFIRMATION);
  assert.equal(agentPolicy.showReview, false);
}

{
  const offerPolicy = resolveAgentResponsePolicy({
    ok: true,
    message: 'Angebot vorbereitet',
    confirmationRequired: true,
    pendingAction: { type: 'prepare_offer', status: 'needs_confirmation' },
  });
  assert.equal(offerPolicy.kind, CLEVER_RESPONSE_KIND.PREPARED_ACTION_REVIEW);
  assert.equal(offerPolicy.showReview, true);
}

{
  // Agent-Memory: Termin aus preparedAppointment behalten
  const mem = updateAgentWorkingMemory(null, {
    ok: true,
    message: 'Terminvorschlag Montag 15 Uhr – bitte prüfen.',
    confirmationRequired: true,
    preparedAppointment: { startAt: '2099-01-05T15:00:00', whenLabel: 'Montag 15 Uhr' },
    pendingAction: { type: 'propose_appointment', status: 'needs_confirmation' },
    toolCalls: [{ name: 'propose_appointment', ok: true }],
  }, 'Schlag Montag 15 Uhr vor');
  assert.equal(mem.lastIntent, 'propose_appointment');
  assert.equal(mem.lastAppointmentProposal?.whenLabel, 'Montag 15 Uhr');
  assert.ok(mem.conversationTurns.length >= 2);
}

{
  // Follow-up-Routing: Termin / Rewrite / Offer → Agent
  const withAppt = {
    ...createEmptyAgentWorkingMemory(),
    lastAppointmentProposal: { startAt: '2099-01-05T15:00:00' },
  };
  assert.equal(routeSellerRequest('lieber Dienstag 10 Uhr', { workingMemory: withAppt }), 'clever_agent');

  const withDraft = {
    ...createEmptyAgentWorkingMemory(),
    lastMessageDraft: { body: 'Hallo …', at: new Date().toISOString() },
  };
  assert.equal(routeSellerRequest('kürzer', { workingMemory: withDraft }), 'clever_agent');
  assert.equal(routeSellerRequest('senden', { workingMemory: withDraft }), 'clever_agent');

  const withOffer = {
    ...createEmptyAgentWorkingMemory(),
    previousOfferPreparation: { grounded: { modelKey: 'ev3' } },
  };
  assert.equal(routeSellerRequest('doch lieber rot', { workingMemory: withOffer }), 'clever_agent');
}

console.log('conversationLoop.sprint1.test.js: ok');
