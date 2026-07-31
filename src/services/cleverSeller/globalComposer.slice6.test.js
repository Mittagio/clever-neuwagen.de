/**
 * Slice 6: Contract Intake – Paste → Draft → Review → Confirm
 * node --test src/services/cleverSeller/globalComposer.slice6.test.js
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
  extractCustomerContractFromText,
  isCustomerContractIntakeText,
} from './extractCustomerContractFromText.js';
import {
  listCustomerContracts,
  findDuplicateCustomerContract,
} from '../crm/customerContracts.js';
import { createBrandesGoldenCaseLead } from '../crm/brandesGoldenCase.js';

const GOLDEN = `Leasingvertrag
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

// --- Detection ---
{
  assert.equal(isCustomerContractIntakeText(GOLDEN), true);
  assert.equal(isCustomerContractIntakeText('Leasing läuft im November aus.'), false);
}

// --- Deterministic extraction ---
{
  const extracted = extractCustomerContractFromText(GOLDEN);
  assert.equal(extracted.ok, true);
  assert.equal(extracted.documentClassification, 'leasing_contract');
  assert.equal(extracted.contractDraft.contractType, 'leasing');
  assert.equal(extracted.contractDraft.vehicle.make, 'Ford');
  assert.equal(extracted.contractDraft.vehicle.model, 'Kuga');
  assert.equal(extracted.contractDraft.contractStartDate, '2022-12-01');
  assert.equal(extracted.contractDraft.contractEndDate, '2026-11-30');
  assert.equal(extracted.contractDraft.termMonths, 48);
  assert.equal(extracted.contractDraft.annualMileage, 15000);
  assert.equal(extracted.contractDraft.monthlyRate, 329);
  assert.equal(extracted.contractDraft.downPayment, 0);
  assert.equal(extracted.contractDraft.excessMileageRate, 0.08);
  assert.equal(extracted.contractDraft.underMileageRate, 0.03);
  assert.ok(extracted.evidence.some((e) => e.field === 'monthlyRate' && e.evidenceText));
  assert.ok(extracted.missingInformation.some((m) => m.id === 'contractNumber'));
  assert.ok(extracted.missingInformation.some((m) => m.id === 'bankOrLeasingCompany'));
}

// --- Intent ---
{
  const interpreted = interpretSellerInput(GOLDEN);
  assert.ok(interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT));
  assert.ok(!interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT));
}

// --- Golden turn + review ---
{
  const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });
  const beforeWish = brandes.wish?.desiredRate ?? brandes.desiredRate ?? null;
  const turn = runCleverSellerTurn({
    lead: brandes,
    sellerInput: GOLDEN,
    customerName: 'Brandes',
  });
  assert.ok(turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT && a.status === 'prepared'
  )));
  assert.equal(turn.documentClassification, 'leasing_contract');
  assert.ok(turn.contractDraft);
  assert.equal(turn.contractDraft.monthlyRate, 329);
  assert.equal(turn.contractDraft.mutatesCustomerTruth, false);
  assert.ok(shouldShowUniversalReview(turn));
  const review = buildUniversalReviewModel(turn);
  assert.equal(review.reviewType, 'contract_import_review');
  assert.match(review.title, /Vertrag erkannt/i);
  assert.ok(review.actionSections.some((s) => s.kind === 'contract_import_review'));
  assert.match(String(review.actionSections.find((s) => s.kind === 'contract_import_review')?.body || ''), /Ford Kuga/);
  assert.match(String(review.actionSections.find((s) => s.kind === 'contract_import_review')?.body || ''), /329/);
  // No auto-persist
  assert.equal(listCustomerContracts(brandes).length, 0);
  assert.equal(brandes.wish?.desiredRate ?? brandes.desiredRate ?? null, beforeWish);
}

// --- Confirm persist + projection, no truth rate ---
{
  const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });
  const turn = runCleverSellerTurn({
    lead: brandes,
    sellerInput: GOLDEN,
    customerName: 'Brandes',
  });
  const applied = applyAcceptedSellerTurn(brandes, turn, { postFeedCard: false });
  assert.ok(applied.ok);
  assert.ok(applied.acceptedLabels.some((l) => /Altvertrag/i.test(l)));
  const contracts = listCustomerContracts(applied.lead);
  assert.equal(contracts.length, 1);
  assert.equal(contracts[0].status, 'confirmed');
  assert.equal(contracts[0].dates.contractEndDate, '2026-11-30');
  assert.equal(contracts[0].commercialTerms.monthlyRate, 329);
  assert.equal(applied.lead.wish?.leasingEndDate, '2026-11-30');
  // Vertragrate ≠ Wunschrate
  assert.ok(applied.lead.wish?.desiredRate == null || applied.lead.wish?.desiredRate !== 329);
  assert.ok(applied.lead.crm?.activities?.some((a) => a.type === 'contract_imported'));
}

// --- Duplicate guard ---
{
  const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });
  const turn = runCleverSellerTurn({ lead: brandes, sellerInput: GOLDEN });
  const first = applyAcceptedSellerTurn(brandes, turn, { postFeedCard: false });
  const second = applyAcceptedSellerTurn(first.lead, turn, { postFeedCard: false });
  assert.equal(listCustomerContracts(second.lead).length, 1);
  assert.equal(second.duplicateContract, true);
  assert.ok(findDuplicateCustomerContract(second.lead, turn.contractDraft));
}

// --- No invented values ---
{
  const short = `Leasingvertrag
Kunde Herr Brandes
Vertragsende 30.11.2026`;
  const extracted = extractCustomerContractFromText(short);
  assert.equal(extracted.contractDraft.monthlyRate, null);
  assert.equal(extracted.contractDraft.annualMileage, null);
  assert.equal(extracted.contractDraft.vehicle, null);
}

// --- Global: Brandes aus Text + Snapshot ---
{
  const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: GOLDEN,
    leadsSnapshot: [brandes],
    scopeHint: 'dashboard',
  });
  assert.ok(turn.preparedActions.some((a) => a.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT));
  assert.ok(turn.resolvedCustomer?.id === brandes.id || turn.contractDraft?.customerNameHint);
}

console.log('globalComposer.slice6.test.js: ok');
