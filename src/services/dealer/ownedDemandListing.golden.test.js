/**
 * Owned Demand MVP: eine veröffentlichte Händlerkondition bleibt vom Inserat bis zum Concept Draft.
 *
 * node src/services/dealer/ownedDemandListing.golden.test.js
 */
import assert from 'node:assert/strict';
import { getKiaTrinklePilotStock } from '../../data/kia/kiaTrinkleStock.js';
import { normalizeDealerConditions } from '../../data/dealerConditionsSchema.js';
import { determineNextBestSellerAction } from '../cleverSeller/determineNextBestSellerAction.js';
import { buildSellerWorkBriefing } from '../cleverSeller/buildSellerWorkBriefing.js';
import { getOfferDraftById } from '../cleverSeller/cleverWorkingDraft.js';
import {
  OWNED_DEALER_SITE_SOURCE,
  createLeadFromOwnedDealerSite,
  ownedPublishReady,
  presentOwnedVehicle,
  previewOwnedVehiclePublish,
  publishOwnedVehicleOffer,
  resolvePublishedDiscountPercent,
} from './ownedDemandListing.js';

const poolVehicle = getKiaTrinklePilotStock().find((item) => (
  item.modelKey === 'ev3' && item.trimId === 'earth'
));
assert.ok(poolVehicle, 'Pilot-Pool enthält EV3 Earth');
const codeDiscount = poolVehicle.discountPercent;

const before = previewOwnedVehiclePublish(normalizeDealerConditions({
  dealerId: 'autohaus-trinkle',
}), { id: 'ev3', name: 'EV3' });
assert.ok(before.listing, 'EV3 hat ein Pilot-Listing');
assert.equal(before.alreadyPublished, false);
assert.equal(before.spec.slug, poolVehicle.slug);
assert.equal(before.spec.listPriceGross, poolVehicle.listPriceGross);
assert.equal(before.spec.discountPercent, null);
assert.equal(ownedPublishReady(before.spec), false);

const dealerSpec = {
  ...before.spec,
  listPriceGross: 42960,
  discountPercent: 30,
  termMonths: 48,
  annualMileage: 15000,
  downPayment: 5000,
  paymentType: 'leasing',
};
assert.equal(ownedPublishReady(dealerSpec), true);

const published = publishOwnedVehicleOffer(normalizeDealerConditions({
  dealerId: 'autohaus-trinkle',
}), dealerSpec);

assert.equal(resolvePublishedDiscountPercent(published, 'ev3', 'leasing'), 30);
assert.equal(published.discountsByModel.ev3.standard, 30);
assert.equal(published.modelSettingsByModel.ev3.paymentDiscounts.leasing, 30);
assert.equal(published.ownedVehicleOffer.slug, poolVehicle.slug);

const card = presentOwnedVehicle(poolVehicle, published);
assert.equal(card.discountPercent, 30);
assert.notEqual(card.discountPercent, codeDiscount, 'defaultDiscount darf die Händlerkondition nicht überschreiben');
assert.equal(card.discountSource, 'dealer_conditions');
assert.equal(card.listPriceGross, 42960);
assert.equal(card.ownedCommercial.termMonths, 48);
assert.equal(card.ownedCommercial.annualMileage, 15000);
assert.equal(card.ownedCommercial.downPayment, 5000);
assert.equal(card.ownedCommercial.rate, null);
assert.equal(card.monthlyRateAuthority, 'display_estimate');
assert.ok(card.monthlyRate == null || card.monthlyRate !== 0);

const untouched = presentOwnedVehicle(
  { ...poolVehicle, slug: 'other-car', modelKey: 'picanto' },
  published,
);
assert.equal(untouched.discountPercent, codeDiscount);
assert.equal(untouched.ownedCommercial, undefined);

const lead = createLeadFromOwnedDealerSite({
  vehicle: card,
  contact: { name: 'Eva König', email: 'eva@example.de', phone: '017011122233' },
  page: `/fahrzeug/${poolVehicle.slug}`,
  campaign: 'haendlerseite',
});

assert.equal(lead.source, OWNED_DEALER_SITE_SOURCE);
assert.equal(lead.dealerSlug, 'autohaus-trinkle');
assert.equal(lead.listingSlug, poolVehicle.slug);
assert.equal(lead.vehicle.modelKey, 'ev3');
assert.equal(lead.vehicle.trim, 'Earth');
assert.equal(lead.ownedCommercial.discountPercent, 30);
assert.equal(lead.ownedCommercial.listPriceGross, 42960);
assert.equal(lead.ownedCommercial.termMonths, 48);
assert.equal(lead.ownedCommercial.annualMileage, 15000);
assert.equal(lead.ownedCommercial.downPayment, 5000);
assert.equal(lead.ownedCommercial.rate, null);
assert.equal(lead.desiredRate, null);
assert.equal(lead.currentRate, null);
assert.equal(lead.campaign, 'haendlerseite');

const draft = getOfferDraftById(lead, lead.crm.cleverWorkingState.currentOfferDraftId);
assert.ok(draft, 'Concept Draft entsteht automatisch');
assert.equal(draft.rate ?? null, null);
assert.equal(draft.monthlyRate ?? null, null);
assert.equal(draft.commercialScenario.discountPercent, 30);
assert.equal(draft.commercialScenario.listPriceGross, 42960);
assert.equal(draft.commercialScenario.termMonths, 48);
assert.equal(draft.commercialScenario.annualMileage, 15000);
assert.equal(draft.commercialScenario.downPayment, 5000);
assert.equal(draft.commercialScenario.rate ?? null, null);
assert.equal(
  String(draft.vehicleIdentityDraft?.modelKey || draft.modelKey || '').toLowerCase(),
  'ev3',
);

const nba = determineNextBestSellerAction({ lead });
assert.equal(nba.id, 'prepare_offer');
assert.equal(nba.contextPayload.paymentType, 'leasing');
assert.equal(nba.contextPayload.termMonths, 48);
assert.equal(nba.contextPayload.annualMileage, 15000);
assert.equal(nba.contextPayload.downPayment, 5000);

const briefing = buildSellerWorkBriefing({ lead });
assert.match(briefing.text || briefing.lines?.join('\n') || '', /Anfrage auf eigenes EV3-Angebot/);
assert.match(briefing.text || briefing.lines?.join('\n') || '', /30 % Rabatt/);
assert.match(briefing.text || briefing.lines?.join('\n') || '', /15\.000 km/);
assert.match(briefing.text || briefing.lines?.join('\n') || '', /5\.000 €/);

const again = previewOwnedVehiclePublish(published, { id: 'ev3', name: 'EV3' });
assert.equal(again.alreadyPublished, true);
assert.equal(again.spec.discountPercent, 30);
assert.equal(again.spec.listPriceGross, 42960);
assert.equal(again.spec.termMonths, 48);
assert.equal(again.spec.annualMileage, 15000);
assert.equal(again.spec.downPayment, 5000);

const roundtrip = normalizeDealerConditions(published);
assert.equal(roundtrip.ownedVehicleOffer.discountPercent, 30);
assert.equal(roundtrip.ownedVehicleOffer.listPriceGross, 42960);

console.log('ownedDemandListing.golden.test.js: ok');
