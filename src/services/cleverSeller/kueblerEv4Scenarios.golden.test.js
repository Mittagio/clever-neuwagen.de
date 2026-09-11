/**
 * Kübler Real-World – EV4 Earth Lease-Calc-Szenarien (Inbound, im Auftrag)
 * node src/services/cleverSeller/kueblerEv4Scenarios.golden.test.js
 */
import assert from 'node:assert/strict';
import { interpretSellerInput } from './interpretSellerInput.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { buildSellerWorkBriefing } from './buildSellerWorkBriefing.js';
import {
  buildOfferPreparationHandoffModel,
  resolvePrepareOfferDraftId,
} from './buildOfferPreparationHandoffModel.js';
import { NEXT_BEST_ACTION_ID } from './determineNextBestSellerAction.js';
import { getNeedProfileFromLead } from '../consultation/needProfileService.js';
import { listCustomerVehicleTracks } from '../crm/vehicleTrack.js';
import { getCleverWorkingState, resolveActiveOfferDraft } from './cleverWorkingDraft.js';
import { parseOnBehalfOf, parseOnBehalfPlace, preprocessCustomerMail } from '../dealerAiMailExtractor.js';

const KUEBLER_BODY = `Guten Morgen Herr Quach,

Wir hatten vor einigen Jahren Kontakt wegen einem KIA Niro EV. Damals wurde es ein anderes Auto, wir sind aber so verblieben, dass ich mich gerne wieder melden kann. 

Sie haben aktuell ein sehr attraktives Angebot für einen KIA EV4 81kwH EARTH - 25 % + ELEKTROFÖRDERUNG *DRIVE/DESIGN/GD/SOUND/UPGRADE/WINTER* für 41.790 Euro. 

Ich suche im Auftrag meines Bruders Andreas Kübler aus Iggingen im Ostalbkreis einen elektrischen Neuwagen, da ich mit dem Thema Auto und speziell elektrischen Fahrzeugen mehr Erfahrung habe. Dabei hat mein Bruder klare Budget-Vorgaben gemacht. Mein Bruder und seine Frau sind beide verbeamtet. 

Können Sie mir bitte folgende Szenarien rechnen und in einem Angebot im Laufe des Vormittags zukommen lassen?

- Leasing des Fahrzeug
- 48 Monate Laufzeit
- 15.000 km im Jahr
- Szenario 1: Was kostet das monatlich ohne Anzahlung?
- Szenario 2: Was muss angezahlt werden, damit die monatliche Rate unter 370 Euro fällt?
- Bitte bieten Sie noch die Montage einer AHK mit an; das wäre aber ein Barzahlerposten.

Wären 20.000 km pro Jahr sehr viel teurer bzw. was kostet ein Mehrkilometer bei KIA?

Falls KIA eine günstigere Finanzierungsmethode mir verbrieftem Rückgaberecht nach Ende der Laufzeit anbietet, sind wir auch dafür offen. 

Herzlichen Dank für Ihre Bemühungen. Für Rückfragen stehe ich Ihnen gerne zur Verfügung. 

Mit freundlichen Grüßen

Michael Kübler
Carl-Zeiss-Str. 53/1
73614 Schorndorf
Mobil: 0173-1855152`;

const KUEBLER_MAIL = `From: michael.kuebler@example.com
Subject: Kia EV4 Earth – Leasing-Szenarien

${KUEBLER_BODY}`;

function emptyLead(id = 'lead-kuebler') {
  return {
    id,
    name: null,
    contact: {},
    wish: {},
    crm: {
      needProfile: {},
      vehicleConfigurations: [],
      cleverWorkingState: null,
      vehicleOffers: [],
    },
  };
}

function applyText(lead, text) {
  const interpreted = interpretSellerInput(text);
  const accepted = applyAcceptedSellerTurn(lead, {
    extractedFacts: interpreted.facts,
    sellerInput: text,
    preparedActions: [],
    intents: interpreted.intents || [],
  }, { postFeedCard: false });
  assert.equal(accepted.ok, true);
  return { lead: accepted.lead, interpreted };
}

{
  assert.equal(parseOnBehalfOf(KUEBLER_BODY), 'Andreas Kübler');
  assert.equal(parseOnBehalfPlace(KUEBLER_BODY), 'Iggingen');
  const mail = preprocessCustomerMail(KUEBLER_MAIL);
  assert.match(String(mail.customerName || ''), /Michael\s+Kübler/i);
  assert.ok(!/Quach/i.test(String(mail.customerName || '')));
  assert.equal(mail.onBehalfOf, 'Andreas Kübler');
  console.log('✓ Name Michael + onBehalf Andreas (Iggingen), kein Quach');
}

{
  const { lead, interpreted } = applyText(emptyLead('kuebler-base'), KUEBLER_MAIL);
  const byField = (field) => interpreted.facts.filter((f) => f.field === field);
  const profile = getNeedProfileFromLead(lead);
  const name = String(lead.contact?.name || lead.name || '');

  assert.match(name, /Michael\s+Kübler/i);
  assert.ok(!/Quach/i.test(name));

  const interest = byField('vehicleInterest')[0];
  assert.ok(interest, 'vehicleInterest EV4');
  assert.equal(interest.value?.modelKey, 'ev4');
  assert.match(String(interest.value?.trim || interest.label || ''), /Earth/i);
  assert.equal(byField('vehicleInterestMulti').length, 0, 'kein Multi mit Historie-Niro');

  const past = byField('pastVehicleInquiry')[0];
  assert.ok(past, 'Niro als Historie');
  assert.match(String(past.label || ''), /Niro/i);

  assert.ok(byField('batteryPreference').some((f) => Number(f.value?.kWh) === 81));

  const behalf = byField('onBehalfOf')[0] || profile.onBehalfOf;
  assert.ok(behalf);
  const behalfName = behalf.value?.name || behalf.name || behalf.label;
  assert.match(String(behalfName), /Andreas\s+Kübler/i);

  assert.equal(byField('paymentType')[0]?.value || lead.wish?.paymentType, 'leasing');
  assert.equal(Number(byField('termMonths')[0]?.value || lead.wish?.termMonths), 48);
  assert.equal(Number(byField('annualMileage')[0]?.value || lead.wish?.mileagePerYear), 15000);

  const scenarios = byField('leaseCalcScenarioWishes')[0]?.value
    || profile.leaseCalcScenarioWishes
    || [];
  assert.ok(scenarios.length >= 2, 'zwei Kalkulationsszenarien');
  assert.ok(scenarios.some((s) => s.id === 'no_downpayment' || /ohne Anzahlung/i.test(s.label)));
  assert.ok(scenarios.some((s) => s.id === 'rate_under_cap' || /370/i.test(s.label)));
  assert.equal(byField('downPayment').length, 0, 'kein last-wins 0-AZ als Primary');
  assert.equal(byField('monthlyBudget').length, 0, '370 nicht als feste Wunschrate');

  assert.ok(byField('towHitchRequired').length || profile.towbar === true, 'AHK');

  const excess = byField('openCustomerQuestion').find((f) => f.value?.topic === 'excess_mileage');
  assert.ok(excess, 'Mehrkilometer-Frage');

  const financeReturn = byField('openCustomerQuestion').find((f) => f.value?.topic === 'finance_with_return');
  assert.ok(financeReturn, 'Finanzierung mit Rückgaberecht');

  assert.ok(
    !byField('openCustomerQuestion').some((f) => f.value?.topic === 'subsidy'),
    'ELEKTROFÖRDERUNG/Falls ≠ Förderung-2026-Frage',
  );

  const tracks = listCustomerVehicleTracks(lead);
  assert.equal(tracks.length, 1, 'genau ein EV4-Track');
  assert.match(String(tracks[0]?.modelKey || tracks[0]?.modelLabel || ''), /ev4/i);

  const drafts = Object.values(getCleverWorkingState(lead).offerDrafts || {});
  assert.equal(drafts.length, 1, 'genau ein Concept Draft');
  const draft = resolveActiveOfferDraft({ lead }) || drafts[0];
  assert.equal(draft.monthlyRate ?? draft.rate ?? null, null, 'Rate null');

  const briefing = buildSellerWorkBriefing({
    lead,
    facts: interpreted.facts,
    draft,
  });
  assert.equal(briefing.nextBestAction?.id, NEXT_BEST_ACTION_ID.PREPARE_OFFER);
  assert.match(briefing.text, /EV4/i);
  assert.match(briefing.text, /Earth|81/i);
  assert.match(briefing.text, /Andreas/i);
  assert.match(briefing.text, /ohne Anzahlung|370/i);
  assert.match(briefing.text, /Mehrkilometer|20\.000/i);

  const offerDraftId = resolvePrepareOfferDraftId(lead, briefing.nextBestAction?.payload || {});
  const prep = buildOfferPreparationHandoffModel({
    lead,
    offerDraftId,
    nbaPayload: briefing.nextBestAction?.payload || {},
  });
  assert.ok(prep);
  assert.match(
    String(prep.offerReview?.variantWishesLine || prep.actionSections?.[0]?.line || ''),
    /ohne Anzahlung|370/i,
  );
  assert.equal(prep.actionSections?.[0]?.primaryActions?.[0]?.label, 'Kalkulation / PDF hochladen');

  console.log('✓ Kübler Golden – EV4 Earth, Szenarien-Context, ein Track/Draft');
}

console.log('\nKübler EV4 Scenarios Golden: OK');
