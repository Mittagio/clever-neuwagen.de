/**
 * Hafner Real-World – EV3 Multi-Varianten Kundenmail (Inbound)
 * node src/services/cleverSeller/hafnerEv3Variants.golden.test.js
 */
import assert from 'node:assert/strict';
import { interpretSellerInput } from './interpretSellerInput.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { buildSellerWorkBriefing } from './buildSellerWorkBriefing.js';
import {
  buildOfferPreparationHandoffModel,
  resolvePrepareOfferDraftId,
} from './buildOfferPreparationHandoffModel.js';
import { NEXT_BEST_ACTION_ID } from './determineNextBestSellerAction.js';
import { getNeedProfileFromLead } from '../consultation/needProfileService.js';
import { listCustomerVehicleTracks } from '../crm/vehicleTrack.js';
import { getCleverWorkingState, resolveActiveOfferDraft } from './cleverWorkingDraft.js';
import { parseCustomerNameFromMail, preprocessCustomerMail } from '../dealerAiMailExtractor.js';
import { extractNamedCustomerFromInput } from './resolveAssistantContext.js';

const HAFNER_BODY = `Sehr geehrter Herr Quach,

danke für Ihr Angebot mir ein Leasingangebot zu
unterbreiten.

Anbei übersende ich Ihnen die Konfiguration. Einmal den EV3
mit großen und einmal mit kleinem Akku.

Ich benötige ein Angebot für 15.000 sowie 20.000 km/Jahr und
3.000,00 € Anzahlung.

Könnten Sie mir zudem auch die HSN/TSN passend zur
jeweiligen Konfiguration übermitteln?

Danke im Voraus

Mit freundlichen Grüßen

S. Hafner`;

const HAFNER_MAIL = `From: hafseb@web.de
Subject: Leasingangebot EV3

${HAFNER_BODY}`;

function emptyLead(id = 'lead-hafner') {
  return {
    id,
    name: null,
    contact: {},
    wish: {},
    crm: {
      needProfile: {},
      vehicleConfigurations: [],
      cleverWorkingState: null,
      vehicleOffers: [],
    },
  };
}

function applyText(lead, text) {
  const interpreted = interpretSellerInput(text);
  const accepted = applyAcceptedSellerTurn(lead, {
    extractedFacts: interpreted.facts,
    sellerInput: text,
    preparedActions: [],
    intents: interpreted.intents || [],
  }, { postFeedCard: false });
  assert.equal(accepted.ok, true);
  return { lead: accepted.lead, interpreted, accepted };
}

{
  const mail = preprocessCustomerMail(HAFNER_MAIL);
  assert.match(String(mail.customerName || ''), /Hafner/i);
  assert.ok(!/Quach/i.test(String(mail.customerName || '')));
  assert.ok(!/Angebot/i.test(String(mail.customerName || '')));
  assert.equal(
    parseCustomerNameFromMail(mail.inquiryText, mail.signatureBlock),
    'S. Hafner',
  );
  assert.equal(extractNamedCustomerFromInput(HAFNER_MAIL), null);
  console.log('✓ Name: Signatur S. Hafner, kein Quach / kein „Ihr Angebot mir“');
}

{
  const { lead, interpreted } = applyText(emptyLead('hafner-base'), HAFNER_MAIL);
  const fields = Object.fromEntries(
    interpreted.facts
      .filter((f) => f.field)
      .map((f) => [f.field, f]),
  );
  const profile = getNeedProfileFromLead(lead);
  const name = String(lead.contact?.name || lead.name || fields.customerName?.value || '');

  assert.match(name, /Hafner/i);
  assert.ok(!/Quach/i.test(name), `Quach darf nicht Kunde sein, war: ${name}`);
  assert.match(String(fields.email?.value || lead.contact?.email || ''), /hafseb@web\.de/i);
  assert.equal(fields.vehicleInterest?.value?.modelKey, 'ev3');
  assert.equal(profile.selectedModelKey || fields.vehicleInterest?.value?.modelKey, 'ev3');

  const battery = fields.batteryVariantWishes?.value || profile.batteryVariantWishes || [];
  const batteryIds = battery.map((v) => (typeof v === 'object' ? v.id : v));
  const batteryLabels = battery.map((v) => (typeof v === 'object' ? v.label : String(v)));
  assert.ok(batteryIds.includes('large') || batteryLabels.some((l) => /groß/i.test(l)));
  assert.ok(batteryIds.includes('small') || batteryLabels.some((l) => /klein/i.test(l)));
  assert.ok(!fields.batteryPreference?.value?.kWh, 'keine Fake-kWh');
  assert.ok(
    !interpreted.facts.some((f) => f.field === 'batteryPreference' && f.value?.kWh),
    'keine Fake-kWh aus groß/klein',
  );

  const kmVariants = fields.annualMileageVariants?.value || profile.annualMileageVariants || [];
  assert.deepEqual(
    [...kmVariants].map(Number).sort((a, b) => a - b),
    [15000, 20000],
  );
  assert.equal(fields.annualMileage, undefined, 'primary annualMileage bleibt offen bei Varianten');
  assert.ok(
    profile.annualKm == null || profile.annualKm === undefined,
    'primary annualKm nicht last-wins',
  );

  assert.equal(Number(fields.downPayment?.value ?? lead.wish?.downPayment), 3000);
  assert.equal(fields.paymentType?.value || lead.wish?.paymentType, 'leasing');

  const openQ = interpreted.facts.find((f) => (
    f.field === 'openCustomerQuestion' && f.value?.topic === 'hsn_tsn'
  ));
  assert.ok(openQ, 'HSN/TSN als offene Frage');
  assert.match(String(openQ.label || ''), /HSN\/TSN/i);

  assert.equal(fields.attachmentContext?.value?.kind, 'configuration_expected');

  const tracks = listCustomerVehicleTracks(lead);
  assert.equal(tracks.length, 1, 'genau ein EV3-Track');
  assert.match(String(tracks[0]?.modelKey || tracks[0]?.modelLabel || ''), /ev3/i);

  const drafts = Object.values(getCleverWorkingState(lead).offerDrafts || {});
  assert.equal(drafts.length, 1, 'genau ein Concept Draft');
  const draft = resolveActiveOfferDraft({ lead }) || drafts[0];
  const rate = draft.monthlyRate ?? draft.rate ?? draft.payment?.calculatedRate ?? null;
  assert.equal(rate, null, 'Rate null');
  assert.ok(
    !draft.vehicleIdentityDraft?.powertrain?.canonical
    || !/\d+\s*kwh/i.test(String(draft.vehicleIdentityDraft?.powertrain?.canonical || '')),
    'keine Fake-kWh im Draft',
  );

  const briefing = buildSellerWorkBriefing({
    lead,
    facts: interpreted.facts,
    draft,
  });
  assert.equal(briefing.nextBestAction?.id, NEXT_BEST_ACTION_ID.PREPARE_OFFER);
  assert.match(briefing.text, /Hafner|EV3/i);
  assert.match(briefing.text, /groß/i);
  assert.match(briefing.text, /klein/i);
  assert.match(briefing.text, /15\.000/);
  assert.match(briefing.text, /20\.000/);
  assert.match(briefing.text, /HSN\/TSN|Anhang/i);
  assert.match(String(briefing.sections?.nextStep || ''), /Angebot vorbereiten/i);

  const offerDraftId = resolvePrepareOfferDraftId(lead, briefing.nextBestAction?.payload || {});
  const prep = buildOfferPreparationHandoffModel({
    lead,
    offerDraftId,
    nbaPayload: briefing.nextBestAction?.payload || {},
  });
  assert.ok(prep, 'Offer-Prep-Handoff');
  assert.match(String(prep.offerReview?.variantWishesLine || prep.actionSections?.[0]?.line || ''), /Akku|15\.000|20\.000|3\.000/i);
  assert.equal(prep.actionSections?.[0]?.primaryActions?.[0]?.label, 'Kalkulation / PDF hochladen');
  assert.equal(prep.actionSections?.[0]?.secondaryActions?.[0]?.label, 'Manuell ergänzen');

  console.log('✓ Hafner Golden – Varianten, ein Track/Draft, Offer-Prep');
}

console.log('\nHafner EV3 Variants Golden: OK');
