/**
 * Kaiser Real-World – Outbound-Leasingangebot Paste
 * node src/services/cleverSeller/kaiserOutboundOffer.golden.test.js
 */
import assert from 'node:assert/strict';
import { interpretSellerInput } from './interpretSellerInput.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { buildSellerWorkBriefing } from './buildSellerWorkBriefing.js';
import {
  NEXT_BEST_ACTION_ID,
  findSendableVehicleOffer,
} from './determineNextBestSellerAction.js';
import { getNeedProfileFromLead } from '../consultation/needProfileService.js';
import { RATE_AUTHORITY } from './captureThenOffer.js';
import { parseCommercialDownPayment } from './commercialOfferNl.js';

const KAISER_TEXT = `Guten Tag Frau Kaiser,
vielen Dank für Ihre Rückmeldung.
Ihr persönliches Leasingangebot für den Kia EV2 Air (42,2 kWh) habe ich für Sie vorbereitet. Sie können es direkt über den folgenden Link öffnen:
Zum Leasingangebot: 
Fahrzeugdetails – Kia EV2 Air
•	42,2 kWh Batterie
•	Farbe: Carraraweiß
•	Innenausstattung: Stoff Anthrazit
•	Gesamtlistenpreis inkl. Ausstattung: 29.379,99 EUR
•	Elektro, 1-Gang Automatik, 5-Türer SUV
Leasingkonditionen gemäß Ihrer Anfrage
•	5.000 km pro Jahr
•	36 Monate Laufzeit
•	0 EUR Anzahlung`;

function emptyLead(id = 'lead-kaiser') {
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
  assert.equal(parseCommercialDownPayment('0 EUR Anzahlung'), 0);
  assert.equal(parseCommercialDownPayment('0 € Anzahlung'), 0);
  assert.equal(parseCommercialDownPayment('ohne Anzahlung'), 0);
  console.log('✓ AZ-Parser: 0 EUR / 0 € / ohne');
}

{
  // GOLDEN Basis – Capture
  const { lead, interpreted } = applyText(emptyLead('kaiser-base'), KAISER_TEXT);
  const fields = Object.fromEntries(interpreted.facts.map((f) => [f.field, f]));
  const profile = getNeedProfileFromLead(lead);

  assert.match(String(fields.customerName?.value || fields.customerName?.label || ''), /Kaiser/i);
  assert.equal(fields.vehicleInterest?.value?.modelKey, 'ev2');
  assert.match(String(fields.vehicleInterest?.value?.trim || ''), /Air/i);
  assert.ok(fields.batteryPreference || /42/i.test(String(fields.motorPreference?.label || '')));
  assert.match(
    String(
      fields.colorPreference?.value?.color
      || fields.colorPreference?.value
      || fields.colorPreference?.label
      || profile.colorPreference
      || '',
    ),
    /carraraweiß|carraraweiss/i,
  );
  assert.equal(fields.paymentType?.value, 'leasing');
  assert.equal(Number(fields.termMonths?.value), 36);
  assert.equal(Number(fields.annualMileage?.value), 5000);
  assert.equal(Number(fields.downPayment?.value), 0);
  assert.equal(lead.wish?.downPayment, 0);
  assert.ok(fields.preparedOutboundOffer?.value === true);
  assert.equal(profile.preparedOutboundOffer, true);
  assert.equal(profile.selectedModelKey, 'ev2');

  const briefing = buildSellerWorkBriefing({
    lead,
    facts: interpreted.facts,
    sellerInput: KAISER_TEXT,
  });
  assert.notEqual(briefing.nextBestAction?.handler, 'prepare_offer');
  assert.notEqual(briefing.nextBestAction?.label, 'Angebot vorbereiten');
  assert.equal(briefing.nextBestAction?.handler, 'draft_message');
  assert.equal(briefing.nextBestAction?.label, 'Nachricht prüfen');
  assert.match(String(briefing.sections?.leasingWish || ''), /0\s*€/);
  console.log('✓ GOLDEN Basis – Capture + kein prepare_offer');
}

{
  // CTA GOLDEN A – sendbares VehicleOffer
  let { lead, interpreted } = applyText(emptyLead('kaiser-a'), KAISER_TEXT);
  lead = {
    ...lead,
    crm: {
      ...lead.crm,
      vehicleOffers: [{
        id: 'vo_ev2',
        monthlyRate: 289,
        rateAuthority: RATE_AUTHORITY.AUTHORITATIVE,
        paymentType: 'leasing',
        boardOffer: {
          payment: { monthlyRate: 289, type: 'leasing' },
          rateAuthority: RATE_AUTHORITY.AUTHORITATIVE,
        },
      }],
    },
  };
  assert.ok(findSendableVehicleOffer(lead), 'sendbares Offer');
  const briefing = buildSellerWorkBriefing({ lead, facts: interpreted.facts });
  assert.equal(briefing.nextBestAction?.id, NEXT_BEST_ACTION_ID.INTEND_SEND);
  assert.equal(briefing.nextBestAction?.label, 'An Kunden senden');
  assert.notEqual(briefing.nextBestAction?.handler, 'prepare_offer');
  console.log('✓ CTA GOLDEN A – An Kunden senden');
}

{
  // CTA GOLDEN B – kein sendbares Offer → Message-Handoff
  const { lead, interpreted } = applyText(emptyLead('kaiser-b'), KAISER_TEXT);
  assert.equal(findSendableVehicleOffer(lead), null);
  const briefing = buildSellerWorkBriefing({ lead, facts: interpreted.facts });
  assert.equal(briefing.nextBestAction?.handler, 'draft_message');
  assert.equal(briefing.nextBestAction?.label, 'Nachricht prüfen');
  assert.notEqual(briefing.nextBestAction?.handler, 'intend_send');
  assert.notEqual(briefing.nextBestAction?.handler, 'prepare_offer');
  console.log('✓ CTA GOLDEN B – Nachricht prüfen');
}

console.log('kaiserOutboundOffer.golden ok');
