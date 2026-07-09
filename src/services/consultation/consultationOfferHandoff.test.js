/**
 * Welt 3 – Persönliche Übergabe (Happy Path).
 */
import assert from 'node:assert/strict';
import { JOURNEY_PHASE } from '../journey/journeyTypes.js';
import { CLEVER_WORLD } from './consultationWorlds.js';
import {
  OFFER_CONVERSATION_PHASE,
  OFFER_TURN_TYPE,
  beginOfferHandoff,
  buildAdvisorContactPrompt,
  filterNewHandoffChipIds,
  getVisibleHandoffCategories,
  inferPrefilledHandoffChipIds,
  QUICK_HANDOFF_CATEGORIES,
  QUICK_HANDOFF_COPY,
  QUICK_HANDOFF_ENRICHMENT_CHIPS,
  buildPersonalHandoffView,
  countSessionUnderstandingLabels,
  createLeadFromConsultationHappyPath,
  submitPersonalHandoff,
  validateHandoffForm,
} from './consultationOfferHandoff.js';
import {
  advanceFromThinking,
  advanceFromVehicleThinking,
  createHappyPathSession,
  HAPPY_PATH_EXAMPLE_MESSAGE,
  selectRecommendedModel,
  submitOpeningMessage,
  submitQuestionAnswer,
  submitVehicleAnswer,
} from './consultationHappyPath.js';

function buildFullSession() {
  let session = createHappyPathSession('Autohaus Trinkle');
  session = submitOpeningMessage(session, HAPPY_PATH_EXAMPLE_MESSAGE);
  session = submitQuestionAnswer(session, { answerId: 'often' });
  session = submitQuestionAnswer(session, { text: 'Ja, Garage' });
  session = advanceFromThinking(session);
  session = selectRecommendedModel(session, 'ev3');
  session = submitVehicleAnswer(session, { answerId: 'range' });
  session = submitVehicleAnswer(session, { answerId: 'heatPump' });
  session = advanceFromVehicleThinking(session);
  return session;
}

const dealerConditions = {
  dealerId: 'autohaus-trinkle',
  dealerName: 'Autohaus Trinkle',
  contact: { name: 'Mike Quach', phone: '+49 170 5550199', email: 'mike@autohaus-trinkle.de' },
};

function testHandoffView() {
  const session = buildFullSession();
  const view = buildPersonalHandoffView(session, dealerConditions);

  assert.equal(view.title, 'Ihr Wunsch ist vorbereitet.');
  assert.ok(view.preparedItems.includes('Ihr Wunschprofil'));
  assert.ok(view.preparedItems.includes('Passendes Fahrzeug'));
  assert.ok(view.advisor.name.includes('Mike'));
  assert.equal(view.hasRate, false);
  assert.equal(view.hasOffer, false);
  assert.ok(!view.directionLine?.match(/€\s*\d|leasing/i));
  assert.ok(!view.trimLine?.match(/€\s*\d|leasing/i));
  console.log('✓ Beraterkarte wird angezeigt, keine Rate, kein Angebot');
}

function testBeginOfferHandoff() {
  const session = beginOfferHandoff(buildFullSession(), dealerConditions);
  assert.equal(session.phase, OFFER_CONVERSATION_PHASE.OFFER_HANDOFF);
  assert.ok(session.turns.some((t) => t.type === OFFER_TURN_TYPE.PERSONAL_HANDOFF));
  assert.equal(session.needProfile.world, CLEVER_WORLD.OFFER);
  console.log('✓ Journey geht in Welt 3');
}

function testLeadCreation() {
  const session = buildFullSession();
  const form = {
    firstName: 'Anna',
    lastName: 'Muster',
    email: 'anna@example.de',
    phone: '01701234567',
    contactPreference: 'whatsapp',
    contactTiming: 'tomorrow',
    advisorNote: 'Lieber nachmittags',
  };

  const lead = createLeadFromConsultationHappyPath({ session, handoffForm: form, dealerConditions });

  assert.ok(lead.crm.needProfile);
  assert.equal(lead.crm.needProfile.world, CLEVER_WORLD.OFFER);
  assert.ok(lead.crm.needProfile.understoodLabels?.length >= 4);
  assert.ok(lead.sonderwuensche?.consultation?.consultationHandoff);
  assert.match(lead.notes, /EV3/i);
  assert.ok(lead.notes.includes('Wärmepumpe') || lead.notes.includes('Ausstattung'));
  assert.equal(lead.contact.email, 'anna@example.de');
  assert.equal(lead.contact.name, 'Anna Muster');
  assert.ok(!lead.currentRate);
  assert.ok(!lead.desiredRate);
  console.log('✓ NeedProfile, EV3-Richtung, Ausstattung und Kontakt im Lead');
}

function testSubmitPersonalHandoff() {
  const session = buildFullSession();
  const form = {
    firstName: 'Tom',
    lastName: 'Kunde',
    email: 'tom@example.de',
    contactPreference: 'email',
    contactTiming: 'this_week',
  };

  const result = submitPersonalHandoff(session, form, dealerConditions);
  assert.equal(result.session.phase, OFFER_CONVERSATION_PHASE.OFFER_COMPLETE);
  assert.equal(result.session.needProfile.world, CLEVER_WORLD.OFFER);
  assert.equal(result.journey?.phase, JOURNEY_PHASE.FIRST_CONTACT);
  assert.ok(result.session.turns.some((t) => t.type === OFFER_TURN_TYPE.HANDOFF_COMPLETE));
  console.log('✓ Persönliche Übergabe erzeugt Lead und Abschluss');
}

function testValidation() {
  const invalid = validateHandoffForm({ firstName: '', lastName: 'X', email: 'bad' });
  assert.equal(invalid.valid, false);
  const valid = validateHandoffForm({
    firstName: 'A',
    lastName: 'B',
    email: 'a@b.de',
  });
  assert.equal(valid.valid, true);
  console.log('✓ Kontaktdaten-Validierung');
}

function testQuickHandoffChips() {
  assert.ok(QUICK_HANDOFF_ENRICHMENT_CHIPS.length >= 30);
  assert.equal(QUICK_HANDOFF_CATEGORIES.length, 6);
  assert.ok(QUICK_HANDOFF_CATEGORIES.some((c) => c.id === 'budget'));
  assert.ok(QUICK_HANDOFF_CATEGORIES.some((c) => c.id === 'elektro'));
  assert.match(QUICK_HANDOFF_COPY.title, /Falls Sie möchten/i);
  assert.match(QUICK_HANDOFF_COPY.subtitle, /Keine Pflicht/i);
  console.log('✓ Kontaktphase-Chips nach Kategorien inkl. Budget und Elektro');
}

function testHandoffChipPrefill() {
  let session = createHappyPathSession('Autohaus Trinkle');
  session = submitOpeningMessage(session, HAPPY_PATH_EXAMPLE_MESSAGE);
  const prefilled = inferPrefilledHandoffChipIds(session);
  assert.ok(prefilled.includes('twoChildren') || prefilled.includes('dog'), `Prefill: ${prefilled.join(', ')}`);
  assert.ok(prefilled.some((id) => /budget|leasing|range|wallbox|fastCharge/i.test(id)) || prefilled.length > 0);

  const visible = getVisibleHandoffCategories(session.needProfile);
  assert.ok(visible.some((c) => c.id === 'elektro'), 'Elektro-Kategorie bei EV-Kontext');

  const onlyNew = filterNewHandoffChipIds(session, [...prefilled, 'commuter']);
  assert.ok(onlyNew.includes('commuter'));
  assert.ok(!onlyNew.some((id) => prefilled.includes(id)));
  console.log('✓ Smarte Vorbelegung und keine doppelte Chip-Wahrheit');
}

function testAdvisorOpeningPrompt() {
  const opening = buildAdvisorContactPrompt(0, 'opening');
  assert.equal(opening.level, 'opening');
  assert.match(opening.optionalNote, /direkt kontaktieren/i);
  const handoff = buildAdvisorContactPrompt(4, 'handoff');
  assert.match(handoff.hint, /gutes Bild/);
  console.log('✓ Berater-Copy für Empfang und Übergabe');
}

function testAdvisorContactPrompt() {
  assert.equal(buildAdvisorContactPrompt(0), null);
  assert.match(buildAdvisorContactPrompt(2).hint, /einiges verstanden|nahtlos/i);
  assert.match(buildAdvisorContactPrompt(4).hint, /gutes Bild/);
  assert.match(buildAdvisorContactPrompt(7).hint, /sehr gut verstanden|übernehmen/i);
  console.log('✓ Berater-Kontakt-Copy nach Verständnisstärke');
}

function testEarlyAdvisorHandoffPreservesUnderstanding() {
  let session = createHappyPathSession('Autohaus Trinkle');
  session = submitOpeningMessage(session, HAPPY_PATH_EXAMPLE_MESSAGE);
  session = submitQuestionAnswer(session, { answerId: 'often' });
  const labelsBefore = [...session.notepadLabels];
  assert.ok(countSessionUnderstandingLabels(session) > 0);

  const handedOff = beginOfferHandoff(session, dealerConditions);
  assert.equal(handedOff.phase, OFFER_CONVERSATION_PHASE.OFFER_HANDOFF);
  assert.deepEqual(handedOff.notepadLabels, labelsBefore);
  assert.ok(handedOff.needProfile?.understoodLabels?.length > 0);
  assert.ok(handedOff.turns.some((turn) => turn.type === OFFER_TURN_TYPE.PERSONAL_HANDOFF));
  console.log('✓ Frühe Berater-Übergabe behält Verständnis');
}

testHandoffView();
testQuickHandoffChips();
testHandoffChipPrefill();
testAdvisorOpeningPrompt();
testAdvisorContactPrompt();
testEarlyAdvisorHandoffPreservesUnderstanding();
testBeginOfferHandoff();
testLeadCreation();
testSubmitPersonalHandoff();
testValidation();
console.log('\nAlle Welt-3-Happy-Path-Tests bestanden.');
