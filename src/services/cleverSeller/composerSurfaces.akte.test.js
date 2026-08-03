/**
 * Akte-Surface: gleicher Orchestrator wie Global Composer, fester Lead.
 * Brandes: Nachfassen + PDF/Contract + Termin – Confirm-Vertrag.
 * node --test src/services/cleverSeller/composerSurfaces.akte.test.js
 */
import assert from 'node:assert/strict';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { runComposerPdfAttachTurn } from './runComposerPdfAttachTurn.js';
import { createBrandesGoldenCaseLead } from '../crm/brandesGoldenCase.js';

const AKTE_SCOPE = 'customer_akte';
const NOW = new Date('2026-07-31T10:00:00+02:00');

const GOLDEN_CONTRACT = `Leasingvertrag
Kunde Herr Brandes
Ford Kuga
Vertragsbeginn 01.12.2022
Laufzeit 48 Monate
15.000 km jährlich
Rate 329 Euro
Sonderzahlung 0 Euro
Vertragsende 30.11.2026
Mehrkilometer 8 Cent
Minderkilometer 3 Cent`;

function brandesAkteLead() {
  return createBrandesGoldenCaseLead({ phase: 'golden' });
}

function akteTurn(params = {}) {
  const lead = params.lead || brandesAkteLead();
  return runCleverSellerTurn({
    customerName: lead.contact?.name || lead.name || 'Brandes',
    scopeHint: AKTE_SCOPE,
    now: NOW,
    ...params,
    lead,
  });
}

// --- Nachfassen: Review + Message, kein Auto-Send ---
{
  const leadBefore = brandesAkteLead();
  const snap = JSON.stringify(leadBefore);
  const turn = akteTurn({
    lead: leadBefore,
    sellerInput: 'Fass bei Brandes nach wegen dem XCeed.',
  });
  assert.ok(shouldShowUniversalReview(turn) || turn.messageDraft
    || turn.preparedActions?.some((a) => a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE));
  assert.equal(turn.resolvedCustomer?.id || leadBefore.id, leadBefore.id);
  const hasDraft = Boolean(
    turn.messageDraft
    || turn.preparedActions?.some((a) => (
      a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE && a.payload?.messageDraft
    )),
  );
  assert.ok(hasDraft, 'Nachfassen muss Kundennachricht vorbereiten');
  assert.equal(JSON.stringify(leadBefore), snap, 'Propose darf Lead nicht mutieren');
}

// --- PDF/Contract über denselben Attach-Service wie Global ---
{
  const brandes = brandesAkteLead();
  const { prepared, turn, skipped } = runComposerPdfAttachTurn({
    extracted: {
      ok: true,
      text: GOLDEN_CONTRACT,
      fileName: 'vertrag-brandes.pdf',
    },
    file: { type: 'application/pdf', name: 'vertrag-brandes.pdf' },
    lead: brandes,
    customerName: 'Brandes',
    scopeHint: AKTE_SCOPE,
  });
  assert.equal(skipped, false);
  assert.equal(prepared.kind, 'contract_pdf');
  assert.ok(turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT && a.status === 'prepared'
  )));
  assert.equal(turn.contractDraft?.monthlyRate, 329);
  assert.ok(shouldShowUniversalReview(turn));
  assert.equal(buildUniversalReviewModel(turn).reviewType, 'contract_import_review');

  const applied = applyAcceptedSellerTurn(brandes, turn, { postFeedCard: false });
  assert.ok(applied.ok);
  assert.equal(applied.lead.crm.customerContracts[0].commercialTerms.monthlyRate, 329);
}

// --- Termin: Propose + Message, kein Auto-Book ---
{
  const brandes = brandesAkteLead();
  const beforeAppts = JSON.stringify(brandes.crm?.appointments || brandes.appointments || []);
  const turn = akteTurn({
    lead: brandes,
    sellerInput: 'Schlag ihm Montag um 15 Uhr einen Termin vor.',
    workingContextItems: [{
      id: 'wc-xceed',
      kind: 'vehicle',
      label: 'Kia XCeed',
      shortLabel: 'XCeed',
      model: 'XCeed',
      customerId: brandes.id,
    }],
  });
  assert.ok(shouldShowUniversalReview(turn));
  const model = buildUniversalReviewModel(turn);
  assert.ok(
    model.reviewType === 'appointment_and_message_review'
    || turn.preparedActions?.some((a) => a.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT),
  );
  assert.ok(turn.preparedAppointment?.startAt || turn.preparedActions?.some((a) => (
    a.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT
  )));
  assert.equal(
    JSON.stringify(brandes.crm?.appointments || brandes.appointments || []),
    beforeAppts,
    'Propose darf Termin nicht auto-buchen',
  );

  const applied = applyAcceptedSellerTurn(brandes, turn, { postFeedCard: false });
  assert.ok(applied.ok);
  // Accept bereitet vor / dokumentiert – kein stiller Kalender-Commit ohne Confirm-Pfad
  assert.ok(!containsAutoBookFlag(turn));
}

function containsAutoBookFlag(turn) {
  const actions = turn?.preparedActions || [];
  return actions.some((a) => a.autoBook === true || a.payload?.autoBook === true);
}

console.log('composerSurfaces.akte.test.js: ok');
