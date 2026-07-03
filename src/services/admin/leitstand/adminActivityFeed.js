import { getAdminLeitstandState } from './adminLeitstandStore.js';

/**
 * Live-Timeline + Aktivitätsfeed für Leitstand.
 */
export function buildAdminTimeline({
  activityFeed = [],
  dealerActivities = [],
  auditLog = [],
  limit = 20,
} = {}) {
  const items = [];

  for (const entry of activityFeed) {
    items.push({
      id: entry.id,
      time: entry.createdAt,
      actor: entry.actor,
      text: entry.action,
      detail: entry.detail,
      severity: entry.severity ?? 'info',
      source: 'feed',
    });
  }

  for (const act of dealerActivities) {
    items.push({
      id: `dealer-act-${act.id}`,
      time: act.createdAt,
      actor: act.actor ?? 'Händler',
      text: act.summary ?? act.action,
      detail: act.dealerId,
      severity: 'info',
      source: 'dealer',
    });
  }

  for (const log of auditLog) {
    items.push({
      id: `audit-${log.id}`,
      time: log.createdAt,
      actor: log.actor,
      text: log.action,
      detail: log.target,
      severity: 'info',
      source: 'audit',
    });
  }

  return items
    .filter((i) => i.time)
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, limit);
}

export function buildActivityFeedGrouped(activityFeed = []) {
  const feed = activityFeed.length
    ? activityFeed
    : getAdminLeitstandState().activityFeed;

  return feed.map((entry) => ({
    id: entry.id,
    actor: entry.actor,
    action: entry.action,
    detail: entry.detail,
    createdAt: entry.createdAt,
    severity: entry.severity ?? 'info',
  }));
}
