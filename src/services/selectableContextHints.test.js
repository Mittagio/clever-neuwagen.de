import assert from 'node:assert/strict';
import { buildSelectableContextHints } from './selectableContextHints.js';

const withFacts = buildSelectableContextHints({
  kundenwissen: {
    facts: [{ text: 'entscheidet mit Partner' }],
  },
  legacy: {
    kundenhelferChips: ['Legacy Partner-Chip'],
  },
});

assert.ok(
  withFacts.some((hint) => hint.id === 'partner'),
  'Partner-Hint aus kundenwissen.facts',
);

const legacyOnly = buildSelectableContextHints({
  kundenwissen: { facts: [] },
  legacy: {
    kundenhelferChips: ['entscheidet mit Partner'],
  },
});

assert.ok(
  legacyOnly.some((hint) => hint.id === 'partner'),
  'Legacy-Chips nur als Fallback ohne facts',
);

const duplicateAvoided = buildSelectableContextHints({
  kundenwissen: {
    facts: [{ text: '2 Kinder' }],
  },
  legacy: {
    kundenhelferChips: ['Hund, 2 Kinder'],
  },
});

assert.ok(
  duplicateAvoided.some((hint) => hint.id === 'familie'),
  'Familie-Hint aus facts ohne Doppelung mit legacy',
);

console.log('selectableContextHints.test.js: ok');
