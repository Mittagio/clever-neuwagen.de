/**
 * Tests: Clever Journey Manager
 */
import assert from 'node:assert/strict';
import {
  evaluateJourney,
  evaluateSellerJourneys,
  resolveCanonicalOfferState,
} from './journeyEngine.js';
import { JOURNEY_PHASE, CANONICAL_OFFER_STATE } from './journeyTypes.js';
import { VEHICLE_OFFER_STATUS } from '../vehicleOffer.js';
import { CLEVER_ACTION_IDS } from '../crm/cleverActionEngine.js';

const MS_DAY = 86400000;

function cardWithOffer(status, extra = {}) {
  return {
    id: extra.id ?? 'vc-1',
    model: 'EV4',
    trim: 'Earth',
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
  id: 'journey-lead-1',
  contact: { name: 'Max Mustermann', phone: '01701234567', email: 'max@test.de' },
  paymentType: 'leasing',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  history: [],
  crm: {
    pipelineStatusId: 'neu',
    cleverUnterlagen: { items: {} },
  },
};

// Neue Anfrage
const newInquiry = evaluateJourney({
  ...baseLead,
  id: 'journey-new',
  contact: {},
});
assert.equal(newInquiry.phase, JOURNEY_PHASE.NEW_INQUIRY);

// Angebot erstellt (Board)
const createdLead = {
  ...baseLead,
  id: 'journey-created',
  crm: {
    ...baseLead.crm,
    pipelineStatusId: 'angebot_erstellt',
    vehicleConfigurations: [{
      id: 'vc-1',
      model: 'EV4',
      trimLabel: 'Earth',
      paymentType: 'leasing',
      leasingData: { termMonths: 48, mileagePerYear: 10000, calculatedRate: 399 },
      boardOffer: {
        status: 'offer_created',
        payment: { type: 'leasing', termMonths: 48, mileagePerYear: 10000, monthlyRate: 399 },
      },
    }],
  },
};
const createdJourney = evaluateJourney(createdLead);
assert.equal(createdJourney.phase, JOURNEY_PHASE.OFFER_CREATED);
assert.equal(createdJourney.canonicalOfferState.state, CANONICAL_OFFER_STATE.CREATED);

// Angebot versendet
const sentLead = {
  ...baseLead,
  id: 'journey-sent',
  status: 'angebotVersendet',
  crm: {
    ...baseLead.crm,
    pipelineStatusId: 'angebot_gesendet',
  },
};
const sentJourney = evaluateJourney({
  ...sentLead,
  crm: {
    ...sentLead.crm,
    vehicleOffers: {},
  },
}, {
  vehicleCards: [cardWithOffer(VEHICLE_OFFER_STATUS.SENT, {
    sentAt: new Date().toISOString(),
  })],
});
assert.equal(sentJourney.phase, JOURNEY_PHASE.OFFER_SENT);
assert.equal(sentJourney.canonicalOfferState.state, CANONICAL_OFFER_STATE.SENT);

// Angebot geöffnet
const openedJourney = evaluateJourney({
  ...baseLead,
  id: 'journey-opened',
}, {
  vehicleCards: [cardWithOffer(VEHICLE_OFFER_STATUS.OPENED, {
    sentAt: new Date(Date.now() - 2 * MS_DAY).toISOString(),
    openedAt: new Date(Date.now() - MS_DAY).toISOString(),
  })],
});
assert.equal(openedJourney.canonicalOfferState.state, CANONICAL_OFFER_STATE.OPENED);
assert.ok(
  openedJourney.phase === JOURNEY_PHASE.CUSTOMER_CONSIDERING
  || openedJourney.phase === JOURNEY_PHASE.OFFER_SENT,
  `Phase bei geöffnetem Angebot: ${openedJourney.phase}`,
);
assert.ok(openedJourney.scores.abschlusschance >= 60);

// Unterlagen fehlen (nach Interesse / Finanzierung)
const docsLead = {
  ...baseLead,
  id: 'journey-docs',
  crm: {
    ...baseLead.crm,
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
const docsJourney = evaluateJourney(docsLead, {
  vehicleCards: [cardWithOffer(VEHICLE_OFFER_STATUS.ACCEPTED)],
});
assert.equal(docsJourney.phase, JOURNEY_PHASE.DOCUMENTS);

// Finanzierung läuft
const financingLead = {
  ...baseLead,
  id: 'journey-financing',
  crm: {
    ...baseLead.crm,
    leasing: { status: 'submitted' },
    cleverUnterlagen: {
      items: {
        ausweis: { status: 'checked' },
        selbstauskunft: { status: 'checked' },
        gehaltsnachweis: { status: 'checked' },
        bankverbindung: { status: 'checked' },
      },
    },
  },
};
const financingJourney = evaluateJourney(financingLead, {
  vehicleCards: [cardWithOffer(VEHICLE_OFFER_STATUS.SENT)],
});
assert.equal(financingJourney.phase, JOURNEY_PHASE.FINANCING);

// Auslieferung bestätigt
const handoverLead = {
  ...baseLead,
  id: 'journey-handover',
  status: 'auslieferung_bestaetigt',
  deliveryConfirmation: {
    sentAt: new Date(Date.now() - 3 * MS_DAY).toISOString(),
    confirmedAt: new Date().toISOString(),
  },
};
const handoverJourney = evaluateJourney(handoverLead);
assert.equal(handoverJourney.phase, JOURNEY_PHASE.HANDOVER);

// Verloren
const lostJourney = evaluateJourney({ ...baseLead, id: 'journey-lost', status: 'verloren' });
assert.equal(lostJourney.phase, JOURNEY_PHASE.LOST);
assert.ok(lostJourney.scores.kaufwahrscheinlichkeit <= 10);

// Mehrere Angebotsquellen kanonisieren
const multiSourceLead = {
  ...baseLead,
  id: 'journey-multi',
  offers: [{ id: 'legacy-1', status: VEHICLE_OFFER_STATUS.DRAFT }],
  crm: {
    ...baseLead.crm,
    vehicleOffers: {
      'vc-legacy': { status: VEHICLE_OFFER_STATUS.SENT, sentAt: new Date().toISOString() },
    },
    vehicleConfigurations: [{
      id: 'vc-board',
      model: 'Sportage',
      paymentType: 'leasing',
      boardOffer: {
        status: 'offer_created',
        payment: { type: 'leasing', termMonths: 48, mileagePerYear: 10000, monthlyRate: 449 },
      },
    }],
  },
};
const canonical = resolveCanonicalOfferState(multiSourceLead);
assert.ok(
  canonical.state === CANONICAL_OFFER_STATE.SENT
  || canonical.state === CANONICAL_OFFER_STATE.CREATED,
  `Kanonischer Status über Quellen: ${canonical.state}`,
);
assert.ok(canonical.sources.length >= 1);

// Empfehlung kompatibel mit Clever empfiehlt 2.0
const empfiehltJourney = evaluateJourney({
  ...baseLead,
  id: 'journey-empfiehlt',
}, {
  vehicleCards: [cardWithOffer(VEHICLE_OFFER_STATUS.OPENED, {
    openedAt: new Date(Date.now() - MS_DAY).toISOString(),
    sentAt: new Date(Date.now() - 2 * MS_DAY).toISOString(),
  })],
});
assert.ok(empfiehltJourney.view?.headline, 'Clever-Empfiehlt-View vorhanden');
assert.ok(empfiehltJourney.view?.closureChance >= 0, 'Abschlusschance in View');
assert.ok(empfiehltJourney.view?.whyBullets?.length > 0, 'Warum-Bullets in View');
assert.ok(empfiehltJourney.reasons.length > 0, 'Journey-Reasons vorhanden');
assert.ok(empfiehltJourney.timeline.length >= 0, 'Timeline vorhanden');
assert.ok(
  empfiehltJourney.recommendation?.actionId === CLEVER_ACTION_IDS.OFFER_OPENED_CALL
  || empfiehltJourney.recommendation?.actionId === CLEVER_ACTION_IDS.OFFER_FOLLOWUP,
  'Empfehlung aus Action Engine',
);

// Dashboard-Aggregation
const dashboard = evaluateSellerJourneys([
  {
    ...baseLead,
    id: 'dash-1',
    contact: { name: 'Herr Müller', phone: '01701111111' },
  },
  {
    ...baseLead,
    id: 'dash-2',
    contact: { name: 'Familie Maier', phone: '01702222222' },
  },
  { ...baseLead, id: 'dash-lost', status: 'verloren' },
], { maxItems: 5 });
assert.ok(dashboard.length >= 1, 'Dashboard hat Einträge');
assert.ok(dashboard[0].headline, 'Dashboard-Headline');
assert.ok(dashboard[0].journey?.phase, 'Journey an Dashboard-Item');

console.log('journeyEngine.test.js: ok');
