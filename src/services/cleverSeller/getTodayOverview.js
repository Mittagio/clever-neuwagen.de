/**
 * getTodayOverview – operative Tagesübersicht aus bestehenden CRM-/Journey-Daten.
 * Keine neuen Scores, keine erfundenen Kaufwahrscheinlichkeiten.
 */
import {
  buildSellerTodayWorklist,
  evaluateSellerReminders,
} from '../journey/journeyReminderService.js';
import { buildGoldenMoment } from '../journey/goldenMoment.js';
import { listCustomerVehicleTracks } from '../crm/vehicleTrack.js';

function customerName(lead = {}) {
  return lead?.contact?.name || lead?.name || 'Kunde';
}

/**
 * @param {object[]} leads
 * @param {{ now?: Date, maxItems?: number }} [options]
 */
export function getTodayOverview(leads = [], options = {}) {
  const maxItems = options.maxItems ?? 12;
  const now = options.now ?? new Date();
  const byLead = new Map();

  const reminders = evaluateSellerReminders(leads, { ...options, maxItems: 40 });
  for (const item of reminders) {
    const reasons = [];
    if (item.overdue) reasons.push('Überfällige Wiedervorlage');
    if (item.dueToday && !item.overdue) reasons.push('Heute fällig');
    if (item.whySummary) reasons.push(String(item.whySummary));
    else if (item.subline) reasons.push(String(item.subline));
    if (item.reminder?.reason && !reasons.includes(item.reminder.reason)) {
      reasons.push(String(item.reminder.reason));
    }

    byLead.set(item.leadId, {
      leadId: item.leadId,
      customerName: item.customerName,
      headline: item.headline || 'Offener Vorgang',
      detail: item.subline || item.whySummary || null,
      reasons: reasons.filter(Boolean),
      overdue: Boolean(item.overdue),
      dueToday: Boolean(item.dueToday),
      hasAppointmentToday: false,
      hasCustomerReaction: false,
      openSellerAction: Boolean(item.actionId || item.reminder?.active),
      actionId: item.actionId ?? null,
      sortRank: item.overdue ? 0 : (item.dueToday ? 1 : 5),
    });
  }

  const worklist = buildSellerTodayWorklist(leads, { now });
  for (const item of worklist) {
    const existing = byLead.get(item.leadId);
    const reasons = [];
    if (item.overdue) reasons.push('Überfällige Wiedervorlage');
    if (item.dueToday) reasons.push('Heute fällig');
    if (item.reason) reasons.push(String(item.reason));
    if (item.nextStepLabel) reasons.push(String(item.nextStepLabel));

    if (!existing) {
      byLead.set(item.leadId, {
        leadId: item.leadId,
        customerName: item.customerName,
        headline: item.nextStepLabel || 'Nachfassen',
        detail: item.reason || null,
        reasons: reasons.filter(Boolean),
        overdue: Boolean(item.overdue),
        dueToday: Boolean(item.dueToday),
        hasAppointmentToday: false,
        hasCustomerReaction: false,
        openSellerAction: true,
        actionId: item.nextStepId ?? null,
        sortRank: item.overdue ? 0 : 1,
      });
    } else {
      existing.reasons = [...new Set([...existing.reasons, ...reasons.filter(Boolean)])];
      existing.overdue = existing.overdue || item.overdue;
      existing.dueToday = existing.dueToday || item.dueToday;
      existing.openSellerAction = true;
      existing.sortRank = Math.min(existing.sortRank, item.overdue ? 0 : 1);
    }
  }

  for (const lead of leads) {
    if (!lead?.id) continue;
    if (lead.status === 'verloren' || lead.status === 'ausgeliefert') continue;

    let golden = null;
    try {
      golden = buildGoldenMoment(lead);
    } catch {
      golden = null;
    }
    if (golden?.headline) {
      const existing = byLead.get(lead.id) || {
        leadId: lead.id,
        customerName: customerName(lead),
        headline: golden.headline,
        detail: golden.subline || golden.reason || null,
        reasons: [],
        overdue: false,
        dueToday: false,
        hasAppointmentToday: false,
        hasCustomerReaction: false,
        openSellerAction: true,
        actionId: golden.recommendedAction || null,
        sortRank: 4,
      };
      const reasonBits = [
        golden.reason,
        golden.subline,
        ...(Array.isArray(golden.reasons) ? golden.reasons : []),
      ].filter(Boolean).map(String);
      existing.reasons = [...new Set([...existing.reasons, ...reasonBits])];
      if (!byLead.has(lead.id)) {
        existing.headline = golden.headline;
        existing.detail = golden.subline || golden.reason || existing.detail;
      }
      existing.openSellerAction = true;
      existing.sortRank = Math.min(existing.sortRank, 4);
      byLead.set(lead.id, existing);
    }

    const tracks = listCustomerVehicleTracks(lead) || [];
    const favorite = tracks.find((t) => /favorit|favorite|interested/i.test(t.status || ''));
    const reaction = lead?.crm?.customerOfferPortfolio?.items?.some((i) => (
      i?.customerReaction?.status && i.customerReaction.status !== 'none'
    ));
    if (reaction || favorite) {
      const existing = byLead.get(lead.id);
      if (existing) {
        existing.hasCustomerReaction = true;
        if (favorite?.modelLabel) {
          existing.reasons = [...new Set([
            ...existing.reasons,
            `Kundenreaktion / Spur: ${favorite.modelLabel}`,
          ])];
        }
        existing.sortRank = Math.min(existing.sortRank, existing.overdue ? 0 : 3);
      }
    }

    const appt = lead?.crm?.cleverAppointment || lead?.crm?.nextAppointment;
    const apptStart = appt?.startAt || appt?.when;
    if (apptStart) {
      const d = new Date(apptStart);
      if (!Number.isNaN(d.getTime())
        && d.toDateString() === now.toDateString()) {
        const existing = byLead.get(lead.id) || {
          leadId: lead.id,
          customerName: customerName(lead),
          headline: 'Termin heute',
          detail: null,
          reasons: [],
          overdue: false,
          dueToday: true,
          hasAppointmentToday: true,
          hasCustomerReaction: false,
          openSellerAction: true,
          actionId: 'appointment',
          sortRank: 2,
        };
        const timeLabel = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        existing.hasAppointmentToday = true;
        existing.dueToday = true;
        existing.headline = existing.headline || `Termin heute um ${timeLabel} Uhr`;
        existing.detail = existing.detail || `Termin um ${timeLabel} Uhr`;
        existing.reasons = [...new Set([
          ...existing.reasons,
          `Bestätigter / geplanter Termin heute um ${timeLabel} Uhr`,
        ])];
        existing.sortRank = Math.min(existing.sortRank, 2);
        byLead.set(lead.id, existing);
      }
    }
  }

  const items = [...byLead.values()]
    .map((item) => ({
      ...item,
      reasons: (item.reasons || []).filter(Boolean).slice(0, 4),
    }))
    .filter((item) => item.reasons.length || item.overdue || item.dueToday || item.hasAppointmentToday)
    .sort((a, b) => {
      if (a.sortRank !== b.sortRank) return a.sortRank - b.sortRank;
      return String(a.customerName).localeCompare(String(b.customerName), 'de');
    })
    .slice(0, maxItems)
    .map(({ sortRank, ...rest }) => rest);

  return {
    ok: true,
    generatedAt: now.toISOString(),
    itemCount: items.length,
    items,
    source: 'existing_crm_journey_reminders',
  };
}
