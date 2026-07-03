/**
 * Clever Eingang – Arbeitskarten-Modell Tests (A–H)
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  __clearInboxTestMode,
  __resetInboxStoreForTests,
  buildInboxDemoItems,
  createInboxItem,
  INBOX_EVENT_TYPES,
  INBOX_STATUS,
  listInboxItems,
} from './cleverInboxService.js';
import {
  buildInboxHeroSummary,
  buildInboxWorkCardView,
  buildInboxWorkCards,
  computeInboxWarmth,
  containsTechnicalEventName,
  INBOX_WARMTH,
  resolveInboxNextStep,
} from './inboxWorkCardModel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function reset() {
  __resetInboxStoreForTests([]);
}

// A) Inbox Summary zeigt offene Kunden / Fragen / warme Angebote
reset();
createInboxItem({
  type: INBOX_EVENT_TYPES.OFFER_QUESTION,
  title: 'Frage',
  message: '„Winterreifen?“',
  leadId: 'l-ev6',
  customerId: 'l-ev6',
  customerName: 'E2E Kunde',
  offerId: 'vc-ev6',
  vehicleLabel: 'EV6',
  status: INBOX_STATUS.OPEN,
  metadata: { monthlyRate: 386 },
});
createInboxItem({
  type: INBOX_EVENT_TYPES.OFFER_INTERESTED,
  title: 'Interesse',
  message: 'Interesse',
  leadId: 'l-ev6',
  customerId: 'l-ev6',
  customerName: 'E2E Kunde',
  offerId: 'vc-ev6',
  vehicleLabel: 'EV6',
  status: INBOX_STATUS.OPEN,
});
createInboxItem({
  type: INBOX_EVENT_TYPES.OFFER_OPENED,
  title: 'Geöffnet',
  message: 'Geöffnet',
  leadId: 'l-xceed',
  customerId: 'l-xceed',
  customerName: 'XCeed Kunde',
  offerId: 'vc-xceed',
  vehicleLabel: 'XCeed',
  status: INBOX_STATUS.OPEN,
});
const openItems = listInboxItems({ status: 'open' });
const hero = buildInboxHeroSummary(openItems, {
  questionCount: 1,
  documentCount: 0,
});
assert.equal(hero.openCustomerCount, 2, 'A: offene Kunden');
assert.match(hero.heroLine, /dringende Frage/, 'A: dringende Frage');
assert.ok(hero.warmOfferCount >= 1, 'A: warme Angebote');

// B) Frage offen wird höher priorisiert als Angebot geöffnet
reset();
createInboxItem({
  type: INBOX_EVENT_TYPES.OFFER_OPENED,
  title: 'O',
  message: 'B',
  leadId: 'l1',
  customerId: 'l1',
  status: INBOX_STATUS.OPEN,
  createdAt: '2026-06-18T12:00:00.000Z',
});
createInboxItem({
  type: INBOX_EVENT_TYPES.CUSTOMER_QUESTION,
  title: 'F',
  message: 'Q',
  leadId: 'l2',
  customerId: 'l2',
  status: INBOX_STATUS.OPEN,
  createdAt: '2026-06-18T10:00:00.000Z',
});
const workCardsB = buildInboxWorkCards(listInboxItems({ status: 'open' }));
assert.equal(workCardsB[0].primaryItem.type, INBOX_EVENT_TYPES.CUSTOMER_QUESTION, 'B: Frage zuerst');

// C) Interesse markiert wird als warm angezeigt
const interestedOnly = [
  createInboxItem({
    type: INBOX_EVENT_TYPES.OFFER_INTERESTED,
    title: 'Interesse',
    message: 'Interesse',
    leadId: 'l-int',
    customerId: 'l-int',
    offerId: 'vc-1',
    status: INBOX_STATUS.OPEN,
  }),
];
const warmC = computeInboxWarmth(interestedOnly);
assert.equal(warmC, INBOX_WARMTH.WARM, 'C: Interesse = Warm');

// D) Frage + Interesse wird als dringend/heiß angezeigt
const questionAndInterest = [
  {
    type: INBOX_EVENT_TYPES.OFFER_QUESTION,
    priority: 'high',
    metadata: {},
  },
  {
    type: INBOX_EVENT_TYPES.OFFER_INTERESTED,
    metadata: {},
  },
];
const warmD = computeInboxWarmth(questionAndInterest);
assert.ok(
  warmD === INBOX_WARMTH.URGENT || warmD === INBOX_WARMTH.HOT,
  'D: Frage + Interesse = Dringend oder Heiß',
);

// E) Selbstauskunft eingereicht zeigt Aktion Prüfen
const selfDisclosure = {
  type: INBOX_EVENT_TYPES.SELF_DISCLOSURE_SUBMITTED,
  actionLabel: 'Prüfen',
  actionTarget: 'self_disclosure_review',
};
const nextE = resolveInboxNextStep(selfDisclosure);
assert.equal(nextE.stepLabel, 'Selbstauskunft prüfen', 'E: nächster Schritt');
assert.equal(nextE.actionLabel, 'Prüfen', 'E: Aktion Prüfen');

// F) Angebot geöffnet zeigt Aktion Nachfassen
const opened = { type: INBOX_EVENT_TYPES.OFFER_OPENED };
const nextF = resolveInboxNextStep(opened);
assert.equal(nextF.stepLabel, 'Nachfassen vorbereiten', 'F: nächster Schritt');
assert.equal(nextF.actionLabel, 'Nachfassen', 'F: Aktion Nachfassen');

// G) Leerer Zustand zeigt „Alles erledigt“
const inboxPageSource = readFileSync(
  join(__dirname, '../../pages/backend/CleverInboxPage.jsx'),
  'utf8',
);
assert.ok(inboxPageSource.includes('Alles erledigt'), 'G: Empty State Titel');
assert.ok(inboxPageSource.includes('Keine offenen Kundenfragen oder Angebotsreaktionen'), 'G: Empty State Text');

// H) Technische Eventnamen erscheinen nicht in der UI
const cardSource = readFileSync(
  join(__dirname, '../../components/backend/CleverInboxCard.jsx'),
  'utf8',
);
const pageSource = readFileSync(
  join(__dirname, '../../pages/backend/CleverInboxPage.jsx'),
  'utf8',
);
assert.equal(containsTechnicalEventName(cardSource), false, 'H: Card ohne Eventnamen');
assert.equal(containsTechnicalEventName(pageSource), false, 'H: Page ohne Eventnamen');

// Gruppierung: gleicher Kunde + Angebot = eine Arbeitskarte
reset();
createInboxItem({
  type: INBOX_EVENT_TYPES.OFFER_QUESTION,
  title: 'Frage',
  message: '„Winterreifen dabei?“',
  leadId: 'l-ev6',
  customerId: 'l-ev6',
  offerId: 'vc-ev6',
  customerName: 'E2E Kunde',
  vehicleLabel: 'EV6',
  status: INBOX_STATUS.OPEN,
});
createInboxItem({
  type: INBOX_EVENT_TYPES.OFFER_INTERESTED,
  title: 'Interesse',
  message: 'Interesse',
  leadId: 'l-ev6',
  customerId: 'l-ev6',
  offerId: 'vc-ev6',
  customerName: 'E2E Kunde',
  vehicleLabel: 'EV6',
  status: INBOX_STATUS.OPEN,
});
const grouped = buildInboxWorkCards(listInboxItems({ status: 'open' }));
assert.equal(grouped.length, 1, 'Gruppierung: ein Fall');
assert.ok(grouped[0].signals.includes('Interesse markiert'), 'Gruppierung: Signale sichtbar');
assert.match(grouped[0].mainConcern, /Winterreifen/, 'Gruppierung: Hauptanliegen');

const demoView = buildInboxWorkCardView(buildInboxDemoItems()[1]);
assert.match(demoView.customerTitle, /E2E Kunde · Kia EV6/, 'Kundentitel formatiert');
assert.equal(demoView.offerContext.rateLine, '386 €/Monat', 'Rate sichtbar');

__clearInboxTestMode();
console.log('inboxWorkCardModel.test.js: ok');
