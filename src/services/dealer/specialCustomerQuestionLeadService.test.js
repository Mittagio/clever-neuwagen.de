/**
 * specialCustomerQuestionLeadService – Phase 3b
 */
import assert from 'node:assert/strict';
import { createLeadFromSpecialQuestion } from './specialCustomerQuestionLeadService.js';
import { getSellerInsightsFromLead } from './sellerInsights.js';

const dealerConditions = { dealerId: 'demo', dealerName: 'Demo Autohaus' };
const contact = { name: 'Max Mustermann', phone: '0171 1234567', email: '' };

// A: Zubehörfrage – operative Infos in History, keine kundenhelfer.notes
const accessoryLead = createLeadFromSpecialQuestion({
  contact,
  specialCustomerQuestion: {
    rawText: 'Kann man beim EV4 Windabweiser montieren?',
    category: 'Zubehör',
    modelKey: 'ev4',
    modelLabel: 'Kia EV4',
    status: 'needs_dealer_check',
  },
  dealerConditions,
});
assert.equal(accessoryLead.crm?.kundenhelfer?.notes, undefined, 'A: keine neuen kundenhelfer.notes');
assert.equal(getSellerInsightsFromLead(accessoryLead).length, 0, 'A: keine sellerInsights bei Zubehörfrage');
assert.ok(
  accessoryLead.history.some((entry) => /spezielle Frage vorhanden/i.test(entry.text)),
  'A: operative Info in History',
);
assert.ok(accessoryLead.notes.includes('Spezielle Frage:'), 'A: operative Info in lead.notes');

// B: Beratungsfrage – Erkenntnisse in sellerInsights
const adviceLead = createLeadFromSpecialQuestion({
  contact,
  specialCustomerQuestion: {
    queryType: 'advice_question',
    adviceTopicId: 'ev_towing_range',
    rawText: 'Kann ich mit dem EV6 einen Wohnwagen ziehen?',
    category: 'Beratung / Anhänger',
    modelKey: 'ev6',
    modelLabel: 'Kia EV6',
    status: 'needs_dealer_check',
  },
  dealerConditions,
});
const adviceTexts = getSellerInsightsFromLead(adviceLead).map((item) => item.text);
assert.ok(
  adviceTexts.some((t) => /anhänger|wohnwagen/i.test(t)),
  'B: Beratungs-Erkenntnis in sellerInsights',
);
assert.equal(adviceLead.crm?.kundenhelfer?.notes, undefined, 'B: keine neuen kundenhelfer.notes');
assert.ok(
  adviceLead.history.some((entry) => /Beratungsfrage:/i.test(entry.text)),
  'B: operative Beratungsfrage in History',
);

console.log('specialCustomerQuestionLeadService.test.js: ok');
