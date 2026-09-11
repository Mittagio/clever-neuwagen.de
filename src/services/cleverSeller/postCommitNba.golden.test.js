/**
 * Post-Commit NBA Goldens A–D
 * node src/services/cleverSeller/postCommitNba.golden.test.js
 */
import assert from 'node:assert/strict';
import { buildSellerWorkBriefing } from './buildSellerWorkBriefing.js';
import {
  NEXT_BEST_ACTION_ID,
  determineNextBestSellerAction,
  hasCustomerOfferCommitment,
} from './determineNextBestSellerAction.js';
import { PORTFOLIO_REACTION_STATUS } from '../crm/customerOfferPortfolioService.js';
import { VEHICLE_OFFER_STATUS } from '../vehicleOffer.js';

function baseLead(crm = {}) {
  return {
    id: 'lead-post-commit-nba',
    contact: { name: 'Thomas Müller' },
    wish: { paymentType: 'leasing', termMonths: 48, mileagePerYear: 15000 },
    crm: {
      needProfile: { fuel: 'electric', selectedModelKey: 'ev3' },
      vehicleConfigurations: [],
      vehicleOffers: {},
      customerOfferPortfolio: { items: [], status: 'reacted' },
      cleverWorkingState: null,
      cleverUnterlagen: { items: {} },
      ...crm,
    },
  };
}

function committedSendableLead(extraCrm = {}) {
  return baseLead({
    vehicleOffers: {
      'vo-accepted': {
        id: 'vo-accepted',
        offerDraftId: 'od-ev3',
        status: VEHICLE_OFFER_STATUS.ACCEPTED,
        monthlyRate: 329,
        rateAuthority: 'bank_pdf',
        paymentType: 'leasing',
        boardOffer: {
          payment: { type: 'leasing', monthlyRate: 329 },
          rateAuthority: 'bank_pdf',
        },
      },
    },
    customerOfferPortfolio: {
      status: 'reacted',
      sentAt: '2026-09-01T10:00:00.000Z',
      items: [{
        id: 'pu-1',
        vehicleCardId: 'vo-accepted',
        offerDraftId: 'od-ev3',
        customerReaction: {
          status: PORTFOLIO_REACTION_STATUS.INTERESTED,
          questionText: 'Passt so, ich nehme das Fahrzeug.',
          reactedAt: '2026-09-01T12:00:00.000Z',
        },
      }],
    },
    ...extraCrm,
  });
}

{
  // Golden A – accepted + docs open → Unterlagen anfordern (nicht intend_send)
  const lead = committedSendableLead({
    unterlagenSummary: { openCount: 2, missingCount: 2, presentCount: 0 },
    requestedDocuments: [
      { id: 'income', label: 'Gehaltsnachweis', status: 'missing' },
      { id: 'id', label: 'Personalausweis', status: 'missing' },
    ],
  });
  assert.equal(hasCustomerOfferCommitment(lead), true);
  const nba = determineNextBestSellerAction({ lead });
  assert.equal(nba.handler, 'request_documents');
  assert.equal(nba.label, 'Unterlagen anfordern');
  assert.notEqual(nba.handler, 'intend_send');
  const briefing = buildSellerWorkBriefing({ lead, facts: [] });
  assert.equal(briefing.sections.dealStatus, 'Kunde hat zugesagt');
  assert.match(String(briefing.sections.openWork || ''), /Unterlagen/);
  assert.equal(briefing.sections.nextStep, 'Unterlagen anfordern');
  console.log('✓ Golden A – post-commit documents');
}

{
  // Golden B – accepted + docs complete + SA incomplete → Self-Disclosure
  const lead = committedSendableLead({
    unterlagenSummary: { openCount: 0, missingCount: 0, presentCount: 3 },
    requestedDocuments: [
      { id: 'income', status: 'received' },
      { id: 'id', status: 'received' },
    ],
    cleverUnterlagen: {
      items: {
        ausweis: { status: 'uploaded' },
        gehaltsnachweis: { status: 'uploaded' },
        bankverbindung: { status: 'uploaded' },
        sonstiges: { status: 'not_needed' },
        selbstauskunft: { status: 'open' },
      },
      selbstauskunft: { status: 'not_started' },
    },
  });
  // Explizite Summary sagt Docs fertig – SA über cleverUnterlagen getrennt:
  // resolvePostCommitOpenWork: summary openCount 0 → SA incomplete false when summary complete.
  // Für Golden B: Summary nicht „alles klar“, sondern Docs via slots, SA offen.
  lead.crm.unterlagenSummary = null;
  lead.crm.requestedDocuments = [];

  const nba = determineNextBestSellerAction({ lead });
  assert.equal(nba.id, NEXT_BEST_ACTION_ID.REQUEST_SELF_DISCLOSURE);
  assert.equal(nba.handler, 'self_disclosure_request');
  assert.equal(nba.label, 'Selbstauskunft anfordern');
  assert.notEqual(nba.handler, 'intend_send');
  console.log('✓ Golden B – self disclosure');
}

{
  // Golden C – accepted + docs + SA complete → Antrag vorbereiten
  const lead = committedSendableLead({
    unterlagenSummary: { openCount: 0, missingCount: 0, presentCount: 4 },
    requestedDocuments: [
      { id: 'income', status: 'received' },
      { id: 'id', status: 'received' },
    ],
    cleverUnterlagen: {
      items: {
        ausweis: { status: 'checked' },
        gehaltsnachweis: { status: 'checked' },
        bankverbindung: { status: 'checked' },
        sonstiges: { status: 'not_needed' },
        selbstauskunft: { status: 'checked' },
      },
      selbstauskunft: { status: 'checked' },
    },
  });
  const nba = determineNextBestSellerAction({ lead });
  assert.equal(nba.id, NEXT_BEST_ACTION_ID.APPLICATION_PREPARE);
  assert.equal(nba.handler, 'application_prepare');
  assert.equal(nba.label, 'Antrag vorbereiten');
  assert.notEqual(nba.handler, 'intend_send');
  console.log('✓ Golden C – application prepare');
}

{
  // Golden D – nach Change: neue ungesendete Version → intend_send wieder Primary
  const lead = committedSendableLead({
    unterlagenSummary: { openCount: 2, missingCount: 2, presentCount: 0 },
  });
  // Change resolved → keine active Interest; Commitment bleibt über ACCEPTED offer
  lead.crm.customerOfferPortfolio.items[0].customerReaction = {
    status: PORTFOLIO_REACTION_STATUS.NONE,
    resolvedAt: '2026-09-02T10:00:00.000Z',
  };
  lead.crm.vehicleOffers['vo-new-20k'] = {
    id: 'vo-new-20k',
    offerDraftId: 'od-ev3-20k',
    status: VEHICLE_OFFER_STATUS.PREPARED,
    monthlyRate: 359,
    rateAuthority: 'bank_pdf',
    paymentType: 'leasing',
    boardOffer: {
      payment: { type: 'leasing', monthlyRate: 359 },
      rateAuthority: 'bank_pdf',
    },
  };

  assert.equal(hasCustomerOfferCommitment(lead), true);
  const nba = determineNextBestSellerAction({ lead });
  assert.equal(nba.handler, 'intend_send');
  assert.equal(nba.label, 'An Kunden senden');
  assert.equal(nba.reason, 'post_commit_unsent_offer');
  assert.equal(nba.contextPayload?.cardId, 'vo-new-20k');

  // Nach „Versand“: neue Version accepted → zurück Post-Commit Docs
  lead.crm.vehicleOffers['vo-new-20k'].status = VEHICLE_OFFER_STATUS.ACCEPTED;
  lead.crm.customerOfferPortfolio.items[0].customerReaction = {
    status: PORTFOLIO_REACTION_STATUS.INTERESTED,
    reactedAt: '2026-09-02T12:00:00.000Z',
  };
  const nbaAfterSend = determineNextBestSellerAction({ lead });
  assert.equal(nbaAfterSend.handler, 'request_documents');
  assert.equal(nbaAfterSend.label, 'Unterlagen anfordern');
  console.log('✓ Golden D – unsent after change, then post-commit again');
}

console.log('postCommitNba.golden.test.js: ok');
