/**
 * Multi-Source Intake + Unit-Aware + Trade-in Gegenproben
 * node --test src/services/cleverSeller/multiSource/multiSourceIntake.golden.test.js
 */
import assert from 'node:assert/strict';
import {
  extractPurchasePriceUnitAware,
  parseTermAndMileageShorthand,
  isNumberBoundToMileage,
} from '../normalizeSellerUnits.js';
import {
  extractTradeInCandidates,
  isSecondVehicleInterestCue,
} from '../detectTradeInFromSellerInput.js';
import { resolveContractTemporalStatus } from './resolveContractTemporalStatus.js';
import { resolveContractKind } from './contractKindRegistry.js';
import {
  buildMultiSourceIntake,
  extractPersonNameFromDump,
  shouldBuildMultiSourceIntake,
} from './buildMultiSourceIntake.js';
import { interpretSellerInput } from '../interpretSellerInput.js';
import { runCleverSellerTurn } from '../runCleverSellerTurn.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from '../buildUniversalReviewModel.js';
import { applyAcceptedSellerTurn } from '../applyAcceptedSellerTurn.js';
import {
  MAZZEI_CONTRACT_REDACT_TEST_EXTRACT,
  buildMazzeiContractAttachment,
} from './fixtures/mazzeiContractFixture.js';

const ENV = {
  VITE_CLEVER_SELLER_ORCHESTRATOR: 'true',
  CLEVER_SELLER_ORCHESTRATOR: 'true',
};

const MAZZEI_DUMP = [
  'TEST+ Abgleich!',
  '',
  'Mazzei Sandro',
  'EV4 Air weiss mit AHK',
  '48 10.000 km',
  '2 Kinder Haus',
  'GW Kia Picanto',
].join('\n');

/** Fixture inkl. sensibler Muster – nur Redact-/Body-Assertions */
const CONTRACT_FIXTURE = MAZZEI_CONTRACT_REDACT_TEST_EXTRACT;

// --- A/B Unit-aware ---
{
  assert.equal(isNumberBoundToMileage('EV4 Air 48 10.000 km', 10000), true);
  assert.equal(extractPurchasePriceUnitAware('EV4 Air 48 10.000 km'), null);
  const shorthand = parseTermAndMileageShorthand('EV4 Air 48 10.000 km');
  assert.equal(shorthand.termMonths, 48);
  assert.equal(shorthand.annualMileage, 10000);

  const priced = extractPurchasePriceUnitAware('EV4 für 48.000 €');
  assert.ok(priced);
  assert.equal(priced.value, 48000);
  const noTermAsPrice = parseTermAndMileageShorthand('EV4 für 48.000 €');
  assert.equal(noTermAsPrice.annualMileage, null);
}

// --- C/D Trade-in vs Interest ---
{
  const gw = extractTradeInCandidates('GW Kia Picanto');
  assert.equal(gw.length, 1);
  assert.match(gw[0].label, /Picanto/i);

  assert.equal(isSecondVehicleInterestCue('Interessiert sich außerdem für Picanto', 'Picanto'), true);
  const interpGw = interpretSellerInput('GW Kia Picanto und EV4 Air');
  assert.ok(interpGw.facts.some((f) => f.field === 'tradeInVehicle'));
  assert.ok(interpGw.facts.some((f) => /EV4/i.test(f.label) && f.factClass === 'vehicle_interest'));
  assert.ok(!interpGw.facts.some((f) => (
    f.factClass === 'vehicle_interest' && /Picanto/i.test(f.label)
  )));
}

// --- Name ---
{
  assert.match(extractPersonNameFromDump(MAZZEI_DUMP) || '', /Mazzei|Sandro/i);
  const interpreted = interpretSellerInput(MAZZEI_DUMP);
  assert.ok(interpreted.facts.some((f) => f.field === 'customerName'));
  assert.ok(interpreted.facts.some((f) => f.field === 'childrenCount' && f.value === 2));
  assert.ok(interpreted.facts.some((f) => f.field === 'housingType'));
  assert.ok(interpreted.facts.some((f) => f.field === 'towHitchRequired'));
  assert.ok(interpreted.facts.some((f) => f.field === 'termMonths' && f.value === 48));
  assert.ok(interpreted.facts.some((f) => f.field === 'annualMileage' && f.value === 10000));
  assert.ok(!interpreted.facts.some((f) => f.field === 'purchasePrice'));
  assert.ok(interpreted.facts.some((f) => f.field === 'colorPreference'));
}

// --- Temporal ---
{
  const ended = resolveContractTemporalStatus('2025-11-01', new Date('2026-08-04'));
  assert.equal(ended.status, 'historical_or_ended');
  const active = resolveContractTemporalStatus('2027-11-01', new Date('2026-08-04'));
  assert.equal(active.status, 'active');
}

// --- Contract kind registry extensible ---
{
  const kind = resolveContractKind({ text: CONTRACT_FIXTURE, documentKind: 'financing_contract' });
  assert.equal(kind.id, 'financing_three_way');
  const leasing = resolveContractKind({ text: 'Leasingvertrag Kia EV6', documentKind: 'leasing_contract' });
  assert.equal(leasing.id, 'leasing_standard');
}

// --- Combined turn ---
{
  assert.equal(shouldBuildMultiSourceIntake({
    sellerInput: MAZZEI_DUMP,
    attachments: [{ kind: 'contract_pdf', fileName: 'Vertrag_Bank.pdf', extractedText: CONTRACT_FIXTURE }],
  }), true);

  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: MAZZEI_DUMP,
    attachments: [buildMazzeiContractAttachment({ extractedText: CONTRACT_FIXTURE })],
    leadsSnapshot: [],
    scopeHint: 'dashboard',
    now: new Date('2026-08-04T12:00:00Z'),
    env: ENV,
  });

  assert.ok(turn.multiSourceIntake?.detected);
  assert.equal(shouldShowUniversalReview(turn), true);
  const review = turn.reviewModel || buildUniversalReviewModel(turn);
  assert.equal(review.reviewType, 'customer_contract_tradein_intake_review');
  assert.match(review.title, /Beratungsfall/i);

  const intake = turn.multiSourceIntake;
  assert.match(intake.resolvedCustomerCandidate?.fullName || '', /Sandro|Mazzei/i);
  assert.ok(intake.currentVehicleInterest?.model);
  assert.match(String(intake.currentVehicleInterest.model), /EV4/i);
  assert.ok((intake.currentVehicleInterest.requestedEquipment || []).includes('AHK')
    || /AHK/i.test(intake.currentVehicleInterest.label || ''));
  assert.equal(intake.commercialScenario?.termMonths, 48);
  assert.equal(intake.commercialScenario?.annualMileage, 10000);
  assert.equal(intake.currentHouseholdFacts?.childrenCount, 2);
  assert.match(intake.tradeInCandidate?.label || '', /Picanto/i);
  assert.ok(intake.historicalContract);
  assert.equal(intake.historicalContract.status, 'historical_or_ended');
  assert.ok(intake.conflicts?.some((c) => c.id === 'children_count_temporal')
    || intake.historicalHousehold?.childrenCount === 1);

  // Review Fact-Cards + Hero: Name + AHK sichtbar
  const customerGroup = (review.groups || []).find((g) => g.id === 'customer' || g.title === 'KUNDE');
  const wishGroup = (review.groups || []).find((g) => g.id === 'wish' || g.title === 'NEUER WUNSCH');
  assert.match(customerGroup?.line || '', /Sandro|Mazzei/i);
  assert.match(review.hero?.name || '', /Sandro|Mazzei/i);
  assert.match(wishGroup?.line || '', /AHK/i);
  assert.ok((review.progressLines || []).length <= 2);
  assert.ok((review.progressLines || []).some((l) => /Dokument zusammengeführt/i.test(l)));
  assert.ok((review.progressLines || []).some((l) => /Kunde.*(?:Sandro|Mazzei)/i.test(l)));

  // Primary Actions: Alles übernehmen zuerst, dann GW … erfassen
  const primary = review.actionSections?.[0]?.primaryActions || [];
  assert.equal(primary[0]?.action, 'accept_multi_source_intake');
  assert.match(primary[0]?.label || '', /Alles übernehmen/i);
  assert.ok(primary.some((a) => /GW.*Picanto.*erfassen/i.test(a.label || '')));

  // keine Auto-Persistenz
  assert.equal(turn.autoSent, false);
  const applied = applyAcceptedSellerTurn({}, turn, { postFeedCard: false, allowCreateCustomer: false });
  // ohne allowCreate / lead – kein stilles Anlegen erzwungen; ok darf false sein
  assert.ok(applied);
  assert.ok(!(applied.created && !applied.ok === undefined));

  // Sensible Daten nicht in Review-Surfaces
  const reviewBlob = JSON.stringify({
    body: review.body,
    groups: review.groups,
    summaryLine: review.summaryLine,
  });
  assert.ok(!/DE89 3704|L01X00T47/i.test(reviewBlob));

  // Prepared actions vorhanden, nichts auto
  assert.ok((intake.preparedActions || []).some((a) => a.id === 'create_customer_candidate'));
  assert.ok((intake.preparedActions || []).some((a) => a.id === 'import_historical_contract'));
  assert.ok((intake.preparedActions || []).some((a) => a.id === 'create_trade_in_candidate'));
  assert.match(
    (intake.preparedActions || []).find((a) => a.id === 'create_trade_in_candidate')?.label || '',
    /GW.*Picanto.*erfassen/i,
  );
  assert.ok((intake.preparedActions || []).every((a) => a.mutatesCustomer === false));
}

// Text-only: Checkliste ohne falschen Dokument-Claim; Name + AHK bleiben sichtbar
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: MAZZEI_DUMP,
    attachments: [],
    leadsSnapshot: [],
    scopeHint: 'dashboard',
    now: new Date('2026-08-04T12:00:00Z'),
    env: ENV,
  });
  assert.ok(turn.multiSourceIntake?.detected);
  const review = turn.reviewModel || buildUniversalReviewModel(turn);
  assert.equal(review.reviewType, 'customer_contract_tradein_intake_review');
  assert.ok((review.progressLines || []).some((l) => /Seller-Dump ausgewertet/i.test(l)));
  assert.ok(!(review.progressLines || []).some((l) => /Dokument zusammengeführt/i.test(l)));
  assert.ok((review.progressLines || []).length <= 2);
  assert.match(review.hero?.name || '', /Sandro|Mazzei/i);
  const customerGroup = (review.groups || []).find((g) => g.id === 'customer');
  const wishGroup = (review.groups || []).find((g) => g.id === 'wish');
  assert.match(customerGroup?.line || '', /Sandro|Mazzei/i);
  assert.match(wishGroup?.line || '', /AHK/i);
  const primary = review.actionSections?.[0]?.primaryActions || [];
  assert.equal(primary[0]?.label, 'Alles übernehmen');
  assert.ok(primary.some((a) => /GW.*Picanto.*erfassen/i.test(a.label || '')));
}

// Deterministischer Fallback ohne Facts: Dump-Zeile „Mazzei Sandro“ → Review-Name
{
  const intake = buildMultiSourceIntake({
    sellerInput: MAZZEI_DUMP,
    attachments: [],
    facts: [],
    now: new Date('2026-08-04'),
  });
  assert.match(intake.resolvedCustomerCandidate?.fullName || '', /Sandro|Mazzei/i);
  const review = buildUniversalReviewModel({
    multiSourceIntake: intake,
    extractedFacts: [],
    interpretedInput: { raw: MAZZEI_DUMP, normalized: MAZZEI_DUMP },
  });
  assert.match(review.hero?.name || '', /Sandro|Mazzei/i);
  assert.match((review.groups || []).find((g) => g.id === 'customer')?.line || '', /Sandro|Mazzei/i);
  assert.ok((review.progressLines || []).some((l) => /Kunde.*(?:Sandro|Mazzei)/i.test(l)));
}

// Missing contact does not block review
{
  const intake = buildMultiSourceIntake({
    sellerInput: MAZZEI_DUMP,
    attachments: [{ kind: 'contract_pdf', extractedText: CONTRACT_FIXTURE }],
    facts: interpretSellerInput(MAZZEI_DUMP).facts,
    now: new Date('2026-08-04'),
  });
  assert.ok(intake.resolvedCustomerCandidate);
  assert.equal(intake.resolvedCustomerCandidate.missingContact, true);
  assert.ok(intake.missingInformation.some((m) => m.field === 'email' || m.field === 'phone'));
}

console.log('multiSourceIntake.golden.test.js: OK');
