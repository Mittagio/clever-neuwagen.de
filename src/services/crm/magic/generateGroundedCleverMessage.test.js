/**
 * node src/services/crm/magic/generateGroundedCleverMessage.test.js
 * Golden Cases für grounded Magic Messages.
 */
import assert from 'node:assert/strict';
import { generateGroundedCleverMessage } from './generateGroundedCleverMessage.js';
import { interpretMessageInstruction } from './interpretMessageInstruction.js';
import { validateMessageFactPreservation } from './validateMessageFactPreservation.js';
import { lookupPackageContents, lookupRelevantEquipment } from './magicKnowledgeTools.js';
import {
  extractCustomerFacingNotes,
  writeGroundedMessageFallback,
} from './generateCleverCustomerMessage.js';
import { resolveTargetVehicle } from './resolveTargetVehicle.js';
import {
  buildMagicAkteContext,
  detectChipIntent,
  resolveCustomerInclination,
} from './buildMagicAkteContext.js';
import { VEHICLE_TRACK_STATUS } from '../vehicleTrack.js';

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

// --- Meta-Filter: Chip-Instruktionen nicht in Kundennachricht ---
assert.deepEqual(
  extractCustomerFacingNotes(
    'Bereite für dem Kunden ein Angebot vor und schreib eine kurze Kundennachricht dazu.',
  ),
  [],
);
assert.deepEqual(
  extractCustomerFacingNotes('Schreib dem Kunden eine kurze Nachfassnachricht.'),
  [],
);
assert.deepEqual(
  extractCustomerFacingNotes('Schreib dem Kunden kurz zur Lieferzeit und Verfügbarkeit.'),
  [],
);
assert.deepEqual(
  extractCustomerFacingNotes('Schick ihm die Angebote per Mail / Kundenlink.'),
  [],
);
assert.deepEqual(
  extractCustomerFacingNotes('Angebot mail an kunde'),
  [],
);
assert.deepEqual(
  extractCustomerFacingNotes('Angebto mail an kunde.'),
  [],
);
assert.deepEqual(
  extractCustomerFacingNotes('Schreib dem Kunden eine höfliche Rückfrage zu offenen Punkten.'),
  [],
);
const adaptedNotes = extractCustomerFacingNotes(
  'Schreib ihm, dass ich das Angebot angepasst habe.',
);
assert.ok(adaptedNotes.some((n) => /angebot angepasst/i.test(n)));

const chipAngebot = writeGroundedMessageFallback({
  recipient: 'Herr Müller',
  rawSellerInstruction:
    'Bereite für dem Kunden ein Angebot vor und schreib eine kurze Kundennachricht dazu.',
  vehicleIdentity: { modelKey: 'tivoli', modelLabel: 'Tivoli' },
  offerFacts: { summary: 'Tivoli · 36 Monate · 289 € mtl.', monthlyRate: 289 },
});
assert.doesNotMatch(chipAngebot.body, /schreib.*kundennachricht/i);
assert.doesNotMatch(chipAngebot.body, /bereite .+ vor/i);
assert.match(chipAngebot.body, /Tivoli|289/i);
// Konditionen nicht doppelt
const condHits = chipAngebot.body.match(/289/g) || [];
assert.ok(condHits.length <= 2, `duplicate rate mentions: ${condHits.length}`);

// Stenogramm / Tippfehler darf nie in die Kundennachricht
const offerShorthand = writeGroundedMessageFallback({
  recipient: 'Herr Müller',
  rawSellerInstruction: 'Angebto mail an kunde.',
  chipIntent: 'angebot',
  vehicleIdentity: { modelKey: 'ev6', modelLabel: 'EV6', trimLabel: 'Air' },
  offerFacts: {
    summary: '48 Monate · 35.000 km · 437,26 € / Monat',
    monthlyRate: 437.26,
    termMonths: 48,
    mileagePerYear: 35000,
  },
  akteContext: {
    selectedWorkingChip: { shortLabel: 'Air · 48 M', modelKey: 'ev6' },
  },
});
assert.doesNotMatch(offerShorthand.body, /angebto|mail an kunde/i);
assert.doesNotMatch(offerShorthand.body, /Bezugnehmend auf/i);
assert.match(offerShorthand.body, /EV6/i);
assert.match(offerShorthand.body, /Angebot/i);
assert.match(offerShorthand.body, /437/);
assert.equal(detectChipIntent('Angebto mail an kunde.'), 'angebot');
assert.equal(detectChipIntent('Angebot mail an kunde'), 'angebot');

// Unvollständige Akte → neutrale Anrede
const incompleteName = writeGroundedMessageFallback({
  recipient: 'Kunde',
  rawSellerInstruction: 'Angebot mail an kunde',
  vehicleIdentity: { modelKey: 'ev9', modelLabel: 'EV9' },
  offerFacts: { summary: '48 Monate · 350 € mtl.', monthlyRate: 350 },
}).body;
assert.match(incompleteName, /^Guten Tag,/);
assert.doesNotMatch(incompleteName, /Hallo Aalen/i);

// Keine doppelte Lieferzeit-Zeile
const deliveryBody = writeGroundedMessageFallback({
  recipient: 'Herr Müller',
  rawSellerInstruction: 'Schreib dem Kunden kurz zur Lieferzeit und Verfügbarkeit.',
  vehicleIdentity: { modelKey: 'picanto', modelLabel: 'Picanto' },
  sellerFacts: [{ type: 'availability', value: 'sofort verfügbar' }],
}).body;
const deliveryHits = deliveryBody.match(/lieferzeit|verfügbarkeit/gi) || [];
assert.ok(deliveryHits.length <= 2, `too many delivery mentions: ${deliveryHits.length}`);
assert.match(deliveryBody, /sofort verfügbar/i);
assert.doesNotMatch(deliveryBody, /kurz zur Lieferzeit und Verfügbarkeit:[\s\S]*Zur Verfügbarkeit/i);

// --- Nachfassen-Qualität: echte Frage + richtige Spur ---
assert.equal(detectChipIntent('Schreib dem Kunden eine kurze Nachfassnachricht.'), 'nachfassen');
assert.equal(detectChipIntent('Schick ihm die Angebote per Mail / Kundenlink.'), 'kundenlink');

const nachfassenBody = writeGroundedMessageFallback({
  recipient: 'Herr Müller',
  rawSellerInstruction: 'Schreib dem Kunden eine kurze Nachfassnachricht.',
  chipIntent: 'nachfassen',
  vehicleIdentity: { modelKey: 'tivoli', modelLabel: 'Tivoli' },
  akteContext: {
    chipIntent: 'nachfassen',
    inclination: { modelKey: 'xceed', modelLabel: 'XCeed', source: 'favorite_track' },
    selectedWorkingChip: { shortLabel: 'Tivoli · 48M', modelKey: 'tivoli' },
  },
  offerFacts: { summary: 'Tivoli · 48 Monate · 269 € mtl.', monthlyRate: 269 },
}).body;
assert.match(nachfassenBody, /Tivoli/i);
assert.match(nachfassenBody, /\?/);
assert.doesNotMatch(nachfassenBody, /kurze Rückfrage:\s*$/m);
assert.doesNotMatch(nachfassenBody, /schreib.*nachfass/i);
// Neigung XCeed erwähnen wenn Chip Tivoli
assert.match(nachfassenBody, /XCeed/i);
// Konditionen max 1× aus Summary
const rate269 = nachfassenBody.match(/269/g) || [];
assert.ok(rate269.length <= 1, `duplicate 269: ${rate269.length}`);

const kundenlinkBody = writeGroundedMessageFallback({
  recipient: 'Herr Müller',
  rawSellerInstruction: 'Schick ihm die Angebote per Mail / Kundenlink.',
  chipIntent: 'kundenlink',
  vehicleIdentity: { modelKey: 'xceed', modelLabel: 'XCeed' },
  akteContext: {
    chipIntent: 'kundenlink',
    selectedWorkingChip: { shortLabel: 'XCeed · 48M', modelKey: 'xceed' },
  },
}).body;
assert.match(kundenlinkBody, /Kundenlink|Link/i);
assert.match(kundenlinkBody, /XCeed/i);
assert.doesNotMatch(kundenlinkBody, /schick.*angebote per mail/i);

const rueckfrageBody = writeGroundedMessageFallback({
  recipient: 'Herr Müller',
  rawSellerInstruction: 'Schreib dem Kunden eine höfliche Rückfrage zu offenen Punkten.',
  chipIntent: 'rueckfrage',
  vehicleIdentity: { modelKey: 'sportage', modelLabel: 'Sportage' },
}).body;
assert.match(rueckfrageBody, /\?/);
assert.doesNotMatch(rueckfrageBody, /kurze Rückfrage:\s*$/m);
assert.match(rueckfrageBody, /Sportage/i);

// --- Kontext-Priorität: Akte-Neigung aus Favoriten-Spur ---
const inclineLead = {
  id: 'lead-1',
  crm: {
    needProfile: { selectedModelKey: 'tivoli' },
    vehicleConfigurations: [
      {
        id: 'cfg-xceed',
        model: 'XCeed',
        modelKey: 'xceed',
        vehicleTrack: { status: VEHICLE_TRACK_STATUS.FAVORITE },
      },
      {
        id: 'cfg-tivoli',
        model: 'Tivoli',
        modelKey: 'tivoli',
        vehicleTrack: { status: VEHICLE_TRACK_STATUS.OPEN },
      },
    ],
  },
};
const inclination = resolveCustomerInclination(inclineLead);
assert.equal(inclination?.modelKey, 'xceed');
assert.match(String(inclination?.modelLabel || ''), /xceed/i);

const akteCtx = buildMagicAkteContext({
  lead: inclineLead,
  rawSellerInput: 'Schreib dem Kunden eine kurze Nachfassnachricht.',
  workingContext: { modelKey: 'tivoli', shortLabel: 'Tivoli · 48M', offerId: 'off-t' },
  offerContext: { offerId: 'off-t', title: 'Tivoli', monthlyRate: 269 },
});
assert.equal(akteCtx.chipIntent, 'nachfassen');
assert.equal(akteCtx.inclination?.modelKey, 'xceed');
assert.ok(akteCtx.vehicleTracks.some((t) => t.modelKey === 'xceed' && t.status === 'favorite'));
assert.equal(akteCtx.selectedWorkingChip?.modelKey, 'tivoli');

// --- resolveTargetVehicle: Freitext-Modell schlägt falschen Anhang ---
const resolvedTivoli = resolveTargetVehicle({
  rawSellerInput: 'Angebot Tivoli zusammenfassen',
  workingContext: { modelKey: 'picanto', trimId: 'gt-line', shortLabel: 'Picanto GT-Line' },
  openVehicles: [
    {
      modelKey: 'tivoli',
      label: 'Tivoli Vision',
      offerId: 'off-tivoli',
      monthlyRate: 289,
      termMonths: 36,
      summary: 'Tivoli Vision · 36 Monate · 289 €',
    },
    { modelKey: 'picanto', label: 'Picanto GT-Line', offerId: 'off-pic' },
  ],
});
assert.equal(resolvedTivoli.ok, true);
assert.equal(resolvedTivoli.vehicle.modelKey, 'tivoli');
assert.equal(resolvedTivoli.vehicle.offerId, 'off-tivoli');
assert.equal(resolvedTivoli.vehicle.source, 'seller_input_model');

const xceedInterp = interpretMessageInstruction('Angebot XCeed kurz erklären');
assert.ok(xceedInterp.sellerFacts.some((f) => /x?ceed/i.test(f.value)));

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

// --- 8) Angebot Tivoli aus openVehicles trotz falschem Anhang ---
const case8 = await generateGroundedCleverMessage({
  rawSellerInput: 'Angebot Tivoli zusammenfassen',
  recipient: 'Herr Müller',
  workingContext: {
    offerId: 'off-pic',
    modelKey: 'picanto',
    shortLabel: 'Picanto GT-Line',
  },
  offerContext: {
    offerId: 'off-pic',
    title: 'Picanto GT-Line',
    monthlyRate: 179,
  },
  openVehicles: [
    {
      modelKey: 'tivoli',
      label: 'Tivoli Vision',
      offerId: 'off-tivoli',
      monthlyRate: 289,
      termMonths: 36,
      summary: 'Tivoli Vision · 36 Monate · 289 €',
    },
    { modelKey: 'picanto', label: 'Picanto GT-Line', offerId: 'off-pic', monthlyRate: 179 },
  ],
}, { forceFallback: true });
assert.equal(case8.vehicle?.modelKey, 'tivoli');
assert.ok(case8.offerFacts?.monthlyRate === 289 || /289|Tivoli/i.test(case8.body));
assert.match(case8.body, /Tivoli/i);
assert.doesNotMatch(case8.body, /schreib.*kundennachricht/i);

// --- 9) Nachfassen mit Akte-Kontext (XCeed-Neigung, Tivoli-Chip) ---
const case9 = await generateGroundedCleverMessage({
  rawSellerInput: 'Schreib dem Kunden eine kurze Nachfassnachricht.',
  recipient: 'Herr Müller',
  lead: inclineLead,
  workingContext: {
    offerId: 'off-tivoli',
    modelKey: 'tivoli',
    shortLabel: 'Tivoli · 48M',
  },
  offerContext: {
    offerId: 'off-tivoli',
    title: 'Tivoli',
    monthlyRate: 269,
    termMonths: 48,
    summary: 'Tivoli · 48 Monate · 269 € mtl.',
  },
  openVehicles: [
    { modelKey: 'tivoli', label: 'Tivoli', offerId: 'off-tivoli', monthlyRate: 269, summary: 'Tivoli · 48 Monate · 269 € mtl.' },
    { modelKey: 'xceed', label: 'XCeed', offerId: 'off-xceed' },
  ],
  chipIntent: 'nachfassen',
}, { forceFallback: true });
assert.match(case9.body, /Tivoli/i);
assert.match(case9.body, /\?/);
assert.doesNotMatch(case9.body, /kurze Rückfrage:\s*$/m);
assert.doesNotMatch(case9.body, /schreib.*nachfass/i);

console.log('generateGroundedCleverMessage.test.js: ok');
