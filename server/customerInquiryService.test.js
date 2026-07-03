import assert from 'node:assert/strict';
import { configureMailOutboxStorage } from '../src/services/mail/mailOutboxStore.js';
import { listServerMailOutbox, resetServerMailOutboxForTests } from './mail/mailStore.js';
import { processCustomerInquiry } from './customerInquiryService.js';
import { loadPilotLeads } from './pilotLeadsStore.js';

resetServerMailOutboxForTests([]);
configureMailOutboxStorage({
  load: () => listServerMailOutbox(),
  save: (entries) => resetServerMailOutboxForTests(entries),
});

const result = await processCustomerInquiry({
  type: 'lead',
  lead: {
    id: `lead-test-inquiry-${Date.now()}`,
    status: 'neu',
    source: 'marketplace',
    dealerId: 'autohaus-trinkle',
    contact: {
      name: 'Test Kunde',
      email: 'test@example.com',
      phone: '01701234567',
    },
    vehicle: {
      brand: 'Kia',
      model: 'EV3',
      label: 'Kia EV3',
    },
    paymentType: 'leasing',
    history: [],
  },
});

assert.equal(result.ok, true);
assert.ok(result.leadId);
assert.equal(result.isNew, true);
assert.ok(result.lead.referenceCode?.startsWith('CN-'));

const stored = loadPilotLeads().leads.find((l) => l.id === result.leadId);
assert.ok(stored, 'lead should be persisted on server');

const serverMails = listServerMailOutbox();
assert.ok(serverMails.length >= 2, 'inquiry should persist mails in server outbox');

console.log('customerInquiryService.test.js: ok');
