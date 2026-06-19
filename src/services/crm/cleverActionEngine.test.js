/**
 * Tests: Clever Action Engine
 */
import assert from 'node:assert/strict';
import {
  buildCleverActionContext,
  buildCleverActionRecommendation,
  CLEVER_ACTION_IDS,
  evaluateCleverActions,
  formatCleverRecommendationHistoryText,
  recommendCleverAction,
} from './cleverActionEngine.js';
import { VEHICLE_OFFER_STATUS } from '../vehicleOffer.js';

const MS_DAY = 86400000;

function cardWithOffer(status, extra = {}) {
  return {
    id: 'vc-1',
    modelName: 'Kia EV4',
    trimLabel: 'Earth',
    paymentType: 'leasing',
    vehicleOffer: {
      status,
      sentAt: extra.sentAt ?? null,
      tracking: { lastOpenedAt: extra.openedAt ?? null },
    },
    offer: { status },
  };
}

const baseLead = {
  id: 'lead-1',
  contact: { name: 'Max Mustermann', phone: '01701234567', email: 'max@test.de' },
  paymentType: 'leasing',
  updatedAt: new Date().toISOString(),
  crm: { cleverUnterlagen: { items: {} } },
};

// Angebot erstellt → Angebot senden
const draftCtx = buildCleverActionContext({
  lead: baseLead,
  vehicleCards: [cardWithOffer(VEHICLE_OFFER_STATUS.DRAFT)],
  customerName: 'Max Mustermann',
});
const draftRec = recommendCleverAction(draftCtx);
assert.equal(draftRec.actionId, CLEVER_ACTION_IDS.OFFER_SEND);
assert.equal(draftRec.title, 'Angebot senden');

// Angebot geöffnet → Jetzt anrufen
const openedAt = new Date(Date.now() - MS_DAY).toISOString();
const openedCtx = buildCleverActionContext({
  lead: baseLead,
  vehicleCards: [cardWithOffer(VEHICLE_OFFER_STATUS.OPENED, { openedAt })],
  customerName: 'Max Mustermann',
});
const openedRec = recommendCleverAction(openedCtx);
assert.equal(openedRec.actionId, CLEVER_ACTION_IDS.OFFER_OPENED_CALL);
assert.equal(openedRec.title, 'Jetzt anrufen');

// Unterlagen fehlen → Unterlagen anfordern
const sentAt = new Date(Date.now() - MS_DAY).toISOString();
const docsLead = {
  ...baseLead,
  crm: {
    cleverUnterlagen: {
      items: {
        ausweis: { status: 'open' },
        selbstauskunft: { status: 'open' },
        gehaltsnachweis: { status: 'open' },
        bankverbindung: { status: 'open' },
      },
    },
  },
};
const docsCtx = buildCleverActionContext({
  lead: docsLead,
  vehicleCards: [cardWithOffer(VEHICLE_OFFER_STATUS.SENT, { sentAt })],
});
const docsRec = recommendCleverAction(docsCtx);
assert.equal(docsRec.actionId, CLEVER_ACTION_IDS.DOCUMENTS_MISSING);

// Leasing freigegeben → Fahrzeug bestellen
const approvedCtx = buildCleverActionContext({
  lead: {
    ...baseLead,
    crm: {
      leasing: { status: 'approved' },
      cleverUnterlagen: {
        items: {
          ausweis: { status: 'checked' },
          selbstauskunft: { status: 'checked' },
          gehaltsnachweis: { status: 'checked' },
          bankverbindung: { status: 'checked' },
        },
      },
    },
  },
  vehicleCards: [cardWithOffer(VEHICLE_OFFER_STATUS.ACCEPTED, { sentAt })],
});
const approvedRec = recommendCleverAction(approvedCtx);
assert.equal(approvedRec.actionId, CLEVER_ACTION_IDS.LEASING_APPROVED);

// Fahrzeug angekommen → Auslieferung planen
const arrivingCtx = buildCleverActionContext({
  lead: {
    ...baseLead,
    crm: { vehicleFulfillment: { status: 'in_transit' } },
  },
  vehicleCards: [cardWithOffer(VEHICLE_OFFER_STATUS.ACCEPTED)],
});
const arrivingRec = recommendCleverAction(arrivingCtx);
assert.equal(arrivingRec.actionId, CLEVER_ACTION_IDS.VEHICLE_ARRIVING);

// Mehrere Aktionen → höchste Priorität gewinnt
const multiCtx = buildCleverActionContext({
  lead: {
    ...baseLead,
    crm: {
      vehicleFulfillment: { status: 'delivery_ready' },
      leasing: { status: 'approved' },
    },
  },
  vehicleCards: [cardWithOffer(VEHICLE_OFFER_STATUS.OPENED, { openedAt })],
});
const multiRec = recommendCleverAction(multiCtx);
assert.equal(multiRec.actionId, CLEVER_ACTION_IDS.DELIVERY_READY);

const multiCandidates = evaluateCleverActions(multiCtx);
assert.ok(multiCandidates.length > 1);
assert.equal(multiCandidates.sort((a, b) => a.priority - b.priority)[0].actionId, CLEVER_ACTION_IDS.DELIVERY_READY);

// Nachfassen nach 3 Tagen
const followSentAt = new Date(Date.now() - 3 * MS_DAY).toISOString();
const followCtx = buildCleverActionContext({
  lead: baseLead,
  vehicleCards: [cardWithOffer(VEHICLE_OFFER_STATUS.SENT, { sentAt: followSentAt })],
});
const followRec = recommendCleverAction(followCtx);
assert.equal(followRec.actionId, CLEVER_ACTION_IDS.OFFER_FOLLOWUP);
assert.ok(followRec.explanation.includes('3'));

const full = buildCleverActionRecommendation({
  lead: baseLead,
  vehicleCards: [cardWithOffer(VEHICLE_OFFER_STATUS.DRAFT)],
  customerName: 'Max Mustermann',
});
assert.ok(full.analyticsText.includes('Clever empfahl'));
assert.equal(formatCleverRecommendationHistoryText(full), 'Clever empfahl: Angebot senden');

console.log('cleverActionEngine tests OK');
