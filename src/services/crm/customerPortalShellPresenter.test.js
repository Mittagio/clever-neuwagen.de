/**
 * Kundenportal Shell Presenter – Tests
 */
import assert from 'node:assert/strict';
import {
  buildCustomerPortalDocumentsModel,
  buildCustomerPortalShellModel,
  PORTAL_NAV_IDS,
  PORTAL_NAV_SECTIONS,
} from './customerPortalShellPresenter.js';
import { buildCustomerPortalAdvisorModel } from './customerPortalAdvisorService.js';
import {
  buildPortfolioCustomerContext,
  prepareCustomerOfferPortfolio,
} from './customerOfferPortfolioService.js';
import { createOfferSelectionGroup } from '../sales/offerSelectionGroup.js';
import { MESSAGE_CHANNEL, MESSAGE_DIRECTION, MESSAGE_STATUS } from './customerMessageService.js';

const ev3Group = createOfferSelectionGroup({
  modelKey: 'ev3',
  modelLabel: 'Kia EV3',
  wishConditions: { paymentType: 'leasing' },
});

const baseLead = {
  id: 'lead-shell-1',
  contact: { name: 'Anna Kunde', email: 'anna@example.de' },
  paymentType: 'leasing',
  dealerId: 'autohaus-trinkle',
  ownerName: 'Max Verkäufer',
  ownerId: 'mike-quach',
  crm: { offerSelectionGroups: [ev3Group], reservedModels: [] },
  history: [],
};

assert.equal(PORTAL_NAV_SECTIONS.length, 4);
assert.equal(PORTAL_NAV_SECTIONS[0].id, PORTAL_NAV_IDS.OFFERS);

const advisor = buildCustomerPortalAdvisorModel(baseLead);
assert.equal(advisor.title, 'Ihr Ansprechpartner');
assert.equal(advisor.name, 'Max Verkäufer');
assert.equal(advisor.phone, '+49 170 5550199');
assert.ok(advisor.visible);

const withUpload = {
  ...baseLead,
  crm: {
    ...baseLead.crm,
    cleverUnterlagen: {
      items: {
        ausweis: { status: 'open' },
        selbstauskunft: { status: 'uploaded' },
        gehaltsnachweis: { status: 'open' },
        bankverbindung: { status: 'open' },
      },
      uploadLink: {
        url: 'http://localhost:5173/mein-bereich/unterlagen/req-1?token=abc',
        requestId: 'req-1',
        token: 'abc',
      },
    },
  },
};

const documents = buildCustomerPortalDocumentsModel(withUpload);
assert.ok(documents.totalCount > 0);
assert.ok(documents.hasUploadLink);
assert.ok(documents.uploadUrl?.includes('/mein-bereich/unterlagen/'));
assert.ok(documents.slots.some((slot) => slot.label === 'Ausweis'));
assert.ok(documents.documentsArea);
assert.equal(documents.documentsArea.headline, 'Ihre Unterlagen');
assert.ok(documents.documentsArea.evidence.groups.open.length > 0);

const shell = buildCustomerPortalShellModel(withUpload, { messageCount: 2 });
assert.equal(shell.defaultSection, PORTAL_NAV_IDS.OFFERS);
assert.equal(shell.badges.messageCount, 2);
assert.ok(shell.documents.totalCount > 0);
assert.ok(shell.advisor.visible);

const prepared = prepareCustomerOfferPortfolio({
  lead: withUpload,
  offerSelectionGroups: [ev3Group],
  vehicleCards: [],
  origin: 'http://localhost:5173',
});
assert.ok(prepared.ok);

const leadWithPortfolio = {
  ...withUpload,
  crm: {
    ...withUpload.crm,
    customerOfferPortfolio: prepared.portfolio,
    customerMessages: [{
      id: 'msg-1',
      threadId: 'thread-1',
      direction: MESSAGE_DIRECTION.INBOUND,
      channel: MESSAGE_CHANNEL.CLEVER,
      status: MESSAGE_STATUS.RECEIVED,
      text: 'Frage zur Auswahl',
      visibleToCustomer: true,
      createdAt: new Date().toISOString(),
    }],
    customerMessageThreads: [{
      id: 'thread-1',
      title: 'Allgemeine Fragen',
      relatedOfferIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }],
  },
};

const context = buildPortfolioCustomerContext(leadWithPortfolio, { accessVerified: true });
assert.ok(context.shell);
assert.equal(context.shell.defaultSection, PORTAL_NAV_IDS.OFFERS);
assert.equal(context.shell.badges.messageCount, 1);
assert.ok(context.shell.documents.slots.length > 0);

console.log('customerPortalShellPresenter.test.js: ok');
