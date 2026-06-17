/**
 * Clever Diktat – Textlogik
 */
import assert from 'node:assert/strict';
import { buildCleverAntwortenContext } from './cleverAntworten.js';
import {
  detectDiktatIntent,
  extractMentionedModels,
  formatDiktatDuration,
  generateCleverDiktatText,
} from './cleverDiktat.js';

assert.equal(formatDiktatDuration(65), '1:05');

const ctx = buildCleverAntwortenContext({
  customerName: 'Max Müller',
  vehicleCards: [{
    id: 'c1',
    modelName: 'EV3',
    paymentType: 'leasing',
    desiredRate: 399,
    termMonths: 48,
    mileagePerYear: 10000,
    offer: { status: 'opened' },
    vehicleOffer: { status: 'opened', onlineLink: { url: 'https://example.com/o1' } },
  }],
});

const rueckfrage = generateCleverDiktatText(
  'Frag ihn, ob Leasing oder Kauf und ob 10.000 Kilometer reichen.',
  ctx,
  { tone: 'freundlich', channel: 'email' },
);
assert.match(rueckfrage, /Leasing oder Kauf/i);
assert.match(rueckfrage, /10\.000 km/i);
assert.match(rueckfrage, /Hallo Herr Müller|Hallo Max Müller/i);

const nachfassen = generateCleverDiktatText(
  'Er hat das Angebot geöffnet, frag ob es passt oder wir was anpassen sollen.',
  ctx,
  { channel: 'email' },
);
assert.match(nachfassen, /angeschaut haben/i);
assert.match(nachfassen, /anpassen/i);

const unterlagenCtx = buildCleverAntwortenContext({
  customerName: 'Anna Schneider',
  lead: {
    crm: {
      cleverUnterlagen: {
        uploadLink: { url: 'https://example.com/upload/xyz' },
      },
    },
  },
});
const unterlagen = generateCleverDiktatText(
  'Schick ihm den Link für Selbstauskunft und Unterlagen.',
  unterlagenCtx,
  { channel: 'email' },
);
assert.match(unterlagen, /Selbstauskunft/i);
assert.ok(unterlagen.includes('https://example.com/upload/xyz'));

const custom = generateCleverDiktatText(
  'Sag dem Kunden, Sportage bei 250 Euro wird schwierig, ich prüfe EV2 und XCeed, Angebot kommt heute Nachmittag.',
  buildCleverAntwortenContext({ customerName: 'Peter Lux' }),
  { channel: 'email' },
);
assert.match(custom, /250/);
assert.ok(extractMentionedModels('prüfe EV2 und XCeed').includes('EV2'));
assert.match(custom, /heute Nachmittag/i);

assert.equal(detectDiktatIntent('Selbstauskunft Link schicken'), 'unterlagen');
assert.equal(detectDiktatIntent('Angebot geöffnet nachfragen'), 'nachfassen');

console.log('cleverDiktat.test.js: ok');
