import assert from 'node:assert/strict';
import {
  COMPOSER_DOCK_PLACEHOLDER,
  COMPOSER_HERO_PLACEHOLDERS,
  COMPOSER_SOFT_PLACEHOLDERS,
  resolveComposerDockMode,
  resolveComposerPlaceholder,
  resolveComposerSurfaceState,
  resolveDockedContentSpacerPx,
} from './composerSurfaceState.js';

assert.equal(resolveComposerSurfaceState({}), 'idle');
assert.equal(resolveComposerSurfaceState({ focused: true }), 'expanded');
assert.equal(resolveComposerSurfaceState({ draft: 'Hallo' }), 'expanded');
assert.equal(resolveComposerSurfaceState({ hasAttachment: true }), 'expanded');
assert.equal(resolveComposerSurfaceState({ dictating: true }), 'expanded');
assert.equal(resolveComposerSurfaceState({ reviewOpen: true }), 'expanded');
assert.equal(resolveComposerSurfaceState({ pendingAction: true }), 'expanded');
assert.equal(resolveComposerSurfaceState({ customerMessageEdit: true }), 'expanded');
assert.equal(resolveComposerSurfaceState({ draft: '   ' }), 'idle');

assert.equal(resolveComposerDockMode({ scrolledPastHero: false }), 'hero');
assert.equal(resolveComposerDockMode({ scrolledPastHero: true }), 'docked');
assert.equal(
  resolveComposerDockMode({
    scrolledPastHero: false,
    surfaceExpanded: true,
    currentlyDocked: true,
  }),
  'docked',
  'Expanded Dock bleibt Dock (kein Jump während Tippen/Attachment)',
);
assert.equal(
  resolveComposerDockMode({
    scrolledPastHero: false,
    surfaceExpanded: false,
    currentlyDocked: true,
  }),
  'hero',
  'Idle + Scroll oben → zurück zum Hero',
);

assert.equal(
  resolveComposerPlaceholder({ draft: '', hintIndex: 0, dockMode: 'hero' }),
  COMPOSER_HERO_PLACEHOLDERS[0],
);
assert.equal(
  resolveComposerPlaceholder({ draft: '', dockMode: 'docked' }),
  COMPOSER_DOCK_PLACEHOLDER,
);
assert.equal(resolveComposerPlaceholder({ draft: 'x', dockMode: 'docked' }), '');
assert.ok(COMPOSER_SOFT_PLACEHOLDERS === COMPOSER_HERO_PLACEHOLDERS);
assert.ok(!COMPOSER_DOCK_PLACEHOLDER.includes('Hier eine Anfrage:'));
assert.match(COMPOSER_DOCK_PLACEHOLDER, /Frag Clever/i);

assert.equal(
  resolveDockedContentSpacerPx({ dockedComposerHeight: 72, safeAreaInsetBottom: 0, extraGap: 16 }),
  88,
);
assert.equal(
  resolveDockedContentSpacerPx({ dockedComposerHeight: 80, safeAreaInsetBottom: 12, extraGap: 16 }),
  108,
);

console.log('composerSurfaceState.test.js: ok');
