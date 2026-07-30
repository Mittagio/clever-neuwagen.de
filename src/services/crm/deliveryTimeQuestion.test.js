/**
 * Epic 3 – Lieferzeit als offene Kundenfrage
 */
import assert from 'node:assert/strict';
import {
  answerDeliveryTimeOnLead,
  buildAnswerDisplay,
  createOpenDeliveryTimeQuestion,
  DELIVERY_TIME_PENDING_PORTAL,
  DELIVERY_TIME_STATUS,
  formatDeliveryTimeAnsweredChip,
  formatDeliveryTimePortalNote,
  getDeliveryTimeQuestion,
  isDeliveryTimeOpen,
  openDeliveryTimeOnLead,
  parseDeliveryTimeAnswerFromText,
} from './deliveryTimeQuestion.js';
import {
  buildCustomerTruthNotepadGroups,
} from './commercialScenarios.js';
import {
  createSportageDualScenarioLead,
} from './sportageDualScenarioCase.js';
import {
  interpretSellerInput,
} from '../cleverSeller/interpretSellerInput.js';
import {
  applyAcceptedSellerTurn,
} from '../cleverSeller/applyAcceptedSellerTurn.js';
import {
  buildCleverSellerTurnResult,
} from '../cleverSeller/cleverSellerTurnResultSchema.js';
import {
  formatDeliveryTimePortalNote as portalNote,
} from './deliveryTimeQuestion.js';

// --- parse seller answer ---
{
  const parsed = parseDeliveryTimeAnswerFromText('Lieferzeit ca. 8–12 Wochen');
  assert.ok(parsed);
  assert.equal(parsed.answerText, '8–12 Wochen');
  assert.equal(parsed.weeksMin, 8);
  assert.equal(parsed.weeksMax, 12);
}

{
  const parsed = parseDeliveryTimeAnswerFromText('Lieferzeit ca. 3 Monate');
  assert.ok(parsed);
  assert.equal(parsed.answerText, '3 Monate');
  assert.equal(parsed.months, 3);
}

{
  assert.equal(parseDeliveryTimeAnswerFromText('Wie ist die Lieferzeit?'), null);
}

// --- open → answered on lead ---
{
  let lead = { id: 'x', crm: { customerTruth: {} } };
  lead = openDeliveryTimeOnLead(lead);
  assert.equal(isDeliveryTimeOpen(lead), true);
  assert.equal(formatDeliveryTimePortalNote(null, lead), DELIVERY_TIME_PENDING_PORTAL);

  lead = answerDeliveryTimeOnLead(lead, {
    answerText: '8–12 Wochen',
    weeksMin: 8,
    weeksMax: 12,
    source: 'seller_input',
  });
  assert.equal(isDeliveryTimeOpen(lead), false);
  assert.equal(getDeliveryTimeQuestion(lead).status, DELIVERY_TIME_STATUS.ANSWERED);
  assert.equal(
    formatDeliveryTimePortalNote(null, lead),
    'Aktuelle Lieferzeit: ungefähr 8–12 Wochen',
  );
  assert.match(formatDeliveryTimeAnsweredChip(getDeliveryTimeQuestion(lead)), /8–12 Wochen/);
}

// --- demo lead starts open ---
{
  const lead = createSportageDualScenarioLead({ phase: 'ready' });
  assert.equal(isDeliveryTimeOpen(lead), true);
  assert.equal(getDeliveryTimeQuestion(lead).status, 'open');
  assert.equal(formatDeliveryTimePortalNote(null, lead), DELIVERY_TIME_PENDING_PORTAL);

  const groups = buildCustomerTruthNotepadGroups(lead);
  assert.ok(groups.open.some((c) => /Lieferzeit beantworten/i.test(c.label)));
  assert.ok(!groups.vehicle.some((c) => /Lieferzeit ca\./i.test(c.label)));
}

// --- answer clears OFFEN, shows answered chip ---
{
  let lead = createSportageDualScenarioLead({ phase: 'ready' });
  lead = answerDeliveryTimeOnLead(lead, {
    answerText: '8–12 Wochen',
    weeksMin: 8,
    weeksMax: 12,
    source: 'seller_input',
  });
  const groups = buildCustomerTruthNotepadGroups(lead);
  assert.equal(groups.open.length, 0);
  assert.ok(groups.vehicle.some((c) => /Lieferzeit ca\. 8–12 Wochen/i.test(c.label)));
  assert.equal(
    formatDeliveryTimePortalNote(null, lead),
    'Aktuelle Lieferzeit: ungefähr 8–12 Wochen',
  );
}

// --- seller interpret + accept path ---
{
  const lead = createSportageDualScenarioLead({ phase: 'ready' });
  const interpreted = interpretSellerInput('Lieferzeit ca. 8-12 Wochen', { lead });
  const answerFact = interpreted.facts.find((f) => f.field === 'deliveryTimeAnswer');
  assert.ok(answerFact, 'deliveryTimeAnswer fact expected');
  assert.match(answerFact.label, /8.?12 Wochen/i);
  assert.equal(answerFact.value.open, false);

  const turn = buildCleverSellerTurnResult({
    ok: true,
    extractedFacts: interpreted.facts,
    interpretedInput: { raw: 'Lieferzeit ca. 8-12 Wochen', normalized: 'Lieferzeit ca. 8-12 Wochen' },
  });
  const applied = applyAcceptedSellerTurn(lead, turn, { sellerId: 'seller-1', postFeedCard: false });
  assert.equal(applied.ok, true);
  assert.equal(isDeliveryTimeOpen(applied.lead), false);
  assert.equal(
    portalNote(null, applied.lead),
    'Aktuelle Lieferzeit: ungefähr 8–12 Wochen',
  );
  assert.equal(applied.lead.crm.customerTruth.deliveryTimeQuestion.source, 'seller_input');
}

// --- display helper ---
{
  assert.equal(buildAnswerDisplay('ca. 10 Wochen'), 'Aktuelle Lieferzeit: ungefähr 10 Wochen');
  assert.equal(createOpenDeliveryTimeQuestion().status, 'open');
}

console.log('deliveryTimeQuestion.test.js: OK');
