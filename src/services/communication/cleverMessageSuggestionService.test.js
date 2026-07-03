/**
 * Tests: Clever Antwortvorschläge
 */
import assert from 'node:assert/strict';
import {
  buildCleverMessageSuggestion,
  copyCleverMessageSuggestion,
  MESSAGE_TEMPLATE_IDS,
  prepareMessageChannels,
  resolveMessageTemplateId,
} from './cleverMessageSuggestionService.js';
import { evaluateJourneyReminder } from '../journey/journeyReminderService.js';
import { VEHICLE_OFFER_STATUS } from '../vehicleOffer.js';

const MS_DAY = 86400000;

function cardWithOffer(status, extra = {}) {
  return {
    id: 'vc-msg-1',
    model: 'EV4',
    trim: 'Earth',
    paymentType: 'leasing',
    termMonths: 48,
    mileagePerYear: 10000,
    vehicleOffer: {
      status,
      sentAt: extra.sentAt ?? null,
      tracking: { lastOpenedAt: extra.openedAt ?? null },
      onlineLink: { url: 'https://example.com/angebot/ev4' },
    },
    offer: { status },
  };
}

const baseLead = {
  id: 'msg-lead-1',
  contact: { name: 'Herr Max Müller', phone: '01701234567', email: 'max@test.de', salutation: 'herr' },
  paymentType: 'leasing',
  updatedAt: new Date().toISOString(),
  crm: { cleverUnterlagen: { items: {} } },
};

// Reminder-Regel erzeugt passenden Text
const sentReminder = evaluateJourneyReminder({
  ...baseLead,
  id: 'msg-sent',
}, {
  vehicleCards: [cardWithOffer(VEHICLE_OFFER_STATUS.SENT, {
    sentAt: new Date(Date.now() - 3 * MS_DAY).toISOString(),
  })],
});
const sentSuggestion = buildCleverMessageSuggestion(
  { ...baseLead, id: 'msg-sent' },
  { vehicleCards: [cardWithOffer(VEHICLE_OFFER_STATUS.SENT, { sentAt: new Date(Date.now() - 3 * MS_DAY).toISOString() })], reminder: sentReminder },
);
assert.equal(sentSuggestion.templateId, MESSAGE_TEMPLATE_IDS.OFFER_FOLLOWUP);
assert.match(sentSuggestion.text, /EV4/i);
assert.match(sentSuggestion.text, /Hallo Herr Müller/);

// Angebotsdaten werden eingesetzt
const openedSuggestion = buildCleverMessageSuggestion({
  ...baseLead,
  id: 'msg-opened',
}, {
  vehicleCards: [cardWithOffer(VEHICLE_OFFER_STATUS.OPENED, {
    openedAt: new Date(Date.now() - 25 * 3600000).toISOString(),
    sentAt: new Date(Date.now() - 2 * MS_DAY).toISOString(),
  })],
});
assert.equal(openedSuggestion.templateId, MESSAGE_TEMPLATE_IDS.OFFER_OPENED);
assert.match(openedSuggestion.text, /angeschaut haben/i);
assert.match(openedSuggestion.text, /example\.com\/angebot\/ev4/);

// Fehlende Daten → neutraler Text
const neutralSuggestion = buildCleverMessageSuggestion({
  ...baseLead,
  id: 'msg-neutral',
  contact: { name: 'Kunde' },
}, {
  vehicleCards: [],
});
assert.equal(neutralSuggestion.templateId, MESSAGE_TEMPLATE_IDS.GENERAL_FOLLOWUP);
assert.match(neutralSuggestion.text, /Wunschfahrzeug|Ihre Anfrage|melden/i);

// Kopieren ohne Mailversand
let copiedText = '';
const copyResult = await copyCleverMessageSuggestion(openedSuggestion, {
  clipboard: { writeText: async (t) => { copiedText = t; } },
});
assert.equal(copyResult.ok, true);
assert.ok(copyResult.text.length > 20);
assert.equal(copiedText, openedSuggestion.text);

// Kanäle vorbereiten – kein autoSend
const channels = prepareMessageChannels(openedSuggestion, {
  phone: '01701234567',
  email: 'max@test.de',
});
assert.equal(channels.autoSend, false);
assert.ok(channels.whatsappHref?.includes('wa.me'));
assert.ok(channels.mailtoHref?.startsWith('mailto:'));

// Template-Auflösung aus Reminder
const templateFromReminder = resolveMessageTemplateId({
  reminder: { ruleId: 'documents_missing_3d', active: true },
});
assert.equal(templateFromReminder, MESSAGE_TEMPLATE_IDS.DOCUMENTS_MISSING);

// Probefahrt ohne Termin
const tdSuggestion = buildCleverMessageSuggestion({
  ...baseLead,
  id: 'msg-td',
  status: 'probefahrt',
  wantTestDrive: true,
}, { vehicleCards: [cardWithOffer(VEHICLE_OFFER_STATUS.SENT)] });
assert.equal(tdSuggestion.templateId, MESSAGE_TEMPLATE_IDS.TEST_DRIVE_PLAN);

// Selbstauskunft erinnern
const saSuggestion = buildCleverMessageSuggestion({
  ...baseLead,
  id: 'msg-sa',
  crm: {
    cleverUnterlagen: {
      items: {},
      selbstauskunft: { status: 'in_progress' },
    },
  },
}, {
  vehicleCards: [cardWithOffer(VEHICLE_OFFER_STATUS.SENT)],
  reminder: { ruleId: 'self_disclosure_open', active: true },
});
assert.equal(saSuggestion.templateId, MESSAGE_TEMPLATE_IDS.SELF_DISCLOSURE_REMINDER);

console.log('cleverMessageSuggestionService.test.js: ok');
