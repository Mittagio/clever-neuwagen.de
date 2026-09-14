/**
 * Pattern: Portal Change Request Stability V1
 *
 * Rate-Invalidierung · Quiet Diff km+AZ · sourceOfferDraftId · Scenario-Isolation
 *
 * node --test src/services/cleverSeller/ulmerPortalChangeStability.golden.test.js
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { buildSellerWorkBriefing } from './buildSellerWorkBriefing.js';
import {
  getCleverWorkingState,
  getOfferDraftById,
  upsertOfferDraftOnLead,
} from './cleverWorkingDraft.js';
import { mergePdfIntoActiveOfferDraft } from './offerDraftIntakeMerge.js';
import { materializeVehicleOfferFromOfferDraft } from './materializeVehicleOfferFromOfferDraft.js';
import {
  findSendableVehicleOffer,
  findPortalChangeRequest,
  NEXT_BEST_ACTION_ID,
} from './determineNextBestSellerAction.js';
import { buildOfferChangeHandoffModel } from './buildOfferChangeHandoffModel.js';
import { RATE_AUTHORITY } from './captureThenOffer.js';
import { SELLER_FACT_SOURCE } from './sellerFactTypes.js';
import {
  listStoredVehicleOffers,
  resolveSourceOfferDraftId,
} from '../vehicleOffer.js';
import { buildVehicleOpportunityCards } from '../customerAkte.js';
import {
  prepareCustomerOfferPortfolio,
  markPortfolioSent,
  applyPortfolioEvent,
  PORTFOLIO_EVENTS,
  PORTFOLIO_REACTION_STATUS,
} from '../crm/customerOfferPortfolioService.js';
import {
  prepareCustomerPortalAccess,
  markCustomerPortalAccessSent,
} from '../crm/customerPortalAccessService.js';

const ENV = {
  VITE_CLEVER_SELLER_ORCHESTRATOR: 'true',
  CLEVER_SELLER_ORCHESTRATOR: 'true',
};

const DUMP = `Michael Ulmer möchte einen EV3 in der Ausstattungsvariante R
mit Wärmepumpe in Farbe Weiß.

Das zweite Angebot ist ein EV3 VIC Upgrade Business Paket
in der Farbe Schwarz.

Er möchte 48 Monate, 12.500 Kilometer
und 4.000 Euro Anzahlung.

Er braucht das Auto sofort.

Zusätzlich hätte er für beide Fahrzeuge jeweils noch gern
ein Barangebot mit 15 Prozent Rabatt auf den Listenpreis.`;

const CUSTOMER_MSG = `Das weiße Angebot gefällt mir.
Bitte aber mit 15.000 km statt 12.500 km
und ohne Anzahlung.
Das schwarze Angebot kann so bleiben.`;

function emptyLead() {
  return {
    id: 'lead-ulmer-portal-stability',
    name: null,
    contact: {},
    wish: {},
    crm: {
      needProfile: createEmptyNeedProfile(),
      vehicleConfigurations: [],
      cleverWorkingState: null,
      vehicleOffers: {},
    },
  };
}

function pickDrafts(lead) {
  const state = getCleverWorkingState(lead);
  const drafts = Object.keys(state.offerDrafts || {}).map((id) => getOfferDraftById(lead, id));
  const white = drafts.find((d) => /wei/i.test(String(d.vehicleIdentityDraft?.color?.raw || '')));
  const black = drafts.find((d) => /schwarz/i.test(String(d.vehicleIdentityDraft?.color?.raw || '')));
  return { white, black };
}

function voBySrc(lead, src) {
  return listStoredVehicleOffers(lead).find((o) => resolveSourceOfferDraftId(o) === src) || null;
}

function mergeMat(lead, offerDraftId, { rate, color, km = 12500, az = 4000 }) {
  const facts = [
    {
      field: 'desiredRate',
      value: { amount: rate },
      source: SELLER_FACT_SOURCE.OFFER_PDF,
      rateAuthority: RATE_AUTHORITY.AUTHORITATIVE,
    },
    { field: 'colorPreference', value: { color }, source: SELLER_FACT_SOURCE.OFFER_PDF },
    { field: 'paymentType', value: 'leasing', source: SELLER_FACT_SOURCE.OFFER_PDF },
    { field: 'vehicleInterest', value: { modelKey: 'ev3' }, source: SELLER_FACT_SOURCE.OFFER_PDF },
    { field: 'annualMileage', value: km, source: SELLER_FACT_SOURCE.OFFER_PDF },
    { field: 'downPayment', value: az, source: SELLER_FACT_SOURCE.OFFER_PDF },
    { field: 'termMonths', value: 48, source: SELLER_FACT_SOURCE.OFFER_PDF },
  ];
  const merged = mergePdfIntoActiveOfferDraft({
    lead,
    offerDraftId,
    workingMemory: { currentOfferDraftId: offerDraftId },
    facts,
    sellerInput: `PDF ${color}`,
  });
  lead = upsertOfferDraftOnLead(lead, {
    ...merged.mutation.offerDraft,
    vehicleIdentityDraft: merged.mutation.vehicleIdentityDraft,
  });
  return materializeVehicleOfferFromOfferDraft(lead, offerDraftId).lead;
}

describe('Portal Change Request Stability V1 · Ulmer', () => {
  it('Change Request → invalidate Weiß · Diff km+AZ · Scenario-Isolation · Re-PDF', () => {
    let lead = applyAcceptedSellerTurn(
      emptyLead(),
      runCleverSellerTurn({ lead: emptyLead(), sellerInput: DUMP, env: ENV }),
      { postFeedCard: false },
    ).lead;
    lead = {
      ...lead,
      name: 'Michael Ulmer',
      contact: { name: 'Michael Ulmer', email: 'ulmer@example.de' },
    };

    const { white, black } = pickDrafts(lead);
    const id1 = white.offerDraftId;
    const id2 = black.offerDraftId;

    // Scenario IDs je Track isoliert (Working State)
    assert.notEqual(
      getOfferDraftById(lead, id1).commercialScenarioId,
      getOfferDraftById(lead, id2).commercialScenarioId,
      'Commercial Scenario IDs track-isoliert',
    );
    assert.match(String(getOfferDraftById(lead, id1).commercialScenarioId), /leasing-/);
    assert.match(String(getOfferDraftById(lead, id2).commercialScenarioId), /leasing-/);

    lead = mergeMat(lead, id1, { rate: 406.93, color: 'Weiss' });
    lead = mergeMat(lead, id2, { rate: 419.5, color: 'Schwarz' });

    const cards = buildVehicleOpportunityCards({
      lead,
      configurations: lead.crm?.vehicleConfigurations || [],
      reservedModels: lead.crm?.reservedModels || [],
    }) || [];
    const portfolioPrep = prepareCustomerOfferPortfolio({
      lead,
      vehicleCards: cards,
      origin: 'https://example.test',
    });
    assert.equal(portfolioPrep.itemCount, 2);

    for (const item of portfolioPrep.portfolio.items) {
      assert.ok(
        resolveSourceOfferDraftId(item) || item.sourceOfferDraftId || item.offerDraftId,
        'sourceOfferDraftId am Portfolio-Item',
      );
    }

    const portalPrep = prepareCustomerPortalAccess(lead, {
      portfolioUrl: portfolioPrep.portfolio.url,
      email: lead.contact.email,
      accessToken: portfolioPrep.portfolio.token,
    });
    lead = {
      ...portalPrep.lead,
      crm: {
        ...portalPrep.lead.crm,
        customerOfferPortfolio: markPortfolioSent(portfolioPrep.portfolio),
        customerPortalAccess: portalPrep.access,
      },
    };
    lead = markCustomerPortalAccessSent(lead).lead;

    const whiteItem = lead.crm.customerOfferPortfolio.items.find((it) => (
      resolveSourceOfferDraftId(it) === id1
      || it.sourceOfferDraftId === id1
      || it.offerDraftId === id1
    ));
    const blackItem = lead.crm.customerOfferPortfolio.items.find((it) => (
      resolveSourceOfferDraftId(it) === id2
      || it.sourceOfferDraftId === id2
      || it.offerDraftId === id2
    ));
    assert.ok(whiteItem && blackItem);

    const blackBefore = JSON.stringify({
      rate: voBySrc(lead, id2).monthlyRate,
      auth: voBySrc(lead, id2).rateAuthority,
      km: voBySrc(lead, id2).mileagePerYear,
      az: voBySrc(lead, id2).downPayment,
      draftKm: getOfferDraftById(lead, id2).commercialScenario?.annualMileage,
      draftAz: getOfferDraftById(lead, id2).commercialScenario?.downPayment,
      csc: getOfferDraftById(lead, id2).commercialScenarioId,
    });

    const change = applyPortfolioEvent(
      lead,
      whiteItem.id,
      PORTFOLIO_EVENTS.OFFER_CHANGE_REQUEST,
      {
        token: lead.crm.customerOfferPortfolio.token,
        questionText: CUSTOMER_MSG,
        changeDimension: 'mileage',
      },
    );
    assert.equal(change.ok, true);
    lead = change.lead;

    const reactedW = lead.crm.customerOfferPortfolio.items.find((i) => i.id === whiteItem.id);
    const reactedB = lead.crm.customerOfferPortfolio.items.find((i) => i.id === blackItem.id);
    assert.equal(reactedW.customerReaction.status, PORTFOLIO_REACTION_STATUS.CHANGE_REQUESTED);
    assert.equal(reactedB.customerReaction.status, PORTFOLIO_REACTION_STATUS.NONE);
    assert.equal(reactedW.customerReaction.requestedMileage, 15000);
    assert.equal(reactedW.customerReaction.requestedDownPayment, 0);

    const voW = voBySrc(lead, id1);
    const voB = voBySrc(lead, id2);
    assert.equal(voW.rateAuthority, RATE_AUTHORITY.STALE);
    assert.equal(voW.invalidateVehicleRate, true);
    assert.equal(voW.monthlyRate, 406.93, 'Rate historisch behalten');
    assert.equal(voB.rateAuthority, RATE_AUTHORITY.AUTHORITATIVE);
    assert.equal(voB.invalidateVehicleRate, false);
    assert.equal(voB.mileagePerYear, 12500);
    assert.equal(voB.downPayment, 4000);

    const sendable = findSendableVehicleOffer(lead);
    assert.ok(sendable);
    assert.notEqual(resolveSourceOfferDraftId(sendable.offer), id1, 'Weiß nicht sendable');

    const handoff = buildOfferChangeHandoffModel({ lead });
    assert.ok(handoff);
    assert.match(String(handoff.offerChange.beforeLabel), /12\.500/);
    assert.match(String(handoff.offerChange.beforeLabel), /4\.000/);
    assert.match(String(handoff.offerChange.afterLabel), /15\.000/);
    assert.match(String(handoff.offerChange.afterLabel), /0\s*€/);
    assert.equal(handoff.offerChange.requestedDownPayment, 0);

    const nba = buildSellerWorkBriefing({ lead, facts: [] }).nextBestAction;
    assert.equal(nba?.handler, NEXT_BEST_ACTION_ID.MODIFY_OFFER);
    assert.equal(nba?.label, 'Angebot anpassen');

    const portalChange = findPortalChangeRequest(lead);
    assert.equal(portalChange?.offerDraftId, id1);

    // Draft 2 Working State unverändert
    const blackAfter = JSON.stringify({
      rate: voBySrc(lead, id2).monthlyRate,
      auth: voBySrc(lead, id2).rateAuthority,
      km: voBySrc(lead, id2).mileagePerYear,
      az: voBySrc(lead, id2).downPayment,
      draftKm: getOfferDraftById(lead, id2).commercialScenario?.annualMileage,
      draftAz: getOfferDraftById(lead, id2).commercialScenario?.downPayment,
      csc: getOfferDraftById(lead, id2).commercialScenarioId,
    });
    assert.equal(blackAfter, blackBefore);

    // Re-PDF nur Weiß
    lead = mergeMat(lead, id1, {
      rate: 438.2,
      color: 'Weiss',
      km: 15000,
      az: 0,
    });
    assert.equal(getOfferDraftById(lead, id1).rate, 438.2);
    assert.equal(getOfferDraftById(lead, id1).rateAuthority, RATE_AUTHORITY.AUTHORITATIVE);
    assert.equal(getOfferDraftById(lead, id1).commercialScenario?.annualMileage, 15000);
    assert.equal(getOfferDraftById(lead, id1).commercialScenario?.downPayment, 0);
    assert.equal(getOfferDraftById(lead, id2).rate, 419.5);
    assert.equal(getOfferDraftById(lead, id2).commercialScenario?.annualMileage, 12500);
    assert.equal(getOfferDraftById(lead, id2).commercialScenario?.downPayment, 4000);

    assert.equal(listStoredVehicleOffers(lead).length, 2);
    assert.equal(voBySrc(lead, id1).monthlyRate, 438.2);
    assert.equal(voBySrc(lead, id2).monthlyRate, 419.5);

    // Re-PDF schließt Change Request → intend_send (kein manueller Clear)
    assert.equal(findPortalChangeRequest(lead), null);
    const cards2 = buildVehicleOpportunityCards({
      lead,
      configurations: lead.crm?.vehicleConfigurations || [],
      reservedModels: lead.crm?.reservedModels || [],
    }) || [];
    const pf2 = prepareCustomerOfferPortfolio({ lead, vehicleCards: cards2 });
    assert.equal(pf2.itemCount, 2);

    const nba2 = buildSellerWorkBriefing({ lead, facts: [] }).nextBestAction;
    assert.equal(nba2?.handler, NEXT_BEST_ACTION_ID.INTEND_SEND);
    assert.equal(nba2?.label, 'An Kunden senden');
  });
});
