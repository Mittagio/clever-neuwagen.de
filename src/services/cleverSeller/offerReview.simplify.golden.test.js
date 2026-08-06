/**
 * Offer/Message-Review: Ergebnis + Konflikt + Aktionen (kein Diagnoseprotokoll)
 * node --test src/services/cleverSeller/offerReview.simplify.golden.test.js
 */
import assert from 'node:assert/strict';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { buildUniversalReviewModel } from './buildUniversalReviewModel.js';
import { runComposerPdfAttachTurn } from './runComposerPdfAttachTurn.js';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import {
  COMPOSER_PRIMARY_CHIPS,
  OFFER_REVIEW_CHIPS,
  resolveComposerChipsForReview,
} from '../crm/composerSuggestionService.js';
import { buildDocumentWorkingContextItem } from '../crm/composerWorkingContext.js';
import { buildOfferAttachmentLabel } from './buildOfferAttachmentLabel.js';
import { INVALID_DISCOUNT_WARNING } from './validateDiscountPercent.js';

const kaiLead = {
  id: 'lead-kai-drechsel',
  name: 'Kai Drechsel',
  contact: { name: 'Kai Drechsel', salutation: 'herr' },
  wish: {
    model: 'EV2',
    trim: 'Air',
    paymentType: 'leasing',
    termMonths: 36,
    mileagePerYear: 15000,
  },
  crm: { needProfile: createEmptyNeedProfile() },
};

const leasingPdfText = `Freibleibende Kalkulation
Kia EV2 Air Leasingangebot
Laufzeit 36 Monate
15.000 km / Jahr
Monatsrate 329 €
Rabatt 449 %
`;

// --- PDF in Akte: kompakte Offer-Review ---
{
  const { turn } = runComposerPdfAttachTurn({
    extracted: {
      ok: true,
      text: leasingPdfText,
      fileName: 'Freibleibende Kalkulation.pdf',
    },
    file: { type: 'application/pdf', name: 'Freibleibende Kalkulation.pdf' },
    lead: kaiLead,
    leadsSnapshot: [kaiLead],
    scopeHint: 'customer_akte',
    customerName: 'Kai Drechsel',
  });
  assert.ok(turn);
  const review = buildUniversalReviewModel(turn);
  assert.ok(
    ['offer_prepare', 'offer_incomplete', 'offer_and_message_review'].includes(review?.reviewType),
    `reviewType=${review?.reviewType}`,
  );
  assert.equal(review.compactUi, true);
  assert.equal((review.groups || []).length, 0, 'offene Fact-Gruppen müssen leer sein');
  assert.ok(review.collapsedContext?.groups?.length > 0, 'Erkannte Angaben hinter Collapse');
  assert.ok(
    !(review.collapsedContext.groups || []).some((g) => g.id === 'customer'),
    'Kundenname nicht in Collapse wenn bereits in Akte',
  );
  assert.ok(
    !(review.collapsedContext.groups || []).some((g) => (
      !g.line && !(g.chips || []).length && !(g.items || []).length
    )),
    'leere Fact-Gruppen nie rendern',
  );

  assert.ok(review.offerReview);
  assert.match(String(review.offerReview.heroLine || review.hero?.name || ''), /EV2/i);
  assert.doesNotMatch(String(review.hero?.name || ''), /^Kai Drechsel$/i);
  assert.equal(review.offerReview.inCustomerAkte, true);
  assert.ok(
    !String(review.hero?.subtitle || '').includes('Kai Drechsel'),
    'Name nicht als Subtitle doppeln',
  );

  assert.equal((review.progressLines || []).length, 0, 'keine gefunden/erkannt-Progresszeilen');
  assert.equal((review.warnings || []).length, 0, 'Warnungen in Prüfbox gebündelt');
  assert.ok(review.conflictBox);
  assert.match(review.conflictBox.title, /Rabatt/i);
  assert.match(String(review.conflictBox.body || ''), /ungültig|nicht übernommen/i);
  assert.equal(review.conflictBox.action?.action, 'check_discount');

  const offerSec = (review.actionSections || []).find((s) => (
    s.kind === 'offer_and_message_review'
    || s.kind === 'offer_prepare'
    || s.kind === 'offer_incomplete'
  ));
  assert.ok(offerSec?.primaryActions?.some((a) => /Angebot/i.test(a.label || '')));
  assert.ok(
    (offerSec?.secondaryActions || []).some((a) => a.action === 'toggle_context'),
    'Erkannte Angaben anzeigen',
  );
  assert.ok(!String(offerSec?.body || '').includes('FINANZIELL'));
  assert.ok(!String(offerSec?.body || '').includes('INTERESSE'));
}

// --- Offer & Message ohne PDF: Hero = Fahrzeug, nicht Name ---
{
  const turn = runCleverSellerTurn({
    lead: kaiLead,
    sellerInput: 'Erstelle für Kai ein Leasingangebot EV2 Air 36 Monate 15.000 km und schreib eine kurze Nachricht.',
    customerName: 'Kai Drechsel',
    scopeHint: 'customer_akte',
  });
  const review = buildUniversalReviewModel(turn);
  if (review?.reviewType === 'offer_and_message_review' || review?.reviewType === 'offer_prepare') {
    assert.equal((review.groups || []).length, 0);
    assert.match(String(review.hero?.eyebrow || ''), /Angebot vorbereitet|unvollständig/i);
    assert.doesNotMatch(String(review.hero?.name || ''), /^Kai Drechsel$/);
  }
}

// --- Generische Chips bei Offer-Review ausblenden ---
{
  const chips = resolveComposerChipsForReview({
    reviewType: 'offer_and_message_review',
    actionSections: [{
      kind: 'offer_and_message_review',
      primaryActions: [{ id: 'create', action: 'open_offer_handoff' }],
    }],
  });
  assert.deepEqual(chips.chips, []);
  assert.ok(!chips.chips.some((c) => c.id === 'nachfassen'));
  assert.ok(OFFER_REVIEW_CHIPS.length >= 2);
  assert.ok(COMPOSER_PRIMARY_CHIPS.some((c) => c.id === 'nachfassen'));

  const bare = resolveComposerChipsForReview({ reviewType: 'offer_prepare' });
  assert.ok(
    bare.chips.length === 0
    || bare.chips.every((c) => OFFER_REVIEW_CHIPS.some((o) => o.id === c.id)),
  );
}

// --- PDF-Chip ruhig ohne Dateiname ---
{
  const built = buildOfferAttachmentLabel({
    fileName: 'Freibleibende Kalkulation.pdf',
    text: leasingPdfText,
  });
  assert.match(built.label, /EV2-Angebot/);
  assert.match(built.label, /36 Monate/);
  assert.match(built.label, /15\.000 km/);
  assert.doesNotMatch(built.label, /Freibleibende|Kalkulation\.pdf/i);

  const pill = buildDocumentWorkingContextItem({
    id: 'pdf:1',
    label: built.label,
    fileName: 'Freibleibende Kalkulation.pdf',
    shortLabel: built.label,
  });
  assert.equal(pill.shortLabel, built.label);
  assert.doesNotMatch(pill.shortLabel, /Freibleibende/);
}

// --- Discount-Warning-Konstante bleibt ---
{
  assert.match(INVALID_DISCOUNT_WARNING, /Rabattwert/i);
}

console.log('offerReview.simplify.golden.test.js: OK');
