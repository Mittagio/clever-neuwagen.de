/**
 * node src/services/cleverSeller/quietIntakeReview.test.js
 */
import assert from 'node:assert/strict';
import {
  applyQuietIntakeSubtaskResult,
  INTAKE_PROTOCOL_PHRASE_RE,
  isQuietIntakeReview,
  isQuietIntakeTurn,
  resolveQuietIntakeSuggestChips,
} from './quietIntakeReview.js';
import {
  buildComposerTaskTitle,
  buildPhoneAddedMicroConfirm,
} from './composerSurfaceState.js';
import {
  buildInboundLeadReviewModel,
  buildIntakeModelChoiceChips,
  buildIntakeNextActions,
  INTAKE_NEXT_ACTION_MAX,
} from './inboundLeadIntake.js';

assert.equal(isQuietIntakeReview({
  reviewType: 'customer_intake_review',
  title: '',
  progressLines: [],
}), true);
assert.equal(isQuietIntakeReview({
  kind: 'multi_source_intake',
  reviewType: 'customer_contract_tradein_intake_review',
}), true);
assert.equal(isQuietIntakeReview({ quietIntake: true }), true);
assert.equal(isQuietIntakeReview({ reviewType: 'offer_prepare' }), false);

assert.equal(isQuietIntakeTurn({ inboundLead: { detected: true } }), true);
assert.equal(isQuietIntakeTurn({ multiSourceIntake: { detected: true } }), true);
assert.equal(isQuietIntakeTurn({ reviewModel: { kind: 'customer_intake' } }), true);
assert.equal(isQuietIntakeTurn({ messageDraft: 'Hallo' }), false);

const protocolSamples = [
  '✓ Seller-Dump und Dokument zusammengeführt',
  'Clever sucht in Ihren Kunden …',
  'Clever wertet aus …',
  'Clever hat erkannt',
  'Clever hat eine Anfrage erkannt',
  '○ Erkannt als neue Anfrage – Kundenakte anlegen?',
  'Clever hat einen Beratungsfall erkannt',
];
for (const sample of protocolSamples) {
  assert.ok(INTAKE_PROTOCOL_PHRASE_RE.test(sample), sample);
}

assert.ok(!INTAKE_PROTOCOL_PHRASE_RE.test('Kundenakte anlegen & weitermachen'));
assert.ok(!INTAKE_PROTOCOL_PHRASE_RE.test('Matthias Wittig · neue Kundenakte'));
assert.ok(!INTAKE_PROTOCOL_PHRASE_RE.test('Von Clever erkannt'));

// Freeze: Task-Titel = Aktionsverb · Name
assert.equal(
  buildComposerTaskTitle({ kind: 'phone_add', name: 'Matthias Wittig' }),
  'TELEFON ERGÄNZEN · Matthias Wittig',
);
assert.equal(
  buildComposerTaskTitle({ kind: 'model_fix', name: 'Matthias Wittig' }),
  'MODELL KORRIGIEREN · Matthias Wittig',
);

// --- Wittig UI-Golden: Briefing statt Fact-Chips / Review ---
{
  const inbound = {
    detected: true,
    proposeCreateCustomer: true,
    resolutionStatus: 'none',
    contact: {
      fullName: 'Matthias Wittig',
      email: 'm.wittig@wittig.de',
    },
  };
  const turn = {
    inboundLead: inbound,
    extractedFacts: [
      {
        field: 'vehicleInterest',
        label: 'Kia EV2 Earth',
        value: { make: 'Kia', model: 'EV2', trim: 'Earth' },
        confidence: 0.95,
        needsConfirmation: false,
      },
      { field: 'paymentType', label: 'Leasing', value: 'leasing', confidence: 0.9 },
      { field: 'termMonths', label: '48 Monate', value: 48, confidence: 0.92 },
      { field: 'annualMileage', label: '12.500 km', value: 12500, confidence: 0.92 },
      { field: 'downPayment', label: '5.000 €', value: 5000, confidence: 0.9 },
      {
        field: 'city',
        label: '73614 Schorndorf',
        value: { postalCode: '73614', city: 'Schorndorf' },
        confidence: 0.9,
      },
      {
        field: 'street',
        label: 'Hauptstraße 12-3',
        value: 'Hauptstraße 12-3',
        confidence: 0.9,
      },
      { field: 'postalCode', label: '73614', value: '73614', confidence: 0.9 },
    ],
  };

  const actions = buildIntakeNextActions(inbound, turn);
  assert.ok(actions.length <= INTAKE_NEXT_ACTION_MAX);
  assert.ok(actions.some((a) => a.id === 'qi_phone'));
  assert.ok(actions.some((a) => a.id === 'qi_offer'));
  assert.ok(!actions.some((a) => a.id === 'qi_model'), 'kein Modell prüfen bei high-confidence');
  assert.ok(!actions.some((a) => a.id === 'qi_note' || /notiz/i.test(a.label || '')));

  const phoneAction = actions.find((a) => a.id === 'qi_phone');
  const offerAction = actions.find((a) => a.id === 'qi_offer');
  assert.equal(phoneAction?.important, true);
  assert.equal(phoneAction?.weight, 'important');
  assert.equal(offerAction?.secondary, true, 'Angebot secondary while Telefon fehlt');
  assert.equal(offerAction?.important, false);
  assert.equal(offerAction?.weight, 'secondary');
  assert.notEqual(
    phoneAction?.weight,
    offerAction?.weight,
    'Telefon und Angebot nicht gleichgewichtig',
  );

  // Keine doppelten Suggest-CTAs unter der Karte (Telefon/Angebot sitzen auf der Karte)
  const chips = resolveQuietIntakeSuggestChips(turn);
  assert.equal(chips.length, 0, 'keine Toolbar-Chips bei Soft Need ohne Unsicherheit');

  const review = buildInboundLeadReviewModel(inbound, turn);
  assert.equal(review.hero?.name, 'Matthias Wittig');
  assert.ok(!/neue Kundenakte/i.test(review.hero?.name || ''));
  assert.equal(review.hero?.subtitle, null);
  assert.equal(review.briefingPresenter, true);
  assert.equal(review.primaryCta, 'Angebot vorbereiten');
  assert.equal(review.secondaryCta, null);
  assert.equal(review.liveEditEnabled, false);
  assert.deepEqual(review.quickCorrectActions, []);

  const wants = review.groups.find((g) => g.id === 'customerWants');
  assert.equal(wants?.title, 'Kunde möchte');
  assert.match(wants?.line || '', /Kia EV2 Earth/i);
  assert.equal(wants?.mode, 'briefing');

  const leasing = review.groups.find((g) => g.id === 'leasingWish');
  assert.equal(leasing?.title, 'Leasing');
  assert.match(leasing?.line || '', /48 Monate/);
  assert.match(leasing?.line || '', /12\.500 km\/Jahr/);
  assert.match(leasing?.line || '', /5\.000 € Sonderzahlung/);

  const contact = review.groups.find((g) => g.id === 'contact');
  assert.equal(contact?.title, 'Kontakt');
  assert.match(contact?.line || '', /m\.wittig@wittig\.de/);
  assert.match(contact?.line || '', /73614 Schorndorf/);
  assert.ok(!/Hauptstraße/i.test(contact?.line || ''), 'Straße nicht im Hero');

  const openGroup = review.groups.find((g) => g.id === 'open');
  assert.ok(openGroup, 'Noch offen Gruppe');
  assert.equal(openGroup.title, 'Noch offen');
  assert.equal(openGroup.line, 'Telefonnummer');
  assert.ok(!(openGroup.chips || []).length, 'keine Open-Chips');
  assert.ok(
    (openGroup.localActions || []).some((a) => a.label === 'Telefon ergänzen'),
    'lokale Aktion Telefon ergänzen',
  );

  assert.ok(!review.groups.some((g) => g.id === 'facts'), 'keine Fact-Chip-Wolke');
  const secondary = review.actionSections?.[0]?.secondaryActions || [];
  assert.equal(secondary.length, 0, 'kein Korrigieren/Erneut suchen/Verwerfen');
  assert.ok(!/Kundenakte anlegen/i.test(review.primaryCta || ''));
  assert.ok(!/Von Clever erkannt/i.test(JSON.stringify(review.hero)));
  assert.equal(
    (review.actionSections?.[0]?.primaryActions || []).filter((a) => a.tone === 'primary').length,
    1,
  );
}

// --- High-confidence Modell → kein qi_model; Phone vorhanden → kein Telefon ---
{
  const actions = buildIntakeNextActions(
    {
      detected: true,
      contact: { fullName: 'Max Muster', phone: '0171 111', email: 'a@b.de' },
    },
    {
      extractedFacts: [
        {
          field: 'vehicleInterest',
          label: 'EV2 Earth',
          confidence: 0.93,
          needsConfirmation: false,
        },
        { field: 'paymentType', value: 'leasing', label: 'Leasing' },
        { field: 'termMonths', value: 36, label: '36 Monate' },
      ],
    },
  );
  assert.ok(!actions.some((a) => a.id === 'qi_phone'));
  assert.ok(!actions.some((a) => a.id === 'qi_model'));
  assert.ok(actions.some((a) => a.id === 'qi_offer'));
  const offer = actions.find((a) => a.id === 'qi_offer');
  assert.equal(offer?.secondary, false, 'nach Telefon: Angebot auto-promoted');
  assert.equal(offer?.important, true);
  assert.ok(!actions.some((a) => /notiz/i.test(a.label || '')));
  assert.ok(actions.length <= 3);
}

// --- Unsicheres Modell → Modell korrigieren + Task-Titel ---
{
  const actions = buildIntakeNextActions(
    { detected: true, contact: { fullName: 'Test', phone: '0171' } },
    {
      extractedFacts: [{
        field: 'vehicleInterest',
        label: 'EV?',
        confidence: 0.6,
        needsConfirmation: true,
      }],
    },
  );
  const model = actions.find((a) => a.id === 'qi_model');
  assert.ok(model && model.label === 'Modell korrigieren');
  assert.equal(model.composerTitle, 'MODELL KORRIGIEREN · Test');
  assert.equal(model.important, true);
}

// --- Multi-Modell → prüfen + Choice-Chips ---
{
  const vehicle = {
    field: 'vehicleInterestMulti',
    label: 'EV2 Earth oder EV3 Air',
    value: ['EV2 Earth', 'EV3 Air'],
    confidence: 0.9,
  };
  const actions = buildIntakeNextActions(
    { detected: true, contact: { fullName: 'Test', phone: '0171' } },
    { extractedFacts: [vehicle] },
  );
  const model = actions.find((a) => a.id === 'qi_model');
  assert.ok(model);
  const choices = buildIntakeModelChoiceChips(vehicle);
  assert.ok(choices.some((c) => /EV2/i.test(c.label)));
  assert.ok(choices.some((c) => /EV3/i.test(c.label)));
  assert.ok(choices.some((c) => c.label === 'Anderes'));
  assert.ok((model.choiceChips || []).length >= 2);

  // Unsicherheit → Suggest-Chip erlaubt
  const suggest = resolveQuietIntakeSuggestChips({
    inboundLead: { detected: true, contact: { fullName: 'Test', phone: '0171' } },
    extractedFacts: [vehicle],
  });
  assert.ok(suggest.some((c) => c.id === 'qi_model'));
}

assert.equal(resolveQuietIntakeSuggestChips({ messageDraft: 'x' }).length, 0);

// --- Nach Telefon-Subtask: mergen + Erfolg + Mode-Reset Signal (kein qi_phone) ---
{
  const preservedTurn = {
    inboundLead: {
      detected: true,
      proposeCreateCustomer: true,
      resolutionStatus: 'none',
      contact: { fullName: 'Matthias Wittig', email: 'a@b.de' },
    },
    extractedFacts: [
      { field: 'vehicleInterest', label: 'EV2 Earth', confidence: 0.95 },
      { field: 'paymentType', label: 'Leasing', value: 'leasing' },
      { field: 'termMonths', value: 36, label: '36 Monate' },
      { field: 'annualMileage', value: 12500, label: '12.500 km' },
    ],
  };
  const merged = applyQuietIntakeSubtaskResult({
    preservedTurn,
    taskId: 'qi_phone',
    completedTurn: {
      sellerInput: '0171 5556677',
      extractedFacts: [{ field: 'phone', value: '01715556677', label: '0171 5556677' }],
      rememberDecision: {
        mode: 'save_with_undo',
        safeFacts: [{ field: 'phone', value: '01715556677', label: '0171 5556677' }],
      },
    },
  });
  assert.match(merged.lastTurn.inboundLead.contact.phone || '', /0171\s*5556677/);
  // Feedback-Freeze: kein grüner Composer-Erfolgssatz
  assert.equal(merged.feedback, null);
  assert.ok(!/vollständig genug für die Kundenakte/i.test(String(merged.feedback || '')));
  assert.deepEqual(merged.microConfirm, buildPhoneAddedMicroConfirm());
  assert.ok(
    (merged.highlightChipLabels || []).some((l) => /0171|5556677/.test(String(l))),
    'Glow-Label für Telefon-Chip',
  );
  assert.deepEqual(merged.reviewModel?.microConfirm, buildPhoneAddedMicroConfirm());
  const next = buildIntakeNextActions(merged.lastTurn.inboundLead, merged.lastTurn);
  assert.ok(!next.some((a) => a.id === 'qi_phone'));
  const offerAfter = next.find((a) => a.id === 'qi_offer');
  assert.equal(offerAfter?.important, true, 'nach Telefon: Angebot promoted');
  assert.equal(offerAfter?.secondary, false);
  assert.equal(merged.reviewModel?.primaryCta, 'Angebot vorbereiten');
  assert.equal(merged.reviewModel?.hero?.name, 'Matthias Wittig');
  assert.ok(!merged.reviewModel?.groups?.some((g) => g.id === 'open'));
  // Kontakt enthält Telefon nach Ergänzung (Briefing)
  const contactGroup = merged.reviewModel?.groups?.find((g) => g.id === 'contact');
  assert.ok(
    /0171|5556677/.test(String(contactGroup?.line || '')),
    'Telefon in Kontakt-Zeile nach Ergänzung',
  );
  assert.ok(!merged.reviewModel?.groups?.some((g) => g.id === 'facts'));
}

// --- Schlayer UI-Golden: Briefing statt Chip-Review ---
{
  const inbound = {
    detected: true,
    proposeCreateCustomer: true,
    resolutionStatus: 'none',
    contact: {
      fullName: 'Alexander Schlayer',
      email: 's_alexander1@hotmail.de',
    },
  };
  const turn = {
    inboundLead: inbound,
    extractedFacts: [
      {
        field: 'vehicleInterest',
        label: 'Kia EV3 Air',
        value: { make: 'Kia', model: 'EV3', trim: 'Air' },
        confidence: 0.95,
        needsConfirmation: false,
      },
      { field: 'email', label: 's_alexander1@hotmail.de', value: 's_alexander1@hotmail.de', confidence: 0.94 },
      {
        field: 'city',
        label: 'Bar',
        value: { city: 'Bar' },
        confidence: 0.78,
        needsConfirmation: true,
      },
      { field: 'maritalStatus', label: 'ledig', value: 'single', confidence: 0.95 },
      { field: 'existingVehicle', label: 'Audi A4', value: { make: 'Audi', model: 'A4' }, confidence: 0.9 },
    ],
  };

  const review = buildInboundLeadReviewModel(inbound, turn);
  assert.equal(review.hardReviewRequired, false);
  assert.equal(review.briefingPresenter, true);
  assert.equal(review.hero?.name, 'Alexander Schlayer');
  assert.equal(review.hero?.subtitle, null);
  assert.equal(review.primaryCta, 'Angebot vorbereiten');
  assert.equal(review.secondaryCta, null);
  assert.deepEqual(review.quickCorrectActions, []);
  assert.equal(review.liveEditEnabled, false);
  assert.equal((review.actionSections?.[0]?.secondaryActions || []).length, 0);

  assert.ok(review.groups.some((g) => g.id === 'customerWants' && /EV3 Air/i.test(g.line)));
  assert.ok(review.groups.some((g) => g.id === 'customerPicture' && /ledig/i.test(g.line)));
  assert.ok(review.groups.some((g) => g.id === 'currentVehicle' && /Audi A4/i.test(g.line)));
  assert.ok(review.groups.some((g) => g.id === 'contact' && /s_alexander1@hotmail\.de/i.test(g.line)));
  const open = review.groups.find((g) => g.id === 'open');
  assert.equal(open?.line, 'Telefonnummer');
  assert.ok((open?.localActions || []).some((a) => /Telefon ergänzen/i.test(a.label)));
  const clarify = review.groups.find((g) => g.id === 'clarify');
  assert.ok(clarify, 'Bar lokal unter Noch zu klären');
  assert.match(clarify.line || '', /Bar/i);
  assert.ok((clarify.localActions || []).some((a) => /Bar.*prüfen|prüfen/i.test(a.label)));
  assert.ok(!review.groups.some((g) => g.id === 'facts'));
  assert.ok(!/Von Clever erkannt|Kundenakte anlegen|Schnell korrigieren/i.test(JSON.stringify(review)));
  assert.equal(resolveQuietIntakeSuggestChips(turn).length, 0);
}

console.log('quietIntakeReview.test.js: OK');
