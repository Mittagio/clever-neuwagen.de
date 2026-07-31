/**
 * Wiedervorlage-Regeln aus Journey-Signalen.
 */
import { CANONICAL_OFFER_STATE } from './journeyTypes.js';
import { getSelbstauskunft, SELBSTAUSKUNFT_STATUS, needsSelbstauskunft } from '../cleverSelbstauskunft.js';
import {
  GOLDEN_MOMENT_TYPE,
  buildGoldenMoment,
} from './goldenMoment.js';
import {
  resolveContractEndDate,
  monthsUntilContractEnd,
} from '../cleverSeller/contractGoldenSignals.js';

const MS_PER_HOUR = 3600000;
const MS_PER_DAY = 86400000;

export const JOURNEY_REMINDER_RULE_IDS = {
  OFFER_OPENED_24H: 'offer_opened_24h',
  OFFER_SENT_2D: 'offer_sent_2d',
  FAVORITE_NEEDS_REVISED_OFFER: 'favorite_needs_revised_offer',
  DOCUMENTS_MISSING_3D: 'documents_missing_3d',
  SELF_DISCLOSURE_OPEN: 'self_disclosure_open',
  TEST_DRIVE_NO_APPOINTMENT: 'test_drive_no_appointment',
  LEASING_EXPIRES_3M: 'leasing_expires_3m',
  LEASING_EXPIRES_6M: 'leasing_expires_6m',
  LEASING_EXPIRES_12M: 'leasing_expires_12m',
  VEHICLE_ARRIVING: 'vehicle_arriving',
  AFTERCARE_7D: 'aftercare_7d',
};

export const JOURNEY_REMINDER_RULES = [
  {
    id: JOURNEY_REMINDER_RULE_IDS.OFFER_OPENED_24H,
    nextStepId: 'call_today',
    nextStepLabel: 'Heute anrufen',
    reason: 'Angebot geöffnet',
    priority: 10,
    matches(signals) {
      const state = signals.canonicalOffer?.state;
      if (state !== CANONICAL_OFFER_STATE.OPENED) return false;
      const openedAt = signals.primaryCard?.vehicleOffer?.tracking?.lastOpenedAt
        ?? signals.primaryCard?.offer?.openedAt;
      if (!openedAt) return signals.daysSinceOpened != null && signals.daysSinceOpened >= 1;
      return hoursSince(openedAt) >= 24;
    },
    dueAt() {
      return startOfToday();
    },
  },
  {
    id: JOURNEY_REMINDER_RULE_IDS.OFFER_SENT_2D,
    nextStepId: 'reminder',
    nextStepLabel: 'Nachfassen',
    reason: 'Angebot versendet, keine Reaktion',
    priority: 20,
    matches(signals) {
      const state = signals.canonicalOffer?.state;
      if (state !== CANONICAL_OFFER_STATE.SENT) return false;
      return signals.daysSinceSent != null && signals.daysSinceSent >= 2;
    },
    dueAt(signals) {
      return addDays(signals.primaryCard?.vehicleOffer?.sentAt ?? Date.now(), 2);
    },
  },
  {
    id: JOURNEY_REMINDER_RULE_IDS.FAVORITE_NEEDS_REVISED_OFFER,
    nextStepId: 'send_offer',
    nextStepLabel: 'Angebot anpassen',
    reason: 'Favorit mit offenen Kundenwünschen',
    priority: 12,
    matches(signals) {
      if (signals.favoriteNeedsRevisedOffer) return true;
      const moment = signals.goldenMoment
        ?? (signals.lead ? buildGoldenMoment(signals.lead) : null);
      return moment?.type === GOLDEN_MOMENT_TYPE.FAVORITE_NEEDS_REVISED_OFFER;
    },
    dueAt() {
      return startOfToday();
    },
  },
  {
    id: JOURNEY_REMINDER_RULE_IDS.DOCUMENTS_MISSING_3D,
    nextStepId: 'reminder',
    nextStepLabel: 'Unterlagen anfordern',
    reason: 'Unterlagen fehlen',
    priority: 30,
    matches(signals) {
      if (!signals.docsMissing) return false;
      const relevant = signals.hasInterested
        || signals.canonicalOffer?.state === CANONICAL_OFFER_STATE.ACCEPTED
        || signals.leasingStatus === 'submitted';
      if (!relevant) return false;
      const anchor = signals.crm?.unterlagenRequestedAt
        ?? signals.unterlagenSummary?.data?.uploadLink?.createdAt
        ?? signals.lead?.updatedAt;
      return daysSince(anchor) >= 3;
    },
    dueAt(signals) {
      const anchor = signals.crm?.unterlagenRequestedAt
        ?? signals.unterlagenSummary?.data?.uploadLink?.createdAt
        ?? signals.lead?.updatedAt;
      return addDays(anchor, 3);
    },
  },
  {
    id: JOURNEY_REMINDER_RULE_IDS.SELF_DISCLOSURE_OPEN,
    nextStepId: 'reminder',
    nextStepLabel: 'Selbstauskunft erinnern',
    reason: 'Selbstauskunft nicht abgeschlossen',
    priority: 35,
    matches(signals) {
      if (!needsSelbstauskunft(signals.paymentType)) return false;
      const sa = getSelbstauskunft(signals.crm?.cleverUnterlagen);
      const openStatuses = new Set([
        SELBSTAUSKUNFT_STATUS.opened.id,
        SELBSTAUSKUNFT_STATUS.in_progress.id,
        SELBSTAUSKUNFT_STATUS.link_sent.id,
      ]);
      return openStatuses.has(sa?.status);
    },
    dueAt() {
      return startOfTomorrow();
    },
  },
  {
    id: JOURNEY_REMINDER_RULE_IDS.TEST_DRIVE_NO_APPOINTMENT,
    nextStepId: 'test_drive',
    nextStepLabel: 'Probefahrt planen',
    reason: 'Probefahrt gewünscht, kein Termin',
    priority: 25,
    matches(signals) {
      if (!signals.hasTestDrive) return false;
      return !signals.crm?.testDriveScheduledAt && !signals.crm?.testDriveAppointmentAt;
    },
    dueAt() {
      return startOfTomorrow();
    },
  },
  {
    id: JOURNEY_REMINDER_RULE_IDS.LEASING_EXPIRES_3M,
    nextStepId: 'call_today',
    nextStepLabel: 'Rückgabe / Nachfolge vorbereiten',
    reason: 'Leasing läuft in 3 Monaten aus',
    priority: 45,
    matches(signals) {
      const end = resolveLeasingEndDate(signals.lead);
      if (!end) return false;
      const months = monthsUntil(end, signals.now);
      return months != null && months <= 3 && months >= 0;
    },
    dueAt() {
      return startOfToday();
    },
  },
  {
    id: JOURNEY_REMINDER_RULE_IDS.LEASING_EXPIRES_6M,
    nextStepId: 'call_today',
    nextStepLabel: 'Wechselchance starten',
    reason: 'Leasing läuft in 6 Monaten aus',
    priority: 50,
    matches(signals) {
      const end = resolveLeasingEndDate(signals.lead);
      if (!end) return false;
      const months = monthsUntil(end, signals.now);
      // 3m-Regel greift enger; hier 4–6 Monate bzw. allgemein ≤6 wenn 3m nicht separat gematcht
      return months != null && months <= 6 && months > 3;
    },
    dueAt() {
      return startOfToday();
    },
  },
  {
    id: JOURNEY_REMINDER_RULE_IDS.LEASING_EXPIRES_12M,
    nextStepId: 'reminder',
    nextStepLabel: 'Nachfolge frühzeitig planen',
    reason: 'Leasing läuft in 12 Monaten aus',
    priority: 55,
    matches(signals) {
      const end = resolveLeasingEndDate(signals.lead);
      if (!end) return false;
      const months = monthsUntil(end, signals.now);
      return months != null && months <= 12 && months > 6;
    },
    dueAt() {
      return startOfToday();
    },
  },
  {
    id: JOURNEY_REMINDER_RULE_IDS.VEHICLE_ARRIVING,
    nextStepId: 'call_today',
    nextStepLabel: 'Kunde informieren',
    reason: 'Fahrzeug verfügbar / unterwegs',
    priority: 15,
    matches(signals) {
      return signals.vehicleFulfillmentStatus === 'in_transit'
        || signals.vehicleFulfillmentStatus === 'arriving'
        || signals.vehicleFulfillmentStatus === 'delivery_ready';
    },
    dueAt() {
      return startOfToday();
    },
  },
  {
    id: JOURNEY_REMINDER_RULE_IDS.AFTERCARE_7D,
    nextStepId: 'reminder',
    nextStepLabel: 'Nachbetreuung',
    reason: 'Auslieferung bestätigt',
    priority: 60,
    matches(signals) {
      const confirmedAt = signals.deliveryConfirmation?.confirmedAt;
      if (!confirmedAt) return false;
      return daysSince(confirmedAt) >= 7;
    },
    dueAt(signals) {
      return addDays(signals.deliveryConfirmation?.confirmedAt, 7);
    },
  },
];

function hoursSince(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / MS_PER_HOUR);
}

function daysSince(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / MS_PER_DAY);
}

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(9, 0, 0, 0);
  return d;
}

function startOfToday() {
  return startOfDay().toISOString();
}

function startOfTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return startOfDay(d).toISOString();
}

function addDays(iso, days) {
  const base = iso ? new Date(iso) : new Date();
  if (Number.isNaN(base.getTime())) return startOfToday();
  base.setDate(base.getDate() + days);
  return startOfDay(base).toISOString();
}

function monthsUntil(iso, now = null) {
  return monthsUntilContractEnd(iso, now || new Date());
}

const MONTH_MAP = {
  januar: 0, februar: 1, märz: 2, maerz: 2, april: 3, mai: 4, juni: 5,
  juli: 6, august: 7, september: 8, oktober: 9, november: 10, dezember: 11,
};

/**
 * Vertragsende aus Contract Memory oder Wish-Projektion.
 * @param {object} lead
 */
export function resolveLeasingEndDate(lead = {}) {
  const fromContract = resolveContractEndDate(lead);
  if (fromContract && /^\d{4}-\d{2}/.test(String(fromContract))) {
    return fromContract;
  }
  const raw = lead?.wish?.leasingEndDate
    ?? lead?.leasingEndDate
    ?? lead?.crm?.leasingEndDate
    ?? fromContract
    ?? null;
  if (!raw) return null;
  if (/^\d{4}-\d{2}/.test(String(raw))) return String(raw);
  const match = String(raw).match(/(januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember)\s*(\d{4})?/i);
  if (!match) return null;
  const month = MONTH_MAP[match[1].toLowerCase()];
  const year = match[2] ? Number(match[2]) : new Date().getFullYear();
  const d = new Date(year, month, 1);
  return d.toISOString();
}

/**
 * Passende Reminder-Regel aus Signalen wählen (höchste Priorität = niedrigste Zahl).
 */
export function matchJourneyReminderRule(signals = {}) {
  if (!signals?.lead || signals.lead.status === 'verloren') return null;

  const matches = JOURNEY_REMINDER_RULES
    .filter((rule) => rule.matches(signals))
    .sort((a, b) => a.priority - b.priority);

  return matches[0] ?? null;
}

export function buildReminderFromRule(rule, signals = {}) {
  if (!rule) return null;
  const dueAt = rule.dueAt(signals);
  return {
    ruleId: rule.id,
    nextStepId: rule.nextStepId,
    nextStepLabel: rule.nextStepLabel,
    reason: rule.reason,
    dueAt,
    priority: rule.priority,
  };
}
