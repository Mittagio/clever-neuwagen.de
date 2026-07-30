/**
 * Regression: vorbereitete Composer-Assist-Karte darf bei leerem Draft nicht verschwinden.
 */
import assert from 'node:assert/strict';
import { shouldClearAssistOnEmptyDraft } from './composerAssistPin.js';

assert.equal(
  shouldClearAssistOnEmptyDraft({ pinned: true }),
  false,
  'gepinnt: empty-draft löscht Assist nicht',
);
assert.equal(
  shouldClearAssistOnEmptyDraft({ pinned: true, confirmAssist: { ok: true } }),
  false,
  'gepinnt: auch confirmAssist ersetzt die Karte nicht',
);
assert.equal(
  shouldClearAssistOnEmptyDraft({ pinned: false }),
  true,
  'ohne Pin: empty-draft darf clearen',
);
assert.equal(
  shouldClearAssistOnEmptyDraft({ pinned: false, confirmAssist: { ok: true } }),
  true,
  'ohne Pin: clear/replace mit confirmAssist erlaubt',
);
assert.equal(
  shouldClearAssistOnEmptyDraft({}),
  true,
  'Default: nicht gepinnt → clear',
);

console.log('composerAssistPin.test.js: ok');
