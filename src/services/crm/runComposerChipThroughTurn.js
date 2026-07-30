/**
 * Chip-/Shortcut-Einstieg über den zentralen Clever Seller Turn.
 * Legacy-Suggestion bleibt Fallback, wenn der Turn nichts Brauchbares liefert.
 */
import { runCleverSellerTurn } from '../cleverSeller/runCleverSellerTurn.js';
import { shouldShowUniversalReview } from '../cleverSeller/buildUniversalReviewModel.js';
import { SELLER_TURN_INTENTS } from '../cleverSeller/sellerFactTypes.js';
import { INLINE_RESULT_TYPES } from '../dealer/sellerInlineComposerAssist.js';
import {
  buildChipSellerInput,
  buildComposerSuggestionAssist,
} from './composerSuggestionService.js';

/**
 * @param {object} params
 * @returns {{
 *   ok: boolean,
 *   mode: 'universal_review'|'assist'|'legacy_suggestion'|'empty',
 *   turn: object|null,
 *   assist: object|null,
 *   sellerInput: string|null,
 * }}
 */
export function runComposerChipThroughTurn({
  lead = {},
  chipId = '',
  customerName = '',
  workingContextItems = [],
  currentOfferContext = null,
} = {}) {
  const sellerInput = buildChipSellerInput(chipId, { customerName });
  if (!sellerInput) {
    return {
      ok: false,
      mode: 'empty',
      turn: null,
      assist: null,
      sellerInput: null,
    };
  }

  const turn = runCleverSellerTurn({
    lead,
    sellerInput,
    customerName,
    workingContextItems,
    currentOfferContext,
  });

  if (shouldShowUniversalReview(turn)) {
    return {
      ok: true,
      mode: 'universal_review',
      turn,
      assist: null,
      sellerInput,
    };
  }

  const history = turn.preparedActions?.find(
    (a) => a.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY && a.legacy?.ok,
  );
  if (history?.legacy) {
    return {
      ok: true,
      mode: 'assist',
      turn,
      assist: history.legacy,
      sellerInput,
    };
  }

  const offer = turn.preparedActions?.find(
    (a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER && a.legacy?.ok,
  );
  if (offer?.legacy) {
    return {
      ok: true,
      mode: 'assist',
      turn,
      assist: offer.legacy,
      sellerInput,
    };
  }

  const appointment = turn.preparedActions?.find(
    (a) => a.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT && a.legacy?.ok,
  );
  if (appointment?.legacy) {
    return {
      ok: true,
      mode: 'assist',
      turn,
      assist: appointment.legacy,
      sellerInput,
    };
  }

  const draft = turn.preparedActions?.find(
    (a) => a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE,
  );
  const messageBody = turn.messageDraft || draft?.payload?.messageDraft || null;
  if (messageBody) {
    return {
      ok: true,
      mode: 'assist',
      turn,
      assist: {
        ok: true,
        mode: 'write',
        results: [{
          type: INLINE_RESULT_TYPES.MESSAGE_DRAFT,
          title: '✨ Clever hat vorbereitet',
          body: messageBody,
          draft: { body: messageBody, channel: 'preferred' },
          primaryCta: 'Senden',
          secondaryCta: 'Bearbeiten',
        }],
      },
      sellerInput,
    };
  }

  if (turn.preparedActions?.some((a) => a.type === SELLER_TURN_INTENTS.SEND_PORTFOLIO)) {
    const legacy = buildComposerSuggestionAssist(lead, 'kundenlink', { customerName });
    return {
      ok: legacy.ok,
      mode: legacy.ok ? 'legacy_suggestion' : 'empty',
      turn,
      assist: legacy.ok ? legacy : null,
      sellerInput,
    };
  }

  const legacy = buildComposerSuggestionAssist(lead, chipId, { customerName });
  return {
    ok: legacy.ok,
    mode: legacy.ok ? 'legacy_suggestion' : 'empty',
    turn,
    assist: legacy.ok ? legacy : null,
    sellerInput,
  };
}
