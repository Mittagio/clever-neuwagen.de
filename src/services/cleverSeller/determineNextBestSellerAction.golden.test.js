/**
 * Goldens A–E: zentrale Primary Action + lead-first Work Briefing.
 * node src/services/cleverSeller/determineNextBestSellerAction.golden.test.js
 */
import assert from 'node:assert/strict';
import { buildSellerWorkBriefing } from './buildSellerWorkBriefing.js';
import {
  NEXT_BEST_ACTION_ID,
  determineNextBestSellerAction,
  findPortalChangeRequest,
} from './determineNextBestSellerAction.js';
import { PORTFOLIO_REACTION_STATUS } from '../crm/customerOfferPortfolioService.js';

function baseLead(overrides = {}) {
  return {
    id: 'lead-nba-golden',
    contact: { name: 'Max Mustermann' },
    wish: {},
    crm: {
      needProfile: {},
      vehicleConfigurations: [],
      customerOfferPortfolio: { items: [] },
      cleverWorkingState: null,
      existingVehicle: null,
      appointments: [],
      ...(overrides.crm || {}),
    },
    ...overrides,
    crm: {
      needProfile: {},
      vehicleConfigurations: [],
      customerOfferPortfolio: { items: [] },
      cleverWorkingState: null,
      existingVehicle: null,
      appointments: [],
      ...(overrides.crm || {}),
    },
  };
}

/** Persistierter Lead nach Need-Dump (ohne Wunschmodell). */
function leadGoldenA() {
  return baseLead({
    wish: {
      paymentType: 'leasing',
      termMonths: 48,
      mileagePerYear: 15000,
      downPayment: 3000,
      desiredDeliveryDate: '2026-12-01',
    },
    crm: {
      needProfile: {
        fuel: 'electric',
        dog: true,
        children: 2,
        household: { childrenCount: 2 },
        towbar: true,
        equipmentWishes: ['heat_pump'],
        selectedModelKey: null,
        modelHint: null,
        understoodLabels: [],
      },
      existingVehicle: {
        make: 'VW',
        model: 'Polo',
        color: 'schwarz',
      },
    },
  });
}

{
  // Golden A – Need Consultation
  const lead = leadGoldenA();
  const briefing = buildSellerWorkBriefing({ lead, facts: [] });
  const s = briefing.sections;
  assert.match(String(s.customerPicture || ''), /2 Kinder/);
  assert.match(String(s.customerPicture || ''), /Hund/);
  assert.equal(s.sought, 'Elektrofahrzeug');
  assert.match(String(s.leasingWish || ''), /48 Monate/);
  assert.match(String(s.leasingWish || ''), /15\.000 km\/Jahr/);
  assert.match(String(s.leasingWish || ''), /3\.000 € Sonderzahlung/);
  assert.match(String(s.important || ''), /Wärmepumpe/);
  assert.match(String(s.important || ''), /Anhängerkupplung/);
  assert.match(String(s.currentVehicle || ''), /VW Polo/i);
  assert.match(String(s.currentVehicle || ''), /schwarz/);
  assert.match(String(s.planned || ''), /Dezember 2026/);
  assert.ok(!s.customerWants, 'kein Wunschmodell');

  const nba = briefing.nextBestAction
    || determineNextBestSellerAction({ lead, workBriefing: briefing });
  assert.equal(nba.id, NEXT_BEST_ACTION_ID.CONSULTATION);
  assert.equal(nba.label, 'Passende Fahrzeuge finden');
  assert.equal(nba.toolId, 'capture_then_consult');
  assert.equal(nba.handler, 'consultation');
  assert.notEqual(nba.id, NEXT_BEST_ACTION_ID.PREPARE_OFFER);
  assert.equal(s.nextStep, 'Passende Fahrzeuge finden');
  assert.ok(nba.contextPayload?.fuelPreference === 'electric');
  assert.ok(nba.contextPayload?.childrenCount === 2);
  console.log('✓ Golden A – Need Consultation');
}

{
  // Golden B – Modell kommt hinzu → prepare_offer, Bedarf bleibt
  const lead = leadGoldenA();
  lead.crm.needProfile.selectedModelKey = 'ev3';
  lead.crm.cleverWorkingState = {
    currentOfferDraftId: 'od-ev3-lr',
    currentOfferDraft: {
      offerDraftId: 'od-ev3-lr',
      vehicleTrackId: 'vt-ev3',
      vehicleIdentityDraft: {
        modelKey: 'ev3',
        model: { canonical: 'EV3', raw: 'EV3' },
        trim: { canonical: 'Long Range', raw: 'Long Range' },
      },
    },
  };

  const briefing = buildSellerWorkBriefing({ lead, facts: [] });
  const nba = briefing.nextBestAction;
  assert.equal(nba.id, NEXT_BEST_ACTION_ID.PREPARE_OFFER);
  assert.equal(nba.label, 'Angebot vorbereiten');
  assert.equal(nba.handler, 'prepare_offer');
  assert.equal(nba.contextPayload?.modelKey, 'ev3');
  assert.match(String(nba.contextPayload?.trim || ''), /Long Range/i);
  assert.equal(nba.contextPayload?.offerDraftId, 'od-ev3-lr');
  assert.equal(nba.contextPayload?.termMonths, 48);
  assert.equal(nba.contextPayload?.annualMileage, 15000);
  assert.equal(nba.contextPayload?.downPayment, 3000);
  // Bedarf bleibt im Briefing
  assert.match(String(briefing.sections.customerPicture || ''), /2 Kinder/);
  assert.match(String(briefing.sections.important || ''), /Wärmepumpe/);
  assert.match(String(briefing.sections.customerWants || ''), /EV3/);
  assert.match(String(briefing.sections.customerWants || ''), /Long Range/i);
  console.log('✓ Golden B – prepare_offer nach Modell');
}

{
  // Golden C – sendbares VehicleOffer → intend_send
  const lead = leadGoldenA();
  lead.crm.needProfile.selectedModelKey = 'ev3';
  lead.crm.vehicleOffers = {
    'vo-sendable-1': {
      id: 'vo-sendable-1',
      offerDraftId: 'od-ev3-send',
      monthlyRate: 389,
      rateAuthority: 'bank_pdf',
      paymentType: 'leasing',
      boardOffer: {
        payment: { type: 'leasing', monthlyRate: 389 },
        rateAuthority: 'bank_pdf',
      },
    },
  };

  const nba = determineNextBestSellerAction({ lead });
  assert.equal(nba.id, NEXT_BEST_ACTION_ID.INTEND_SEND);
  assert.equal(nba.label, 'An Kunden senden');
  assert.equal(nba.handler, 'intend_send');
  assert.equal(nba.contextPayload?.offerDraftId, 'od-ev3-send');
  assert.equal(nba.contextPayload?.monthlyRate, 389);
  console.log('✓ Golden C – intend_send');
}

{
  // Golden D – Portal Change Request → modify_offer (kein stilles Überschreiben)
  const lead = leadGoldenA();
  lead.crm.needProfile.selectedModelKey = 'ev3';
  lead.crm.vehicleOffers = {
    'vo-sent-1': {
      id: 'vo-sent-1',
      offerDraftId: 'od-ev3-sent',
      monthlyRate: 389,
      rateAuthority: 'bank_pdf',
      boardOffer: { payment: { monthlyRate: 389 } },
    },
  };
  lead.crm.customerOfferPortfolio = {
    items: [{
      id: 'pu-1',
      vehicleCardId: 'vo-sent-1',
      offerDraftId: 'od-ev3-sent',
      customerReaction: {
        status: PORTFOLIO_REACTION_STATUS.CHANGE_REQUESTED,
        questionText: 'Gefällt mir, aber bitte mit 20.000 km.',
        changeDimension: 'mileage',
      },
    }],
  };

  const change = findPortalChangeRequest(lead);
  assert.ok(change);
  assert.match(change.questionText, /20\.000 km/);

  const nba = determineNextBestSellerAction({ lead });
  assert.equal(nba.id, NEXT_BEST_ACTION_ID.MODIFY_OFFER);
  assert.equal(nba.label, 'Angebot anpassen');
  assert.equal(nba.handler, 'modify_offer');
  assert.equal(nba.contextPayload?.offerDraftId, 'od-ev3-sent');
  assert.equal(nba.contextPayload?.baseOnCurrentOffer, true);
  assert.match(String(nba.contextPayload?.questionText || ''), /20\.000 km/);
  // Nicht intend_send trotz sendbarer Rate – Change hat Vorrang
  assert.notEqual(nba.id, NEXT_BEST_ACTION_ID.INTEND_SEND);
  console.log('✓ Golden D – modify_offer Portal Change');
}

{
  // Golden E – Persistenz / Reload: nur Lead, gleiche Summary + Primary
  const leadA = leadGoldenA();
  const briefing1 = buildSellerWorkBriefing({ lead: leadA, facts: [] });
  // Simulierter Reload: frische Facts absichtlich leer, neuer Briefing-Lauf
  const briefing2 = buildSellerWorkBriefing({ lead: structuredClone(leadA), facts: [] });
  assert.equal(briefing1.sections.customerPicture, briefing2.sections.customerPicture);
  assert.equal(briefing1.sections.sought, briefing2.sections.sought);
  assert.equal(briefing1.sections.leasingWish, briefing2.sections.leasingWish);
  assert.equal(briefing1.sections.important, briefing2.sections.important);
  assert.equal(briefing1.sections.currentVehicle, briefing2.sections.currentVehicle);
  assert.equal(briefing1.sections.planned, briefing2.sections.planned);
  assert.equal(briefing1.sections.nextStep, briefing2.sections.nextStep);
  assert.equal(briefing1.nextBestAction?.id, briefing2.nextBestAction?.id);
  assert.equal(briefing1.nextBestAction?.label, 'Passende Fahrzeuge finden');

  const leadB = leadGoldenA();
  leadB.crm.needProfile.selectedModelKey = 'ev3';
  leadB.crm.cleverWorkingState = {
    currentOfferDraft: {
      offerDraftId: 'od-reload',
      vehicleIdentityDraft: {
        modelKey: 'ev3',
        model: { canonical: 'EV3' },
        trim: { canonical: 'Long Range' },
      },
    },
  };
  const b1 = buildSellerWorkBriefing({ lead: leadB, facts: [] });
  const b2 = buildSellerWorkBriefing({ lead: structuredClone(leadB), facts: [] });
  assert.equal(b1.nextBestAction?.id, NEXT_BEST_ACTION_ID.PREPARE_OFFER);
  assert.equal(b2.nextBestAction?.id, NEXT_BEST_ACTION_ID.PREPARE_OFFER);
  assert.equal(b1.sections.nextStep, b2.sections.nextStep);
  console.log('✓ Golden E – Persistenz / Reload');
}

console.log('determineNextBestSellerAction.golden.test.js: ok');
