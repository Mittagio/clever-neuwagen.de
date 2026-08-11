/**
 * Universal Composer Review: Model + Accept → sellerInsights / tradeIn
 * node src/services/cleverSeller/universalReviewFlow.test.js
 */
import assert from 'node:assert/strict';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import { getSellerInsightsFromLead } from '../dealer/sellerInsights.js';
import { getTradeIn } from '../customerAkteTradeIn.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';

const emptyLead = {
  id: 'lead-review-1',
  name: 'Herr Norz',
  wish: { paymentType: 'leasing', termMonths: 48, annualMileage: 15000 },
  crm: {
    needProfile: createEmptyNeedProfile(),
    customerMessages: [],
    customerMessageThreads: [],
    sellerInsights: [],
  },
};

const dump = `netto 2800
2 kinder
verheiratet
ford kuga
leasing läuft 11/2026 aus
300 euro wunschrate
auto nehmen wir in zahlung`;

const turn = runCleverSellerTurn({ lead: emptyLead, sellerInput: dump });
assert.equal(shouldShowUniversalReview(turn), true);

const model = buildUniversalReviewModel(turn);
assert.ok(model);
assert.equal(model.title, '✨ Clever hat verstanden');
assert.ok(model.factCount >= 5);
assert.match(model.summaryLine, /Neu erkannt/);
assert.ok(model.groups.some((g) => g.id === 'customer'));
assert.ok(model.groups.some((g) => g.id === 'finance'));
assert.ok(model.groups.some((g) => g.id === 'vehicle_current'));
assert.ok(model.groups.some((g) => g.id === 'contract'));
// Understanding freeze: keine generische Bestätigungs-Warnung
assert.ok(
  !(model.warnings || []).some((w) => /Mindestens ein Wert braucht kurze Bestätigung/i.test(w)),
);
assert.ok(
  !(turn.warnings || []).some((w) => /Mindestens ein Wert braucht kurze Bestätigung/i.test(w)),
);
const uncertainChips = (model.groups || [])
  .flatMap((g) => g.chips || [])
  .filter((c) => c && typeof c === 'object' && c.needsConfirmation);
if (uncertainChips.length === 1 || (
  uncertainChips.length > 0
  && uncertainChips.length < (model.groups || []).flatMap((g) => g.chips || []).length
)) {
  assert.equal(model.hideGlobalAccept, true);
  assert.equal(model.primaryCta, null);
} else {
  assert.equal(model.primaryCta, 'Übernehmen');
}
// Unsichere Werte als Chip-Objekte mit needsConfirmation
assert.ok(
  (model.groups || []).some((g) => (g.chips || []).some((c) => (
    c && typeof c === 'object' && Object.prototype.hasOwnProperty.call(c, 'needsConfirmation')
  ))),
  'Chips tragen needsConfirmation für Unsicherheits-Style',
);

// Outlook-Dump → Review-Gruppen
const outlookDump = `Eduard Hafner Urbach Interesse an PROBEFAHRT KIA SELTOS / KIA K4 SW 0179 7072736 Skoda Octavia Schalter
Do 30.07.2026 10:00
Automatik
Schiebedach
GT LINE / X LINE 3`;
const outlookTurn = runCleverSellerTurn({ lead: emptyLead, sellerInput: outlookDump });
assert.equal(shouldShowUniversalReview(outlookTurn), true);
const outlookModel = buildUniversalReviewModel(outlookTurn);
assert.ok(outlookModel);
// Appointment-Review: Fact-Gruppen sind eingeklappt (collapsedContext), nicht offen
const outlookGroups = outlookModel.reviewType === 'appointment_and_message_review'
  ? (outlookModel.collapsedContext?.groups || [])
  : (outlookModel.groups || []);
if (outlookModel.reviewType === 'appointment_and_message_review') {
  assert.equal((outlookModel.groups || []).length, 0);
  assert.ok(outlookModel.appointmentReview);
}
assert.ok(
  outlookGroups.some((g) => g.id === 'customer' && /Hafner/i.test(g.line))
  || /Hafner/i.test(String(outlookModel.appointmentReview?.customerName || '')),
);
assert.ok(
  outlookGroups.some((g) => g.id === 'appointment' && /Probefahrt/i.test(g.line))
  || /Probefahrt|Beratung|Autohaus/i.test(String(outlookModel.appointmentReview?.appointmentTypeLabel || '')),
);
assert.ok(outlookGroups.some((g) => g.id === 'wish' && /Seltos/i.test(g.line)));
assert.ok(outlookGroups.some((g) => g.id === 'vehicle_current' && /Octavia/i.test(g.line)));

const outlookApplied = applyAcceptedSellerTurn(emptyLead, outlookTurn, { postFeedCard: false });
assert.ok(outlookApplied.lead.crm?.cleverAppointment?.startAt);
assert.ok(outlookApplied.lead.crm?.needProfile?.modelCandidates?.length >= 2
  || outlookApplied.lead.crm?.needProfile?.understoodLabels?.some((l) => /Seltos/i.test(l)));
assert.equal(outlookApplied.lead.crm?.needProfile?.transmission, 'automatic');

const applied = applyAcceptedSellerTurn(emptyLead, turn, { postFeedCard: false });
assert.equal(applied.ok, true);
assert.ok(applied.acceptedLabels.length >= 5);

const insights = getSellerInsightsFromLead(applied.lead);
assert.ok(insights.length >= 5);
assert.ok(insights.some((i) => /2\.?800|2800|Netto/i.test(i.text)));
assert.ok(insights.some((i) => /Kinder|verheiratet/i.test(i.text)));

const tradeIn = getTradeIn(applied.lead);
assert.ok(/Kuga/i.test(tradeIn.vehicle || ''));
assert.ok(/Inzahlungnahme/i.test(tradeIn.notes || ''));
assert.equal(applied.lead.desiredRate, 300);
assert.equal(applied.lead.wish?.desiredRate, 300);
assert.equal(applied.lead.wish?.leasingEndDate, '2026-11');
assert.equal(applied.lead.paymentType, 'leasing');
assert.equal(applied.lead.wish?.paymentType, 'leasing');

// Übernehmen bestätigt auch needsConfirmation-Facts strukturiert
const moneyTurn = runCleverSellerTurn({ lead: emptyLead, sellerInput: '300 euro' });
const moneyFact = moneyTurn.extractedFacts.find((f) => f.field === 'monthlyBudget');
assert.ok(moneyFact?.needsConfirmation);
const moneyApplied = applyAcceptedSellerTurn(emptyLead, moneyTurn, { postFeedCard: false });
assert.equal(moneyApplied.lead.desiredRate, 300);

// Strukturierte Felder: Rabatt, Leasingende, Automatik
const structuredTurn = runCleverSellerTurn({
  lead: emptyLead,
  sellerInput: 'EV3 21 % Rabatt, Leasing läuft 11/2026 aus, Automatik und Schiebedach',
});
const structuredApplied = applyAcceptedSellerTurn(emptyLead, structuredTurn, { postFeedCard: false });
assert.equal(structuredApplied.lead.wish?.customDiscountPercent, 21);
assert.equal(structuredApplied.lead.wish?.customerGroup, 'custom');
assert.equal(structuredApplied.lead.wish?.leasingEndDate, '2026-11');
assert.equal(structuredApplied.lead.crm?.needProfile?.transmission, 'automatic');
assert.ok(structuredApplied.lead.crm?.needProfile?.equipmentWishes?.includes('Schiebedach'));

assert.equal(shouldShowUniversalReview({ extractedFacts: [] }), false);
// Clever 2.0: sicherer Context-Dump → Compact Confirmation, kein Universal-Review
assert.equal(
  shouldShowUniversalReview({
    extractedFacts: [{ label: 'x', factClass: 'customer_fact' }],
    intents: [{ type: 'update_customer_context' }],
  }),
  false,
);
// Unsicherer Fakt → Review (ohne generische Banner-Warnung)
assert.equal(
  shouldShowUniversalReview({
    extractedFacts: [{ label: '300 €', factClass: 'commercial_preference', needsConfirmation: true }],
    intents: [{ type: 'update_customer_context' }],
  }),
  true,
);
{
  const uncertainModel = buildUniversalReviewModel({
    extractedFacts: [
      { label: 'Leasing', field: 'paymentType', factClass: 'commercial_preference', needsConfirmation: false },
      { label: '300 €', field: 'monthlyBudget', factClass: 'commercial_preference', needsConfirmation: true },
    ],
  });
  assert.equal(uncertainModel.hideGlobalAccept, true);
  assert.equal(uncertainModel.primaryCta, null);
  assert.ok(
    !(uncertainModel.warnings || []).some((w) => /kurze Bestätigung/i.test(w)),
  );
  const uncertainChip = (uncertainModel.groups || [])
    .flatMap((g) => g.chips || [])
    .find((c) => c?.needsConfirmation);
  assert.ok(uncertainChip, 'unsicherer Chip im Model');
  assert.equal(uncertainChip.needsConfirmation, true);
}

// Multi-Aktion: angehängtes Angebot + km ändern + Nachricht
const multiTurn = runCleverSellerTurn({
  lead: {
    ...emptyLead,
    wish: { paymentType: 'leasing', termMonths: 48, mileagePerYear: 15000 },
  },
  sellerInput: 'Mach 20000 km und schreib ihr dass ich es wie besprochen angepasst habe',
  currentOfferContext: {
    offerId: 'vc-ev4',
    title: 'EV4 GT-Line',
    termMonths: 48,
    mileagePerYear: 15000,
    monthlyRate: 329,
    summary: 'EV4 · 48 M · 15.000 km',
  },
});
assert.ok(
  multiTurn.extractedFacts.some((f) => f.field === 'annualMileage'),
  'km-Fakt erkannt',
);
assert.ok(
  multiTurn.preparedActions.some((a) => a.payload?.updateOnly === true),
  'Angebots-Update vorbereitet',
);
assert.ok(
  multiTurn.preparedActions.some((a) => a.type === 'draft_message'),
  'Nachricht vorbereitet',
);
const multiModel = buildUniversalReviewModel(multiTurn);
assert.ok(multiModel);
assert.ok(multiModel.actionSections?.some((s) => s.kind === 'offer_change'));
assert.match(multiModel.primaryCta, /Änderungen prüfen|Übernehmen/);
assert.ok(
  multiModel.actionSections.some((s) => s.kind === 'offer_change' && /15\.000|15000/i.test(s.line || '')),
);
assert.ok(
  !(multiTurn.missingInformation || []).some((m) => /Welches Modell/i.test(m.label || '')),
  'kein Modell-Ask bei angehängtem Angebot',
);
const msgSection = multiModel.actionSections?.find((s) => s.kind === 'message_draft');
const msgBody = msgSection?.body || '';
assert.ok(msgBody, 'Message-Draft vorhanden');
assert.ok(!/Mach 20000 km und schreib/i.test(msgBody), 'kein Seller-Rohtext im Draft');
assert.ok(/angepasst|Angebot/i.test(msgBody), 'Kundentext zu Angebotsanpassung');

// Portfolio-only Accept ohne Facts (nur vorbereitete Kundenaktion)
const portfolioOnlyApplied = applyAcceptedSellerTurn(emptyLead, {
  extractedFacts: [],
  preparedActions: [{
    type: 'send_portfolio',
    status: 'prepared',
    payload: { cta: 'Kundenlink senden' },
  }],
}, { postFeedCard: false });
assert.equal(portfolioOnlyApplied.ok, true, 'Portfolio-only Accept ohne Facts');
assert.deepEqual(portfolioOnlyApplied.acceptedLabels, []);

// km-Änderung + Kundenlink: Facts vorhanden, beide Aktionen vorbereitet
const kmPortfolioTurn = runCleverSellerTurn({
  lead: {
    ...emptyLead,
    wish: { paymentType: 'leasing', termMonths: 48, mileagePerYear: 15000 },
  },
  sellerInput: 'Mach 20000 km und schick ihm die Angebote per Kundenlink',
  currentOfferContext: {
    offerId: 'vc-ev4',
    title: 'EV4 GT-Line',
    termMonths: 48,
    mileagePerYear: 15000,
    monthlyRate: 329,
    summary: 'EV4 · 48 M · 15.000 km',
  },
});
assert.ok(kmPortfolioTurn.extractedFacts.some((f) => f.field === 'annualMileage'));
assert.ok(kmPortfolioTurn.preparedActions.some((a) => a.payload?.updateOnly === true));
assert.ok(kmPortfolioTurn.preparedActions.some((a) => a.type === 'send_portfolio'));
const kmPortfolioApplied = applyAcceptedSellerTurn(emptyLead, kmPortfolioTurn, { postFeedCard: false });
assert.equal(kmPortfolioApplied.ok, true);

console.log('universalReviewFlow.test.js: ok');
