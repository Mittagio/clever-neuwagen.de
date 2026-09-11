/**
 * Budde Real-World – E-Auto Leasing Bedarf ohne Modell (Consultation) · FREEZE
 * Muster: Beratungsfall ohne Modell, aber mit Budget und Konditionen
 * node src/services/cleverSeller/buddeEvLeasingConsult.golden.test.js
 */
import assert from 'node:assert/strict';
import { interpretSellerInput } from './interpretSellerInput.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { buildSellerWorkBriefing } from './buildSellerWorkBriefing.js';
import { NEXT_BEST_ACTION_ID } from './determineNextBestSellerAction.js';
import { getNeedProfileFromLead } from '../consultation/needProfileService.js';
import { listCustomerVehicleTracks } from '../crm/vehicleTrack.js';
import { getCleverWorkingState, resolveActiveOfferDraft } from './cleverWorkingDraft.js';

const MAIL = `From: patrick.budde@example.com
Subject: E-Auto Leasing Anfrage

Sehr geehrte Damen und Herren,
 
Ich bin auf der Suche nach einem möglichen E-Auto im Leasing. Folgende Eckdaten wären für mich interessant:
 
- 15.000 km pro Jahr
- idealerweise 4 Jahre Laufzeit, keine Anzahlung
- wir sind nicht für die Bundesförderung berechtigt
- Leasingrate bei maximal 250€ 
- Muss kein Neuwagen sein
Über einen näheren Austausch freue ich mich sehr.
 
Vielen Dank vorab!
 
Mit freundlichen Grüßen
 
Patrick Budde`;

function emptyLead() {
  return {
    id: 'lead-budde',
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

{
  const interpreted = interpretSellerInput(MAIL);
  const accepted = applyAcceptedSellerTurn(emptyLead(), {
    extractedFacts: interpreted.facts,
    sellerInput: MAIL,
    preparedActions: [],
    intents: interpreted.intents || [],
  }, { postFeedCard: false });
  assert.equal(accepted.ok, true);
  const lead = accepted.lead;
  const fields = Object.fromEntries(interpreted.facts.map((f) => [f.field, f]));
  const profile = getNeedProfileFromLead(lead);
  const name = String(lead.contact?.name || lead.name || '');

  assert.match(name, /Patrick\s+Budde/i);
  assert.equal(fields.fuelPreference?.value || profile.fuel, 'electric');
  assert.equal(fields.paymentType?.value || lead.wish?.paymentType, 'leasing');
  assert.equal(Number(fields.termMonths?.value || lead.wish?.termMonths), 48);
  assert.equal(Number(fields.annualMileage?.value || lead.wish?.mileagePerYear), 15000);
  assert.equal(Number(fields.downPayment?.value ?? lead.wish?.downPayment), 0);
  assert.equal(Number(fields.monthlyBudget?.value), 250);
  assert.equal(fields.subsidyEligibility?.value?.eligible, false);
  assert.ok(
    !interpreted.facts.some((f) => f.field === 'openCustomerQuestion' && f.value?.topic === 'subsidy'),
    'keine Fake-Förder-Offenfrage',
  );
  assert.equal(fields.vehicleConditionPreference?.value?.usedOk, true);
  assert.ok(!profile.selectedModelKey);
  assert.ok(!fields.vehicleInterest?.value?.modelKey);

  assert.equal(listCustomerVehicleTracks(lead).length, 0);
  assert.equal(Object.keys(getCleverWorkingState(lead).offerDrafts || {}).length, 0);
  assert.equal(resolveActiveOfferDraft({ lead }), null);

  const briefing = buildSellerWorkBriefing({
    lead,
    facts: interpreted.facts,
    draft: null,
  });
  assert.equal(briefing.nextBestAction?.id, NEXT_BEST_ACTION_ID.CONSULTATION);
  assert.match(String(briefing.nextBestAction?.label || briefing.sections?.nextStep || ''), /Passende Fahrzeuge|finden|Beratung/i);
  assert.match(briefing.text, /Elektro|E-Auto|Leasing/i);
  assert.match(briefing.text, /250/);
  assert.match(briefing.text, /Bundesförderung|kein Neuwagen/i);
  assert.ok(!/E-Auto-Förderung 2026/i.test(briefing.text));

  console.log('✓ Budde Consultation Golden');
}

console.log('\nBudde EV Leasing Consult Golden: OK');
