/**
 * Ehrlich – Sportage Vision Diesel Bar / Abrufschein (Structured Lead Note)
 * node src/services/cleverSeller/ehrlichSportageBar.golden.test.js
 */
import assert from 'node:assert/strict';
import { interpretSellerInput } from './interpretSellerInput.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { buildSellerWorkBriefing } from './buildSellerWorkBriefing.js';
import { NEXT_BEST_ACTION_ID } from './determineNextBestSellerAction.js';
import { getNeedProfileFromLead } from '../consultation/needProfileService.js';
import { listCustomerVehicleTracks } from '../crm/vehicleTrack.js';
import { getCleverWorkingState, resolveActiveOfferDraft } from './cleverWorkingDraft.js';

const TEXT = `Ehrlich 0173 9807581
KIA SPORTAGE 
BAR
Murrhardt Wiesenstraße 51 71540 0173 9807581 
ehrlich-andreas@t-online.de 

DIESEL MANUELL
VISION
136 PS
ABRUFSCHEIN

BIS 37000 €`;

function emptyLead() {
  return {
    id: 'lead-ehrlich',
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
  const interpreted = interpretSellerInput(TEXT);
  const accepted = applyAcceptedSellerTurn(emptyLead(), {
    extractedFacts: interpreted.facts,
    sellerInput: TEXT,
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

  assert.match(name, /Ehrlich/i);
  assert.ok(!/DIESEL|MANUELL/i.test(name), `kein Fake-Name, war: ${name}`);
  assert.match(name, /Andreas/i);

  assert.equal(fields.vehicleInterest?.value?.modelKey || profile.selectedModelKey, 'sportage');
  assert.ok(
    /vision/i.test(String(fields.vehicleInterest?.value?.trim || fields.trimPreference?.label || '')),
    'Vision',
  );
  assert.equal(fields.fuelPreference?.value || profile.fuel, 'diesel');
  assert.equal(fields.transmissionPreference?.value || profile.transmission, 'manual');
  assert.equal(fields.paymentType?.value || lead.wish?.paymentType, 'cash');
  assert.equal(Number(fields.purchasePrice?.value), 37000);
  assert.equal(fields.downPayment, undefined, 'bis 37000 ≠ AZ');
  assert.ok(fields.abrufschein?.value || profile.abrufschein === true, 'Abrufschein');
  assert.ok(lead.contact?.street || lead.crm?.customerAddress?.street, 'Straße');
  assert.ok(
    /71540/.test(JSON.stringify(lead.contact || {}))
    || /71540/.test(JSON.stringify(lead.crm?.customerAddress || {})),
    'PLZ',
  );
  assert.ok(
    /Murrhardt/i.test(JSON.stringify(lead.contact || {}))
    || /Murrhardt/i.test(JSON.stringify(lead.crm?.customerAddress || {})),
    'Ort',
  );

  const tracks = listCustomerVehicleTracks(lead);
  assert.equal(tracks.length, 1);
  const drafts = Object.values(getCleverWorkingState(lead).offerDrafts || {});
  assert.ok(drafts.length <= 1);
  const draft = resolveActiveOfferDraft({ lead }) || drafts[0] || null;
  assert.equal(draft?.monthlyRate ?? draft?.rate ?? null, null);

  const briefing = buildSellerWorkBriefing({ lead, facts: interpreted.facts, draft });
  assert.equal(briefing.nextBestAction?.id, NEXT_BEST_ACTION_ID.PREPARE_OFFER);
  assert.match(briefing.text, /Sportage|sportage/i);
  assert.match(briefing.text, /Kauf|Bar|bis\s+37/i);
  assert.ok(!/Leasing:\s*\n\s*37\.000\s*€\s*Sonderzahlung/i.test(briefing.text));
  assert.match(briefing.text, /Diesel|Manuell|Abrufschein|Vision/i);

  console.log('✓ Ehrlich Sportage Bar Golden');
}

console.log('\nEhrlich Sportage Bar Golden: OK');
