/**
 * Orchestrierung: Clever-Modus → prepare_offer vor Message-Template
 */
import assert from 'node:assert/strict';
import { detectSellerActionIntent, SELLER_ACTION_INTENTS } from '../dealer/sellerActionIntent.js';
import { detectSellerTurnIntents } from './interpretSellerInput.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { COMPOSER_INTENT_CONSTRAINT } from './composerIntentChips.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Primärbug: „Ev 2 Angebot …“ war Default-Nachricht (≥12 Zeichen)
assert.equal(
  detectSellerActionIntent('Ev 2 Angebot Air in weiß'),
  SELLER_ACTION_INTENTS.PREPARE_OFFER,
);
assert.equal(
  detectSellerActionIntent('EV2 Air in weiß'),
  SELLER_ACTION_INTENTS.PREPARE_OFFER,
);

// Bestand dem Kunden sagen bleibt Nachricht
assert.equal(
  detectSellerActionIntent('Ich habe einen EV3 GT-Line in Schwarzmetallic sofort verfügbar'),
  SELLER_ACTION_INTENTS.MESSAGE_CUSTOMER,
);

const freeIntents = detectSellerTurnIntents('EV2 Angebot Air in weiß', []);
assert.ok(freeIntents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));
assert.ok(
  !freeIntents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE),
  'freier Clever: kein DRAFT_MESSAGE nur wegen „Angebot“',
);

const msgIntents = detectSellerTurnIntents('Schreib ihm EV2 Angebot Air in weiß', []);
assert.ok(msgIntents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE));

const lead = {
  id: 'lead-patrick',
  contact: { name: 'Patrick Budde' },
  paymentType: 'leasing',
  wish: { termMonths: 36, mileagePerYear: 15000, downPayment: 4500 },
  crm: {
    vehicleConfigurations: [{
      id: 'vc-ev9',
      modelKey: 'ev9',
      model: 'EV9',
      trimLabel: 'Long Range',
      paymentType: 'leasing',
    }],
  },
};

const turnFree = runCleverSellerTurn({
  lead,
  sellerInput: 'EV2 Angebot Air in weiß',
  customerName: 'Patrick Budde',
  intentConstraint: null,
});
assert.ok(turnFree.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));
assert.ok(
  !turnFree.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE && a.status === 'prepared'
  )),
  'kein Message-Draft im freien Clever-Modus',
);

const turnMsg = runCleverSellerTurn({
  lead,
  sellerInput: 'EV2 Angebot Air in weiß',
  customerName: 'Patrick Budde',
  intentConstraint: COMPOSER_INTENT_CONSTRAINT.MESSAGE,
});
assert.ok(turnMsg.intents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE));

const turnOfferChip = runCleverSellerTurn({
  lead,
  sellerInput: 'EV2 Angebot Air in weiß',
  customerName: 'Patrick Budde',
  intentConstraint: COMPOSER_INTENT_CONSTRAINT.OFFER,
});
assert.ok(turnOfferChip.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));

const writerSrc = readFileSync(
  join(__dirname, '../crm/magic/generateCleverCustomerMessage.js'),
  'utf8',
);
assert.ok(
  !writerSrc.includes('Gerne schicke ich Ihnen noch Bilder und die genauen Fahrzeugdaten'),
  'kein generischer Bilder-else',
);

console.log('offerOrchestration.intent.test.js: ok');
