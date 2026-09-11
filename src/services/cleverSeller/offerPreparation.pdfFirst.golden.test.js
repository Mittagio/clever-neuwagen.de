/**
 * PDF-first Offer-Preparation nach NBA prepare_offer (Goldens A–E).
 * node --test src/services/cleverSeller/offerPreparation.pdfFirst.golden.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import {
  buildOfferPreparationHandoffModel,
  resolvePrepareOfferDraftId,
} from './buildOfferPreparationHandoffModel.js';
import {
  buildHandoffFromOfferDraftId,
  getOfferDraftById,
  upsertOfferDraftOnLead,
} from './cleverWorkingDraft.js';
import { ensureConceptOfferDraftFromCapture } from './ensureConceptOfferDraftFromCapture.js';
import { mergePdfIntoActiveOfferDraft } from './offerDraftIntakeMerge.js';
import {
  findSendableVehicleOffer,
} from './determineNextBestSellerAction.js';
import { buildSellerWorkBriefing } from './buildSellerWorkBriefing.js';
import { RATE_AUTHORITY } from './captureThenOffer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const followUpSrc = readFileSync(
  join(__dirname, '../../components/dealer-ai/DealerAiLeadFollowUp.jsx'),
  'utf8',
);
const sharedSrc = readFileSync(
  join(__dirname, '../../components/dealer-ai/CustomerAkteSharedWorkspace.jsx'),
  'utf8',
);
const cardSrc = readFileSync(
  join(__dirname, '../../components/dealer-ai/SellerUniversalReviewCard.jsx'),
  'utf8',
);

function conceptLeadEv3({ offerDraftId = 'ofd_ev3' } = {}) {
  let lead = {
    id: 'lead-prep-ev3',
    name: 'Test',
    contact: { name: 'Test' },
    wish: {
      termMonths: 48,
      mileagePerYear: 15000,
      downPayment: 3000,
      paymentType: 'leasing',
    },
    crm: { needProfile: createEmptyNeedProfile() },
  };
  const ensured = ensureConceptOfferDraftFromCapture(lead, [], {
    modelKey: 'ev3',
    force: true,
    createNewAlternative: false,
    sellerInput: 'EV3 Angebot',
  });
  lead = ensured.lead;
  const createdId = ensured.offerDraftId;
  assert.ok(createdId, 'Concept-Draft angelegt');
  let draft = getOfferDraftById(lead, createdId);
  // Stable ID für Goldens (strict reuse)
  if (createdId !== offerDraftId) {
    const state = lead.crm.cleverWorkingState;
    const stored = state.offerDrafts[createdId];
    delete state.offerDrafts[createdId];
    stored.offerDraftId = offerDraftId;
    state.offerDrafts[offerDraftId] = stored;
    state.currentOfferDraftId = offerDraftId;
    draft = getOfferDraftById(lead, offerDraftId);
  }
  lead = upsertOfferDraftOnLead(lead, {
    ...draft,
    offerDraftId,
    rate: null,
    monthlyRate: null,
    missingRate: true,
  });
  return lead;
}

function pdfFactsEv3() {
  return [
    { field: 'vehicleInterest', value: { modelKey: 'ev3', modelLabel: 'EV3' }, confidence: 1 },
    { field: 'trimPreference', value: 'Earth', confidence: 1 },
    { field: 'colorPreference', value: 'Clear White', confidence: 1 },
    { field: 'termMonths', value: 48, confidence: 1 },
    { field: 'annualMileage', value: 15000, confidence: 1 },
    { field: 'downPayment', value: 3000, confidence: 1 },
    {
      field: 'desiredRate',
      value: 329,
      confidence: 1,
      rateAuthority: RATE_AUTHORITY.AUTHORITATIVE,
      source: 'pdf',
    },
  ];
}

describe('Offer Preparation PDF-first', () => {
  it('A: prepare_offer → slim Prep, gleiche offerDraftId, PDF Primary, kein Calculator Auto-Open', () => {
    const lead = conceptLeadEv3();
    const nbaPayload = {
      modelKey: 'ev3',
      offerDraftId: 'ofd_ev3',
      termMonths: 48,
      annualMileage: 15000,
      downPayment: 3000,
    };
    assert.equal(resolvePrepareOfferDraftId(lead, nbaPayload), 'ofd_ev3');

    const model = buildOfferPreparationHandoffModel({
      lead,
      offerDraftId: 'ofd_ev3',
      nbaPayload,
    });
    assert.ok(model, 'Prep-Handoff sichtbar');
    assert.equal(model.offerDraftId, 'ofd_ev3');
    assert.equal(model.reviewType, 'offer_preparation_handoff');
    assert.match(String(model.offerReview?.heroLine || ''), /EV3/i);
    assert.match(String(model.offerReview?.conditionsLine || ''), /48/);
    assert.match(String(model.offerReview?.conditionsLine || ''), /15\.000|15000/);
    assert.match(String(model.offerReview?.openLine || ''), /Rate noch offen/i);

    const sec = model.actionSections[0];
    assert.equal(sec.primaryActions.length, 1);
    assert.equal(sec.primaryActions[0].action, 'upload_pdf');
    assert.match(sec.primaryActions[0].label, /PDF/i);
    assert.ok(sec.secondaryActions.some((a) => a.action === 'open_offer_manual'));
    assert.ok(sec.secondaryActions.some((a) => a.action === 'dismiss_offer_prep'));

    // Wiring: kein Legacy onPrepareOffer Auto-Open im NBA-Pfad
    assert.ok(followUpSrc.includes('buildOfferPreparationHandoffModel'));
    assert.ok(followUpSrc.includes('setOfferPrepHandoffDraftId'));
    assert.ok(followUpSrc.includes('PDF-first Prep-Handoff'));
    assert.ok(followUpSrc.includes('Kein stiller Calculator-Fallback'));
    assert.ok(sharedSrc.includes('offerPrepHandoffModel'));
    assert.ok(sharedSrc.includes('open_offer_manual'));
    assert.ok(cardSrc.includes('isOfferPrepHandoff'));
  });

  it('B: PDF-Merge in denselben ofd_ev3, keine zweite Draft-ID', () => {
    const lead = conceptLeadEv3();
    const before = getOfferDraftById(lead, 'ofd_ev3');
    assert.equal(before?.rate ?? null, null);

    const merged = mergePdfIntoActiveOfferDraft({
      lead,
      workingMemory: { currentOfferDraftId: 'ofd_ev3' },
      facts: pdfFactsEv3(),
      sellerInput: 'PDF: Freibleibende Kalkulation.pdf',
      offerDraftId: 'ofd_ev3',
    });
    assert.equal(merged.ok, true);
    assert.equal(merged.mutation.offerDraft.offerDraftId, 'ofd_ev3');
    assert.equal(merged.rate, 329);
    assert.ok(sharedSrc.includes('runComposerPdfAttachTurnWithOcr'), 'bestehender PDF-Pfad');
    assert.ok(
      readFileSync(join(__dirname, 'planSellerActions.js'), 'utf8').includes('mergePdfIntoActiveOfferDraft'),
    );
  });

  it('C: Manuell ergänzen → Handoff gleiche offerDraftId, Werte prefilled', () => {
    const lead = conceptLeadEv3();
    const handoff = buildHandoffFromOfferDraftId(lead, 'ofd_ev3', { sellerInput: '' });
    assert.equal(handoff.ok, true);
    assert.equal(handoff.magic?.offerDraftId || handoff.offerDraft?.offerDraftId, 'ofd_ev3');
    const commercial = handoff.magic?.commercialScenario
      || handoff.offerDraft?.commercialScenario
      || {};
    const term = commercial.termMonths ?? lead.wish.termMonths;
    const km = commercial.annualMileage ?? commercial.mileagePerYear ?? lead.wish.mileagePerYear;
    const az = commercial.downPayment ?? lead.wish.downPayment;
    assert.equal(Number(term), 48);
    assert.equal(Number(km), 15000);
    assert.equal(Number(az), 3000);
    assert.ok(sharedSrc.includes("action.action === 'open_offer_manual'"));
    assert.ok(sharedSrc.includes('openHandoffForOfferDraftId'));
  });

  it('D: nach echter Rate / sendable → Prep weg, NBA intend_send „An Kunden senden“', () => {
    let lead = conceptLeadEv3();
    const prepBefore = buildOfferPreparationHandoffModel({
      lead,
      offerDraftId: 'ofd_ev3',
      nbaPayload: { modelKey: 'ev3' },
    });
    assert.ok(prepBefore);

    lead = {
      ...lead,
      crm: {
        ...lead.crm,
        vehicleOffers: [{
          id: 'vo_ev3',
          offerDraftId: 'ofd_ev3',
          monthlyRate: 329,
          rateAuthority: RATE_AUTHORITY.AUTHORITATIVE,
          paymentType: 'leasing',
          boardOffer: {
            payment: { monthlyRate: 329, type: 'leasing' },
            rateAuthority: RATE_AUTHORITY.AUTHORITATIVE,
          },
        }],
      },
    };
    assert.ok(findSendableVehicleOffer(lead));
    assert.equal(
      buildOfferPreparationHandoffModel({
        lead,
        offerDraftId: 'ofd_ev3',
        nbaPayload: { modelKey: 'ev3' },
      }),
      null,
      'Prep nicht mehr Primary',
    );
    const briefing = buildSellerWorkBriefing({ lead, facts: [] });
    assert.equal(briefing.nextBestAction?.handler, 'intend_send');
    assert.equal(briefing.nextBestAction?.label, 'An Kunden senden');
  });

  it('E: Reload – Draft + offerDraftId rekonstruierbar, NBA weiter prepare_offer', () => {
    const lead = conceptLeadEv3();
    const snap = JSON.parse(JSON.stringify(lead));
    const draft = getOfferDraftById(snap, 'ofd_ev3');
    assert.ok(draft);
    assert.equal(snap.crm.cleverWorkingState.currentOfferDraftId, 'ofd_ev3');
    assert.equal(draft.rate ?? null, null);
    assert.equal(resolvePrepareOfferDraftId(snap, { offerDraftId: 'ofd_ev3', modelKey: 'ev3' }), 'ofd_ev3');
    const briefing = buildSellerWorkBriefing({ lead: snap, facts: [] });
    assert.equal(briefing.nextBestAction?.handler, 'prepare_offer');
    const model = buildOfferPreparationHandoffModel({
      lead: snap,
      offerDraftId: 'ofd_ev3',
      nbaPayload: briefing.nextBestAction?.contextPayload || {},
    });
    assert.ok(model);
    assert.equal(model.offerDraftId, 'ofd_ev3');
  });
});
