/**
 * Tests: Journey Wiedervorlagen
 */
import assert from 'node:assert/strict';
import {
  applyJourneyReminder,
  canApplyJourneyReminder,
  evaluateJourneyReminder,
  evaluateSellerReminders,
  formatReminderDisplay,
  isManualFollowUp,
} from './journeyReminderService.js';
import { VEHICLE_OFFER_STATUS } from '../vehicleOffer.js';
import { SELBSTAUSKUNFT_STATUS } from '../cleverSelbstauskunft.js';

const MS_DAY = 86400000;

function cardWithOffer(status, extra = {}) {
  return {
    id: 'vc-rem-1',
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
  id: 'reminder-lead-1',
  contact: { name: 'Anna Test', phone: '01701234567' },
  paymentType: 'leasing',
  updatedAt: new Date().toISOString(),
  history: [],
  crm: { cleverUnterlagen: { items: {} } },
};

// Angebot versendet + 2 Tage keine Reaktion
const sentLead = { ...baseLead, id: 'rem-sent' };
const sentReminder = evaluateJourneyReminder(sentLead, {
  vehicleCards: [cardWithOffer(VEHICLE_OFFER_STATUS.SENT, {
    sentAt: new Date(Date.now() - 3 * MS_DAY).toISOString(),
  })],
});
assert.equal(sentReminder.ruleId, 'offer_sent_2d');
assert.equal(sentReminder.nextStepLabel, 'Nachfassen');
assert.ok(sentReminder.dueNow, 'Nachfassen ist fällig');

// Angebot geöffnet + 24h keine Reaktion
const openedLead = { ...baseLead, id: 'rem-opened' };
const openedReminder = evaluateJourneyReminder(openedLead, {
  vehicleCards: [cardWithOffer(VEHICLE_OFFER_STATUS.OPENED, {
    sentAt: new Date(Date.now() - 2 * MS_DAY).toISOString(),
    openedAt: new Date(Date.now() - 25 * 3600000).toISOString(),
  })],
});
assert.equal(openedReminder.ruleId, 'offer_opened_24h');
assert.equal(openedReminder.nextStepLabel, 'Heute anrufen');

// Unterlagen fehlen
const docsLead = {
  ...baseLead,
  id: 'rem-docs',
  updatedAt: new Date(Date.now() - 4 * MS_DAY).toISOString(),
  crm: {
    cleverUnterlagen: {
      items: {
        ausweis: { status: 'open' },
        selbstauskunft: { status: 'open' },
        gehaltsnachweis: { status: 'open' },
        bankverbindung: { status: 'open' },
      },
    },
    leasing: { status: 'submitted' },
  },
};
const docsReminder = evaluateJourneyReminder(docsLead, {
  vehicleCards: [cardWithOffer(VEHICLE_OFFER_STATUS.ACCEPTED)],
});
assert.equal(docsReminder.ruleId, 'documents_missing_3d');

// Selbstauskunft offen
const saLead = {
  ...baseLead,
  id: 'rem-sa',
  crm: {
    cleverUnterlagen: {
      items: {},
      selbstauskunft: { status: SELBSTAUSKUNFT_STATUS.in_progress.id },
    },
  },
};
const saReminder = evaluateJourneyReminder(saLead, {
  vehicleCards: [cardWithOffer(VEHICLE_OFFER_STATUS.SENT, {
    sentAt: new Date().toISOString(),
  })],
});
assert.equal(saReminder.ruleId, 'self_disclosure_open');

// Probefahrt ohne Termin
const tdLead = {
  ...baseLead,
  id: 'rem-td',
  status: 'probefahrt',
  wantTestDrive: true,
  crm: { cleverUnterlagen: { items: {} } },
};
const tdReminder = evaluateJourneyReminder(tdLead);
assert.equal(tdReminder.ruleId, 'test_drive_no_appointment');

// Manuelle Wiedervorlage bleibt bestehen
const manualLead = {
  ...baseLead,
  id: 'rem-manual',
  crm: {
    followUpSource: 'manual',
    followUpAt: new Date().toISOString(),
    nextStepId: 'call_tomorrow',
    nextStepLabel: 'Morgen anrufen',
    cleverUnterlagen: { items: {} },
  },
};
assert.ok(isManualFollowUp(manualLead));
const manualReminder = evaluateJourneyReminder(manualLead, {
  vehicleCards: [cardWithOffer(VEHICLE_OFFER_STATUS.OPENED, {
    openedAt: new Date(Date.now() - 25 * 3600000).toISOString(),
  })],
});
const manualApply = applyJourneyReminder(manualLead, manualReminder);
assert.equal(manualApply.applied, false);
assert.equal(canApplyJourneyReminder(manualLead, manualReminder).reason, 'manual_follow_up');

// Kein doppelter Reminder am selben Tag
const appliedLead = {
  ...baseLead,
  id: 'rem-dup',
  crm: {
    cleverUnterlagen: { items: {} },
    journeyReminderRuleId: 'offer_opened_24h',
    journeyReminderAppliedAt: new Date().toISOString(),
  },
  history: [{
    at: new Date().toISOString(),
    text: 'Clever Wiedervorlage',
    type: 'followup',
    meta: { journeyReminderRuleId: 'offer_opened_24h' },
  }],
};
const dupReminder = evaluateJourneyReminder(appliedLead, {
  vehicleCards: [cardWithOffer(VEHICLE_OFFER_STATUS.OPENED, {
    openedAt: new Date(Date.now() - 25 * 3600000).toISOString(),
  })],
});
const dupApply = applyJourneyReminder(appliedLead, dupReminder);
assert.equal(dupApply.applied, false);

// Apply setzt CRM-Felder
const freshLead = { ...baseLead, id: 'rem-apply' };
const freshReminder = evaluateJourneyReminder(freshLead, {
  vehicleCards: [cardWithOffer(VEHICLE_OFFER_STATUS.OPENED, {
    openedAt: new Date(Date.now() - 25 * 3600000).toISOString(),
  })],
});
const applyResult = applyJourneyReminder(freshLead, freshReminder, { force: true });
assert.equal(applyResult.applied, true);
assert.equal(applyResult.crmPatch.nextStepId, 'call_today');
assert.ok(applyResult.crmPatch.followUpAt);
assert.equal(applyResult.crmPatch.followUpSource, 'journey');
assert.ok(applyResult.historyEntry.text.includes('Clever Wiedervorlage'));

// Display-Zeile
assert.match(
  formatReminderDisplay(freshReminder),
  /Wiedervorlage:.*Grund: Angebot geöffnet/,
);

// Dashboard priorisiert fällig heute
const dashLead = {
  ...baseLead,
  id: 'dash-due',
  crm: {
    cleverUnterlagen: { items: {} },
    vehicleOffers: {
      'vc-rem-1': {
        status: VEHICLE_OFFER_STATUS.OPENED,
        sentAt: new Date(Date.now() - 2 * MS_DAY).toISOString(),
        tracking: { lastOpenedAt: new Date(Date.now() - 25 * 3600000).toISOString() },
      },
    },
    vehicleConfigurations: [{
      id: 'vc-rem-1',
      model: 'EV4',
      trimLabel: 'Earth',
      paymentType: 'leasing',
    }],
  },
};
const dashboard = evaluateSellerReminders([dashLead, { ...baseLead, id: 'rem-low', contact: { name: 'Niedrig' } }], {
  maxItems: 5,
});
assert.ok(dashboard.length >= 1);
assert.ok(dashboard.some((item) => item.dueToday || item.dueTodayBadge === 'fällig heute'));

console.log('journeyReminderService.test.js: ok');
