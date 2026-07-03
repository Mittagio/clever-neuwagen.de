process.env.NODE_ENV = 'test';
process.env.MAIL_TRANSPORT = 'mock';

import assert from 'node:assert/strict';
import { resetMailOutboxForTests, setMailOutboxEntries } from './mailOutboxStore.js';
import { resetUnifiedOutboxForTests, OUTBOX_SOURCE } from './mailOutboxResolver.js';
import { resetOutboxActivitySyncForTests } from './mailOutboxActivitySync.js';
import { configureMailOutboxApi } from './mailOutboxApi.js';
import {
  loadMailOutboxForAdmin,
  retryMail,
  listMailOutbox,
  configureMailOutboxClient,
} from './mailOutboxService.js';
import { buildAdminTaskQueue } from '../admin/leitstand/adminTaskQueue.js';

// Browser-Simulation für Server-Präferenz
globalThis.window = globalThis;

const serverOutbox = [
  {
    id: 'srv-mail-1',
    to: 'kunde@test.de',
    subject: 'Server-Mail',
    templateId: 'customer-login-code',
    templateName: 'Login-Code Kunde',
    status: 'sent',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'srv-mail-fail',
    to: 'fail@test.de',
    subject: 'Fehlgeschlagen',
    templateId: 'customer-offer-link',
    templateName: 'Angebotslink',
    status: 'failed',
    error: 'SMTP Timeout',
    createdAt: new Date().toISOString(),
  },
];

let lastRetryId = null;

function createMockFetch(mode = 'server') {
  return async (url, options = {}) => {
    if (url.includes('/mail/outbox') && !url.includes('/retry')) {
      if (mode === 'unreachable') throw new Error('network');
      return {
        ok: true,
        json: async () => ({ ok: true, items: serverOutbox }),
      };
    }
    if (url.includes('/retry')) {
      lastRetryId = url.split('/').at(-2);
      const entry = {
        ...serverOutbox.find((m) => m.id === lastRetryId),
        status: 'sent',
        sentAt: new Date().toISOString(),
        error: null,
      };
      return { ok: true, json: async () => ({ ok: true, entry }) };
    }
    if (url.includes('/mail/send')) {
      return { ok: true, json: async () => ({ ok: true, entry: serverOutbox[0] }) };
    }
    return { ok: false, json: async () => ({ ok: false }) };
  };
}

function resetAll() {
  resetUnifiedOutboxForTests();
  resetOutboxActivitySyncForTests();
  resetMailOutboxForTests([
    {
      id: 'demo-local-1',
      to: 'demo@test.de',
      subject: 'Demo lokal',
      status: 'queued',
      createdAt: new Date().toISOString(),
    },
  ]);
  lastRetryId = null;
}

resetAll();
configureMailOutboxClient({ fetch: createMockFetch('server') });

// 1. Admin lädt Server-Outbox
const serverSnapshot = await loadMailOutboxForAdmin();
assert.equal(serverSnapshot.source, OUTBOX_SOURCE.SERVER);
assert.equal(serverSnapshot.items.length, 2);
assert.equal(listMailOutbox()[0].id, 'srv-mail-1');
console.log('Admin lädt Server-Outbox – OK');

// 2. Retry über Server
const retryResult = await retryMail('srv-mail-fail');
assert.equal(retryResult.ok, true);
assert.equal(lastRetryId, 'srv-mail-fail');
console.log('Retry über Server – OK');

// 3. Server nicht erreichbar → Demo-Fallback
resetAll();
configureMailOutboxClient({ fetch: createMockFetch('unreachable') });
const demoSnapshot = await loadMailOutboxForAdmin();
assert.equal(demoSnapshot.source, OUTBOX_SOURCE.DEMO);
assert.equal(demoSnapshot.isDemo, true);
assert.equal(demoSnapshot.items[0].id, 'demo-local-1');
console.log('Server nicht erreichbar → Demo-Fallback – OK');

// 4. Fehlgeschlagene Server-Mail → roter Admin-Task
resetAll();
configureMailOutboxClient({ fetch: createMockFetch('server') });
setMailOutboxEntries([]);
await loadMailOutboxForAdmin();
const tasks = buildAdminTaskQueue({});
const mailTask = tasks.find((t) => t.id === 'mail-srv-mail-fail');
assert.ok(mailTask);
assert.equal(mailTask.priority, 'urgent');
console.log('Fehlgeschlagene Server-Mail → Admin-Task – OK');

delete globalThis.window;

console.log('\nMail-Outbox-Unified-Tests bestanden.');
