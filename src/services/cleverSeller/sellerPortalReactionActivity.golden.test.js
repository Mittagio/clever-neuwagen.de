/**
 * Pattern: Seller Activity Presenter / Portal Reaction V1
 *
 * Heute · Quiet Diff · Draft-strict · Frage vs Change · Mixed Partial Success
 *
 * node --test src/services/cleverSeller/sellerPortalReactionActivity.golden.test.js
 */
import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import {
  getCleverWorkingState,
  getOfferDraftById,
  upsertOfferDraftOnLead,
} from './cleverWorkingDraft.js';
import { mergePdfIntoActiveOfferDraft } from './offerDraftIntakeMerge.js';
import { materializeVehicleOfferFromOfferDraft } from './materializeVehicleOfferFromOfferDraft.js';
import {
  findPortalChangeRequest,
  findPortalCustomerQuestion,
  determineNextBestSellerAction,
  NEXT_BEST_ACTION_ID,
} from './determineNextBestSellerAction.js';
import { buildOfferChangeHandoffModel } from './buildOfferChangeHandoffModel.js';
import {
  buildPrimarySellerPortalReactionActivity,
  SELLER_PORTAL_ACTIVITY_KIND,
  classifyPortalFreitextSignals,
} from './buildSellerPortalReactionActivity.js';
import { getTodayOverview } from './getTodayOverview.js';
import { buildDashboardTodayRecommendations } from '../journey/buildDashboardTodayRecommendations.js';
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
  isPriceRelevantOfferChange,
} from '../crm/customerOfferPortfolioService.js';
import {
  prepareCustomerPortalAccess,
  markCustomerPortalAccessSent,
} from '../crm/customerPortalAccessService.js';
import {
  __clearInboxTestMode,
  __resetInboxStoreForTests,
  syncInboxItemsFromLead,
  listInboxItems,
  INBOX_EVENT_TYPES,
} from '../crm/cleverInboxService.js';

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

const MIXED_MSG = `Das Angebot gefällt mir.
Gibt es das Fahrzeug auch in Grau?
Außerdem bitte 15.000 statt 12.500 Kilometer
und ohne Anzahlung.`;

const POSITIVE_MSG = 'Das Angebot passt so, das würde ich nehmen.';
const QUESTION_MSG = 'Gibt es den Wagen auch in Grau?';

function emptyLead() {
  return {
    id: 'lead-ulmer-seller-activity',
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

function prepareSentLead() {
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
  return { lead, id1, id2, whiteItem, token: portfolioPrep.portfolio.token };
}

describe('Seller Activity Presenter / Portal Reaction V1', () => {
  before(() => {
    __resetInboxStoreForTests([]);
  });
  after(() => {
    __clearInboxTestMode();
  });

  it('Freitext-Signale: Frage vs Change vs Mixed', () => {
    const q = classifyPortalFreitextSignals(QUESTION_MSG);
    assert.equal(q.hasStructuredChange, false);
    assert.equal(q.hasColorQuestion, true);
    assert.ok(q.openQuestions.length >= 1);

    const changeOnly = classifyPortalFreitextSignals('Bitte mit 15.000 km und ohne Anzahlung.');
    assert.equal(changeOnly.hasStructuredChange, true);
    assert.equal(changeOnly.requestedMileage, 15000);
    assert.equal(changeOnly.requestedDownPayment, 0);

    const mixed = classifyPortalFreitextSignals(MIXED_MSG);
    assert.equal(mixed.hasStructuredChange, true);
    assert.equal(mixed.requestedMileage, 15000);
    assert.equal(mixed.requestedDownPayment, 0);
    assert.ok(mixed.openQuestions.length >= 1, 'Farbfrage bleibt offen');
    assert.ok(!isPriceRelevantOfferChange({ questionText: QUESTION_MSG }));
    assert.ok(isPriceRelevantOfferChange({ questionText: MIXED_MSG }));
  });

  it('Golden Mixed: Change + Farbfrage → Heute · Akte · Draft-strict · Rate stale', () => {
    let { lead, id1, whiteItem, token } = prepareSentLead();
    assert.ok(whiteItem);

    const applied = applyPortfolioEvent(
      lead,
      whiteItem.id,
      PORTFOLIO_EVENTS.OFFER_CHANGE_REQUEST,
      { token, questionText: MIXED_MSG },
    );
    assert.ok(applied.ok);
    lead = applied.lead;

    const reaction = lead.crm.customerOfferPortfolio.items
      .find((i) => i.id === whiteItem.id)?.customerReaction;
    assert.equal(reaction.status, PORTFOLIO_REACTION_STATUS.CHANGE_REQUESTED);
    assert.equal(reaction.requestedMileage, 15000);
    assert.equal(reaction.requestedDownPayment, 0);

    const change = findPortalChangeRequest(lead);
    assert.ok(change);
    assert.equal(change.offerDraftId, id1);

    const activity = buildPrimarySellerPortalReactionActivity(lead);
    assert.equal(activity.kind, SELLER_PORTAL_ACTIVITY_KIND.CHANGE_REQUEST);
    assert.match(activity.customerName, /Ulmer/i);
    assert.match(activity.wasLine || activity.headline, /ändern/i);
    assert.equal(activity.primaryCtaLabel, 'Angebot anpassen');
    assert.equal(activity.offerDraftId, id1);
    assert.ok(activity.diffLines.some((l) => /15\.?000|15000/i.test(l)));
    assert.ok(activity.diffLines.some((l) => /0\s*€|Anzahlung/i.test(l)));
    assert.ok(activity.openQuestionLines.length >= 1, 'Partial Success: offene Farbfrage');
    assert.ok(/[Gg]rau/.test(activity.openQuestionLines.join(' ')));

    const handoff = buildOfferChangeHandoffModel({ lead });
    assert.equal(handoff.offerDraftId, id1);
    assert.ok(handoff.offerChange.openQuestionLines?.length >= 1);
    assert.equal(
      handoff.actionSections[0].primaryActions.filter((a) => a.tone === 'primary').length,
      1,
    );
    assert.equal(handoff.actionSections[0].primaryActions[0].offerDraftId, id1);

    const nba = determineNextBestSellerAction({ lead });
    assert.equal(nba.handler, 'modify_offer');
    assert.equal(nba.contextPayload.offerDraftId, id1);

    const vo = listStoredVehicleOffers(lead).find((o) => resolveSourceOfferDraftId(o) === id1);
    assert.ok(vo);
    assert.equal(vo.rateAuthority, RATE_AUTHORITY.STALE);

    const today = getTodayOverview([lead], { maxItems: 10 });
    const todayItem = today.items.find((i) => i.leadId === lead.id);
    assert.ok(todayItem, 'Change Request in Heute');
    assert.equal(todayItem.portalActivityKind, 'change_request');
    assert.equal(todayItem.primaryCtaLabel, 'Angebot anpassen');
    assert.equal(todayItem.offerDraftId, id1);

    const dash = buildDashboardTodayRecommendations([lead], { maxItems: 5 });
    assert.ok(dash[0]);
    assert.equal(dash[0].leadId, lead.id);
    assert.match(dash[0].ctaLabel, /Angebot anpassen/i);

    syncInboxItemsFromLead(lead);
    const inbox = listInboxItems({ leadId: lead.id, status: 'open' });
    assert.ok(
      inbox.some((i) => i.type === INBOX_EVENT_TYPES.OFFER_CHANGE_REQUEST),
      'Clever Reaktionen: offer_change_request aus Lead',
    );
    const changeInbox = inbox.find((i) => i.type === INBOX_EVENT_TYPES.OFFER_CHANGE_REQUEST);
    assert.equal(changeInbox.metadata?.offerDraftId, id1);
  });

  it('Positive Golden: interested → Abschluss vorbereiten, kein Change', () => {
    let { lead, whiteItem, token } = prepareSentLead();
    const applied = applyPortfolioEvent(
      lead,
      whiteItem.id,
      PORTFOLIO_EVENTS.OFFER_INTERESTED,
      { token, questionText: POSITIVE_MSG },
    );
    assert.ok(applied.ok);
    lead = applied.lead;

    assert.equal(
      lead.crm.customerOfferPortfolio.items.find((i) => i.id === whiteItem.id)
        ?.customerReaction?.status,
      PORTFOLIO_REACTION_STATUS.INTERESTED,
    );
    assert.equal(findPortalChangeRequest(lead), null);

    const activity = buildPrimarySellerPortalReactionActivity(lead);
    assert.equal(activity.kind, SELLER_PORTAL_ACTIVITY_KIND.INTERESTED);
    assert.match(activity.wasLine || activity.headline, /übernehmen|angenommen/i);
    assert.equal(activity.primaryCtaLabel, 'Abschluss vorbereiten');
    assert.equal(activity.rateStaleExpected, false);

    const nba = determineNextBestSellerAction({ lead });
    assert.ok(nba);
    // Nach Zusage: Abschluss-Pfad (Antrag) oder fehlende Unterlagen – Activity bleibt Primary
    assert.ok(
      nba.handler === 'application_prepare'
      || nba.handler === 'request_documents'
      || nba.handler === 'self_disclosure_request',
      `post-commit NBA erwartet, got ${nba.handler}`,
    );

    const today = getTodayOverview([lead], { maxItems: 10 });
    const item = today.items.find((i) => i.leadId === lead.id);
    assert.equal(item.portalActivityKind, 'interested');
    assert.equal(item.primaryCtaLabel, 'Abschluss vorbereiten');
  });

  it('Question Golden: more_info → Antworten, Rate nicht stale', () => {
    let { lead, id1, whiteItem, token } = prepareSentLead();
    const beforeVo = listStoredVehicleOffers(lead)
      .find((o) => resolveSourceOfferDraftId(o) === id1);
    assert.equal(beforeVo.rateAuthority, RATE_AUTHORITY.AUTHORITATIVE);

    const applied = applyPortfolioEvent(
      lead,
      whiteItem.id,
      PORTFOLIO_EVENTS.OFFER_MORE_INFO,
      { token, questionText: QUESTION_MSG },
    );
    assert.ok(applied.ok);
    lead = applied.lead;

    assert.equal(
      lead.crm.customerOfferPortfolio.items.find((i) => i.id === whiteItem.id)
        ?.customerReaction?.status,
      PORTFOLIO_REACTION_STATUS.MORE_INFO,
    );
    assert.equal(findPortalChangeRequest(lead), null);
    assert.ok(findPortalCustomerQuestion(lead));

    const activity = buildPrimarySellerPortalReactionActivity(lead);
    assert.equal(activity.kind, SELLER_PORTAL_ACTIVITY_KIND.QUESTION);
    assert.equal(activity.primaryCtaLabel, 'Antworten');
    assert.equal(activity.rateStaleExpected, false);

    const nba = determineNextBestSellerAction({ lead });
    assert.ok(nba, `NBA erwartet, got ${nba}; q=${JSON.stringify(findPortalCustomerQuestion(lead)?.questionText)}`);
    assert.equal(nba.handler, 'draft_message');
    assert.equal(nba.label, 'Antworten');

    const afterVo = listStoredVehicleOffers(lead)
      .find((o) => resolveSourceOfferDraftId(o) === id1);
    assert.equal(afterVo.rateAuthority, RATE_AUTHORITY.AUTHORITATIVE);
    assert.ok(!afterVo.invalidateVehicleRate);

    const today = getTodayOverview([lead], { maxItems: 10 });
    const item = today.items.find((i) => i.leadId === lead.id);
    assert.equal(item.portalActivityKind, 'question');
    assert.equal(item.primaryCtaLabel, 'Antworten');
  });
});
