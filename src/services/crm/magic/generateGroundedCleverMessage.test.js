/**
 * node src/services/crm/magic/generateGroundedCleverMessage.test.js
 * Golden Cases für grounded Magic Messages.
 */
import assert from 'node:assert/strict';
import { generateGroundedCleverMessage } from './generateGroundedCleverMessage.js';
import { interpretMessageInstruction } from './interpretMessageInstruction.js';
import { validateMessageFactPreservation } from './validateMessageFactPreservation.js';
import { lookupPackageContents, lookupRelevantEquipment } from './magicKnowledgeTools.js';

const GOLDEN_INPUT = `Schreib dem Kunden, dass wir einen schwarzen GT-Line
da haben, mit Technologie-Paket und Schiebedach.

Erklär noch kurz,
was im Technologie-Paket enthalten ist
und welche Ausstattung das Fahrzeug hat.`;

// --- interpret ---
const interpreted = interpretMessageInstruction(GOLDEN_INPUT);
assert.equal(interpreted.intent, 'draft_customer_message');
assert.ok(interpreted.sellerFacts.some((f) => f.type === 'color'));
assert.ok(interpreted.sellerFacts.some((f) => f.type === 'trim'));
assert.ok(interpreted.sellerFacts.some((f) => f.type === 'package_present'));
assert.ok(interpreted.sellerFacts.some((f) => f.type === 'sunroof'));
assert.ok(interpreted.sellerFacts.some((f) => f.type === 'availability'));
assert.ok(interpreted.requiredKnowledge.includes('package_contents'));
assert.ok(interpreted.requiredKnowledge.includes('standard_equipment'));

// Picanto hat kein Technologie-Paket → missing
const picantoPkg = lookupPackageContents({
  modelKey: 'picanto',
  trim: 'gt-line',
  packageName: 'Technologie-Paket',
});
assert.equal(picantoPkg.ok, false);
assert.equal(picantoPkg.missingKnowledgeKey, 'exact_technology_package_contents');

// EV5 hat Technologie-Paket verifiziert
const ev5Pkg = lookupPackageContents({
  modelKey: 'ev5',
  trim: 'earth',
  packageName: 'Technologie-Paket',
});
assert.equal(ev5Pkg.ok, true);
assert.ok(ev5Pkg.package.items.length > 0);
assert.ok(ev5Pkg.package.items.some((i) => /360|Totwinkel|Head-Up/i.test(i)));

const picantoEq = lookupRelevantEquipment({ modelKey: 'picanto', trim: 'gt-line' });
assert.equal(picantoEq.ok, true);
assert.ok(picantoEq.items.length > 0);

// --- 1) Verifizierte Inhalte (EV5 + Attachment) ---
const case1 = await generateGroundedCleverMessage({
  rawSellerInput: GOLDEN_INPUT.replace(/GT-Line/i, 'EV5 Earth'),
  recipient: 'Herr Garritano',
  workingContext: {
    modelKey: 'ev5',
    trimId: 'earth',
    shortLabel: 'EV5 Earth',
    color: 'Schwarz',
  },
  lead: { contact: { name: 'Garritano' } },
}, { forceFallback: true });

assert.equal(case1.ok, true);
assert.match(case1.body, /Garritano/i);
assert.ok(case1.verifiedPackageFacts?.items?.length > 0, 'verified package required');
for (const item of case1.verifiedPackageFacts.items) {
  // body may paraphrase; usedFacts must contain items
  assert.ok(
    case1.usedFacts.some((f) => String(f.value).includes(item))
    || case1.body.includes(item),
    `fact preserved: ${item}`,
  );
}
assert.ok(!case1.missingKnowledge.includes('exact_technology_package_contents'));

// --- 2) Paket fehlt (Picanto) → keine erfundenen Items ---
const case2 = await generateGroundedCleverMessage({
  rawSellerInput: GOLDEN_INPUT,
  recipient: 'Herr Garritano',
  workingContext: {
    modelKey: 'picanto',
    trimId: 'gt-line',
    shortLabel: 'Picanto GT-Line · Schwarz',
    color: 'Schwarz',
  },
}, { forceFallback: true });

assert.ok(case2.missingKnowledge.includes('exact_technology_package_contents'));
assert.ok(case2.uiHint?.message);
assert.doesNotMatch(case2.body, /360° Kamera/);
assert.doesNotMatch(case2.body, /Head-Up Display/i);

// --- 3) Verfügbarkeit als Seller Fact ---
const case3 = await generateGroundedCleverMessage({
  rawSellerInput: 'Picanto GT-Line schwarz, sofort verfügbar, kurze Info',
  workingContext: { modelKey: 'picanto', trimId: 'gt-line' },
}, { forceFallback: true });
assert.ok(case3.interpretation.sellerFacts.some((f) => f.type === 'availability'));
assert.match(case3.body, /verfügbar/i);

// --- 4) Keine Verfügbarkeit erfinden ---
const case4 = await generateGroundedCleverMessage({
  rawSellerInput: 'Schreib kurz Danke für die Anfrage zum Picanto',
  workingContext: { modelKey: 'picanto', trimId: 'core' },
}, { forceFallback: true });
assert.ok(!case4.interpretation.sellerFacts.some((f) => f.type === 'availability'));
const preserv4 = validateMessageFactPreservation(case4.body, {
  sellerFacts: case4.interpretation.sellerFacts,
  missingPackageContents: false,
});
assert.equal(preserv4.ok, true);
assert.doesNotMatch(case4.body.toLowerCase(), /sofort verfügbar/);

// --- 5) Zwei Fahrzeuge, kein Attachment ---
const case5 = await generateGroundedCleverMessage({
  rawSellerInput: 'Schreib dem Kunden wegen dem Auto',
  openVehicles: [
    { modelKey: 'picanto', trimId: 'core', label: 'Picanto Core' },
    { modelKey: 'picanto', trimId: 'gt-line', label: 'Picanto GT-Line' },
  ],
}, { forceFallback: true });
assert.equal(case5.mode, 'clarify_vehicle');
assert.match(case5.body, /Picanto Core|Picanto GT-Line/);

// --- 6) Angebot angehängt → Rate aus Offer ---
const case6 = await generateGroundedCleverMessage({
  rawSellerInput: 'Schick dem Kunden die Konditionen aus dem Angebot',
  workingContext: {
    offerId: 'off-1',
    modelKey: 'picanto',
    trimId: 'gt-line',
    shortLabel: 'Picanto GT-Line',
  },
  offerContext: {
    offerId: 'off-1',
    title: 'Picanto GT-Line',
    monthlyRate: 179,
    termMonths: 36,
    mileagePerYear: 10000,
    paymentType: 'leasing',
  },
}, { forceFallback: true });
assert.ok(case6.offerFacts?.monthlyRate === 179);
assert.match(case6.body, /179/);

// --- 7) AHK nicht irrelevant einbauen ---
const case7 = await generateGroundedCleverMessage({
  rawSellerInput: 'Schick dem Kunden den Link zu den Unterlagen',
  lead: {
    contact: { name: 'Garritano' },
    crm: { needProfile: { towCapacityKg: 750 } },
  },
  workingContext: { modelKey: 'picanto', trimId: 'core' },
}, { forceFallback: true });
assert.equal(case7.interpretation.docsOnly, true);
assert.doesNotMatch(case7.body, /Anhänger|AHK|750/i);

// --- allow without package details ---
const case2b = await generateGroundedCleverMessage({
  rawSellerInput: GOLDEN_INPUT,
  workingContext: { modelKey: 'picanto', trimId: 'gt-line', color: 'Schwarz' },
  allowWithoutPackageDetails: true,
}, { forceFallback: true });
assert.ok(!case2b.missingKnowledge.includes('exact_technology_package_contents'));

console.log('generateGroundedCleverMessage.test.js: ok');
