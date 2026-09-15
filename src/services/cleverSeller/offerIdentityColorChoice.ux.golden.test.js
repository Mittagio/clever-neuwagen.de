/**
 * UX: Farbe Choice oben = Composer unten = gleicher Offer-Identity-State
 * node --test src/services/cleverSeller/offerIdentityColorChoice.ux.golden.test.js
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import { buildUniversalReviewModel } from './buildUniversalReviewModel.js';
import { applyOfferIdentityChoiceToSellerTurn } from './applyOfferIdentityChoice.js';
import {
  getOfferDraftById,
  upsertOfferDraftOnLead,
} from './cleverWorkingDraft.js';
import { buildVehicleIdentityDraftFromFacts } from './vehicleIdentityDraft.js';
import {
  listOfferIdentityColorChoices,
  parseOfferIdentityFollowUp,
} from './offerVehicleIdentity.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function offerSection(review) {
  return (review?.actionSections || []).find((s) => (
    s.kind === 'offer_prepare' || s.kind === 'offer_incomplete'
  ));
}

function baseLead(id = 'lead-hinz') {
  return {
    id,
    name: 'Hinz',
    contact: { name: 'Hinz Gunnar' },
    paymentType: 'leasing',
    wish: {
      model: 'EV2',
      paymentType: 'leasing',
      termMonths: 48,
      mileagePerYear: 12500,
      downPayment: 12500,
    },
    crm: {
      needProfile: createEmptyNeedProfile(),
      cleverWorkingState: { offerDrafts: [] },
    },
  };
}

function openEv2Identity() {
  return buildVehicleIdentityDraftFromFacts({
    facts: [{
      field: 'vehicleInterest',
      label: 'Kia EV2',
      value: { modelKey: 'ev2', model: 'EV2' },
      confidence: 1,
    }],
    sellerInput: 'EV2 Angebot',
  });
}

describe('Offer Identity Color Choice UX', () => {
  it('A: Choice oben setzt Farbe am gleichen offerDraftId, localClarify weg', () => {
    let lead = baseLead();
    const identity = openEv2Identity();
    const offerDraftId = 'draft-ev2-color-a';
    lead = upsertOfferDraftOnLead(lead, {
      offerDraftId,
      focusModelKey: 'ev2',
      vehicleIdentityDraft: identity,
      commercialScenario: {
        paymentType: 'leasing',
        termMonths: 48,
        annualMileage: 12500,
        downPayment: 12500,
      },
      monthlyRate: null,
    });

    const turn = {
      extractedFacts: [
        {
          field: 'vehicleInterest',
          label: 'Kia EV2',
          value: { modelKey: 'ev2' },
          confidence: 1,
        },
      ],
      missingInformation: [{
        id: 'offer_color',
        field: 'colorPreference',
        label: 'Welche Farbe soll ins Angebot?',
        choices: listOfferIdentityColorChoices('ev2').slice(0, 6),
      }],
      preparedActions: [{
        type: SELLER_TURN_INTENTS.PREPARE_OFFER,
        status: 'prepared',
        payload: {
          offerDraftId,
          modelKey: 'ev2',
          vehicleLabel: 'Kia EV2',
          canCreateOffer: false,
          missingRate: true,
          vehicleIdentityDraft: identity,
        },
      }],
      resolvedCustomer: { id: lead.id, name: 'Hinz' },
      lead,
      scopeHint: 'customer_akte',
    };

    const before = buildUniversalReviewModel(turn);
    const clarify = offerSection(before)?.localClarify || before.offerReview?.localClarify;
    assert.ok(clarify);
    assert.match(String(clarify.title || ''), /Farbe prüfen/i);
    assert.ok(Array.isArray(clarify.choices) && clarify.choices.length > 0);
    assert.equal(clarify.actionLabel, null);
    assert.ok(clarify.choices.every((c) => c.label && !/catalog|id:/i.test(c.label)));
    assert.ok(clarify.choices.some((c) => c.swatch));

    const magma = clarify.choices.find((c) => /magma/i.test(c.label))
      || clarify.choices[0];
    const applied = applyOfferIdentityChoiceToSellerTurn(turn, magma, {
      lead,
      field: 'colorPreference',
      offerDraftId,
    });
    assert.equal(applied.offerDraftId, offerDraftId);
    const draft = getOfferDraftById(applied.lead, offerDraftId);
    assert.ok(draft);
    assert.match(
      String(draft.vehicleIdentityDraft?.color?.canonical || draft.vehicleIdentityDraft?.color?.raw || ''),
      new RegExp(magma.label.split(/\s+/)[0], 'i'),
    );
    const after = buildUniversalReviewModel(applied.turn);
    const afterClarify = offerSection(after)?.localClarify || after.offerReview?.localClarify;
    assert.ok(
      !afterClarify
      || afterClarify.slotId !== 'offer_color'
      || afterClarify.field !== 'colorPreference'
      || !/Farbe prüfen/i.test(String(afterClarify.title || '')),
      'Farbe prüfen nach Choice weg',
    );
  });

  it('B: Composer „magma rot“ → Katalogfarbe am gleichen Draft', () => {
    let lead = baseLead('lead-hinz-b');
    const identity = openEv2Identity();
    const offerDraftId = 'draft-ev2-color-b';
    lead = upsertOfferDraftOnLead(lead, {
      offerDraftId,
      focusModelKey: 'ev2',
      vehicleIdentityDraft: identity,
      commercialScenario: {
        paymentType: 'leasing',
        termMonths: 48,
        annualMileage: 12500,
        downPayment: 6000,
      },
      monthlyRate: null,
    });
    lead.crm.cleverWorkingState.currentOfferDraftId = offerDraftId;

    const parsed = parseOfferIdentityFollowUp('magma rot');
    assert.ok(parsed?.color);
    assert.match(String(parsed.color), /Magma|rot/i);

    const applied = applyOfferIdentityChoiceToSellerTurn({
      extractedFacts: [],
      missingInformation: [{ id: 'offer_color', field: 'colorPreference' }],
      preparedActions: [{
        type: SELLER_TURN_INTENTS.PREPARE_OFFER,
        status: 'prepared',
        payload: {
          offerDraftId,
          modelKey: 'ev2',
          vehicleIdentityDraft: identity,
        },
      }],
    }, {
      id: 'magma-rot-metallic',
      label: String(parsed.color),
    }, { lead, offerDraftId, field: 'colorPreference' });

    const draft = getOfferDraftById(applied.lead, offerDraftId);
    assert.match(
      String(draft?.vehicleIdentityDraft?.color?.canonical || draft?.vehicleIdentityDraft?.color?.raw || ''),
      /Magma/i,
    );
    assert.equal(draft.offerDraftId, offerDraftId);
  });

  it('C: Presenter + Card verdrahtet – Popover, kein klassisches Select, kein Composer-Hinweis-Default', () => {
    const card = readFileSync(join(__dirname, '../../components/dealer-ai/SellerUniversalReviewCard.jsx'), 'utf8');
    const css = readFileSync(join(__dirname, '../../components/dealer-ai/SellerUniversalReviewCard.css'), 'utf8');
    const composer = readFileSync(join(__dirname, '../../components/clever/CleverGlobalComposer.jsx'), 'utf8');
    const akte = readFileSync(join(__dirname, '../../components/dealer-ai/CustomerAkteSharedWorkspace.jsx'), 'utf8');
    assert.ok(card.includes('sur-card__identity-popover'));
    assert.ok(card.includes('apply_offer_identity_choice'));
    assert.ok(!card.includes('<select'));
    assert.ok(css.includes('sur-card__identity-swatch'));
    assert.ok(composer.includes('applyOfferIdentityChoiceToSellerTurn'));
    assert.ok(akte.includes('applyOfferIdentityChoiceToSellerTurn'));
  });
});
