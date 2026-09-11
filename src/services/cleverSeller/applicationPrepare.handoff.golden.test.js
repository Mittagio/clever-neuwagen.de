/**
 * Golden: Application-Prepare-Handoff nach Zusage + Docs/SA vollständig.
 * node src/services/cleverSeller/applicationPrepare.handoff.golden.test.js
 */
import assert from 'node:assert/strict';
import { buildApplicationPrepareHandoffModel } from './buildApplicationPrepareHandoffModel.js';
import { PORTFOLIO_REACTION_STATUS } from '../crm/customerOfferPortfolioService.js';
import { VEHICLE_OFFER_STATUS } from '../vehicleOffer.js';

function committedLead(extraCrm = {}) {
  return {
    id: 'lead-app-prep',
    contact: { name: 'Thomas Müller' },
    wish: { paymentType: 'leasing', termMonths: 48, mileagePerYear: 15000 },
    crm: {
      needProfile: { fuel: 'electric', selectedModelKey: 'ev3' },
      vehicleOffers: {
        'vo-1': {
          id: 'vo-1',
          offerDraftId: 'od-1',
          status: VEHICLE_OFFER_STATUS.ACCEPTED,
          modelLabel: 'EV3 Earth',
          trimLabel: 'Earth',
          monthlyRate: 329,
          termMonths: 48,
          mileagePerYear: 15000,
          rateAuthority: 'bank_pdf',
          boardOffer: { payment: { monthlyRate: 329, termMonths: 48 } },
        },
      },
      customerOfferPortfolio: {
        status: 'reacted',
        items: [{
          id: 'pu-1',
          vehicleCardId: 'vo-1',
          offerDraftId: 'od-1',
          customerReaction: {
            status: PORTFOLIO_REACTION_STATUS.INTERESTED,
            questionText: 'Passt so, ich nehme das Fahrzeug.',
          },
        }],
      },
      unterlagenSummary: { openCount: 0, missingCount: 0, presentCount: 4 },
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
      ...extraCrm,
    },
  };
}

{
  // A: Ready → Briefing, nicht Docs-Checklist
  const model = buildApplicationPrepareHandoffModel({ lead: committedLead() });
  assert.ok(model);
  assert.equal(model.reviewType, 'application_prepare_handoff');
  assert.equal(model.applicationPrepare.dealStatus, 'Kunde hat zugesagt');
  assert.equal(model.applicationPrepare.documentsStatus, 'Unterlagen vollständig');
  assert.equal(model.applicationPrepare.selfDisclosureStatus, 'Selbstauskunft vollständig');
  const section = model.actionSections[0];
  assert.equal(section.primaryActions[0].action, 'seed_application_prepare');
  assert.equal(section.primaryActions[0].label, 'Antrag im Composer vorbereiten');
  assert.equal(section.secondaryActions[0].action, 'open_unterlagen');
  assert.equal(section.secondaryActions[0].label, 'Unterlagen ansehen');
  assert.match(String(section.sellerSummary || ''), /zugesagt|vollständig|Antrag/i);
  console.log('✓ A – handoff ready');
}

{
  // B: Docs offen → kein Application-Handoff
  const model = buildApplicationPrepareHandoffModel({
    lead: committedLead({
      unterlagenSummary: { openCount: 2, missingCount: 2, presentCount: 0 },
    }),
  });
  assert.equal(model, null);
  console.log('✓ B – blocked while docs open');
}

{
  // C: Kein Commitment → null
  const lead = committedLead();
  lead.crm.customerOfferPortfolio.items[0].customerReaction.status = PORTFOLIO_REACTION_STATUS.NONE;
  lead.crm.vehicleOffers['vo-1'].status = VEHICLE_OFFER_STATUS.SENT;
  const model = buildApplicationPrepareHandoffModel({ lead });
  assert.equal(model, null);
  console.log('✓ C – no commitment');
}

console.log('applicationPrepare.handoff.golden.test.js: ok');
