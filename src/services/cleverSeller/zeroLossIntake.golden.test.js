/**
 * Golden: Zero-Loss Intake – Budde-Satz + Fahrwerk-Notiz.
 */
import assert from 'node:assert/strict';
import { interpretSellerInput } from './interpretSellerInput.js';
import { evaluateRememberDecision } from './composerIntentChips.js';
import {
  ensureZeroLossCoverage,
  resolveSellerModelAlias,
} from './zeroLossIntake.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';

const BUDDE = [
  'Herr Budde hat zwei Kinder, einen Hund,',
  'fährt einen Smart fortwo,',
  'Wunschrate 250 Euro,',
  'Anzahlung 3.000 Euro,',
  'am liebsten EQ2 in Rot,',
  'sofort verfügbar wäre wichtig.',
].join(' ');

const FAHRWERK = 'Er will nicht wieder so ein komisches Fahrwerk wie sein alter.';

{
  const alias = resolveSellerModelAlias('EQ2');
  assert.equal(alias.canonical, 'ev2');
  assert.equal(alias.rawExpression, 'EQ2');
  assert.equal(alias.ambiguous, false);
}

{
  // PV5 ≠ EV5 – explizite Seller-Mention bleibt eigene Identität
  const pv5Alias = resolveSellerModelAlias('PV5');
  assert.equal(pv5Alias.canonical, null, 'PV5 hat keinen EV5-Alias');
  const interpreted = interpretSellerInput('PV5 EV2 EV3 interessieren ihn');
  const multi = interpreted.facts.find((f) => f.field === 'vehicleInterestMulti');
  assert.ok(multi, 'Multi-Interest');
  const keys = (Array.isArray(multi.value) ? multi.value : [])
    .map((e) => String(e?.modelKey || e || '').toLowerCase())
    .sort();
  assert.deepEqual(keys, ['ev2', 'ev3', 'pv5']);
  assert.ok(!keys.includes('ev5'), 'kein stilles EV5');
}

{
  // Kanonische Modelle ohne Tippfehler-Alias sind nicht unsicher
  const ev4 = resolveSellerModelAlias('EV4');
  assert.equal(ev4.canonical, null);
  assert.equal(ev4.ambiguous, false);
  const interpreted = interpretSellerInput('EV4');
  const interest = interpreted.facts.find((f) => f.field === 'vehicleInterest');
  assert.ok(interest, 'EV4 → vehicleInterest');
  assert.equal(interest.needsConfirmation, false, 'EV4 braucht keine Confirm nur wegen Alias-Lücke');
  assert.match(String(interest.label || ''), /EV4/i);
}

{
  const interpreted = interpretSellerInput(BUDDE, {
    customerName: 'Patrick Budde',
    lead: { id: 'lead-budde', contact: { name: 'Patrick Budde' } },
  });
  const fields = new Set(interpreted.facts.map((f) => f.field));
  assert.ok(fields.has('childrenCount'), '2 Kinder');
  assert.ok(fields.has('pet'), 'Hund');
  assert.ok(
    fields.has('existingVehicle') || fields.has('tradeInVehicle'),
    'Smart fortwo Bestand',
  );
  assert.ok(fields.has('monthlyBudget'), 'Wunschrate');
  assert.ok(fields.has('downPayment'), 'Anzahlung');
  assert.ok(fields.has('vehicleInterest'), 'EQ2→EV2');
  assert.ok(fields.has('colorPreference'), 'Rot');
  assert.ok(fields.has('availabilityPreference'), 'sofort');

  const interest = interpreted.facts.find((f) => f.field === 'vehicleInterest');
  assert.equal(String(interest.value?.modelKey || '').toLowerCase(), 'ev2');
  assert.match(String(interest.rawExpression || ''), /eq2/i);

  const pet = interpreted.facts.find((f) => f.field === 'pet');
  assert.match(pet.label, /Hund/i);

  const existing = interpreted.facts.find((f) => (
    f.field === 'existingVehicle' || f.field === 'tradeInVehicle'
  ));
  assert.match(String(existing.label), /Smart|fortwo/i);

  assert.ok(interpreted.zeroLossIntake?.summary?.chips?.length >= 5);
  assert.match(interpreted.zeroLossIntake.summary.title, /Budde|aufgenommen/i);

  const decision = evaluateRememberDecision(interpreted.facts, { id: 'lead-budde' });
  assert.ok(
    decision.mode === 'save_with_undo' || decision.mode === 'partial_save_with_undo',
    `expected auto-save, got ${decision.mode} (${decision.reason})`,
  );
  assert.ok(decision.safeFacts.length >= 5, 'Partial Success: viele sichere Facts');
}

{
  const interpreted = interpretSellerInput(FAHRWERK);
  const notes = interpreted.facts.filter((f) => f.field === 'unresolvedNote');
  assert.ok(notes.length >= 1, 'Fahrwerk als unresolved_note');
  assert.match(String(notes[0].label || notes[0].value?.text), /Fahrwerk/i);
  assert.equal(notes[0].value?.status, 'unclassified');

  const decision = evaluateRememberDecision(interpreted.facts);
  assert.equal(decision.mode, 'save_with_undo');
  assert.ok(decision.safeFacts.some((f) => f.field === 'unresolvedNote'));
}

{
  // Coverage: gemischte sichere Facts + unklassifizierter Rest
  const covered = ensureZeroLossCoverage({
    sellerInput: '2 Kinder und er will nicht wieder so ein komisches Fahrwerk wie sein alter',
    facts: interpretSellerInput('2 Kinder').facts.filter((f) => f.field === 'childrenCount'),
  });
  assert.ok(covered.facts.some((f) => f.field === 'childrenCount'));
  assert.ok(covered.unresolvedNotes.some((n) => /Fahrwerk/i.test(n.text)));
}

{
  const lead = {
    id: 'lead-budde',
    contact: { name: 'Patrick Budde' },
    crm: { needProfile: { understoodLabels: [] }, sellerInsights: [] },
  };
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: BUDDE,
    customerName: 'Patrick Budde',
  });
  assert.ok(turn.zeroLossIntake, 'Turn trägt zeroLossIntake');
  assert.ok(
    turn.rememberDecision?.mode === 'save_with_undo'
    || turn.rememberDecision?.mode === 'partial_save_with_undo',
    `Turn auto-merken, got ${turn.rememberDecision?.mode}`,
  );
  const labels = turn.extractedFacts.map((f) => f.label).join(' | ');
  assert.match(labels, /Kinder/i);
  assert.match(labels, /Hund/i);
  assert.match(labels, /250/i);
  assert.match(labels, /EV2|EQ2/i);
}

console.log('zeroLossIntake.golden.test.js: ok');
