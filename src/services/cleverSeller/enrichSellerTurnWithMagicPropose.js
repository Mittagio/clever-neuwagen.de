/**
 * Async Magic-Propose: LLM/grounded Writer ersetzt Template-Mails
 * ohne den Confirm-Vertrag (Propose → Review → Accept) zu brechen.
 */
import {
  isCleverMagicMessageClientEnabled,
  requestCleverMagicMessage,
} from '../clever/intelligence/cleverSharedIntelligenceClient.js';
import { composeSellerOutboundMessageAsync } from '../crm/improveSellerOutboundMessage.js';
import {
  buildMagicAkteContext,
  detectChipIntent,
} from '../crm/magic/buildMagicAkteContext.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { containsSellerCommandInMessage } from './validateSellerCommandMessage.js';

/**
 * Unvollständiges Angebot ohne expliziten Schreib-Intent → kein Magic.
 * @param {object} turn
 * @param {string} sellerInput
 */
export function shouldSkipMagicForOffer(turn, sellerInput = '') {
  const text = String(sellerInput || '').trim();
  const offerAction = (turn?.preparedActions || []).find(
    (a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER,
  );
  const offerIncomplete = Boolean(
    offerAction
    && offerAction.payload
    && offerAction.payload.canCreateOffer === false,
  );
  return offerIncomplete
    || (
      Boolean(offerAction)
      && !/\b(schreib|nachricht|mail)\b/i.test(text)
    );
}

/**
 * Ersetzt messageDraft im Turn (preparedActions + Top-Level).
 * @param {object} turn
 * @param {string} body
 */
export function applyMagicBodyToTurn(turn, body) {
  const text = String(body || '').trim();
  if (!turn || !text) return turn;
  const prepared = Array.isArray(turn.preparedActions) ? [...turn.preparedActions] : [];
  const idx = prepared.findIndex((a) => a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE);
  const draftAction = {
    id: 'draft_message',
    type: SELLER_TURN_INTENTS.DRAFT_MESSAGE,
    label: 'Nachricht vorbereiten',
    needsSellerConfirmation: true,
    status: 'prepared',
    toolId: 'write_grounded_message',
    payload: { messageDraft: text },
  };
  if (idx >= 0) {
    prepared[idx] = {
      ...prepared[idx],
      ...draftAction,
      payload: { ...(prepared[idx].payload || {}), messageDraft: text },
    };
  } else {
    prepared.push(draftAction);
  }
  return {
    ...turn,
    messageDraft: text,
    preparedActions: prepared,
  };
}

/**
 * Feedback-Text für Offline / Fallback / OpenAI.
 */
export function buildMagicProposeFeedback({
  magicWriter = null,
  magicRemoteEnabled = false,
  magicWarnings = [],
} = {}) {
  if (magicWriter === 'openai') {
    return 'Clever hat geschrieben – bitte prüfen';
  }
  if (!magicRemoteEnabled) {
    return 'Offline-Entwurf (Magic/OpenAI aus) – bitte prüfen und anpassen';
  }
  if (magicWarnings.some((w) => /openai|key_missing|magic_flag|fallback/i.test(String(w)))) {
    return 'Fallback-Entwurf (OpenAI nicht verfügbar) – bitte prüfen und anpassen';
  }
  return 'Geprüfter Entwurf – bitte Inhalt kurz gegenlesen';
}

/**
 * Baut Magic-Payload inkl. Akte-Kontext / Chip-Intent.
 */
export function buildMagicProposePayload({
  sellerInput = '',
  lead = null,
  customerName = '',
  displayName = '',
  workingContext = null,
  offerContext = null,
  openVehicles = [],
  tone = 'freundlich',
} = {}) {
  const text = String(sellerInput || '').trim();
  const chipIntent = detectChipIntent(text);
  const akteContext = buildMagicAkteContext({
    lead,
    rawSellerInput: text,
    workingContext,
    offerContext,
    openVehicles,
  });
  return {
    rawSellerInput: text,
    draftText: text,
    lead,
    customerName,
    recipient: displayName || customerName || 'Kunde',
    tone: tone || 'freundlich',
    workingContext,
    offerContext,
    openVehicles,
    akteContext,
    chipIntent: chipIntent || akteContext.chipIntent,
    allowWithoutPackageDetails: true,
    sellerId: lead?.crm?.sellerId || lead?.ownerId || 'seller',
    dealerId: lead?.crm?.dealerId || lead?.dealerId || null,
  };
}

/**
 * Turn mit Magic-Nachricht anreichern (Remote → lokal grounded).
 * @returns {Promise<{
 *   turn: object,
 *   magicBody: string|null,
 *   magicWriter: string|null,
 *   magicWarnings: string[],
 *   magicRemoteEnabled: boolean,
 *   skipped: boolean,
 *   feedback: string|null,
 * }>}
 */
export async function enrichSellerTurnWithMagicPropose({
  turn,
  sellerInput = '',
  lead = null,
  customerName = '',
  displayName = '',
  workingContext = null,
  offerContext = null,
  openVehicles = [],
  tone = 'freundlich',
} = {}) {
  const text = String(sellerInput || '').trim();
  if (!turn || !text) {
    return {
      turn,
      magicBody: null,
      magicWriter: null,
      magicWarnings: [],
      magicRemoteEnabled: false,
      skipped: true,
      feedback: null,
    };
  }

  if (shouldSkipMagicForOffer(turn, text)) {
    return {
      turn,
      magicBody: null,
      magicWriter: null,
      magicWarnings: [],
      magicRemoteEnabled: isCleverMagicMessageClientEnabled(),
      skipped: true,
      feedback: null,
    };
  }

  const magicPayload = buildMagicProposePayload({
    sellerInput: text,
    lead,
    customerName,
    displayName,
    workingContext,
    offerContext,
    openVehicles,
    tone,
  });

  let magicBody = null;
  let magicWriter = null;
  let magicWarnings = [];
  const magicRemoteEnabled = isCleverMagicMessageClientEnabled();

  if (magicRemoteEnabled) {
    try {
      const remote = await requestCleverMagicMessage(magicPayload);
      if (remote?.ok && remote.body) {
        magicBody = String(remote.body).trim();
        magicWriter = remote.writer || 'openai';
        magicWarnings = remote.warnings || [];
      }
    } catch {
      /* local fallback */
    }
  }

  if (!magicBody) {
    try {
      const local = await composeSellerOutboundMessageAsync(magicPayload, {
        forceFallback: !magicRemoteEnabled,
      });
      if (local?.ok && local.text) {
        magicBody = String(local.text).trim();
        magicWriter = local.writer || 'grounded_fallback';
        magicWarnings = local.grounded?.warnings || [];
      }
    } catch {
      magicBody = null;
    }
  }

  if (magicBody && containsSellerCommandInMessage(magicBody)) {
    magicBody = null;
    magicWriter = null;
  }

  if (!magicBody) {
    import('../admin/leitstand/cleverAdminWarningBridge.js')
      .then(({ logMagicFallbackAdminWarning }) => logMagicFallbackAdminWarning({
        writer: magicWriter,
        warnings: magicWarnings,
        remoteEnabled: magicRemoteEnabled,
      }))
      .catch(() => {});
    return {
      turn,
      magicBody: null,
      magicWriter: null,
      magicWarnings,
      magicRemoteEnabled,
      skipped: false,
      feedback: null,
    };
  }

  import('../admin/leitstand/cleverAdminWarningBridge.js')
    .then(({ logMagicFallbackAdminWarning }) => logMagicFallbackAdminWarning({
      writer: magicWriter,
      warnings: magicWarnings,
      remoteEnabled: magicRemoteEnabled,
    }))
    .catch(() => {});

  return {
    turn: applyMagicBodyToTurn(turn, magicBody),
    magicBody,
    magicWriter,
    magicWarnings,
    magicRemoteEnabled,
    skipped: false,
    feedback: buildMagicProposeFeedback({
      magicWriter,
      magicRemoteEnabled,
      magicWarnings,
    }),
  };
}
