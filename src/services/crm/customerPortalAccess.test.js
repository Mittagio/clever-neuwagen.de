/**
 * Kundenportal-Zugang – Link senden, Code, Status
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  PORTAL_ACCESS_STATUS,
  appendPortalAccessHistory,
  buildCustomerPortalAccessContext,
  buildCustomerPortalStatusCardModel,
  buildDealerPortalAccessSummary,
  getCustomerPortalAccess,
  markCustomerPortalAccessSent,
  prepareCustomerPortalAccess,
  recordCustomerPortalAccessOpened,
  recordCustomerPortalAccessViewed,
  verifyCustomerPortalAccessCode,
} from './customerPortalAccessService.js';
import {
  buildPortfolioCustomerContext,
  prepareCustomerOfferPortfolio,
} from './customerOfferPortfolioService.js';
import { createOfferSelectionGroup } from '../sales/offerSelectionGroup.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const lead = {
  id: 'lead-access-1',
  contact: { name: 'Anna Schmidt', email: 'anna@example.de' },
  crm: { offerSelectionGroups: [], reservedModels: [] },
  history: [],
};

// A) E-Mail fehlt → prepare schlägt fehl
const noEmail = prepareCustomerPortalAccess(lead, {
  portfolioUrl: 'http://localhost/angebot/auswahl/anna?leadId=lead-access-1',
  email: '',
});
assert.equal(noEmail.ok, false);
assert.equal(noEmail.error, 'email_required');

const ev3Group = createOfferSelectionGroup({
  modelKey: 'ev3',
  modelLabel: 'Kia EV3',
  wishConditions: { paymentType: 'cash' },
});

const prepared = prepareCustomerOfferPortfolio({
  lead: { ...lead, crm: { ...lead.crm, offerSelectionGroups: [ev3Group] } },
  offerSelectionGroups: [ev3Group],
  vehicleCards: [],
  origin: 'http://localhost:5173',
});
assert.ok(prepared.ok);

// B) Kundenlink wird erzeugt und gespeichert
const portalPrepared = prepareCustomerPortalAccess(lead, {
  portfolioUrl: prepared.portfolio.url,
  email: 'anna@example.de',
  accessToken: prepared.portfolio.token,
});
assert.ok(portalPrepared.ok);
assert.equal(getCustomerPortalAccess(portalPrepared.lead)?.portfolioUrl, prepared.portfolio.url);
assert.equal(getCustomerPortalAccess(portalPrepared.lead)?.email, 'anna@example.de');
assert.ok(getCustomerPortalAccess(portalPrepared.lead)?.accessCode);

// C) Status prepared / sent
assert.equal(portalPrepared.access.status, PORTAL_ACCESS_STATUS.PREPARED);
const sent = markCustomerPortalAccessSent(portalPrepared.lead, { via: 'copy' });
assert.equal(getCustomerPortalAccess(sent.lead)?.status, PORTAL_ACCESS_STATUS.SENT);
assert.ok(getCustomerPortalAccess(sent.lead)?.sentAt);

// D) Link öffnen
const opened = recordCustomerPortalAccessOpened(sent.lead);
assert.equal(getCustomerPortalAccess(opened.lead)?.status, PORTAL_ACCESS_STATUS.OPENED);
assert.ok(getCustomerPortalAccess(opened.lead)?.openedAt);
const openedAgain = recordCustomerPortalAccessOpened(opened.lead);
assert.equal(openedAgain.changed, false);

// E) Code verifiziert
const code = getCustomerPortalAccess(opened.lead).accessCode;
const badVerify = verifyCustomerPortalAccessCode(opened.lead, '000000');
assert.equal(badVerify.ok, false);
const verified = verifyCustomerPortalAccessCode(opened.lead, code);
assert.ok(verified.ok);
assert.equal(getCustomerPortalAccess(verified.lead)?.status, PORTAL_ACCESS_STATUS.CODE_VERIFIED);
assert.ok(getCustomerPortalAccess(verified.lead)?.verifiedAt);

// F) Portfolio angesehen
const viewed = recordCustomerPortalAccessViewed(verified.lead);
assert.equal(getCustomerPortalAccess(viewed.lead)?.status, PORTAL_ACCESS_STATUS.VIEWED);
assert.ok(getCustomerPortalAccess(viewed.lead)?.viewedAt);
const viewedAgain = recordCustomerPortalAccessViewed(viewed.lead);
assert.equal(viewedAgain.changed, false);

// G) History nicht dupliziert
let fresh = portalPrepared.lead;
const firstHist = appendPortalAccessHistory(fresh, 'sent', 'Kundenlink gesendet');
fresh = firstHist.lead;
const secondHist = appendPortalAccessHistory(fresh, 'sent', 'Kundenlink gesendet');
assert.equal(firstHist.added, true);
assert.equal(secondHist.added, false);

// H) Nach Code direkt Fahrzeugauswahl-Kontext
const unverifiedLead = {
  ...portalPrepared.lead,
  crm: {
    ...portalPrepared.lead.crm,
    customerOfferPortfolio: prepared.portfolio,
    customerPortalAccess: {
      ...getCustomerPortalAccess(portalPrepared.lead),
      verifiedAt: null,
      status: PORTAL_ACCESS_STATUS.SENT,
    },
  },
};
const gated = buildPortfolioCustomerContext(unverifiedLead, { accessVerified: false });
assert.equal(gated.requiresCode, true);
assert.equal(gated.items, undefined);
const full = buildPortfolioCustomerContext({
  ...unverifiedLead,
  crm: {
    ...unverifiedLead.crm,
    customerPortalAccess: {
      ...unverifiedLead.crm.customerPortalAccess,
      verifiedAt: new Date().toISOString(),
    },
  },
}, { accessVerified: true });
assert.ok(full.items?.length);
assert.equal(full.pageTitle, 'Ihre Fahrzeugauswahl');

const leadWithPortfolio = {
  ...viewed.lead,
  crm: {
    ...viewed.lead.crm,
    customerOfferPortfolio: prepared.portfolio,
  },
};
const summary = buildDealerPortalAccessSummary(leadWithPortfolio);
assert.equal(summary.statusLabel, 'Angesehen');

// I) Kein Checkout-/Kaufen-Wording in Portfolio-UI
const portfolioPage = readFileSync(
  join(__dirname, '../../pages/CustomerOfferPortfolioPage.jsx'),
  'utf8',
);
const shareSheet = readFileSync(
  join(__dirname, '../../components/dealer-ai/CustomerAktePortfolioShareSheet.jsx'),
  'utf8',
);
assert.doesNotMatch(portfolioPage, /verbindlich bestellen/i);
assert.doesNotMatch(portfolioPage, /\bJetzt kaufen\b/i);
assert.doesNotMatch(shareSheet, /\bJetzt kaufen\b/i);
assert.match(portfolioPage, /Ihre Fahrzeugauswahl/);
assert.match(shareSheet, /Zugang mit einem Code/i);

// Statuskarte – A–H
const emptyCard = buildCustomerPortalStatusCardModel({ id: 'x', crm: {} });
assert.equal(emptyCard.visible, false);

function cardForStatus(status, extra = {}) {
  return buildCustomerPortalStatusCardModel({
    id: 'lead-card',
    crm: {
      customerPortalAccess: {
        portfolioUrl: prepared.portfolio.url,
        email: 'anna@example.de',
        status,
        lastActivityAt: '2026-07-02T13:42:00.000Z',
        ...extra,
      },
    },
  });
}

assert.equal(cardForStatus(PORTAL_ACCESS_STATUS.PREPARED).subline, 'Kundenlink vorbereitet');
assert.equal(cardForStatus(PORTAL_ACCESS_STATUS.SENT).subline, 'Kundenlink gesendet');
assert.equal(cardForStatus(PORTAL_ACCESS_STATUS.OPENED).subline, 'Kunde hat den Link geöffnet');
assert.equal(cardForStatus(PORTAL_ACCESS_STATUS.CODE_VERIFIED).subline, 'Zugang bestätigt');
assert.equal(cardForStatus(PORTAL_ACCESS_STATUS.VIEWED).subline, 'Fahrzeugauswahl angesehen');

const viewedCard = cardForStatus(PORTAL_ACCESS_STATUS.VIEWED);
assert.ok(viewedCard.actions.some((action) => action.id === 'message'));
assert.ok(viewedCard.actions.some((action) => action.id === 'followup'));

const sentCard = cardForStatus(PORTAL_ACCESS_STATUS.SENT);
assert.equal(sentCard.portfolioUrl, prepared.portfolio.url);
assert.ok(sentCard.actions.some((action) => action.id === 'copy'));
assert.ok(sentCard.actions.some((action) => action.id === 'email'));

const historyBefore = viewed.lead.history?.length ?? 0;
buildCustomerPortalStatusCardModel(viewed.lead);
assert.equal(viewed.lead.history?.length ?? 0, historyBefore);

console.log('customerPortalAccess.test.js: ok');
