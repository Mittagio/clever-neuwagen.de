/**
 * node src/services/cleverSeller/resolveAssistantContext.test.js
 */
import assert from 'node:assert/strict';
import {
  extractNamedCustomerFromInput,
  resolvePronounHints,
  resolveAssistantContext,
} from './resolveAssistantContext.js';

assert.equal(extractNamedCustomerFromInput('Schreibe Garritano ein Angebot'), 'Garritano');

const pronouns = resolvePronounHints('Schlag ihm vor, Montag 15 Uhr – das Angebot nochmal.');
assert.equal(pronouns.refersToCurrentCustomer, true);
assert.equal(pronouns.refersToCurrentOffer, true);

const ctx = resolveAssistantContext({
  lead: {
    id: 'lead-1',
    contact: { name: 'Garritano' },
    crm: {
      vehicleConfigurations: [{
        id: 'cfg-xceed',
        model: 'XCeed',
        modelKey: 'xceed',
        vehicleTrack: { status: 'favorite', requirementLabels: ['AHK'] },
      }],
    },
  },
  sellerInput: 'Schreib ihm wegen des Angebots',
  customerName: 'Garritano',
  workingContextItems: [{
    kind: 'offer',
    offerId: 'off-1',
    label: 'XCeed Angebot',
    card: { modelKey: 'xceed', title: 'XCeed' },
  }],
});

assert.equal(ctx.resolvedCustomer.matched, true);
assert.equal(ctx.resolvedCustomer.pronounResolved, true);
assert.ok(ctx.resolvedWorkingContext.offer || ctx.offerContext);
assert.ok(Array.isArray(ctx.resolvedWorkingContext.vehicleTracks));
assert.ok(Array.isArray(ctx.usedCustomerContext.notepadLabels));

console.log('resolveAssistantContext.test.js: ok');
