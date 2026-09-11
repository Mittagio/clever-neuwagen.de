/**
 * Deuschle – Confirmation Case (kein Pattern-Freeze)
 *
 * Neues Muster? nein
 * Regression-/Bestätigungsfall: ja
 *
 * Bestätigt: kompakte Händlernotiz + Alias-Shorthand
 * (Kontakt + EV4 Air 48/15 weiß → ein Draft, Rate null, paymentType offen ohne Leasingwort,
 *  Mobiltelefon 0175… nicht als 01758…).
 *
 * Korpus-Klassen:
 * - Pattern-Freeze = neues Prozessmuster
 * - Confirmation Case = bestehendes Muster / Regressionsschutz (dieser Fall)
 *
 * node src/services/cleverSeller/deuschleEv4AirNote.golden.test.js
 */
import assert from 'node:assert/strict';
import { interpretSellerInput } from './interpretSellerInput.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { buildSellerWorkBriefing } from './buildSellerWorkBriefing.js';
import { NEXT_BEST_ACTION_ID } from './determineNextBestSellerAction.js';
import { getNeedProfileFromLead } from '../consultation/needProfileService.js';
import { listCustomerVehicleTracks } from '../crm/vehicleTrack.js';
import { getCleverWorkingState, resolveActiveOfferDraft } from './cleverWorkingDraft.js';
import { parseCustomerPhone } from '../dealerAiParser.js';

const NOTE = `Christina Deuschle 
c.deuschle79@web.de
0175 8787458 

EV4 AIR 48 15.000 km 
weiß`;

function emptyLead() {
  return {
    id: 'lead-deuschle',
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
  assert.equal(parseCustomerPhone('0175 8787458'), '0175 8787458');
  assert.ok(!/01758/.test(String(parseCustomerPhone('0175 8787458') || '')));
  console.log('✓ Phone 0175 bleibt 0175 (nicht 01758)');
}

{
  const interpreted = interpretSellerInput(NOTE);
  const accepted = applyAcceptedSellerTurn(emptyLead(), {
    extractedFacts: interpreted.facts,
    sellerInput: NOTE,
    preparedActions: [],
    intents: interpreted.intents || [],
  }, { postFeedCard: false });
  assert.equal(accepted.ok, true);
  const lead = accepted.lead;
  const fields = Object.fromEntries(
    interpreted.facts.filter((f) => f.field).map((f) => [f.field, f]),
  );
  const profile = getNeedProfileFromLead(lead);
  const name = String(lead.contact?.name || lead.name || '');
  const phoneFacts = interpreted.facts.filter((f) => f.field === 'phone' || f.field === 'mobile');
  const phoneOnLead = String(lead.contact?.phone || '');

  assert.match(name, /Christina\s+Deuschle/i);
  assert.match(String(lead.contact?.email || fields.email?.value || ''), /c\.deuschle79@web\.de/i);

  assert.equal(phoneFacts.length, 1, 'kein Doppel-Telefon mit anderer Formatierung');
  assert.match(String(phoneFacts[0].label || ''), /^0175\s/);
  assert.ok(!/01758/.test(String(phoneFacts[0].label || '')));
  assert.match(phoneOnLead, /^0175\s/);
  assert.ok(!/01758/.test(phoneOnLead));
  assert.equal(String(phoneFacts[0].value || '').replace(/\D/g, ''), '01758787458');

  assert.equal(fields.vehicleInterest?.value?.modelKey || profile.selectedModelKey, 'ev4');
  assert.match(String(fields.vehicleInterest?.value?.trim || fields.vehicleInterest?.label || ''), /Air/i);
  assert.equal(Number(fields.termMonths?.value || lead.wish?.termMonths), 48);
  assert.equal(Number(fields.annualMileage?.value || lead.wish?.mileagePerYear), 15000);
  assert.match(String(fields.colorPreference?.label || fields.colorPreference?.value?.color || ''), /Wei(ss|ß)/i);

  assert.equal(listCustomerVehicleTracks(lead).length, 1);
  const drafts = Object.values(getCleverWorkingState(lead).offerDrafts || {});
  assert.equal(drafts.length, 1);
  const draft = resolveActiveOfferDraft({ lead }) || drafts[0];
  assert.equal(draft?.monthlyRate ?? draft?.rate ?? null, null);

  const briefing = buildSellerWorkBriefing({
    lead,
    facts: interpreted.facts,
    draft,
  });
  assert.equal(briefing.nextBestAction?.id, NEXT_BEST_ACTION_ID.PREPARE_OFFER);
  assert.match(briefing.text, /EV4/i);
  assert.match(briefing.text, /Air/i);
  assert.match(briefing.text, /Wei(ss|ß)|weiß/i);
  assert.match(briefing.text, /48/);
  assert.match(briefing.text, /15\.000|15000/);

  console.log('✓ Deuschle EV4 Air Note Golden');
}

console.log('\nDeuschle EV4 Air Note Golden: OK');
