/**
 * Phase 1 – Offer Review Presenter (Arbeitsstand, eine Primary, kein Review-Chrome)
 *
 * node --test src/services/cleverSeller/offerReview.presenter.phase1.golden.test.js
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import { runComposerPdfAttachTurn } from './runComposerPdfAttachTurn.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { buildUniversalReviewModel } from './buildUniversalReviewModel.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { RATE_AUTHORITY } from './captureThenOffer.js';

const HAP_EV6 = `
Freibleibende Kalkulation
Kia EV6 84 kWh 478 kW Allradantrieb GT
Lackierung: Auroraschwarz Metallic
Winterräder 21 Zoll 2.016,80 EUR
Gesamtlistenpreis inkl. Sonderausstattung & Zubehör 61.655,46 EUR
Alle Preise ohne USt
Monatliche Gesamtrate
Die monatliche Gesamtrate ist jeweils zum Ersten eines Kalendermonats vorschüssig fällig,
beginnend ab Übergabe des Fahrzeugs 759,46 EUR
Monatsrate Finanzleasing 733,69 EUR
Monatsrate Logistik 25,77 EUR
Anzahlung 0,00 EUR
Laufzeit 48 Monate
Laufleistung / Jahr 20.000 km
Alle Preise ohne USt
`;

function offerSection(review) {
  return (review?.actionSections || []).find((s) => (
    s.kind === 'offer_prepare' || s.kind === 'offer_incomplete'
  ));
}

function primaryActions(review) {
  return offerSection(review)?.primaryActions || [];
}

describe('Offer Review Presenter Phase 1', () => {
  it('A: Complete + ready → eine Primary „An Kunden senden“, kein Review-Chrome', () => {
    const lead = {
      id: 'lead-ev6',
      name: 'Test',
      contact: { name: 'Test' },
      wish: {},
      crm: { needProfile: createEmptyNeedProfile() },
    };
    const { turn } = runComposerPdfAttachTurn({
      extracted: { ok: true, text: HAP_EV6, fileName: 'Freibleibende Kalkulation.pdf' },
      file: { type: 'application/pdf', name: 'Freibleibende Kalkulation.pdf' },
      lead,
      leadsSnapshot: [lead],
      scopeHint: 'dashboard',
      customerName: 'Test',
    });
    const review = buildUniversalReviewModel(turn);
    const sec = offerSection(review);
    assert.ok(sec);
    assert.equal(sec.kind, 'offer_prepare');
    assert.equal(primaryActions(review).length, 1);
    assert.equal(primaryActions(review)[0].label, 'An Kunden senden');
    assert.ok(!primaryActions(review).some((a) => a.action === 'clarify_offer_identity'));
    assert.ok(!(sec.secondaryActions || []).some((a) => a.action === 'toggle_context'));
    assert.ok(!(sec.secondaryActions || []).some((a) => a.action === 'discard'));
    assert.equal(review.collapsedContext, null);
    assert.equal(review.conflictBox, null);
    assert.ok(!primaryActions(review).some((a) => a.action === 'upload_pdf'));
    assert.match(String(review.offerReview?.heroLine || ''), /EV6/i);
    assert.match(String(review.offerReview?.conditionsLine || ''), /759,46/);
  });

  it('B: Incomplete / missing rate → eine Primary „Angebot vervollständigen“, PDF nur sekundär', () => {
    const lead = {
      id: 'lead-inc',
      name: 'Kai',
      contact: { name: 'Kai' },
      paymentType: 'leasing',
      wish: {
        model: 'EV3',
        trim: 'Air',
        paymentType: 'leasing',
        termMonths: 36,
        mileagePerYear: 15000,
        downPayment: 0,
      },
      crm: { needProfile: createEmptyNeedProfile() },
    };
    const turn = runCleverSellerTurn({
      lead,
      sellerInput: 'Erstelle ein Leasingangebot Kia EV3 Air.',
      customerName: 'Kai',
      scopeHint: 'dashboard',
    });
    const review = buildUniversalReviewModel(turn);
    const sec = offerSection(review);
    if (!sec) return;
    assert.equal(primaryActions(review).length, 1);
    assert.equal(primaryActions(review)[0].label, 'Angebot vervollständigen');
    assert.equal(primaryActions(review)[0].action, 'open_offer_handoff');
    assert.ok(!primaryActions(review).some((a) => a.action === 'intend_send'));
    assert.ok(!primaryActions(review).some((a) => a.action === 'upload_pdf'));
    const pdfSec = (sec.secondaryActions || []).find((a) => a.action === 'upload_pdf');
    if (pdfSec) assert.equal(pdfSec.tone, 'compact');
    assert.ok(!(sec.secondaryActions || []).some((a) => a.action === 'toggle_context'));
    assert.ok(!(sec.secondaryActions || []).some((a) => a.action === 'discard'));
  });

  it('C: lokaler Identity-Konflikt → localClarify, Hero bleibt, keine Choice-Wolke', () => {
    const review = buildUniversalReviewModel({
      extractedFacts: [
        {
          field: 'vehicleInterest',
          label: 'PDF: EV6 GT vs Akte: EV6 Air',
          value: {
            modelKey: 'ev6',
            trim: 'GT',
            conflictWithActive: true,
            pdfLabel: 'EV6 GT',
            activeLabel: 'EV6 Air',
          },
          source: 'offer_pdf',
          needsConfirmation: true,
        },
        {
          field: 'monthlyBudget',
          label: '759,46 € netto / Monat',
          value: { amount: 759.46, basis: 'net' },
          source: 'offer_pdf',
          needsConfirmation: false,
          rateAuthority: RATE_AUTHORITY.AUTHORITATIVE,
        },
      ],
      preparedActions: [{
        type: SELLER_TURN_INTENTS.PREPARE_OFFER,
        status: 'prepared',
        payload: {
          canCreateOffer: true,
          monthlyRate: 759.46,
          rateAuthority: RATE_AUTHORITY.AUTHORITATIVE,
          vehicleLabel: 'Kia EV6 GT',
          identityConflicts: [{
            field: 'trim',
            label: 'Trim weicht ab',
            draftValue: 'Air',
            pdfValue: 'GT',
          }],
        },
      }],
      resolvedCustomer: { id: 'l1', name: 'Test' },
      missingInformation: [],
      warnings: [],
      scopeHint: 'customer_akte',
    });
    const sec = offerSection(review);
    assert.ok(sec);
    assert.equal(primaryActions(review).length, 1);
    assert.ok(!primaryActions(review).some((a) => a.action === 'clarify_offer_identity'));
    assert.ok(!primaryActions(review).some((a) => a.action === 'resolve_identity_conflict'));
    assert.ok(sec.localClarify || review.offerReview?.localClarify);
    const clarify = sec.localClarify || review.offerReview.localClarify;
    assert.match(String(clarify.title || ''), /prüfen|Variante/i);
  });

  it('D: sichere Netto-PDF-Werte → keine globale Warnbox', () => {
    const lead = {
      id: 'lead-net',
      name: 'Test',
      contact: { name: 'Test' },
      wish: {},
      crm: { needProfile: createEmptyNeedProfile() },
    };
    const { turn } = runComposerPdfAttachTurn({
      extracted: { ok: true, text: HAP_EV6, fileName: 'x.pdf' },
      file: { type: 'application/pdf', name: 'x.pdf' },
      lead,
      leadsSnapshot: [lead],
      scopeHint: 'dashboard',
      customerName: 'Test',
    });
    const review = buildUniversalReviewModel(turn);
    assert.equal(review.conflictBox, null);
    assert.ok(!(review.warnings || []).some((w) => /Netto|bitte prüfen/i.test(String(w))));
  });

  it('E: normale Offer-Card → kein toggle/discard/identity-cloud; max eine Primary', () => {
    const lead = {
      id: 'lead-e',
      name: 'Test',
      contact: { name: 'Test' },
      wish: {},
      crm: { needProfile: createEmptyNeedProfile() },
    };
    const { turn } = runComposerPdfAttachTurn({
      extracted: { ok: true, text: HAP_EV6, fileName: 'x.pdf' },
      file: { type: 'application/pdf', name: 'x.pdf' },
      lead,
      leadsSnapshot: [lead],
      scopeHint: 'customer_akte',
      customerName: 'Test',
    });
    const review = buildUniversalReviewModel(turn);
    const sec = offerSection(review);
    assert.ok(sec);
    assert.equal(primaryActions(review).length, 1);
    assert.ok(!(sec.secondaryActions || []).some((a) => (
      a.action === 'toggle_context' || a.action === 'discard'
    )));
    assert.ok(!primaryActions(review).some((a) => a.action === 'clarify_offer_identity'));
    assert.equal(review.secondaryCta, null);
  });
});
