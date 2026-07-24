/**
 * Shared Workspace – Golden Flows
 * node src/services/crm/sharedWorkspaceService.test.js
 */
import assert from 'node:assert/strict';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import { MESSAGE_KIND } from './customerMessageService.js';
import {
  buildSharedWorkspaceTimeline,
  prepareSellerWorkspacePackage,
  sendSellerWorkspacePackage,
  appendOfferCardsToThread,
} from './sharedWorkspaceService.js';
import { initCleverUnterlagenForLead } from '../cleverUnterlagen.js';

const lead = {
  id: 'lead-workspace-1',
  name: 'Herr Notz',
  contact: { name: 'Herr Notz', email: 'notz@example.de' },
  paymentType: 'leasing',
  wish: { paymentType: 'leasing' },
  crm: {
    needProfile: createEmptyNeedProfile(),
    cleverUnterlagen: initCleverUnterlagenForLead({ paymentType: 'leasing' }, 'leasing'),
    customerMessages: [],
    customerMessageThreads: [],
    customerOfferPortfolio: {
      id: 'pf-1',
      items: [
        {
          id: 'u-ev3',
          modelLabel: 'Kia EV3 GT-Line',
          trimLabel: 'GT-Line',
          rateLine: '329 €/Monat',
          conditionsLine: '48 Monate · 15.000 km/Jahr',
        },
        {
          id: 'u-ev4',
          modelLabel: 'Kia EV4 GT-Line',
          rateLine: '349 €/Monat',
          conditionsLine: '48 Monate · 15.000 km/Jahr',
        },
      ],
    },
  },
};

const pkg = prepareSellerWorkspacePackage(
  lead,
  'Schreib Herrn Notz, dass noch Gehaltsnachweis, Bankverbindung und Selbstauskunft fehlen.',
);
assert.ok(pkg.actions.length >= 2, 'mindestens zwei Aktionen');
assert.ok(pkg.actions.some((a) => a.slotId === 'gehaltsnachweis'));
assert.ok(pkg.actions.some((a) => a.slotId === 'selbstauskunft' || a.kind === MESSAGE_KIND.SELF_DISCLOSURE_CARD));
assert.ok(/Gehaltsnachweis|Bankverbindung|Selbstauskunft/i.test(pkg.body));

const sent = sendSellerWorkspacePackage({
  lead,
  body: pkg.body,
  actions: pkg.actions,
  createdByName: 'Max Trinkle',
});
assert.ok(sent.ok, 'Workspace-Paket gesendet');
assert.ok(sent.messages.length >= 2, 'Text + Karten');
assert.equal(sent.messages[0].kind, MESSAGE_KIND.TEXT);
assert.ok(sent.messages.some((m) => m.kind === MESSAGE_KIND.DOCUMENT_REQUEST));
assert.ok(sent.messages.some((m) => m.kind === MESSAGE_KIND.SELF_DISCLOSURE_CARD));

const withOffers = appendOfferCardsToThread({
  lead: sent.lead,
  items: lead.crm.customerOfferPortfolio.items,
  introText: 'Ich habe Ihnen die beiden Angebote eingestellt.',
  createdByName: 'Max Trinkle',
});
assert.ok(withOffers.ok);
assert.ok(withOffers.messages.some((m) => m.kind === MESSAGE_KIND.OFFER_CARD));

const timelineCustomer = buildSharedWorkspaceTimeline(withOffers.lead, {
  role: 'customer',
  dealerName: 'Autohaus Trinkle',
  advisorName: 'Max Trinkle',
});
const timelineSeller = buildSharedWorkspaceTimeline(withOffers.lead, { role: 'seller' });
assert.ok(timelineCustomer.items.length >= 3);
assert.equal(timelineCustomer.items.length, timelineSeller.items.length, 'gleicher Verlauf');
assert.ok(timelineCustomer.header.title.includes('Trinkle'));
assert.ok(/Notz/i.test(timelineSeller.header.title));

console.log('sharedWorkspaceService.test.js: OK');
