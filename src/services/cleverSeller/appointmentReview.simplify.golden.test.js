/**
 * Appointment-Review: kompakte Entscheidungsansicht + Kontext-Validierung
 * node --test src/services/cleverSeller/appointmentReview.simplify.golden.test.js
 */
import assert from 'node:assert/strict';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { buildUniversalReviewModel } from './buildUniversalReviewModel.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { resolveRelativeDateTime } from './resolveRelativeDateTime.js';
import { validateDiscountPercent, INVALID_DISCOUNT_WARNING } from './validateDiscountPercent.js';
import { normalizeVehicleDisplayLabel } from './normalizeVehicleDisplayLabel.js';
import { detectVehicleTrimConflict } from './detectVehicleTrimConflict.js';
import { prepareContextualAppointmentProposal } from './prepareContextualAppointmentProposal.js';
import { formatContractEndLabel } from './formatContractEndLabel.js';
import { buildOfferAttachmentLabel } from './buildOfferAttachmentLabel.js';
import {
  APPOINTMENT_REVIEW_CHIPS,
  COMPOSER_PRIMARY_CHIPS,
  resolveComposerChipsForReview,
} from '../crm/composerSuggestionService.js';

const NOW = new Date('2026-07-20T10:16:00+02:00');

const kaiLead = {
  id: 'lead-kai-drechsel',
  name: 'Kai Drechsel',
  contact: { name: 'Kai Drechsel', salutation: 'herr' },
  wish: {
    model: 'EV2',
    trim: 'Air',
    color: 'Rot',
    paymentType: 'leasing',
  },
};

// --- validateDiscountPercent ---
{
  assert.equal(validateDiscountPercent(21).ok, true);
  assert.equal(validateDiscountPercent(0).ok, true);
  assert.equal(validateDiscountPercent(100).ok, true);
  assert.equal(validateDiscountPercent(449).ok, false);
  assert.equal(validateDiscountPercent(449).conflict, true);
  assert.equal(validateDiscountPercent(449).warning, INVALID_DISCOUNT_WARNING);
  assert.equal(validateDiscountPercent(-1).ok, false);
}

// --- 449 % blocked ---
{
  const interpreted = interpretSellerInput('EV2 Air mit 449 % Rabatt Leasingangebot');
  assert.ok(interpreted.facts.some((f) => f.field === 'discountPercentInvalid'));
  assert.ok(!interpreted.facts.some((f) => f.field === 'discountPercent'));
  assert.match(
    interpreted.facts.find((f) => f.field === 'discountPercentInvalid').label,
    /ungültig/i,
  );
}

// --- „15 Uhr“ → 15:00 (nicht aktuelle Minuten 16) ---
{
  const dt = resolveRelativeDateTime('am 29.07.2026 um 15 Uhr', { now: NOW });
  assert.equal(dt.ok, true);
  assert.equal(dt.timeLabel, '15:00');
  assert.equal(dt.minute, 0);
  assert.match(dt.dateLabel, /Mittwoch.*29\.\s*Juli\s*2026/i);
}

{
  const explicit = resolveRelativeDateTime('am 29.07.2026 um 15:16 Uhr', { now: NOW });
  assert.equal(explicit.ok, true);
  assert.equal(explicit.timeLabel, '15:16');
}

// --- Vehicle label ohne Duplikate ---
{
  const label = normalizeVehicleDisplayLabel('Kia EV2 Air / Kia EV2 · Rot · EV2 Air');
  assert.equal(label, 'Kia EV2 Air · Rot');
  assert.doesNotMatch(label, /\/|EV2 Air · EV2/);
}

// --- Air vs GT-Line Konflikt ---
{
  const conflict = detectVehicleTrimConflict([
    { model: 'EV2', trim: 'Air', source: 'lead' },
    { model: 'EV2', trim: 'GT-Line', source: 'working_context' },
  ]);
  assert.equal(conflict.conflict, true);
  assert.ok(conflict.options.some((o) => o.trim === 'Air'));
  assert.ok(conflict.options.some((o) => o.trim === 'GT-Line'));

  const prepared = prepareContextualAppointmentProposal({
    sellerInput: 'Schlag Kai am 29.07.2026 um 15 Uhr einen Termin vor.',
    lead: kaiLead,
    customerName: 'Kai Drechsel',
    workingContextItems: [{
      model: 'EV2',
      trim: 'GT-Line',
      label: 'Kia EV2 GT-Line',
      vehicleLabel: 'Kia EV2 GT-Line',
    }],
    now: NOW,
  });
  assert.equal(prepared.vehicleTrimConflict?.conflict, true);
  assert.equal(prepared.sendable, false);
  assert.equal(prepared.messageDraft, null);
}

// --- Golden: Kai Drechsel Termin 29.07.2026 15:00 EV2 Air – Review clean ---
{
  const turn = runCleverSellerTurn({
    lead: kaiLead,
    sellerInput: 'Schlag Kai am 29.07.2026 um 15 Uhr einen Termin zur Beratung vor.',
    customerName: 'Kai Drechsel',
    scopeHint: 'customer',
    now: NOW,
  });
  assert.ok(turn.preparedAppointment?.startsAt);
  assert.equal(turn.preparedAppointment.timeLabel, '15:00');
  assert.match(String(turn.preparedAppointment.dateLabel || ''), /Mittwoch.*29\.\s*Juli\s*2026/i);

  const review = buildUniversalReviewModel(turn);
  assert.equal(review.reviewType, 'appointment_and_message_review');
  assert.equal(review.compactUi, true);
  assert.match(String(review.title || ''), /TERMINVORSCHLAG VORBEREITET/i);
  assert.equal(review.groups?.length || 0, 0);
  assert.ok(review.appointmentReview);
  assert.equal(review.appointmentReview.timeLabel, '15:00');
  assert.match(String(review.appointmentReview.dateLabel || ''), /Mittwoch.*29\.\s*Juli\s*2026/i);
  assert.match(String(review.appointmentReview.appointmentTypeLabel || ''), /Beratung|Autohaus/i);
  assert.match(String(review.appointmentReview.vehicleLabel || ''), /EV2/i);
  assert.doesNotMatch(String(review.appointmentReview.vehicleLabel || ''), /\//);
  assert.match(String(review.appointmentReview.calendarLabel || ''), /noch nicht geprüft/i);
  assert.ok(review.appointmentReview.message);

  const openChipDump = (review.collapsedContext?.groups || [])
    .flatMap((g) => g.chips || [])
    .join(' · ');
  // Offene Review zeigt keine Fact-Chips
  assert.equal((review.groups || []).flatMap((g) => g.chips || []).length, 0);
  assert.ok(review.collapsedContext);

  const apptSec = (review.actionSections || []).find((s) => s.kind === 'appointment_and_message_review');
  assert.ok(apptSec?.primaryActions?.some((a) => a.action === 'send_appointment_proposal'));
  assert.ok(!String(apptSec?.body || '').includes('Finanziell'));
  assert.ok(!/%\s*Rabatt/i.test(String(apptSec?.body || '')));
  void openChipDump;
}

// --- Konflikt blockiert Send in Review ---
{
  const turn = runCleverSellerTurn({
    lead: kaiLead,
    sellerInput: 'Schlag Kai am 29.07.2026 um 15 Uhr einen Termin vor.',
    customerName: 'Kai Drechsel',
    scopeHint: 'customer',
    now: NOW,
    workingContextItems: [{
      model: 'EV2',
      trim: 'GT-Line',
      label: 'Kia EV2 GT-Line',
      vehicleLabel: 'Kia EV2 GT-Line',
    }],
  });
  const review = buildUniversalReviewModel(turn);
  assert.equal(review.reviewType, 'appointment_and_message_review');
  assert.equal(review.sendBlocked, true);
  const apptSec = (review.actionSections || []).find((s) => s.kind === 'appointment_and_message_review');
  assert.ok(apptSec?.primaryActions?.some((a) => a.action === 'resolve_vehicle_trim'));
  assert.ok(!apptSec?.primaryActions?.some((a) => (
    a.action === 'send_appointment_proposal' && !a.disabled
  )));
}

// --- Generische Chips nicht bei Appointment-Review ---
{
  const chips = resolveComposerChipsForReview({
    reviewType: 'appointment_and_message_review',
    actionSections: [{
      kind: 'appointment_and_message_review',
      primaryActions: [{ id: 'send_proposal', action: 'send_appointment_proposal' }],
    }],
  });
  assert.deepEqual(chips.chips, []);
  assert.ok(COMPOSER_PRIMARY_CHIPS.some((c) => c.id === 'nachfassen'));
  assert.ok(APPOINTMENT_REVIEW_CHIPS.length >= 3);

  const normal = resolveComposerChipsForReview({ reviewType: null });
  assert.ok(normal.chips.some((c) => c.id === 'nachfassen'));

  const offerOpen = resolveComposerChipsForReview({
    reviewType: 'offer_prepare',
    actionSections: [{
      kind: 'offer_prepare',
      primaryActions: [{ id: 'create', action: 'open_offer_handoff' }],
    }],
  });
  assert.equal(offerOpen.chips.length, 0);
}

// --- Vertragsende Format ---
{
  assert.equal(formatContractEndLabel('2026-07', { type: 'leasing' }), 'Leasing endet im Juli 2026');
  const interpreted = interpretSellerInput('Leasing läuft Juli 2026 aus, EV2 Air');
  const end = interpreted.facts.find((f) => f.field === 'existingContractEnd');
  assert.ok(end);
  assert.match(end.label, /Leasing endet im Juli 2026/i);
  assert.doesNotMatch(end.label, /2026-07/);
}

// --- Attachment-Label ---
{
  const built = buildOfferAttachmentLabel({
    fileName: 'EV2 Air 36 15.000 km.pdf',
    text: 'Kia EV2 Air Leasingangebot\nLaufzeit 36 Monate\n15.000 km / Jahr',
  });
  assert.match(built.label, /EV2-Angebot/);
  assert.match(built.label, /36 Monate/);
  assert.match(built.label, /15\.000 km/);
  assert.equal(built.detailLabel, 'EV2 Air 36 15.000 km.pdf');
}

// --- Interest trim conflict fact ---
{
  const interpreted = interpretSellerInput('Kunde will EV2 Air und EV2 GT-Line');
  assert.ok(interpreted.facts.some((f) => f.field === 'vehicleTrimConflict'));
  assert.ok(!interpreted.facts.some((f) => f.field === 'vehicleInterestMulti'));
}

console.log('appointmentReview.simplify.golden.test.js: OK');
