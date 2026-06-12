import assert from 'node:assert/strict';
import { resolveWishChipConflictHints } from './wishChipConflictHint.js';

const towHint = resolveWishChipConflictHints('ev9', ['tow_capacity_2000']);
assert.ok(towHint.tow_capacity_2000?.message.includes('Anhängerkupplung'));

const withTow = resolveWishChipConflictHints('ev9', ['tow_capacity_2000', 'towbar']);
assert.ok(!withTow.tow_capacity_2000);

console.log('wishChipConflictHint.test.js: ok');
