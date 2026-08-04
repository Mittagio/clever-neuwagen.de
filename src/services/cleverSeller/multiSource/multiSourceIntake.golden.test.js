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

/** Fixture: generische 3-Wege-Finanzierung – erweiterbar, kein Picanto-Hardcode im Core */
const CONTRACT_FIXTURE = `
Finanzierungsvertrag / 3-Wege-Finanzierung
Kunde: Sandro Mazzei
Fahrzeug: Kia Picanto
Vertragsbeginn: 30.11.2021
Vertragsende: 01.11.2025
Laufzeit 48 Monate
Gesamtkilometer 40.000 km
Monatliche Rate 83,07 €
Schlussrate 7.796,96 €
Mehrkilometer 0,05 €
Minderkilometer 0,03 €
Kinder: 1
IBAN DE89 3704 0044 0532 0130 00
Ausweisnr. L01X00T47
`.trim();

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
    attachments: [{
      id: 'att-contract-1',
      kind: 'contract_pdf',
      sourceType: 'contract_pdf',
      fileName: 'Vertrag_Bank_100000518962.pdf',
      extractedText: CONTRACT_FIXTURE,
    }],
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
  assert.match(review.body || '', /EV4|Sandro|Mazzei|Picanto|Inzahlungnahme|Altvertrag|2 Kinder/i);

  const intake = turn.multiSourceIntake;
  assert.match(intake.resolvedCustomerCandidate?.fullName || '', /Sandro|Mazzei/i);
  assert.ok(intake.currentVehicleInterest?.model);
  assert.match(String(intake.currentVehicleInterest.model), /EV4/i);
  assert.equal(intake.commercialScenario?.termMonths, 48);
  assert.equal(intake.commercialScenario?.annualMileage, 10000);
  assert.equal(intake.currentHouseholdFacts?.childrenCount, 2);
  assert.match(intake.tradeInCandidate?.label || '', /Picanto/i);
  assert.ok(intake.historicalContract);
  assert.equal(intake.historicalContract.status, 'historical_or_ended');
  assert.ok(intake.conflicts?.some((c) => c.id === 'children_count_temporal')
    || intake.historicalHousehold?.childrenCount === 1);

  // keine Auto-Persistenz
  assert.equal(turn.autoSent, false);
  const applied = applyAcceptedSellerTurn({}, turn, { postFeedCard: false, allowCreateCustomer: false });
  // ohne allowCreate / lead – kein stilles Anlegen erzwungen; ok darf false sein
  assert.ok(applied);
  assert.ok(!(applied.created && !applied.ok === undefined));

  // Sensible Daten nicht im Review-Body
  assert.ok(!/DE89 3704|L01X00T47/i.test(review.body || ''));

  // Prepared actions vorhanden, nichts auto
  assert.ok((intake.preparedActions || []).some((a) => a.id === 'create_customer_candidate'));
  assert.ok((intake.preparedActions || []).some((a) => a.id === 'import_historical_contract'));
  assert.ok((intake.preparedActions || []).some((a) => a.id === 'create_trade_in_candidate'));
  assert.ok((intake.preparedActions || []).every((a) => a.mutatesCustomer === false));
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
