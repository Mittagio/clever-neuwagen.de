/**
 * Runtime-Smoke: Multi-Source OpenAI Interpret (ohne PII im Terminal).
 * node scripts/smoke-multi-source-openai.mjs
 *
 * Benötigt: CLEVER_SELLER_OPENAI_INTERPRET_ENABLED=true + OPENAI_API_KEY
 * Ohne Key: ehrlich „Smoke übersprungen“.
 */
import { runCleverSellerTurnAsync } from '../src/services/cleverSeller/runCleverSellerTurn.js';

const ENV = process.env;
const enabled = ENV.CLEVER_SELLER_OPENAI_INTERPRET_ENABLED === 'true'
  || ENV.CLEVER_SELLER_OPENAI_INTERPRET_ENABLED === '1';
const hasKey = Boolean(ENV.OPENAI_API_KEY);

if (!enabled || !hasKey) {
  console.log('Smoke übersprungen: CLEVER_SELLER_OPENAI_INTERPRET_ENABLED/OPENAI_API_KEY fehlen.');
  process.exit(0);
}

const sellerInput = [
  'Mazzei Sandro',
  'EV4 Air weiß mit AHK',
  '48 10.000 km',
  '2 Kinder Haus',
  'GW Kia Picanto',
].join('\n');

const contractText = `
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
`.trim();

const turn = await runCleverSellerTurnAsync({
  lead: {},
  sellerInput,
  attachments: [{
    id: 'att-smoke-1',
    kind: 'contract_pdf',
    sourceType: 'contract_pdf',
    fileName: 'Vertrag_Bank_100000518962.pdf',
    extractedText: contractText,
  }],
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
const safe = {
  interpreterSource: diag.interpreterSource ?? null,
  attachmentCount: diag.attachmentCount ?? null,
  attachmentContextMode: diag.attachmentContextMode ?? null,
  schemaValid: diag.schemaValid ?? null,
  fallbackReason: diag.fallbackReason ?? null,
  complexityReasons: diag.complexityReasons ?? [],
  validatorWarningsCount: diag.validatorWarningsCount ?? 0,
  durationMs: diag.durationMs ?? diag.latencyMs ?? null,
  reviewType: turn.reviewModel?.reviewType || turn.multiSourceIntake?.reviewType || null,
  detected: Boolean(turn.multiSourceIntake?.detected),
  hasPurchasePrice: Boolean(turn.multiSourceIntake?.commercialScenario?.purchasePrice),
  tradeInOk: /picanto/i.test(turn.multiSourceIntake?.tradeInCandidate?.label || ''),
  wishOk: /ev4/i.test(turn.multiSourceIntake?.currentVehicleInterest?.label || ''),
};

console.log(JSON.stringify(safe, null, 2));

const pass = safe.interpreterSource === 'openai'
  && safe.attachmentCount === 1
  && ['minimized_text', 'structured_extract'].includes(safe.attachmentContextMode)
  && safe.schemaValid === true
  && !safe.fallbackReason
  && safe.reviewType === 'customer_contract_tradein_intake_review'
  && safe.detected
  && !safe.hasPurchasePrice
  && safe.tradeInOk
  && safe.wishOk;

if (!pass) {
  console.error('Smoke fehlgeschlagen (keine PII geloggt).');
  process.exit(1);
}

console.log('Smoke OK');
