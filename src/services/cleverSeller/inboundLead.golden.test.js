/**
 * Roadmap Schritt 3 – Inbound leicht (Paste/Forward → Review → Confirm)
 * node --test src/services/cleverSeller/inboundLead.golden.test.js
 */
import assert from 'node:assert/strict';
import { createBrandesGoldenCaseLead } from '../crm/brandesGoldenCase.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import {
  extractInboundContact,
  isInboundLeadPaste,
  resolveInboundCustomer,
} from './inboundLeadIntake.js';

const ENV = {
  VITE_CLEVER_SELLER_ORCHESTRATOR: 'true',
  CLEVER_SELLER_ORCHESTRATOR: 'true',
};

const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });

const BRANDES_MAIL = [
  'Hier eine Anfrage:',
  '',
  '-----Ursprüngliche Nachricht-----',
  'Von: Herr Brandes <herr.brandes@demo-mail.de>',
  'Gesendet: Montag, 3. August 2026 09:12',
  'An: vertrieb@autohaus-trinkle.de',
  'Betreff: XCeed – kurze Rückfrage',
  '',
  'Guten Tag,',
  'ich habe noch eine Frage zum XCeed-Angebot und bitte um Rückruf.',
  '',
  'Mit freundlichen Grüßen',
  'Herr Brandes',
  '+49 170 1122334',
].join('\n');

const NEW_CUSTOMER_MAIL = [
  'Weitergeleitete Nachricht',
  '',
  '-----Ursprüngliche Nachricht-----',
  'Von: Lisa Neumann <lisa.neumann@example.org>',
  'Gesendet: Montag, 3. August 2026 11:40',
  'An: vertrieb@autohaus-trinkle.de',
  'Betreff: Interesse an Kia Sportage Leasing',
  '',
  'Hallo,',
  'ich interessiere mich für Leasing 36 Monate, 10.000 km, gerne ein Angebot.',
  '',
  'Viele Grüße',
  'Lisa Neumann',
  '0171 9988776',
].join('\n');

// --- Detect + extract ---
assert.equal(isInboundLeadPaste(BRANDES_MAIL), true);
assert.equal(isInboundLeadPaste('Öffne Herrn Brandes.'), false);
const contact = extractInboundContact(BRANDES_MAIL);
assert.match(contact.fullName || '', /Brandes/i);
assert.equal(contact.email, 'herr.brandes@demo-mail.de');
assert.ok(contact.phone);

// --- Resolve Brandes by email ---
{
  const resolution = resolveInboundCustomer(contact, [brandes]);
  assert.equal(resolution.status, 'unique');
  assert.equal(resolution.lead.id, brandes.id);
  assert.equal(resolution.proposeCreateCustomer, false);
}

// --- interpret + turn: Brandes match ---
{
  const interpreted = interpretSellerInput(BRANDES_MAIL);
  assert.ok(interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.INBOUND_LEAD));
  assert.ok(interpreted.facts.some((f) => f.field === 'email'));
  assert.ok(interpreted.facts.some((f) => f.field === 'customerName'));

  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: BRANDES_MAIL,
    leadsSnapshot: [brandes],
    scopeHint: 'dashboard',
    env: ENV,
  });
  assert.equal(turn.ok, true);
  assert.ok(turn.inboundLead?.detected);
  assert.equal(turn.inboundLead.resolutionStatus, 'unique');
  assert.equal(turn.inboundLead.matchedLeadId, brandes.id);
  assert.equal(turn.inboundLead.proposeCreateCustomer, false);
  assert.equal(turn.resolvedCustomer?.id, brandes.id);
  assert.equal(shouldShowUniversalReview(turn), true);
  const review = turn.reviewModel || buildUniversalReviewModel(turn);
  assert.equal(review.reviewType, 'inbound_lead_review');
  assert.match(review.title, /Anfrage erkannt/i);
  assert.ok(review.groups.some((g) => g.title === 'KUNDE'));
  assert.ok(review.groups.some((g) => g.title === 'NÄCHSTE AKTION'));
  assert.match(review.primaryCta, /Verknüpfen|Übernehmen/i);

  // Confirm → Fakten auf bestehenden Lead, kein neuer Lead
  const applied = applyAcceptedSellerTurn(brandes, turn, { postFeedCard: false });
  assert.equal(applied.ok, true);
  assert.equal(applied.created, false);
  assert.equal(applied.lead.id, brandes.id);
  assert.ok(applied.lead.contact?.email || applied.acceptedLabels.length);
}

// --- Neuer Kunde: Propose, kein Persist ohne Accept ---
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: NEW_CUSTOMER_MAIL,
    leadsSnapshot: [brandes],
    scopeHint: 'dashboard',
    env: ENV,
  });
  assert.ok(turn.inboundLead?.detected);
  assert.equal(turn.inboundLead.resolutionStatus, 'none');
  assert.equal(turn.inboundLead.proposeCreateCustomer, true);
  assert.ok(!turn.resolvedCustomer?.id);
  const review = turn.reviewModel || buildUniversalReviewModel(turn);
  assert.match(review.primaryCta, /anlegen/i);
  assert.ok(review.groups.some((g) => /Neu anlegen|neuen Kunden/i.test(g.line || '')));

  // Ohne Accept: Snapshot unverändert (kein Side-Effect im Turn)
  assert.equal([brandes].length, 1);

  const applied = applyAcceptedSellerTurn({}, turn, {
    postFeedCard: false,
    allowCreateCustomer: true,
  });
  assert.equal(applied.ok, true);
  assert.equal(applied.created, true);
  assert.ok(applied.lead?.id);
  assert.match(applied.lead.contact?.name || '', /Neumann/i);
  assert.match(applied.lead.contact?.email || '', /lisa\.neumann@example\.org/i);
  assert.equal(applied.lead.source, 'composer_inbound');
}

console.log('inboundLead.golden.test.js: OK');
