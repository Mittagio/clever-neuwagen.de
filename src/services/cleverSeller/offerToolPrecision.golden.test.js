/**
 * Offer Tool Precision + PDF Merge Golden (Node)
 * Concept → same offerDraftId → PDF fill → conflict → replace → rate safety
 *
 * node --test src/services/cleverSeller/offerToolPrecision.golden.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import { createEmptyAgentWorkingMemory } from '../cleverAgent/cleverAgentWorkingMemory.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import {
  overlayMagicOntoOfferDraft,
  prepareMagicOffer,
} from '../dealer/magicOfferService.js';
import { interpretOfferFromPdfText } from '../dealer/interpretOfferFromPdfText.js';
import { applyCommercialConfirmPatch } from '../dealer/sellerOfferConfirmGate.js';
import { RATE_AUTHORITY } from './captureThenOffer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = join(__dirname, '../../../tests/fixtures');

async function extractPdfFixture(path, fileName) {
  const buf = readFileSync(path);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true }).promise;
  const chunks = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = (content.items ?? []).map((item) => item?.str ?? '').join(' ').replace(/\s+/g, ' ').trim();
    if (line) chunks.push(line);
  }
  const text = chunks.join('\n').trim();
  const dataUrl = `data:application/pdf;base64,${buf.toString('base64')}`;
  return {
    ok: text.length > 20,
    text,
    fileName,
    sizeBytes: buf.length,
    dataUrl,
  };
}

function baseLead() {
  return {
    id: 'lead-offer-tool-precision',
    name: 'Precision Kunde',
    contact: { name: 'Precision Kunde' },
    paymentType: 'leasing',
    wish: { paymentType: 'leasing' },
    crm: {
      needProfile: createEmptyNeedProfile(),
      focusedVehicleTrackId: null,
      vehicleConfigurations: [],
      vehicleOffers: {},
    },
  };
}

function prepOffer(turn) {
  return (turn.preparedActions || []).find((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER);
}

{
  // A) Concept EV2 ohne Defaults
  const turn = await runCleverSellerTurn({
    sellerInput: 'EV2 Angebot',
    lead: baseLead(),
    workingMemory: createEmptyAgentWorkingMemory(),
    options: { forceDeterministic: true },
  });
  const prep = prepOffer(turn);
  assert.ok(prep, 'Concept erzeugt PREPARE_OFFER');
  const draft = prep.payload?.offerDraft || prep.payload;
  const offerDraftId = draft?.offerDraftId || prep.payload?.offerDraftId;
  assert.ok(offerDraftId, 'offerDraftId vorhanden');
  const model = draft?.vehicleConfiguration?.model
    || draft?.vehicle?.model
    || draft?.vehicleIdentityDraft?.model?.raw
    || draft?.vehicleIdentityDraft?.model?.canonical;
  assert.match(String(model || ''), /EV2/i, 'Modell EV2');
  assert.equal(
    draft?.vehicleConfiguration?.trimLabel
      || draft?.vehicle?.trimLabel
      || draft?.vehicleIdentityDraft?.trim?.canonical
      || draft?.vehicleIdentityDraft?.trim?.raw
      || null,
    null,
    'Linie offen',
  );
  assert.equal(
    draft?.payment?.calculatedRate
      ?? draft?.offerPreview?.monthlyRate
      ?? null,
    null,
    'Rate fehlt',
  );
}

{
  // B) PDF Upload füllt denselben Draft + Evidence
  const extracted = await extractPdfFixture(
    join(fixtures, 'EV2_Earth_Leasing_289.pdf'),
    'EV2_Earth_Leasing_289.pdf',
  );
  assert.ok(extracted.ok, `PDF extract ok: ${extracted.error || extracted.text?.slice(0, 40)}`);
  assert.match(extracted.text, /EV2/i);
  assert.match(extracted.text, /289/);

  const offerDraftId = 'od-precision-A';
  const concept = {
    offerDraftId,
    vehicleIdentityDraftId: 'vid-precision-A',
    payment: { type: 'leasing' },
    offerPreview: {},
    offerCalculation: {},
    vehicle: { model: 'EV2', modelKey: 'ev2' },
    vehicleConfiguration: { model: 'EV2', modelKey: 'ev2' },
    source: {},
  };

  const interpretation = interpretOfferFromPdfText(extracted.text, {
    fileName: extracted.fileName,
    knownVehicle: { brand: 'Kia', model: 'EV2', modelKey: 'ev2' },
  });
  const preparation = prepareMagicOffer(extracted.text, {
    fromPdf: true,
    modelKey: 'ev2',
    originalPdf: {
      fileName: extracted.fileName,
      dataUrl: extracted.dataUrl,
      sizeBytes: extracted.sizeBytes,
      uploadedAt: '2026-09-05T12:00:00.000Z',
    },
    offerInterpretation: interpretation,
  });

  const merged = overlayMagicOntoOfferDraft(concept, preparation);
  assert.equal(merged.offerDraftId, offerDraftId, 'gleiche offerDraftId nach PDF');
  assert.equal(merged.vehicleConfiguration.modelKey, 'ev2');
  assert.match(String(merged.vehicleConfiguration.trimLabel || ''), /Earth/i);
  assert.equal(merged.payment.calculatedRate, 289);
  assert.equal(merged.rateAuthority, RATE_AUTHORITY.AUTHORITATIVE);
  assert.ok(merged.source?.originalPdf?.fileName?.includes('EV2_Earth'));
  assert.ok(merged.source?.originalPdf?.dataUrl?.startsWith('data:application/pdf'));
  assert.equal(merged.identityConflicts?.length || 0, 0, 'kein Konflikt bei leerem Trim');
  assert.equal(merged.rateNeedsReview, false);
}

{
  // C) Konflikt: Draft Earth + PDF Air → nur Trim-Konflikt, Rest übernimmt
  const extracted = await extractPdfFixture(
    join(fixtures, 'EV2_Earth_vs_Air_Conflict.pdf'),
    'EV2_Earth_vs_Air_Conflict.pdf',
  );
  assert.ok(extracted.ok, 'Conflict PDF extract');

  const offerDraftId = 'od-precision-conflict';
  const draftEarth = {
    offerDraftId,
    payment: { type: 'leasing' },
    offerPreview: {},
    offerCalculation: {},
    vehicle: { model: 'EV2', modelKey: 'ev2', trimLabel: 'Earth' },
    vehicleConfiguration: {
      model: 'EV2',
      modelKey: 'ev2',
      trimLabel: 'Earth',
      trimId: 'earth',
    },
    source: {},
  };

  const interpretation = interpretOfferFromPdfText(extracted.text, {
    knownVehicle: { brand: 'Kia', model: 'EV2', modelKey: 'ev2' },
  });
  const preparation = prepareMagicOffer(extracted.text, {
    fromPdf: true,
    modelKey: 'ev2',
    originalPdf: {
      fileName: extracted.fileName,
      dataUrl: extracted.dataUrl,
      sizeBytes: extracted.sizeBytes,
      uploadedAt: '2026-09-05T12:10:00.000Z',
    },
    offerInterpretation: interpretation,
  });

  const merged = overlayMagicOntoOfferDraft(draftEarth, preparation);
  assert.equal(merged.offerDraftId, offerDraftId);
  assert.equal(merged.vehicleConfiguration.trimLabel, 'Earth', 'Trim bleibt bis Entscheidung');
  const trimConflict = (merged.identityConflicts || []).find((c) => c.field === 'trim');
  assert.ok(trimConflict, 'Trim-Konflikt vorhanden');
  assert.equal(trimConflict.label, 'Variante prüfen');
  assert.match(String(trimConflict.draftValue), /Earth/i);
  assert.match(String(trimConflict.pdfValue), /Air/i);
  assert.ok(trimConflict.choices?.some((c) => /Air.*übernehmen|übernehmen/i.test(c.label)));
  assert.ok(trimConflict.choices?.some((c) => /Earth.*behalten|behalten/i.test(c.label)));
  assert.equal(merged.payment.calculatedRate, 301.5, 'Commercial Rate aus PDF');
  assert.equal(merged.payment.termMonths, 36, 'Laufzeit aus PDF');
  assert.equal(merged.rateNeedsReview, true, 'Konflikt → Rate prüfen');

  // Air übernehmen → Konflikt weg, Rate belastbar
  const takePdf = applyCommercialConfirmPatch(merged, {
    trimLabel: 'Air',
    trimId: 'air',
    resolveIdentityConflict: { field: 'trim' },
    rateNeedsReview: false,
  });
  assert.equal(takePdf.vehicleConfiguration.trimLabel, 'Air');
  assert.equal((takePdf.identityConflicts || []).length, 0);
  assert.equal(takePdf.rateNeedsReview, false);
  assert.equal(takePdf.payment.calculatedRate, 301.5);
}

{
  // D) PDF Replace: gleicher Draft, neue Evidence, previousPdfs
  const ex1 = await extractPdfFixture(
    join(fixtures, 'EV2_Earth_Leasing_289.pdf'),
    'EV2_Earth_Leasing_289.pdf',
  );
  const ex2 = await extractPdfFixture(
    join(fixtures, 'EV2_Earth_Leasing_275_replace.pdf'),
    'EV2_Earth_Leasing_275_replace.pdf',
  );
  assert.ok(ex1.ok && ex2.ok);

  const offerDraftId = 'od-precision-replace';
  let draft = {
    offerDraftId,
    payment: { type: 'leasing' },
    offerPreview: {},
    offerCalculation: {},
    vehicle: { model: 'EV2', modelKey: 'ev2' },
    vehicleConfiguration: { model: 'EV2', modelKey: 'ev2' },
    source: {},
  };

  const prep1 = prepareMagicOffer(ex1.text, {
    fromPdf: true,
    modelKey: 'ev2',
    originalPdf: {
      fileName: ex1.fileName,
      dataUrl: ex1.dataUrl,
      sizeBytes: ex1.sizeBytes,
      uploadedAt: '2026-09-05T12:20:00.000Z',
    },
    offerInterpretation: interpretOfferFromPdfText(ex1.text, {
      knownVehicle: { modelKey: 'ev2', model: 'EV2' },
    }),
  });
  draft = overlayMagicOntoOfferDraft(draft, prep1);
  const previousPdf = draft.source.originalPdf;
  assert.equal(draft.payment.calculatedRate, 289);

  const prep2 = prepareMagicOffer(ex2.text, {
    fromPdf: true,
    modelKey: 'ev2',
    originalPdf: {
      fileName: ex2.fileName,
      dataUrl: ex2.dataUrl,
      sizeBytes: ex2.sizeBytes,
      uploadedAt: '2026-09-05T12:30:00.000Z',
    },
    offerInterpretation: interpretOfferFromPdfText(ex2.text, {
      knownVehicle: { modelKey: 'ev2', model: 'EV2' },
    }),
  });
  draft = {
    ...overlayMagicOntoOfferDraft(draft, prep2),
    source: {
      ...overlayMagicOntoOfferDraft(draft, prep2).source,
      previousPdfs: [previousPdf],
    },
  };

  assert.equal(draft.offerDraftId, offerDraftId, 'Replace behält offerDraftId');
  assert.equal(draft.payment.calculatedRate, 275, 'Neue Rate');
  assert.match(draft.source.originalPdf.fileName, /275_replace/);
  assert.equal(draft.source.previousPdfs.length, 1);
  assert.match(draft.source.previousPdfs[0].fileName, /289/);
}

console.log('offerToolPrecision.golden.test.js OK');
