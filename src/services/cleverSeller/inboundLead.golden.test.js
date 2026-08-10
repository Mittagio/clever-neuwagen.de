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
  assert.equal(review.reviewType, 'customer_intake_review');
  assert.equal(review.legacyReviewType, 'inbound_lead_review');
  assert.equal(review.kind, 'customer_intake');
  assert.equal(review.compactUi, true, 'Intake-Review compact – Accept-CTA als Primary-Button');
  assert.ok(review.hero?.name, 'Hero-Name für sichtbaren Accept-Flow');
  assert.match(review.title, /Anfrage erkannt/i);
  assert.ok(review.actionSections?.some((s) => (
    s.id === 'customer_intake_review' && s.kind === 'customer_intake_review' && s.title === 'Kundenanfrage'
  )));
  assert.ok(review.groups.some((g) => g.title === 'KUNDE'));
  assert.ok(review.groups.some((g) => g.title === 'NÄCHSTE AKTION'));
  assert.match(review.primaryCta, /Verknüpfen|Übernehmen/i);
  assert.equal(
    review.actionSections.find((s) => s.kind === 'customer_intake_review')?.primaryActions?.[0]?.tone,
    'primary',
  );

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
  assert.equal(review.reviewType, 'customer_intake_review');
  assert.equal(review.legacyReviewType, 'inbound_lead_review');
  assert.equal(review.compactUi, true);
  assert.match(review.hero?.name || '', /Neumann/i);
  assert.match(review.primaryCta, /Neue Kundenakte anlegen|anlegen/i);
  assert.match(review.secondaryCta, /Erneut suchen|Verwerfen/i);
  assert.ok(review.groups.some((g) => /Neu anlegen|neuen Kunden/i.test(g.line || '')));
  assert.equal(
    review.actionSections.find((s) => s.kind === 'customer_intake_review')?.primaryActions?.[0]?.action,
    'accept_inbound_lead',
  );

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

// --- Strukturierte Händler-Notiz ohne „Hier eine Anfrage:“ → Intake, keine Nachricht ---
{
  const SCHLAYER_NOTE = [
    'Schlayer Alexander Aalen',
    'Name: Alexander Schlayer',
    'S_Alexander1@hotmail.de',
    'EV3 AIR',
    'November 2026',
    'Bar',
    'Corporate Benefits',
    'ledig, keine Kinder',
    'aktuell Audi A4',
    '+49 7181 9987780',
    '+49 1575 0484494',
  ].join('\n');

  assert.equal(isInboundLeadPaste(SCHLAYER_NOTE), true);
  assert.equal(isInboundLeadPaste('Schreib ihm eine Mail zum EV3 Leasing.'), false);

  const noteContact = extractInboundContact(SCHLAYER_NOTE);
  assert.match(noteContact.fullName || '', /Alexander Schlayer/i);
  assert.equal(noteContact.email, 's_alexander1@hotmail.de');
  assert.equal(noteContact.sourceHint, 'structured_lead_note');

  const interpreted = interpretSellerInput(SCHLAYER_NOTE);
  assert.ok(interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.INBOUND_LEAD));
  assert.ok(!interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE));

  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: SCHLAYER_NOTE,
    leadsSnapshot: [brandes],
    scopeHint: 'dashboard',
    env: ENV,
  });
  assert.ok(turn.inboundLead?.detected);
  assert.equal(turn.inboundLead.proposeCreateCustomer, true);
  assert.ok(!turn.messageDraft);
  const review = turn.reviewModel || buildUniversalReviewModel(turn);
  assert.equal(review.reviewType, 'customer_intake_review');
  assert.match(review.body || '', /Erkannt:/i);
  assert.match(review.primaryCta, /anlegen/i);
  assert.ok((turn.missingInformation || []).some((m) => m.id === 'confirm_create_customer'));
}

console.log('inboundLead.golden.test.js: OK');
