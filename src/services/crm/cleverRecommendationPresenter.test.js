/**
 * Tests: Clever Empfiehlt Presenter
 */
import assert from 'node:assert/strict';
import {
  buildCleverEmpfiehltToday,
  buildCleverEmpfiehltView,
  buildOfferSnapshot,
  buildStatusSignals,
  collectWhyBullets,
  computeAbschlusschance,
  recommendCleverActionExcluding,
} from './cleverRecommendationPresenter.js';
import {
  buildCleverActionContext,
  CLEVER_ACTION_IDS,
} from './cleverActionEngine.js';
import { VEHICLE_OFFER_STATUS } from '../vehicleOffer.js';

const MS_DAY = 86400000;

function cardWithOffer(status, extra = {}) {
  return {
    id: 'vc-1',
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
  id: 'lead-presenter-1',
  contact: { name: 'Herr Müller', phone: '01701234567', email: 'mueller@test.de' },
  paymentType: 'leasing',
  desiredRate: 399,
  updatedAt: new Date().toISOString(),
  crm: { cleverUnterlagen: { items: {} } },
};

// Abschlusschance steigt bei geöffnetem Angebot
const openedCtx = buildCleverActionContext({
  lead: baseLead,
  vehicleCards: [cardWithOffer(VEHICLE_OFFER_STATUS.OPENED, {
    openedAt: new Date(Date.now() - MS_DAY).toISOString(),
    sentAt: new Date(Date.now() - 2 * MS_DAY).toISOString(),
  })],
  customerName: 'Herr Müller',
});
const openedChance = computeAbschlusschance(openedCtx);
assert.ok(openedChance >= 60, `Geöffnetes Angebot sollte hohe Chance haben, got ${openedChance}`);

// Warum-Bullets enthalten Angebotsöffnung
const bullets = collectWhyBullets(openedCtx, { reason: 'Angebot wurde geöffnet' });
assert.ok(bullets.some((b) => b.text.includes('geöffnet')), 'Bullet für geöffnetes Angebot');

// View-Model mit Headline und Abschlusschance
const view = buildCleverEmpfiehltView({
  lead: baseLead,
  vehicleCards: openedCtx.vehicleCards,
  customerName: 'Herr Müller',
});
assert.ok(view.headline, 'Headline vorhanden');
assert.ok(view.closureChance >= 0 && view.closureChance <= 100, 'Abschlusschance 0-100');
assert.ok(view.whyBullets.length > 0, 'Warum-Bullets vorhanden');
assert.ok(view.actions.some((a) => a.id === 'call'), 'Anrufen-Action vorhanden');
assert.ok(view.doneOption?.label.includes('✓'), 'Erledigt-Option vorhanden');

// Erledigt → nächste Empfehlung
const firstActionId = view.actionId;
const nextView = buildCleverEmpfiehltView({
  lead: baseLead,
  vehicleCards: openedCtx.vehicleCards,
  customerName: 'Herr Müller',
  excludedActionIds: [firstActionId],
});
assert.ok(nextView, 'Nach Erledigt gibt es eine Folgeempfehlung');

// Dashboard sortiert nach Abschlusschance
const today = buildCleverEmpfiehltToday([
  baseLead,
  {
    ...baseLead,
    id: 'lead-presenter-2',
    contact: { name: 'Familie Maier', phone: '01709876543' },
    crm: { cleverUnterlagen: { items: {} } },
  },
]);
assert.ok(today.length >= 1, 'Dashboard hat Einträge');
assert.ok(today[0].customerName, 'Kundenname im Dashboard');
assert.ok(today[0].closureChance >= 0, 'Abschlusschance im Dashboard');

// Excluding filter
const ctx = buildCleverActionContext({
  lead: baseLead,
  vehicleCards: openedCtx.vehicleCards,
  customerName: 'Herr Müller',
});
const rec = recommendCleverActionExcluding(ctx, [CLEVER_ACTION_IDS.OFFER_OPENED_CALL]);
assert.ok(rec, 'Alternative Empfehlung nach Ausschluss');

// OFFER_SEND → Primary CTA ist Angebot, nicht Anrufen
{
  const draftCard = {
    id: 'vc-draft-send',
    model: 'EV4',
    trim: 'Earth',
    paymentType: 'leasing',
    vehicleOffer: { status: VEHICLE_OFFER_STATUS.LINK_READY },
    offer: { status: VEHICLE_OFFER_STATUS.LINK_READY },
  };
  const sendView = buildCleverEmpfiehltView({
    lead: {
      ...baseLead,
      id: 'lead-offer-send',
      contact: { name: 'Frau Send', phone: '01701112233', email: 'send@test.de' },
      crm: { cleverUnterlagen: { items: {} } },
    },
    vehicleCards: [draftCard],
    customerName: 'Frau Send',
    offerPath: '/angebot/demo',
    excludedActionIds: [
      CLEVER_ACTION_IDS.PORTAL_LINK_SEND,
      CLEVER_ACTION_IDS.PORTAL_LINK_FOLLOWUP,
      CLEVER_ACTION_IDS.PORTAL_CODE_REMIND,
      CLEVER_ACTION_IDS.PORTAL_VIEWED_FOLLOWUP,
      CLEVER_ACTION_IDS.DOCUMENTS_MISSING,
      CLEVER_ACTION_IDS.DOCUMENTS_INBOX_CHECK,
      CLEVER_ACTION_IDS.SELF_DISCLOSURE_REQUEST,
      CLEVER_ACTION_IDS.SELF_DISCLOSURE_REVIEW,
      CLEVER_ACTION_IDS.SELECTION_SEND,
      CLEVER_ACTION_IDS.OFFER_DRAFT_CREATE,
      CLEVER_ACTION_IDS.OFFER_CREATED_SEND,
    ],
  });
  assert.ok(sendView, 'Empfiehlt-View für ungesendetes Angebot');
  assert.ok(
    sendView.actionId === CLEVER_ACTION_IDS.OFFER_SEND
    || sendView.handlerType === 'offer_send',
    `Erwartet OFFER_SEND, got ${sendView.actionId}/${sendView.handlerType}`,
  );
  const primary = sendView.actions?.find((a) => a.primary) ?? sendView.actions?.[0];
  assert.equal(primary?.id, 'offer', 'Primary bei Angebot-senden ist offer');
  assert.match(String(primary?.label || ''), /Angebot/i, 'Primary-Label ist angebotsbezogen');
  const callAction = sendView.actions?.find((a) => a.id === 'call');
  assert.ok(callAction, 'Anrufen bleibt als sekundäre Action');
  assert.ok(!callAction.primary, 'Anrufen ist nicht primary');
  assert.ok(sendView.offerSnapshot, 'Stage: Offer-Snapshot vorhanden');
  assert.equal(sendView.offerSnapshot.cardId, 'vc-draft-send');
  assert.match(String(sendView.offerSnapshot.title || ''), /EV4/i, 'Snapshot-Titel enthält Modell');
  assert.ok(sendView.stage?.primaryReviewLabel, 'Stage: Primary-Review-Label');
  assert.ok(Array.isArray(sendView.statusSignals), 'Stage: Status-Signale Array');
}

// Snapshot + Signale nur aus echten Daten
{
  const ctx = buildCleverActionContext({
    lead: {
      ...baseLead,
      crm: {
        cleverUnterlagen: { items: {} },
        vehicleFulfillment: { status: 'delivery_ready' },
      },
      history: [{ text: 'Braucht Auto sofort', type: 'note' }],
    },
    vehicleCards: [{
      id: 'vc-snap',
      model: 'EV3',
      trim: 'Air',
      modelName: 'Kia EV3 Air',
      paymentType: 'leasing',
      termMonths: 48,
      mileagePerYear: 35000,
      desiredRate: 437.26,
      vehicleOffer: { status: VEHICLE_OFFER_STATUS.LINK_READY },
    }],
    customerName: 'Herr Müller',
  });
  const snap = buildOfferSnapshot(ctx);
  assert.ok(snap, 'Offer-Snapshot gebaut');
  assert.equal(snap.termLabel, '48 M');
  assert.match(String(snap.mileageLabel || ''), /35\.000/);
  assert.equal(snap.availabilityLabel, 'Verfügbar');
  assert.equal(snap.subtitle, null, 'Kein Leasingangebot-Untertitel in der Stage');
  assert.equal(snap.mileageHint, null, 'Kein Laufleistung-Hinweis im Grid');
  assert.ok(snap.rateValue, 'Rate-Wert getrennt für Stage-Grid');
  assert.match(String(snap.rateUnit || ''), /Monat/i, 'Rate-Einheit /Monat');
  assert.ok(snap.imageUrl == null || typeof snap.imageUrl === 'string', 'imageUrl nur echte URL oder null');
  const signals = buildStatusSignals(ctx, 80, [{ id: 'delivery_ready', text: 'Fahrzeug bereit' }]);
  assert.ok(signals.some((s) => s.id === 'closure_high'), 'Hohe Abschlusschance nur bei Score');
  assert.ok(signals.some((s) => s.id === 'availability'), 'Verfügbarkeit nur bei echtem Status');
  assert.ok(signals.some((s) => s.id === 'urgency'), 'Zeitdruck nur bei Urgency-Signal');

  // Urgency auch aus Notes/SellerInsights, nicht nur History
  const notesCtx = buildCleverActionContext({
    lead: {
      ...baseLead,
      notes: 'braucht Auto sofort\nUnfall / Ersatzfahrzeug',
      history: [],
      crm: { cleverUnterlagen: { items: {} } },
    },
    vehicleCards: [{
      id: 'vc-urg',
      model: 'EV3',
      trim: 'Air',
      paymentType: 'leasing',
      vehicleOffer: { status: VEHICLE_OFFER_STATUS.LINK_READY },
    }],
  });
  const noteSignals = buildStatusSignals(notesCtx, 40, []);
  assert.ok(noteSignals.some((s) => s.id === 'urgency'), 'Zeitdruck aus lead.notes');
}

console.log('cleverRecommendationPresenter.test.js: ok');
