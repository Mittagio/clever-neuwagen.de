/**
 * Vehicle Identity Draft → Offer Handoff – Golden Cases A–D
 * node --test src/services/cleverSeller/vehicleIdentityDraft.golden.test.js
 */
import assert from 'node:assert/strict';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import { VEHICLE_TRACK_STATUS } from '../crm/vehicleTrack.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import {
  applyIdentityFollowUpPatch,
  buildComposerOfferHandoff,
  buildVehicleIdentityDraftFromFacts,
  enrichPrepareOfferPayloadWithIdentityDraft,
  formatIdentityDraftExtrasLine,
} from './vehicleIdentityDraft.js';
import {
  resolveMagicVehicleFields,
  magicPreparationToConfigurePatch,
} from '../dealer/magicOfferService.js';

function christinaLead() {
  return {
    id: 'lead-christina',
    name: 'Christina Deuschle',
    contact: { name: 'Christina Deuschle' },
    paymentType: 'leasing',
    desiredRate: 324,
    vehicle: { brand: 'Kia', model: 'EV4', trim: 'Air', modelKey: 'ev4' },
    wish: {
      model: 'EV4',
      modelKey: 'ev4',
      trim: 'Air',
      paymentType: 'leasing',
      termMonths: 48,
      mileagePerYear: 15000,
      downPayment: 0,
      desiredRate: 324,
    },
    crm: {
      needProfile: {
        ...createEmptyNeedProfile(),
        selectedModelKey: 'ev4',
      },
      focusedVehicleTrackId: 'vc-ev4',
      vehicleConfigurations: [
        {
          id: 'vc-ev4',
          brand: 'Kia',
          model: 'EV4',
          modelKey: 'ev4',
          trimLabel: 'Air',
          desiredRate: 324,
          vehicleTrack: { status: VEHICLE_TRACK_STATUS.ACTIVE },
        },
      ],
    },
  };
}

function prepareAction(turn) {
  return (turn.preparedActions || []).find((a) => (
    a.type === SELLER_TURN_INTENTS.PREPARE_OFFER
  ));
}

// --- Golden A: EV2 Air Winterpaket weiß Angebot trotz EV4 + 324 ---
{
  const lead = christinaLead();
  const turn = runCleverSellerTurn({
    sellerInput: 'EV2 AIR Winterpaket\nweiß Angebot',
    lead,
    leads: [lead],
  });
  const action = prepareAction(turn);
  assert.ok(action, 'PREPARE_OFFER erwartet');
  const payload = action.payload;
  assert.ok(payload?.vehicleIdentityDraft, 'vehicleIdentityDraft muss entstehen');
  assert.equal(payload.vehicleIdentityDraft.model.canonical, 'EV2');
  assert.equal(payload.vehicleIdentityDraft.modelKey, 'ev2');
  assert.match(String(payload.vehicleIdentityDraft.trim.canonical || ''), /Air/i);
  assert.ok(
    payload.vehicleIdentityDraft.packages.some((p) => /winter/i.test(p.raw || '')),
    'Winterpaket muss im Draft bleiben',
  );
  assert.ok(
    /weiß|weiss/i.test(payload.vehicleIdentityDraft.color?.raw || ''),
    'weiß muss im Draft bleiben',
  );
  assert.ok(payload.offerDraftId, 'offerDraftId für Handoff');
  assert.equal(payload.invalidateVehicleRate, true);
  assert.equal(payload.monthlyRate, null, 'keine EV4-Rate im neuen Draft');
  assert.notEqual(payload.vehicle?.modelKey, 'ev4');

  const extras = formatIdentityDraftExtrasLine(payload.vehicleIdentityDraft);
  assert.match(extras || '', /Winter/i);
  assert.match(extras || '', /Weiß|weiß|weiss/i);

  const handoff = buildComposerOfferHandoff(payload.offerDraft, {
    sellerInput: 'EV2 AIR Winterpaket weiß Angebot',
  });
  const vehicle = resolveMagicVehicleFields(handoff);
  assert.equal(vehicle.modelKey, 'ev2');
  assert.match(String(vehicle.trimLabel || ''), /Air/i);
  assert.ok(vehicle.packageLabels?.some((p) => /winter/i.test(p)));
  assert.ok(/weiß|weiss/i.test(vehicle.colorLabel || ''));

  const patch = magicPreparationToConfigurePatch(handoff);
  assert.equal(patch.modelKey, 'ev2');
  assert.equal(patch.desiredRate, null, 'Patch darf keine 324€ Rate tragen');
  assert.ok(patch.packageLabels?.some((p) => /winter/i.test(p)));

  // Keine erfundenen Pakete WIC/UPGRADE/BUSINESS
  const invented = (payload.vehicleIdentityDraft.packages || [])
    .filter((p) => /^(wic|upgrade|business)$/i.test(String(p.raw || '').trim()));
  assert.equal(invented.length, 0, 'keine erfundenen Pakete');
}

// --- Golden B: EV2 Winterpaket weiß ohne Trim → Draft trotzdem ---
{
  const lead = christinaLead();
  const turn = runCleverSellerTurn({
    sellerInput: 'EV2 Winterpaket weiß',
    lead,
    leads: [lead],
  });
  const facts = turn.extractedFacts || [];
  const draft = buildVehicleIdentityDraftFromFacts({
    facts,
    sellerInput: 'EV2 Winterpaket weiß',
    customerId: lead.id,
  });
  assert.equal(draft.modelKey, 'ev2');
  assert.ok(
    draft.trim.status === 'open' || !draft.trim.raw,
    'Trim darf open bleiben',
  );
  assert.ok(draft.packages.some((p) => /winter/i.test(p.raw || '')));
  assert.ok(/weiß|weiss/i.test(draft.color?.raw || ''));
}

// --- Golden C: EV3 Earth 81,4 kWh Auroraschwarz Business Paket – Zero-Loss ---
{
  const lead = christinaLead();
  const turn = runCleverSellerTurn({
    sellerInput: 'EV3 Earth 81,4 kWh Auroraschwarz Business Paket',
    lead,
    leads: [lead],
  });
  const draft = buildVehicleIdentityDraftFromFacts({
    facts: turn.extractedFacts || [],
    sellerInput: 'EV3 Earth 81,4 kWh Auroraschwarz Business Paket',
    customerId: lead.id,
  });
  assert.equal(draft.modelKey, 'ev3');
  assert.match(String(draft.trim.canonical || draft.trim.raw || ''), /Earth/i);
  assert.ok(
    /aurora|schwarz/i.test(draft.color?.raw || draft.color?.canonical || ''),
    'Auroraschwarz erhalten',
  );
  assert.ok(
    draft.packages.some((p) => /business/i.test(p.raw || ''))
    || (turn.extractedFacts || []).some((f) => (
      f.field === 'equipmentWish' && /business/i.test(f.label || '')
    )),
    'Business Paket erhalten',
  );
  const power = draft.powertrainVariant?.raw || '';
  const hasKwhFact = (turn.extractedFacts || []).some((f) => (
    /81/.test(String(f.label || f.value || ''))
  ));
  assert.ok(/81/.test(power) || hasKwhFact, '81,4 kWh Hinweis erhalten');
}

// --- Golden D: Follow-up doch Earth und schwarz – selber Draft ---
{
  const lead = christinaLead();
  const turnA = runCleverSellerTurn({
    sellerInput: 'EV2 AIR Winterpaket weiß Angebot',
    lead,
    leads: [lead],
  });
  const payloadA = prepareAction(turnA)?.payload;
  assert.ok(payloadA?.vehicleIdentityDraft);
  const afterFollowUp = applyIdentityFollowUpPatch(payloadA.vehicleIdentityDraft, {
    trim: 'Earth',
    color: 'schwarz',
  });
  assert.equal(afterFollowUp.id, payloadA.vehicleIdentityDraft.id, 'gleicher Draft');
  assert.equal(afterFollowUp.modelKey, 'ev2');
  assert.match(String(afterFollowUp.trim.canonical || ''), /Earth/i);
  assert.ok(/schwarz/i.test(afterFollowUp.color?.raw || ''));
  assert.ok(
    afterFollowUp.packages.some((p) => /winter/i.test(p.raw || '')),
    'Winterpaket bleibt bei Follow-up',
  );

  const withoutWinter = applyIdentityFollowUpPatch(afterFollowUp, {
    removePackages: ['Winterpaket'],
  });
  assert.equal(withoutWinter.packages.length, 0);
  assert.equal(withoutWinter.modelKey, 'ev2');
}

// --- Enrich Payload: EV4 Lead darf Handoff nicht überschreiben ---
{
  const lead = christinaLead();
  const enriched = enrichPrepareOfferPayloadWithIdentityDraft({
    vehicleLabel: 'Kia EV2 Air',
    vehicle: { model: 'EV2', trim: 'Air', modelKey: 'ev2', make: 'Kia' },
    createNewAlternative: true,
    monthlyRate: 324,
    rateAuthority: 'non_authoritative',
    customerId: lead.id,
  }, {
    facts: [
      {
        field: 'vehicleInterest',
        label: 'Kia EV2 Air',
        value: { model: 'EV2', modelKey: 'ev2', trim: 'Air' },
      },
      { field: 'colorPreference', label: 'weiß', value: 'weiß' },
      { field: 'equipmentWish', label: 'Winterpaket', value: { label: 'Winterpaket' } },
    ],
    sellerInput: 'EV2 AIR Winterpaket weiß Angebot',
    lead,
  });
  assert.equal(enriched.vehicle.modelKey, 'ev2');
  assert.equal(enriched.monthlyRate, null);
  assert.ok(enriched.offerDraftId);
  assert.equal(resolveMagicVehicleFields(enriched).modelKey, 'ev2');
}

console.log('vehicleIdentityDraft.golden.test.js: ok');
