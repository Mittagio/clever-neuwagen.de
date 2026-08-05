import assert from 'node:assert/strict';
import {
  COMPOSER_SOFT_PLACEHOLDERS,
  resolveComposerDockMode,
  resolveComposerPlaceholder,
  resolveComposerSurfaceState,
} from './composerSurfaceState.js';

assert.equal(resolveComposerSurfaceState({}), 'idle');
assert.equal(resolveComposerSurfaceState({ focused: true }), 'expanded');
assert.equal(resolveComposerSurfaceState({ draft: 'Hallo' }), 'expanded');
assert.equal(resolveComposerSurfaceState({ hasAttachment: true }), 'expanded');
assert.equal(resolveComposerSurfaceState({ dictating: true }), 'expanded');
assert.equal(resolveComposerSurfaceState({ reviewOpen: true }), 'expanded');
assert.equal(resolveComposerSurfaceState({ draft: '   ' }), 'idle');

assert.equal(resolveComposerDockMode({ scrolledPastHero: false }), 'hero');
assert.equal(resolveComposerDockMode({ scrolledPastHero: true }), 'docked');

assert.equal(
  resolveComposerPlaceholder({ draft: '', hintIndex: 0 }),
  COMPOSER_SOFT_PLACEHOLDERS[0],
);
assert.equal(resolveComposerPlaceholder({ draft: 'x' }), '');
assert.ok(!COMPOSER_SOFT_PLACEHOLDERS[0].includes('Hier eine Anfrage:'));

console.log('composerSurfaceState.test.js: ok');
