/**
 * Slice 13: Global Composer PDF-Attach
 * node --test src/services/cleverSeller/globalComposer.slice13.test.js
 */
import assert from 'node:assert/strict';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { runComposerPdfAttachTurn } from './runComposerPdfAttachTurn.js';
import { createBrandesGoldenCaseLead } from '../crm/brandesGoldenCase.js';

const GOLDEN_CONTRACT = `Leasingvertrag
Kunde Herr Brandes
Ford Kuga
Vertragsbeginn 01.12.2022
Laufzeit 48 Monate
15.000 km jährlich
Rate 329 Euro
Sonderzahlung 0 Euro
Vertragsende 30.11.2026
Mehrkilometer 8 Cent
Minderkilometer 3 Cent`;

const OFFER_PDF = `Kia EV2 GT-Line Leasingangebot
Laufzeit 36 Monate
15.000 km / Jahr
Anzahlung 6.000 €
Monatsrate 329 €
Keine Schlussrate`;

// --- Dashboard: contract PDF resolves Brandes from snapshot ---
{
  const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });
  const { prepared, turn, skipped } = runComposerPdfAttachTurn({
    extracted: {
      ok: true,
      text: GOLDEN_CONTRACT,
      fileName: 'vertrag-brandes.pdf',
    },
    file: { type: 'application/pdf', name: 'vertrag-brandes.pdf' },
    lead: {},
    leadsSnapshot: [brandes],
    scopeHint: 'dashboard',
  });
  assert.equal(skipped, false);
  assert.equal(prepared.kind, 'contract_pdf');
  assert.ok(turn);
  assert.ok(turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT && a.status === 'prepared'
  )));
  assert.equal(turn.contractDraft?.monthlyRate, 329);
  assert.equal(turn.contractDraft?.sourceDocument?.sourceType, 'contract_pdf');
  assert.ok(
    turn.resolvedCustomer?.id === brandes.id
    || turn.contractDraft?.customerNameHint,
  );
  assert.ok(shouldShowUniversalReview(turn));
  assert.equal(buildUniversalReviewModel(turn).reviewType, 'contract_import_review');
}

// --- Accept from dashboard snapshot ---
{
  const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });
  const { turn } = runComposerPdfAttachTurn({
    extracted: { ok: true, text: GOLDEN_CONTRACT, fileName: 'vertrag-brandes.pdf' },
    lead: brandes,
    leadsSnapshot: [brandes],
    scopeHint: 'dashboard',
    customerName: 'Brandes',
  });
  const applied = applyAcceptedSellerTurn(brandes, turn, { postFeedCard: false });
  assert.ok(applied.ok);
  assert.equal(applied.lead.crm.customerContracts[0].commercialTerms.monthlyRate, 329);
  assert.equal(applied.lead.wish?.leasingEndDate, '2026-11-30');
}

// --- Offer PDF on dashboard is not contract import ---
{
  const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });
  const { prepared, turn } = runComposerPdfAttachTurn({
    extracted: { ok: true, text: OFFER_PDF, fileName: 'GT-LINE.pdf' },
    lead: {},
    leadsSnapshot: [brandes],
    scopeHint: 'dashboard',
  });
  assert.equal(prepared.kind, 'configurator_pdf');
  assert.ok(!turn?.preparedActions?.some((a) => (
    a.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT && a.status === 'prepared'
  )));
}

// --- Empty contract scan → blocked import ---
{
  const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });
  const { prepared, turn } = runComposerPdfAttachTurn({
    extracted: {
      ok: false,
      text: '',
      fileName: 'leasingvertrag-scan.pdf',
      needsManualDescribe: true,
    },
    lead: brandes,
    leadsSnapshot: [brandes],
    scopeHint: 'dashboard',
  });
  assert.equal(prepared.kind, 'contract_pdf');
  assert.equal(prepared.needsManualDescribe, true);
  const action = turn?.preparedActions?.find((a) => (
    a.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT
  ));
  assert.equal(action?.status, 'blocked');
}

console.log('globalComposer.slice13.test.js: ok');
