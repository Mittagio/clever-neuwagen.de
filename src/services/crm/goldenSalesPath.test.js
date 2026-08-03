/**
 * Golden Path (Phase 2, schmal):
 * Angebot/Link → Öffnung → Reaktion → Inbox/Composer-Seed → Track weiß Bescheid
 *
 * node src/services/crm/goldenSalesPath.test.js
 */
import assert from 'node:assert/strict';
import {
  BRANDES_TRACK_IDS,
  cloneBrandesGoldenCaseLead,
} from './brandesGoldenCase.js';
import {
  applyPortfolioEvent,
  PORTFOLIO_EVENTS,
  PORTFOLIO_REACTION_STATUS,
  PORTFOLIO_STATUS,
} from './customerOfferPortfolioService.js';
import {
  __clearInboxTestMode,
  __resetInboxStoreForTests,
  INBOX_EVENT_TYPES,
} from './cleverInboxService.js';
import {
  buildInboxActionAkteUrl,
  resolveInboxReplyIntent,
} from './cleverInboxQuestionRoute.js';
import {
  buildComposerReplySeed,
  extractChangeWishText,
} from './composerReplySeed.js';
import {
  getVehicleTrackMeta,
  VEHICLE_TRACK_STATUS,
} from './vehicleTrack.js';
import { VEHICLE_OFFER_STATUS } from '../vehicleOffer.js';
import { buildPortalReactionSummary } from './customerPortalAccessService.js';

__resetInboxStoreForTests([]);

const portfolioItems = [
  {
    id: 'pu-xceed',
    sourceType: 'vehicle_card',
    vehicleCardId: BRANDES_TRACK_IDS.XCEED,
    modelKey: 'xceed',
    modelLabel: 'Kia XCeed',
    customerReaction: {
      status: PORTFOLIO_REACTION_STATUS.NONE,
      declineReason: null,
      declineNote: '',
      questionText: '',
      reactedAt: null,
    },
  },
  {
    id: 'pu-sportage',
    sourceType: 'vehicle_card',
    vehicleCardId: BRANDES_TRACK_IDS.SPORTAGE,
    modelKey: 'sportage',
    modelLabel: 'Kia Sportage',
    customerReaction: {
      status: PORTFOLIO_REACTION_STATUS.NONE,
      declineReason: null,
      declineNote: '',
      questionText: '',
      reactedAt: null,
    },
  },
];

function withPortfolio(lead) {
  return {
    ...lead,
    crm: {
      ...lead.crm,
      customerOfferPortfolio: {
        id: 'pf-golden-path',
        token: 'golden-path-token',
        status: PORTFOLIO_STATUS.SENT,
        items: portfolioItems,
        tracking: { openCount: 0, firstOpenedAt: null, lastOpenedAt: null },
        updatedAt: new Date().toISOString(),
      },
    },
  };
}

// 1) Link geöffnet → Portfolio OPENED + VehicleOffers OPENED + Inbox
{
  let lead = withPortfolio(cloneBrandesGoldenCaseLead({
    phase: 'sent',
    id: 'lead-golden-path-open',
  }));
  assert.equal(
    lead.crm.vehicleOffers[BRANDES_TRACK_IDS.XCEED].status,
    VEHICLE_OFFER_STATUS.OPENED,
    'Brandes-Seed: XCeed schon geöffnet im Demo',
  );
  // Für den OPENED-Pfad: alle Offers auf SENT zurücksetzen
  lead = {
    ...lead,
    crm: {
      ...lead.crm,
      vehicleOffers: Object.fromEntries(
        Object.entries(lead.crm.vehicleOffers).map(([id, vo]) => [
          id,
          { ...vo, status: VEHICLE_OFFER_STATUS.SENT, tracking: { openCount: 0, firstOpenedAt: null, lastOpenedAt: null } },
        ]),
      ),
    },
  };

  const opened = applyPortfolioEvent(lead, '', PORTFOLIO_EVENTS.OPENED, {
    token: 'golden-path-token',
  });
  assert.ok(opened.ok);
  assert.equal(opened.portfolio.status, PORTFOLIO_STATUS.OPENED);
  assert.equal(opened.inboxItem?.type, INBOX_EVENT_TYPES.OFFER_OPENED);
  assert.equal(
    opened.lead.crm.vehicleOffers[BRANDES_TRACK_IDS.XCEED].status,
    VEHICLE_OFFER_STATUS.OPENED,
  );
  assert.equal(
    opened.lead.crm.vehicleOffers[BRANDES_TRACK_IDS.SPORTAGE].status,
    VEHICLE_OFFER_STATUS.OPENED,
  );
  assert.ok(opened.lead.crm.vehicleOffers[BRANDES_TRACK_IDS.XCEED].tracking?.lastOpenedAt);

  assert.equal(resolveInboxReplyIntent(opened.inboxItem), 'offer_opened_followup');
  const openUrl = buildInboxActionAkteUrl(opened.lead.id, opened.inboxItem);
  assert.match(openUrl, /intentId=offer_opened_followup/);
  assert.match(openUrl, /composer=1/);

  const openSeed = buildComposerReplySeed('offer_opened_followup', {
    vehicleLabel: opened.inboxItem.vehicleLabel,
  });
  assert.match(openSeed, /angeschaut/);
}

// 2) Änderungswunsch XCeed → Inbox + Track + Composer-Seed „Passe … an“
{
  let lead = withPortfolio(cloneBrandesGoldenCaseLead({
    phase: 'sent',
    id: 'lead-golden-path-change',
  }));
  const opened = applyPortfolioEvent(lead, '', PORTFOLIO_EVENTS.OPENED, {
    token: 'golden-path-token',
  });
  lead = opened.lead;

  const change = applyPortfolioEvent(
    lead,
    'pu-xceed',
    PORTFOLIO_EVENTS.OFFER_CHANGE_REQUEST,
    { token: 'golden-path-token', questionText: 'Lieber 36 Monate und AHK.' },
  );
  assert.ok(change.ok);
  assert.equal(change.portfolio.status, PORTFOLIO_STATUS.REACTED);
  assert.equal(
    change.portfolio.items.find((i) => i.id === 'pu-xceed')?.customerReaction?.status,
    PORTFOLIO_REACTION_STATUS.CHANGE_REQUESTED,
  );
  assert.equal(change.inboxItem?.type, INBOX_EVENT_TYPES.OFFER_CHANGE_REQUEST);
  assert.equal(change.inboxItem?.metadata?.questionText, 'Lieber 36 Monate und AHK.');
  assert.equal(resolveInboxReplyIntent(change.inboxItem), 'offer_change_request');

  const xceedMeta = getVehicleTrackMeta(
    change.lead.crm.vehicleConfigurations.find((c) => c.id === BRANDES_TRACK_IDS.XCEED),
  );
  assert.equal(xceedMeta.lastCustomerReaction, PORTFOLIO_REACTION_STATUS.CHANGE_REQUESTED);
  assert.equal(xceedMeta.status, VEHICLE_TRACK_STATUS.ACTIVE);
  assert.ok(
    (xceedMeta.customerRequirements ?? []).some((r) => /36 Monate/i.test(String(r))),
  );
  assert.equal(buildPortalReactionSummary(change.lead), 'Änderung gewünscht');

  const changeUrl = buildInboxActionAkteUrl(change.lead.id, change.inboxItem);
  assert.match(changeUrl, /intentId=offer_change_request/);
  assert.match(changeUrl, /composer=1/);

  const seed = buildComposerReplySeed('offer_change_request', {
    question: change.inboxItem.metadata.questionText,
    vehicleLabel: change.inboxItem.vehicleLabel,
  });
  assert.match(seed, /Passe das XCeed-Angebot an/);
  assert.match(seed, /36 Monate/);
  assert.equal(
    extractChangeWishText('Kunde wünscht Änderung (Kia XCeed): „Lieber 36 Monate.“'),
    'Lieber 36 Monate.',
  );
}

// 3) Interesse → Favorit (bestehender Pfad bleibt spürbar für Nachfassen)
{
  let lead = withPortfolio(cloneBrandesGoldenCaseLead({
    phase: 'sent',
    id: 'lead-golden-path-interest',
  }));
  const interested = applyPortfolioEvent(
    lead,
    'pu-xceed',
    PORTFOLIO_EVENTS.OFFER_INTERESTED,
    { token: 'golden-path-token' },
  );
  assert.ok(interested.ok);
  assert.equal(interested.inboxItem?.type, INBOX_EVENT_TYPES.OFFER_INTERESTED);
  assert.equal(resolveInboxReplyIntent(interested.inboxItem), 'offer_interested_followup');
  assert.equal(
    getVehicleTrackMeta(
      interested.lead.crm.vehicleConfigurations.find((c) => c.id === BRANDES_TRACK_IDS.XCEED),
    ).status,
    VEHICLE_TRACK_STATUS.FAVORITE,
  );
  const interestSeed = buildComposerReplySeed('offer_interested_followup', {
    vehicleLabel: 'Kia XCeed',
  });
  assert.match(interestSeed, /XCeed-Angebot interessant/);
}

__clearInboxTestMode();
console.log('goldenSalesPath.test.js: ok');
