/**
 * Soft-Label + Offer/Primary-Target Regressionen.
 * node --test src/services/cleverSeller/softLabelAndOfferTarget.regression.test.js
 */
import assert from 'node:assert/strict';
import { createExtractedFact } from './cleverSellerTurnResultSchema.js';
import { normalizeFactDisplayLabel } from './normalizeFactDisplayLabel.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { applyStructuredFactsToLead } from './applyAcceptedSellerTurn.js';
import { resolveOfferVehicleTarget, OFFER_VEHICLE_TARGET_STATUS } from './offerVehicleIdentity.js';
import {
  createEmptyNeedProfile,
  getNeedProfileFromLead,
} from '../consultation/needProfileService.js';
import {
  ensureVehicleTrack,
  listCustomerVehicleTracks,
  VEHICLE_TRACK_STATUS,
} from '../crm/vehicleTrack.js';
import { buildVehicleOpportunityCards } from '../customerAkte.js';
import { buildCustomerSnapshotModel } from '../dealer/buildCustomerSnapshotModel.js';
import { appendSellerInsightsFromTexts } from '../dealer/sellerInsights.js';

function leadWithEv5Primary() {
  let lead = {
    id: 'lead-test-kunde',
    name: 'Test Kunde',
    contact: { name: 'Test Kunde', kind: 'private' },
    vehicle: { brand: 'Kia', model: 'EV5', modelKey: 'ev5', label: 'Kia EV5' },
    crm: {
      needProfile: { ...createEmptyNeedProfile(), selectedModelKey: 'ev5', modelHint: 'ev5' },
      vehicleConfigurations: [],
      vehicleOffers: {},
      sellerInsights: [],
    },
  };
  const ensured = ensureVehicleTrack(lead, {
    vehicleKey: 'kia-ev5',
    displayName: 'Kia EV5',
    model: 'EV5',
    modelKey: 'ev5',
  });
  lead = ensured.lead;
  return {
    ...lead,
    crm: {
      ...lead.crm,
      focusedVehicleTrackId: ensured.trackId,
      vehicleConfigurations: (lead.crm.vehicleConfigurations || []).map((c) => (
        c.id === ensured.trackId
          ? {
            ...c,
            vehicleTrack: {
              ...(c.vehicleTrack || {}),
              status: VEHICLE_TRACK_STATUS.ACTIVE,
            },
          }
          : c
      )),
    },
  };
}

// A: vehicleInterest object value → lesbares Label, nie [object Object]
{
  const fact = createExtractedFact({
    factClass: 'vehicle_interest',
    field: 'vehicleInterest',
    value: { modelKey: 'ev3', model: 'EV3', trim: 'Air', make: 'Kia' },
  });
  assert.notEqual(fact.label, '[object Object]');
  assert.match(fact.label, /EV3/i);
  assert.match(fact.label, /Air/i);

  const fromObjLabel = normalizeFactDisplayLabel(
    { modelKey: 'ev3', model: 'EV3', trim: 'Air' },
    null,
  );
  assert.match(fromObjLabel, /EV3/i);
  assert.ok(!fromObjLabel.includes('[object Object]'));

  let lead = appendSellerInsightsFromTexts(leadWithEv5Primary(), ['[object Object]'], {
    source: 'seller',
  });
  lead = {
    ...lead,
    crm: {
      ...lead.crm,
      sellerInsights: [
        ...(lead.crm.sellerInsights || []),
        {
          id: 'si-obj',
          text: '[object Object]',
          understoodLabels: [{ modelKey: 'ev3', model: 'EV3', trim: 'Air' }],
          source: 'seller',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'si-color-obj',
          text: 'Farbe',
          understoodLabels: [{ color: 'schwarz' }],
          source: 'seller',
          createdAt: new Date().toISOString(),
        },
      ],
    },
  };
  const snap = buildCustomerSnapshotModel(lead);
  const softLabels = [
    ...(snap.soft?.chips || []).map((c) => c.label),
    ...(snap.soft?.groups || []).flatMap((g) => (g.facts || []).map((f) => f.label)),
    ...(snap.soft?.summary?.tokens || []).map((t) => t.label),
  ];
  assert.ok(
    softLabels.every((l) => !String(l).includes('[object Object]')),
    `Soft darf kein [object Object] zeigen, got ${JSON.stringify(softLabels)}`,
  );
  // Objekt-Label Farbe → lesbar in Fahrzeugwunsch; Modell-Objekt → Header (kein Soft-Müll)
  assert.ok(
    softLabels.some((l) => /schwarz/i.test(String(l))),
    `Farbe aus Objekt-Label lesbar, got ${JSON.stringify(softLabels)}`,
  );
  console.log('✓ Soft label string regression');
}

// B: EV3 Capture → Primary EV3; dann „EV2 … Angebot“ → Focus/Offer EV2
{
  const lead = leadWithEv5Primary();
  const ev3Turn = interpretSellerInput('EV3 Air Schwarz', { lead });
  const afterEv3 = applyStructuredFactsToLead(lead, ev3Turn.facts);
  assert.equal(getNeedProfileFromLead(afterEv3).selectedModelKey, 'ev3');
  assert.match(String(afterEv3.vehicle?.model || ''), /EV3/i);

  const cardsEv3 = buildVehicleOpportunityCards({ lead: afterEv3 });
  assert.match(
    String(cardsEv3[0]?.modelName || cardsEv3[0]?.modelKey || ''),
    /EV3/i,
    'Primary nach EV3-Capture = EV3',
  );

  const ev3Track = listCustomerVehicleTracks(afterEv3)
    .find((t) => /ev3/i.test(t.config?.modelKey || t.modelLabel));
  assert.ok(ev3Track);
  assert.equal(afterEv3.crm?.focusedVehicleTrackId, ev3Track.id);
  const colorOnEv3 = String(
    ev3Track.config?.colorLabel
    || ev3Track.config?.vehicleTrack?.preferredColor
    || '',
  ).toLowerCase();
  assert.match(colorOnEv3, /schwarz/, 'Schwarz an EV3-Zielspur');

  const ev2Input = 'EV2 AIR Winterpaket schwarz Angebot';
  const ev2Turn = interpretSellerInput(ev2Input, { lead: afterEv3 });
  assert.ok(ev2Turn.facts.some((f) => f.field === 'vehicleInterest' && f.value?.modelKey === 'ev2'));
  assert.ok(
    ev2Turn.facts.some((f) => (
      f.field === 'equipmentWish' && /winter/i.test(String(f.label || ''))
    )) || ev2Turn.facts.some((f) => /winter/i.test(String(f.value?.package || ''))),
    'Winterpaket erkannt',
  );

  const target = resolveOfferVehicleTarget({
    lead: afterEv3,
    sellerInput: ev2Input,
    facts: ev2Turn.facts,
  });
  assert.equal(target.status, OFFER_VEHICLE_TARGET_STATUS.RESOLVED);
  assert.equal(target.modelKey, 'ev2');
  assert.equal(target.createNew, true, 'EV2 ohne Spur → anlegen');

  const afterEv2 = applyStructuredFactsToLead(afterEv3, ev2Turn.facts);
  assert.equal(getNeedProfileFromLead(afterEv2).selectedModelKey, 'ev2');
  const cardsEv2 = buildVehicleOpportunityCards({ lead: afterEv2 });
  assert.match(
    String(cardsEv2[0]?.modelName || cardsEv2[0]?.modelKey || ''),
    /EV2/i,
    'Primary nach EV2-Angebot = EV2',
  );
  const ev2Track = listCustomerVehicleTracks(afterEv2)
    .find((t) => /ev2/i.test(t.config?.modelKey || t.modelLabel));
  assert.ok(ev2Track);
  assert.equal(afterEv2.crm?.focusedVehicleTrackId, ev2Track.id);
  const colorOnEv2 = String(
    ev2Track.config?.colorLabel
    || ev2Track.config?.vehicleTrack?.preferredColor
    || '',
  ).toLowerCase();
  assert.match(colorOnEv2, /schwarz/, 'schwarz an EV2-Zielspur');
  const reqs = ev2Track.customerRequirements || [];
  assert.ok(
    reqs.some((r) => /winter/i.test(String(r)))
    || (afterEv2.crm?.needProfile?.equipmentWishes || []).some((w) => /winter/i.test(String(w))),
    'Winterpaket an Zielspur / Equipment',
  );
  console.log('✓ EV3 capture → primary EV3; EV2 Angebot → focus/offer EV2');
}

console.log('softLabelAndOfferTarget.regression.test.js OK');
