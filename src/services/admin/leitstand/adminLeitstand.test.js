import assert from 'node:assert/strict';
import { computeTodayKpis } from './adminTodayKpis.js';
import { buildAdminTaskQueue, groupTasksByPriority, TASK_PRIORITY } from './adminTaskQueue.js';
import { buildAdminTimeline } from './adminActivityFeed.js';
import { listReleases, publishReleaseToDealers } from './adminReleaseCenter.js';
import { listMailOutbox, MAIL_FROM } from './mailOutboxService.js';
import { buildSystemHealthModel } from './adminSystemHealth.js';
import {
  buildLeitstandCoreStatus,
  collectCleverWarnings,
  readClientFeatureFlags,
} from './adminLeitstandCoreStatus.js';

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

// Feature flags (kein Secret)
const flagsOff = readClientFeatureFlags({
  VITE_CLEVER_MAGIC_MESSAGE_ENABLED: 'false',
  VITE_CLEVER_CONTRACT_OCR: 'false',
});
assert.equal(flagsOff.magicMessage, false);
assert.equal(flagsOff.contractOcr, false);

const flagsOn = readClientFeatureFlags({
  VITE_CLEVER_MAGIC_MESSAGE_ENABLED: 'true',
  VITE_CLEVER_CONTRACT_OCR: 'true',
  VITE_CLEVER_CONTRACT_OCR_ENGINE: 'tesseract',
});
assert.equal(flagsOn.magicMessage, true);
assert.equal(flagsOn.contractOcr, true);
assert.equal(flagsOn.ocrEngine, 'tesseract');
console.log('Feature-Flags – OK');

// Kernstatus: Magic-Fallback erkennbar
const coreFallback = buildLeitstandCoreStatus({
  clientFlags: flagsOn,
  magicHealth: {
    status: 'ok',
    detail: '12 ms',
    flags: {
      magicMessage: true,
      sellerCopilot: true,
      sellerOpenAiInterpret: false,
      lexiconAi: false,
      openaiConfigured: false,
      contractOcr: true,
    },
  },
  mailOutbox: [{ id: 'm1', status: 'failed', subject: 'X', to: 'a@b.de' }],
  importMetrics: { pending: 1, lastUpdate: new Date().toISOString() },
  cleverWarnings: [{
    id: 'cw1',
    kind: 'ocr',
    title: 'OCR-/Dokument-Fehler',
    detail: 'ocr_failed',
    severity: 'urgent',
    createdAt: new Date().toISOString(),
  }],
});
assert.equal(coreFallback.signals.find((s) => s.id === 'magic')?.status, 'warn');
assert.match(coreFallback.signals.find((s) => s.id === 'magic')?.detail ?? '', /Fallback/i);
assert.equal(coreFallback.signals.find((s) => s.id === 'mail')?.status, 'error');
assert.equal(coreFallback.signals.find((s) => s.id === 'prices')?.status, 'warn');
assert.ok(coreFallback.warnings.length >= 1);
assert.ok(coreFallback.flagItems.some((i) => i.id === 'flag-openai' && i.status === 'warn'));
console.log('Leitstand-Kern – OK');

const warnings = collectCleverWarnings({
  activityFeed: [
    { id: 'a', action: 'OCR fehlgeschlagen', detail: 'scan', severity: 'urgent', createdAt: new Date().toISOString() },
  ],
});
assert.ok(warnings.some((w) => /OCR/i.test(w.title)));
console.log('Clever-Warnungen – OK');

// System health inkl. Flags-Sektion
const health = buildSystemHealthModel({
  mailOutbox: listMailOutbox(),
  importMetrics: {},
  magicHealth: coreFallback.magicHealth,
  clientFlags: flagsOn,
  cleverWarnings: coreFallback.warnings,
});
assert.ok(health.sections.length >= 5);
assert.ok(health.sections.some((s) => s.id === 'flags'));
assert.ok(health.core?.signals?.length >= 4);
console.log('System-Health – OK');

console.log('\nAdmin-Leitstand-Tests bestanden.');
