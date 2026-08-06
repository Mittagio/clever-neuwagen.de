/**
 * Optional Intent-Chips – Constraint-Routing + UI-Hierarchie.
 * node src/services/cleverSeller/composerIntentChips.test.js
 */
import assert from 'node:assert/strict';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import { SELLER_FACT_CLASS, SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import {
  COMPOSER_INTENT_CHIPS,
  COMPOSER_INTENT_CONSTRAINT,
  COMPOSER_INTENT_MORE_CHIPS,
  COMPOSER_INTENT_PRIMARY_CHIPS,
  applyIntentConstraintToIntents,
  evaluateRememberDecision,
  normalizeIntentConstraint,
  resetIntentConstraintToDefault,
  resolveAttachmentIntentActions,
  resolveIntentComposerLabels,
  resolveIntentPlaceholder,
  resolveIntentSecondaryActions,
  resolveVisiblePrimaryIntentChips,
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

// --- Config map / Hauptzeile ---
assert.equal(COMPOSER_INTENT_CHIPS[0].label, 'Clever');
assert.equal(COMPOSER_INTENT_CHIPS[0].intentConstraint, null);
assert.deepEqual(
  COMPOSER_INTENT_PRIMARY_CHIPS.map((c) => c.label),
  ['Clever', 'Merken', 'Nachricht', 'Angebot'],
);
assert.deepEqual(
  COMPOSER_INTENT_MORE_CHIPS.map((c) => c.label),
  ['Termin', 'Suchen', 'Dokumente', 'Inzahlungnahme', 'Aufgabe / Wiedervorlage'],
);
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

// --- Sichtbare Hauptzeile: feste Reihenfolge (Clever bleibt sichtbar) ---
const afterMerken = resolveVisiblePrimaryIntentChips('merken');
assert.equal(afterMerken[0].id, 'clever_decides');
assert.ok(afterMerken.some((c) => c.id === 'merken'));
assert.deepEqual(
  afterMerken.map((c) => c.label),
  ['Clever', 'Merken', 'Nachricht', 'Angebot'],
);

// --- Modus-Labels ---
const merkenLabels = resolveIntentComposerLabels(
  COMPOSER_INTENT_CONSTRAINT.REMEMBER,
  'Herr Brandes',
);
assert.equal(merkenLabels.label, 'Merken · Für Herr Brandes');
assert.equal(merkenLabels.sendLabel, 'Für Herr Brandes merken');
const msgLabels = resolveIntentComposerLabels(
  COMPOSER_INTENT_CONSTRAINT.MESSAGE,
  'Herr Brandes',
);
assert.equal(msgLabels.label, 'Nachricht · An Herr Brandes');
assert.equal(msgLabels.sendLabel, 'Entwurf erstellen');
const offerLabels = resolveIntentComposerLabels(
  COMPOSER_INTENT_CONSTRAINT.OFFER,
  'Herr Brandes',
);
assert.equal(offerLabels.label, 'Angebot · Für Herr Brandes');
assert.equal(offerLabels.sendLabel, 'Angebot vorbereiten');
assert.equal(
  resolveIntentComposerLabels(null, 'Herr Brandes').sendAriaLabel,
  'Clever ausführen',
);

// --- Sekundäraktionen / Quick Actions ---
const cleverSecondary = resolveIntentSecondaryActions(null, { customerName: 'Herr Brandes' });
assert.deepEqual(cleverSecondary, [], 'Clever-Default: keine Secondary neben Merken');
assert.ok(!cleverSecondary.some((a) => /merken/i.test(a.label)));
const rememberSecondary = resolveIntentSecondaryActions(COMPOSER_INTENT_CONSTRAINT.REMEMBER);
assert.deepEqual(
  rememberSecondary.map((a) => a.label),
  [
    'Kundeninfo',
    'Fahrzeugwunsch',
    'Budget & Konditionen',
    'Bestandsfahrzeug / Inzahlungnahme',
    'Ausstattung & Technik',
    'Persönliche Notiz',
  ],
);
assert.equal(rememberSecondary[0].memoryCategory, 'customer_info');
const msgSecondary = resolveIntentSecondaryActions(
  COMPOSER_INTENT_CONSTRAINT.MESSAGE,
  { customerName: 'Herr Brandes' },
);
assert.ok(msgSecondary.some((a) => a.label === 'Unterlagen anfordern'));
assert.ok(msgSecondary.some((a) => a.messagePurpose === 'request_documents'));
assert.ok(msgSecondary.some((a) => a.label === 'Nachfassen'));
const msgDocsFirst = resolveIntentSecondaryActions(
  COMPOSER_INTENT_CONSTRAINT.MESSAGE,
  { customerName: 'Herr Brandes', missingDocuments: true },
);
assert.equal(msgDocsFirst[0].id, 'msg_docs');
const offerSecondary = resolveIntentSecondaryActions(COMPOSER_INTENT_CONSTRAINT.OFFER);
assert.deepEqual(
  offerSecondary.map((a) => a.label),
  [
    'Neues Angebot',
    'Vorhandenes ändern',
    'PDF einlesen',
    'Angebote vergleichen',
    'Kundenangebot zusammenstellen',
  ],
);
const offerChangeFirst = resolveIntentSecondaryActions(
  COMPOSER_INTENT_CONSTRAINT.OFFER,
  { hasOpenOffer: true },
);
assert.equal(offerChangeFirst[0].id, 'offer_change');
assert.deepEqual(
  resolveIntentSecondaryActions(COMPOSER_INTENT_CONSTRAINT.APPOINTMENT),
  [],
  'Mehr-Untermodi: keine dritte Ebene',
);
assert.deepEqual(
  resolveIntentSecondaryActions(COMPOSER_INTENT_CONSTRAINT.SEARCH),
  [],
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

const docsOnly = applyIntentConstraintToIntents(
  mixed,
  COMPOSER_INTENT_CONSTRAINT.DOCUMENTS,
);
assert.ok(docsOnly.some((i) => i.type === SELLER_TURN_INTENTS.REQUEST_DOCUMENTS));

const tradeOnly = applyIntentConstraintToIntents(
  mixed,
  COMPOSER_INTENT_CONSTRAINT.TRADE_IN,
);
assert.ok(tradeOnly.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_TRADE_IN));

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

const docsMessageTurn = runCleverSellerTurn({
  lead,
  sellerInput: 'Unterlagen anfordern',
  intentConstraint: COMPOSER_INTENT_CONSTRAINT.MESSAGE,
  messagePurpose: 'request_documents',
});
assert.ok(docsMessageTurn.intents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE));
assert.ok(docsMessageTurn.intents.some((i) => i.type === SELLER_TURN_INTENTS.REQUEST_DOCUMENTS));
assert.equal(docsMessageTurn.messagePurpose, 'request_documents');
assert.ok(!docsMessageTurn.intents.some((i) => i.type === SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT));
assert.ok(!docsMessageTurn.autoSent);

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

// --- Merken Golden: Kinder · Präferenz · Ausstattung · muss → save_with_undo ---
{
  const merkenInput = 'Merk dir: zwei Kinder, Grau, Automatik, Totwinkel und Spurhalteassistent müssen drin sein.';
  const merkenTurn = runCleverSellerTurn({
    lead: {
      id: 'lead-merken-golden',
      name: 'Kai Drechsel',
      crm: { needProfile: createEmptyNeedProfile(), sellerInsights: [] },
    },
    sellerInput: merkenInput,
    intentConstraint: COMPOSER_INTENT_CONSTRAINT.REMEMBER,
  });
  const fields = (merkenTurn.extractedFacts || []).map((f) => f.field);
  assert.ok(fields.includes('childrenCount'), 'Kinder extrahiert');
  assert.ok(fields.includes('colorPreference'), 'Grau extrahiert');
  assert.ok(fields.includes('transmissionPreference'), 'Automatik extrahiert');
  assert.ok(
    (merkenTurn.extractedFacts || []).some((f) => f.field === 'equipmentWish' && /Totwinkel/i.test(f.label)),
    'Totwinkel extrahiert',
  );
  assert.ok(
    (merkenTurn.extractedFacts || []).some((f) => f.field === 'equipmentWish' && /Spurhalte/i.test(f.label)),
    'Spurhalte extrahiert',
  );
  assert.ok(
    (merkenTurn.extractedFacts || []).filter((f) => f.field === 'equipmentWish')
      .every((f) => f.value?.priority === 'required' || /·\s*muss/i.test(f.label)),
    'Equipment-Priorität required',
  );
  assert.equal(merkenTurn.rememberDecision?.mode, 'save_with_undo', 'kompakt merken ohne Review');
}

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
assert.equal(reset.label, 'Clever');

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
