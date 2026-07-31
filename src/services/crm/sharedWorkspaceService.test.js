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
  buildOfferReadyIntroText,
  buildOfferUpdatedStatusText,
  postCleverAssistFeedCard,
  postOfferUpdatedStatus,
} from './sharedWorkspaceService.js';
import { initCleverUnterlagenForLead } from '../cleverUnterlagen.js';

assert.equal(
  buildOfferReadyIntroText({ firstName: 'Eduard', itemCount: 1 }),
  'Hallo Eduard,\n\nAngebot ist da! Schau nach.',
);
assert.equal(
  buildOfferReadyIntroText({ itemCount: 2 }),
  'Angebote sind da! Schau nach.',
);

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
  firstName: 'Herr',
  createdByName: 'Max Trinkle',
});
assert.ok(withOffers.ok);
assert.ok(withOffers.messages.some((m) => m.kind === MESSAGE_KIND.TEXT && /Angebot(?:e)? sind? da!/i.test(m.text)));
assert.ok(withOffers.messages.some((m) => m.kind === MESSAGE_KIND.OFFER_CARD));
assert.ok(withOffers.messages.every((m) => (
  m.kind !== MESSAGE_KIND.OFFER_CARD || m.payload?.ctaLabel === 'Schau nach'
)));

const deduped = appendOfferCardsToThread({
  lead: withOffers.lead,
  items: lead.crm.customerOfferPortfolio.items,
  firstName: 'Herr',
});
assert.equal(deduped.skipped, true);
assert.equal(deduped.updated, true);
assert.ok(deduped.messages.length >= 1, 'kompakte Update-Zeilen statt erneuter OFFER_CARD');
assert.ok(deduped.messages.every((m) => m.kind === MESSAGE_KIND.SYSTEM_STATUS));
assert.ok(deduped.messages.some((m) => /Angebot aktualisiert/i.test(m.text)));
assert.ok(deduped.messages.every((m) => m.kind !== MESSAGE_KIND.OFFER_CARD));

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

const withInternal = postCleverAssistFeedCard({
  lead: withOffers.lead,
  title: '✨ Clever hat verstanden',
  text: 'EV3 · Leasing · Rabatt fehlt noch',
  ctaLabel: 'Angebot vervollständigen',
  ctaAction: 'complete_offer',
  visibleToCustomer: false,
});
assert.ok(withInternal.message);
assert.equal(withInternal.message.kind, MESSAGE_KIND.CLEVER_MESSAGE);
assert.equal(withInternal.message.visibleToCustomer, false);
assert.equal(withInternal.message.payload.ctaAction, 'complete_offer');

const sellerFeed = buildSharedWorkspaceTimeline(withInternal.lead, { role: 'seller' });
const customerFeed = buildSharedWorkspaceTimeline(withInternal.lead, { role: 'customer' });
assert.ok(
  sellerFeed.items.some((item) => item.kind === MESSAGE_KIND.CLEVER_MESSAGE && /Rabatt fehlt/i.test(item.text)),
  'Seller-Verlauf zeigt interne Clever-Assist-Karten',
);
assert.ok(
  !customerFeed.items.some((item) => item.kind === MESSAGE_KIND.CLEVER_MESSAGE && /Rabatt fehlt/i.test(item.text)),
  'Kunde sieht interne Clever-Karte nicht',
);
assert.equal(
  sellerFeed.items.length,
  customerFeed.items.length + 1,
  'Seller sieht interne Clever-Karte zusätzlich im Verlauf',
);

assert.equal(
  buildOfferUpdatedStatusText({
    title: 'EV4 GT-Line',
    conditionsLine: '48 Monate · 20.000 km',
    rateLine: '349 €/Monat',
  }),
  'Angebot aktualisiert · EV4 GT-Line · 48 Monate · 20.000 km · 349 €/Monat',
);

const compact = postOfferUpdatedStatus({
  lead: withOffers.lead,
  offerId: 'u-ev4',
  title: 'EV4 GT-Line',
  conditionsLine: '48 Monate · 20.000 km',
  rateLine: '349 €/Monat',
});
assert.ok(compact.message);
assert.equal(compact.message.kind, MESSAGE_KIND.SYSTEM_STATUS);
assert.match(compact.message.text, /Angebot aktualisiert/);
assert.equal(compact.message.payload.offerId, 'u-ev4');
assert.equal(compact.message.payload.ctaLabel, 'Öffnen');

console.log('sharedWorkspaceService.test.js: OK');
