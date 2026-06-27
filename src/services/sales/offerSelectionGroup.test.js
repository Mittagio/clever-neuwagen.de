/**
 * Clever Auswahl – Angebotsvorschläge
 */
import assert from 'node:assert/strict';
import {
  buildBoardItems,
  buildCleverAuswahlDetailModel,
  createOfferSelectionGroup,
  createOfferSelectionGroupFromWish,
  CUSTOMER_LINK_BUTTON_LABEL,
  findPreparedSelectionGroup,
  formatSelectionGroupSubtitle,
  formatSelectionGroupTrimLine,
  formatVariantPriceLine,
  formatWishConditionsLine,
  groupHasPreparedStatus,
  hasCustomerLinkButton,
  OFFER_SELECTION_GROUP_STATUS,
  OFFER_VARIANT_STATUS,
  pickSelectionTrimIds,
  resolveOfferSelectionGroups,
  resolveSelectionGroupVariant,
  updateVariantCustomerReaction,
} from './offerSelectionGroup.js';
import {
  buildCleverActionRecommendation,
  CLEVER_ACTION_IDS,
} from '../crm/cleverActionEngine.js';
import { buildVehicleOpportunityCards } from '../customerAkte.js';

const sportageWish = {
  model: 'Sportage',
  modelKey: 'sportage',
  paymentType: 'leasing',
  termMonths: 48,
  mileagePerYear: 10000,
  desiredRate: 300,
};

// 1. Sportage-Wunsch erzeugt Auswahlgruppe
const group = createOfferSelectionGroupFromWish({
  lead: { id: 'lead-sportage' },
  wishFields: sportageWish,
});
assert.ok(group, 'Sportage-Wunsch soll Auswahlgruppe erzeugen');
assert.equal(group.modelLabel, 'Kia Sportage');

// 2. Auswahlgruppe enthält Vision, Spirit, GT-Line
const trimIds = pickSelectionTrimIds('sportage');
assert.deepEqual(trimIds, ['vision', 'spirit', 'gt-line']);
const trimLabels = group.variants.map((variant) => variant.trimLabel);
assert.deepEqual(trimLabels, ['Vision', 'Spirit', 'GT-Line']);

// 3. Wunschkonditionen werden übernommen
assert.equal(group.wishConditions.termMonths, 48);
assert.equal(group.wishConditions.mileagePerYear, 10000);
assert.equal(group.wishConditions.desiredRate, 300);
const wishLine = formatWishConditionsLine(group.wishConditions);
assert.ok(wishLine.includes('48 Monate'));
assert.ok(wishLine.includes('10.000 km'));
assert.ok(wishLine.includes('300'));

// 4. Gruppe erscheint in „Auf dem Tisch"
const vehicleCards = buildVehicleOpportunityCards({
  lead: { id: 'lead-sportage' },
  wishFields: sportageWish,
});
const boardItems = buildBoardItems({
  vehicleCards,
  offerSelectionGroups: [group],
});
assert.equal(boardItems.length, 1);
assert.equal(boardItems[0].type, 'selection_group');
assert.equal(formatSelectionGroupSubtitle(boardItems[0].group), '3 Vorschläge vorbereitet');

// 5. Detailansicht zeigt alle Varianten
const detail = buildCleverAuswahlDetailModel(group);
assert.equal(detail.title, 'Clever Auswahl');
assert.equal(detail.variants.length, 3);
assert.equal(detail.variants[0].trimLabel, 'Vision');
assert.equal(detail.variants[1].trimLabel, 'Spirit');
assert.equal(detail.variants[2].trimLabel, 'GT-Line');

// 6. Variante enthält Rate / Preis
const visionRate = formatVariantPriceLine(group.variants[0], 'leasing');
assert.ok(visionRate?.includes('€/Monat'), `Rate erwartet, bekam: ${visionRate}`);
assert.ok(detail.variants.every((variant) => variant.priceLine?.includes('€/Monat')));

// 7. Kundenlink-Button ist vorhanden
assert.equal(detail.customerLinkButtonLabel, CUSTOMER_LINK_BUTTON_LABEL);
assert.equal(hasCustomerLinkButton(detail), true);

// 8. Next-Step zeigt „Auswahl senden“, wenn Gruppe vorbereitet ist
assert.equal(group.status, OFFER_SELECTION_GROUP_STATUS.PREPARED);
assert.equal(groupHasPreparedStatus(group), true);
const prepared = findPreparedSelectionGroup([group]);
assert.ok(prepared);
assert.equal(formatSelectionGroupTrimLine(group), 'Vision · Spirit · GT-Line');

const selectionReco = buildCleverActionRecommendation({
  lead: { id: 'lead-sportage' },
  vehicleCards,
  offerSelectionGroups: [group],
  customerName: 'Max Sportage',
});
assert.equal(selectionReco?.actionId, CLEVER_ACTION_IDS.SELECTION_SEND);
assert.equal(selectionReco?.ctaLabel, 'Auswahl senden');
assert.ok(selectionReco?.explanation?.includes('Varianten'));

// 9. Kunde-Reaktion kann später statusmäßig gespeichert werden
const reacted = updateVariantCustomerReaction(
  group,
  group.variants[1].id,
  OFFER_VARIANT_STATUS.INTERESTED,
);
assert.equal(reacted.status, OFFER_SELECTION_GROUP_STATUS.CUSTOMER_REACTED);
assert.equal(
  reacted.variants.find((variant) => variant.id === group.variants[1].id).status,
  OFFER_VARIANT_STATUS.INTERESTED,
);

// EV3: Air, Earth, GT-Line
const ev3Group = createOfferSelectionGroup({
  modelKey: 'ev3',
  wishConditions: { paymentType: 'leasing' },
});
assert.deepEqual(
  ev3Group.variants.map((variant) => variant.trimId),
  ['air', 'earth', 'gt-line'],
);
assert.equal(ev3Group.variants[1].label, 'Clever Empfehlung');

const resolved = resolveOfferSelectionGroups({
  lead: { id: 'lead-ev3', crm: {} },
  wishFields: { model: 'EV3', paymentType: 'leasing' },
});
assert.equal(resolved.length, 1);

const summary = detail.variants[0];
const resolvedVariant = resolveSelectionGroupVariant(group, summary);
assert.equal(resolvedVariant?.trimId, group.variants[0].trimId);
assert.equal(resolvedVariant?.trimLabel, group.variants[0].trimLabel);

const staleSummary = { id: 'stale-id', trimLabel: summary.trimLabel };
const resolvedByLabel = resolveSelectionGroupVariant(group, staleSummary);
assert.equal(resolvedByLabel?.trimId, group.variants[0].trimId);

assert.equal(resolveSelectionGroupVariant(group, null), null);

console.log('offerSelectionGroup.test.js: ok');
