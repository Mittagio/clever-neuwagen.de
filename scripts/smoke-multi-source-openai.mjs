/**
 * Runtime-Smoke: Multi-Source OpenAI Interpret (ohne PII im Terminal).
 * node scripts/smoke-multi-source-openai.mjs
 *
 * Benötigt: CLEVER_SELLER_OPENAI_INTERPRET_ENABLED=true + OPENAI_API_KEY
 * Ohne Key: ehrlich „Smoke übersprungen“.
 *
 * Fixture: buildMazzeiContractAttachment() (extractedText + Dateiname).
 * Optionale Dummy-PDF: tests/fixtures/Vertrag_Bank_100000518962.pdf
 */
import { runCleverSellerTurnAsync } from '../src/services/cleverSeller/runCleverSellerTurn.js';
import {
  MAZZEI_SELLER_DUMP,
  buildMazzeiContractAttachment,
} from '../src/services/cleverSeller/multiSource/fixtures/mazzeiContractFixture.js';

const ENV = process.env;
const enabled = ENV.CLEVER_SELLER_OPENAI_INTERPRET_ENABLED === 'true'
  || ENV.CLEVER_SELLER_OPENAI_INTERPRET_ENABLED === '1';
const hasKey = Boolean(ENV.OPENAI_API_KEY);

if (!enabled || !hasKey) {
  console.log('Smoke übersprungen: CLEVER_SELLER_OPENAI_INTERPRET_ENABLED/OPENAI_API_KEY fehlen.');
  process.exit(0);
}

const turn = await runCleverSellerTurnAsync({
  lead: {},
  sellerInput: MAZZEI_SELLER_DUMP,
  attachments: [buildMazzeiContractAttachment()],
  now: new Date('2026-08-04T12:00:00Z'),
  env: {
    CLEVER_SELLER_ORCHESTRATOR_ENABLED: 'true',
    CLEVER_SELLER_OPENAI_INTERPRET_ENABLED: 'true',
    OPENAI_API_KEY: ENV.OPENAI_API_KEY,
    OPENAI_QUERY_MODEL: ENV.OPENAI_QUERY_MODEL,
    OPENAI_CLEVER_MODEL: ENV.OPENAI_CLEVER_MODEL,
  },
});

const diag = turn.interpreterDiagnostics || {};
const review = turn.reviewModel || {};
const wishLabel = turn.multiSourceIntake?.currentVehicleInterest?.label || '';
const safe = {
  interpreterSource: diag.interpreterSource ?? null,
  attachmentCount: diag.attachmentCount ?? null,
  attachmentContextMode: diag.attachmentContextMode ?? null,
  schemaValid: diag.schemaValid ?? null,
  fallbackReason: diag.fallbackReason ?? null,
  complexityReasons: diag.complexityReasons ?? [],
  validatorWarningsCount: diag.validatorWarningsCount ?? 0,
  durationMs: diag.durationMs ?? diag.latencyMs ?? null,
  responseIdPresent: Boolean(diag.responseId),
  model: diag.model || null,
  reviewType: review.reviewType || turn.multiSourceIntake?.reviewType || null,
  detected: Boolean(turn.multiSourceIntake?.detected),
  hasPurchasePrice: Boolean(turn.multiSourceIntake?.commercialScenario?.purchasePrice),
  tradeInOk: /picanto/i.test(turn.multiSourceIntake?.tradeInCandidate?.label || ''),
  wishOk: /ev4/i.test(wishLabel),
  ahkOk: /ahk/i.test(wishLabel)
    || (turn.multiSourceIntake?.currentVehicleInterest?.requestedEquipment || []).includes('AHK'),
  customerOk: /sandro|mazzei/i.test(turn.multiSourceIntake?.resolvedCustomerCandidate?.fullName || ''),
  householdKids: turn.multiSourceIntake?.currentHouseholdFacts?.childrenCount ?? null,
  childrenConflict: Boolean((turn.multiSourceIntake?.conflicts || [])
    .some((c) => c.field === 'childrenCount')),
  documentChecklist: Boolean((review.progressLines || [])
    .some((l) => /Dokument zusammengeführt/i.test(l))),
};

console.log(JSON.stringify(safe, null, 2));

const pass = safe.interpreterSource === 'openai'
  && safe.attachmentCount === 1
  && ['minimized_text', 'structured_extract'].includes(safe.attachmentContextMode)
  && safe.schemaValid === true
  && !safe.fallbackReason
  && safe.responseIdPresent
  && safe.reviewType === 'customer_contract_tradein_intake_review'
  && safe.detected
  && !safe.hasPurchasePrice
  && safe.tradeInOk
  && safe.wishOk
  && safe.ahkOk
  && safe.customerOk
  && safe.householdKids === 2
  && safe.childrenConflict === true
  && safe.documentChecklist === true;

if (!pass) {
  console.error('Smoke fehlgeschlagen (keine PII geloggt).');
  process.exit(1);
}

console.log('Smoke OK');
