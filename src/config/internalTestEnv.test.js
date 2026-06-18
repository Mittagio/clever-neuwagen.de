import assert from 'node:assert/strict';
import { INTERNAL_TEST_BADGE_LABEL, isInternalTestEnv } from './internalTestEnv.js';

assert.equal(typeof isInternalTestEnv(), 'boolean');
assert.equal(INTERNAL_TEST_BADGE_LABEL, 'Interne Testversion');

console.log('internalTestEnv.test.js: ok');
