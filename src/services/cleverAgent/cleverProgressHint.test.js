/**
 * node src/services/cleverAgent/cleverProgressHint.test.js
 */
import assert from 'node:assert/strict';
import {
  CLEVER_LONG_JOB,
  CLEVER_PROGRESS_HINT_DELAY_MS,
  createProgressHintScheduler,
  isCleverLongJob,
  resolveCleverProgressHint,
} from './cleverProgressHint.js';

assert.equal(isCleverLongJob(CLEVER_LONG_JOB.AGENT), true);
assert.equal(isCleverLongJob('fast_local'), false);
assert.equal(isCleverLongJob(null), false);
assert.equal(isCleverLongJob(''), false);

assert.match(resolveCleverProgressHint(CLEVER_LONG_JOB.AGENT), /denkt/i);
assert.match(resolveCleverProgressHint(CLEVER_LONG_JOB.PDF_OCR), /PDF/i);
assert.match(resolveCleverProgressHint(CLEVER_LONG_JOB.SCREENSHOT_OCR), /Screenshot/i);
assert.equal(resolveCleverProgressHint(CLEVER_LONG_JOB.SERVER_INTERPRET), null, 'kein „Clever wertet aus“');
assert.equal(resolveCleverProgressHint('merk_dir'), null);
assert.equal(resolveCleverProgressHint('direct_answer'), null);

{
  const hints = [];
  const scheduler = createProgressHintScheduler({
    setHint: (v) => { hints.push(v); },
    delayMs: 30,
  });

  // Kurzer / unbekannter Job → still
  scheduler.start('composer_local');
  assert.deepEqual(hints, [null]);

  hints.length = 0;
  scheduler.start(CLEVER_LONG_JOB.AGENT);
  assert.equal(hints[0], null, 'sofort still bis Delay');
  await new Promise((r) => setTimeout(r, 45));
  assert.equal(hints.at(-1), resolveCleverProgressHint(CLEVER_LONG_JOB.AGENT));

  scheduler.clear();
  assert.equal(hints.at(-1), null);
}

{
  // Fast clear vor Delay → kein Spam-Hint
  const hints = [];
  const scheduler = createProgressHintScheduler({
    setHint: (v) => { hints.push(v); },
    delayMs: 80,
  });
  scheduler.start(CLEVER_LONG_JOB.SERVER_INTERPRET);
  await new Promise((r) => setTimeout(r, 100));
  assert.ok(!hints.some((h) => /wertet aus/i.test(String(h || ''))));
  assert.ok(hints.every((h) => h == null));
}

assert.ok(CLEVER_PROGRESS_HINT_DELAY_MS >= 500);

console.log('cleverProgressHint.test.js: ok');
