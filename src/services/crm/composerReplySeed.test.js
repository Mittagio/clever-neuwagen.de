/**
 * Composer-Reply-Seed – Tests
 * node src/services/crm/composerReplySeed.test.js
 */
import assert from 'node:assert/strict';
import { buildComposerReplySeed, extractChangeWishText } from './composerReplySeed.js';

assert.match(buildComposerReplySeed('nachfassen'), /Schreib ihm/);
assert.match(buildComposerReplySeed('delivery'), /Übergabe/);
assert.match(
  buildComposerReplySeed('answer_customer_question', { question: 'Winterreifen?' }),
  /Winterreifen/,
);
assert.equal(
  buildComposerReplySeed('frei', { draft: 'Hallo, hier der Text.' }),
  'Hallo, hier der Text.',
);
assert.match(buildComposerReplySeed(null), /^Schreib ihm:/);

assert.match(
  buildComposerReplySeed('offer_change_request', {
    question: 'Lieber 36 Monate.',
    vehicleLabel: 'Kia XCeed',
  }),
  /Passe das XCeed-Angebot an: Lieber 36 Monate/,
);
assert.match(
  buildComposerReplySeed('offer_opened_followup', { vehicleLabel: 'Kia XCeed · Spirit' }),
  /XCeed-Angebot angeschaut/,
);
assert.equal(
  extractChangeWishText('Kunde wünscht Änderung (Kia XCeed): „AHK und Rot.“'),
  'AHK und Rot.',
);

console.log('composerReplySeed.test.js: ok');
