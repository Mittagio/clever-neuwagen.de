/**
 * node src/services/crm/composerSuggestionService.test.js
 */
import assert from 'node:assert/strict';
import {
  COMPOSER_PRIMARY_CHIPS,
  COMPOSER_MORE_CHIPS,
  COMPOSER_SUGGESTION_CHIPS,
  buildComposerCustomerMessage,
  buildComposerSuggestionAssist,
  resolveComposerShortcut,
} from './composerSuggestionService.js';
import { INLINE_RESULT_TYPES } from '../dealer/sellerInlineComposerAssist.js';

assert.ok(COMPOSER_PRIMARY_CHIPS.some((c) => c.id === 'nachfassen'));
assert.ok(COMPOSER_PRIMARY_CHIPS.some((c) => c.id === 'danke'));
assert.ok(COMPOSER_PRIMARY_CHIPS.some((c) => c.id === 'kundenlink'));
assert.ok(COMPOSER_MORE_CHIPS.some((c) => c.id === 'nicht_erreicht'));
assert.ok(COMPOSER_MORE_CHIPS.some((c) => c.id === 'termin'));
assert.equal(COMPOSER_SUGGESTION_CHIPS.length, COMPOSER_PRIMARY_CHIPS.length + COMPOSER_MORE_CHIPS.length);

assert.equal(resolveComposerShortcut('Nachfassen')?.id, 'nachfassen');
assert.equal(resolveComposerShortcut('Danke')?.id, 'danke');
assert.equal(resolveComposerShortcut('kundenlink')?.action, 'portfolio');
assert.equal(resolveComposerShortcut('Mach dem Kunden ein Angebot.'), null);

const lead = {
  id: 'lead-christina',
  name: 'Christina Deuschle',
  contact: { name: 'Christina Deuschle', salutation: 'frau' },
  paymentType: 'leasing',
  wish: { model: 'EV4', trim: 'Air' },
  crm: {
    vehicleConfigurations: [{
      id: 'vc-1',
      model: 'EV4',
      modelKey: 'ev4',
      trimLabel: 'Air',
      paymentType: 'leasing',
    }],
  },
};

const msg = buildComposerCustomerMessage(lead, 'nachfassen', {
  customerName: 'Christina Deuschle',
});
assert.match(msg.body, /Frau Deuschle|Christina/i);
assert.match(msg.body, /EV4/i);

const danke = buildComposerCustomerMessage(lead, 'danke');
assert.match(danke.body, /Christina|Deuschle|Guten|Hallo/i);

const assist = buildComposerSuggestionAssist(lead, 'nachfassen', {
  customerName: 'Christina Deuschle',
});
assert.equal(assist.ok, true);
assert.equal(assist.results[0].type, INLINE_RESULT_TYPES.MESSAGE_DRAFT);

const link = buildComposerSuggestionAssist(lead, 'kundenlink');
assert.equal(link.results[0].type, INLINE_RESULT_TYPES.PORTFOLIO_SEND);

const delivery = buildComposerCustomerMessage(lead, 'lieferzeit');
assert.match(delivery.body, /Verfügbarkeit|Lieferzeit/i);

console.log('composerSuggestionService.test.js: OK');
