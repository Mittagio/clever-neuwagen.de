/**
 * node src/services/crm/improveSellerOutboundMessage.test.js
 */
import assert from 'node:assert/strict';
import {
  composeSellerOutboundMessage,
  applyOutboundMessageTone,
  OUTBOUND_TONES,
  improveSellerOutboundMessage,
} from './improveSellerOutboundMessage.js';

assert.ok(OUTBOUND_TONES.length >= 3);

const lead = {
  contact: { name: 'Garritano', salutation: 'herr' },
  vehicle: { model: 'Picanto' },
  paymentType: 'leasing',
  crm: { sellerName: 'Max' },
};

const empty = composeSellerOutboundMessage({ draftText: '', lead, customerName: 'Garritano' });
assert.equal(empty.ok, true);
assert.match(empty.text, /Garritano|Picanto|Guten Tag|Hallo/i);
assert.match(empty.text, /Viele Grüße/i);

const rough = composeSellerOutboundMessage({
  draftText: 'leasing läuft aus, picanto schwarz prüfen, rückfrage',
  lead,
  customerName: 'Garritano',
  tone: 'freundlich',
});
assert.equal(rough.ok, true);
assert.ok(rough.text.length > 40);
assert.equal(rough.changed, true);

const polite = applyOutboundMessageTone(rough.seed, 'hoeflich', { lead, customerName: 'Garritano' });
assert.equal(polite.ok, true);
assert.ok(polite.text.length > 20);

const personal = composeSellerOutboundMessage({
  draftText: rough.seed,
  lead,
  customerName: 'Herr Garritano',
  tone: 'persoenlich',
});
assert.equal(personal.ok, true);

const alias = improveSellerOutboundMessage('danke für anfrage', { lead, customerName: 'Garritano' });
assert.equal(alias.ok, true);

console.log('improveSellerOutboundMessage.test.js: ok');
