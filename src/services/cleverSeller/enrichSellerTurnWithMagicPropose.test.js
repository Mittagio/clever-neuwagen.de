/**
 * node src/services/cleverSeller/enrichSellerTurnWithMagicPropose.test.js
 */
import assert from 'node:assert/strict';
import {
  applyMagicBodyToTurn,
  buildMagicProposeFeedback,
  buildMagicProposePayload,
  shouldSkipMagicForOffer,
} from './enrichSellerTurnWithMagicPropose.js';
import { prepareGroundedCustomerMessageSync } from './prepareGroundedCustomerMessageSync.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { VEHICLE_TRACK_STATUS } from '../crm/vehicleTrack.js';

// --- Skip Magic bei unvollständigem Angebot / Angebot ohne Schreib-Intent ---
{
  const incomplete = {
    preparedActions: [{
      type: SELLER_TURN_INTENTS.PREPARE_OFFER,
      payload: { canCreateOffer: false },
    }],
  };
  assert.equal(shouldSkipMagicForOffer(incomplete, 'Erstelle ein Leasing-Angebot Tivoli'), true);
  // Unvollständig: auch mit Schreib-Intent kein Magic (erst Angebot klären)
  assert.equal(shouldSkipMagicForOffer(incomplete, 'Schreib ihm eine Nachricht zum Angebot'), true);

  const complete = {
    preparedActions: [{
      type: SELLER_TURN_INTENTS.PREPARE_OFFER,
      payload: { canCreateOffer: true },
    }],
  };
  assert.equal(shouldSkipMagicForOffer(complete, 'Erstelle Angebot Picanto'), true);
  assert.equal(shouldSkipMagicForOffer(complete, 'Schreib ihm die Angebotsmail'), false);
}

// --- applyMagicBodyToTurn ersetzt Draft ---
{
  const turn = {
    messageDraft: 'alt',
    preparedActions: [{
      type: SELLER_TURN_INTENTS.DRAFT_MESSAGE,
      payload: { messageDraft: 'alt' },
    }],
  };
  const next = applyMagicBodyToTurn(turn, 'Hallo – Magic Body.');
  assert.equal(next.messageDraft, 'Hallo – Magic Body.');
  assert.equal(next.preparedActions[0].payload.messageDraft, 'Hallo – Magic Body.');
  assert.equal(next.preparedActions[0].needsSellerConfirmation, true);
}

// --- Offline-Feedback klar ---
assert.match(
  buildMagicProposeFeedback({ magicWriter: 'grounded_fallback', magicRemoteEnabled: false }),
  /Offline-Entwurf/i,
);
assert.match(
  buildMagicProposeFeedback({
    magicWriter: 'grounded_fallback',
    magicRemoteEnabled: true,
    magicWarnings: ['openai_key_missing'],
  }),
  /Fallback-Entwurf/i,
);
assert.match(
  buildMagicProposeFeedback({ magicWriter: 'openai', magicRemoteEnabled: true }),
  /geschrieben/i,
);

// --- Payload: Chip-Intent + Akte-Neigung ---
{
  const lead = {
    id: 'lead-1',
    contact: { name: 'Herr Müller' },
    crm: {
      vehicleConfigurations: [
        {
          id: 'cfg-xceed',
          model: 'XCeed',
          modelKey: 'xceed',
          vehicleTrack: { status: VEHICLE_TRACK_STATUS.FAVORITE },
        },
        {
          id: 'cfg-tivoli',
          model: 'Tivoli',
          modelKey: 'tivoli',
          vehicleTrack: { status: VEHICLE_TRACK_STATUS.OPEN },
        },
      ],
    },
  };
  const payload = buildMagicProposePayload({
    sellerInput: 'Schreib dem Kunden eine kurze Nachfassnachricht.',
    lead,
    customerName: 'Herr Müller',
    workingContext: { modelKey: 'tivoli', shortLabel: 'Tivoli · 48M', offerId: 'off-t' },
    offerContext: { offerId: 'off-t', title: 'Tivoli', monthlyRate: 269, summary: 'Tivoli · 48M · 269 €' },
  });
  assert.equal(payload.chipIntent, 'nachfassen');
  assert.equal(payload.akteContext.inclination?.modelKey, 'xceed');
  assert.equal(payload.akteContext.selectedWorkingChip?.modelKey, 'tivoli');
}

// --- Sync-Pfad: Chip-Intent Nachfassen ohne leeres Template ---
{
  const lead = {
    id: 'lead-sync',
    contact: { name: 'Herr Müller' },
    crm: {
      vehicleConfigurations: [
        {
          id: 'cfg-xceed',
          model: 'XCeed',
          modelKey: 'xceed',
          vehicleTrack: { status: VEHICLE_TRACK_STATUS.FAVORITE },
        },
      ],
    },
  };
  const prepared = prepareGroundedCustomerMessageSync({
    sellerInput: 'Schreib dem Kunden eine kurze Nachfassnachricht.',
    lead,
    customerName: 'Herr Müller',
    workingContext: { modelKey: 'tivoli', shortLabel: 'Tivoli · 48M', offerId: 'off-t' },
    offerContext: {
      offerId: 'off-t',
      title: 'Tivoli',
      monthlyRate: 269,
      summary: 'Tivoli · 48 Monate · 269 € mtl.',
    },
  });
  assert.ok(prepared.messageDraft);
  assert.match(prepared.messageDraft, /\?/);
  assert.doesNotMatch(prepared.messageDraft, /kurze Rückfrage:\s*$/m);
  assert.doesNotMatch(prepared.messageDraft, /schreib.*nachfass/i);
  assert.match(prepared.messageDraft, /Tivoli|XCeed|Fahrzeugwunsch/i);
  const rateHits = prepared.messageDraft.match(/269/g) || [];
  assert.ok(rateHits.length <= 1, `duplicate rate: ${rateHits.length}`);
}

console.log('enrichSellerTurnWithMagicPropose.test.js: ok');
