/**
 * Phase-2 Rest – Unterlagen-Leitprozess (schlank)
 * Propose → Confirm → Action · kein Auto-Send vor Accept
 * node --test src/services/cleverSeller/documentsChecklist.golden.test.js
 */
import assert from 'node:assert/strict';
import { createBrandesGoldenCaseLead } from '../crm/brandesGoldenCase.js';
import { initCleverUnterlagenForLead, UNTERLAGEN_STATUS } from '../cleverUnterlagen.js';
import { MESSAGE_KIND } from '../crm/customerMessageService.js';
import {
  buildMissingDocumentsSellerSummary,
  prepareSellerWorkspacePackage,
} from '../crm/sharedWorkspaceService.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';

const ENV = {
  VITE_CLEVER_SELLER_ORCHESTRATOR: 'true',
  CLEVER_SELLER_ORCHESTRATOR: 'true',
};

function brandesWithOpenDocs() {
  const lead = createBrandesGoldenCaseLead({ phase: 'golden' });
  const base = initCleverUnterlagenForLead(lead, 'leasing');
  return {
    ...lead,
    crm: {
      ...lead.crm,
      cleverUnterlagen: {
        ...base,
        items: {
          ...base.items,
          ausweis: { status: UNTERLAGEN_STATUS.open.id },
          selbstauskunft: { status: UNTERLAGEN_STATUS.open.id },
          gehaltsnachweis: {
            status: UNTERLAGEN_STATUS.uploaded.id,
            fileName: 'gehalt.pdf',
            uploadedAt: new Date().toISOString(),
          },
          bankverbindung: { status: UNTERLAGEN_STATUS.not_needed.id },
          sonstiges: { status: UNTERLAGEN_STATUS.not_needed.id },
        },
      },
      customerMessages: [],
      customerMessageThreads: [],
    },
  };
}

// --- Seller-Summary (Produktbeispiel Brandes) ---
{
  const lead = brandesWithOpenDocs();
  const pkg = prepareSellerWorkspacePackage(lead, 'Welche Unterlagen fehlen?');
  assert.ok(pkg.slots.some((s) => s.id === 'ausweis'));
  assert.ok(pkg.slots.some((s) => s.id === 'selbstauskunft'));
  assert.ok(!pkg.slots.some((s) => s.id === 'gehaltsnachweis'));
  const summary = buildMissingDocumentsSellerSummary(lead, pkg.slots);
  assert.match(summary, /Herrn Brandes/i);
  assert.match(summary, /Ausweisvorderseite/i);
  assert.match(summary, /unterschriebene Selbstauskunft/i);
  assert.equal(pkg.ctaLabel, 'Sicheren Upload-Link senden');
  assert.ok(pkg.body);
}

// --- Intent / Fact ---
{
  const interpreted = interpretSellerInput('Welche Unterlagen fehlen bei Herrn Brandes?');
  assert.ok(interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.REQUEST_DOCUMENTS));
  assert.ok(interpreted.facts.some((f) => f.field === 'documentRequest'));
}

// --- Orchestrator Propose (kein Send) ---
{
  const lead = brandesWithOpenDocs();
  const turn = runCleverSellerTurn({
    sellerInput: 'Welche Unterlagen fehlen bei Herrn Brandes?',
    lead,
    env: ENV,
  });
  assert.equal(turn.ok, true);
  const docs = turn.preparedActions.find((a) => (
    a.type === SELLER_TURN_INTENTS.REQUEST_DOCUMENTS && a.status === 'prepared'
  ));
  assert.ok(docs, 'prepared request_documents');
  assert.equal(docs.needsSellerConfirmation, true);
  assert.match(String(docs.payload?.sellerSummary || ''), /fehlen noch/i);
  assert.ok(docs.payload?.slots?.length >= 2);
  assert.equal(docs.payload?.ctaLabel, 'Sicheren Upload-Link senden');
  assert.ok(turn.messageDraft);
  assert.equal(shouldShowUniversalReview(turn), true);

  const review = buildUniversalReviewModel(turn);
  assert.equal(review.reviewType, 'request_documents');
  assert.match(String(review.summaryLine || review.actionSections?.[0]?.headline || ''), /Brandes/i);
  assert.equal(review.primaryCta, 'Sicheren Upload-Link senden');
  const sec = review.actionSections.find((s) => s.kind === 'request_documents');
  assert.ok(sec);
  assert.ok(sec.primaryActions.some((a) => a.action === 'send_documents_package'));

  // Noch kein Kunden-Upload-Paket ohne Accept
  const msgs = lead.crm?.customerMessages || [];
  assert.equal(msgs.length, 0);
}

// --- Confirm → Action (send) ---
{
  const lead = brandesWithOpenDocs();
  const turn = runCleverSellerTurn({
    sellerInput: 'Welche Unterlagen fehlen bei Herrn Brandes?',
    lead,
    env: ENV,
  });
  const applied = applyAcceptedSellerTurn(lead, turn, { postFeedCard: true });
  assert.equal(applied.ok, true);
  assert.equal(applied.documentsPackageSent, true);
  assert.ok(applied.acceptedLabels.some((l) => /Upload-Link/i.test(l)));

  const store = applied.lead?.crm?.customerMessages || [];
  assert.ok(store.some((m) => m.kind === MESSAGE_KIND.TEXT));
  assert.ok(store.some((m) => m.kind === MESSAGE_KIND.DOCUMENT_REQUEST));
  assert.ok(store.some((m) => m.kind === MESSAGE_KIND.SELF_DISCLOSURE_CARD));
  // Upload-URL nur wenn Document-Request-Store verfügbar (Browser/localStorage)
  if (applied.uploadUrl) {
    assert.ok(applied.lead?.crm?.cleverUnterlagen?.uploadLink?.url);
  }
}

// --- Chip-Seed ---
{
  const turn = runCleverSellerTurn({
    sellerInput: 'Welche Unterlagen fehlen bei Herrn Brandes?',
    lead: brandesWithOpenDocs(),
    env: ENV,
  });
  assert.ok(turn.preparedActions.some((a) => a.type === SELLER_TURN_INTENTS.REQUEST_DOCUMENTS));
}

console.log('documentsChecklist.golden.test.js: ok');
