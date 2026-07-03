process.env.NODE_ENV = 'test';
process.env.MAIL_TRANSPORT = 'mock';

import assert from 'node:assert/strict';
import {
  assertAllCoreTemplatesPresent,
  getMailTemplate,
  MAIL_TEMPLATE_IDS,
} from './mailTemplateRegistry.js';
import { renderMailTemplate, interpolateMailText } from './mailRenderer.js';
import { resetMailOutboxForTests } from './mailOutboxStore.js';
import { registerMailActivityHook } from './mailActivityBridge.js';
import {
  sendTemplatedMail,
  sendViaOutbox,
  retryMail,
  listMailOutbox,
  MAIL_STATUS,
} from './mailOutboxService.js';
import { MAIL_FROM } from './mailConfig.js';
import { buildAdminTaskQueue } from '../admin/leitstand/adminTaskQueue.js';

const activityLog = [];
registerMailActivityHook((entry) => activityLog.push(entry));
resetMailOutboxForTests([]);

// 1. Templates vorhanden
assert.equal(assertAllCoreTemplatesPresent(), true);
assert.ok(getMailTemplate(MAIL_TEMPLATE_IDS.CUSTOMER_LOGIN_CODE));
assert.ok(getMailTemplate(MAIL_TEMPLATE_IDS.DEALER_APPROVED));
console.log('Templates vorhanden – OK');

// 2. Variablen werden ersetzt
const rendered = renderMailTemplate(MAIL_TEMPLATE_IDS.CUSTOMER_LOGIN_CODE, {
  customerName: 'Max Mustermann',
  code: '123456',
  validMinutes: 10,
  portalUrl: 'https://clever-neuwagen.de/portal',
  dealerName: 'Autohaus Müller',
});
assert.ok(rendered.subject.includes('Zugangscode'));
assert.ok(rendered.body.includes('Max Mustermann'));
assert.ok(rendered.body.includes('123456'));
assert.equal(interpolateMailText('Hallo {{name}}', { name: '' }), 'Hallo –');
console.log('Variablen-Ersetzung – OK');

// 3. Mail landet in Outbox
const sendResult = await sendTemplatedMail({
  templateId: MAIL_TEMPLATE_IDS.CUSTOMER_OFFER_LINK,
  to: 'kunde@test.de',
  variables: {
    customerName: 'Anna',
    dealerName: 'Trinkle',
    vehicleTitle: 'Kia EV3',
    offerUrl: 'https://clever-neuwagen.de/angebot/abc',
    rateLine: 'ab 299 €/Monat',
  },
});
assert.equal(sendResult.ok, true);
const outbox = listMailOutbox();
assert.equal(outbox.length, 1);
assert.equal(outbox[0].status, MAIL_STATUS.SENT);
assert.equal(outbox[0].to, 'kunde@test.de');
assert.equal(outbox[0].from, MAIL_FROM.email);
console.log('Outbox-Eintrag – OK');

// 4. Fehler erzeugt roten Task im Admin
resetMailOutboxForTests([]);
activityLog.length = 0;
const failResult = await sendViaOutbox({
  to: 'fail@test.de',
  subject: 'Test Fehler',
  body: 'Inhalt',
  templateId: MAIL_TEMPLATE_IDS.DEALER_LOGIN_CODE,
  templateName: 'Login-Code Händler',
  meta: { simulateFailure: true, failureReason: 'SMTP Timeout' },
});
assert.equal(failResult.ok, false);
assert.equal(listMailOutbox()[0].status, MAIL_STATUS.FAILED);
assert.equal(listMailOutbox()[0].error, 'SMTP Timeout');

const tasks = buildAdminTaskQueue({});
const mailTask = tasks.find((t) => t.id.startsWith('mail-'));
assert.ok(mailTask);
assert.equal(mailTask.priority, 'urgent');
assert.ok(mailTask.title.includes('nicht versendet'));
console.log('Fehler → Admin-Task – OK');

// 5. Activity-Feed bei Versand / Fehler
assert.ok(activityLog.some((a) => a.action === 'E-Mail fehlgeschlagen'));
assert.ok(activityLog.some((a) => a.severity === 'urgent'));

resetMailOutboxForTests([]);
activityLog.length = 0;
await sendTemplatedMail({
  templateId: MAIL_TEMPLATE_IDS.DEALER_ONBOARDING_CONFIRMED,
  to: 'haendler@test.de',
  variables: {
    contactName: 'Peter',
    dealerName: 'Autohaus X',
    statusLabel: 'In Prüfung',
  },
});
assert.ok(activityLog.some((a) => a.action === 'E-Mail versendet'));
console.log('Activity-Feed – OK');

// 6. Retry ändert Status
const failedId = listMailOutbox()[0].id;
resetMailOutboxForTests([{
  id: failedId,
  to: 'retry@test.de',
  from: MAIL_FROM.email,
  subject: 'Retry Test',
  body: 'Body',
  templateId: MAIL_TEMPLATE_IDS.CUSTOMER_INQUIRY_RECEIVED,
  templateName: 'Kundenanfrage eingegangen',
  status: MAIL_STATUS.FAILED,
  error: 'Vorheriger Fehler',
  createdAt: new Date().toISOString(),
  retryCount: 0,
}]);

const retryResult = await retryMail(failedId);
assert.equal(retryResult.ok, true);
const retried = listMailOutbox().find((m) => m.id === failedId);
assert.equal(retried.status, MAIL_STATUS.SENT);
assert.ok(retried.retryCount >= 1);
console.log('Retry – OK');

console.log('\nMail-Service-Tests bestanden.');
