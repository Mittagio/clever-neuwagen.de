/**
 * Tests: Clever Empfiehlt Presenter
 */
import assert from 'node:assert/strict';
import {
  buildCleverEmpfiehltToday,
  buildCleverEmpfiehltView,
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

console.log('cleverRecommendationPresenter.test.js: ok');
