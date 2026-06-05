import assert from 'node:assert/strict';
import { mapSpeechRecognitionError, parseConversationSpeech } from './conversationVoiceParser.js';
import { refineConversationText, buildDefaultWhatsAppMessage } from './conversationTextAssistant.js';
import { buildNeedsSummary } from './salesAdvisorService.js';

assert.ok(mapSpeechRecognitionError('network').includes('Internet'));
assert.ok(mapSpeechRecognitionError('not-allowed').includes('Mikrofon'));

const sample = 'Herr Müller sucht einen SUV, fährt 15.000 Kilometer im Jahr, möchte maximal 400 Euro zahlen, Sitzheizung ist wichtig und eine Anhängerkupplung wäre schön.';

const parsed = parseConversationSpeech(sample);

assert.ok(parsed.chipIds.includes('type_suv'), 'SUV erkannt');
assert.ok(parsed.chipIds.includes('budget_400'), 'Budget erkannt');
assert.ok(parsed.chipIds.includes('km_15000') || parsed.mileagePerYear === 15000, 'Kilometer erkannt');
assert.ok(parsed.chipIds.includes('heated_seats') || parsed.chipIds.includes('towbar'), 'Features erkannt');
assert.equal(parsed.customerName, 'Herr Müller');

const summary = buildNeedsSummary(parsed.chipIds, { name: 'Herr Müller' }, 15000);
assert.ok(summary.items.length > 0);
assert.ok(summary.vehicleClass.includes('SUV'));

const wa = buildDefaultWhatsAppMessage({
  customerName: 'Herr Müller',
  matches: [{ model: 'Kia EV3', cleverQuote: { percent: 96 } }],
  shareUrl: 'https://test/vergleich/ABC',
  sellerName: 'Max',
  dealerName: 'Trinkle',
});
assert.ok(wa.includes('Herr Müller'));

const shorter = refineConversationText(wa, 'mach es kürzer', {
  customerName: 'Herr Müller',
  matches: [{ model: 'EV3', cleverQuote: { percent: 96 } }],
  shareUrl: 'https://test',
  sellerName: 'Max',
});
assert.ok(shorter.length < wa.length);

console.log('conversation mode tests OK');
