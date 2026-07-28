/**
 * Composer-Reply-Seed – Tests
 * node src/services/crm/composerReplySeed.test.js
 */
import assert from 'node:assert/strict';
import { buildComposerReplySeed } from './composerReplySeed.js';

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

console.log('composerReplySeed.test.js: ok');
