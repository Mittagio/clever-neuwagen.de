import assert from 'node:assert/strict';
import {
  buildSalesAdvisorWhatsAppMessage,
  buildInquiryBriefWhatsAppMessage,
} from './whatsappBriefMessages.js';

const salesMsg = buildSalesAdvisorWhatsAppMessage({
  customerName: 'Herr Müller',
  sellerName: 'Max',
  dealerName: 'Autohaus Trinkle',
  wishLabels: ['Sitzheizung', 'SUV', 'Elektro'],
  budgetMax: 400,
  matches: [
    { model: 'Kia EV3 Earth', cleverQuote: { percent: 96 }, bestOffer: { monthlyRate: 318 } },
    { model: 'Kia Sportage', cleverQuote: { percent: 94 }, bestOffer: { monthlyRate: 329 } },
  ],
  shareUrl: 'https://clever-neuwagen.de/vergleich/ABC',
});

assert.ok(salesMsg.includes('geprüft'));
assert.ok(salesMsg.includes('96 % CleverQuote'));
assert.ok(salesMsg.includes('Sitzheizung'));
assert.ok(salesMsg.includes('400 €/Monat'));

const inquiryMsg = buildInquiryBriefWhatsAppMessage({
  brief: {
    customerName: 'Herr Müller',
    cleverQuotePercent: 96,
    recommended: { title: 'Kia EV3 Earth' },
    variant: { priceLabel: '318 €/Monat' },
    deliveryLabel: 'Lieferbar in 4–6 Wochen',
  },
  sellerName: 'Max',
  dealerName: 'Autohaus Trinkle',
});

assert.ok(inquiryMsg.includes('Herr Müller'));
assert.ok(inquiryMsg.includes('96 % CleverQuote'));
assert.ok(inquiryMsg.includes('EV3 Earth'));

console.log('whatsappBriefMessages.test.js: ok');
