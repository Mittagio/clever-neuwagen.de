/**
 * node src/services/cleverSeller/patchSellerReviewFact.test.js
 */
import assert from 'node:assert/strict';
import {
  buildIntakeQuickCorrectActions,
  buildInboundIntakePresentation,
  buildInboundLeadReviewModel,
} from './inboundLeadIntake.js';
import {
  formatLiveEditChipLabel,
  normalizeEmailLiveEdit,
  normalizePhoneLiveEdit,
  patchSellerReviewFact,
  undoSellerReviewFactPatch,
  validateLiveEditValue,
} from './patchSellerReviewFact.js';
import { searchVerifiedVehicleOptions } from './liveEditVehicleOptions.js';
import { SELLER_FACT_SOURCE } from './sellerFactTypes.js';

// --- Validators ---
{
  const phone = normalizePhoneLiveEdit('015118697789');
  assert.equal(phone.ok, true);
  assert.match(phone.value, /01511/);
  assert.equal(normalizePhoneLiveEdit('12').ok, false);
  assert.equal(normalizeEmailLiveEdit('m.wittig@wittig.de').ok, true);
  assert.equal(normalizeEmailLiveEdit('not-an-email').ok, false);
  assert.equal(validateLiveEditValue('termMonths', '48').ok, true);
  assert.equal(validateLiveEditValue('termMonths', '3').ok, false);
  assert.equal(formatLiveEditChipLabel('termMonths', 48), '48 M');
  assert.equal(formatLiveEditChipLabel('annualMileage', 12500), '12.500 km');
}

// --- Vehicle search (verified catalog) ---
{
  const hits = searchVerifiedVehicleOptions('EV3', { limit: 6 });
  assert.ok(hits.length >= 1, 'EV3 hits');
  assert.ok(hits.some((h) => /EV3/i.test(h.label) && /Air/i.test(h.label)), 'EV3 Air option');
}

// --- Golden A: phone live-edit updates chip + provenance + undo ---
{
  const inbound = {
    detected: true,
    proposeCreateCustomer: true,
    resolutionStatus: 'none',
    contact: {
      fullName: 'Matthias Wittig',
      email: 'm.wittig@wittig.de',
      phone: '0157 8897799',
    },
  };
  const turn = {
    inboundLead: inbound,
    extractedFacts: [
      {
        field: 'vehicleInterest',
        label: 'Kia EV2 Earth',
        value: { make: 'Kia', model: 'EV2', trim: 'Earth' },
        confidence: 0.95,
      },
      { field: 'paymentType', label: 'Leasing', value: 'leasing', confidence: 0.9 },
      { field: 'termMonths', label: '48 Monate', value: 48, confidence: 0.92 },
      { field: 'annualMileage', label: '12.500 km', value: 12500, confidence: 0.92 },
      { field: 'phone', label: '0157 8897799', value: '0157 8897799', confidence: 0.9 },
      { field: 'email', label: 'm.wittig@wittig.de', value: 'm.wittig@wittig.de', confidence: 0.9 },
    ],
  };

  const presentation = buildInboundIntakePresentation(inbound, turn);
  assert.ok(presentation.recognizedFactChips?.some((c) => c.field === 'phone' && c.editable));
  assert.ok(presentation.recognizedFactChips?.some((c) => c.field === 'vehicleInterest'));

  const patched = patchSellerReviewFact({
    turn,
    field: 'phone',
    value: '01511 8697789',
    leads: [],
  });
  assert.equal(patched.ok, true);
  const phoneFact = patched.lastTurn.extractedFacts.find((f) => f.field === 'phone');
  assert.match(String(phoneFact.label), /01511/);
  assert.equal(phoneFact.source, SELLER_FACT_SOURCE.MANUAL_EDIT);
  assert.equal(phoneFact.correctionSource, 'seller');
  assert.ok(phoneFact.previousValue);
  assert.equal(phoneFact.previousValue.label, '0157 8897799');
  assert.equal(patched.lastTurn.inboundLead.contact.phone, phoneFact.label);
  assert.match(patched.microConfirm?.text || '', /Telefon/i);
  assert.ok((patched.highlightChipLabels || []).length >= 1);
  assert.ok(patched.reviewModel?.groups?.some((g) => (
    g.id === 'contact' && /01511/.test(String(g.line || ''))
  )), 'Telefon in Kontakt-Briefing-Zeile');

  const undone = undoSellerReviewFactPatch({
    turn: patched.lastTurn,
    undoSnapshot: patched.undoSnapshot,
  });
  assert.equal(undone.ok, true);
  const restoredPhone = undone.lastTurn.extractedFacts.find((f) => f.field === 'phone');
  assert.equal(restoredPhone.label, '0157 8897799');
}

// --- Golden B: vehicle correction → current candidate EV3 Air, EV2 in previousValue ---
{
  const inbound = {
    detected: true,
    proposeCreateCustomer: true,
    resolutionStatus: 'none',
    contact: { fullName: 'Matthias Wittig', email: 'a@b.de' },
  };
  const turn = {
    inboundLead: inbound,
    extractedFacts: [
      {
        field: 'vehicleInterest',
        label: 'Kia EV2 Earth',
        value: { make: 'Kia', model: 'EV2', trim: 'Earth', modelKey: 'ev2' },
        confidence: 0.8,
        needsConfirmation: true,
      },
    ],
  };
  const hits = searchVerifiedVehicleOptions('EV3 Air', { limit: 3 });
  const pick = hits.find((h) => /EV3/i.test(h.label) && /Air/i.test(h.label)) || hits[0];
  assert.ok(pick, 'verified EV3 Air');
  const patched = patchSellerReviewFact({
    turn,
    field: 'vehicleInterest',
    value: pick,
    leads: [],
  });
  assert.equal(patched.ok, true);
  const vehicle = patched.lastTurn.extractedFacts.find((f) => f.field === 'vehicleInterest');
  assert.match(vehicle.label, /EV3/i);
  assert.match(vehicle.previousValue.label, /EV2/i);
  assert.equal(patched.lastTurn.inboundLead.currentVehicleCandidate.label, vehicle.label);
  assert.match(patched.lastTurn.inboundLead.previousVehicleCandidate.label, /EV2/i);
}

// --- Golden C: identity rematch hint ---
{
  const existing = {
    id: 'lead-wittig',
    name: 'Matthias Wittig',
    contact: {
      name: 'Matthias Wittig',
      email: 'm.wittig@wittig.de',
      phone: '015118697789',
    },
  };
  const inbound = {
    detected: true,
    proposeCreateCustomer: true,
    resolutionStatus: 'none',
    contact: {
      fullName: 'Matthias Wittig',
      email: 'other@example.de',
      phone: null,
    },
  };
  const turn = {
    inboundLead: inbound,
    extractedFacts: [
      { field: 'email', label: 'other@example.de', value: 'other@example.de' },
    ],
  };
  const patched = patchSellerReviewFact({
    turn,
    field: 'email',
    value: 'm.wittig@wittig.de',
    leads: [existing],
  });
  assert.equal(patched.ok, true);
  assert.equal(patched.lastTurn.inboundLead.resolutionStatus, 'unique');
  assert.equal(patched.matchHint?.text, 'Passende Kundenakte gefunden');
  assert.match(patched.matchHint?.name || '', /Wittig/i);
}

// --- Golden D: quick correct only contextual ---
{
  const clearInbound = {
    detected: true,
    proposeCreateCustomer: true,
    resolutionStatus: 'none',
    contact: {
      fullName: 'Matthias Wittig',
      email: 'm.wittig@wittig.de',
      phone: '01511 8697789',
    },
  };
  const clearTurn = {
    inboundLead: clearInbound,
    extractedFacts: [
      {
        field: 'vehicleInterest',
        label: 'Kia EV2 Earth',
        value: { model: 'EV2', trim: 'Earth' },
        confidence: 0.95,
        needsConfirmation: false,
      },
      { field: 'paymentType', label: 'Leasing', value: 'leasing', confidence: 0.9 },
      { field: 'termMonths', label: '48', value: 48, confidence: 0.9 },
      { field: 'annualMileage', label: '12500', value: 12500, confidence: 0.9 },
      { field: 'phone', label: '01511 8697789', value: '01511 8697789', confidence: 0.9 },
    ],
  };
  const clearActions = buildIntakeQuickCorrectActions(clearInbound, clearTurn);
  assert.equal(clearActions.length, 0, 'keine Schnell-Korrektur wenn klar');

  const needPhone = {
    ...clearInbound,
    contact: { ...clearInbound.contact, phone: null },
  };
  const needTurn = {
    ...clearTurn,
    inboundLead: needPhone,
    extractedFacts: clearTurn.extractedFacts.filter((f) => f.field !== 'phone'),
  };
  const phoneActions = buildIntakeQuickCorrectActions(needPhone, needTurn);
  assert.ok(phoneActions.some((a) => a.field === 'phone'));
  assert.ok(phoneActions.length <= 3);

  const model = buildInboundLeadReviewModel(needPhone, needTurn);
  assert.equal(model.liveEditEnabled, false, 'confident Briefing: kein Live-Edit-Modus');
  assert.deepEqual(model.quickCorrectActions, []);
  assert.equal(model.primaryCta, 'Angebot vorbereiten');
  const open = model.groups.find((g) => g.id === 'open');
  assert.equal(open?.line, 'Telefonnummer');
  assert.ok((open?.localActions || []).some((a) => /Telefon ergänzen/i.test(a.label)));
}

console.log('patchSellerReviewFact.test.js: ok');
