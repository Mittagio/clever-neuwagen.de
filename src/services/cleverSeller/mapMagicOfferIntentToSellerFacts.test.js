/**
 * node src/services/cleverSeller/mapMagicOfferIntentToSellerFacts.test.js
 */
import assert from 'node:assert/strict';
import { SELLER_FACT_CLASS, SELLER_FACT_SOURCE, SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';
import {
  extractSellerFactsFromOfferPdfText,
  hasExplicitAppointmentSellerCue,
  isOfferPdfDropContext,
  mergeOfferPdfFactsIntoSellerFacts,
  shouldEnrichSellerInputFromOfferPdf,
} from './mapMagicOfferIntentToSellerFacts.js';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import { runComposerPdfAttachTurn } from './runComposerPdfAttachTurn.js';

const leasingPdfText = `
PDF: GT LINE.pdf

Kia EV2 GT-Line Leasingangebot
Laufzeit 36 Monate
15.000 km / Jahr
Anzahlung 6.000 €
Monatsrate 329 €
Keine Schlussrate
`;

const pdfFacts = extractSellerFactsFromOfferPdfText(leasingPdfText);
assert.ok(pdfFacts.some((f) => f.field === 'paymentType' && f.value === 'leasing'));
assert.ok(pdfFacts.some((f) => f.field === 'termMonths' && f.value === 36));
assert.ok(pdfFacts.some((f) => f.field === 'annualMileage' && f.value === 15000));
assert.ok(pdfFacts.some((f) => f.field === 'downPayment' && f.value === 6000));
assert.ok(pdfFacts.some((f) => f.field === 'monthlyBudget' && f.value === 329));
assert.ok(pdfFacts.some((f) => f.field === 'vehicleInterest'));
assert.ok(pdfFacts.every((f) => f.source === SELLER_FACT_SOURCE.OFFER_PDF));

// HAP-Bank-PDF: Farbe (ß), Pakete, Motor, Gesamtlistenpreis, kein kWh/100-Falschpositiv
{
  const hapBank = `Konfiguration und Ausstattung Ihres Fahrzeuges
Kia EV3 58 kWh 150 kW Earth Frontantrieb
Lackierung:   Schneeweiß Uni
Upgrade-Paket   1.084,03   EUR
Business-Paket   1.000,00   EUR
Winter-Connect-Paket   1.092,44   EUR
DriveWise-Park-Paket   747,90   EUR
Design-Paket (19-Zoll Leichtmetallfelgen)   579,83   EUR
Gesamtlistenpreis inkl. Sonderausstattung & Zubehör   36.680,67   EUR
Alle Preise ohne USt
Monatliche Gesamtrate 406,93 EUR
Monatsrate Finanzleasing 406,93 EUR
Anzahlung 0,00 EUR
Überführung 1.084,03 EUR
Laufzeit 36 Monate
Laufleistung / Jahr 10.000 km
KIA Leasing`;
  const hapFacts = extractSellerFactsFromOfferPdfText(hapBank);
  assert.ok(hapFacts.some((f) => f.field === 'colorPreference' && /schneeweiß/i.test(f.label)));
  assert.ok(hapFacts.some((f) => f.field === 'equipmentWish' && /upgrade/i.test(f.label)));
  assert.ok(hapFacts.some((f) => f.field === 'equipmentWish' && /winter-connect/i.test(f.label)));
  assert.ok(hapFacts.some((f) => f.field === 'equipmentWish' && /drivewise/i.test(f.label)));
  assert.ok(hapFacts.some((f) => f.field === 'equipmentWish' && /58 kWh/i.test(f.label)));
  assert.ok(hapFacts.some((f) => f.field === 'annualMileage' && f.value === 10000));
  assert.ok(hapFacts.some((f) => f.field === 'purchasePrice' && (
    Number(f.value) === 36680.67 || Number(f.value?.amount) === 36680.67
  )));
  assert.ok(hapFacts.some((f) => f.field === 'monthlyBudget' && (
    Number(f.value) === 406.93 || Number(f.value?.amount) === 406.93
  )));
}

// Konfigurator: UVP + Farbe, kein 100 km aus kWh/100
{
  const cfg = `EV3 Earth Frontantrieb, 58,3-kWh-Batterie; 150 kW (204 PS)
Stromverbrauch kombiniert 15,8 kWh/100 km; CO₂-Emissionen kombiniert 0 g/km.
Farbe außen Schneeweiß
P5 - Upgrade-Paket MJ27 1.290 €
P3 - Winter-Connect-Paket 1.300 €
P4 - Business-Paket
P6 - DriveWise-Park-Paket
P7 - Design-Paket
Gesamtpreis (UVP)** 43.650 €* inkl. 19% MwSt.`;
  const cfgFacts = extractSellerFactsFromOfferPdfText(cfg);
  assert.ok(!cfgFacts.some((f) => f.field === 'annualMileage'), 'kein kWh/100-Falschpositiv');
  assert.ok(cfgFacts.some((f) => f.field === 'colorPreference' && /schneeweiß/i.test(f.label)));
  assert.ok(cfgFacts.some((f) => f.field === 'purchasePrice' && (
    Number(f.value) === 43650 || Number(f.value?.amount) === 43650
  )));
  assert.ok(cfgFacts.some((f) => f.field === 'equipmentWish' && /upgrade/i.test(f.label)));
}

assert.equal(
  shouldEnrichSellerInputFromOfferPdf([{ kind: 'configurator_pdf' }], 'x'),
  true,
);
assert.equal(
  shouldEnrichSellerInputFromOfferPdf([{ kind: 'contract_pdf', mimeType: 'application/pdf' }], 'x'),
  false,
);
assert.equal(shouldEnrichSellerInputFromOfferPdf([], 'PDF: foo.pdf\nLeasing'), true);
assert.equal(shouldEnrichSellerInputFromOfferPdf([], 'nur text'), false);

const merged = mergeOfferPdfFactsIntoSellerFacts(
  [{
    factClass: SELLER_FACT_CLASS.SELLER_FACT,
    field: 'termMonths',
    value: 48,
    label: '48 Monate',
    source: 'seller_input',
    confidence: 0.8,
  }],
  pdfFacts,
);
assert.equal(merged.find((f) => f.field === 'termMonths')?.value, 36);
assert.equal(merged.find((f) => f.field === 'termMonths')?.source, SELLER_FACT_SOURCE.OFFER_PDF);

const interpreted = interpretSellerInput(leasingPdfText, {
  attachments: [{ kind: 'configurator_pdf', mimeType: 'application/pdf' }],
});
assert.ok(interpreted.facts.some((f) => f.field === 'paymentType' && f.value === 'leasing'));
assert.ok(interpreted.facts.some((f) => f.field === 'downPayment' && f.value === 6000));
assert.ok(interpreted.facts.some((f) => f.field === 'termMonths' && f.value === 36));
assert.ok(interpreted.facts.some((f) => f.field === 'annualMileage' && f.value === 15000));

const lead = {
  id: 'lead-pdf-1',
  name: 'Kai Drechsel',
  wish: {},
  crm: { needProfile: createEmptyNeedProfile() },
};
const turn = runCleverSellerTurn({
  lead,
  sellerInput: leasingPdfText,
  attachments: [{ kind: 'configurator_pdf', mimeType: 'application/pdf' }],
});
assert.ok(shouldShowUniversalReview(turn));
assert.ok(turn.extractedFacts.some((f) => f.field === 'downPayment'));
assert.ok(turn.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));
assert.ok(!turn.intents.some((i) => i.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT));
const pdfReview = buildUniversalReviewModel(turn);
assert.ok(
  ['offer_prepare', 'offer_incomplete', 'offer_and_message_review'].includes(pdfReview?.reviewType),
  `expected offer review, got ${pdfReview?.reviewType}`,
);
assert.notEqual(pdfReview?.reviewType, 'appointment_and_message_review');
assert.equal(pdfReview?.compactUi, true);
assert.equal(pdfReview?.groups?.length || 0, 0, 'Fact-Gruppen sind eingeklappt');
assert.ok(
  (pdfReview?.collapsedContext?.groups || []).length > 0,
  'Erkannte Angaben liegen in collapsedContext',
);
assert.ok(
  pdfReview?.actionSections?.some((s) => (
    (s.primaryActions || []).some((a) => (
      /Angebot (erstellen|bearbeiten|vervollständigen)/i.test(a.label || '')
    ))
  )),
);

const applied = applyAcceptedSellerTurn(lead, turn);
assert.equal(applied.ok, true);
// paymentType: Offer-PDF-Leasing hat Vorrang vor konkurrierendem Seller-Input „cash“
const payment = applied.lead.paymentType || applied.lead.wish?.paymentType;
assert.ok(payment === 'leasing' || applied.lead.wish?.termMonths === 36);
assert.equal(applied.lead.wish?.termMonths, 36);
assert.equal(applied.lead.wish?.mileagePerYear, 15000);
assert.equal(applied.lead.wish?.downPayment, 6000);
assert.equal(applied.lead.desiredRate, 329);

// Bare „Leasing“ + Monate + km auch ohne Attachment
const bare = interpretSellerInput('Leasing 36 Monate 15.000 km Anzahlung 0 €');
assert.ok(bare.facts.some((f) => f.field === 'paymentType' && f.value === 'leasing'));

// Offer-PDF mit Beratung/Gültigkeitsdatum → Angebot, kein Termin-Primary
assert.equal(isOfferPdfDropContext([{ kind: 'configurator_pdf' }], 'PDF: x.pdf'), true);
assert.equal(hasExplicitAppointmentSellerCue('Schlag ihm Montag um 15 Uhr einen Termin vor.'), true);
assert.equal(hasExplicitAppointmentSellerCue('Wir laden Sie zur Beratung ein. Gültig bis 15.08.2026 10:00 Uhr'), false);

{
  const boilerplateOffer = `Kia EV2 Air Leasingangebot
Laufzeit 36 Monate
15.000 km / Jahr
Monatsrate 329 €
Wir laden Sie zur Beratung ein.
Gültig bis 15.08.2026 10:00 Uhr`;
  const { prepared, turn: attachTurn } = runComposerPdfAttachTurn({
    extracted: {
      ok: true,
      text: boilerplateOffer,
      fileName: 'EV2 Air 36 15.000 km.pdf',
    },
    file: { type: 'application/pdf', name: 'EV2 Air 36 15.000 km.pdf' },
    lead,
    leadsSnapshot: [lead],
    scopeHint: 'customer_akte',
    customerName: 'Kai Drechsel',
  });
  assert.equal(prepared.kind, 'configurator_pdf');
  assert.ok(attachTurn?.intents?.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));
  assert.ok(!attachTurn?.intents?.some((i) => i.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT));
  assert.ok(!attachTurn?.extractedFacts?.some((f) => f.factClass === SELLER_FACT_CLASS.APPOINTMENT_FACT));
  const attachReview = buildUniversalReviewModel(attachTurn);
  assert.notEqual(attachReview?.reviewType, 'appointment_and_message_review');
  assert.ok(
    ['offer_prepare', 'offer_incomplete', 'offer_and_message_review'].includes(attachReview?.reviewType),
    `attach reviewType=${attachReview?.reviewType}`,
  );
}

// Offer-PDF mit Institutions-Mail → PREPARE_OFFER, kein Inbound Treffer prüfen
{
  const withBankContact = `PDF: EV2 36 Monate Leasingangebot.pdf

Kia EV2 Earth Leasingangebot
Laufzeit 36 Monate
15.000 km / Jahr
Monatsrate 329 €
kundenservice@lease.kiafinance.de
Mit freundlichen Grüßen
Kia Finance`;
  const interpretedOffer = interpretSellerInput(withBankContact, {
    attachments: [{ kind: 'configurator_pdf', mimeType: 'application/pdf' }],
  });
  assert.ok(interpretedOffer.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));
  assert.ok(!interpretedOffer.intents.some((i) => i.type === SELLER_TURN_INTENTS.INBOUND_LEAD));
  assert.ok(!interpretedOffer.inboundContact?.email);

  const offerTurn = runCleverSellerTurn({
    lead: {},
    sellerInput: withBankContact,
    attachments: [{ kind: 'configurator_pdf', mimeType: 'application/pdf', fileName: 'EV2 36 Monate Leasingangebot.pdf' }],
    leadsSnapshot: [
      lead,
      { id: 'rambo', contact: { name: 'Rambo Gartenbau', email: 'a@b.de', phone: '0711' } },
    ],
    scopeHint: 'dashboard',
  });
  assert.ok(!offerTurn.inboundLead?.detected);
  assert.ok(offerTurn.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));
  const offerReview = offerTurn.reviewModel || buildUniversalReviewModel(offerTurn);
  assert.ok(
    ['offer_prepare', 'offer_incomplete', 'offer_and_message_review'].includes(offerReview?.reviewType),
    `offerPdf reviewType=${offerReview?.reviewType}`,
  );
}

console.log('mapMagicOfferIntentToSellerFacts.test.js: OK');
