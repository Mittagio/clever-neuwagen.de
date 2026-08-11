/**
 * Golden Case: Offer Intent vor Kundennachricht
 * node src/services/cleverSeller/brandesOfferMagic.golden.test.js
 */
import assert from 'node:assert/strict';
import { createBrandesGoldenCaseLead } from '../crm/brandesGoldenCase.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { parseMagicOfferIntent } from '../dealer/magicOfferIntentParser.js';
import { groundMagicOfferIntent } from '../dealer/magicOfferGrounding.js';
import { prepareMagicOffer } from '../dealer/magicOfferService.js';
import { MAGIC_DECISION } from '../dealer/magicOfferDecision.js';
import { enrichOfferTextWithCustomerWish } from '../dealer/sellerOfferAssistFlow.js';
import {
  containsSellerCommandInMessage,
  validateCustomerMessageNotSellerCommand,
} from './validateSellerCommandMessage.js';

const INPUT = 'Erstell Herrn Brandes ein Angebot für einen XCeed Core Automatik mit 13 % Rabatt.';
const INPUT_COR = 'XCeed COR Automatik 13 %';

// --- 1. Core / COR + Automatik, keine MT ---
{
  for (const text of [INPUT, INPUT_COR, 'XCeed Core Ausstattung Automatik']) {
    const intent = parseMagicOfferIntent(text);
    assert.equal(intent.vehicleRequest.trimHint, 'core', `trim for: ${text}`);
    assert.equal(intent.vehicleRequest.transmissionRequirement, 'automatic');
    const grounded = groundMagicOfferIntent(intent, { modelKey: 'xceed' });
    assert.equal(grounded.ok, true, `ground ok: ${text}`);
    assert.equal(grounded.grounded.trimId, 'core');
    assert.equal(grounded.grounded.variantId, 'xceed-core-dct');
    assert.match(grounded.grounded.engineLabel, /Automatik|DCT/i);
    assert.ok(!/Schaltgetriebe|\bMT\b/i.test(grounded.grounded.engineLabel || ''));
  }
}

// --- 2. Customer Truth übernommen, keine erneute Frage Laufzeit/km/AZ ---
{
  const lead = createBrandesGoldenCaseLead({ phase: 'golden' });
  const enriched = enrichOfferTextWithCustomerWish(lead, INPUT);
  assert.match(enriched, /Leasing/i);
  assert.match(enriched, /48\s*Monate/i);
  assert.match(enriched, /15\.000|15000/i);

  const turn = runCleverSellerTurn({
    lead,
    sellerInput: INPUT,
    customerName: 'Herr Brandes',
  });
  assert.ok(!turn.missingInformation.some((m) => /laufzeit|kilometer|anzahlung|sonderzahlung/i.test(m.label || '')));
  assert.equal(turn.usedCustomerContext?.termMonths, 48);
  assert.equal(turn.usedCustomerContext?.annualMileage, 15000);
  assert.equal(turn.usedCustomerContext?.downPayment, 0);
}

// --- 3. Keine Rate → unvollständig, keine fertige Kundennachricht ---
{
  const lead = createBrandesGoldenCaseLead({ phase: 'golden' });
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: INPUT,
    customerName: 'Herr Brandes',
  });
  assert.ok(turn.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));
  const offer = turn.preparedActions.find((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER);
  assert.ok(offer);
  assert.equal(offer.payload.canCreateOffer, false);
  assert.match(offer.payload.vehicleLabel || '', /XCeed/i);
  assert.match(offer.payload.vehicleLabel || '', /Core/i);
  assert.match(offer.payload.vehicleLabel || '', /Automatik/i);
  assert.ok(!/Schalt|MT/i.test(offer.payload.engineLabel || ''));
  assert.ok(turn.missingInformation.some((m) => m.id === 'monthly_leasing_rate'));

  assert.ok(shouldShowUniversalReview(turn));
  const review = buildUniversalReviewModel(turn);
  // Compact Offer-Review-Titel (Clever 2.0) – Review bleibt Pflicht bei incomplete prep
  assert.match(review.title, /prüft|verstanden|vorbereitet|angebot/i);
  assert.ok(review.actionSections.some((s) => s.kind === 'offer_incomplete' || s.kind === 'offer_prepare'));
  assert.doesNotMatch(String(review.hero?.eyebrow || ''), /unvollständig/i);
  assert.doesNotMatch(String(review.summaryLine || ''), /unvollständig|Rate oder Bank-PDF/i);
  const incompleteSec = review.actionSections.find((s) => (
    s.kind === 'offer_incomplete' || s.kind === 'offer_prepare'
  ));
  assert.ok(incompleteSec?.primaryActions?.some((a) => a.action === 'open_offer_handoff'));
  assert.ok(incompleteSec?.primaryActions?.some((a) => a.action === 'upload_pdf'));
  assert.ok(!review.actionSections.some((s) => s.kind === 'message_draft'));
  assert.ok(
    !containsSellerCommandInMessage(turn.messageDraft || ''),
    'kein Seller-Befehl in Draft',
  );
  if (turn.messageDraft) {
    assert.match(turn.messageDraft, /vorbereite|Kalkulation/i);
    assert.ok(!/Erstell/i.test(turn.messageDraft));
  }
}

// --- 4. Verifizierte Rate → Angebot prepared (Nachricht nur mit Schreib-Cue) ---
{
  const lead = createBrandesGoldenCaseLead({ phase: 'golden' });
  const withRate = `${INPUT} 329 Euro / Monat`;
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: withRate,
    customerName: 'Herr Brandes',
  });
  const offer = turn.preparedActions.find((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER);
  assert.equal(offer?.payload?.canCreateOffer, true);
  assert.ok(
    !turn.preparedActions.some((a) => (
      a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE && a.status === 'prepared'
    )),
    'ohne „schreib …“ keine Kundennachricht',
  );

  const turnWrite = runCleverSellerTurn({
    lead,
    sellerInput: `Schreib ihm: ${withRate}`,
    customerName: 'Herr Brandes',
  });
  assert.ok(turnWrite.messageDraft);
  assert.ok(validateCustomerMessageNotSellerCommand(turnWrite.messageDraft).ok);
  assert.match(turnWrite.messageDraft, /Hallo Herr Brandes|XCeed|Angebot/i);
  assert.ok(!containsSellerCommandInMessage(turnWrite.messageDraft));
}

// --- 5. Validator lehnt Seller-Befehl ab ---
{
  assert.equal(
    validateCustomerMessageNotSellerCommand(
      'Bezugnehmend auf XCeed:\nErstell dem Kunden ein XCeed Angebot.',
    ).ok,
    false,
  );
  assert.equal(
    validateCustomerMessageNotSellerCommand(
      'Hallo Herr Brandes,\n\nanbei das Angebot für den Kia XCeed Core.\n\nViele Grüße',
    ).ok,
    true,
  );
}

// --- 6. Mehrere Automatikvarianten → gezielte Rückfrage ---
{
  const intent = parseMagicOfferIntent('XCeed Automatik 13%');
  // ohne Core: vision-dct + core-dct + spirit + gt möglich
  intent.vehicleRequest.trimHint = null;
  const grounded = groundMagicOfferIntent(intent, { modelKey: 'xceed' });
  assert.equal(grounded.ok, false);
  assert.equal(grounded.reason, 'ambiguous_automatic_variant');
  assert.match(grounded.message, /Welche Automatikvariante/i);
  assert.ok((grounded.suggestions || []).length >= 2);
}

// --- 7. Barkauf explizit → UPE minus 13 % ---
{
  const cash = prepareMagicOffer(
    'Barkauf XCeed Core Automatik mit 13 % Rabatt',
    { modelKey: 'xceed' },
  );
  assert.equal(cash.intent.offerType, 'purchase');
  assert.equal(cash.decision.action, MAGIC_DECISION.CALCULATE_CASH);
  assert.equal(cash.canCreateOffer, true);
  assert.equal(cash.grounded.variantId, 'xceed-core-dct');
  assert.ok(cash.calculation?.endPrice != null);
  const expectedVehicle = Number((28990 * (1 - 0.13)).toFixed(2));
  assert.equal(cash.calculation.vehiclePrice, expectedVehicle);
}

// --- 8. Leasing-Auftrag → keine Barkaufnachricht ---
{
  const lead = createBrandesGoldenCaseLead({ phase: 'golden' });
  const interpreted = interpretSellerInput(INPUT, { lead });
  assert.ok(interpreted.facts.some((f) => f.field === 'discountPercent' && f.value === 13));
  const turn = runCleverSellerTurn({ lead, sellerInput: INPUT, customerName: 'Herr Brandes' });
  const offer = turn.preparedActions.find((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER);
  assert.ok(offer?.payload?.missingRate || offer?.payload?.canCreateOffer === false);
  assert.ok(!/Kaufpreis liegt bei|Barkauf/i.test(turn.messageDraft || ''));
}

console.log('brandesOfferMagic.golden.test.js: ok');
