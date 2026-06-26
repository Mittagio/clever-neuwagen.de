import assert from 'node:assert/strict';
import {
  SOURCE_MODES,
  buildCrmSourceModePatch,
  getSourceModeChipLabel,
  resolveLeadSourceMode,
  resolveSourceModeFromEntry,
} from './dealerSourceMode.js';

assert.equal(resolveSourceModeFromEntry('clever'), SOURCE_MODES.ADVISOR);
assert.equal(resolveSourceModeFromEntry('classic'), SOURCE_MODES.KNOWN_MODEL);

const advisor = resolveLeadSourceMode({ isCleverEntry: true });
assert.equal(advisor.sourceMode, SOURCE_MODES.ADVISOR);

const known = resolveLeadSourceMode({ isClassicEntry: true, modelKey: 'ev3' });
assert.equal(known.sourceMode, SOURCE_MODES.KNOWN_MODEL);
assert.equal(known.sourceModelKey, 'ev3');

assert.equal(
  getSourceModeChipLabel({ crm: { sourceMode: SOURCE_MODES.ADVISOR } }),
  'kam über Beratung',
);
assert.equal(
  getSourceModeChipLabel({ crm: { sourceMode: SOURCE_MODES.KNOWN_MODEL, sourceModelKey: 'ev3' } }),
  'EV3 gezielt angefragt',
);

const patch = buildCrmSourceModePatch({ entryMode: 'classic', modelKey: 'sportage' });
assert.equal(patch.sourceMode, SOURCE_MODES.KNOWN_MODEL);
assert.equal(patch.sourceModelKey, 'sportage');

console.log('dealerSourceMode.test.js: ok');
