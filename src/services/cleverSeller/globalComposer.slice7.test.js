/**
 * Slice 7: Contract Memory Search
 * node --test src/services/cleverSeller/globalComposer.slice7.test.js
 */
import assert from 'node:assert/strict';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import {
  isCustomerContractQuery,
  detectContractQueryField,
  CONTRACT_QUERY_FIELDS,
  searchCustomerContracts,
} from './searchCustomerContracts.js';
import { createBrandesGoldenCaseLead } from '../crm/brandesGoldenCase.js';

const GOLDEN_CONTRACT = `Leasingvertrag
Kunde Herr Brandes
Ford Kuga
Vertragsbeginn 01.12.2022
Laufzeit 48 Monate
15.000 km jährlich
Rate 329 Euro
Sonderzahlung 0 Euro
Vertragsende 30.11.2026
Mehrkilometer 8 Cent
Minderkilometer 3 Cent`;

function brandesWithContract() {
  const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });
  const turn = runCleverSellerTurn({
    lead: brandes,
    sellerInput: GOLDEN_CONTRACT,
    customerName: 'Brandes',
  });
  const applied = applyAcceptedSellerTurn(brandes, turn, { postFeedCard: false });
  assert.ok(applied.ok);
  assert.ok(applied.lead.crm?.customerContracts?.length >= 1);
  return applied.lead;
}

// --- Query detection ---
{
  assert.equal(isCustomerContractQuery('Wann läuft Brandes aus?'), true);
  assert.equal(detectContractQueryField('Wann läuft Brandes aus?'), CONTRACT_QUERY_FIELDS.END_DATE);
  assert.equal(detectContractQueryField('Was zahlt Garritano momentan?'), CONTRACT_QUERY_FIELDS.MONTHLY_RATE);
  assert.equal(detectContractQueryField('Wie viele Kilometer hat Frau Deutsche im Vertrag?'), CONTRACT_QUERY_FIELDS.ANNUAL_MILEAGE);
  assert.equal(detectContractQueryField('Welche Leasinggesellschaft hat den Vertrag?'), CONTRACT_QUERY_FIELDS.PROVIDER);
  assert.equal(detectContractQueryField('Was stand bei den Mehrkilometern?'), CONTRACT_QUERY_FIELDS.EXCESS_MILEAGE);
  assert.equal(isCustomerContractQuery(GOLDEN_CONTRACT), false);
}

// --- Intent ---
{
  const interpreted = interpretSellerInput('Wann läuft Brandes aus?');
  assert.ok(interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_CONTRACTS));
  assert.ok(!interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT));
}

// --- Direct search helper ---
{
  const lead = brandesWithContract();
  const result = searchCustomerContracts({
    lead,
    sellerInput: 'Wann läuft Brandes aus?',
  });
  assert.equal(result.ok, true);
  assert.equal(result.contractMemoryResult.answerValue, '30.11.2026');
  assert.match(result.contractMemoryResult.body, /30\.11\.2026/);
}

// --- Golden: End date via composer ---
{
  const lead = brandesWithContract();
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: 'Wann läuft Brandes aus?',
    customerName: 'Brandes',
  });
  assert.ok(turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_CONTRACTS && a.status === 'prepared'
  )));
  assert.equal(turn.contractMemoryResult?.answerValue, '30.11.2026');
  assert.ok(shouldShowUniversalReview(turn));
  const review = buildUniversalReviewModel(turn);
  assert.equal(review.reviewType, 'contract_memory_result');
  assert.match(String(review.actionSections.find((s) => s.kind === 'contract_memory_result')?.body || ''), /30\.11\.2026/);
  assert.ok(review.actionSections.some((s) => (
    s.kind === 'contract_memory_result'
    && s.primaryActions?.some((a) => a.action === 'open_contract')
  )));
  // Keine Customer-Truth-Mutation
  assert.equal(turn.proposedUpdates?.length || 0, 0);
}

// --- Rate ---
{
  const lead = brandesWithContract();
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: 'Was zahlt er momentan?',
  });
  assert.match(String(turn.contractMemoryResult?.answerValue || ''), /329/);
}

// --- Mileage ---
{
  const lead = brandesWithContract();
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: 'Wie viele Kilometer hat Brandes im Vertrag?',
  });
  assert.match(String(turn.contractMemoryResult?.answerValue || ''), /15\.000|15000/);
}

// --- Excess km ---
{
  const lead = brandesWithContract();
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: 'Was stand bei den Mehrkilometern?',
  });
  assert.match(String(turn.contractMemoryResult?.answerValue || ''), /8\s*ct/i);
}

// --- No contract ---
{
  const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });
  const turn = runCleverSellerTurn({
    lead: brandes,
    sellerInput: 'Wann läuft Brandes aus?',
  });
  assert.ok(turn.preparedActions.some((a) => a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_CONTRACTS));
  assert.equal(turn.preparedActions.find((a) => a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_CONTRACTS)?.status, 'blocked');
  assert.match(String(turn.preparedActions.find((a) => a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_CONTRACTS)?.payload?.message || ''), /Kein bestätigter/i);
}

// --- Global dashboard search ---
{
  const lead = brandesWithContract();
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: 'Wann läuft Brandes aus?',
    leadsSnapshot: [lead],
    scopeHint: 'dashboard',
  });
  assert.ok(turn.contractMemoryResult?.answerValue === '30.11.2026'
    || turn.preparedActions.some((a) => a.payload?.contractMemoryResult?.answerValue === '30.11.2026'));
}

// --- Missing provider field ---
{
  const lead = brandesWithContract();
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: 'Welche Leasinggesellschaft hat den Vertrag?',
  });
  const action = turn.preparedActions.find((a) => a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_CONTRACTS);
  assert.equal(action?.payload?.status, 'field_missing');
}

console.log('globalComposer.slice7.test.js: ok');
