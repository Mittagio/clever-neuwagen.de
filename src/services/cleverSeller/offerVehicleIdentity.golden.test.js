/**
 * Offer Vehicle Identity Freeze – Golden Tests
 * node --test src/services/cleverSeller/offerVehicleIdentity.golden.test.js
 */
import assert from 'node:assert/strict';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import { VEHICLE_TRACK_STATUS } from '../crm/vehicleTrack.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import {
  CLARIFY_VEHICLE_FOR_OFFER_PROMPT,
  OFFER_MUTATION_MODE,
  OFFER_VEHICLE_TARGET_STATUS,
  detectOfferMutationMode,
  parseOfferIdentityFollowUp,
  resolveOfferVehicleTarget,
} from './offerVehicleIdentity.js';
import { COMPOSER_INTENT_CONSTRAINT } from './composerIntentChips.js';

function trackConfig(id, modelKey, status = VEHICLE_TRACK_STATUS.OPEN, trimLabel = '') {
  return {
    id,
    brand: 'Kia',
    model: modelKey.toUpperCase(),
    modelKey,
    trimLabel,
    vehicleTrack: {
      status,
      customerRequirements: [],
      preferredColor: null,
    },
  };
}

// --- Unit: Mutation mode ---
assert.equal(detectOfferMutationMode('noch einen EV2'), OFFER_MUTATION_MODE.CREATE_NEW);
assert.equal(detectOfferMutationMode('änder EV3 auf Air'), OFFER_MUTATION_MODE.UPDATE_EXISTING);
assert.equal(detectOfferMutationMode('Mach Earth zu Air.'), OFFER_MUTATION_MODE.UPDATE_EXISTING);
assert.equal(detectOfferMutationMode('Doch EV2 Earth.'), OFFER_MUTATION_MODE.UPDATE_EXISTING);

// --- Unit: Identity follow-up ---
{
  const trim = parseOfferIdentityFollowUp('Mach Earth zu Air.');
  assert.equal(trim?.kind, 'trim');
  assert.equal(trim?.trim, 'Air');
  const color = parseOfferIdentityFollowUp('schwarz.');
  assert.equal(color?.kind, 'color');
  assert.equal(color?.color, 'schwarz');
}

// --- A: Active EV2 + „Angebot“ → EV2, nicht EV3 ---
{
  const lead = {
    id: 'lead-ev2-active',
    name: 'Max Mustermann',
    contact: { name: 'Max Mustermann' },
    wish: { model: 'EV3', modelKey: 'ev3', trim: 'Earth' },
    crm: {
      needProfile: {
        ...createEmptyNeedProfile(),
        selectedModelKey: 'ev3',
      },
      focusedVehicleTrackId: 'vc-ev2',
      vehicleConfigurations: [
        trackConfig('vc-ev2', 'ev2', VEHICLE_TRACK_STATUS.ACTIVE, 'Earth'),
        trackConfig('vc-ev3', 'ev3', VEHICLE_TRACK_STATUS.OPEN, 'Air'),
      ],
    },
  };

  const target = resolveOfferVehicleTarget({
    lead,
    sellerInput: 'Angebot',
    facts: [],
  });
  assert.equal(target.status, OFFER_VEHICLE_TARGET_STATUS.RESOLVED);
  assert.equal(target.modelKey, 'ev2');
  assert.equal(target.vehicleTrackId, 'vc-ev2');
  assert.notEqual(target.modelKey, 'ev3');

  const turn = runCleverSellerTurn({
    lead,
    sellerInput: 'Angebot',
    customerName: 'Max Mustermann',
    intentConstraint: COMPOSER_INTENT_CONSTRAINT.OFFER,
  });
  assert.ok(turn.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));
  const offerAction = (turn.preparedActions || []).find((a) => (
    a.type === SELLER_TURN_INTENTS.PREPARE_OFFER
  ));
  assert.ok(offerAction, 'PREPARE_OFFER action');
  if (offerAction.status !== 'blocked') {
    assert.equal(
      offerAction.payload?.vehicleTrackId || offerAction.payload?.vehicle?.modelKey,
      offerAction.payload?.vehicleTrackId ? 'vc-ev2' : 'ev2',
    );
    const model = String(
      offerAction.payload?.vehicle?.modelKey
      || offerAction.payload?.vehicle?.model
      || '',
    ).toLowerCase();
    assert.ok(/ev2/.test(model), `Target EV2, got ${model}`);
    assert.ok(!/ev3/.test(model) || offerAction.payload?.vehicleTrackId === 'vc-ev2');
  }
  assert.ok(!(turn.missingInformation || []).some((m) => m.id === 'clarify_vehicle_for_offer'));
}

// --- B: Multi-Track ohne Fokus + „Angebot“ → Clarification ---
{
  const lead = {
    id: 'lead-multi',
    name: 'Anna Beispiel',
    contact: { name: 'Anna Beispiel' },
    crm: {
      needProfile: createEmptyNeedProfile(),
      vehicleConfigurations: [
        trackConfig('vc-ev2', 'ev2', VEHICLE_TRACK_STATUS.OPEN),
        trackConfig('vc-ev3', 'ev3', VEHICLE_TRACK_STATUS.OPEN),
        trackConfig('vc-ev5', 'ev5', VEHICLE_TRACK_STATUS.OPEN),
      ],
    },
  };

  const target = resolveOfferVehicleTarget({
    lead,
    sellerInput: 'Angebot',
    facts: [],
  });
  assert.equal(target.status, OFFER_VEHICLE_TARGET_STATUS.NEEDS_CLARIFICATION);
  assert.match(target.question || '', /Für welches Fahrzeug/i);
  assert.ok((target.choices || []).length >= 2);

  const turn = runCleverSellerTurn({
    lead,
    sellerInput: 'Angebot',
    customerName: 'Anna Beispiel',
    intentConstraint: COMPOSER_INTENT_CONSTRAINT.OFFER,
  });
  assert.ok((turn.missingInformation || []).some((m) => (
    m.id === 'clarify_vehicle_for_offer'
    && /Für welches Fahrzeug/i.test(m.label || CLARIFY_VEHICLE_FOR_OFFER_PROMPT)
  )));
  const blocked = (turn.preparedActions || []).find((a) => (
    a.type === SELLER_TURN_INTENTS.PREPARE_OFFER && a.status === 'blocked'
  ));
  assert.ok(blocked?.payload?.clarifyVehicleForOffer || blocked?.payload?.needsClarification);
}

// --- C: „Earth“ / „schwarz“ auf offenem Offer → trim/color update ---
{
  const offerCtx = {
    offerId: 'offer-1',
    title: 'Kaufangebot',
    summary: 'Kia EV3 Earth · Leasing',
    modelKey: 'ev3',
    vehicleTrackId: 'vc-ev3',
    monthlyRate: 314,
  };
  const lead = {
    id: 'lead-offer-open',
    name: 'Philipp Schmitz',
    contact: { name: 'Philipp Schmitz' },
    paymentType: 'leasing',
    crm: {
      needProfile: createEmptyNeedProfile(),
      focusedVehicleTrackId: 'vc-ev3',
      vehicleConfigurations: [
        trackConfig('vc-ev3', 'ev3', VEHICLE_TRACK_STATUS.ACTIVE, 'Earth'),
      ],
    },
  };

  const air = interpretSellerInput('Mach Earth zu Air.', {
    lead,
    currentOfferContext: offerCtx,
  });
  assert.ok(air.facts.some((f) => f.field === 'trimPreference'));
  const trimFact = air.facts.find((f) => f.field === 'trimPreference');
  assert.ok(
    /Air/i.test(String(trimFact.label || trimFact.value?.trim || '')),
    'Air als Trim',
  );
  assert.equal(trimFact.value?.targetScope, 'offer_vehicle');

  const turnAir = runCleverSellerTurn({
    lead,
    sellerInput: 'Air.',
    customerName: 'Philipp Schmitz',
    currentOfferContext: offerCtx,
  });
  assert.ok(turnAir.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));
  const updateAir = (turnAir.preparedActions || []).find((a) => (
    a.type === SELLER_TURN_INTENTS.PREPARE_OFFER
  ));
  assert.ok(updateAir);
  assert.ok(
    updateAir.payload?.updateOnly
    || updateAir.payload?.identityPatch?.trim
    || (turnAir.extractedFacts || turnAir.uniqueFacts || []).some((f) => f.field === 'trimPreference'),
  );

  const schwarz = interpretSellerInput('schwarz.', {
    lead,
    currentOfferContext: offerCtx,
  });
  assert.ok(schwarz.facts.some((f) => f.field === 'colorPreference'));
  const colorFact = schwarz.facts.find((f) => f.field === 'colorPreference');
  assert.equal(colorFact.value?.targetScope, 'offer_vehicle');
  assert.match(String(colorFact.value?.color || colorFact.value || ''), /schwarz/i);

  const turnColor = runCleverSellerTurn({
    lead,
    sellerInput: 'schwarz.',
    customerName: 'Philipp Schmitz',
    currentOfferContext: offerCtx,
  });
  assert.ok(turnColor.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));
}

console.log('offerVehicleIdentity.golden.test.js: ok');
