/**
 * Clever Antworten – Textlogik
 */
import assert from 'node:assert/strict';
import {
  buildCleverAntwortenContext,
  buildCleverGreeting,
  generateCleverAntwortText,
  refineCleverAntwortText,
  suggestCleverAntwortType,
} from './cleverAntworten.js';

assert.equal(buildCleverGreeting(''), 'Guten Tag,');
assert.equal(buildCleverGreeting('Kunde (offen)'), 'Guten Tag,');
assert.equal(buildCleverGreeting('Max Müller'), 'Hallo Max Müller,');
assert.equal(buildCleverGreeting('Anna Schmidt', 'frau'), 'Hallo Frau Schmidt,');
assert.equal(buildCleverGreeting('Tom Weber', 'herr'), 'Hallo Herr Weber,');

const emptyCtx = buildCleverAntwortenContext({ customerName: '' });
const dankeEmpty = generateCleverAntwortText('danke', emptyCtx);
assert.ok(!dankeEmpty.includes('[Name]'));
assert.ok(dankeEmpty.startsWith('Guten Tag,'));

const namedCtx = buildCleverAntwortenContext({
  customerName: 'Lisa Meyer',
  vehicleCards: [{
    id: 'c1',
    modelName: 'EV3',
    trimLabel: 'Earth',
    paymentType: 'leasing',
    desiredRate: 399,
    termMonths: 48,
    mileagePerYear: 10000,
    vehicleOffer: {
      status: 'sent',
      onlineLink: { url: 'https://example.com/angebot/abc' },
    },
    offer: { status: 'sent', code: 'https://example.com/angebot/abc' },
  }],
  kundenhelferNotes: 'Kofferraum wichtig, entscheidet mit Partner',
});

const angebot = generateCleverAntwortText('angebot_senden', namedCtx);
assert.ok(angebot.includes('EV3'));
assert.ok(angebot.includes('https://example.com/angebot/abc'));
assert.ok(!angebot.includes('[Link]'));

const openedCtx = buildCleverAntwortenContext({
  customerName: 'Peter Lux',
  vehicleCards: [{
    id: 'c2',
    modelName: 'Sportage',
    paymentType: 'leasing',
    offer: { status: 'opened' },
    vehicleOffer: { status: 'opened' },
  }],
});
const nachfassen = generateCleverAntwortText('nachfassen', openedCtx);
assert.match(nachfassen, /angeschaut haben/);
assert.equal(suggestCleverAntwortType(openedCtx), 'nachfassen');

const noLinkCtx = buildCleverAntwortenContext({
  customerName: 'Test',
  vehicleCards: [{ id: 'c3', modelName: 'Picanto', paymentType: 'cash' }],
});
const angebotOhneLink = generateCleverAntwortText('angebot_senden', noLinkCtx);
assert.ok(!angebotOhneLink.includes('http'));
assert.match(angebotOhneLink, /bereite.*vor/i);

const partnerCtx = buildCleverAntwortenContext({
  customerName: 'Sandra',
  kundenhelferNotes: 'entscheidet mit Partner',
  vehicleCards: [{ id: 'c4', modelName: 'Ceed', offer: { status: 'opened' }, vehicleOffer: { status: 'opened' } }],
});
const nachPartner = generateCleverAntwortText('nachfassen', partnerCtx);
assert.match(nachPartner, /gemeinsam besprechen/i);

const longText = generateCleverAntwortText('danke', namedCtx);
const shorter = refineCleverAntwortText(longText, 'kuerzer', namedCtx, 'danke');
assert.ok(shorter.length <= longText.length + 5);

console.log('cleverAntworten.test.js: ok');
