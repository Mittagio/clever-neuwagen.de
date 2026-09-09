/**
 * Clever Agent V1 – E2E Capture Golden
 *
 * „Kunde möchte einen EV3 Long Range in schwarz, 36 Monate und 15.000 km.“
 *
 * node --test src/services/cleverSeller/interpretCleverInput.golden.test.js
 */
import assert from 'node:assert/strict';
import { createEmptyNeedProfile, getNeedProfileFromLead } from '../consultation/needProfileService.js';
import {
  interpretCleverInput,
  applyInterpretedCleverCapture,
  buildSellerWorkBriefing,
} from './interpretCleverInput.js';
import { getOfferDraftById, buildHandoffFromOfferDraftId } from './cleverWorkingDraft.js';
import { enrichPrepareOfferPayloadWithIdentityDraft } from './vehicleIdentityDraft.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { getTradeIn } from '../customerAkteTradeIn.js';
import { magicPreparationToConfigurePatch } from '../dealer/magicOfferService.js';

function baseLead() {
  return {
    id: 'lead-clever-agent-v1',
    name: 'Herr Müller',
    contact: { name: 'Herr Müller' },
    crm: {
      needProfile: createEmptyNeedProfile(),
      vehicleConfigurations: [],
      vehicleOffers: {},
      sellerInsights: [],
    },
  };
}

{
  const text = 'Kunde möchte einen EV3 Long Range in schwarz, 36 Monate und 15.000 km.';
  const lead0 = baseLead();
  const interpretation = interpretCleverInput({ text, lead: lead0 });

  assert.equal(interpretation.intent, 'capture_customer_information');
  assert.equal(interpretation.extractedData.vehicle.modelKey, 'ev3');
  assert.match(String(interpretation.extractedData.vehicle.variant || ''), /Long\s*Range/i);
  assert.match(String(interpretation.extractedData.vehicle.color || ''), /schwarz/i);
  assert.equal(interpretation.extractedData.leasing.durationMonths, 36);
  assert.equal(interpretation.extractedData.leasing.annualMileage, 15000);
  assert.equal(interpretation.extractedData.leasing.rate, null);

  // Keine erfundenen Trims / Pakete / Raten
  const facts = interpretation.extractedData.facts || [];
  assert.ok(!facts.some((f) => f.field === 'monthlyLeasingRate' || f.field === 'monthlyRate'));
  assert.ok(!facts.some((f) => (
    f.field === 'trimPreference'
    && /earth|air|gt-?line/i.test(String(f.label || f.value || ''))
  )));

  const applied = applyInterpretedCleverCapture(lead0, interpretation, {
    sellerInput: text,
    prepareOfferDraft: true,
  });
  const lead = applied.lead;
  const profile = getNeedProfileFromLead(lead);

  assert.equal(profile.selectedModelKey, 'ev3');
  assert.match(String(profile.colorPreference || ''), /schwarz/i);
  assert.match(String(profile.motorPreference || ''), /Long\s*Range/i);
  assert.equal(lead.wish?.termMonths, 36);
  assert.equal(lead.wish?.mileagePerYear, 15000);
  assert.ok(lead.desiredRate == null || lead.desiredRate === '', 'keine Wunschrate erfunden');

  assert.ok(applied.offerDraftId, 'Concept Offer Draft angelegt');
  const draft = getOfferDraftById(lead, applied.offerDraftId);
  assert.ok(draft, 'Draft persistiert');
  assert.equal(draft.monthlyRate ?? draft.rate ?? null, null);
  assert.equal(draft.payment?.calculatedRate ?? null, null);
  assert.equal(draft.offerPreview?.monthlyRate ?? null, null);
  assert.match(String(draft.vehicleIdentityDraft?.model?.canonical || draft.vehicleIdentityDraft?.model?.raw || ''), /ev3/i);
  assert.match(String(draft.vehicleIdentityDraft?.powertrainVariant?.raw || ''), /Long\s*Range/i);
  assert.match(String(draft.vehicleIdentityDraft?.color?.raw || ''), /schwarz/i);
  assert.ok(
    !draft.vehicleIdentityDraft?.trim?.raw
    || draft.vehicleIdentityDraft?.trim?.status === 'open',
    'kein stilles Trim-Default',
  );

  assert.ok(applied.microConfirm, 'Micro-Confirm');
  assert.match(applied.microConfirm, /EV3/i);
  assert.match(applied.microConfirm, /Long\s*Range/i);
  assert.match(applied.microConfirm, /Rückgängig/i);

  console.log('✓ Clever Agent V1 – EV3 Long Range Capture E2E');
}

{
  // „EV3 Angebot“ = nur Modell, nichts erfinden
  const interpretation = interpretCleverInput({
    text: 'EV3 Angebot',
    lead: baseLead(),
  });
  assert.equal(interpretation.extractedData.vehicle.modelKey, 'ev3');
  assert.equal(interpretation.extractedData.vehicle.variant, null);
  assert.equal(interpretation.extractedData.vehicle.color, null);
  assert.equal(interpretation.extractedData.leasing.durationMonths, null);
  assert.equal(interpretation.extractedData.leasing.annualMileage, null);
  assert.equal(interpretation.extractedData.leasing.rate, null);
  console.log('✓ Clever Agent V1 – EV3 Angebot ohne Defaults');
}

{
  // Live-Pfad: Composer-Turn → Remember → Apply (keine parallele DB)
  const text = 'Kunde möchte einen EV3 Long Range in schwarz, 36 Monate und 15.000 km.';
  const lead0 = baseLead();
  const turn = runCleverSellerTurn({ lead: lead0, sellerInput: text });
  assert.ok(
    turn.rememberDecision?.mode === 'save_with_undo'
    || turn.rememberDecision?.mode === 'partial_save_with_undo',
  );
  assert.equal((turn.rememberDecision?.reviewFacts || []).length, 0, 'kein unnötiges Review');
  const facts = turn.rememberDecision?.safeFacts || turn.extractedFacts || [];
  const applied = applyAcceptedSellerTurn(lead0, {
    ...turn,
    extractedFacts: facts,
    sellerInput: text,
  }, { postFeedCard: false });
  const profile = getNeedProfileFromLead(applied.lead);
  assert.equal(profile.selectedModelKey, 'ev3');
  assert.match(String(profile.motorPreference || ''), /Long\s*Range/i);
  assert.equal(applied.lead.wish?.termMonths, 36);
  assert.equal(applied.lead.wish?.mileagePerYear, 15000);
  const draftId = applied.lead?.crm?.cleverWorkingState?.currentOfferDraftId;
  assert.ok(draftId);
  const draft = getOfferDraftById(applied.lead, draftId);
  assert.equal(draft?.monthlyRate ?? draft?.rate ?? null, null);
  assert.ok(!facts.some((f) => f.field === 'paymentType'), 'kein erfundenes paymentType');
  console.log('✓ Clever Agent V1 – Live Remember→Apply');
}

{
  // Golden 2: „Clever, Angebot EV3 Earth Up Drive Business.“
  const text = 'Clever, Angebot EV3 Earth Up Drive Business.';
  const lead0 = baseLead();
  const interpretation = interpretCleverInput({ text, lead: lead0 });

  assert.equal(interpretation.intent, 'prepare_offer_concept');
  assert.equal(interpretation.extractedData.vehicle.modelKey, 'ev3');
  assert.match(String(interpretation.extractedData.vehicle.trim || ''), /Earth/i);
  assert.equal(interpretation.extractedData.leasing.rate, null);
  assert.equal(interpretation.extractedData.leasing.durationMonths, null);
  assert.equal(interpretation.extractedData.leasing.annualMileage, null);
  assert.equal(interpretation.extractedData.leasing.downPayment, null);
  assert.equal(interpretation.extractedData.leasing.paymentType, null);
  assert.equal(interpretation.extractedData.vehicle.color, null);

  // Business → bestehende customerType-Struktur (Gewerbe), kein erfundenes Feld
  assert.equal(interpretation.extractedData.customer.customerType, 'business');

  const facts = interpretation.extractedData.facts || [];
  assert.ok(!facts.some((f) => f.field === 'paymentType'), 'kein erfundenes paymentType');
  assert.ok(!facts.some((f) => f.field === 'termMonths' || f.field === 'annualMileage'));
  assert.ok(!facts.some((f) => f.field === 'monthlyBudget' || f.field === 'downPayment'));

  const upDriveFact = facts.find((f) => (
    f.field === 'equipmentWish' && /up\s*-?\s*drive/i.test(String(f.label || f.value?.label || ''))
  ));
  assert.ok(upDriveFact, 'Up Drive erkannt');
  // EV3-Katalog hat kein „Up Drive“ → einzelner Review-Slot, Rest bleibt gültig
  assert.equal(upDriveFact.needsConfirmation, true, 'Up Drive als einzelner Review-Slot');
  assert.ok(
    (interpretation.conflicts || []).some((c) => /up\s*-?\s*drive/i.test(String(c.label || ''))),
    'Konflikt nur für Up Drive',
  );
  assert.ok(
    !(interpretation.conflicts || []).some((c) => c.field === 'vehicleInterest'),
    'kein globales Review wegen Modell',
  );

  // Live Offer-Pfad
  const turn = runCleverSellerTurn({ lead: lead0, sellerInput: text });
  assert.ok(
    (turn.intents || []).some((i) => i.type === 'prepare_offer'),
    'Intent Angebot / Concept-Draft',
  );
  const prepared = (turn.preparedActions || []).find((a) => (
    a.type === 'prepare_offer' && a.payload?.offerDraftId
  ));
  assert.ok(prepared, 'Concept-Draft vorbereitet');

  // Fact-Reihenfolge unabhängig: reversed Facts anwenden
  const applyFacts = [...(turn.extractedFacts || [])].reverse();
  const applied = applyAcceptedSellerTurn(lead0, {
    ...turn,
    extractedFacts: applyFacts,
    sellerInput: text,
  }, { postFeedCard: false });
  assert.equal(applied.ok, true);

  const profile = getNeedProfileFromLead(applied.lead);
  assert.equal(profile.selectedModelKey, 'ev3');
  assert.equal(applied.lead.wish?.customerType, 'business');
  assert.equal(applied.lead.wish?.paymentType ?? null, null);
  assert.equal(applied.lead.wish?.termMonths ?? null, null);
  assert.equal(applied.lead.wish?.mileagePerYear ?? null, null);

  const draftId = prepared.payload.offerDraftId
    || applied.lead?.crm?.cleverWorkingState?.currentOfferDraftId;
  const draft = getOfferDraftById(applied.lead, draftId);
  assert.ok(draft, 'Concept-Draft existiert');
  assert.equal(draft.monthlyRate ?? draft.rate ?? null, null);
  assert.equal(draft.payment?.paymentType ?? draft.paymentType ?? null, null);
  assert.match(String(draft.vehicleIdentityDraft?.trim?.canonical || draft.vehicleIdentityDraft?.trim?.raw || ''), /Earth/i);
  assert.ok(
    !draft.vehicleIdentityDraft?.color?.raw
    || draft.vehicleIdentityDraft?.color?.status === 'open',
    'Farbe bleibt offen',
  );
  assert.ok(
    !draft.vehicleIdentityDraft?.powertrainVariant?.raw
    || draft.vehicleIdentityDraft?.powertrainVariant?.status === 'open',
    'keine erfundene Motorisierung',
  );

  const pkgs = draft.vehicleIdentityDraft?.packages || [];
  assert.ok(
    pkgs.some((p) => /up\s*-?\s*drive/i.test(String(p.raw || p.canonical || ''))),
    'Up Drive am Draft (Review-Slot)',
  );
  const upPkg = pkgs.find((p) => /up\s*-?\s*drive/i.test(String(p.raw || '')));
  assert.ok(
    !upPkg?.canonical || upPkg.status === 'needs_refinement',
    'Up Drive nicht als gültiges Katalog-Paket resolved',
  );
  assert.ok(
    !pkgs.some((p) => /^business(\s*paket)?$/i.test(String(p.raw || '').trim())),
    'Business nicht still als Business-Paket erfunden',
  );

  console.log('✓ Clever Agent V1 – EV3 Earth Up Drive Business Offer E2E');
}

{
  // Golden 3: Trade-in Sportage + Rückruf Donnerstag (fixes now)
  const NOW = new Date('2026-09-08T10:00:00+02:00'); // Dienstag → Donnerstag = 10.09.2026
  const text = 'Kunde hat noch einen Sportage von 2021 mit ungefähr 70.000 km, den er eventuell in Zahlung geben möchte. Ruf ihn Donnerstag nochmal an.';
  const lead0 = {
    ...baseLead(),
    wish: { termMonths: 36, mileagePerYear: 15000 },
    crm: {
      ...baseLead().crm,
      needProfile: {
        ...createEmptyNeedProfile(),
        selectedModelKey: 'ev3',
        colorPreference: 'schwarz',
        motorPreference: 'Long Range',
      },
      focusedVehicleTrackId: 'trk_ev3',
      vehicleConfigurations: [{
        id: 'trk_ev3',
        modelKey: 'ev3',
        model: 'EV3',
        trimLabel: 'Earth',
        vehicleTrack: { status: 'active' },
      }],
      cleverWorkingState: {
        currentOfferDraftId: 'ofd_keep',
        offerDrafts: {
          ofd_keep: {
            offerDraftId: 'ofd_keep',
            modelKey: 'ev3',
            monthlyRate: null,
            vehicleIdentityDraft: {
              model: { raw: 'EV3', canonical: 'EV3', status: 'captured' },
              trim: { raw: 'Earth', canonical: 'Earth', status: 'captured' },
              packages: [{ raw: 'Up Drive', status: 'needs_refinement' }],
            },
          },
        },
      },
    },
  };

  const interpretation = interpretCleverInput({ text, lead: lead0, now: NOW });
  assert.equal(interpretation.extractedData.vehicle.modelKey, null, 'kein Angebotsmodell Sportage');
  assert.match(String(interpretation.extractedData.tradeIn.vehicle || ''), /Sportage/i);
  assert.equal(interpretation.extractedData.tradeIn.year, 2021);
  assert.equal(interpretation.extractedData.tradeIn.mileageKm, 70000);
  assert.equal(interpretation.extractedData.tradeIn.mileageApproximate, true);
  assert.equal(interpretation.extractedData.tradeIn.status, 'possible');
  assert.equal(interpretation.extractedData.leasing.annualMileage, null);

  const facts = interpretation.extractedData.facts || [];
  assert.ok(!facts.some((f) => f.field === 'vehicleInterest'), 'kein vehicleInterest Sportage');
  assert.ok(facts.some((f) => (
    f.field === 'tradeInRequested' && /eventuell/i.test(String(f.label || ''))
  )));
  assert.ok(!facts.some((f) => (
    f.field === 'tradeInRequested' && f.value === true
  )), 'keine endgültige Zusage als bare true');
  const appt = facts.find((f) => f.field === 'appointment');
  assert.ok(appt?.value?.startAt, 'Rückruf mit konkretem startsAt');
  assert.equal(appt.value.type, 'callback');
  assert.match(String(appt.label || ''), /10\.09\.2026/);
  assert.equal(appt.needsConfirmation, false);

  // Kein globales Review nur wegen eines Slots
  assert.ok(!(interpretation.conflicts || []).some((c) => c.field === 'vehicleInterest'));

  const turn = runCleverSellerTurn({ lead: lead0, sellerInput: text, now: NOW });
  const callbackAction = (turn.preparedActions || []).find((a) => (
    (a.type === 'propose_appointment' || a.type === 'prepare_callback')
    && a.status === 'prepared'
    && a.payload?.when
  ));
  assert.ok(callbackAction, 'Rückruf vorbereitet');
  const when = new Date(callbackAction.payload.when);
  assert.equal(when.getFullYear(), 2026);
  assert.equal(when.getMonth(), 8); // September
  assert.equal(when.getDate(), 10);

  const applyFacts = [...(turn.extractedFacts || [])].reverse();
  const applied = applyAcceptedSellerTurn(lead0, {
    ...turn,
    extractedFacts: applyFacts,
    sellerInput: text,
  }, { postFeedCard: false });
  assert.equal(applied.ok, true);

  const profile = getNeedProfileFromLead(applied.lead);
  assert.equal(profile.selectedModelKey, 'ev3', 'Angebotsmodell unverändert');
  assert.equal(applied.lead.wish?.mileagePerYear, 15000, 'Wunsch-km nicht überschrieben');

  const tradeIn = getTradeIn(applied.lead);
  assert.match(String(tradeIn.vehicle || ''), /Sportage/i);
  assert.match(String(tradeIn.notes || ''), /2021/);
  assert.match(String(tradeIn.notes || ''), /70\.000|70000/);
  assert.match(String(tradeIn.notes || ''), /eventuell/i);
  assert.ok(!/Inzahlungnahme gewünscht/i.test(String(tradeIn.notes || '')));

  assert.equal(applied.lead.crm?.cleverWorkingState?.currentOfferDraftId, 'ofd_keep');
  const draft = getOfferDraftById(applied.lead, 'ofd_keep');
  assert.match(String(draft?.vehicleIdentityDraft?.model?.canonical || ''), /EV3/i);
  assert.match(String(draft?.vehicleIdentityDraft?.trim?.canonical || ''), /Earth/i);
  assert.equal(draft?.monthlyRate ?? null, null);

  console.log('✓ Clever Agent V1 – Trade-in Sportage + Rückruf Donnerstag E2E');
}

/** Vorzustand für Korrektur-Turns: EV3 + Concept-Draft + Track */
function correctionLead(overrides = {}) {
  const vid = {
    id: 'vid1',
    modelKey: 'ev3',
    model: { raw: 'EV3', canonical: 'EV3', status: 'captured' },
    trim: { raw: 'Earth', canonical: 'Earth', status: 'captured' },
    color: { raw: 'schwarz', canonical: 'schwarz', status: 'captured' },
    packages: [{ raw: 'Winterpaket', status: 'needs_refinement' }],
    ...(overrides.vehicleIdentityDraft || {}),
  };
  return {
    id: 'lead-corr',
    name: 'Herr Müller',
    contact: { name: 'Herr Müller' },
    wish: {
      mileagePerYear: 20000,
      termMonths: 36,
      paymentType: 'leasing',
      ...(overrides.wish || {}),
    },
    crm: {
      needProfile: {
        ...createEmptyNeedProfile(),
        selectedModelKey: 'ev3',
        colorPreference: 'schwarz',
        equipmentWishes: ['Winterpaket', 'winter'],
        ...(overrides.needProfile || {}),
      },
      focusedVehicleTrackId: 'trk_ev3',
      vehicleConfigurations: [{
        id: 'trk_ev3',
        modelKey: 'ev3',
        model: 'EV3',
        colorLabel: 'schwarz',
        vehicleTrack: {
          status: 'active',
          preferredColor: 'schwarz',
          customerRequirements: ['Winterpaket'],
        },
      }],
      vehicleOffers: {},
      sellerInsights: [],
      cleverWorkingState: {
        currentOfferDraftId: 'ofd_keep',
        offerDrafts: {
          ofd_keep: {
            offerDraftId: 'ofd_keep',
            modelKey: 'ev3',
            monthlyRate: null,
            paymentType: 'leasing',
            vehicleIdentityDraftId: 'vid1',
            vehicleIdentityDraft: vid,
          },
        },
        vehicleIdentityDrafts: { vid1: vid },
      },
      ...(overrides.crm || {}),
    },
  };
}

{
  // Golden 4: Farbe korrigieren – gleicher Track/Draft
  const text = 'Ach nee, doch lieber weiß.';
  const lead0 = correctionLead();
  const interpretation = interpretCleverInput({ text, lead: lead0 });
  const facts = interpretation.extractedData.facts || [];
  const colorFact = facts.find((f) => f.field === 'colorPreference');
  assert.ok(colorFact, 'colorPreference erkannt');
  const colorRaw = typeof colorFact.value === 'object' && colorFact.value
    ? (colorFact.value.color || colorFact.value.label)
    : colorFact.value;
  assert.match(String(colorRaw || colorFact.label || ''), /wei(ß|ss)/i);
  assert.equal(colorFact.needsConfirmation, false, 'sichere Farbkorrektur ohne Review');
  assert.ok(!facts.some((f) => f.field === 'vehicleInterest'), 'kein neuer vehicleInterest');
  assert.equal(interpretation.extractedData.leasing.rate, null);

  const turn = runCleverSellerTurn({ lead: lead0, sellerInput: text });
  assert.ok(
    turn.rememberDecision?.mode === 'save_with_undo'
    || turn.rememberDecision?.mode === 'partial_save_with_undo',
  );
  assert.equal((turn.rememberDecision?.reviewFacts || []).length, 0, 'kein globales Review');
  const applyFacts = [...(turn.rememberDecision?.safeFacts || turn.extractedFacts || [])].reverse();
  const applied = applyAcceptedSellerTurn(lead0, {
    ...turn,
    extractedFacts: applyFacts,
    sellerInput: text,
  }, { postFeedCard: false });
  assert.equal(applied.ok, true);

  const profile = getNeedProfileFromLead(applied.lead);
  assert.match(String(profile.colorPreference || ''), /wei(ß|ss)/i);
  assert.equal(profile.selectedModelKey, 'ev3');
  assert.equal(applied.lead.crm?.focusedVehicleTrackId, 'trk_ev3');
  assert.equal(applied.lead.crm?.cleverWorkingState?.currentOfferDraftId, 'ofd_keep');
  assert.equal(applied.lead.wish?.mileagePerYear, 20000);
  assert.equal(applied.lead.wish?.paymentType, 'leasing');

  const draft = getOfferDraftById(applied.lead, 'ofd_keep');
  assert.ok(draft, 'Concept-Draft unverändert vorhanden');
  assert.match(String(draft.vehicleIdentityDraft?.color?.raw || ''), /wei(ß|ss)/i);
  assert.equal(draft.monthlyRate ?? draft.rate ?? null, null);
  assert.ok(
    (draft.vehicleIdentityDraft?.packages || []).some((p) => /winter/i.test(String(p.raw || ''))),
    'andere Identity-Slots unverändert',
  );

  console.log('✓ Clever Agent V1 – Farbe korrigieren (weiß) E2E');
}

{
  // Golden 5: Kilometer korrigieren – Wunsch-km, nicht Odometer
  const text = '15.000 km reichen doch, nicht 20.000.';
  const lead0 = correctionLead();
  const interpretation = interpretCleverInput({ text, lead: lead0 });
  const facts = interpretation.extractedData.facts || [];
  const kmFact = facts.find((f) => f.field === 'annualMileage' || f.field === 'mileagePerYear');
  assert.ok(kmFact, 'annualMileage erkannt');
  assert.equal(Number(kmFact.value), 15000);
  assert.ok(!facts.some((f) => f.field === 'vehicleInterest'));
  assert.ok(!facts.some((f) => f.field === 'tradeInRequested' || f.field === 'existingVehicle'));
  assert.equal(interpretation.extractedData.tradeIn?.mileageKm ?? null, null);
  assert.equal(interpretation.extractedData.leasing.annualMileage, 15000);
  assert.equal(interpretation.extractedData.leasing.rate, null);

  const turn = runCleverSellerTurn({ lead: lead0, sellerInput: text });
  assert.equal((turn.rememberDecision?.reviewFacts || []).length, 0);
  // Fact-Reihenfolge egal
  const applyFacts = [...(turn.rememberDecision?.safeFacts || turn.extractedFacts || [])].reverse();
  const applied = applyAcceptedSellerTurn(lead0, {
    ...turn,
    extractedFacts: applyFacts,
    sellerInput: text,
  }, { postFeedCard: false });
  assert.equal(applied.ok, true);

  assert.equal(applied.lead.wish?.mileagePerYear, 15000, 'km ersetzt, nicht parallel');
  assert.equal(applied.lead.wish?.paymentType, 'leasing', 'paymentType unverändert');
  assert.equal(applied.lead.wish?.termMonths, 36);
  assert.equal(applied.lead.crm?.focusedVehicleTrackId, 'trk_ev3');
  assert.equal(applied.lead.crm?.cleverWorkingState?.currentOfferDraftId, 'ofd_keep');

  const draft = getOfferDraftById(applied.lead, 'ofd_keep');
  assert.equal(draft?.monthlyRate ?? draft?.rate ?? null, null);
  assert.match(String(draft?.vehicleIdentityDraft?.color?.raw || ''), /schwarz/i);

  const tradeIn = getTradeIn(applied.lead);
  assert.ok(!tradeIn?.mileageKm && !/15\.?000|20000/.test(String(tradeIn?.notes || '')), 'kein Trade-in-Odometer');

  console.log('✓ Clever Agent V1 – Kilometer korrigieren (15k) E2E');
}

{
  // Golden 6: Winterpaket entfernen – Remove, keine false-Flag-Parallelstruktur
  const text = 'Nimm das Winterpaket wieder raus.';
  const lead0 = correctionLead();
  const interpretation = interpretCleverInput({ text, lead: lead0 });
  const facts = interpretation.extractedData.facts || [];
  const removeFact = facts.find((f) => (
    f.field === 'equipmentWish'
    && f.value?.remove === true
    && /winter/i.test(String(f.label || f.value?.label || ''))
  ));
  assert.ok(removeFact, 'equipmentWish remove erkannt');
  assert.ok(!facts.some((f) => (
    f.field === 'equipmentWish'
    && f.value === false
  )), 'keine Winterpaket:false Parallelstruktur');
  assert.ok(!facts.some((f) => f.field === 'vehicleInterest'));

  const turn = runCleverSellerTurn({ lead: lead0, sellerInput: text });
  assert.ok(
    turn.rememberDecision?.mode === 'save_with_undo'
    || turn.rememberDecision?.mode === 'partial_save_with_undo',
  );
  assert.equal((turn.rememberDecision?.reviewFacts || []).length, 0, 'kein globales Review');
  const applyFacts = [...(turn.rememberDecision?.safeFacts || turn.extractedFacts || [])].reverse();
  const applied = applyAcceptedSellerTurn(lead0, {
    ...turn,
    extractedFacts: applyFacts,
    sellerInput: text,
  }, { postFeedCard: false });
  assert.equal(applied.ok, true);

  const profile = getNeedProfileFromLead(applied.lead);
  assert.ok(!(profile.equipmentWishes || []).some((w) => /winter/i.test(String(w))), 'Winterpaket aus Wunsch entfernt');
  assert.equal(profile.selectedModelKey, 'ev3');
  assert.equal(applied.lead.crm?.focusedVehicleTrackId, 'trk_ev3');
  assert.equal(applied.lead.crm?.cleverWorkingState?.currentOfferDraftId, 'ofd_keep');

  const draft = getOfferDraftById(applied.lead, 'ofd_keep');
  assert.ok(draft);
  assert.ok(
    !(draft.vehicleIdentityDraft?.packages || []).some((p) => /winter/i.test(String(p.raw || p.canonical || ''))),
    'Winterpaket aus Draft-Packages entfernt',
  );
  assert.equal(draft.monthlyRate ?? draft.rate ?? null, null);
  assert.match(String(draft.vehicleIdentityDraft?.color?.raw || ''), /schwarz/i);

  const track = (applied.lead.crm?.vehicleConfigurations || []).find((t) => t.id === 'trk_ev3');
  assert.ok(
    !(track?.vehicleTrack?.customerRequirements || []).some((r) => /winter/i.test(String(r))),
    'Track-Requirements bereinigt',
  );

  console.log('✓ Clever Agent V1 – Winterpaket entfernen E2E');
}

{
  // Golden 7: AHK positiv → negativ (Remove-Pfad, kein false-Parallel)
  const lead0 = correctionLead({
    needProfile: { equipmentWishes: [] },
    vehicleIdentityDraft: { packages: [] },
  });
  lead0.crm.vehicleConfigurations[0].vehicleTrack.customerRequirements = [];

  const textAdd = 'AHK braucht er auf jeden Fall.';
  const turnAdd = runCleverSellerTurn({ lead: lead0, sellerInput: textAdd });
  assert.equal((turnAdd.rememberDecision?.reviewFacts || []).length, 0, 'AHK+ kein Review');
  assert.ok((turnAdd.extractedFacts || []).some((f) => (
    f.field === 'towHitchRequired' && f.value === true
  )));
  const appliedAdd = applyAcceptedSellerTurn(lead0, {
    ...turnAdd,
    extractedFacts: [...(turnAdd.rememberDecision?.safeFacts || turnAdd.extractedFacts || [])].reverse(),
    sellerInput: textAdd,
  }, { postFeedCard: false });
  const profileAdd = getNeedProfileFromLead(appliedAdd.lead);
  assert.equal(profileAdd.towbar, true);
  assert.ok((profileAdd.equipmentWishes || []).includes('towbar'));
  assert.equal(appliedAdd.lead.crm?.cleverWorkingState?.currentOfferDraftId, 'ofd_keep');
  assert.equal(appliedAdd.lead.crm?.focusedVehicleTrackId, 'trk_ev3');
  assert.equal(getOfferDraftById(appliedAdd.lead, 'ofd_keep')?.monthlyRate ?? null, null);

  const textRm = 'AHK braucht er doch nicht.';
  const turnRm = runCleverSellerTurn({ lead: appliedAdd.lead, sellerInput: textRm });
  const rmFact = (turnRm.extractedFacts || []).find((f) => f.field === 'towHitchRequired');
  assert.ok(rmFact?.value?.remove === true, 'AHK Remove-Pfad');
  assert.ok(!(turnRm.extractedFacts || []).some((f) => (
    f.field === 'towHitchRequired' && f.value === false
  )), 'keine false-Parallelstruktur');
  const appliedRm = applyAcceptedSellerTurn(appliedAdd.lead, {
    ...turnRm,
    extractedFacts: [...(turnRm.rememberDecision?.safeFacts || turnRm.extractedFacts || [])].reverse(),
    sellerInput: textRm,
  }, { postFeedCard: false });
  const profileRm = getNeedProfileFromLead(appliedRm.lead);
  assert.equal(profileRm.towbar, false);
  assert.ok(!(profileRm.equipmentWishes || []).includes('towbar'));
  assert.equal(appliedRm.lead.crm?.cleverWorkingState?.currentOfferDraftId, 'ofd_keep');
  assert.equal(appliedRm.lead.wish?.mileagePerYear, 20000, 'andere Ausstattung/Konditionen unverändert');

  console.log('✓ Clever Agent V1 – AHK positiv/negativ E2E');
}

{
  // Golden 8: Wunschbudget ≠ Angebotsrate
  const text = 'Mehr als 350 Euro im Monat will er nicht zahlen.';
  const lead0 = correctionLead();
  const interpretation = interpretCleverInput({ text, lead: lead0 });
  assert.equal(interpretation.extractedData.leasing.rate, null);
  const facts = interpretation.extractedData.facts || [];
  assert.ok(facts.some((f) => f.field === 'monthlyBudget' && Number(f.value) === 350));
  assert.ok(!facts.some((f) => f.field === 'rate'), 'kein Legacy-rate neben Budget');
  assert.ok(!facts.some((f) => f.field === 'paymentType'), 'keine Zahlungsart aus Budget');

  const turn = runCleverSellerTurn({ lead: lead0, sellerInput: text });
  assert.equal((turn.rememberDecision?.reviewFacts || []).length, 0);
  const applied = applyAcceptedSellerTurn(lead0, {
    ...turn,
    extractedFacts: [...(turn.rememberDecision?.safeFacts || turn.extractedFacts || [])].reverse(),
    sellerInput: text,
  }, { postFeedCard: false });
  const profile = getNeedProfileFromLead(applied.lead);
  assert.equal(profile.budget?.maxMonthlyRate, 350);
  assert.equal(applied.lead.wish?.desiredRate, 350);
  assert.equal(getOfferDraftById(applied.lead, 'ofd_keep')?.monthlyRate ?? null, null);
  assert.equal(applied.lead.crm?.cleverWorkingState?.currentOfferDraftId, 'ofd_keep');

  console.log('✓ Clever Agent V1 – Wunschbudget 350 E2E');
}

{
  // Golden 9: Probefahrt relativ zu now
  const NOW = new Date('2026-09-08T10:00:00+02:00'); // Di → nächster Di = 15.09.2026
  const text = 'Nächsten Dienstag gegen 15 Uhr Probefahrt.';
  const lead0 = correctionLead();
  const turn = runCleverSellerTurn({ lead: lead0, sellerInput: text, now: NOW });
  const apptFact = (turn.extractedFacts || []).find((f) => f.field === 'appointment');
  assert.equal(apptFact?.value?.type, 'test_drive');
  assert.ok(apptFact?.value?.startAt);
  const when = new Date(apptFact.value.startAt);
  assert.equal(when.getFullYear(), 2026);
  assert.equal(when.getMonth(), 8);
  assert.equal(when.getDate(), 15);
  const prepared = (turn.preparedActions || []).find((a) => (
    a.type === 'propose_appointment' && a.status === 'prepared'
  ));
  assert.ok(prepared);
  assert.match(String(prepared.payload?.preparedAppointment?.timeLabel || ''), /15:00/);

  const applied = applyAcceptedSellerTurn(lead0, {
    ...turn,
    extractedFacts: [...(turn.extractedFacts || [])].reverse(),
    sellerInput: text,
  }, { postFeedCard: false });
  assert.equal(applied.lead.crm?.focusedVehicleTrackId, 'trk_ev3');
  assert.equal(applied.lead.crm?.cleverWorkingState?.currentOfferDraftId, 'ofd_keep');
  assert.equal(applied.lead.wish?.mileagePerYear, 20000);
  assert.equal(getOfferDraftById(applied.lead, 'ofd_keep')?.monthlyRate ?? null, null);

  console.log('✓ Clever Agent V1 – Probefahrt Dienstag 15 Uhr E2E');
}

{
  // Golden 10: Entscheidungsrolle – Kundenwissen, keine Offer-Mutation
  const text = 'Seine Frau entscheidet mit.';
  const lead0 = correctionLead();
  const turn = runCleverSellerTurn({ lead: lead0, sellerInput: text });
  assert.ok((turn.extractedFacts || []).some((f) => f.field === 'decisionPartner'));
  assert.ok(!(turn.extractedFacts || []).some((f) => f.field === 'vehicleInterest'));
  assert.ok(!(turn.intents || []).some((i) => i.type === 'prepare_offer'));
  const applied = applyAcceptedSellerTurn(lead0, {
    ...turn,
    extractedFacts: [...(turn.rememberDecision?.safeFacts || turn.extractedFacts || [])].reverse(),
    sellerInput: text,
  }, { postFeedCard: false });
  const profile = getNeedProfileFromLead(applied.lead);
  assert.equal(profile.household?.decidesWith, 'partner');
  assert.equal(profile.selectedModelKey, 'ev3');
  assert.equal(applied.lead.crm?.cleverWorkingState?.currentOfferDraftId, 'ofd_keep');
  assert.equal(getOfferDraftById(applied.lead, 'ofd_keep')?.monthlyRate ?? null, null);

  console.log('✓ Clever Agent V1 – Frau entscheidet mit E2E');
}

{
  // Golden 11: Leasing explizit + AZ – keine Rate/km erfinden
  const text = 'Leasing, 36 Monate, 5.000 Euro Anzahlung.';
  const lead0 = correctionLead({
    wish: { mileagePerYear: 15000, termMonths: null, paymentType: null },
  });
  const interpretation = interpretCleverInput({ text, lead: lead0 });
  assert.equal(interpretation.extractedData.leasing.paymentType, 'leasing');
  assert.equal(interpretation.extractedData.leasing.durationMonths, 36);
  assert.equal(interpretation.extractedData.leasing.downPayment, 5000);
  assert.equal(interpretation.extractedData.leasing.rate, null);
  assert.equal(interpretation.extractedData.leasing.annualMileage, null);
  const facts = interpretation.extractedData.facts || [];
  assert.ok(!facts.some((f) => f.field === 'rate'));
  assert.ok(!facts.some((f) => f.field === 'annualMileage'));

  const turn = runCleverSellerTurn({ lead: lead0, sellerInput: text });
  assert.equal((turn.rememberDecision?.reviewFacts || []).length, 0);
  const applied = applyAcceptedSellerTurn(lead0, {
    ...turn,
    extractedFacts: [...(turn.rememberDecision?.safeFacts || turn.extractedFacts || [])].reverse(),
    sellerInput: text,
  }, { postFeedCard: false });
  assert.equal(applied.lead.wish?.paymentType, 'leasing');
  assert.equal(applied.lead.wish?.termMonths, 36);
  assert.equal(applied.lead.wish?.downPayment, 5000);
  assert.equal(applied.lead.wish?.mileagePerYear, 15000, 'km nicht erfunden/überschrieben');
  assert.equal(getNeedProfileFromLead(applied.lead).selectedModelKey, 'ev3');
  assert.equal(applied.lead.crm?.cleverWorkingState?.currentOfferDraftId, 'ofd_keep');
  assert.equal(getOfferDraftById(applied.lead, 'ofd_keep')?.monthlyRate ?? null, null);

  console.log('✓ Clever Agent V1 – Leasing explizit + AZ E2E');
}

{
  // Golden 12: Zahlungsart korrigieren Leasing → Finanzierung
  const text = 'Finanzierung wäre ihm doch lieber als Leasing.';
  const lead0 = correctionLead();
  const turn = runCleverSellerTurn({ lead: lead0, sellerInput: text });
  assert.ok((turn.extractedFacts || []).some((f) => (
    f.field === 'paymentType' && f.value === 'financing'
  )));
  assert.ok(!(turn.extractedFacts || []).some((f) => f.field === 'commercialScenarios'));
  assert.ok(!(turn.homepageInquiry?.hasDualScenarios));
  const applied = applyAcceptedSellerTurn(lead0, {
    ...turn,
    extractedFacts: [...(turn.rememberDecision?.safeFacts || turn.extractedFacts || [])].reverse(),
    sellerInput: text,
  }, { postFeedCard: false });
  assert.equal(applied.lead.wish?.paymentType, 'financing');
  assert.equal(applied.lead.wish?.mileagePerYear, 20000);
  assert.equal(applied.lead.wish?.termMonths, 36);
  assert.equal(getNeedProfileFromLead(applied.lead).selectedModelKey, 'ev3');
  assert.equal(applied.lead.crm?.cleverWorkingState?.currentOfferDraftId, 'ofd_keep');
  assert.equal(getOfferDraftById(applied.lead, 'ofd_keep')?.monthlyRate ?? null, null);
  assert.ok(!applied.lead.wish?.commercialScenarios?.length);

  console.log('✓ Clever Agent V1 – Finanzierung statt Leasing E2E');
}

{
  // Golden 13: Minimaler Concept-Draft – keine Defaults
  const text = 'Mach erstmal nur einen EV3 Entwurf.';
  const lead0 = baseLead();
  const turn = runCleverSellerTurn({ lead: lead0, sellerInput: text });
  assert.ok((turn.intents || []).some((i) => i.type === 'prepare_offer'));
  const prepared = (turn.preparedActions || []).find((a) => (
    a.type === 'prepare_offer' && a.status === 'prepared' && a.payload?.offerDraftId
  ));
  assert.ok(prepared, 'Concept-Draft vorbereitet');
  const applied = applyAcceptedSellerTurn(lead0, {
    ...turn,
    extractedFacts: [...(turn.extractedFacts || [])].reverse(),
    sellerInput: text,
  }, { postFeedCard: false });
  const draftId = prepared.payload.offerDraftId
    || applied.lead.crm?.cleverWorkingState?.currentOfferDraftId;
  const draft = getOfferDraftById(applied.lead, draftId);
  assert.ok(draft);
  assert.match(String(draft.vehicleIdentityDraft?.model?.canonical || ''), /EV3/i);
  assert.equal(draft.vehicleIdentityDraft?.trim?.status || 'open', 'open');
  assert.equal(draft.vehicleIdentityDraft?.powertrainVariant?.status || 'open', 'open');
  assert.equal(draft.vehicleIdentityDraft?.color?.status || 'open', 'open');
  assert.equal(draft.monthlyRate ?? draft.rate ?? null, null);
  assert.equal(draft.paymentType ?? draft.payment?.paymentType ?? null, null);
  assert.equal(draft.termMonths ?? draft.payment?.termMonths ?? null, null);
  assert.equal(draft.annualMileage ?? draft.payment?.annualMileage ?? null, null);
  assert.equal(draft.downPayment ?? draft.payment?.downPayment ?? null, null);
  assert.ok(!draft.vehicleIdentityDraft?.trim?.raw);
  assert.ok(!draft.vehicleIdentityDraft?.color?.raw);

  console.log('✓ Clever Agent V1 – Minimaler EV3 Entwurf E2E');
}

{
  // Golden 14: Multi-Domain – ein Turn, Domänen getrennt, Draft/Track weiter
  const NOW = new Date('2026-09-08T10:00:00+02:00');
  const text = 'EV3 Earth, 15.000 km, AHK, seine Frau entscheidet mit und Donnerstag nochmal anrufen.';
  const lead0 = correctionLead({
    wish: { mileagePerYear: 20000, termMonths: 36, paymentType: 'leasing' },
    vehicleIdentityDraft: {
      trim: { raw: null, canonical: null, status: 'open' },
      packages: [],
    },
  });
  const turn = runCleverSellerTurn({ lead: lead0, sellerInput: text, now: NOW });
  const facts = turn.extractedFacts || [];
  assert.ok(facts.some((f) => f.field === 'vehicleInterest' && f.value?.modelKey === 'ev3'));
  assert.ok(facts.some((f) => f.field === 'vehicleInterest' && /Earth/i.test(String(f.value?.trim || ''))));
  assert.ok(facts.some((f) => (
    (f.field === 'annualMileage' || f.field === 'mileagePerYear') && Number(f.value) === 15000
  )));
  assert.ok(facts.some((f) => f.field === 'towHitchRequired' && f.value === true));
  assert.ok(facts.some((f) => f.field === 'decisionPartner'));
  const callback = facts.find((f) => f.field === 'appointment' && f.value?.type === 'callback');
  assert.ok(callback?.value?.startAt);
  const when = new Date(callback.value.startAt);
  assert.equal(when.getDate(), 10); // Do 10.09.2026
  assert.ok(!(turn.rememberDecision?.reviewFacts || []).length
    || (turn.rememberDecision?.safeFacts || []).length > 0, 'kein globaler Abbruch');

  const applied = applyAcceptedSellerTurn(lead0, {
    ...turn,
    extractedFacts: [...facts].reverse(),
    sellerInput: text,
  }, { postFeedCard: false });
  const profile = getNeedProfileFromLead(applied.lead);
  assert.equal(profile.selectedModelKey, 'ev3');
  assert.equal(profile.towbar, true);
  assert.equal(profile.household?.decidesWith, 'partner');
  assert.equal(applied.lead.wish?.mileagePerYear, 15000);
  assert.equal(applied.lead.crm?.focusedVehicleTrackId, 'trk_ev3');
  assert.equal(applied.lead.crm?.cleverWorkingState?.currentOfferDraftId, 'ofd_keep');
  const draft = getOfferDraftById(applied.lead, 'ofd_keep');
  assert.match(String(draft?.vehicleIdentityDraft?.trim?.canonical || draft?.vehicleIdentityDraft?.trim?.raw || ''), /Earth/i);
  assert.equal(draft?.monthlyRate ?? null, null);

  console.log('✓ Clever Agent V1 – Multi-Domain Turn E2E');
}

{
  // Golden 15: Realistische Kundenmail EV4 Air Privatleasing
  const text = `Ich interessiere mich für ein Privatleasing eines Kia EV4 Air in der Farbe Wolfsgrau Metallic, inklusive Winter-Paket P1 mit Wärmepumpe, Sitzheizung vorn und Lenkradheizung.

Meine Wunschkonditionen sind 36 Monate und 15.000 Kilometer pro Jahr. Ich plane mit einer Sonderzahlung in Höhe von 4.500 Euro und bitte um Ausweis der Konditionen auf dieser Basis, vorbehaltlich einer möglichen Förderung.

Bitte teilen Sie mir außerdem die Überführungskosten und alle weiteren Einmalkosten mit.

Falls möglich, würde ich das Fahrzeug gern direkt mit Winterreifen statt Sommerreifen übernehmen oder alternativ ein Angebot für einen passenden Winterradsatz erhalten.`;

  const lead0 = baseLead();
  const interpretation = interpretCleverInput({ text, lead: lead0 });
  const ed = interpretation.extractedData;
  const facts = ed.facts || [];

  // Fahrzeug
  assert.equal(ed.vehicle.modelKey, 'ev4');
  assert.match(String(ed.vehicle.trim || ''), /Air/i);
  assert.match(String(ed.vehicle.color || ''), /wolfsgrau/i);

  // Leasing / Privat
  assert.equal(ed.leasing.paymentType, 'leasing');
  assert.equal(ed.customer.customerType, 'private');
  assert.equal(ed.leasing.durationMonths, 36);
  assert.equal(ed.leasing.annualMileage, 15000);
  assert.equal(ed.leasing.downPayment, 4500);
  assert.equal(ed.leasing.rate, null);
  assert.equal(ed.leasing.desiredRate, null);

  // Ausstattung
  const equipLabels = facts
    .filter((f) => f.field === 'equipmentWish' && !f.value?.remove)
    .map((f) => String(f.label || f.value?.label || ''));
  assert.ok(equipLabels.some((l) => /Winter-Paket\s*P1/i.test(l)));
  assert.ok(equipLabels.some((l) => /Wärmepumpe|Waermepumpe/i.test(l)));
  assert.ok(equipLabels.some((l) => /Sitzheizung\s*vorn/i.test(l)));
  assert.ok(equipLabels.some((l) => /Lenkradheizung/i.test(l)));
  assert.ok(equipLabels.some((l) => /Winterreifen/i.test(l)));
  assert.ok(equipLabels.some((l) => /Winterradsatz/i.test(l)));

  // Offene Fragen – keine erfundenen Beträge
  const openQs = facts.filter((f) => f.field === 'openCustomerQuestion');
  assert.ok(openQs.some((f) => f.value?.topic === 'transfer_costs' && f.value?.amount == null));
  assert.ok(openQs.some((f) => f.value?.topic === 'one_time_costs' && f.value?.amount == null));
  assert.ok(openQs.some((f) => f.value?.topic === 'quote_on_basis'));
  const subsidy = openQs.find((f) => f.value?.topic === 'subsidy');
  assert.ok(subsidy);
  assert.equal(subsidy.value?.status, 'uncertain');
  assert.equal(subsidy.needsConfirmation, true, 'Förderung nur slotweise unsicher');

  assert.ok(!facts.some((f) => f.field === 'monthlyBudget' || f.field === 'transferCost'));
  assert.ok(!facts.some((f) => f.field === 'customerName'), 'kein Fake-Name aus Privatleasing');
  assert.ok(
    !(interpretation.conflicts || []).some((c) => c.field === 'vehicleInterest'),
    'kein globaler Abbruch',
  );

  const turn = runCleverSellerTurn({ lead: lead0, sellerInput: text });
  assert.ok((turn.intents || []).some((i) => i.type === 'prepare_offer'));
  const prepared = (turn.preparedActions || []).find((a) => (
    a.type === 'prepare_offer' && a.status === 'prepared' && a.payload?.offerDraftId
  ));
  assert.ok(prepared, 'Concept-Draft vorbereitet');

  const applyFacts = [...(turn.extractedFacts || [])].reverse();
  const applied = applyAcceptedSellerTurn(lead0, {
    ...turn,
    extractedFacts: applyFacts,
    sellerInput: text,
  }, { postFeedCard: false });
  assert.equal(applied.ok, true);

  const profile = getNeedProfileFromLead(applied.lead);
  assert.equal(profile.selectedModelKey, 'ev4');
  assert.match(String(profile.colorPreference || ''), /wolfsgrau/i);
  assert.ok((profile.equipmentWishes || []).includes('heat_pump'));
  assert.ok((profile.equipmentWishes || []).includes('heated_seats'));
  assert.ok((profile.equipmentWishes || []).includes('heated_steering'));
  assert.ok((profile.equipmentWishes || []).includes('winter'));
  assert.ok((profile.equipmentWishes || []).includes('winter_tires'));
  assert.ok((profile.equipmentWishes || []).includes('winter_wheel_set'));

  assert.equal(applied.lead.wish?.paymentType, 'leasing');
  assert.equal(applied.lead.wish?.customerType, 'private');
  assert.equal(applied.lead.wish?.termMonths, 36);
  assert.equal(applied.lead.wish?.mileagePerYear, 15000);
  assert.equal(applied.lead.wish?.downPayment, 4500);
  assert.ok(applied.lead.wish?.desiredRate == null || applied.lead.wish?.desiredRate === '');
  assert.ok(applied.lead.desiredRate == null || applied.lead.desiredRate === '');

  const draftId = prepared.payload.offerDraftId
    || applied.lead.crm?.cleverWorkingState?.currentOfferDraftId;
  const draft = getOfferDraftById(applied.lead, draftId);
  assert.ok(draft);
  assert.equal(draft.monthlyRate ?? draft.rate ?? null, null);
  assert.match(String(draft.vehicleIdentityDraft?.model?.canonical || ''), /EV4/i);
  assert.match(String(draft.vehicleIdentityDraft?.trim?.canonical || draft.vehicleIdentityDraft?.trim?.raw || ''), /Air/i);
  assert.match(String(draft.vehicleIdentityDraft?.color?.raw || ''), /wolfsgrau/i);
  const pkgs = (draft.vehicleIdentityDraft?.packages || []).map((p) => String(p.raw || ''));
  assert.ok(pkgs.some((p) => /Winter-Paket\s*P1|Winterpaket/i.test(p)));
  assert.ok(pkgs.some((p) => /Wärmepumpe/i.test(p)));
  assert.ok(pkgs.some((p) => /Lenkradheizung/i.test(p)));

  console.log('✓ Clever Agent V1 – Kundenmail EV4 Air Privatleasing E2E');
}

{
  // Golden 16: Verkäufer-Arbeitsgrundlage nur aus strukturierten Facts/Draft/OpenQuestions
  const text = `Ich interessiere mich für ein Privatleasing eines Kia EV4 Air in der Farbe Wolfsgrau Metallic, inklusive Winter-Paket P1 mit Wärmepumpe, Sitzheizung vorn und Lenkradheizung.

Meine Wunschkonditionen sind 36 Monate und 15.000 Kilometer pro Jahr. Ich plane mit einer Sonderzahlung in Höhe von 4.500 Euro und bitte um Ausweis der Konditionen auf dieser Basis, vorbehaltlich einer möglichen Förderung.

Bitte teilen Sie mir außerdem die Überführungskosten und alle weiteren Einmalkosten mit.

Falls möglich, würde ich das Fahrzeug gern direkt mit Winterreifen statt Sommerreifen übernehmen oder alternativ ein Angebot für einen passenden Winterradsatz erhalten.`;

  const lead0 = baseLead();
  const turn = runCleverSellerTurn({ lead: lead0, sellerInput: text });
  assert.ok(turn.workBriefing, 'workBriefing am Turn');
  assert.equal(turn.workBriefing.source, 'structured_facts');

  const s = turn.workBriefing.sections;
  assert.match(String(s.customerWants || ''), /EV4/i);
  assert.match(String(s.customerWants || ''), /Air/i);
  assert.match(String(s.customerWants || ''), /Wolfsgrau/i);
  assert.match(String(s.customerWants || ''), /Winter-Paket\s*P1/i);
  assert.match(String(s.customerWants || ''), /Wärmepumpe/i);
  assert.match(String(s.customerWants || ''), /Sitzheizung/i);
  assert.match(String(s.customerWants || ''), /Lenkradheizung/i);

  assert.match(String(s.leasingWish || ''), /Privat/i);
  assert.match(String(s.leasingWish || ''), /36\s*Monate/i);
  assert.match(String(s.leasingWish || ''), /15\.000\s*km/i);
  assert.match(String(s.leasingWish || ''), /4\.500\s*€/i);

  assert.match(String(s.extras || ''), /Winterreifen/i);
  assert.match(String(s.extras || ''), /Winterradsatz/i);

  assert.match(String(s.toClarify || ''), /Überführungskosten/i);
  assert.match(String(s.toClarify || ''), /Einmalkosten/i);
  assert.match(String(s.toClarify || ''), /Förderung/i);
  assert.match(String(s.toClarify || ''), /Farbe prüfen/i);

  assert.match(String(s.nextStep || ''), /Angebot vorbereiten/i);

  // Keine zweite Wahrheit / keine erfundene Rate
  assert.ok(!/\b\d{2,4}\s*€\s*(?:\/\s*monat|pro\s+monat|rate)\b/i.test(turn.workBriefing.text));
  assert.ok(!/monatsrate|kalkulierte rate/i.test(turn.workBriefing.text));
  assert.ok(!/ca\.\s*\d{2,3}\s*€/i.test(turn.workBriefing.text));

  const prepared = (turn.preparedActions || []).find((a) => (
    a.type === 'prepare_offer' && a.status === 'prepared' && a.payload?.offerDraftId
  ));
  assert.ok(prepared);

  const applied = applyAcceptedSellerTurn(lead0, {
    ...turn,
    extractedFacts: [...(turn.extractedFacts || [])].reverse(),
    sellerInput: text,
  }, { postFeedCard: false });
  const draft = getOfferDraftById(
    applied.lead,
    prepared.payload.offerDraftId || applied.lead.crm?.cleverWorkingState?.currentOfferDraftId,
  );
  assert.equal(draft?.monthlyRate ?? null, null);

  // Briefing nach Apply unverändert aus denselben Facts + Draft ableitbar
  const briefing2 = buildSellerWorkBriefing({
    facts: turn.extractedFacts,
    draft,
    lead: applied.lead,
    nextStepHint: turn.captureNextStep,
  });
  assert.equal(briefing2.sections.nextStep, 'Angebot vorbereiten');
  assert.match(String(briefing2.sections.toClarify || ''), /Farbe prüfen/i);
  assert.equal(draft?.vehicleIdentityDraft?.color?.status, 'needs_refinement');

  console.log('✓ Clever Agent V1 – Verkäufer-Arbeitsgrundlage aus Kundenmail E2E');
}

{
  // Golden 17: Mail → Akte/Draft → Handoff „Angebot vorbereiten“ mit Vorbelegung
  const text = `Ich interessiere mich für ein Privatleasing eines Kia EV4 Air in der Farbe Wolfsgrau Metallic, inklusive Winter-Paket P1 mit Wärmepumpe, Sitzheizung vorn und Lenkradheizung.

Meine Wunschkonditionen sind 36 Monate und 15.000 Kilometer pro Jahr. Ich plane mit einer Sonderzahlung in Höhe von 4.500 Euro und bitte um Ausweis der Konditionen auf dieser Basis, vorbehaltlich einer möglichen Förderung.

Bitte teilen Sie mir außerdem die Überführungskosten und alle weiteren Einmalkosten mit.

Falls möglich, würde ich das Fahrzeug gern direkt mit Winterreifen statt Sommerreifen übernehmen oder alternativ ein Angebot für einen passenden Winterradsatz erhalten.`;

  const lead0 = baseLead();
  const turn = runCleverSellerTurn({ lead: lead0, sellerInput: text });
  assert.match(String(turn.workBriefing?.sections?.nextStep || ''), /Angebot vorbereiten/i);

  const prepared = (turn.preparedActions || []).find((a) => (
    a.type === 'prepare_offer' && a.status === 'prepared' && a.payload?.offerDraftId
  ));
  assert.ok(prepared, 'PREPARE_OFFER vorbereitet');

  const applied = applyAcceptedSellerTurn(lead0, {
    ...turn,
    extractedFacts: [...(turn.extractedFacts || [])].reverse(),
    sellerInput: text,
  }, { postFeedCard: false });
  assert.equal(applied.ok, true);

  const draftId = prepared.payload.offerDraftId
    || applied.lead.crm?.cleverWorkingState?.currentOfferDraftId;
  assert.equal(applied.lead.crm?.cleverWorkingState?.currentOfferDraftId, draftId);
  const draft = getOfferDraftById(applied.lead, draftId);
  assert.ok(draft, 'Draft persistiert');
  assert.equal(draft.monthlyRate ?? draft.rate ?? null, null);
  assert.equal(draft.vehicleIdentityDraft?.color?.status, 'needs_refinement');
  assert.match(String(draft.vehicleIdentityDraft?.color?.raw || ''), /wolfsgrau/i);

  // Akte / Wish bereits gefüllt – keine erneute Dateneingabe
  assert.equal(applied.lead.wish?.paymentType, 'leasing');
  assert.equal(applied.lead.wish?.customerType, 'private');
  assert.equal(applied.lead.wish?.termMonths, 36);
  assert.equal(applied.lead.wish?.mileagePerYear, 15000);
  assert.equal(applied.lead.wish?.downPayment, 4500);

  const pkgs = (draft.vehicleIdentityDraft?.packages || []).map((p) => String(p.raw || p.canonical || ''));
  assert.ok(pkgs.some((p) => /Winter-Paket\s*P1|Winterpaket/i.test(p)));
  assert.ok(pkgs.some((p) => /Wärmepumpe/i.test(p)));
  assert.ok(pkgs.some((p) => /Sitzheizung/i.test(p)));
  assert.ok(pkgs.some((p) => /Lenkradheizung/i.test(p)));
  assert.ok(pkgs.some((p) => /Winterreifen/i.test(p)), 'Zusatzwunsch Winterreifen');
  assert.ok(pkgs.some((p) => /Winterradsatz/i.test(p)), 'Zusatzwunsch Winterradsatz');

  const openQs = (turn.extractedFacts || []).filter((f) => f.field === 'openCustomerQuestion');
  assert.ok(openQs.some((f) => f.value?.topic === 'transfer_costs'));
  assert.ok(openQs.some((f) => f.value?.topic === 'one_time_costs'));
  assert.ok(openQs.some((f) => f.value?.topic === 'subsidy'));
  // Offene Fragen bleiben Notiz/Insight – blockieren den Handoff nicht
  const openInsights = (applied.lead.crm?.sellerInsights || [])
    .map((i) => String(i.text || ''))
    .filter((t) => /überführung|einmalkosten|förderung/i.test(t));
  assert.ok(openInsights.length >= 2, 'offene Fragen in Akte erhalten');

  // Bestehender Angebotsprozess öffnen – strict by offerDraftId
  const handoff = buildHandoffFromOfferDraftId(applied.lead, draftId);
  assert.equal(handoff.ok, true);
  assert.equal(handoff.magic?.offerDraftId, draftId);
  assert.equal(handoff.magic?.focusModelKey, 'ev4');
  assert.equal(handoff.magic?.calculation?.monthlyRate ?? null, null);
  assert.equal(handoff.magic?.mode, 'composer_identity_draft');
  assert.equal(handoff.magic?.customerType || applied.lead.wish?.customerType, 'private');

  const patch = magicPreparationToConfigurePatch(handoff.magic);
  assert.ok(patch, 'Configure-Patch aus Handoff');
  assert.equal(patch.modelKey, 'ev4');
  assert.match(String(patch.trimLabel || ''), /Air/i);
  assert.match(String(patch.colorLabel || ''), /wolfsgrau/i);
  assert.equal(patch.colorId ?? null, null, 'Farbe lokal offen / nicht still resolved');
  assert.equal(patch.termMonths, 36);
  assert.equal(patch.mileagePerYear, 15000);
  assert.equal(patch.downPayment, 4500);
  assert.equal(patch.paymentType, 'leasing');
  assert.equal(patch.customerType || applied.lead.wish?.customerType, 'private');
  assert.equal(patch.desiredRate ?? null, null);
  assert.equal(patch.offerDraftId, draftId);

  const labels = (patch.packageLabels || []).map(String);
  assert.ok(
    labels.some((l) => /heat_pump|wärmepumpe|waermepumpe/i.test(l))
    || pkgs.some((p) => /Wärmepumpe/i.test(p)),
    'Ausstattung Wärmepumpe übernommen',
  );
  assert.ok(
    labels.some((l) => /winter/i.test(l)) || pkgs.some((p) => /winter/i.test(p)),
    'Winter-Paket übernommen',
  );
  assert.ok(
    labels.some((l) => /heated_steering|lenkrad/i.test(l))
    || pkgs.some((p) => /Lenkradheizung/i.test(p)),
    'Lenkradheizung übernommen',
  );
  assert.ok(
    labels.some((l) => /winter_tires|winterreifen/i.test(l))
    || pkgs.some((p) => /Winterreifen/i.test(p)),
    'Winterreifen übernommen',
  );

  // Risk-Pfad: unvollständiger CTA-Payload darf keinen Zweit-Draft erzeugen
  const reused = enrichPrepareOfferPayloadWithIdentityDraft(
    { customerId: applied.lead.id },
    {
      facts: turn.extractedFacts || [],
      sellerInput: text,
      lead: applied.lead,
    },
  );
  assert.equal(reused.offerDraftId, draftId, 'Enrich reused bestehende offerDraftId');
  assert.equal(reused.calculation?.monthlyRate ?? reused.monthlyRate ?? null, null);

  console.log('✓ Clever Agent V1 – Mail→Akte→Angebot-Handoff E2E');
}

{
  // Golden 21: Need Consultation / echtes Kundengespräch (fixes now = 2026-09-08)
  const text = 'Der Kunde hat zwei Kinder und einen Hund. Er möchte ein Elektroauto leasen, am liebsten für vier Jahre mit 15.000 Kilometern im Jahr. Er kann 3.000 Euro anzahlen. Wichtig ist ihm eine Wärmepumpe und eine Anhängerkupplung. Aktuell fährt er einen schwarzen VW Polo. Das neue Fahrzeug plant er für Dezember dieses Jahres.';
  const NOW = '2026-09-08T10:00:00';
  const lead0 = baseLead();

  const interpretation = interpretCleverInput({ text, lead: lead0, now: NOW });
  const facts = interpretation.extractedData.facts || [];

  assert.ok(
    interpretation.intent === 'need_consultation'
    || interpretation.intent === 'capture_customer_information',
    `Intent need/capture, got ${interpretation.intent}`,
  );

  assert.ok(facts.some((f) => f.field === 'childrenCount' && Number(f.value) === 2));
  assert.ok(facts.some((f) => (
    f.field === 'pet' && (f.value?.type === 'dog' || /hund/i.test(String(f.label || '')))
  )));
  assert.ok(facts.some((f) => (
    f.field === 'fuelPreference'
    && (f.value === 'electric' || f.value === 'elektro' || f.value === 'bev')
  )));
  assert.ok(facts.some((f) => f.field === 'paymentType' && f.value === 'leasing'));
  assert.ok(facts.some((f) => f.field === 'termMonths' && Number(f.value) === 48));
  assert.ok(facts.some((f) => f.field === 'annualMileage' && Number(f.value) === 15000));
  assert.ok(facts.some((f) => f.field === 'downPayment' && Number(f.value) === 3000));
  assert.ok(facts.some((f) => (
    f.field === 'equipmentWish'
    && (f.value?.id === 'heat_pump' || /wärmepumpe|waermepumpe/i.test(String(f.label || '')))
  )));
  assert.ok(facts.some((f) => f.field === 'towHitchRequired' && f.value !== false && !f.value?.remove));

  const existing = facts.find((f) => f.field === 'existingVehicle');
  assert.ok(existing, 'existingVehicle Fact');
  assert.match(String(existing.value?.make || existing.label || ''), /VW|Volkswagen/i);
  assert.match(String(existing.value?.model || existing.label || ''), /Polo/i);
  assert.match(String(existing.value?.color || ''), /schwarz/i);

  assert.ok(!facts.some((f) => f.field === 'tradeInRequested'), 'kein tradeInRequested');
  assert.ok(!facts.some((f) => f.field === 'tradeInVehicle'), 'kein tradeInVehicle');
  assert.equal(interpretation.extractedData.tradeIn?.status ?? null, null);
  assert.ok(!facts.some((f) => f.field === 'vehicleInterest'), 'kein Wunschmodell / kein Polo-Interest');
  assert.ok(!facts.some((f) => f.field === 'colorPreference'), 'keine Wunschfarbe schwarz');

  const deadline = facts.find((f) => f.field === 'deliveryDeadline');
  assert.ok(deadline, 'deliveryDeadline');
  assert.equal(deadline.value?.endDate, '2026-12');
  assert.ok(!/2026-12-\d{2}/.test(String(deadline.value?.endDate || '')), 'kein erfundener Tag');

  assert.ok(!interpretation.proposedActions?.some((a) => (
    a.type === 'prepare_offer_concept_draft' || a.type === 'prepare_offer_review'
  )), 'kein Concept-Draft ohne Modell');
  assert.equal(interpretation.extractedData.leasing?.rate ?? null, null);

  const turn = runCleverSellerTurn({ lead: lead0, sellerInput: text, now: NOW });
  assert.ok(
    (turn.intents || []).some((i) => i.type === 'update_customer_context')
    || turn.intent === 'update_customer_context'
    || /need_consultation|capture_customer/i.test(String(turn.intent || '')),
  );
  assert.ok(!(turn.preparedActions || []).some((a) => (
    a.type === 'prepare_offer' && a.status === 'prepared' && a.payload?.offerDraftId
  )), 'kein Concept-/Offer-Draft');
  // Kein globaler Review-Blocker nur wegen fehlendem Modell
  assert.ok(
    turn.reviewModel == null
    || turn.reviewModel?.suppressGlobalReview === true
    || turn.responseKind === 'compact_confirmation'
    || turn.responseKind === 'direct_answer'
    || turn.rememberDecision?.mode === 'save_with_undo'
    || turn.rememberDecision?.mode === 'partial_save_with_undo'
    || (turn.preparedActions || []).every((a) => a.type !== 'prepare_offer' || a.status !== 'needs_review'),
    'kein globaler Review-Blocker',
  );

  const briefing = turn.workBriefing || buildSellerWorkBriefing({
    facts: turn.extractedFacts || facts,
    lead: lead0,
    nextStepHint: turn.captureNextStep,
  });
  const s = briefing.sections;
  assert.match(String(s.customerPicture || ''), /2\s*Kinder/i);
  assert.match(String(s.customerPicture || ''), /Hund/i);
  assert.match(String(s.sought || ''), /Elektrofahrzeug|Elektroauto/i);
  assert.match(String(s.leasingWish || ''), /48\s*Monate/i);
  assert.match(String(s.leasingWish || ''), /15\.000\s*km/i);
  assert.match(String(s.leasingWish || ''), /3\.000\s*€/i);
  assert.match(String(s.important || ''), /Wärmepumpe|Waermepumpe/i);
  assert.match(String(s.important || ''), /Anhängerkupplung|AHK/i);
  assert.match(String(s.currentVehicle || ''), /VW\s*Polo/i);
  assert.match(String(s.currentVehicle || ''), /schwarz/i);
  assert.match(String(s.planned || ''), /Dezember\s*2026/i);
  assert.match(
    String(s.nextStep || ''),
    /Passende Fahrzeuge finden|Elektrofahrzeuge finden|Fahrzeugberatung/i,
  );
  assert.ok(!/Angebot vorbereiten/i.test(String(s.nextStep || '')), 'kein Angebot-Next-Step ohne Modell');

  const applied = applyAcceptedSellerTurn(lead0, {
    ...turn,
    extractedFacts: [...(turn.extractedFacts || facts)].reverse(),
    sellerInput: text,
  }, { postFeedCard: false });
  assert.equal(applied.ok, true);

  const profile = getNeedProfileFromLead(applied.lead);
  assert.equal(Number(profile?.household?.childrenCount ?? profile?.children), 2);
  assert.equal(profile?.dog, true);
  assert.equal(profile?.fuel, 'electric');
  assert.equal(applied.lead.wish?.paymentType, 'leasing');
  assert.equal(applied.lead.wish?.termMonths, 48);
  assert.equal(applied.lead.wish?.mileagePerYear, 15000);
  assert.equal(applied.lead.wish?.downPayment, 3000);
  assert.equal(applied.lead.wish?.desiredDeliveryDate, '2026-12');

  const ev = applied.lead.crm?.existingVehicle;
  assert.ok(ev, 'crm.existingVehicle');
  assert.match(String(ev.make || ''), /VW/i);
  assert.match(String(ev.model || ''), /Polo/i);
  assert.match(String(ev.color || ''), /schwarz/i);
  assert.equal(ev.tradeInCandidate, false);

  const tradeIn = getTradeIn(applied.lead);
  assert.ok(
    !tradeIn?.vehicle
    && !/Polo|Inzahlungnahme/i.test(String(tradeIn?.notes || '')),
    'kein Trade-in aus Bestandfahrzeug',
  );
  assert.ok(!applied.lead.crm?.cleverWorkingState?.currentOfferDraftId, 'kein Offer-Draft');
  assert.equal(applied.lead.wish?.desiredRate ?? null, null);
  assert.ok(!/schwarz/i.test(String(profile?.colorPreference || applied.lead.wish?.preferredColor || '')));

  console.log('✓ Clever Agent V1 – Need Consultation / echtes Kundengespräch E2E (Golden 21)');
}

console.log('interpretCleverInput.golden.test.js: ok');
