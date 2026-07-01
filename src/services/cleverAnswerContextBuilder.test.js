/**
 * Clever Antworten – Kontext & Entwürfe
 */
import assert from 'node:assert/strict';
import {
  buildCleverAnswerContext,
  suggestCleverAnswerType,
} from './cleverAnswerContextBuilder.js';
import {
  generateCleverAnswerDraft,
  getCleverAnswerTypeLabel,
} from './cleverAnswerDraftService.js';

const ev9Group = {
  id: 'osg-1',
  modelKey: 'ev9',
  modelLabel: 'Kia EV9',
  wishConditions: {
    paymentType: 'leasing',
    termMonths: 48,
    mileagePerYear: 15000,
    downPayment: 1000,
  },
  variants: [
    { id: 'v1', trimLabel: 'Air', calculatedRate: 699 },
    { id: 'v2', trimLabel: 'Earth', calculatedRate: 749 },
    { id: 'v3', trimLabel: 'GT-Line', calculatedRate: 899 },
  ],
};

const lead = {
  id: 'lead-ev9',
  contact: { name: 'Max Mustermann', salutation: 'herr', phone: '01701234567', email: 'max@test.de' },
  crm: {
    kundenhelfer: { notes: '2 Kinder, Hund, Reichweite wichtig' },
    customerOfferInteractions: {
      'card-1': {
        offerId: 'card-1',
        interestStatus: 'opened',
        openedAt: new Date().toISOString(),
        customerQuestions: [
          { id: 'q1', text: 'Winterreifen dabei?', status: 'open' },
        ],
      },
    },
    cleverUnterlagen: {
      items: {
        ausweis: { status: 'open' },
        gehaltsnachweis: { status: 'open' },
        selbstauskunft: { status: 'open' },
      },
    },
  },
};

const vehicleCards = [{
  id: 'card-1',
  modelName: 'EV9',
  modelKey: 'ev9',
  paymentType: 'leasing',
  vehicleOffer: { status: 'opened' },
}];

const ctx = buildCleverAnswerContext({
  lead,
  customerName: 'Max Mustermann',
  phone: '01701234567',
  email: 'max@test.de',
  vehicleCards,
  offerSelectionGroups: [ev9Group],
  kundenhelferNotes: '2 Kinder, Hund, Reichweite wichtig',
  wishPaymentType: 'leasing',
});

assert.ok(ctx.previewLines.length >= 3, 'Kontext-Vorschau vorhanden');
assert.ok(ctx.previewLines.some((line) => /EV9/i.test(line)), 'EV9 in Vorschau');
assert.ok(ctx.previewLines.some((line) => /48 Monate/i.test(line)), 'Konditionen in Vorschau');
assert.ok(ctx.previewLines.some((line) => /geöffnet/i.test(line)), 'Geöffnet in Vorschau');
assert.equal(ctx.openCustomerQuestions.length, 1);
assert.equal(suggestCleverAnswerType(ctx), 'kundenfrage');

const angebotText = generateCleverAnswerDraft({
  intentId: 'offer_send',
  context: ctx,
  tone: 'freundlich',
  channel: 'whatsapp',
});
assert.match(angebotText, /EV9/i);
assert.match(angebotText, /Air|Earth|GT-Line/);
assert.match(angebotText, /48 Monate|15\.000 km|1\.000 €/);
assert.match(angebotText, /699.*899|Raten/i);

const frageText = generateCleverAnswerDraft({
  intentId: 'answer_customer_question',
  context: ctx,
  channel: 'whatsapp',
  dictation: 'Winterreifen sind nicht drin, kann ich aber anbieten.',
});
assert.match(frageText, /Winterreifen/i);
assert.match(frageText, /nicht drin|anbieten/i);

const unterlagenText = generateCleverAnswerDraft({
  intentId: 'request_documents',
  context: ctx,
  channel: 'email',
});
assert.match(unterlagenText, /Unterlagen/i);
assert.match(unterlagenText, /Ausweis/i);
assert.match(unterlagenText, /Gehaltsnachweis/i);

const nachfassenText = generateCleverAnswerDraft({
  intentId: 'offer_opened_followup',
  context: ctx,
  channel: 'whatsapp',
});
assert.match(nachfassenText, /angeschaut haben/i);

const emptyCtx = buildCleverAnswerContext({ customerName: 'Test' });
const emptyAngebot = generateCleverAnswerDraft({
  intentId: 'offer_send',
  context: emptyCtx,
  channel: 'whatsapp',
});
assert.match(emptyAngebot, /bereite.*vor/i);

const smsText = generateCleverAnswerDraft({
  intentId: 'offer_send',
  context: ctx,
  channel: 'sms',
  tone: 'kurz',
});
assert.ok(smsText.length < angebotText.length + 40);

assert.equal(getCleverAnswerTypeLabel('offer_send'), 'Angebot senden');

console.log('cleverAnswerContextBuilder.test.js: ok');
