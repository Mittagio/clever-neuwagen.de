/**
 * Real-UI Golden: Partial Success Presenter (Global Composer Übergang).
 * Keine neue Interpret-Architektur – nur Review/Confidence → Feedback/UI.
 */
import assert from 'node:assert/strict';
import { resolveSellerResponsePolicy } from '../cleverAgent/cleverAssistantResponse.js';
import { buildSellerWorkBriefing } from './buildSellerWorkBriefing.js';
import { buildCaptureNextStepHint } from './captureThenOffer.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import {
  hasUsablePartialSuccess,
  presentCompactConfirmation,
  sanitizeIntakeDisplayChips,
  shouldShowGlobalInterpretWarning,
} from './presentSellerIntakeFeedback.js';
import { buildZeroLossIntakeSummary } from './zeroLossIntake.js';

const FALLBACK_BANNER = 'Clever konnte den gesamten Fall nicht vollständig mit dem Sprachmodell interpretieren';

/** Realer UI-Fall (Thorsten Bild / Need Consultation, ohne km). */
function buildRealUiPartialTurn() {
  const facts = [
    {
      field: 'customerName',
      label: 'Thorsten Bild',
      value: 'Thorsten Bild',
      confidence: 0.95,
      needsConfirmation: false,
    },
    {
      field: 'vehicleInterest',
      label: 'Kia lvi',
      value: { make: 'Kia', model: 'lvi', modelKey: null },
      confidence: 0.55,
      needsConfirmation: true,
    },
    {
      field: 'fuelPreference',
      label: 'Elektro',
      value: 'electric',
      confidence: 0.9,
      needsConfirmation: false,
    },
    {
      field: 'paymentType',
      label: 'Leasing',
      value: 'leasing',
      confidence: 0.92,
      needsConfirmation: false,
    },
    {
      field: 'termMonths',
      label: '48 Monate',
      value: 48,
      confidence: 0.92,
      needsConfirmation: false,
    },
    {
      field: 'downPayment',
      label: '2.000 € AZ',
      value: 2000,
      confidence: 0.9,
      needsConfirmation: false,
    },
    // Verboten als Display: Missing als 0
    {
      field: 'annualMileage',
      label: '0 km',
      value: 0,
      confidence: 0.4,
      needsConfirmation: true,
    },
    {
      field: 'unresolvedNote',
      label: 'Familie mit Kindern',
      value: 'Familie mit Kindern',
      preserveAsNote: true,
    },
    {
      field: 'unresolvedNote',
      label: 'Lieferung flexibel',
      value: 'Lieferung flexibel',
      preserveAsNote: true,
    },
  ];

  const captureNextStep = buildCaptureNextStepHint({
    needsConsultation: true,
    fuelPreference: 'electric',
    hasVehicleModel: false,
  });

  const zeroLossIntake = {
    summary: buildZeroLossIntakeSummary(facts, { customerName: 'Thorsten Bild' }),
  };

  return {
    ok: true,
    extractedFacts: facts,
    rememberDecision: {
      mode: 'save_with_undo',
      safeFacts: facts.filter((f) => !f.needsConfirmation && f.field !== 'unresolvedNote'),
      reviewFacts: facts.filter((f) => f.needsConfirmation),
    },
    captureNextStep,
    zeroLossIntake,
    interpreterDiagnostics: {
      interpreterSource: 'fallback',
      error: 'openai_http_400',
      used: false,
    },
    openaiEscalation: {
      used: false,
      interpreterSource: 'fallback',
      error: 'openai_http_400',
    },
    warnings: [
      `${FALLBACK_BANNER}. Bitte prüfen Sie die erkannten Angaben.`,
    ],
    preparedActions: [],
  };
}

// --- 1) Partial Success: kein globales Warning ---
{
  const turn = buildRealUiPartialTurn();
  assert.equal(hasUsablePartialSuccess(turn), true);
  assert.equal(shouldShowGlobalInterpretWarning(turn), false);

  const presented = presentCompactConfirmation(turn);
  assert.equal(presented.showGlobalWarning, false);
  assert.ok(!/gesamten Fall nicht vollständig/i.test(presented.message));

  const policy = resolveSellerResponsePolicy(turn);
  assert.equal(policy.kind, 'compact_confirmation');
  assert.equal(policy.showGlobalWarning, false);
  assert.ok(!/gesamten Fall nicht vollständig/i.test(policy.message));
  assert.ok(!/Notizen\s*·\s*2/i.test(policy.message));
  assert.ok(!policy.chips.some((c) => /^0\s*km/i.test(c) || /Notizen\s*·/i.test(c)));
}

// --- 2) Sichere Facts sichtbar, unsicherer Slot lokal markiert ---
{
  const turn = buildRealUiPartialTurn();
  const presented = presentCompactConfirmation(turn);
  assert.ok(presented.chips.some((c) => /Thorsten Bild/i.test(c)));
  assert.ok(presented.chips.some((c) => /Leasing/i.test(c)));
  assert.ok(presented.chips.some((c) => /48\s*Monate/i.test(c)));
  assert.ok(presented.chips.some((c) => /2\.000/i.test(c)));
  assert.ok(presented.chips.some((c) => /Kia lvi/i.test(c) && /prüfen/i.test(c)));
  assert.ok(!presented.chips.some((c) => /^0\s*km/i.test(c)));
  assert.match(presented.message, /Bedarf aufgenommen/i);
  assert.match(presented.message, /Passende Fahrzeuge finden/i);
  assert.equal(presented.nextStepLabel, 'Passende Fahrzeuge finden');
}

// --- 3) Input ohne Kilometer → kein 0 km (Interpret + Presenter) ---
{
  const noKm = interpretSellerInput(
    'Thorsten Bild, Elektro leasen, 48 Monate, 2000 Euro Anzahlung, Familie',
  );
  assert.ok(!noKm.facts.some((f) => (
    f.field === 'annualMileage' && (Number(f.value) === 0 || /^0\s*km/i.test(String(f.label || '')))
  )), 'Interpret setzt keine 0 km');
  assert.equal(
    noKm.facts.find((f) => f.field === 'annualMileage')?.value ?? null,
    null,
  );

  const chips = sanitizeIntakeDisplayChips([
    ...noKm.facts,
    { field: 'annualMileage', label: '0 km', value: 0 },
  ]);
  assert.ok(!chips.some((c) => /^0\s*km/i.test(c)));

  const briefing = buildSellerWorkBriefing({
    facts: noKm.facts,
    nextStepHint: buildCaptureNextStepHint({
      needsConsultation: true,
      fuelPreference: 'electric',
      hasVehicleModel: false,
    }),
  });
  assert.ok(!/0\s*km/i.test(briefing.text || ''));
  assert.ok(!/0\s*km/i.test(String(briefing.sections?.leasingWish || '')));
  assert.match(String(briefing.sections?.nextStep || ''), /Passende Fahrzeuge finden/i);
}

// --- 4) Echtes Total-Failure: Warning erlaubt ---
{
  const emptyTurn = {
    extractedFacts: [],
    rememberDecision: null,
    interpreterDiagnostics: { interpreterSource: 'fallback', error: 'timeout' },
    openaiEscalation: { interpreterSource: 'fallback', error: 'timeout' },
    warnings: [`${FALLBACK_BANNER}.`],
  };
  assert.equal(hasUsablePartialSuccess(emptyTurn), false);
  assert.equal(shouldShowGlobalInterpretWarning(emptyTurn), true);
}

// --- 5) Zero-Loss Summary ohne Notizen-Counter im Primärchip ---
{
  const summary = buildZeroLossIntakeSummary([
    { field: 'paymentType', label: 'Leasing', value: 'leasing' },
    { field: 'annualMileage', label: '0 km', value: 0 },
    { field: 'unresolvedNote', label: 'Hinweis A', preserveAsNote: true },
    { field: 'unresolvedNote', label: 'Hinweis B', preserveAsNote: true },
  ]);
  assert.ok(!summary.chips.includes('0 km'));
  assert.ok(!/Notizen\s*·\s*2/i.test(summary.feedbackLine));
  assert.equal(summary.noteCount, 2);
  assert.equal(summary.notes.length, 2);
}

// --- 6) Kein Offer-CTA bei Need Consultation ---
{
  const turn = buildRealUiPartialTurn();
  assert.equal(turn.captureNextStep?.id, 'capture_then_consult');
  assert.equal(turn.captureNextStep?.cta, 'Beratung');
  assert.ok(!(turn.preparedActions || []).some((a) => a.type === 'prepare_offer'));
  const policy = resolveSellerResponsePolicy(turn);
  assert.ok(!/Angebot vorbereiten/i.test(policy.message));
  assert.ok(!/Rate/i.test(policy.chips.join(' ')));
}

console.log('presentSellerIntakeFeedback.ui.golden.test.js: ok');
