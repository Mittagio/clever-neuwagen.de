/**
 * Freitext EV4 bei bestehendem EV3-Track → aktiver Track + Modell EV4.
 * PDF-Grounding darf aktiven Fokus nicht still überschreiben.
 */
import assert from 'node:assert/strict';
import { interpretSellerInput } from './interpretSellerInput.js';
import {
  applyAcceptedSellerTurn,
  applyStructuredFactsToLead,
} from './applyAcceptedSellerTurn.js';
import { buildVehicleOpportunityCards } from '../customerAkte.js';
import {
  ensureVehicleTrack,
  focusVehicleInterestOnLead,
  listCustomerVehicleTracks,
  VEHICLE_TRACK_STATUS,
} from '../crm/vehicleTrack.js';
import { getNeedProfileFromLead } from '../consultation/needProfileService.js';
import { runComposerPdfAttachTurn } from './runComposerPdfAttachTurn.js';
import { buildUniversalReviewModel } from './buildUniversalReviewModel.js';
import {
  extractSellerFactsFromOfferPdfText,
  reconcileOfferPdfVehicleInterestWithLead,
} from './mapMagicOfferIntentToSellerFacts.js';
import { parseMagicOfferIntent } from '../dealer/magicOfferIntentParser.js';

function leadWithEv3() {
  let lead = {
    id: 'lead-koenig',
    name: 'Cederic König',
    contact: { name: 'Cederic König', kind: 'private' },
    vehicle: { brand: 'Kia', model: 'EV3', modelKey: 'ev3', label: 'Kia EV3' },
    crm: {
      needProfile: { selectedModelKey: 'ev3', modelHint: 'ev3' },
      vehicleConfigurations: [],
      vehicleOffers: {},
    },
  };
  const ensured = ensureVehicleTrack(lead, {
    vehicleKey: 'kia-ev3',
    displayName: 'Kia EV3',
    model: 'EV3',
    modelKey: 'ev3',
  });
  lead = ensured.lead;
  lead = {
    ...lead,
    crm: {
      ...lead.crm,
      vehicleConfigurations: (lead.crm.vehicleConfigurations || []).map((c) => (
        c.id === ensured.trackId
          ? {
            ...c,
            vehicleTrack: {
              ...(c.vehicleTrack || {}),
              status: VEHICLE_TRACK_STATUS.ACTIVE,
            },
          }
          : c
      )),
    },
  };
  return lead;
}

{
  const interpreted = interpretSellerInput('EV4');
  const fact = interpreted.facts.find((f) => f.field === 'vehicleInterest');
  assert.ok(fact, 'EV4 erkannt');
  assert.equal(fact.needsConfirmation, false);
  assert.equal(fact.value?.modelKey, 'ev4');

  const before = leadWithEv3();
  const after = applyStructuredFactsToLead(before, [fact]);
  const profile = getNeedProfileFromLead(after);
  assert.equal(profile.selectedModelKey, 'ev4', 'Need-Profile folgt EV4');
  assert.match(String(after.vehicle?.model || ''), /EV4/i, 'lead.vehicle → EV4');

  const tracks = listCustomerVehicleTracks(after);
  const ev4 = tracks.find((t) => /ev4/i.test(t.modelLabel) || /ev4/i.test(t.vehicleKey));
  const ev3 = tracks.find((t) => /ev3/i.test(t.modelLabel) || /ev3/i.test(t.vehicleKey));
  assert.ok(ev4, 'EV4-Spur vorhanden');
  assert.equal(ev4.status, VEHICLE_TRACK_STATUS.ACTIVE, 'EV4 aktiv');
  assert.equal(after.crm?.focusedVehicleTrackId, ev4.id, 'focusedVehicleTrackId = EV4');
  assert.ok(ev3, 'EV3 bleibt erhalten');
  assert.equal(ev3.status, VEHICLE_TRACK_STATUS.OPEN, 'EV3 demoted');

  const cards = buildVehicleOpportunityCards({ lead: after });
  assert.match(String(cards[0]?.modelName || cards[0]?.modelKey || ''), /EV4/i, 'Primary Card = EV4');
  console.log('✓ Freitext EV4 wechselt aktiven Track von EV3');
}

{
  const focused = focusVehicleInterestOnLead(leadWithEv3(), {
    modelKey: 'ev4',
    model: 'EV4',
    label: 'Kia EV4',
  });
  assert.match(String(focused.lead.vehicle?.label || ''), /EV4/i);
  assert.ok(focused.trackId);
  console.log('✓ focusVehicleInterestOnLead EV4');
}

{
  // Lead mit aktivem EV4 + PDF grounded EV3 → Apply ohne Model-Switch behält EV4
  let lead = leadWithEv3();
  const focused = focusVehicleInterestOnLead(lead, {
    modelKey: 'ev4',
    model: 'EV4',
    label: 'Kia EV4',
  });
  lead = focused.lead;

  const pdfText = `Kia EV3 Air Leasingangebot
Laufzeit 36 Monate
15.000 km / Jahr
Anzahlung 0 €
Monatsrate 329 €`;

  const { turn } = runComposerPdfAttachTurn({
    extracted: {
      ok: true,
      text: pdfText,
      fileName: 'EV3 Air 36 15000.pdf',
    },
    file: { type: 'application/pdf', name: 'EV3 Air 36 15000.pdf' },
    lead,
    leadsSnapshot: [lead],
    scopeHint: 'customer_akte',
    customerName: 'Cederic König',
  });

  assert.ok(turn, 'PDF-Turn erzeugt');
  const conflict = turn.extractedFacts?.find((f) => (
    f.field === 'vehicleInterest' && f.value?.conflictWithActive
  ));
  assert.ok(conflict, 'PDF↔Akte Modellkonflikt erkannt');
  assert.match(String(conflict.label || ''), /PDF:.*EV3/i);
  assert.match(String(conflict.label || ''), /Akte:.*EV4/i);
  assert.equal(conflict.needsConfirmation, true);
  assert.equal(conflict.value?.activeModelKey, 'ev4');
  assert.equal(conflict.value?.preserveActiveFocus, true);

  const review = turn.reviewModel || buildUniversalReviewModel(turn);
  assert.ok(
    review?.conflictBox?.body || turn.warnings?.some((w) => /EV3.*EV4|PDF:/i.test(w)),
    'Review/Warning zeigt Modellkonflikt',
  );

  const applied = applyAcceptedSellerTurn(lead, turn, { postFeedCard: false });
  assert.equal(applied.ok, true);
  const profile = getNeedProfileFromLead(applied.lead);
  assert.equal(profile.selectedModelKey, 'ev4', 'Need-Profile bleibt EV4 nach PDF-Apply');
  assert.match(String(applied.lead.vehicle?.model || ''), /EV4/i, 'lead.vehicle bleibt EV4');

  const tracks = listCustomerVehicleTracks(applied.lead);
  const ev4 = tracks.find((t) => /ev4/i.test(t.modelLabel) || /ev4/i.test(t.vehicleKey));
  assert.ok(ev4);
  assert.equal(ev4.status, VEHICLE_TRACK_STATUS.ACTIVE, 'EV4 bleibt aktiv');
  assert.equal(applied.lead.crm?.focusedVehicleTrackId, ev4.id);

  const cards = buildVehicleOpportunityCards({ lead: applied.lead });
  assert.match(String(cards[0]?.modelName || cards[0]?.modelKey || ''), /EV4/i, 'Primary Card bleibt EV4');

  // Konditionen aus PDF dürfen trotzdem ankommen
  assert.equal(applied.lead.wish?.termMonths, 36);
  assert.equal(applied.lead.wish?.mileagePerYear, 15000);
  console.log('✓ PDF EV3 bei aktivem EV4: Fokus bleibt, Konflikt in Review');
}

{
  // Brutto/Netto: Netto-Rate nicht still als Brutto-Wunschrate
  const intent = parseMagicOfferIntent('Kia EV4 Leasing Monatsrate 276,47 € netto 36 Monate 10.000 km');
  assert.equal(intent.commercialInput.monthlyRate, 276.47);
  assert.equal(intent.commercialInput.monthlyRateBasis, 'net');

  const facts = extractSellerFactsFromOfferPdfText(
    'Kia EV4 Leasing Monatsrate 276,47 € netto 36 Monate 10.000 km',
  );
  const rateFact = facts.find((f) => f.field === 'monthlyBudget');
  assert.ok(rateFact);
  assert.equal(rateFact.value?.basis, 'net');
  assert.equal(rateFact.needsConfirmation, true);
  assert.match(String(rateFact.label || ''), /Netto/i);

  const lead = {
    id: 'lead-net',
    name: 'Test',
    wish: {},
    crm: { needProfile: { selectedModelKey: 'ev4' } },
  };
  // Simulate accepted turn that cleared needsConfirmation but kept basis
  const after = applyStructuredFactsToLead(lead, [{
    ...rateFact,
    needsConfirmation: false,
  }]);
  assert.equal(after.desiredRate, undefined);
  assert.equal(after.wish?.desiredRate, undefined);
  assert.equal(after.crm?.needProfile?.finance?.monthlyRateNet, 276.47);

  const grossIntent = parseMagicOfferIntent('Monatsrate brutto 329 €');
  assert.equal(grossIntent.commercialInput.monthlyRate, 329);
  assert.equal(grossIntent.commercialInput.monthlyRateBasis, 'gross');
  console.log('✓ Netto-Rate Guard (nicht als Brutto-Wunschrate)');
}

{
  // reconcile unit: ohne Lead-Fokus → kein Konflikt
  const facts = extractSellerFactsFromOfferPdfText('Kia EV3 Air Leasing 36 Monate 15000 km Rate 300 €');
  const plain = reconcileOfferPdfVehicleInterestWithLead(facts, {});
  assert.equal(plain.find((f) => f.field === 'vehicleInterest')?.value?.conflictWithActive, undefined);
}

console.log('vehicleInterestFocus.golden ok');
