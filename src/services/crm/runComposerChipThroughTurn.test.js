/**
 * node src/services/crm/runComposerChipThroughTurn.test.js
 */
import assert from 'node:assert/strict';
import { buildChipSellerInput } from './composerSuggestionService.js';
import { runComposerChipThroughTurn } from './runComposerChipThroughTurn.js';

assert.match(buildChipSellerInput('angebot', { customerName: 'Garritano' }), /Angebot/i);
assert.match(buildChipSellerInput('termin', { customerName: 'Garritano' }), /Termin/i);

const lead = {
  id: 'lead-chip',
  contact: { name: 'Garritano' },
  wish: { model: 'Picanto', modelKey: 'picanto' },
  paymentType: 'purchase',
  crm: { needProfile: { rawMessages: [] } },
};

const angebot = runComposerChipThroughTurn({
  lead,
  chipId: 'angebot',
  customerName: 'Garritano',
});
assert.equal(angebot.ok, true);
assert.ok(
  angebot.mode === 'universal_review'
  || angebot.mode === 'assist'
  || angebot.mode === 'legacy_suggestion',
);
assert.ok(angebot.turn);

const kundenlink = runComposerChipThroughTurn({
  lead,
  chipId: 'kundenlink',
  customerName: 'Garritano',
});
assert.equal(kundenlink.ok, true);
assert.ok(kundenlink.turn?.preparedActions?.some((a) => a.type === 'send_portfolio')
  || kundenlink.mode === 'legacy_suggestion');

// Multi-Intent Angebot + Nachricht (Garritano)
const multi = runComposerChipThroughTurn({
  lead: {
    ...lead,
    paymentType: 'purchase',
    crm: {
      needProfile: { paymentType: 'purchase', rawMessages: [] },
      sellerInsights: [{ text: 'Platz für den Hund wichtig' }],
    },
  },
  chipId: 'angebot',
  customerName: 'Garritano',
});
assert.ok(multi.turn);
if (multi.mode === 'universal_review') {
  assert.ok(multi.turn.preparedActions.some((a) => a.type === 'prepare_offer'
    || a.type === 'draft_message'));
}

console.log('runComposerChipThroughTurn.test.js: ok');
