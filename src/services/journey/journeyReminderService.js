/**
 * Journey-Wiedervorlagen – Erkennung, Anwendung, Dashboard.
 */
import { evaluateJourney } from './journeyEngine.js';
import {
  buildReminderFromRule,
  matchJourneyReminderRule,
} from './journeyReminderRules.js';

const MS_PER_DAY = 86400000;

function isSameCalendarDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate();
}

function isToday(iso) {
  return isSameCalendarDay(iso, new Date());
}

function isTomorrow(iso) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return isSameCalendarDay(iso, d);
}

function isDue(iso) {
  if (!iso) return false;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return false;
  const endOfDueDay = new Date(due);
  endOfDueDay.setHours(23, 59, 59, 999);
  return Date.now() >= due.getTime();
}

export function formatReminderDueLabel(dueAt) {
  if (!dueAt) return 'offen';
  if (isToday(dueAt)) return 'heute';
  if (isTomorrow(dueAt)) return 'morgen';
  return new Date(dueAt).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatReminderDisplay(reminder) {
  if (!reminder?.dueAt) return null;
  return `Wiedervorlage: ${formatReminderDueLabel(reminder.dueAt)} · Grund: ${reminder.reason}`;
}

function wasReminderLoggedToday(lead, ruleId) {
  const history = lead?.history ?? [];
  return history.some((entry) => (
    entry?.meta?.journeyReminderRuleId === ruleId
    && isSameCalendarDay(entry.at, new Date())
  ));
}

function wasReminderAppliedToday(lead, ruleId) {
  const crm = lead?.crm ?? {};
  if (crm.journeyReminderRuleId !== ruleId) return false;
  if (!crm.journeyReminderAppliedAt) return false;
  return isSameCalendarDay(crm.journeyReminderAppliedAt, new Date());
}

export function isManualFollowUp(lead = {}) {
  return lead?.crm?.followUpSource === 'manual';
}

export function isReminderBlockedByDoneAction(lead = {}, journey = null) {
  const doneId = lead?.crm?.cleverLastDoneActionId;
  const actionId = journey?.recommendation?.actionId ?? journey?.view?.actionId;
  if (!doneId || !actionId) return false;
  return doneId === actionId;
}

export function canApplyJourneyReminder(lead = {}, reminder = null) {
  if (!lead?.id || !reminder?.ruleId) {
    return { allowed: false, reason: 'no_reminder' };
  }
  if (lead.status === 'verloren' || lead.status === 'ausgeliefert') {
    return { allowed: false, reason: 'terminal_status' };
  }
  if (isManualFollowUp(lead)) {
    return { allowed: false, reason: 'manual_follow_up' };
  }
  if (wasReminderAppliedToday(lead, reminder.ruleId)) {
    return { allowed: false, reason: 'already_applied_today' };
  }
  if (wasReminderLoggedToday(lead, reminder.ruleId)) {
    return { allowed: false, reason: 'already_logged_today' };
  }
  if (!isDue(reminder.dueAt)) {
    return { allowed: false, reason: 'not_due_yet' };
  }
  return { allowed: true, reason: null };
}

/**
 * Erkennt fällige Wiedervorlage aus Journey-Signalen.
 */
export function evaluateJourneyReminder(lead = null, options = {}) {
  if (!lead?.id) return null;

  const journey = options.journey ?? evaluateJourney(lead, options);
  const signals = journey?.signals;
  if (!signals) return null;

  const rule = matchJourneyReminderRule(signals);
  const reminder = buildReminderFromRule(rule, signals);
  if (!reminder) {
    return {
      leadId: lead.id,
      active: false,
      journey,
    };
  }

  const dueToday = isToday(reminder.dueAt);
  const dueNow = isDue(reminder.dueAt);
  const applyCheck = canApplyJourneyReminder(lead, reminder);
  const blockedByDone = isReminderBlockedByDoneAction(lead, journey);

  return {
    leadId: lead.id,
    active: true,
    ...reminder,
    dueToday,
    dueNow,
    shouldApply: applyCheck.allowed && !blockedByDone,
    applyBlockedReason: applyCheck.reason,
    blockedByDone,
    displayLine: formatReminderDisplay(reminder),
    journey,
    fingerprint: `${reminder.ruleId}:${formatReminderDueLabel(reminder.dueAt)}`,
  };
}

/**
 * Wendet Wiedervorlage auf vorhandene CRM-Felder an (kein direktes Lead-Mutieren).
 */
export function applyJourneyReminder(lead = null, reminderEval = null, options = {}) {
  const evaluation = reminderEval ?? evaluateJourneyReminder(lead, options);
  if (!evaluation?.active) {
    return { applied: false, reason: 'no_active_reminder' };
  }

  const force = options.force === true;
  const applyCheck = canApplyJourneyReminder(lead, evaluation);
  if (!force && !evaluation.shouldApply && !applyCheck.allowed) {
    return { applied: false, reason: evaluation.applyBlockedReason ?? applyCheck.reason };
  }
  if (!force && isReminderBlockedByDoneAction(lead, evaluation.journey)) {
    return { applied: false, reason: 'done_action' };
  }

  const nowIso = new Date().toISOString();
  const crmPatch = {
    followUpAt: evaluation.dueAt,
    nextStepId: evaluation.nextStepId,
    nextStepLabel: evaluation.nextStepLabel,
    followUpSource: 'journey',
    journeyReminderRuleId: evaluation.ruleId,
    journeyReminderReason: evaluation.reason,
    journeyReminderAppliedAt: nowIso,
  };

  const historyEntry = {
    text: `Clever Wiedervorlage: ${evaluation.nextStepLabel} (${formatReminderDueLabel(evaluation.dueAt)}) · ${evaluation.reason}`,
    type: 'followup',
    meta: {
      journeyReminder: true,
      journeyReminderRuleId: evaluation.ruleId,
      journeyReminderReason: evaluation.reason,
      followUpAt: evaluation.dueAt,
    },
  };

  return {
    applied: true,
    crmPatch,
    historyEntry,
    evaluation,
  };
}

function starsFromClosure(closureChance) {
  if (closureChance >= 88) return 5;
  if (closureChance >= 72) return 4;
  if (closureChance >= 55) return 3;
  if (closureChance >= 38) return 2;
  return 1;
}

function starLabel(count) {
  return '⭐'.repeat(Math.max(1, Math.min(5, count)));
}

/**
 * Dashboard: Kunden mit fälligen Wiedervorlagen priorisieren.
 */
export function evaluateSellerReminders(leads = [], options = {}) {
  const { maxItems = 12 } = options;
  const items = [];

  for (const lead of leads) {
    if (!lead?.id || lead.status === 'verloren') continue;

    const journey = evaluateJourney(lead, options);
    const reminder = evaluateJourneyReminder(lead, { ...options, journey });
    const view = journey?.view;
    if (!view && !reminder?.active) continue;

    const closureChance = journey?.scores?.abschlusschance ?? view?.closureChance ?? 0;
    const dueToday = reminder?.dueToday
      || (reminder?.dueNow && isToday(reminder?.dueAt))
      || isToday(lead?.crm?.followUpAt);

    items.push({
      leadId: lead.id,
      customerName: lead.contact?.name ?? 'Kunde',
      headline: view?.headline ?? reminder?.nextStepLabel ?? 'Wiedervorlage',
      subline: view?.subline ?? reminder?.reason ?? '',
      closureChance,
      stars: view?.stars ?? starsFromClosure(closureChance),
      starLabel: view?.starLabel ?? starLabel(starsFromClosure(closureChance)),
      actionId: view?.actionId,
      whySummary: view?.whySummary ?? reminder?.reason ?? '',
      dueToday,
      dueTodayBadge: dueToday ? 'fällig heute' : null,
      reminder,
      journey,
      sortBoost: dueToday ? 1000 : 0,
    });
  }

  return items
    .sort((a, b) => {
      const boostDiff = b.sortBoost - a.sortBoost;
      if (boostDiff !== 0) return boostDiff;
      if (b.closureChance !== a.closureChance) return b.closureChance - a.closureChance;
      return (a.reminder?.priority ?? 99) - (b.reminder?.priority ?? 99);
    })
    .slice(0, maxItems);
}

export {
  isToday,
  isDue,
};
