/**
 * Verkäufer-Spracharbeitsplatz – Copy & Kontext-Chips
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SELLER_INSIGHT_CONTEXT } from '../../services/dealer/sellerInsights.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const captureSource = readFileSync(
  join(__dirname, 'CustomerAkteSellerInsightCapture.jsx'),
  'utf8',
);
const beratungSource = readFileSync(
  join(__dirname, 'CustomerAkteCleverBeratung.jsx'),
  'utf8',
);
const followUpSource = readFileSync(
  join(__dirname, 'DealerAiLeadFollowUp.jsx'),
  'utf8',
);

assert.ok(
  captureSource.includes('Was haben Sie gerade vom Kunden gelernt?'),
  'Spracharbeitsplatz-Überschrift',
);
assert.ok(captureSource.includes('DealerAiInlineMic'), 'Mikrofon für Sprechen');
assert.ok(captureSource.includes('Festhalten'), 'Speichern ohne CRM-Sprache');
assert.ok(captureSource.includes('Verkäufer-Spracharbeitsplatz'), 'Aria-Label Arbeitsplatz');

const forbidden = [
  'Erkenntnis hinzufügen',
  'Neue Erkenntnis',
  'CRM-Notiz',
  'Kundeninformation erfassen',
  'Daten ergänzen',
  'Verkäufer-Erkenntnis',
];
for (const term of forbidden) {
  assert.ok(!captureSource.includes(term), `kein CRM-Begriff: ${term}`);
}

assert.equal(SELLER_INSIGHT_CONTEXT.CALLBACK, 'callback');
assert.equal(SELLER_INSIGHT_CONTEXT.VEHICLE_VIEWING, 'vehicle_viewing');
assert.ok(captureSource.includes('Rückruf'), 'Kontext-Chip Rückruf');
assert.ok(captureSource.includes('Fahrzeugbesichtigung'), 'Kontext-Chip Fahrzeugbesichtigung');
assert.ok(captureSource.includes('Telefonat'), 'Kontext-Chip Telefonat');
assert.ok(captureSource.includes('Probefahrt'), 'Kontext-Chip Probefahrt');
assert.ok(captureSource.includes('Angebot'), 'Kontext-Chip Angebot');

assert.ok(
  captureSource.includes('appendSellerInsightsFromTexts') === false,
  'kein neuer Schreibpfad in der UI',
);
assert.ok(captureSource.includes('onSubmit'), 'nutzt bestehenden Submit-Callback');

assert.ok(
  !beratungSource.includes('Ihre Erkenntnisse'),
  'Kundenbild-Hint ohne Erkenntnis-Sprache',
);
assert.ok(
  followUpSource.includes('Gespräch festgehalten'),
  'History-Text ohne CRM-Sprache',
);
assert.ok(followUpSource.includes("setToast('Notiert')"), 'Toast kurz und alltagstauglich');

console.log('CustomerAkteSellerInsightCapture.test.js: ok');
