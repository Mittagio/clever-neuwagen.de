/**
 * Composer-Modi: Clever-Arbeit vs. Kunden-Nachrichten-Bearbeitung.
 * Pure Helpers – ohne React, damit Mode-Transitions unit-testbar sind.
 */

export const COMPOSER_MODES = Object.freeze({
  CLEVER_WORK: 'clever_work',
  CUSTOMER_MESSAGE_EDIT: 'customer_message_edit',
});

/**
 * @param {string} [mode]
 * @returns {boolean}
 */
export function isCustomerMessageEditMode(mode) {
  return mode === COMPOSER_MODES.CUSTOMER_MESSAGE_EDIT;
}

/**
 * Debounce / runCleverSellerTurn / Universal Review / Facts / Notepad nur in Clever-Arbeit.
 * @param {string} [mode]
 * @returns {boolean}
 */
export function shouldRunSellerInterpret(mode) {
  return !isCustomerMessageEditMode(mode);
}

/**
 * Body einer MESSAGE_DRAFT-Karte (Newlines erhalten, nicht trimmen).
 * @param {object} [result]
 * @returns {string}
 */
export function extractMessageDraftBody(result = {}) {
  const raw = result?.draft?.body ?? result?.body ?? '';
  return typeof raw === 'string' ? raw : String(raw ?? '');
}

/**
 * @param {{ result?: object, recipient?: string, contextAttachments?: object[] }} opts
 */
export function buildEditingMessageDraft({
  result = null,
  recipient = 'Kunde',
  contextAttachments = [],
} = {}) {
  const body = extractMessageDraftBody(result);
  return {
    id: String(result?.id || result?.draft?.id || `msg-edit-${Date.now()}`),
    recipient: String(recipient || 'Kunde').trim() || 'Kunde',
    body,
    sourceResult: result,
    contextAttachments: Array.isArray(contextAttachments) ? [...contextAttachments] : [],
  };
}

/**
 * Bearbeiten starten: Composer wird Editor, Interpret bleibt aus.
 * Mutiert keine Customer-Truth / Lead-Daten.
 *
 * @param {{ result: object, recipient?: string, contextAttachments?: object[], priorWorkDraft?: string }} opts
 */
export function beginCustomerMessageEdit({
  result,
  recipient = 'Kunde',
  contextAttachments = [],
  priorWorkDraft = '',
} = {}) {
  const editingMessageDraft = buildEditingMessageDraft({
    result,
    recipient,
    contextAttachments,
  });
  return {
    composerMode: COMPOSER_MODES.CUSTOMER_MESSAGE_EDIT,
    editingMessageDraft,
    draft: editingMessageDraft.body,
    priorWorkDraft: String(priorWorkDraft ?? ''),
    universalTurn: null,
  };
}

/**
 * Abbrechen: zurück zu Clever-Arbeit, MESSAGE_DRAFT wiederherstellen.
 * @param {{ editingMessageDraft?: object|null, priorWorkDraft?: string }} opts
 */
export function cancelCustomerMessageEdit({
  editingMessageDraft = null,
  priorWorkDraft = '',
} = {}) {
  return {
    composerMode: COMPOSER_MODES.CLEVER_WORK,
    editingMessageDraft: null,
    draft: String(priorWorkDraft ?? ''),
    sourceResult: editingMessageDraft?.sourceResult ?? null,
    universalTurn: null,
  };
}

/**
 * Nach erfolgreichem Senden: Edit-Modus beenden, Draft leeren.
 * @param {{ editedBody?: string }} opts
 */
export function completeCustomerMessageEditSend({ editedBody = '' } = {}) {
  return {
    composerMode: COMPOSER_MODES.CLEVER_WORK,
    editingMessageDraft: null,
    draft: '',
    sendBody: String(editedBody ?? ''),
    clearAssist: true,
    universalTurn: null,
  };
}

/**
 * UI-Texte / Flags für den omnipräsenten Composer.
 * @param {string} [mode]
 * @param {{ recipient?: string, displayName?: string, cleverMode?: boolean }} [opts]
 */
export function resolveComposerUi(mode, {
  recipient = '',
  displayName = '',
  cleverMode = true,
} = {}) {
  if (isCustomerMessageEditMode(mode)) {
    const name = String(recipient || displayName || 'Kunde').trim() || 'Kunde';
    return {
      mode: COMPOSER_MODES.CUSTOMER_MESSAGE_EDIT,
      label: `✉ Nachricht an ${name}`,
      placeholder: 'Nachricht bearbeiten …',
      sendAriaLabel: 'Nachricht an Kunden senden',
      growTextarea: true,
      showEditActions: true,
      hideSuggestionChips: true,
      compactAssistHint: `Nachricht an ${name} wird bearbeitet`,
    };
  }
  return {
    mode: COMPOSER_MODES.CLEVER_WORK,
    label: '',
    placeholder: cleverMode
      ? 'Alles reinwerfen – tippen, sprechen oder PDF …'
      : `Nachricht an ${displayName || 'dem Kunden'} …`,
    sendAriaLabel: 'Arbeit absenden',
    growTextarea: false,
    showEditActions: false,
    hideSuggestionChips: false,
    compactAssistHint: null,
  };
}

/**
 * Volle MESSAGE_DRAFT-Body in der Assist-Card ausblenden, solange im Composer editiert wird.
 * @param {{ composerMode?: string }} opts
 */
export function shouldHideMessageDraftBodyInAssist({ composerMode } = {}) {
  return isCustomerMessageEditMode(composerMode);
}

/**
 * Edit-Text darf nie als Kundeninteresse / proposedUpdates / Notepad-Chip landen.
 * Gate für Persist-/Fact-Pfade (zusätzlich zum Interpret-Skip).
 * @param {string} [mode]
 */
export function shouldPersistComposerTextAsCustomerFacts(mode) {
  return shouldRunSellerInterpret(mode);
}
