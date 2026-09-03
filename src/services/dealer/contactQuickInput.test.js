import assert from 'node:assert/strict';
import {
  applyEmailDomain,
  applyPhonePrefix,
} from './contactQuickInput.js';

assert.equal(applyEmailDomain('max', '@web.de'), 'max@web.de');
assert.equal(applyEmailDomain('max@gmx.de', '@web.de'), 'max@web.de');
assert.equal(applyPhonePrefix('', '0176'), '0176');
assert.equal(applyPhonePrefix('0170123456', '0176'), '0176123456');
assert.equal(applyPhonePrefix('0176', '0176'), '0176');
console.log('contactQuickInput ok');
