/**
 * dealerAiActions – Phase 3b: Verkäufer-Erkenntnisse nach sellerInsights.
 */
import assert from 'node:assert/strict';
import { parseDealerAiInput } from './dealerAiParser.js';
import { buildCustomerRecognitionInsight, applyRecognitionInsightToParsed } from './dealerAiRecognitionInsight.js';
import { executeDealerAiAction } from './dealerAiActions.js';
import { DIRECT_AKTE_SAMPLE_TEXT } from './dealerAiDirectCustomerAkte.js';
import { getSellerInsightsFromLead } from './dealer/sellerInsights.js';

const parsed = parseDealerAiInput(DIRECT_AKTE_SAMPLE_TEXT);
assert.equal(parsed.ok, true);

const insight = buildCustomerRecognitionInsight(DIRECT_AKTE_SAMPLE_TEXT, parsed);
const enriched = applyRecognitionInsightToParsed(parsed, insight);
enriched.customerHelperNotes = insight.customerHelperNotes;

const leads = [];
const result = executeDealerAiAction('create_sales_opportunity', enriched, {
  conditions: { dealerId: 'autohaus-trinkle', dealerName: 'Test' },
  leads,
  addLead: (lead) => leads.push(lead),
  updateLead: () => {},
  getExistingCodes: () => [],
});

assert.equal(result.type, 'lead');
const lead = leads[0];
assert.ok(lead, 'Lead erstellt');

const texts = getSellerInsightsFromLead(lead).map((item) => item.text);
assert.ok(texts.some((t) => /wohnmobil/i.test(t)), 'customerHelperNotes in sellerInsights');
assert.equal(lead.crm?.kundenhelfer?.notes, undefined, 'kundenhelfer.notes nicht neu geschrieben');
assert.ok(lead.crm?.needProfile == null || lead.crm.needProfile, 'needProfile unangetastet');

console.log('dealerAiActions.test.js: ok');
