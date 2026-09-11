/**
 * Golden: Quiet Change Diff Handoff
 * node src/services/cleverSeller/offerChange.handoff.golden.test.js
 */
import assert from 'node:assert/strict';
import { buildOfferChangeHandoffModel } from './buildOfferChangeHandoffModel.js';
import { PORTFOLIO_REACTION_STATUS } from '../crm/customerOfferPortfolioService.js';

function leadWithChange() {
  return {
    id: 'lead-change',
    wish: { mileagePerYear: 15000, termMonths: 48 },
    crm: {
      needProfile: { selectedModelKey: 'ev3' },
      vehicleOffers: {
        'vo-1': {
          id: 'vo-1',
          offerDraftId: 'od-1',
          modelLabel: 'EV3 Earth',
          monthlyRate: 329,
          mileagePerYear: 15000,
          rateAuthority: 'bank_pdf',
          boardOffer: { payment: { monthlyRate: 329 } },
        },
      },
      customerOfferPortfolio: {
        items: [{
          id: 'pu-1',
          vehicleCardId: 'vo-1',
          offerDraftId: 'od-1',
          customerReaction: {
            status: PORTFOLIO_REACTION_STATUS.CHANGE_REQUESTED,
            questionText: 'Das Angebot gefällt mir, aber bitte mit 20.000 Kilometern.',
            changeDimension: 'mileage',
          },
        }],
      },
    },
  };
}

{
  const model = buildOfferChangeHandoffModel({ lead: leadWithChange() });
  assert.ok(model);
  assert.equal(model.reviewType, 'offer_change_handoff');
  assert.equal(model.offerChange.beforeLabel, '15.000 km/Jahr');
  assert.equal(model.offerChange.afterLabel, '20.000 km/Jahr');
  assert.match(String(model.offerReview.conditionsLine), /15\.000.*20\.000/);
  const primary = model.actionSections[0].primaryActions[0];
  assert.equal(primary.action, 'apply_offer_change');
  assert.equal(primary.label, 'Angebot anpassen');
  assert.equal(model.actionSections[0].secondaryActions[0].action, 'dismiss_offer_change');
  console.log('✓ Quiet Diff mileage');
}

{
  const lead = leadWithChange();
  lead.crm.customerOfferPortfolio.items[0].customerReaction.status = PORTFOLIO_REACTION_STATUS.INTERESTED;
  assert.equal(buildOfferChangeHandoffModel({ lead }), null);
  console.log('✓ No handoff without change request');
}

console.log('offerChange.handoff.golden.test.js: ok');
