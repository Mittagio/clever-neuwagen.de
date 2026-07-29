/**
 * node src/services/crm/composerAkteSearch.test.js
 */
import assert from 'node:assert/strict';
import {
  extractAkteSearchTerms,
  isComposerAkteSearchQuery,
  runComposerAkteSearch,
  searchAkteByQuery,
} from './composerAkteSearch.js';
import { INLINE_RESULT_TYPES } from '../dealer/sellerInlineComposerAssist.js';
import { MESSAGE_KIND, MESSAGE_DIRECTION, MESSAGE_CHANNEL, MESSAGE_STATUS } from './customerMessageService.js';

assert.equal(isComposerAkteSearchQuery('Hallo'), false);
assert.equal(isComposerAkteSearchQuery('Was habe ich Frau Deuschle wegen der Lieferzeit geschrieben?'), true);
assert.equal(isComposerAkteSearchQuery('Welches Angebot hatte ich ihr zuerst geschickt?'), true);
assert.ok(extractAkteSearchTerms('Was habe ich wegen der Lieferzeit geschrieben?').includes('lieferzeit'));

const lead = {
  id: 'lead-search',
  name: 'Christina Deuschle',
  contact: { name: 'Christina Deuschle' },
  paymentType: 'leasing',
  wish: { model: 'EV4', termMonths: 48, mileagePerYear: 15000 },
  crm: {
    vehicleConfigurations: [{
      id: 'vc-1',
      model: 'EV4',
      modelKey: 'ev4',
      modelName: 'Kia EV4',
      trimLabel: 'GT-Line',
      paymentType: 'leasing',
      termMonths: 48,
      mileagePerYear: 15000,
      desiredRate: 329,
    }],
    customerMessageThreads: [{ id: 'th-1', title: 'Kundenkommunikation' }],
    customerMessages: [{
      id: 'msg-1',
      threadId: 'th-1',
      direction: MESSAGE_DIRECTION.OUTBOUND,
      channel: MESSAGE_CHANNEL.CLEVER,
      status: MESSAGE_STATUS.SENT,
      kind: MESSAGE_KIND.TEXT,
      text: 'Aktuell rechnen wir beim EV4 mit ungefähr vier bis fünf Monaten Lieferzeit.',
      visibleToCustomer: true,
      createdByName: 'Max',
      createdAt: '2026-07-18T14:32:00.000Z',
    }],
  },
};

const found = runComposerAkteSearch(
  lead,
  'Was habe ich Frau Deuschle damals wegen der Lieferzeit geschrieben?',
);
assert.equal(found.ok, true);
assert.equal(found.results[0].type, INLINE_RESULT_TYPES.SEARCH_HIT);
assert.match(found.results[0].body, /Lieferzeit|vier bis fünf/i);

const offer = runComposerAkteSearch(lead, 'Welches Angebot hatte ich ihr zuerst geschickt?');
assert.equal(offer.ok, true);
assert.ok(offer.results[0].offerId === 'vc-1' || /EV4/i.test(offer.results[0].body));

const miss = runComposerAkteSearch(lead, 'Finde bitte den Mondkalender Eintrag');
assert.equal(miss.ok, true);
assert.match(miss.results[0].title, /Nichts gefunden|Suche/i);

const classic = searchAkteByQuery(lead, 'Lieferzeit', { freeText: true });
assert.equal(classic.ok, true);
assert.ok(classic.hits.some((h) => /Lieferzeit/i.test(h.snippet)));

const classicOffer = searchAkteByQuery(lead, 'EV4', { freeText: true });
assert.ok(classicOffer.hits.some((h) => h.kind === 'offer' || /EV4/i.test(h.snippet || h.title)));

console.log('composerAkteSearch.test.js: OK');
