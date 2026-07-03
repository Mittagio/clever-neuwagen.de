process.env.NODE_ENV = 'test';
process.env.MAIL_TRANSPORT = 'mock';

import assert from 'node:assert/strict';
import { resetMailOutboxForTests } from './mailOutboxStore.js';
import { registerMailActivityHook } from './mailActivityBridge.js';
import { listMailOutbox, retryMail, MAIL_TEMPLATE_IDS } from './mailOutboxService.js';
import {
  sendCustomerLoginCodeMail,
  sendCustomerOfferLinkMail,
  sendCustomerInquiryMails,
  applyOfferMailDelivery,
} from './mailFlowService.js';
import { buildAdminTaskQueue } from '../admin/leitstand/adminTaskQueue.js';

const activityLog = [];
registerMailActivityHook((entry) => activityLog.push(entry));
resetMailOutboxForTests([]);

const sampleOffer = {
  code: 'CN-TEST-001',
  customer: { name: 'Anna Test', email: 'anna@test.de' },
  dealer: { name: 'Autohaus Trinkle', contact: { name: 'Max' } },
  vehicle: { label: 'Kia EV3 Earth' },
  pricing: { rate: 299, paymentType: 'leasing' },
};

// 1. Login-Code erzeugt Mail
const loginResult = await sendCustomerLoginCodeMail({
  to: 'kunde@test.de',
  customerName: 'Tom',
  code: '654321',
  portalUrl: 'https://clever-neuwagen.de/angebot/auswahl/kunde',
  dealerName: 'Autohaus Trinkle',
});
assert.equal(loginResult.ok, true);
assert.equal(listMailOutbox().length, 1);
assert.equal(listMailOutbox()[0].templateId, MAIL_TEMPLATE_IDS.CUSTOMER_LOGIN_CODE);
console.log('Login-Code Mail – OK');

// 2. Angebotslink erzeugt Mail
resetMailOutboxForTests([]);
const offerResult = await sendCustomerOfferLinkMail({
  to: 'anna@test.de',
  customerName: 'Anna',
  dealerName: 'Autohaus Trinkle',
  vehicleTitle: 'Kia EV3',
  offerUrl: 'https://clever-neuwagen.de/angebot/CN-TEST',
  rateLine: 'ab 299 €/Monat',
});
assert.equal(offerResult.ok, true);
assert.equal(listMailOutbox()[0].templateId, MAIL_TEMPLATE_IDS.CUSTOMER_OFFER_LINK);
const withDelivery = applyOfferMailDelivery(sampleOffer, offerResult);
assert.equal(withDelivery.mailDelivery.status, 'sent');
console.log('Angebotslink Mail – OK');

// 3. Kundenanfrage → Kunde + Händler
resetMailOutboxForTests([]);
const inquiryLead = {
  id: 'lead-flow-test',
  contact: { name: 'Lisa', email: 'lisa@test.de', phone: '01701234567' },
  vehicle: { label: 'Kia Sportage' },
};
const inquiryResult = await sendCustomerInquiryMails({
  lead: inquiryLead,
  dealerContext: {
    dealerName: 'Autohaus Trinkle',
    dealerEmail: 'haendler@test.de',
    dealerPhone: '0711 12345',
    contactName: 'Verkauf',
  },
});
assert.equal(inquiryResult.ok, true);
assert.equal(listMailOutbox().length, 2);
const templates = listMailOutbox().map((m) => m.templateId).sort();
assert.ok(templates.includes(MAIL_TEMPLATE_IDS.CUSTOMER_INQUIRY_RECEIVED));
assert.ok(templates.includes(MAIL_TEMPLATE_IDS.DEALER_INQUIRY_NOTIFICATION));
console.log('Kundenanfrage Mails – OK');

// 4. Fehler → Admin-Task
resetMailOutboxForTests([]);
activityLog.length = 0;
await sendCustomerLoginCodeMail({
  to: 'fail@test.de',
  customerName: 'Fail',
  code: '111111',
  meta: { simulateFailure: true, failureReason: 'SMTP Timeout' },
});
const tasks = buildAdminTaskQueue({});
assert.ok(tasks.some((t) => t.priority === 'urgent' && t.category === 'Mail'));
console.log('Fehler → Admin-Task – OK');

// 5. Retry funktioniert
const failedId = listMailOutbox()[0].id;
const retryResult = await retryMail(failedId);
assert.equal(retryResult.ok, true);
assert.equal(listMailOutbox().find((m) => m.id === failedId)?.status, 'sent');
console.log('Retry – OK');

console.log('\nMail-Flow-Tests bestanden.');
