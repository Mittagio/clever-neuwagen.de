/**
 * Clever 2.0 Sprint 2 – Agent Tool Coverage (Legacy wrap)
 * node src/services/cleverAgent/toolCoverage.sprint2.test.js
 */
import assert from 'node:assert/strict';
import { listCleverAgentToolNames, getCleverAgentTool } from './cleverToolRegistry.js';
import { executeCleverAgentTool } from './cleverToolExecutor.js';
import { runCleverAgent } from './cleverAgentService.js';
import { buildAgentReviewTurn } from './buildAgentReviewTurn.js';
import { resolveAgentResponsePolicy, CLEVER_RESPONSE_KIND } from './cleverAssistantResponse.js';
import { shouldFallbackToSellerTurn } from './cleverAgentClient.js';
import { shouldShowUniversalReview } from '../cleverSeller/buildUniversalReviewModel.js';

const REQUIRED_SPRINT2_TOOLS = [
  'find_customer',
  'open_customer',
  'update_customer_facts',
  'lookup_vehicle_fact',
  'lookup_package',
  'lookup_equipment',
  'compare_vehicles',
  'modify_offer',
  'import_offer_pdf',
  'compare_contract_offer',
  'rewrite_message',
  'intend_send',
  'propose_appointment',
  'modify_appointment',
  'check_availability',
  'classify_attachment',
  'import_contract',
  'prepare_trade_in',
  'get_today_overview',
  'create_follow_up',
  'search_offers',
  'search_contracts',
  'search_documents',
];

const BASELINE_TOOLS = [
  'get_customer_context',
  'summarize_customer',
  'remember_customer_information',
  'search_customer_history',
  'list_offers',
  'get_offer',
  'prepare_offer',
  'create_offer',
  'create_message',
  'create_customer_link',
];

{
  const names = listCleverAgentToolNames();
  for (const id of [...BASELINE_TOOLS, ...REQUIRED_SPRINT2_TOOLS]) {
    assert.ok(names.includes(id), `missing agent tool: ${id}`);
    assert.ok(getCleverAgentTool(id), `registry entry missing: ${id}`);
  }
  assert.ok(names.length >= BASELINE_TOOLS.length + REQUIRED_SPRINT2_TOOLS.length);
}

const brandes = {
  id: 'lead-brandes',
  contact: { name: 'Herr Brandes', firstName: 'Thomas', lastName: 'Brandes' },
  name: 'Herr Brandes',
  crm: { vehicleOffers: {}, vehicleConfigurations: [], sellerInsights: [] },
};

{
  const found = executeCleverAgentTool('find_customer', { query: 'Brandes' }, {
    leadsSnapshot: [brandes],
    sellerMessage: 'Wo ist Brandes?',
  });
  assert.equal(found.ok, true, found.message);
  assert.equal(found.confirmationRequired, false);
  assert.match(String(found.message), /Brandes/i);
}

{
  const today = executeCleverAgentTool('get_today_overview', {}, {
    leadsSnapshot: [brandes],
  });
  assert.equal(today.ok, true, today.message);
  assert.equal(today.confirmationRequired, false);
  const policy = resolveAgentResponsePolicy({
    ok: true,
    message: today.message,
    toolCalls: [{ name: 'get_today_overview' }],
  });
  assert.equal(policy.kind, CLEVER_RESPONSE_KIND.DIRECT_ANSWER);
  assert.equal(policy.showReview, false);
}

{
  const trade = executeCleverAgentTool('prepare_trade_in', {
    sellerInput: 'Smart fortwo kommt in Zahlung',
  }, { lead: brandes, sellerMessage: 'Smart fortwo kommt in Zahlung' });
  assert.equal(trade.ok, true, trade.message);
  assert.equal(trade.confirmationRequired, true);
  assert.equal(trade.pendingAction?.type, 'prepare_trade_in');
  const reviewTurn = buildAgentReviewTurn({
    confirmationRequired: true,
    message: trade.message,
    pendingAction: trade.pendingAction,
    extractedFacts: trade.extractedFacts,
  });
  assert.ok(reviewTurn);
  assert.equal(shouldShowUniversalReview(reviewTurn), true);
  const policy = resolveAgentResponsePolicy({
    ok: true,
    message: trade.message,
    confirmationRequired: true,
    pendingAction: trade.pendingAction,
    toolCalls: [{ name: 'prepare_trade_in', confirmationRequired: true }],
  });
  assert.equal(policy.kind, CLEVER_RESPONSE_KIND.PREPARED_ACTION_REVIEW);
  assert.equal(policy.showReview, true);
}

{
  const classified = executeCleverAgentTool('classify_attachment', {
    fileName: 'altvertrag-brandes.pdf',
    text: 'Leasingvertrag Enddatum 12.2026',
  }, {});
  assert.equal(classified.ok, true);
  assert.equal(classified.kind, 'contract_pdf');
}

{
  const avail = executeCleverAgentTool('check_availability', {
    startsAt: '2026-08-11T15:00:00.000Z',
  }, {});
  assert.equal(avail.ok, true);
  assert.equal(avail.confirmationRequired, false);
  assert.ok(avail.availability);
}

{
  const forced = await runCleverAgent({
    sellerMessage: 'Was liegt heute an?',
    lead: brandes,
    leadsSnapshot: [brandes],
    forcedTools: [{ name: 'get_today_overview', arguments: {} }],
  });
  assert.equal(forced.ok, true, forced.message);
  assert.equal(forced.confirmationRequired, false);
  assert.ok((forced.toolCalls || []).some((t) => t.name === 'get_today_overview'));
}

{
  const forcedTrade = await runCleverAgent({
    sellerMessage: 'Smart fortwo kommt in Zahlung',
    lead: brandes,
    forcedTools: [{
      name: 'prepare_trade_in',
      arguments: { sellerInput: 'Smart fortwo kommt in Zahlung' },
    }],
  });
  assert.equal(forcedTrade.ok, true);
  assert.equal(forcedTrade.confirmationRequired, true);
}

{
  assert.equal(shouldFallbackToSellerTurn({
    ok: false,
    fallbackReason: 'feature_disabled',
  }), true);
  assert.equal(shouldFallbackToSellerTurn({
    ok: false,
    error: 'network_error',
    fallbackReason: 'network_error',
  }), true);
  assert.equal(shouldFallbackToSellerTurn({
    ok: true,
    message: 'ok',
  }), false);
  assert.equal(shouldFallbackToSellerTurn({
    ok: false,
    confirmationRequired: true,
    pendingAction: { type: 'prepare_offer' },
  }), false);
}

{
  const facts = executeCleverAgentTool('update_customer_facts', {
    facts: [{
      field: 'annualMileage',
      value: 15000,
      label: '15.000 km',
      factClass: 'commercial_preference',
    }],
  }, { lead: brandes });
  assert.equal(facts.ok, true);
  assert.equal(facts.confirmationRequired, false);
  assert.ok(facts.mutations?.length);
}

console.log('toolCoverage.sprint2.test.js: ok');
