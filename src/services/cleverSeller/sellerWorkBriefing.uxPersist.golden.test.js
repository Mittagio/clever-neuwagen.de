/**
 * UX-/Persistenz-Fix Goldens A–D (nach echtem UI-Test).
 * node src/services/cleverSeller/sellerWorkBriefing.uxPersist.golden.test.js
 */
import assert from 'node:assert/strict';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { buildSellerWorkBriefing } from './buildSellerWorkBriefing.js';
import {
  NEXT_BEST_ACTION_ID,
  findSendableVehicleOffer,
  overlayNextStepWithNba,
} from './determineNextBestSellerAction.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { SELLER_FACT_CLASS } from './sellerFactTypes.js';
import { getNeedProfileFromLead } from '../consultation/needProfileService.js';
import { createEmptyNeedProfile } from '../consultation/needProfileTypes.js';

const NEED_DUMP = 'Kunde hat zwei Kinder und einen Hund. Er möchte ein Elektroauto leasen, 48 Monate, 15.000 km im Jahr, 3.000 Euro Anzahlung. Wichtig sind Wärmepumpe und Anhängerkupplung. Aktuell fährt er einen schwarzen VW Polo. Das neue Auto plant er für Dezember 2026.';

function emptyLead(needProfile = {}) {
  return {
    id: `lead-ux-${Date.now()}`,
    contact: { name: 'UX Persist Test' },
    wish: {},
    crm: {
      needProfile,
      vehicleConfigurations: [],
      customerOfferPortfolio: { items: [] },
      cleverWorkingState: null,
      sellerInsights: [],
    },
  };
}

{
  // Golden A – existingVehicle persistiert, Briefing nach Reload
  const lead0 = emptyLead({});
  const turn = runCleverSellerTurn({ lead: lead0, sellerInput: NEED_DUMP });
  const applied = applyAcceptedSellerTurn(lead0, {
    ...turn,
    extractedFacts: turn.rememberDecision?.safeFacts || turn.extractedFacts,
  }, { postFeedCard: false });
  assert.equal(applied.ok, true);

  const ev = applied.lead.crm?.existingVehicle;
  assert.ok(ev, 'crm.existingVehicle nach Apply');
  assert.match(String(ev.make || ''), /VW/i);
  assert.match(String(ev.model || ''), /Polo/i);
  assert.match(String(ev.color || ''), /schwarz/i);
  assert.equal(ev.tradeInCandidate, false);
  assert.equal(ev.role, 'existing_vehicle');

  // Nicht nur Soft-Chip: structured vorhanden; Insight für existingVehicle optional/skipped
  const poloInsight = (applied.lead.crm?.sellerInsights || []).some((i) => (
    /polo/i.test(String(i.text || ''))
  ));
  assert.ok(ev.model, 'strukturiertes Modell');
  // Insight darf fehlen (preferred) – Structured ist Wahrheit
  void poloInsight;

  // Reload: nur persistierter Lead, keine Turn-Facts
  const briefing = buildSellerWorkBriefing({ lead: structuredClone(applied.lead), facts: [] });
  assert.match(String(briefing.sections.currentVehicle || ''), /VW\s*Polo/i);
  assert.match(String(briefing.sections.currentVehicle || ''), /schwarz/i);
  assert.equal(briefing.nextBestAction?.label, 'Passende Fahrzeuge finden');
  console.log('✓ Golden A – existingVehicle + Briefing Aktuell nach Reload');
}

{
  // Golden B – EV3 Long Range im Briefing, Bedarf bleibt
  const lead0 = emptyLead({});
  const turnNeed = runCleverSellerTurn({ lead: lead0, sellerInput: NEED_DUMP });
  const afterNeed = applyAcceptedSellerTurn(lead0, {
    ...turnNeed,
    extractedFacts: turnNeed.rememberDecision?.safeFacts || turnNeed.extractedFacts,
  }, { postFeedCard: false });

  const turnModel = runCleverSellerTurn({
    lead: afterNeed.lead,
    sellerInput: 'EV3 Long Range gefällt ihm.',
  });
  const afterModel = applyAcceptedSellerTurn(afterNeed.lead, {
    ...turnModel,
    extractedFacts: turnModel.extractedFacts,
  }, { postFeedCard: false });
  assert.equal(afterModel.ok, true);

  const briefing = buildSellerWorkBriefing({
    lead: structuredClone(afterModel.lead),
    facts: [],
  });
  assert.match(String(briefing.sections.customerWants || ''), /EV3/i);
  assert.match(String(briefing.sections.customerWants || ''), /Long\s*Range/i);
  assert.match(String(briefing.sections.customerPicture || ''), /2 Kinder/);
  assert.match(String(briefing.sections.customerPicture || ''), /Hund/);
  assert.match(String(briefing.sections.leasingWish || ''), /48 Monate/);
  assert.match(String(briefing.sections.important || ''), /Wärmepumpe/);
  assert.match(String(briefing.sections.currentVehicle || ''), /Polo/i);
  assert.equal(briefing.nextBestAction?.id, NEXT_BEST_ACTION_ID.PREPARE_OFFER);
  assert.equal(briefing.nextBestAction?.label, 'Angebot vorbereiten');
  console.log('✓ Golden B – EV3 · Long Range + Bedarf bleibt');
}

{
  // Golden C – Concept-Draft ohne Rate → kein Secondary Send
  const lead = emptyLead({
    fuel: 'electric',
    selectedModelKey: 'ev3',
    motorPreference: 'Long Range',
    household: { childrenCount: 2 },
  });
  lead.wish = {
    paymentType: 'leasing',
    termMonths: 48,
    mileagePerYear: 15000,
    downPayment: 3000,
  };
  lead.crm.cleverWorkingState = {
    currentOfferDraft: {
      offerDraftId: 'od-concept-1',
      vehicleIdentityDraft: {
        modelKey: 'ev3',
        model: { canonical: 'EV3' },
        trim: { canonical: 'Long Range' },
      },
      monthlyRate: null,
      rate: null,
    },
  };
  // Kein VehicleOffer mit Rate
  lead.crm.vehicleOffers = {};

  assert.equal(findSendableVehicleOffer(lead), null);

  const briefing = buildSellerWorkBriefing({ lead, facts: [] });
  assert.equal(briefing.nextBestAction?.id, NEXT_BEST_ACTION_ID.PREPARE_OFFER);
  assert.equal(briefing.nextBestAction?.label, 'Angebot vorbereiten');

  const overlaid = overlayNextStepWithNba(
    briefing.nextBestAction,
    {
      primary: { label: 'Angebot prüfen', type: 'offer' },
      secondary: { id: 'send', label: 'An Kunden senden', type: 'send' },
    },
    { offerSendable: Boolean(findSendableVehicleOffer(lead)) },
  );
  assert.equal(overlaid.primary.label, 'Angebot vorbereiten');
  assert.equal(overlaid.secondary, null, 'kein Secondary Send ohne Rate');
  console.log('✓ Golden C – kein Secondary Send ohne echte Rate');
}

{
  // Golden D – needProfile: {} → Apply ohne Crash
  const lead = emptyLead({});
  assert.deepEqual(lead.crm.needProfile, {});
  const normalized = getNeedProfileFromLead(lead);
  assert.ok(Array.isArray(normalized.equipmentWishes));
  assert.ok(Array.isArray(normalized.rawMessages));

  const facts = [
    {
      factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
      field: 'childrenCount',
      value: 2,
      label: '2 Kinder',
      confidence: 0.95,
    },
    {
      factClass: SELLER_FACT_CLASS.EXISTING_VEHICLE,
      field: 'existingVehicle',
      value: { make: 'VW', model: 'Polo', color: 'schwarz' },
      label: 'VW Polo · Schwarz',
      confidence: 0.93,
    },
    {
      factClass: SELLER_FACT_CLASS.CUSTOMER_NEED,
      field: 'fuelPreference',
      value: 'electric',
      label: 'Elektro',
      confidence: 0.95,
    },
  ];
  let applied;
  assert.doesNotThrow(() => {
    applied = applyAcceptedSellerTurn(lead, {
      extractedFacts: facts,
      sellerInput: '2 Kinder, VW Polo, Elektro',
    }, { postFeedCard: false });
  });
  assert.equal(applied.ok, true);
  assert.equal(Number(applied.lead.crm?.needProfile?.children
    ?? applied.lead.crm?.needProfile?.household?.childrenCount), 2);
  assert.equal(applied.lead.crm?.needProfile?.fuel, 'electric');
  assert.match(String(applied.lead.crm?.existingVehicle?.model || ''), /Polo/i);
  // Defaults nicht verloren / Arrays existent
  const profile = applied.lead.crm.needProfile;
  assert.ok(Array.isArray(profile.equipmentWishes));
  assert.ok(Array.isArray(profile.understoodLabels));
  // createEmptyNeedProfile Shape bleibt kompatibel
  const empty = createEmptyNeedProfile();
  assert.ok('fuel' in empty && 'equipmentWishes' in empty);
  console.log('✓ Golden D – needProfile={} Apply ohne Crash');
}

console.log('sellerWorkBriefing.uxPersist.golden.test.js: ok');
