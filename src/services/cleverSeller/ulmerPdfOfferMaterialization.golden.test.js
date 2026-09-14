/**
 * Pattern: PDF Merge → VehicleOffer Materialization V1
 *
 * Concept Draft + autoritative PDF-Rate → genau ein VehicleOffer (idempotent by offerDraftId).
 * Multi-Offer Isolation. Keine neue Offer-Architektur.
 *
 * node --test src/services/cleverSeller/ulmerPdfOfferMaterialization.golden.test.js
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
import {
  materializeVehicleOfferFromOfferDraft,
  findVehicleOfferBySourceOfferDraftId,
} from './materializeVehicleOfferFromOfferDraft.js';
import {
  findSendableVehicleOffer,
  NEXT_BEST_ACTION_ID,
} from './determineNextBestSellerAction.js';
import { RATE_AUTHORITY } from './captureThenOffer.js';
import { SELLER_FACT_SOURCE } from './sellerFactTypes.js';
import {
  listStoredVehicleOffers,
  resolveSourceOfferDraftId,
} from '../vehicleOffer.js';
import { listCommercialScenarios } from '../crm/commercialScenarios.js';
import { buildVehicleOpportunityCards } from '../customerAkte.js';
import {
  prepareCustomerOfferPortfolio,
  markPortfolioSent,
  PORTFOLIO_STATUS,
} from '../crm/customerOfferPortfolioService.js';
import {
  prepareCustomerPortalAccess,
  markCustomerPortalAccessSent,
  PORTAL_ACCESS_STATUS,
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

function emptyLead() {
  return {
    id: 'lead-ulmer-pdf-mat',
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

function captureUlmer() {
  const lead0 = emptyLead();
  const turn = runCleverSellerTurn({ lead: lead0, sellerInput: DUMP, env: ENV });
  const applied = applyAcceptedSellerTurn(lead0, turn, { postFeedCard: false });
  assert.equal(applied.ok, true);
  return applied.lead;
}

function pickDrafts(lead) {
  const state = getCleverWorkingState(lead);
  const drafts = Object.keys(state.offerDrafts || {}).map((id) => getOfferDraftById(lead, id));
  assert.equal(drafts.length, 2, '2 Concept Drafts');
  const white = drafts.find((d) => /wei/i.test(String(d.vehicleIdentityDraft?.color?.raw || '')));
  const black = drafts.find((d) => /schwarz/i.test(String(d.vehicleIdentityDraft?.color?.raw || '')));
  assert.ok(white && black, 'Weiß + Schwarz Drafts');
  return { white, black };
}

function pdfFacts({ rate, color }) {
  return [
    {
      field: 'desiredRate',
      value: { amount: rate },
      source: SELLER_FACT_SOURCE.OFFER_PDF,
      rateAuthority: RATE_AUTHORITY.AUTHORITATIVE,
    },
    {
      field: 'colorPreference',
      value: { color },
      source: SELLER_FACT_SOURCE.OFFER_PDF,
    },
    {
      field: 'paymentType',
      value: 'leasing',
      source: SELLER_FACT_SOURCE.OFFER_PDF,
    },
    {
      field: 'vehicleInterest',
      value: { modelKey: 'ev3' },
      source: SELLER_FACT_SOURCE.OFFER_PDF,
    },
  ];
}

function mergeAndMaterialize(lead, offerDraftId, { rate, color }) {
  const merged = mergePdfIntoActiveOfferDraft({
    lead,
    offerDraftId,
    workingMemory: { currentOfferDraftId: offerDraftId },
    facts: pdfFacts({ rate, color }),
    sellerInput: `PDF ${color}`,
  });
  assert.equal(merged.ok, true, 'PDF-Merge ok');
  let next = upsertOfferDraftOnLead(lead, {
    ...merged.mutation.offerDraft,
    vehicleIdentityDraft: merged.mutation.vehicleIdentityDraft,
  });
  const mat = materializeVehicleOfferFromOfferDraft(next, offerDraftId, {
    sellerInput: `PDF ${color}`,
  });
  assert.equal(mat.ok, true, `Materialize ${offerDraftId}: ${mat.reason || 'ok'}`);
  return { lead: mat.lead, merged, mat };
}

describe('PDF Merge → VehicleOffer Materialization V1 · Ulmer', () => {
  it('PHASE A–E: Capture → PDF1 → PDF2 → Portfolio → Send', () => {
    // PHASE A
    let lead = captureUlmer();
    const { white, black } = pickDrafts(lead);
    assert.equal(white.rate ?? null, null);
    assert.equal(black.rate ?? null, null);
    assert.equal(listStoredVehicleOffers(lead).length, 0);
    assert.equal(findSendableVehicleOffer(lead), null);

    // PHASE B – PDF 1 (Weiß)
    const id1 = white.offerDraftId;
    const id2 = black.offerDraftId;
    let step = mergeAndMaterialize(lead, id1, { rate: 406.93, color: 'Weiss' });
    lead = step.lead;

    assert.equal(getOfferDraftById(lead, id1).rate, 406.93);
    assert.equal(getOfferDraftById(lead, id1).rateAuthority, RATE_AUTHORITY.AUTHORITATIVE);
    assert.equal(getOfferDraftById(lead, id2).rate ?? null, null);

    const vosB = listStoredVehicleOffers(lead);
    assert.equal(vosB.length, 1);
    assert.equal(resolveSourceOfferDraftId(vosB[0]), id1);
    assert.equal(vosB[0].monthlyRate, 406.93);
    assert.equal(vosB[0].rateAuthority, RATE_AUTHORITY.AUTHORITATIVE);
    assert.equal(findVehicleOfferBySourceOfferDraftId(lead, id2), null);

    const nbaB = buildSellerWorkBriefing({ lead, facts: [] }).nextBestAction;
    assert.equal(nbaB?.handler, NEXT_BEST_ACTION_ID.PREPARE_OFFER);
    assert.equal(nbaB?.contextPayload?.offerDraftId, id2);

    // Idempotenz PDF1
    const again = materializeVehicleOfferFromOfferDraft(lead, id1);
    assert.equal(again.ok, true);
    assert.equal(again.created, false);
    assert.equal(listStoredVehicleOffers(again.lead).length, 1);
    lead = again.lead;

    // PHASE C – PDF 2 (Schwarz)
    step = mergeAndMaterialize(lead, id2, { rate: 419.5, color: 'Schwarz' });
    lead = step.lead;

    assert.equal(getOfferDraftById(lead, id1).rate, 406.93);
    assert.equal(getOfferDraftById(lead, id2).rate, 419.5);

    const vosC = listStoredVehicleOffers(lead);
    assert.equal(vosC.length, 2);
    const bySrc = Object.fromEntries(
      vosC.map((o) => [resolveSourceOfferDraftId(o), o]),
    );
    assert.equal(bySrc[id1]?.monthlyRate, 406.93);
    assert.equal(bySrc[id2]?.monthlyRate, 419.5);
    assert.ok(!/schwarz/i.test(String(bySrc[id1]?.boardOffer?.vehicle?.colorLabel || '')));
    assert.ok(findSendableVehicleOffer(lead));

    const nbaC = buildSellerWorkBriefing({ lead, facts: [] }).nextBestAction;
    assert.equal(nbaC?.handler, NEXT_BEST_ACTION_ID.INTEND_SEND);
    assert.equal(nbaC?.label, 'An Kunden senden');

    // PHASE D – Portfolio genau 2
    const cash = listCommercialScenarios(lead)
      .filter((s) => s.paymentType === 'cash' || s.type === 'cash');
    assert.ok(cash.some((s) => Number(s.discountPercent) === 15));
    assert.ok(cash.some((s) => s.discountBase === 'listPrice'));

    const cards = buildVehicleOpportunityCards({
      lead,
      configurations: lead.crm?.vehicleConfigurations || [],
      reservedModels: lead.crm?.reservedModels || [],
    }) || [];
    assert.equal(cards.length, 2, 'genau 2 Fahrzeugkarten');
    const portfolio = prepareCustomerOfferPortfolio({ lead, vehicleCards: cards });
    assert.equal(portfolio.ok, true);
    assert.equal(portfolio.itemCount, 2, 'genau 2 Portfolio-Items');

    // PHASE E – ein Kundenlink
    lead = {
      ...lead,
      contact: {
        ...(lead.contact || {}),
        name: lead.contact?.name || lead.name || 'Michael Ulmer',
        email: lead.contact?.email || 'ulmer@example.de',
      },
      name: lead.name || 'Michael Ulmer',
    };
    const portalPrep = prepareCustomerPortalAccess(lead, {
      portfolioUrl: portfolio.portfolio.url,
      email: lead.contact.email,
      accessToken: portfolio.portfolio.token,
    });
    assert.equal(portalPrep.ok, true);
    assert.equal(portalPrep.access.status, PORTAL_ACCESS_STATUS.PREPARED);

    const sentPortfolio = markPortfolioSent(portfolio.portfolio);
    const sentAccess = markCustomerPortalAccessSent({
      ...portalPrep.lead,
      crm: {
        ...portalPrep.lead.crm,
        customerOfferPortfolio: portfolio.portfolio,
        customerPortalAccess: portalPrep.access,
      },
    }, { via: 'email' });

    lead = {
      ...sentAccess.lead,
      crm: {
        ...sentAccess.lead.crm,
        customerOfferPortfolio: sentPortfolio,
        customerPortalAccess: sentAccess.lead.crm?.customerPortalAccess || portalPrep.access,
      },
    };

    assert.equal(lead.crm.customerOfferPortfolio.status, PORTFOLIO_STATUS.SENT);
    assert.equal(lead.crm.customerOfferPortfolio.items.length, 2);
    assert.ok(lead.crm.customerOfferPortfolio.url || lead.crm.customerOfferPortfolio.token);
    assert.equal(lead.crm.customerPortalAccess.status, PORTAL_ACCESS_STATUS.SENT);
    assert.match(String(lead.name || lead.contact?.name || ''), /Michael\s+Ulmer/i);
  });
});
