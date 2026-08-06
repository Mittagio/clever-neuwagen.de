/**
 * Optional Intent-Chips – Constraint-Routing + Reset.
 * node src/services/cleverSeller/composerIntentChips.test.js
 */
import assert from 'node:assert/strict';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import { SELLER_FACT_CLASS, SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import {
  COMPOSER_INTENT_CHIPS,
  COMPOSER_INTENT_CONSTRAINT,
  applyIntentConstraintToIntents,
  evaluateRememberDecision,
  normalizeIntentConstraint,
  resetIntentConstraintToDefault,
  resolveAttachmentIntentActions,
  resolveIntentPlaceholder,
} from './composerIntentChips.js';

const lead = {
  id: 'lead-intent-1',
  name: 'Herr Brandes',
  contact: { name: 'Herr Brandes' },
  wish: { paymentType: 'leasing', termMonths: 48, annualMileage: 15000 },
  crm: {
    needProfile: createEmptyNeedProfile(),
    sellerInsights: [],
    customerMessages: [],
  },
};

// --- Config map ---
assert.equal(COMPOSER_INTENT_CHIPS[0].label, 'Clever entscheidet');
assert.equal(COMPOSER_INTENT_CHIPS[0].intentConstraint, null);
assert.ok(COMPOSER_INTENT_CHIPS.some((c) => (
  c.intentConstraint === COMPOSER_INTENT_CONSTRAINT.REMEMBER
)));
assert.equal(
  resolveIntentPlaceholder(COMPOSER_INTENT_CONSTRAINT.REMEMBER, 'Herr Brandes'),
  'Was soll Clever über Herr Brandes merken?',
);
assert.equal(
  resolveIntentPlaceholder(COMPOSER_INTENT_CONSTRAINT.MESSAGE, 'Herr Brandes'),
  'Was möchtest du Herr Brandes schreiben?',
);
assert.equal(normalizeIntentConstraint('auto'), null);
assert.equal(normalizeIntentConstraint('clever_decides'), null);
assert.equal(
  normalizeIntentConstraint(COMPOSER_INTENT_CONSTRAINT.OFFER),
  COMPOSER_INTENT_CONSTRAINT.OFFER,
);

// --- Constraint routing (unit) ---
const mixed = [
  { type: SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT, confidence: 0.9 },
  { type: SELLER_TURN_INTENTS.DRAFT_MESSAGE, confidence: 0.9 },
  { type: SELLER_TURN_INTENTS.PREPARE_OFFER, confidence: 0.9 },
];
const rememberOnly = applyIntentConstraintToIntents(
  mixed,
  COMPOSER_INTENT_CONSTRAINT.REMEMBER,
);
assert.ok(rememberOnly.some((i) => i.type === SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT));
assert.ok(!rememberOnly.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE));
assert.ok(!rememberOnly.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));

const messageOnly = applyIntentConstraintToIntents(
  mixed,
  COMPOSER_INTENT_CONSTRAINT.MESSAGE,
);
assert.ok(messageOnly.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE));
assert.ok(!messageOnly.some((i) => i.type === SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT));
assert.ok(!messageOnly.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));

const offerOnly = applyIntentConstraintToIntents(
  [{ type: SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT, confidence: 0.9 }],
  COMPOSER_INTENT_CONSTRAINT.OFFER,
);
assert.ok(offerOnly.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));
assert.ok(!offerOnly.some((i) => i.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT));

// --- Orchestrator: Merken constraint ---
const rememberTurn = runCleverSellerTurn({
  lead,
  sellerInput: 'er hat zwei Kinder',
  intentConstraint: COMPOSER_INTENT_CONSTRAINT.REMEMBER,
});
assert.ok(rememberTurn.intents.some((i) => i.type === SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT));
assert.ok(!rememberTurn.intents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE));
assert.ok(!rememberTurn.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));
assert.ok(!rememberTurn.intents.some((i) => i.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT));
assert.equal(rememberTurn.intentConstraint, COMPOSER_INTENT_CONSTRAINT.REMEMBER);
assert.equal(rememberTurn.rememberDecision?.mode, 'save_with_undo');

// --- Orchestrator: Nachricht constraint – keine Truth-Mutation-Intents ---
const messageTurn = runCleverSellerTurn({
  lead,
  sellerInput: 'schreib ihm danke für die Rückmeldung',
  intentConstraint: COMPOSER_INTENT_CONSTRAINT.MESSAGE,
});
assert.ok(messageTurn.intents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE));
assert.ok(!messageTurn.intents.some((i) => i.type === SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT));
assert.ok(!messageTurn.autoSent);

// --- Orchestrator: Termin constraint ---
const terminTurn = runCleverSellerTurn({
  lead,
  sellerInput: 'nächsten Dienstag 10 Uhr Probefahrt',
  intentConstraint: COMPOSER_INTENT_CONSTRAINT.APPOINTMENT,
  now: new Date('2026-08-06T09:00:00+02:00').getTime(),
});
assert.ok(terminTurn.intents.some((i) => i.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT));
assert.ok(!terminTurn.autoBooked);

// --- Orchestrator: Suchen – keine Context-Mutation ---
const searchTurn = runCleverSellerTurn({
  lead,
  sellerInput: 'was habe ich ihm zuletzt geschrieben',
  intentConstraint: COMPOSER_INTENT_CONSTRAINT.SEARCH,
});
assert.ok(!searchTurn.intents.some((i) => i.type === SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT));
assert.ok(!searchTurn.intents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE));

// --- Free language ohne Chip bleibt möglich ---
const freeRemember = runCleverSellerTurn({
  lead,
  sellerInput: 'Merk dir, er hat zwei Kinder.',
});
assert.ok(freeRemember.intents.some((i) => i.type === SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT));
assert.equal(freeRemember.intentConstraint, null);

// --- Merken: sensitive → Review ---
const sensitive = evaluateRememberDecision([
  {
    factClass: SELLER_FACT_CLASS.SELF_DISCLOSURE_FACT,
    field: 'monthlyNetIncome',
    value: 2800,
    label: 'Netto 2800',
    confidence: 0.95,
  },
], lead);
assert.equal(sensitive.mode, 'review');
assert.equal(sensitive.reason, 'sensitive_or_business_critical');

const contradictory = evaluateRememberDecision([
  {
    factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
    field: 'childrenCount',
    value: 3,
    label: '3 Kinder',
    confidence: 0.95,
  },
], {
  ...lead,
  crm: {
    ...lead.crm,
    needProfile: {
      ...createEmptyNeedProfile(),
      understoodLabels: ['2 Kinder'],
    },
  },
});
assert.equal(contradictory.mode, 'review');

// --- Reset to default ---
const reset = resetIntentConstraintToDefault();
assert.equal(reset.intentConstraint, null);
assert.equal(reset.id, 'clever_decides');

// --- Attachment actions stub ---
const contractActions = resolveAttachmentIntentActions({
  kind: 'contract_pdf',
  fileName: 'altvertrag-brandes.pdf',
});
assert.equal(contractActions.classification, 'altvertrag');
assert.ok(contractActions.preselect);
assert.ok(contractActions.needsReview);

const offerActions = resolveAttachmentIntentActions({
  kind: 'configurator_pdf',
  fileName: 'leasingangebot.pdf',
});
assert.equal(offerActions.classification, 'offer_pdf');

const scheinActions = resolveAttachmentIntentActions({
  fileName: 'fahrzeugschein-kuga.pdf',
});
assert.equal(scheinActions.classification, 'fahrzeugschein');

console.log('composerIntentChips.test.js: ok');
