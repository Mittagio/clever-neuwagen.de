/**
 * node src/services/crm/composerLastAction.test.js
 */
import assert from 'node:assert/strict';
import {
  COMPOSER_LAST_ACTION_STATUS,
  buildComposerLastActionFromReviewModel,
  buildComposerLastActionFromText,
  statusLabelForComposerLastAction,
} from './composerLastAction.js';

assert.equal(statusLabelForComposerLastAction(COMPOSER_LAST_ACTION_STATUS.ACCEPTED), 'Übernommen');
assert.equal(statusLabelForComposerLastAction(COMPOSER_LAST_ACTION_STATUS.READY_TO_SEND), 'Bereit zum Senden');
assert.equal(statusLabelForComposerLastAction(COMPOSER_LAST_ACTION_STATUS.SENT), 'Gesendet');

const fromModel = buildComposerLastActionFromReviewModel({
  title: '✨ Clever hat vorbereitet',
  summaryLine: 'Nachricht bereit',
  actionSections: [{ kind: 'message_draft', body: 'Hallo, hier Ihr Angebot.' }],
  groups: [],
}, { status: COMPOSER_LAST_ACTION_STATUS.READY_TO_SEND });

assert.ok(fromModel);
assert.equal(fromModel.body, 'Hallo, hier Ihr Angebot.');
assert.equal(fromModel.status, COMPOSER_LAST_ACTION_STATUS.READY_TO_SEND);
assert.equal(fromModel.statusLabel, 'Bereit zum Senden');
assert.equal(fromModel.model.actionSections[0].body, 'Hallo, hier Ihr Angebot.');

const fromText = buildComposerLastActionFromText({
  body: 'Gesendete Kundenmail',
  status: COMPOSER_LAST_ACTION_STATUS.SENT,
});
assert.ok(fromText);
assert.equal(fromText.statusLabel, 'Gesendet');
assert.equal(fromText.body, 'Gesendete Kundenmail');

assert.equal(buildComposerLastActionFromText({ body: '   ' }), null);
assert.equal(buildComposerLastActionFromReviewModel(null), null);

console.log('composerLastAction.test.js: ok');
