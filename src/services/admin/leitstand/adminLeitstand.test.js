import assert from 'node:assert/strict';
import { computeTodayKpis } from './adminTodayKpis.js';
import { buildAdminTaskQueue, groupTasksByPriority, TASK_PRIORITY } from './adminTaskQueue.js';
import { buildAdminTimeline } from './adminActivityFeed.js';
import { listReleases, publishReleaseToDealers } from './adminReleaseCenter.js';
import { listMailOutbox, MAIL_FROM } from './mailOutboxService.js';
import { buildSystemHealthModel } from './adminSystemHealth.js';

// KPIs
const kpis = computeTodayKpis({
  dealers: [{ status: 'active' }, { status: 'active' }, { status: 'draft' }],
  leads: [{ createdAt: new Date().toISOString() }],
  offers: [],
  tasks: [{ priority: 'urgent' }],
});
assert.ok(kpis.activeDealers >= 2);
assert.ok(kpis.leadsToday >= 1);
console.log('KPI Heute – OK');

// Aufgaben
const tasks = buildAdminTaskQueue({
  approvals: [{ id: 'a1', status: 'pending', type: 'dealer', title: 'Test', subtitle: 'x' }],
  importMetrics: { pending: 1 },
});
assert.ok(tasks.length >= 2);
const grouped = groupTasksByPriority(tasks);
assert.ok(grouped.urgent.length >= 1);
console.log('Aufgaben-Queue – OK');

// Timeline
const timeline = buildAdminTimeline({
  activityFeed: [{ id: '1', actor: 'Mike', action: 'Test', createdAt: new Date().toISOString() }],
});
assert.equal(timeline.length, 1);
console.log('Timeline – OK');

// Release
const releases = listReleases();
assert.ok(releases.length >= 1);
const published = publishReleaseToDealers('rel-ev4-2026', 'Test');
assert.equal(published?.status, 'published');
console.log('Release-Center – OK');

// Mail
assert.equal(MAIL_FROM.email, 'info@clever-neuwagen.de');
assert.ok(listMailOutbox().length >= 1);
console.log('Mail-Outbox – OK');

// System health
const health = buildSystemHealthModel({ mailOutbox: listMailOutbox(), importMetrics: {} });
assert.ok(health.sections.length >= 4);
console.log('System-Health – OK');

console.log('\nAdmin-Leitstand-Tests bestanden.');
