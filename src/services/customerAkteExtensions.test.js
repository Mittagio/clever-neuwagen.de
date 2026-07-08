/**
 * Gesprächsnotizen, Dokumente & Inzahlungnahme
 */
import assert from 'node:assert/strict';
import {
  createConversationNote,
  updateConversationNote,
  getOfferConversationNotes,
} from './kundenhelferConversationNotes.js';
import {
  parseEuroAmount,
  attachAkteDocument,
  countAkteDocuments,
  formatDocumentsCompactLabel,
} from './customerAkteDocuments.js';
import {
  createEmptyTradeIn,
  patchTradeIn,
  shouldShowTradeInSection,
  suggestTradeInFromDocument,
  computeTradeDifference,
} from './customerAkteTradeIn.js';

const note = createConversationNote('DAT 34.356 €');
assert.equal(note.important, false);
assert.ok(note.id.startsWith('cn-'));

const updated = updateConversationNote([note], note.id, { important: true, includeInOffer: true });
assert.equal(updated[0].important, true);
assert.equal(getOfferConversationNotes(updated).length, 1);

assert.equal(parseEuroAmount('Händlerverkaufswert 34.356 €'), 34356);
assert.equal(formatDocumentsCompactLabel(3), '3 Dokumente');

const tradeIn = patchTradeIn(createEmptyTradeIn(), { datValue: 34356, payoffAmount: 48933 });
assert.equal(tradeIn.difference, -14577);
assert.equal(computeTradeDifference(34356, 48933), -14577);

const lead = {
  crm: {
    kundenhelfer: { notes: 'Inzahlungnahme vorhanden' },
    cleverUnterlagen: {
      documents: [{ id: 'd1', category: 'dat_bewertung', description: '34.356 €' }],
    },
  },
};
assert.equal(shouldShowTradeInSection(lead), true);

const tradeInInsightLead = {
  crm: {
    sellerInsights: [{
      id: 'si-trade',
      text: 'Inzahlungnahme vorhanden',
      source: 'seller',
      understoodLabels: ['Inzahlungnahme vorhanden'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }],
  },
};
assert.equal(
  shouldShowTradeInSection(tradeInInsightLead),
  true,
  'Trade-in-Sektion aus Customer Understanding ohne kundenhelfer.notes',
);

const suggested = suggestTradeInFromDocument(
  { category: 'dat_bewertung', description: '34.356 €' },
  createEmptyTradeIn(),
);
assert.equal(suggested.datValue, 34356);

console.log('customerAkteExtensions.test.js: ok');
