/**
 * Clever Eingang – Service & Integration
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  __clearInboxTestMode,
  __resetInboxStoreForTests,
  buildInboxDashboardSummary,
  buildInboxItemFromDocumentEvent,
  buildInboxItemFromOfferInteraction,
  createInboxItem,
  INBOX_EVENT_TYPES,
  INBOX_STATUS,
  listInboxItems,
  listInboxItemsForCustomer,
  markInboxItemDone,
  shouldCreateInboxFromHistory,
  syncInboxItemsFromLead,
} from './cleverInboxService.js';
import { addCustomerQuestion, createEmptyInteraction } from '../customerOfferInteraction.js';
import { buildCleverActionRecommendation } from './cleverActionEngine.js';
import { VEHICLE_OFFER_STATUS } from '../vehicleOffer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function reset() {
  __resetInboxStoreForTests([]);
}

const lead = {
  id: 'lead-schwan',
  contact: { name: 'Peter Schwan' },
  vehicle: { model: 'Kia EV4' },
  crm: {
    customerOfferInteractions: {},
    vehicleOffers: {},
  },
};

// 1. Kundenfrage erstellt InboxItem
reset();
const interaction = addCustomerQuestion(
  createEmptyInteraction('vc-ev4', lead.id),
  'Kann ich beim EV4 Windabweiser montieren?',
);
const questionItem = buildInboxItemFromOfferInteraction({
  lead: {
    ...lead,
    crm: {
      ...lead.crm,
      customerOfferInteractions: { 'vc-ev4': interaction },
    },
  },
  cardId: 'vc-ev4',
  interaction,
  vehicleLabel: 'Kia EV4',
});
assert.ok(questionItem, 'Kundenfrage erzeugt InboxItem');
assert.equal(questionItem.type, INBOX_EVENT_TYPES.CUSTOMER_QUESTION);

// 2. Angebot geöffnet erstellt InboxItem
reset();
const openedItem = buildInboxItemFromOfferInteraction({
  lead,
  cardId: 'vc-sportage',
  vehicleOffer: { status: VEHICLE_OFFER_STATUS.OPENED, tracking: { lastOpenedAt: '2026-06-17T10:42:00.000Z' } },
  vehicleLabel: 'Sportage Vision',
  eventType: INBOX_EVENT_TYPES.OFFER_OPENED,
});
assert.equal(openedItem.type, INBOX_EVENT_TYPES.OFFER_OPENED);
assert.match(openedItem.message, /Sportage Vision/);

// 3. Interesse markiert erstellt InboxItem
reset();
const interestedItem = buildInboxItemFromOfferInteraction({
  lead,
  cardId: 'vc-ev4',
  vehicleOffer: { status: VEHICLE_OFFER_STATUS.ACCEPTED },
  vehicleLabel: 'Kia EV4 Air',
  eventType: INBOX_EVENT_TYPES.OFFER_INTERESTED,
});
assert.equal(interestedItem.type, INBOX_EVENT_TYPES.OFFER_INTERESTED);

// 4. Unterlage hochgeladen erstellt InboxItem
reset();
const docItem = buildInboxItemFromDocumentEvent({
  lead: { id: 'lead-faas', contact: { name: 'Faas Stefanie' } },
  documentLabel: 'Ausweis',
});
assert.equal(docItem.type, INBOX_EVENT_TYPES.DOCUMENT_UPLOADED);
assert.match(docItem.message, /Ausweis/);

// 5. Dashboard zeigt Anzahl offener InboxItems
reset();
createInboxItem({ type: INBOX_EVENT_TYPES.OFFER_OPENED, title: 'A', message: 'B', leadId: 'l1', customerId: 'l1', status: INBOX_STATUS.OPEN });
createInboxItem({ type: INBOX_EVENT_TYPES.CUSTOMER_QUESTION, title: 'Frage', message: 'Q', leadId: 'l2', customerId: 'l2', status: INBOX_STATUS.OPEN });
const dashboard = buildInboxDashboardSummary();
assert.equal(dashboard.openCount, 2);
assert.equal(dashboard.questionCount, 1);

// 6. Kundenakte zeigt Badge bei offenen Meldungen
const followUpSource = readFileSync(
  join(__dirname, '../../components/dealer-ai/DealerAiLeadFollowUp.jsx'),
  'utf8',
);
assert.ok(followUpSource.includes('inboxOpenCount'), 'Kundenakte kennt inboxOpenCount');
assert.ok(followUpSource.includes('inboxOpenCount={inboxOpenCount}'), 'Badge nutzt Inbox-Zähler');

// 7. Item kann als erledigt markiert werden
reset();
const item = createInboxItem({
  type: INBOX_EVENT_TYPES.CUSTOMER_QUESTION,
  title: 'Frage',
  message: 'Test',
  leadId: lead.id,
  customerId: lead.id,
});
markInboxItemDone(item.id);
assert.equal(listInboxItems({ status: 'open' }).length, 0);
assert.equal(listInboxItems({ status: 'done' }).length, 1);

// 8. Systemlogs erzeugen keine InboxItems
assert.equal(shouldCreateInboxFromHistory({ type: 'clever_action', text: 'Clever empfahl: Angebot senden' }), false);
assert.equal(shouldCreateInboxFromHistory({ type: 'note', text: 'Clever Kundenhelfer aktualisiert' }), false);
assert.equal(shouldCreateInboxFromHistory({ type: 'customer_activity', text: 'Kunde hat Frage gestellt' }), true);

// 9. Action Engine priorisiert offene Kundenfrage
reset();
createInboxItem({
  type: INBOX_EVENT_TYPES.CUSTOMER_QUESTION,
  title: 'Kundenfrage offen',
  message: '„Windabweiser?“',
  leadId: lead.id,
  customerId: lead.id,
  offerId: 'vc-ev4',
  metadata: { dedupeKey: 'question-test' },
});
const recommendation = buildCleverActionRecommendation({
  lead,
  vehicleCards: [{ id: 'vc-ev4', modelName: 'Kia EV4' }],
  customerName: 'Peter Schwan',
});
assert.equal(recommendation?.actionId, 'offer_question_answer');

// 10. Kundenakte filtert nur Meldungen des Kunden
reset();
createInboxItem({ type: INBOX_EVENT_TYPES.OFFER_OPENED, title: 'A', message: 'B', leadId: 'lead-a', customerId: 'lead-a', status: INBOX_STATUS.OPEN });
createInboxItem({ type: INBOX_EVENT_TYPES.OFFER_OPENED, title: 'C', message: 'D', leadId: 'lead-b', customerId: 'lead-b', status: INBOX_STATUS.OPEN });
assert.equal(listInboxItemsForCustomer('lead-a').length, 1);
assert.equal(listInboxItemsForCustomer('lead-a')[0].leadId, 'lead-a');

// Sync aus Lead
reset();
const syncedLead = {
  ...lead,
  crm: {
    customerOfferInteractions: {
      'vc-ev4': interaction,
    },
    vehicleOffers: {
      'vc-ev4': { status: VEHICLE_OFFER_STATUS.SENT },
    },
  },
};
const synced = syncInboxItemsFromLead(syncedLead);
assert.ok(synced.length >= 1, 'syncInboxItemsFromLead erzeugt Meldungen');

const homeToday = readFileSync(
  join(__dirname, '../../components/backend/BackendHomeToday.jsx'),
  'utf8',
);
const inboxTileSource = readFileSync(
  join(__dirname, '../../components/backend/BackendCleverInboxTile.jsx'),
  'utf8',
);
assert.ok(inboxTileSource.includes('Clever Eingang'), 'Dashboard-Kachel Clever Eingang');
assert.ok(homeToday.includes('BackendCleverInboxTile'), 'Heute-Bereich bindet Clever Eingang ein');

__clearInboxTestMode();
console.log('cleverInboxService.test.js: ok');
