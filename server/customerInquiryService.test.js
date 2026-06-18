import assert from 'node:assert/strict';
import { processCustomerInquiry } from './customerInquiryService.js';
import { loadPilotLeads } from './pilotLeadsStore.js';

const result = processCustomerInquiry({
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

console.log('customerInquiryService.test.js: ok');
