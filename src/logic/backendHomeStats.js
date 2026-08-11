/**
 * Dashboard-Home: kompakte Stats für Eingang / Meine Arbeit.
 */
import { buildCleverEingangDashboardCounts } from '../services/crm/cleverEingangItems.js';
import { getTodayOverview } from '../services/cleverSeller/getTodayOverview.js';
import { computeBackendTodayStats } from './backendTodayStats.js';
import { getDueTodayLeadIds, matchesFollowUpView } from './backendKpiNavigation.js';

const EINGANG_STATUS_ROUTES = {
  review: '/backend/neue-anfragen?status=review',
  duplicate: '/backend/neue-anfragen?status=duplicate',
  ready: '/backend/neue-anfragen?status=ready',
};

/**
 * @param {{ openCount?: number, unreadCount?: number, summary?: object }} counts
 */
export function formatCleverEingangHomeStats(counts = {}) {
  const openCount = Number(counts.openCount) || 0;
  const review = Number(counts.summary?.review) || 0;
  const duplicates = Number(counts.summary?.duplicates) || 0;
  const ready = Number(counts.summary?.ready) || 0;
  const needsDecision = review + duplicates;
  return {
    openCount,
    needsDecision,
    review,
    duplicates,
    ready,
    openLabel: `${openCount} offen`,
    needsYouLabel: needsDecision === 1
      ? '1 braucht dich'
      : `${needsDecision} brauchen dich`,
    /** @deprecated Alias – Prefer needsYouLabel */
    decisionLabel: needsDecision === 1
      ? '1 braucht dich'
      : `${needsDecision} brauchen dich`,
    breakdown: [
      {
        id: 'review',
        label: 'prüfen',
        count: review,
        to: EINGANG_STATUS_ROUTES.review,
      },
      {
        id: 'duplicate',
        label: 'Dubletten',
        count: duplicates,
        to: EINGANG_STATUS_ROUTES.duplicate,
      },
      {
        id: 'ready',
        label: 'bereit',
        count: ready,
        to: EINGANG_STATUS_ROUTES.ready,
      },
    ],
  };
}

/**
 * @param {object[]} [leads]
 * @param {object[]} [offers]
 * @param {object[]} [dueToday]
 * @param {{ now?: Date }} [options]
 */
export function buildBackendHomeWorkStats(leads = [], offers = [], dueToday = [], options = {}) {
  const stats = computeBackendTodayStats(leads, offers);
  const dueTodayLeadIds = getDueTodayLeadIds(dueToday);
  const followUpsTotal = leads.filter((lead) => matchesFollowUpView(lead, dueTodayLeadIds)).length;
  const overview = getTodayOverview(leads, { now: options.now, maxItems: 80 });
  const overviewItems = overview.items || [];
  const appointmentsToday = overviewItems.filter((item) => item.hasAppointmentToday).length;

  const dueLeadIds = new Set(
    overviewItems
      .filter((item) => item.dueToday || item.overdue)
      .map((item) => item.leadId)
      .filter(Boolean),
  );
  for (const id of dueTodayLeadIds) dueLeadIds.add(id);
  const dueTodayCount = dueLeadIds.size;

  const moreFollowUps = Math.max(0, followUpsTotal - dueTodayCount);
  const offersCount = stats.openOffers;

  return {
    offers: offersCount,
    dueToday: dueTodayCount,
    appointmentsToday,
    followUpsTotal,
    moreFollowUps,
    /** @deprecated Prefer dueToday – kein aufgeblasener Wiedervorlagen-Hero */
    followUps: dueTodayCount,
    offersLabel: `${offersCount} Angebote`,
    dueTodayLabel: dueTodayCount === 1
      ? '1 heute fällig'
      : `${dueTodayCount} heute fällig`,
    appointmentsLabel: appointmentsToday === 1
      ? '1 Termin heute'
      : `${appointmentsToday} Termine heute`,
    /** @deprecated */
    followUpsLabel: dueTodayCount === 1
      ? '1 heute fällig'
      : `${dueTodayCount} heute fällig`,
    secondaryLabel: moreFollowUps > 0
      ? `${moreFollowUps} weitere Wiedervorlagen`
      : (dueTodayCount > 0
        ? (dueTodayCount === 1
          ? '1 braucht heute deine Aufmerksamkeit'
          : `${dueTodayCount} brauchen heute deine Aufmerksamkeit`)
        : null),
    links: {
      offers: '/backend/angebote',
      dueToday: '/backend/verkaufschancen?filter=followup',
      appointments: null,
    },
  };
}

/**
 * @param {object[]} [leads]
 */
export function buildBackendHomeEingangStats(leads = []) {
  const counts = buildCleverEingangDashboardCounts(leads);
  return {
    ...counts,
    ...formatCleverEingangHomeStats(counts),
  };
}
