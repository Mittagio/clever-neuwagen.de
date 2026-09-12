/**
 * Pattern-Freeze: Free Speech / Dictation Intake V1 · Status: pilotfähig
 *
 * Neues Muster? ja
 * Freie Verkäufer-Diktate / lose Satzfetzen → strukturierter Verkaufsstand.
 *
 * Produktregeln:
 * Rolle vor Wert · Kontext vor Keyword · Spanne bleibt Spanne
 * Bestandsfahrzeug ≠ Wunsch · persönliche Notiz ≠ Fahrzeugmerkmal
 * Commercial ohne Modell → Consultation, kein Concept Draft
 *
 * Keine Sonderregeln nur für Dirk Brandes.
 * Keine neuen künstlichen Diktatfälle erfinden.
 *
 * node --test src/services/cleverSeller/brandesFreeSpeech.golden.test.js
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { interpretSellerInput } from './interpretSellerInput.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { buildSellerWorkBriefing } from './buildSellerWorkBriefing.js';
import { getNeedProfileFromLead } from '../consultation/needProfileService.js';
import { listCustomerVehicleTracks } from '../crm/vehicleTrack.js';
import {
  getCleverWorkingState,
  resolveActiveOfferDraft,
} from './cleverWorkingDraft.js';
import { NEXT_BEST_ACTION_ID } from './determineNextBestSellerAction.js';

const ENV = {
  VITE_CLEVER_SELLER_ORCHESTRATOR: 'true',
  CLEVER_SELLER_ORCHESTRATOR: 'true',
};

const DUMP = `Dirk Brandes Bestandskunde fährt aktuell einen SsangYong Tivoli.

Vertrag läuft im November 2026 aus.

Fährt ungefähr 10.000 Kilometer im Jahr.

Will wieder leasen, entweder drei oder vier Jahre.

Wunschrate so um die 350 Euro.

Anzahlung irgendwo zwischen 1.000 und 3.000 Euro.

AHK wäre wichtig.

Hat zwei Kinder und einen Hund, ist verheiratet.

Nettoeinkommen ungefähr zweieinhalb bis dreitausend Euro.

Kaffee trinkt er schwarz.

Auto muss noch nicht feststehen.

Vielleicht eher Elektro, aber erstmal schauen was passt.`;

function emptyLead(id = 'lead-brandes-freespeech') {
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

function factsByField(facts, field) {
  return (facts || []).filter((f) => f.field === field);
}

function applyTurn(lead, sellerInput) {
  const turn = runCleverSellerTurn({ lead, sellerInput, env: ENV });
  const applied = applyAcceptedSellerTurn(lead, turn, { postFeedCard: false });
  return { lead: applied.lead, facts: turn.extractedFacts || [], turn };
}

describe('Free Speech / Dictation Intake V1 – Brandes', () => {
  it('T0 Dump: Bestand, Spannen, Consultation, kein Draft, Kaffee≠Farbe', () => {
    const interpreted = interpretSellerInput(DUMP);
    const fields = Object.fromEntries(
      interpreted.facts.map((f) => [f.field, f]),
    );

    assert.match(String(fields.customerName?.value || ''), /Dirk\s+Brandes/i);
    assert.equal(fields.customerContext?.value, 'existing_customer');

    assert.match(String(fields.existingVehicle?.label || ''), /SsangYong/i);
    assert.match(String(fields.existingVehicle?.label || ''), /Tivoli/i);
    assert.ok(!fields.vehicleInterest, 'kein vehicleInterest=Tivoli');
    assert.ok(!fields.tradeInRequested && !fields.tradeInVehicle, 'kein Fake-Trade-in');

    assert.equal(fields.existingContractEnd?.value?.endDate, '2026-11');
    assert.equal(Number(fields.annualMileage?.value), 10000);
    assert.equal(fields.paymentType?.value, 'leasing');

    const variants = fields.termMonthsVariants?.value || [];
    assert.deepEqual([...variants].map(Number).sort((a, b) => a - b), [36, 48]);
    assert.equal(Number(fields.monthlyBudget?.value), 350);
    assert.equal(Number(fields.downPaymentRange?.value?.min), 1000);
    assert.equal(Number(fields.downPaymentRange?.value?.max), 3000);
    assert.ok(!fields.downPayment, 'keine Fake-Einzel-AZ');

    assert.ok(fields.towHitchRequired?.value === true || /ahk/i.test(fields.towHitchRequired?.label || ''));
    assert.equal(Number(fields.childrenCount?.value), 2);
    assert.ok(fields.pet?.value?.type === 'dog' || /hund/i.test(fields.pet?.label || ''));
    assert.equal(fields.maritalStatus?.value, 'married');

    assert.equal(Number(fields.monthlyNetIncomeRange?.value?.min), 2500);
    assert.equal(Number(fields.monthlyNetIncomeRange?.value?.max), 3000);
    assert.match(String(fields.personalNote?.label || ''), /kaffee\s+schwarz/i);
    assert.ok(!fields.colorPreference, 'Kaffee schwarz ≠ Farbe');
    assert.ok(!interpreted.facts.some((f) => f.field === 'color' && /schwarz/i.test(String(f.label))), 'kein Legacy-color');

    const fuel = fields.fuelPreference;
    assert.ok(fuel);
    assert.ok(
      fuel.value === 'electric'
      || fuel.value?.preference === 'electric'
      || fuel.value?.soft === true
      || /elektro/i.test(String(fuel.label)),
    );
    assert.ok(fuel.needsConfirmation === true || fuel.value?.soft === true || /eher/i.test(String(fuel.label)));

    const applied = applyAcceptedSellerTurn(emptyLead(), {
      extractedFacts: interpreted.facts,
      sellerInput: DUMP,
      preparedActions: [],
      intents: interpreted.intents || [],
    }, { postFeedCard: false });

    const lead = applied.lead;
    const profile = getNeedProfileFromLead(lead);
    assert.equal(profile.selectedModelKey ?? null, null);
    assert.equal(listCustomerVehicleTracks(lead).length, 0);
    assert.equal(Object.keys(getCleverWorkingState(lead).offerDrafts || {}).length, 0);

    const briefing = buildSellerWorkBriefing({ lead, facts: interpreted.facts });
    assert.equal(briefing.nextBestAction?.handler, 'consultation');
    assert.match(String(briefing.nextBestAction?.label || ''), /Passende Fahrzeuge finden/i);
    assert.ok(
      briefing.nextBestAction?.id === NEXT_BEST_ACTION_ID.CONSULTATION
      || briefing.nextBestAction?.handler === 'consultation',
    );

    const draft = resolveActiveOfferDraft({ lead });
    assert.equal(draft?.rate ?? draft?.monthlyRate ?? null, null);
  });

  it('Folgetests: Korrektur → EV5 Draft → AHK entfernen', () => {
    let state = applyTurn(emptyLead(), DUMP);
    let lead = state.lead;

    state = applyTurn(lead, 'Ach nee, lieber vier Jahre und wenn möglich maximal 330 Euro Rate.');
    lead = state.lead;
    assert.equal(Number(lead.wish?.termMonths), 48);
    assert.equal(Number(factsByField(state.facts, 'monthlyBudget')[0]?.value), 330);
    assert.equal(Number(lead.wish?.desiredRate ?? lead.desiredRate), 330);
    assert.deepEqual(
      [...(getNeedProfileFromLead(lead).termMonthsVariants || [])].map(Number).sort((a, b) => a - b),
      [36, 48],
    );
    assert.equal(Object.keys(getCleverWorkingState(lead).offerDrafts || {}).length, 0);
    assert.equal(
      buildSellerWorkBriefing({ lead, facts: state.facts }).nextBestAction?.handler,
      'consultation',
    );

    state = applyTurn(lead, 'Nimm mal den EV5 Earth, der könnte passen.');
    lead = state.lead;
    const profile = getNeedProfileFromLead(lead);
    assert.equal(String(profile.selectedModelKey || '').toLowerCase(), 'ev5');
    assert.match(String(lead.crm?.existingVehicle?.model || lead.crm?.existingVehicle?.label || ''), /Tivoli/i);
    const tracks = listCustomerVehicleTracks(lead);
    assert.equal(tracks.length, 1, 'genau ein aktiver Track');
    const drafts = Object.values(getCleverWorkingState(lead).offerDrafts || {});
    assert.equal(drafts.length, 1);
    const draft = resolveActiveOfferDraft({ lead }) || drafts[0];
    assert.match(
      String(
        draft?.vehicleIdentityDraft?.model?.canonical
        || draft?.vehicleIdentityDraft?.modelKey
        || draft?.modelKey
        || profile.selectedModelKey
        || '',
      ).toLowerCase(),
      /ev5/,
    );
    assert.equal(draft?.rate ?? draft?.monthlyRate ?? null, null);
    assert.equal(buildSellerWorkBriefing({ lead, facts: [] }).nextBestAction?.handler, 'prepare_offer');
    assert.match(String(lead.crm?.existingVehicle?.model || lead.crm?.existingVehicle?.label || ''), /Tivoli/i);
    state = applyTurn(lead, 'AHK doch nicht, braucht er nicht.');
    lead = state.lead;
    assert.equal(getNeedProfileFromLead(lead).towbar, false);
    assert.equal(Object.keys(getCleverWorkingState(lead).offerDrafts || {}).length, 1);
    assert.equal(listCustomerVehicleTracks(lead).length, 1);
  });
});
