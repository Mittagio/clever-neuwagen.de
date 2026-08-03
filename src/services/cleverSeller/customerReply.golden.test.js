/**
 * Zwei-Wege-Mail leicht – Kundenantwort Paste → Review → Confirm
 * node src/services/cleverSeller/customerReply.golden.test.js
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
  adaptInboundChannelToPaste,
  isCustomerReplyPaste,
} from './customerReplyIntake.js';
import { isInboundLeadPaste } from './inboundLeadIntake.js';
import { getNeedProfileFromLead } from '../consultation/needProfileService.js';
import {
  listCustomerVehicleTracks,
  VEHICLE_TRACK_STATUS,
} from '../crm/vehicleTrack.js';

const ENV = {
  VITE_CLEVER_SELLER_ORCHESTRATOR: 'true',
  CLEVER_SELLER_ORCHESTRATOR: 'true',
};

const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });

const REPLY_BODY = 'Der XCeed gefällt mir, aber bitte in Rot und mit AHK. Montag 16 Uhr passt.';

const BRANDES_REPLY_MAIL = [
  'Hier eine Kundenantwort:',
  '',
  '-----Ursprüngliche Nachricht-----',
  'Von: Herr Brandes <herr.brandes@demo-mail.de>',
  'Gesendet: Montag, 3. August 2026 14:20',
  'An: vertrieb@autohaus-trinkle.de',
  'Betreff: Re: XCeed – Angebot',
  '',
  REPLY_BODY,
  '',
  'Mit freundlichen Grüßen',
  'Herr Brandes',
].join('\n');

// Erst-Anfrage bleibt inbound_lead (Regression)
const BRANDES_INQUIRY = [
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
].join('\n');

// --- Detect ---
assert.equal(isCustomerReplyPaste(BRANDES_REPLY_MAIL), true);
assert.equal(isCustomerReplyPaste('Öffne Herrn Brandes.'), false);
assert.equal(isCustomerReplyPaste(BRANDES_INQUIRY), false);
assert.equal(isInboundLeadPaste(BRANDES_INQUIRY), true);

// Kanal-Adapter (Hook für spätere Inbox – kein IMAP)
{
  const adapted = adaptInboundChannelToPaste({
    channel: 'email_forward',
    rawText: REPLY_BODY,
    subject: 'XCeed – Angebot',
    fromName: 'Herr Brandes',
    fromEmail: 'herr.brandes@demo-mail.de',
  });
  assert.equal(isCustomerReplyPaste(adapted), true);
}

// --- interpret: customer_reply, nicht inbound_lead ---
{
  const interpreted = interpretSellerInput(BRANDES_REPLY_MAIL);
  assert.ok(interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.CUSTOMER_REPLY));
  assert.ok(!interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.INBOUND_LEAD));
  assert.ok(interpreted.facts.some((f) => f.field === 'vehicleTrackFeedback'));
  assert.ok(interpreted.facts.some((f) => f.field === 'colorPreference' && /rot/i.test(f.label)));
  assert.ok(interpreted.facts.some((f) => f.field === 'towHitchRequired'));
  assert.ok(interpreted.facts.some((f) => f.factClass === 'appointment_fact'));
}

// Inquiry bleibt inbound
{
  const inquiry = interpretSellerInput(BRANDES_INQUIRY);
  assert.ok(inquiry.intents.some((i) => i.type === SELLER_TURN_INTENTS.INBOUND_LEAD));
  assert.ok(!inquiry.intents.some((i) => i.type === SELLER_TURN_INTENTS.CUSTOMER_REPLY));
}

// --- Turn: Resolve Brandes + Universal Review ---
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: BRANDES_REPLY_MAIL,
    leadsSnapshot: [brandes],
    scopeHint: 'dashboard',
    env: ENV,
  });
  assert.equal(turn.ok, true);
  assert.ok(turn.customerReply?.detected);
  assert.equal(turn.customerReply.resolutionStatus, 'unique');
  assert.equal(turn.customerReply.matchedLeadId, brandes.id);
  assert.equal(turn.customerReply.proposeCreateCustomer, false);
  assert.ok(!turn.inboundLead?.detected);
  assert.equal(turn.resolvedCustomer?.id, brandes.id);
  assert.equal(shouldShowUniversalReview(turn), true);

  const review = turn.reviewModel || buildUniversalReviewModel(turn);
  assert.equal(review.reviewType, 'customer_reply_review');
  assert.match(review.title, /Kundenantwort erkannt/i);
  assert.ok(review.groups.some((g) => g.title === 'ERKANNTE ANGABEN'));
  assert.ok(review.groups.some((g) => g.title === 'VORBEREITETE AKTIONEN'));
  assert.ok(
    (turn.customerReply.nextActions || []).some((a) => /Angebot anpassen/i.test(a.label)),
  );
  assert.ok(
    (turn.customerReply.nextActions || []).some((a) => /Termin/i.test(a.label)),
  );
  assert.match(review.primaryCta, /Übernehmen/i);

  // Ohne Accept: Snapshot unverändert (Profile liegt unter crm.needProfile)
  assert.notEqual(getNeedProfileFromLead(brandes)?.colorPreference, 'rot');

  const applied = applyAcceptedSellerTurn(brandes, turn, { postFeedCard: false });
  assert.equal(applied.ok, true);
  assert.equal(applied.created, false);
  assert.equal(applied.lead.id, brandes.id);
  assert.ok(
    applied.acceptedLabels.some((l) => /Xceed Favorit|Rot|AHK|Termin|Beratung/i.test(l)),
  );
  const profile = getNeedProfileFromLead(applied.lead);
  assert.equal(profile?.towbar, true);
  assert.match(String(profile?.colorPreference || ''), /rot/i);
  const tracks = listCustomerVehicleTracks(applied.lead);
  const favorite = tracks.find((t) => t.status === VEHICLE_TRACK_STATUS.FAVORITE);
  assert.ok(favorite, 'Favoriten-Spur nach Confirm');
  assert.match(String(favorite.modelLabel || favorite.modelKey || ''), /xceed/i);
}

// Akte-Surface: offener Lead + Paste
{
  const turn = runCleverSellerTurn({
    lead: brandes,
    sellerInput: BRANDES_REPLY_MAIL,
    leadsSnapshot: [brandes],
    scopeHint: 'akte',
    env: ENV,
  });
  assert.ok(turn.customerReply?.detected);
  assert.equal(turn.customerReply.matchedLeadId, brandes.id);
  assert.equal(shouldShowUniversalReview(turn), true);
}

console.log('customerReply.golden.test.js: OK');
