/**
 * Dual Input / Single State: unsicheres Paket prüfen → Choice oben = Composer unten
 * node --test src/services/cleverSeller/offerIdentityPackageChoice.ux.golden.test.js
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import { buildUniversalReviewModel } from './buildUniversalReviewModel.js';
import {
  applyOfferIdentityChoiceToSellerTurn,
  resolveUncertainPackageFactChoices,
  projectEquipmentWishFactsFromIdentity,
} from './applyOfferIdentityChoice.js';
import {
  getOfferDraftById,
  mutateActiveOfferDraft,
  parseWorkingDraftFollowUp,
  upsertOfferDraftOnLead,
} from './cleverWorkingDraft.js';
import { buildVehicleIdentityDraftFromFacts } from './vehicleIdentityDraft.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { SELLER_FACT_CLASS, SELLER_TURN_INTENTS } from './sellerFactTypes.js';

function baseLead(id = 'lead-neujean') {
  return {
    id,
    name: 'Pascal Neujean',
    contact: { name: 'Pascal Neujean' },
    paymentType: 'leasing',
    wish: {
      model: 'EV3',
      paymentType: 'leasing',
      termMonths: 36,
      mileagePerYear: 15000,
      downPayment: 0,
    },
    crm: {
      needProfile: createEmptyNeedProfile(),
      cleverWorkingState: { offerDrafts: [] },
    },
  };
}

function uncertainWicFact() {
  return {
    field: 'equipmentWish',
    label: 'Winter Connect Paket prüfen',
    value: {
      id: null,
      label: 'Winter Connect Paket',
      modelKey: 'ev3',
      targetScope: 'offer_vehicle',
      validationStatus: 'needs_review',
      validationReason: 'unknown_or_ambiguous_package',
    },
    confidence: 0.72,
    needsConfirmation: true,
    factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
    rawExpression: 'WIC',
  };
}

function openEv3DraftWithWic(lead, offerDraftId = 'draft-ev3-wic') {
  const identity = buildVehicleIdentityDraftFromFacts({
    facts: [
      {
        field: 'vehicleInterest',
        label: 'Kia EV3',
        value: { modelKey: 'ev3', model: 'EV3' },
        confidence: 1,
      },
      uncertainWicFact(),
    ],
    sellerInput: '5000 € Anzahlung EV3 Earth WIC DRIVE WISE',
  });
  return upsertOfferDraftOnLead(lead, {
    offerDraftId,
    focusModelKey: 'ev3',
    vehicleIdentityDraft: identity,
    commercialScenario: {
      paymentType: 'leasing',
      termMonths: 36,
      annualMileage: 15000,
      downPayment: 5000,
    },
    monthlyRate: null,
  });
}

function turnWithWic(lead, offerDraftId) {
  const draft = getOfferDraftById(lead, offerDraftId);
  return {
    extractedFacts: [
      {
        field: 'vehicleInterest',
        label: 'Kia EV3',
        value: { modelKey: 'ev3' },
        confidence: 1,
        factClass: SELLER_FACT_CLASS.VEHICLE_INTEREST,
      },
      uncertainWicFact(),
    ],
    missingInformation: [],
    preparedActions: [{
      type: SELLER_TURN_INTENTS.PREPARE_OFFER,
      status: 'prepared',
      payload: {
        offerDraftId,
        modelKey: 'ev3',
        vehicleLabel: 'Kia EV3',
        canCreateOffer: true,
        missingRate: true,
        vehicleIdentityDraft: draft.vehicleIdentityDraft,
      },
    }],
    resolvedCustomer: { id: lead.id, name: lead.name },
    lead,
    scopeHint: 'customer_akte',
  };
}

describe('Offer Identity Package Choice UX (Dual Input)', () => {
  it('1: WIC → unsicherer Package-Kandidat', () => {
    const interpreted = interpretSellerInput(
      '5000 € Anzahlung EV3 Earth WIC DRIVE WISE',
      { scopeHint: 'customer_akte' },
    );
    const wic = (interpreted.facts || []).filter((f) => (
      f.field === 'equipmentWish'
      && /winter\s*connect|wic/i.test(`${f.label} ${f.value?.label || ''} ${f.rawExpression || ''}`)
    ));
    assert.ok(wic.length >= 1, 'WIC erkannt');
    assert.ok(wic.some((f) => f.needsConfirmation), 'unsicher / prüfen');
  });

  it('2–3: Korrigieren-Choices aus Katalog inkl. Kandidat + nicht übernehmen', () => {
    const choices = resolveUncertainPackageFactChoices(uncertainWicFact(), 'ev3');
    assert.ok(choices.length >= 2);
    assert.ok(choices.some((c) => /winter\s*connect/i.test(c.label)));
    assert.ok(choices.some((c) => c.id === 'dismiss_package' || /nicht\s+übernehmen/i.test(c.label)));
    assert.ok(choices.some((c) => /drivewise|comfort|premium|technik|komfort|glasdach/i.test(c.label)));
  });

  it('4: Choice Winter Connect → gleiche offerDraftId, Unsicherheit weg', () => {
    let lead = openEv3DraftWithWic(baseLead());
    const offerDraftId = 'draft-ev3-wic';
    // Chip-UI kommt aus Fact-Review (Interesse); Draft-Patch über PREPARE_OFFER-Turn
    const factsOnlyTurn = {
      extractedFacts: [
        {
          field: 'vehicleInterest',
          label: 'Kia EV3',
          value: { modelKey: 'ev3' },
          confidence: 1,
          factClass: SELLER_FACT_CLASS.VEHICLE_INTEREST,
        },
        uncertainWicFact(),
      ],
      missingInformation: [],
      preparedActions: [],
      resolvedCustomer: { id: lead.id, name: lead.name },
      lead,
      scopeHint: 'customer_akte',
    };
    const before = buildUniversalReviewModel(factsOnlyTurn);
    const wishGroup = (before.groups || []).find((g) => g.id === 'wish');
    const chip = (wishGroup?.chips || []).find((c) => /winter\s*connect/i.test(c.label));
    assert.ok(chip?.needsConfirmation, 'Chip mit Unsicherheit');
    assert.ok(Array.isArray(chip.choices) && chip.choices.length > 0, 'Catalog Choices am Chip');

    const turn = turnWithWic(lead, offerDraftId);
    const applied = applyOfferIdentityChoiceToSellerTurn(turn, {
      id: 'candidate:winterconnectpaket',
      label: 'Winter Connect Paket',
      field: 'equipmentWish',
    }, {
      lead,
      field: 'equipmentWish',
      offerDraftId,
      replacesLabel: chip.label,
    });

    assert.equal(applied.offerDraftId, offerDraftId);
    const confirmed = (applied.turn.extractedFacts || []).find((f) => (
      f.field === 'equipmentWish' && /winter\s*connect/i.test(f.label)
    ));
    assert.ok(confirmed);
    assert.equal(confirmed.needsConfirmation, false);
    assert.ok(!(applied.turn.extractedFacts || []).some((f) => (
      f.field === 'equipmentWish' && f.needsConfirmation && /winter\s*connect/i.test(f.label)
    )));
    const draft = getOfferDraftById(applied.lead, offerDraftId);
    assert.equal(draft.offerDraftId, offerDraftId);
    const pkgs = draft.vehicleIdentityDraft.packages || [];
    const winterPkgs = pkgs.filter((p) => /winter|connect|wic/i.test(String(p.raw || '')));
    assert.equal(winterPkgs.length, 1, 'genau ein Winter-/Connect-Paket');
    assert.ok(!/prüfen/i.test(String(winterPkgs[0].raw || '')), 'kein prüfen-Label mehr');
  });

  it('5: Choice nicht übernehmen → Fact aus gleichem Draft entfernt', () => {
    let lead = openEv3DraftWithWic(baseLead(), 'draft-ev3-dismiss');
    const offerDraftId = 'draft-ev3-dismiss';
    const turn = turnWithWic(lead, offerDraftId);
    const applied = applyOfferIdentityChoiceToSellerTurn(turn, {
      id: 'dismiss_package',
      label: 'nicht übernehmen',
      dismiss: true,
      field: 'equipmentWish',
    }, {
      lead,
      field: 'equipmentWish',
      offerDraftId,
      replacesLabel: 'Winter Connect Paket prüfen',
    });
    assert.equal(applied.offerDraftId, offerDraftId);
    assert.ok(!(applied.turn.extractedFacts || []).some((f) => (
      f.field === 'equipmentWish' && /winter\s*connect/i.test(`${f.label}${f.value?.label || ''}`)
    )));
    const draft = getOfferDraftById(applied.lead, offerDraftId);
    assert.equal(draft.offerDraftId, offerDraftId);
    assert.ok(!(draft.vehicleIdentityDraft.packages || []).some((p) => (
      /winter|connect|wic/i.test(String(p.raw || ''))
    )));
  });

  it('6: Composer Winter Connect → gleicher Draft-Patch wie Choice', () => {
    let lead = openEv3DraftWithWic(baseLead(), 'draft-ev3-composer');
    const offerDraftId = 'draft-ev3-composer';
    lead = {
      ...lead,
      crm: {
        ...lead.crm,
        cleverWorkingState: {
          ...lead.crm.cleverWorkingState,
          currentOfferDraftId: offerDraftId,
        },
      },
    };
    const mutation = mutateActiveOfferDraft({
      lead,
      workingMemory: { currentOfferDraftId: offerDraftId },
      sellerInput: 'Winter Connect',
    });
    assert.ok(mutation?.offerDraft);
    assert.equal(mutation.offerDraft.offerDraftId, offerDraftId);
    assert.ok((mutation.vehicleIdentityDraft.packages || []).some((p) => (
      /winter|connect/i.test(String(p.raw || ''))
    )));
  });

  it('7: Composer WIC raus → remove wie nicht übernehmen', () => {
    const followUp = parseWorkingDraftFollowUp('WIC raus');
    assert.equal(followUp?.kind, 'remove_package');
    assert.ok(followUp.removePackages.some((p) => /winter\s*connect|wic/i.test(p)));

    let lead = openEv3DraftWithWic(baseLead(), 'draft-ev3-raus');
    const offerDraftId = 'draft-ev3-raus';
    const mutation = mutateActiveOfferDraft({
      lead,
      workingMemory: { currentOfferDraftId: offerDraftId },
      sellerInput: 'WIC raus',
    });
    assert.ok(mutation?.offerDraft);
    assert.equal(mutation.offerDraft.offerDraftId, offerDraftId);
    assert.ok(!(mutation.vehicleIdentityDraft.packages || []).some((p) => (
      /winter|connect|wic/i.test(String(p.raw || ''))
    )));
  });

  it('11: Angebot vorbereiten bleibt trotz Package-Unsicherheit verfügbar', () => {
    const lead = openEv3DraftWithWic(baseLead(), 'draft-ev3-nba');
    const model = buildUniversalReviewModel(turnWithWic(lead, 'draft-ev3-nba'));
    assert.notEqual(model?.hardReviewRequired, true);
    const offerSec = (model?.actionSections || []).find((s) => (
      s.kind === 'offer_prepare' || s.kind === 'offer_incomplete'
    ));
    assert.ok(offerSec || model?.primaryAction || model?.offerReview);
  });

  it('15: offerDraftId bleibt bei Confirm und Dismiss stabil', () => {
    const id = 'draft-stable-pkg';
    let lead = openEv3DraftWithWic(baseLead(), id);
    const turn = turnWithWic(lead, id);
    const a = applyOfferIdentityChoiceToSellerTurn(turn, {
      label: 'Winter Connect Paket',
      field: 'equipmentWish',
    }, { lead, field: 'equipmentWish', offerDraftId: id, replacesLabel: 'Winter Connect Paket prüfen' });
    assert.equal(a.offerDraftId, id);
    const b = applyOfferIdentityChoiceToSellerTurn(a.turn, {
      id: 'dismiss_package',
      label: 'nicht übernehmen',
      dismiss: true,
      field: 'equipmentWish',
    }, {
      lead: a.lead,
      field: 'equipmentWish',
      offerDraftId: id,
      replacesLabel: 'Winter Connect Paket',
    });
    assert.equal(b.offerDraftId, id);
  });

  it('7b: Choice→Composer raus→Composer add: eine Domain-Mutation, stabile Id, Reload-Projektion', () => {
    const id = 'draft-seq-hard';
    const s0 = openEv3DraftWithWic(baseLead(), id);
    let lead = {
      ...s0,
      crm: {
        ...s0.crm,
        cleverWorkingState: {
          ...s0.crm.cleverWorkingState,
          currentOfferDraftId: id,
        },
      },
    };
    const turn = turnWithWic(lead, id);
    const choice = applyOfferIdentityChoiceToSellerTurn(turn, {
      label: 'Winter Connect Paket',
      field: 'equipmentWish',
    }, {
      lead,
      field: 'equipmentWish',
      offerDraftId: id,
      replacesLabel: 'Winter Connect Paket prüfen',
    });
    assert.equal(choice.offerDraftId, id);
    lead = choice.lead;

    const removed = mutateActiveOfferDraft({
      lead,
      workingMemory: { currentOfferDraftId: id },
      sellerInput: 'WIC raus',
    });
    assert.equal(removed.offerDraft.offerDraftId, id);
    lead = removed.lead;
    const factsRemoved = projectEquipmentWishFactsFromIdentity(
      choice.turn.extractedFacts,
      removed.vehicleIdentityDraft,
      { replacesLabel: 'Winter Connect Paket', modelKey: 'ev3' },
    );
    assert.ok(
      !factsRemoved.some((f) => (
        f.field === 'equipmentWish'
        && /winter|connect|wic|prüfen/i.test(`${f.label}${f.value?.label || ''}`)
      )),
      'kein Winter-prüfen Fact nach raus',
    );
    const pkgsAfterRaus = getOfferDraftById(lead, id).vehicleIdentityDraft.packages || [];
    assert.ok(
      !pkgsAfterRaus.some((p) => /winter|connect|wic/i.test(String(p.raw || ''))),
      'Winter/WIC nach raus weg',
    );

    const added = mutateActiveOfferDraft({
      lead,
      workingMemory: { currentOfferDraftId: id },
      sellerInput: 'Winter Connect',
    });
    assert.equal(added.offerDraft.offerDraftId, id);
    const pkgs = added.vehicleIdentityDraft.packages || [];
    const winter = pkgs.filter((p) => /winter|connect/i.test(String(p.raw || '')));
    assert.equal(winter.length, 1);
    assert.match(String(winter[0].raw), /winter\s*connect/i);
    const reloadIdentity = buildVehicleIdentityDraftFromFacts({
      facts: projectEquipmentWishFactsFromIdentity([], added.vehicleIdentityDraft, { modelKey: 'ev3' })
        .concat([{
          field: 'vehicleInterest',
          label: 'Kia EV3',
          value: { modelKey: 'ev3' },
          confidence: 1,
        }]),
      sellerInput: '',
    });
    assert.ok((reloadIdentity.packages || []).some((p) => /winter|connect/i.test(String(p.raw || ''))));
  });

  it('Semantik: seller_confirmed ≠ catalog_validated', () => {
    const id = 'draft-pkg-sem';
    let lead = openEv3DraftWithWic(baseLead(), id);
    const turn = turnWithWic(lead, id);

    // B: kein Katalogtreffer → Seller bestätigt Candidate
    const confirmed = applyOfferIdentityChoiceToSellerTurn(turn, {
      label: 'Winter Connect Paket',
      field: 'equipmentWish',
      source: 'candidate',
    }, {
      lead,
      field: 'equipmentWish',
      offerDraftId: id,
      replacesLabel: 'Winter Connect Paket prüfen',
    });
    const winter = (getOfferDraftById(confirmed.lead, id).vehicleIdentityDraft.packages || [])
      .find((p) => /winter|connect/i.test(String(p.raw || '')));
    assert.ok(winter);
    assert.equal(winter.catalogValidated, false);
    assert.equal(winter.resolution, 'seller_confirmed');
    assert.equal(winter.canonical, null);
    const fact = (confirmed.turn.extractedFacts || []).find((f) => (
      f.field === 'equipmentWish' && /winter\s*connect/i.test(f.label)
    ));
    assert.equal(fact?.needsConfirmation, false);
    assert.equal(fact?.value?.catalogValidated, false);
    assert.equal(fact?.value?.resolution, 'seller_confirmed');
    assert.equal(fact?.value?.validationStatus, 'seller_confirmed');

    // C: Reload/Projektion behält seller_confirmed
    const projected = projectEquipmentWishFactsFromIdentity(
      [],
      getOfferDraftById(confirmed.lead, id).vehicleIdentityDraft,
      { modelKey: 'ev3' },
    );
    const reloadFact = projected.find((f) => /winter\s*connect/i.test(f.label));
    assert.equal(reloadFact?.needsConfirmation, false);
    assert.equal(reloadFact?.value?.catalogValidated, false);
    assert.equal(reloadFact?.value?.resolution, 'seller_confirmed');

    // A: echter Katalogtreffer
    const catalogChoice = applyOfferIdentityChoiceToSellerTurn(confirmed.turn, {
      label: 'P11 Comfort-Paket',
      id: 'ev3-p11',
      field: 'equipmentWish',
      source: 'catalog',
    }, {
      lead: confirmed.lead,
      field: 'equipmentWish',
      offerDraftId: id,
      replacesLabel: 'Winter Connect Paket',
    });
    // Winter entfernt durch Replace-Familie? winter family replace only for winter - P11 is separate add with replacesLabel winter - removes winter matching facts then adds P11
    const comfort = (getOfferDraftById(catalogChoice.lead, id).vehicleIdentityDraft.packages || [])
      .find((p) => /comfort/i.test(String(p.raw || p.canonical || '')));
    assert.ok(comfort, 'Katalogpaket vorhanden');
    assert.equal(comfort.catalogValidated, true);
    assert.equal(comfort.resolution, 'catalog_validated');
    assert.ok(comfort.canonical);

    // D: Composer = gleiche Semantik wie Choice für Non-Catalog
    let leadD = openEv3DraftWithWic(baseLead(), 'draft-pkg-composer-sem');
    leadD = {
      ...leadD,
      crm: {
        ...leadD.crm,
        cleverWorkingState: {
          ...leadD.crm.cleverWorkingState,
          currentOfferDraftId: 'draft-pkg-composer-sem',
        },
      },
    };
    const mut = mutateActiveOfferDraft({
      lead: leadD,
      workingMemory: { currentOfferDraftId: 'draft-pkg-composer-sem' },
      sellerInput: 'Winter Connect',
    });
    const wicPkg = (mut.vehicleIdentityDraft.packages || [])
      .find((p) => /winter|connect/i.test(String(p.raw || '')));
    assert.equal(wicPkg?.catalogValidated, false);
    assert.equal(wicPkg?.resolution, 'seller_confirmed');

    // Choices: Candidate vs Katalog markiert
    const choices = resolveUncertainPackageFactChoices(uncertainWicFact(), 'ev3');
    assert.ok(choices.some((c) => /winter\s*connect/i.test(c.label) && c.source === 'candidate'));
    assert.ok(choices.some((c) => c.source === 'catalog' && !/winter\s*connect/i.test(c.label)));
  });
});
