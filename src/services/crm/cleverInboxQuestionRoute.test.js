import assert from 'node:assert/strict';
import {
  buildInboxActionAkteUrl,
  buildInboxKundenakteUrl,
} from './cleverInboxQuestionRoute.js';
import { INBOX_EVENT_TYPES } from './cleverInboxService.js';

const leadId = 'lead-1';

const special = {
  id: 'inbox-sq-1',
  type: INBOX_EVENT_TYPES.SPECIAL_QUESTION,
  leadId,
  message: 'Anhängelast EV9?',
};
const specialAction = buildInboxActionAkteUrl(leadId, special);
assert.match(specialAction, /sheet=special_question_answer/);
assert.match(specialAction, /inboxItemId=inbox-sq-1/);
assert.equal(buildInboxKundenakteUrl(leadId, special), specialAction);

const replyMsg = {
  id: 'inbox-msg-1',
  type: INBOX_EVENT_TYPES.CUSTOMER_MESSAGE,
  leadId,
  actionTarget: 'reply',
  message: 'Wann Lieferung?',
  metadata: { threadId: 'thr-1' },
};
const replyUrl = buildInboxKundenakteUrl(leadId, replyMsg);
assert.match(replyUrl, /composer=1/);
assert.match(replyUrl, /inboxItemId=inbox-msg-1/);
assert.match(replyUrl, /threadId=thr-1/);

console.log('cleverInboxQuestionRoute.test.js: ok');
