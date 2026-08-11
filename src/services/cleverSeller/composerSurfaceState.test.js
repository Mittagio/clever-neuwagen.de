import assert from 'node:assert/strict';
import {
  buildComposerTaskTitle,
  buildFactChangedMicroConfirm,
  buildPhoneAddedConfirmation,
  buildPhoneAddedMicroConfirm,
  COMPOSER_DOCK_PLACEHOLDER,
  COMPOSER_HERO_PLACEHOLDERS,
  COMPOSER_QUIET_INTAKE_PLACEHOLDER,
  COMPOSER_SOFT_PLACEHOLDERS,
  resolveComposerDockMode,
  resolveComposerPlaceholder,
  resolveComposerSurfaceState,
  resolveDockedContentSpacerPx,
} from './composerSurfaceState.js';

assert.equal(
  buildComposerTaskTitle({ kind: 'phone_add', name: 'Matthias Wittig' }),
  'TELEFON ERGÄNZEN · Matthias Wittig',
);
assert.equal(
  buildComposerTaskTitle({ kind: 'model_fix', name: 'Matthias Wittig' }),
  'MODELL KORRIGIEREN · Matthias Wittig',
);
assert.equal(
  buildComposerTaskTitle({ kind: 'offer_prepare', name: 'Max' }),
  'ANGEBOT VORBEREITEN · Max',
);
assert.equal(
  buildComposerTaskTitle({ kind: 'offer_prepare', name: '' }).startsWith('ANGEBOT VORBEREITEN'),
  true,
  'Home-Task-Titel beginnt mit ANGEBOT VORBEREITEN',
);
assert.deepEqual(
  buildPhoneAddedMicroConfirm({ name: 'Matthias Wittig' }),
  { text: 'Telefon ergänzt', undoLabel: 'Rückgängig', field: 'phone' },
);
assert.deepEqual(
  buildFactChangedMicroConfirm({ fieldLabel: 'Telefon', verb: 'geändert', field: 'phone' }),
  { text: 'Telefon geändert', undoLabel: 'Rückgängig', field: 'phone' },
);
assert.equal(
  buildPhoneAddedConfirmation({ name: 'Matthias Wittig' }),
  'Telefon ergänzt · Rückgängig',
  'Feedback-Freeze: kurze Micro-Confirm, kein langer Composer-Erfolgssatz',
);
assert.ok(
  !/vollständig genug für die Kundenakte/i.test(
    buildPhoneAddedConfirmation({ name: 'Matthias Wittig' }),
  ),
);

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
assert.equal(
  resolveComposerPlaceholder({ draft: '', quietIntake: true, dockMode: 'docked' }),
  COMPOSER_QUIET_INTAKE_PLACEHOLDER,
);
assert.match(COMPOSER_QUIET_INTAKE_PLACEHOLDER, /Frag Clever weiter/i);
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
