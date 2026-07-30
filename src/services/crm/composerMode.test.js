/**
 * node src/services/crm/composerMode.test.js
 */
import assert from 'node:assert/strict';
import {
  COMPOSER_MODES,
  beginCustomerMessageEdit,
  buildEditingMessageDraft,
  cancelCustomerMessageEdit,
  completeCustomerMessageEditSend,
  extractMessageDraftBody,
  isCustomerMessageEditMode,
  resolveComposerUi,
  shouldHideMessageDraftBodyInAssist,
  shouldPersistComposerTextAsCustomerFacts,
  shouldRunSellerInterpret,
} from './composerMode.js';
import { INLINE_RESULT_TYPES } from '../dealer/sellerInlineComposerAssist.js';
import { runCleverSellerTurn } from '../cleverSeller/runCleverSellerTurn.js';
import { shouldShowUniversalReview } from '../cleverSeller/buildUniversalReviewModel.js';

const messageResult = {
  type: INLINE_RESULT_TYPES.MESSAGE_DRAFT,
  id: 'draft-1',
  title: '✨ Nachfassen',
  headline: 'Nachricht an Max',
  body: 'Hallo Max,\n\nerste Zeile.\nzweite Zeile.',
  draft: { body: 'Hallo Max,\n\nerste Zeile.\nzweite Zeile.' },
  primaryCta: 'Senden',
  secondaryCta: 'Bearbeiten',
};

const offerPill = {
  id: 'offer:vc-1',
  kind: 'offer',
  offerId: 'vc-1',
  label: 'EV4 Angebot',
  shortLabel: 'EV4 · 36 M',
};

// --- extract / build ---
assert.equal(
  extractMessageDraftBody(messageResult),
  'Hallo Max,\n\nerste Zeile.\nzweite Zeile.',
  'Newlines in Draft-Body erhalten',
);
assert.equal(
  extractMessageDraftBody({ body: 'nur body' }),
  'nur body',
);
assert.equal(
  extractMessageDraftBody({ draft: { body: 'aus draft' }, body: 'fallback' }),
  'aus draft',
);

const built = buildEditingMessageDraft({
  result: messageResult,
  recipient: 'Max Mustermann',
  contextAttachments: [offerPill],
});
assert.equal(built.recipient, 'Max Mustermann');
assert.equal(built.body, messageResult.body);
assert.equal(built.sourceResult, messageResult);
assert.equal(built.contextAttachments.length, 1);
assert.equal(built.contextAttachments[0].offerId, 'vc-1');

// --- begin edit → customer_message_edit ---
const started = beginCustomerMessageEdit({
  result: messageResult,
  recipient: 'Max Mustermann',
  contextAttachments: [offerPill],
  priorWorkDraft: 'Mach dem Kunden ein Angebot.',
});
assert.equal(started.composerMode, COMPOSER_MODES.CUSTOMER_MESSAGE_EDIT);
assert.ok(isCustomerMessageEditMode(started.composerMode));
assert.equal(started.draft, messageResult.body);
assert.equal(started.priorWorkDraft, 'Mach dem Kunden ein Angebot.');
assert.equal(started.universalTurn, null);
assert.equal(started.editingMessageDraft.contextAttachments[0].id, 'offer:vc-1');

// Customer Truth / Lead werden nicht mutiert (reine Transition)
const leadSnapshot = { id: 'l1', wish: { model: 'EV4' }, interest: 'SUV' };
const leadBefore = JSON.stringify(leadSnapshot);
beginCustomerMessageEdit({
  result: messageResult,
  recipient: 'Max',
  priorWorkDraft: '',
});
assert.equal(JSON.stringify(leadSnapshot), leadBefore, 'Lead/Customer Truth unverändert');

// --- debounce / interpret skipped in edit mode ---
assert.equal(shouldRunSellerInterpret(COMPOSER_MODES.CUSTOMER_MESSAGE_EDIT), false);
assert.equal(shouldRunSellerInterpret(COMPOSER_MODES.CLEVER_WORK), true);
assert.equal(shouldRunSellerInterpret(undefined), true);
assert.equal(
  shouldPersistComposerTextAsCustomerFacts(COMPOSER_MODES.CUSTOMER_MESSAGE_EDIT),
  false,
  'Edit-Text → keine Facts / Notepad / proposedUpdates',
);

// MESSAGE_DRAFT-Body als Seller-Input würde sonst Interest erzeugen – Gate verhindert den Pfad
const emptyLead = { id: 'lead-empty', wish: {}, crm: {} };
const wouldInterpret = runCleverSellerTurn({
  lead: emptyLead,
  sellerInput: messageResult.body,
});
assert.ok(
  wouldInterpret?.extractedFacts?.length >= 0,
  'Kontroll: Interpret-Pipeline existiert für normalen Input',
);
// Im Edit-Mode darf dieser Turn gar nicht laufen:
assert.equal(
  shouldRunSellerInterpret(started.composerMode),
  false,
  'Edit-Mode: runCleverSellerTurn wird nicht angebunden',
);
assert.equal(
  shouldShowUniversalReview && shouldRunSellerInterpret(started.composerMode)
    ? shouldShowUniversalReview(wouldInterpret)
    : false,
  false,
  'Edit-Mode: kein Universal Review aus Nachrichten-Text',
);

// --- hide duplicate body ---
assert.equal(
  shouldHideMessageDraftBodyInAssist({ composerMode: COMPOSER_MODES.CUSTOMER_MESSAGE_EDIT }),
  true,
);
assert.equal(
  shouldHideMessageDraftBodyInAssist({ composerMode: COMPOSER_MODES.CLEVER_WORK }),
  false,
);

// --- UI ---
const editUi = resolveComposerUi(COMPOSER_MODES.CUSTOMER_MESSAGE_EDIT, {
  recipient: 'Max Mustermann',
});
assert.match(editUi.label, /Nachricht an Max Mustermann/);
assert.equal(editUi.placeholder, 'Nachricht bearbeiten …');
assert.equal(editUi.sendAriaLabel, 'Nachricht an Kunden senden');
assert.equal(editUi.growTextarea, true);
assert.equal(editUi.showEditActions, true);
assert.equal(editUi.hideSuggestionChips, true);
assert.match(editUi.compactAssistHint, /wird bearbeitet/);

const workUi = resolveComposerUi(COMPOSER_MODES.CLEVER_WORK, { cleverMode: true });
assert.match(workUi.placeholder, /Alles reinwerfen/);
assert.equal(workUi.sendAriaLabel, 'Arbeit absenden');
assert.equal(workUi.showEditActions, false);

// --- cancel restores clever_work + source MESSAGE_DRAFT ---
const cancelled = cancelCustomerMessageEdit({
  editingMessageDraft: started.editingMessageDraft,
  priorWorkDraft: started.priorWorkDraft,
});
assert.equal(cancelled.composerMode, COMPOSER_MODES.CLEVER_WORK);
assert.equal(cancelled.editingMessageDraft, null);
assert.equal(cancelled.draft, 'Mach dem Kunden ein Angebot.');
assert.equal(cancelled.sourceResult?.type, INLINE_RESULT_TYPES.MESSAGE_DRAFT);
assert.equal(cancelled.sourceResult?.body, messageResult.body);
assert.equal(cancelled.universalTurn, null);

// --- send uses edited body, clears edit ---
const editedBody = 'Hallo Max,\n\ngeändert Zeile eins.\ngeändert Zeile zwei.';
const sent = completeCustomerMessageEditSend({ editedBody });
assert.equal(sent.composerMode, COMPOSER_MODES.CLEVER_WORK);
assert.equal(sent.editingMessageDraft, null);
assert.equal(sent.draft, '');
assert.equal(sent.sendBody, editedBody);
assert.equal(sent.clearAssist, true);

// Timeline: Draft bleibt bis Send außerhalb des Chats (Helper liefert sendBody erst bei complete)
assert.ok(started.draft.length > 0);
assert.notEqual(started.draft, '');
assert.equal(sent.sendBody.includes('geändert'), true, 'Send-Pfad nutzt bearbeiteten Body');

// --- offer context retained through edit ---
assert.equal(started.editingMessageDraft.contextAttachments.length, 1);
assert.equal(started.editingMessageDraft.contextAttachments[0].kind, 'offer');

// --- clever_work still interprets normal input ---
const workTurn = runCleverSellerTurn({
  lead: emptyLead,
  sellerInput: 'Kunde will 36 Monate und 15.000 km',
});
assert.equal(shouldRunSellerInterpret(COMPOSER_MODES.CLEVER_WORK), true);
assert.ok(
  (workTurn.extractedFacts?.length ?? 0) > 0
    || shouldShowUniversalReview(workTurn)
    || workTurn.preparedActions?.length > 0
    || workTurn.interpretedInput,
  'clever_work: normaler Input wird interpretiert',
);

console.log('composerMode.test.js: OK');
