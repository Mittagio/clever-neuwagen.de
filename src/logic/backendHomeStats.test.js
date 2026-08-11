import assert from 'node:assert/strict';
import {
  buildBackendHomeEingangStats,
  buildBackendHomeWorkStats,
  formatCleverEingangHomeStats,
} from './backendHomeStats.js';

assert.deepEqual(
  formatCleverEingangHomeStats({ openCount: 0, summary: {} }),
  {
    openCount: 0,
    needsDecision: 0,
    review: 0,
    duplicates: 0,
    ready: 0,
    openLabel: '0 offen',
    needsYouLabel: '0 brauchen dich',
    decisionLabel: '0 brauchen dich',
    breakdown: [
      { id: 'review', label: 'prüfen', count: 0, to: '/backend/neue-anfragen?status=review' },
      { id: 'duplicate', label: 'Dubletten', count: 0, to: '/backend/neue-anfragen?status=duplicate' },
      { id: 'ready', label: 'bereit', count: 0, to: '/backend/neue-anfragen?status=ready' },
    ],
  },
);

assert.equal(
  formatCleverEingangHomeStats({ openCount: 1, summary: { review: 1, duplicates: 0 } }).needsYouLabel,
  '1 braucht dich',
);

const formatted = formatCleverEingangHomeStats({
  openCount: 38,
  summary: { review: 3, duplicates: 2, ready: 10 },
});
assert.equal(formatted.needsYouLabel, '5 brauchen dich');
assert.equal(formatted.breakdown[0].count, 3);
assert.equal(formatted.breakdown[1].count, 2);
assert.equal(formatted.breakdown[2].count, 10);

const emptyWork = buildBackendHomeWorkStats([], [], []);
assert.equal(emptyWork.offers, 0);
assert.equal(emptyWork.dueToday, 0);
assert.equal(emptyWork.followUps, 0);
assert.equal(emptyWork.appointmentsToday, 0);
assert.equal(emptyWork.secondaryLabel, null);

const now = new Date('2026-08-11T10:00:00.000Z');
const leadWithAppt = {
  id: 'lead-appt',
  status: 'inBearbeitung',
  contact: { name: 'Termin Kunde' },
  crm: {
    cleverAppointment: { startAt: '2026-08-11T14:00:00.000Z' },
  },
};
const work = buildBackendHomeWorkStats([leadWithAppt], [], [], { now });
assert.equal(work.appointmentsToday, 1);
assert.match(work.appointmentsLabel, /1 Termin heute/);
assert.equal(work.links.dueToday, '/backend/verkaufschancen?filter=followup');
assert.equal(work.links.offers, '/backend/angebote');

const backlogLead = {
  id: 'lead-backlog',
  status: 'inBearbeitung',
  contact: { name: 'Backlog' },
  followUpAt: '2026-07-01T10:00:00.000Z',
};
const backlogWork = buildBackendHomeWorkStats(
  [backlogLead],
  [],
  [{ leadId: 'lead-backlog' }],
  { now },
);
assert.ok(backlogWork.dueToday >= 1);
assert.ok(
  backlogWork.secondaryLabel == null
  || /weitere Wiedervorlagen|Aufmerksamkeit/.test(backlogWork.secondaryLabel),
);

const eingang = buildBackendHomeEingangStats([]);
assert.equal(eingang.openCount, 0);
assert.equal(eingang.needsDecision, 0);
assert.ok(Array.isArray(eingang.breakdown));

console.log('backendHomeStats.test.js: ok');
