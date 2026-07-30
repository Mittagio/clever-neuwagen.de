/**
 * Tests: Vehicle Tracks, Offer Interpreter, Golden Moment (Herr Brandes).
 */
import assert from 'node:assert/strict';
import {
  listCustomerVehicleTracks,
  applyTrackFeedbackFacts,
  VEHICLE_TRACK_STATUS,
  REJECTION_REASON,
  sortTracksForOverview,
  ensureVehicleTrack,
  filterTracksByStatus,
} from './vehicleTrack.js';
import {
  validateOfferInterpretation,
  detectRateAmbiguity,
  buildOfferReviewModel,
} from '../dealer/offerInterpreterSchema.js';
import { interpretOfferFromPdfText } from '../dealer/interpretOfferFromPdfText.js';
import { interpretOfferFromPdf } from '../dealer/interpretOfferFromPdfWithOpenAi.js';
import { buildGoldenMoment, GOLDEN_MOMENT_TYPE } from '../journey/goldenMoment.js';
import { createNextOfferVersion, createVehicleOfferFromCard } from '../vehicleOffer.js';
import { interpretSellerInput } from '../cleverSeller/interpretSellerInput.js';
import { applyAcceptedSellerTurn } from '../cleverSeller/applyAcceptedSellerTurn.js';
import { mapSellerFactsToTrackFeedback } from '../cleverSeller/mapSellerFactsToTrackFeedback.js';
import { overlayOfferInterpretationOntoIntent } from '../dealer/magicOfferService.js';
import { parseMagicOfferIntent } from '../dealer/magicOfferIntentParser.js';

function brandesLead() {
  return {
    id: 'lead-brandes',
    name: 'Herr Brandes',
    crm: {
      vehicleConfigurations: [
        {
          id: 'vc-tivoli',
          model: 'Tivoli',
          modelKey: 'tivoli',
          leasingData: {
            calculatedRate: 329,
            termMonths: 48,
            mileagePerYear: 15000,
            downPayment: 0,
          },
          vehicleTrack: { status: VEHICLE_TRACK_STATUS.OPEN },
        },
        {
          id: 'vc-xceed',
          model: 'XCeed',
          modelKey: 'xceed',
          leasingData: {
            calculatedRate: 347,
            termMonths: 48,
            mileagePerYear: 15000,
            downPayment: 0,
          },
          vehicleTrack: { status: VEHICLE_TRACK_STATUS.OPEN },
        },
        {
          id: 'vc-sportage',
          model: 'Sportage',
          modelKey: 'sportage',
          leasingData: {
            calculatedRate: 389,
            termMonths: 48,
            mileagePerYear: 15000,
            downPayment: 0,
          },
          vehicleTrack: { status: VEHICLE_TRACK_STATUS.OPEN },
        },
      ],
      vehicleOffers: {
        'vc-tivoli': {
          id: 'vo-tivoli',
          status: 'sent',
          sentAt: '2026-07-29T10:00:00.000Z',
          version: 1,
          pdf: { fileName: 'Tivoli_Brandes.pdf', dataUrl: 'data:application/pdf;base64,AAA' },
        },
        'vc-xceed': {
          id: 'vo-xceed',
          status: 'opened',
          sentAt: '2026-07-29T10:00:00.000Z',
          version: 1,
          tracking: { openCount: 1, firstOpenedAt: '2026-07-29T12:00:00.000Z' },
          pdf: { fileName: 'XCeed_Brandes.pdf', dataUrl: 'data:application/pdf;base64,BBB' },
        },
        'vc-sportage': {
          id: 'vo-sportage',
          status: 'sent',
          sentAt: '2026-07-29T10:00:00.000Z',
          version: 1,
          pdf: { fileName: 'Sportage_Brandes.pdf', dataUrl: 'data:application/pdf;base64,CCC' },
        },
      },
    },
  };
}

// --- 3 Spuren ---
{
  const tracks = listCustomerVehicleTracks(brandesLead());
  assert.equal(tracks.length, 3);
  assert.ok(tracks.every((t) => t.monthlyRate != null));
  assert.ok(tracks.find((t) => t.modelLabel === 'Tivoli')?.sourcePdfName);
}

// --- Feedback: Sportage deferred, XCeed favorite + requirements ---
{
  let lead = brandesLead();
  lead = applyTrackFeedbackFacts(lead, [
    {
      trackId: 'vc-sportage',
      status: VEHICLE_TRACK_STATUS.DEFERRED,
      rejectionReason: REJECTION_REASON.PRICE_TOO_HIGH,
    },
    {
      trackId: 'vc-xceed',
      status: VEHICLE_TRACK_STATUS.FAVORITE,
      preferredColor: 'Rot',
      deliveryTimeImportance: 'high',
      customerRequirements: ['AHK wichtig', 'Rot', 'Lieferzeit wichtig'],
    },
  ]);
  const tracks = sortTracksForOverview(listCustomerVehicleTracks(lead));
  const sportage = tracks.find((t) => t.id === 'vc-sportage');
  const xceed = tracks.find((t) => t.id === 'vc-xceed');
  const tivoli = tracks.find((t) => t.id === 'vc-tivoli');

  assert.equal(sportage.status, VEHICLE_TRACK_STATUS.DEFERRED);
  assert.equal(sportage.rejectionReasonLabel, 'zu teuer');
  assert.ok(lead.crm.vehicleConfigurations.find((c) => c.id === 'vc-sportage')); // nicht gelöscht
  assert.equal(xceed.status, VEHICLE_TRACK_STATUS.FAVORITE);
  assert.ok(xceed.requirementLabels.includes('AHK wichtig'));
  assert.ok(xceed.requirementLabels.some((l) => /rot/i.test(l)));
  assert.ok(xceed.requirementLabels.some((l) => /lieferzeit/i.test(l)));
  assert.equal(tivoli.status, VEHICLE_TRACK_STATUS.OPEN);
  assert.equal(tracks[0].id, 'vc-xceed'); // Favorit zuerst
}

// --- Golden Moment Brandes ---
{
  let lead = brandesLead();
  lead = applyTrackFeedbackFacts(lead, [
    {
      trackId: 'vc-sportage',
      status: VEHICLE_TRACK_STATUS.DEFERRED,
      rejectionReason: REJECTION_REASON.PRICE_TOO_HIGH,
    },
    {
      trackId: 'vc-xceed',
      status: VEHICLE_TRACK_STATUS.FAVORITE,
      preferredColor: 'Rot',
      deliveryTimeImportance: 'high',
      customerRequirements: ['AHK wichtig', 'Rot', 'Lieferzeit wichtig'],
    },
  ]);
  const moment = buildGoldenMoment(lead);
  assert.ok(moment);
  assert.equal(moment.type, GOLDEN_MOMENT_TYPE.FAVORITE_NEEDS_REVISED_OFFER);
  assert.equal(moment.recommendedAction, 'prepare_revised_offer');
  assert.match(moment.headline, /XCeed/i);
  assert.match(moment.primaryLabel, /XCeed/i);
  assert.equal(moment.score, null);
  assert.equal(moment.closureChance, null);
  assert.ok(!/%/.test(JSON.stringify(moment)));
}

// --- PDF Interpreter: eindeutige Werte ---
{
  const result = validateOfferInterpretation({
    offerType: 'leasing',
    vehicle: { brand: 'Kia', model: 'XCeed', trim: 'GT-Line', engine: null, color: null },
    monthlyRate: 347,
    termMonths: 48,
    annualMileage: 15000,
    downPayment: 0,
    purchasePrice: null,
    finalPayment: null,
    transferFee: null,
    apr: null,
    nominalInterest: null,
    totalAmount: null,
    extraMileageCost: null,
    underMileageCredit: null,
    deliveryEstimate: null,
    validUntil: null,
    confidence: { monthlyRate: 0.99 },
    evidence: {
      monthlyRate: {
        sourceText: 'monatliche Leasingrate 347,00 EUR',
        page: 1,
        confidence: 0.99,
      },
    },
    ambiguities: [],
    warnings: [],
  });
  assert.equal(result.interpretation.monthlyRate, 347);
  assert.ok(result.interpretation.evidence.monthlyRate.sourceText.includes('347'));
  const review = buildOfferReviewModel(result);
  assert.match(review.title, /erkannt/i);
  assert.ok(review.canAccept);
}

// --- Widersprüchliche Rate ---
{
  const ambiguity = detectRateAmbiguity([
    { value: 329, sourceText: 'Rate 329 EUR' },
    { value: 347, sourceText: 'Leasingrate 347,00 EUR' },
  ]);
  assert.ok(ambiguity);
  assert.equal(ambiguity.field, 'monthlyRate');
  assert.equal(ambiguity.candidates.length, 2);

  const result = validateOfferInterpretation({
    ...{
      offerType: 'leasing',
      vehicle: { brand: null, model: null, trim: null, engine: null, color: null },
      monthlyRate: null,
      termMonths: 48,
      annualMileage: null,
      downPayment: 0,
      purchasePrice: null,
      finalPayment: null,
      transferFee: null,
      apr: null,
      nominalInterest: null,
      totalAmount: null,
      extraMileageCost: null,
      underMileageCredit: null,
      deliveryEstimate: null,
      validUntil: null,
      confidence: {},
      evidence: {},
      ambiguities: [ambiguity],
      warnings: [],
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reviewNeeded, true);
  assert.ok(result.interpretation.ambiguities[0].message.includes('nicht eindeutig'));
}

// --- Angebotsversion ---
{
  const v1 = createVehicleOfferFromCard({ id: 'vc-xceed' }, {
    id: 'vo-xceed',
    vehicleCardId: 'vc-xceed',
    status: 'opened',
    version: 1,
    monthlyRate: 347,
    pdf: { fileName: 'XCeed_v1.pdf', dataUrl: 'data:...' },
    sentAt: '2026-07-29T10:00:00.000Z',
    tracking: { openCount: 1, firstOpenedAt: '2026-07-29T12:00:00.000Z' },
  });
  const v2 = createNextOfferVersion(v1, {
    monthlyRate: 369,
    boardOffer: { payment: { monthlyRate: 369, termMonths: 48 } },
  });
  assert.equal(v2.version, 2);
  assert.equal(v2.status, 'draft');
  assert.equal(v1.version, 1);
  assert.equal(v2.versions.length, 1);
  assert.equal(v2.versions[0].monthlyRate, 347);
  assert.ok(v2.versions[0].pdf?.fileName);
}

// --- ensure track ohne Doppelung ---
{
  const lead = brandesLead();
  const again = ensureVehicleTrack(lead, {
    vehicleKey: 'kia-xceed',
    model: 'XCeed',
    modelKey: 'xceed',
  });
  assert.equal(again.created, false);
  assert.equal(again.trackId, 'vc-xceed');
}

// --- PDF Interpreter Bridge: eindeutige Rate ---
{
  const result = interpretOfferFromPdfText(
    'Kia XCeed GT-Line\nLeasinglaufzeit 48 Monate\nJahresfahrleistung 15.000 km\nmonatliche Leasingrate 347,00 EUR\nSonderzahlung 0 EUR',
    { fileName: 'XCeed_Brandes.pdf' },
  );
  assert.equal(result.interpretation.monthlyRate, 347);
  assert.equal(result.interpretation.termMonths, 48);
  assert.ok(result.review.canAccept);
}

// --- PDF Interpreter Bridge: widersprüchliche Raten ---
{
  const result = interpretOfferFromPdfText(
    'Rate 329 EUR und alternativ monatliche Leasingrate 347,00 EUR',
  );
  assert.equal(result.ok, false);
  assert.ok(result.interpretation.ambiguities.some((a) => a.field === 'monthlyRate'));
}

// --- OpenAI Fallback ohne API-Key ---
{
  const result = await interpretOfferFromPdf(
    'Kia XCeed GT-Line\nmonatliche Leasingrate 347,00 EUR\n48 Monate\n15.000 km',
    { fileName: 'XCeed.pdf' },
    { apiKey: null },
  );
  assert.equal(result.source, 'pdf_text_deterministic');
  assert.equal(result.openaiError, 'missing_api_key');
  assert.equal(result.interpretation.monthlyRate, 347);
  assert.ok(result.review);
}

// --- OpenAI Fallback bei HTTP-Fehler ---
{
  const result = await interpretOfferFromPdf(
    'Leasingrate 329,00 EUR · 36 Monate · 10.000 km',
    {},
    {
      apiKey: 'test-key',
      fetchImpl: async () => ({ ok: false, status: 500 }),
    },
  );
  assert.equal(result.source, 'pdf_text_deterministic');
  assert.equal(result.openaiError, 'openai_http_500');
  assert.equal(result.interpretation.monthlyRate, 329);
}

// --- OpenAI Erfolg mit Structured JSON ---
{
  const result = await interpretOfferFromPdf(
    'irgendein pdf text mit Rate irgendwo',
    {},
    {
      apiKey: 'test-key',
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                offerType: 'leasing',
                vehicle: {
                  brand: 'Kia', model: 'XCeed', trim: 'GT-Line', engine: null, color: null,
                },
                monthlyRate: 347,
                termMonths: 48,
                annualMileage: 15000,
                downPayment: 0,
                purchasePrice: null,
                finalPayment: null,
                transferFee: null,
                apr: null,
                nominalInterest: null,
                totalAmount: null,
                extraMileageCost: null,
                underMileageCredit: null,
                deliveryEstimate: null,
                validUntil: null,
                confidence: { monthlyRate: 0.95 },
                evidence: {
                  monthlyRate: { sourceText: 'Leasingrate 347 EUR', page: 1, confidence: 0.95 },
                },
                ambiguities: [],
                warnings: [],
              }),
            },
          }],
        }),
      }),
    },
  );
  assert.equal(result.source, 'openai');
  assert.equal(result.interpretation.monthlyRate, 347);
  assert.ok(result.review.canAccept);
}

// --- Overlay: Ambiguity blockiert Rate ---
{
  const intent = parseMagicOfferIntent('XCeed Leasing');
  overlayOfferInterpretationOntoIntent(intent, {
    interpretation: {
      monthlyRate: null,
      termMonths: 48,
      annualMileage: 15000,
      downPayment: 0,
      offerType: 'leasing',
      vehicle: { model: 'XCeed' },
      ambiguities: [{
        field: 'monthlyRate',
        message: 'nicht eindeutig',
        candidates: [{ value: 329 }, { value: 347 }],
      }],
    },
  });
  assert.equal(intent.commercialInput.monthlyRate, null);
  assert.equal(intent.commercialInput.durationMonths, 48);
  assert.equal(intent.offerType, 'leasing');
}

// --- Angebote-Filter ---
{
  let lead = brandesLead();
  lead = applyTrackFeedbackFacts(lead, [
    {
      trackId: 'vc-sportage',
      status: VEHICLE_TRACK_STATUS.DEFERRED,
      rejectionReason: REJECTION_REASON.PRICE_TOO_HIGH,
    },
    {
      trackId: 'vc-xceed',
      status: VEHICLE_TRACK_STATUS.FAVORITE,
    },
  ]);
  const tracks = listCustomerVehicleTracks(lead);
  assert.equal(filterTracksByStatus(tracks, 'all').length, 3);
  assert.equal(filterTracksByStatus(tracks, 'deferred').length, 1);
  assert.equal(filterTracksByStatus(tracks, 'deferred')[0].id, 'vc-sportage');
  const active = filterTracksByStatus(tracks, 'active');
  assert.ok(active.every((t) => t.status !== VEHICLE_TRACK_STATUS.DEFERRED));
  assert.ok(active.some((t) => t.id === 'vc-xceed'));
}

// --- Seller-Facts → Track-Feedback (Brandes Review→Accept) ---
{
  const interpreted = interpretSellerInput(
    'Sportage zu teuer, XCeed Favorit, AHK wichtig, Farbe rot, Lieferzeit bis 11.2026 wichtig',
  );
  assert.ok(interpreted.facts.some((f) => (
    f.field === 'vehicleTrackFeedback'
    && f.value?.modelKey === 'sportage'
    && f.value?.status === VEHICLE_TRACK_STATUS.DEFERRED
  )));
  assert.ok(interpreted.facts.some((f) => (
    f.field === 'vehicleTrackFeedback'
    && f.value?.modelKey === 'xceed'
    && f.value?.status === VEHICLE_TRACK_STATUS.FAVORITE
  )));
  // Vor Accept: needsConfirmation → kein Blind-Persist
  const pending = mapSellerFactsToTrackFeedback(interpreted.facts, brandesLead());
  assert.equal(pending.length, 0);

  const turn = {
    extractedFacts: interpreted.facts.map((f) => ({ ...f, needsConfirmation: false })),
  };
  const applied = applyAcceptedSellerTurn(brandesLead(), turn, { postFeedCard: false });
  assert.ok(applied.ok);
  const tracks = sortTracksForOverview(listCustomerVehicleTracks(applied.lead));
  const sportage = tracks.find((t) => t.id === 'vc-sportage');
  const xceed = tracks.find((t) => t.id === 'vc-xceed');
  assert.equal(sportage.status, VEHICLE_TRACK_STATUS.DEFERRED);
  assert.ok(leadConfigsStillPresent(applied.lead));
  assert.equal(xceed.status, VEHICLE_TRACK_STATUS.FAVORITE);
  assert.ok(xceed.requirementLabels.some((l) => /ahk/i.test(l)));
  assert.ok(xceed.requirementLabels.some((l) => /rot/i.test(l)));
  assert.ok(xceed.requirementLabels.some((l) => /lieferzeit/i.test(l)));

  const moment = buildGoldenMoment(applied.lead);
  assert.ok(moment);
  assert.equal(moment.type, GOLDEN_MOMENT_TYPE.FAVORITE_NEEDS_REVISED_OFFER);
}

function leadConfigsStillPresent(lead) {
  const ids = (lead.crm?.vehicleConfigurations ?? []).map((c) => c.id);
  return ids.includes('vc-sportage') && ids.includes('vc-xceed') && ids.includes('vc-tivoli');
}

console.log('vehicleTrack.goldenMoment.offerInterpreter.test.js: ok');
