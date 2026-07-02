/**
 * Einheitlicher Angebotskalkulator – Routing-Tests
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OFFER_ENTRY_TARGET,
  buildOfferCalculatorNavigateState,
  canEditOfferInCalculator,
  resolveOfferEntryTarget,
  shouldOpenOfferCalculator,
  shouldOpenOfferProposalView,
} from './openOfferCalculator.js';
import {
  BOARD_OFFER_STATUS,
  buildBoardOfferFromDraft,
  buildBoardOfferCardModel,
  resolveBoardOfferPrimaryAction,
} from './boardOfferModel.js';
import { buildVehicleOpportunityCards } from '../customerAkte.js';
import { INTEREST_STATUS, mergeCustomerOfferInteractionPatch } from '../customerOfferInteraction.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const followUpSource = readFileSync(
  join(__dirname, '../../components/dealer-ai/DealerAiLeadFollowUp.jsx'),
  'utf8',
);
const backendAkteSource = readFileSync(
  join(__dirname, '../../pages/backend/BackendLeadAktePage.jsx'),
  'utf8',
);
const dealerAiSource = readFileSync(
  join(__dirname, '../../pages/DealerAIPage.jsx'),
  'utf8',
);
const proposalSource = readFileSync(
  join(__dirname, '../../components/dealer-ai/CustomerOfferProposalView.jsx'),
  'utf8',
);

const draftLead = {
  id: 'lead-draft',
  paymentType: 'leasing',
  wish: { termMonths: 48, mileagePerYear: 15000, downPayment: 0, desiredRate: 386 },
  crm: {
    reservedModels: [{ id: 'ev6', name: 'EV6', modelKey: 'ev6', trimLabel: 'Vision', isPrimary: true }],
  },
};

const draftCards = buildVehicleOpportunityCards({
  lead: draftLead,
  wishFields: draftLead.wish,
  reservedModels: draftLead.crm.reservedModels,
});

assert.equal(resolveOfferEntryTarget(draftCards[0], draftLead), OFFER_ENTRY_TARGET.CALCULATOR);
assert.equal(shouldOpenOfferCalculator(draftCards[0], draftLead), true);
assert.equal(shouldOpenOfferProposalView(draftCards[0], draftLead), false);

const offerDraft = {
  vehicle: { brand: 'Kia', model: 'EV6', modelKey: 'ev6', trimLabel: 'Vision', selectedPackages: [], selectedEquipmentFeatures: [] },
  payment: { type: 'leasing', termMonths: 48, mileagePerYear: 15000, downPayment: 0, calculatedRate: 386, listPrice: 51990 },
  customer: { name: 'Test' },
  timing: {},
  source: { parsedFields: {}, createdFrom: 'customer_akte', originalText: '' },
};

const createdLead = {
  id: 'lead-created',
  crm: {
    vehicleConfigurations: [{
      id: 'vc-ev6',
      modelKey: 'ev6',
      model: 'EV6',
      paymentType: 'leasing',
      leasingData: { termMonths: 48, mileagePerYear: 15000, downPayment: 0, calculatedRate: 386 },
      boardOffer: buildBoardOfferFromDraft(offerDraft, { configId: 'vc-ev6' }),
    }],
  },
};

const createdCards = buildVehicleOpportunityCards({ lead: createdLead });
assert.equal(resolveOfferEntryTarget(createdCards[0], createdLead), OFFER_ENTRY_TARGET.CALCULATOR);

const sentLead = {
  ...createdLead,
  crm: {
    ...createdLead.crm,
    vehicleOffers: {
      'vc-ev6': { id: 'vo-ev6', vehicleCardId: 'vc-ev6', status: 'sent', boardStatus: BOARD_OFFER_STATUS.OFFER_SENT },
    },
  },
};
const sentCards = buildVehicleOpportunityCards({ lead: sentLead });
assert.equal(resolveOfferEntryTarget(sentCards[0], sentLead), OFFER_ENTRY_TARGET.PROPOSAL);
assert.equal(shouldOpenOfferProposalView(sentCards[0], sentLead), true);

const navState = buildOfferCalculatorNavigateState(createdLead, createdCards[0]);
assert.equal(navState.addVehicleContext.openConditions, true);
assert.equal(navState.addVehicleContext.openCalculator, true);
assert.equal(navState.addVehicleContext.vehicleCardId, 'vc-ev6');
assert.ok(navState.addVehicleContext.returnPath.includes('lead-created'));

assert.ok(followUpSource.includes('openBoardOfferEntry'));
assert.ok(backendAkteSource.includes('openOfferCalculator'));
assert.ok(dealerAiSource.includes('openOfferCalculator') || dealerAiSource.includes('buildOfferCalculatorNavigateState'));
assert.ok(!backendAkteSource.includes("setPhase('offer-edit')"), 'Backend nutzt offer-edit nicht mehr');
assert.ok(!dealerAiSource.includes("setPhase('offer-edit')"), 'DealerAI nutzt offer-edit nicht mehr');
assert.ok(proposalSource.includes('canEditOfferInCalculator'));
assert.ok(backendAkteSource.includes('shouldOpenOfferProposalView(offerProposalCard'));

// A) + Angebot erstellen → Kalkulator
assert.ok(followUpSource.includes('startProposalNavigateFlow'));
assert.ok(backendAkteSource.includes('openOfferCalculator'));

// B) Draft-Karte → Kalkulator, nicht Vorschlag
assert.equal(resolveOfferEntryTarget(draftCards[0], draftLead), OFFER_ENTRY_TARGET.CALCULATOR);

// C) offer_created → Kalkulator mit gespeicherten Daten
assert.equal(resolveOfferEntryTarget(createdCards[0], createdLead), OFFER_ENTRY_TARGET.CALCULATOR);
assert.equal(navState.addVehicleContext.vehicleCardId, 'vc-ev6');

// D) Konditionen ergänzen → Kalkulator (configure_conditions)
const configNoRateLead = {
  id: 'lead-config',
  crm: {
    vehicleConfigurations: [{
      id: 'vc-partial',
      modelKey: 'ev6',
      paymentType: 'leasing',
      leasingData: { termMonths: 48, mileagePerYear: 15000, downPayment: 0 },
    }],
  },
};
const partialCards = buildVehicleOpportunityCards({ lead: configNoRateLead });
const partialAction = resolveBoardOfferPrimaryAction(partialCards[0], configNoRateLead);
assert.equal(partialAction.handlerType, 'configure_conditions');
assert.equal(partialAction.label, 'Konditionen ergänzen');

// E) Internes Angebot aus Vorschlag → Kalkulator (canEditOfferInCalculator)
assert.equal(canEditOfferInCalculator(createdCards[0], createdLead), true);

// F) offer_sent → Vorschlag (nur wenn Kundenlink aktiv)
assert.equal(resolveOfferEntryTarget(sentCards[0], sentLead), OFFER_ENTRY_TARGET.PROPOSAL);

// EV6-E2E: Interesse/Status ohne gesendeten Link → trotzdem Kalkulator
const interestedDraftLead = {
  ...createdLead,
  crm: {
    ...createdLead.crm,
    customerOfferInteractions: mergeCustomerOfferInteractionPatch(createdLead, 'vc-ev6', {
      interestStatus: INTEREST_STATUS.INTERESTED,
    }),
    vehicleOffers: {
      'vc-ev6': {
        id: 'vo-ev6',
        vehicleCardId: 'vc-ev6',
        status: 'draft',
        boardStatus: BOARD_OFFER_STATUS.OFFER_SENT,
      },
    },
  },
};
const interestedDraftCards = buildVehicleOpportunityCards({ lead: interestedDraftLead });
assert.equal(
  resolveOfferEntryTarget(interestedDraftCards[0], interestedDraftLead),
  OFFER_ENTRY_TARGET.CALCULATOR,
  'Entwurf mit Interaktion öffnet Kalkulator, nicht Vorschlag',
);

const linkReadyLead = {
  ...createdLead,
  crm: {
    ...createdLead.crm,
    vehicleOffers: {
      'vc-ev6': {
        id: 'vo-ev6',
        vehicleCardId: 'vc-ev6',
        status: 'link_ready',
        onlineLink: { url: 'http://localhost/angebot/test' },
      },
    },
  },
};
const linkReadyCards = buildVehicleOpportunityCards({ lead: linkReadyLead });
assert.equal(
  resolveOfferEntryTarget(linkReadyCards[0], linkReadyLead),
  OFFER_ENTRY_TARGET.CALCULATOR,
  'Vorbereiteter Link ohne Versand → Kalkulator',
);

// G) question_open → Frage beantworten (nur bei Kundenlink)
const questionLead = {
  ...sentLead,
  crm: {
    ...sentLead.crm,
    customerOfferInteractions: mergeCustomerOfferInteractionPatch(sentLead, 'vc-ev6', {
      customerQuestions: [{
        id: 'q1',
        text: 'Frage?',
        status: 'open',
        createdAt: new Date().toISOString(),
      }],
    }),
  },
};
const questionCards = buildVehicleOpportunityCards({ lead: questionLead });
assert.equal(resolveOfferEntryTarget(questionCards[0], questionLead), OFFER_ENTRY_TARGET.ANSWER_QUESTION);

// H) CustomerOfferEditView nicht mehr Standardweg
const editViewSource = readFileSync(
  join(__dirname, '../../components/dealer-ai/CustomerOfferEditView.jsx'),
  'utf8',
);
assert.ok(editViewSource.includes('CustomerOfferEditView'), 'Legacy-View bleibt im Code');
assert.ok(!backendAkteSource.includes("setPhase('offer-edit')"));

// I) Wunschrate ≠ offer_created (draft bleibt draft)
assert.equal(draftCards[0].calculatedRate, undefined);

// J) offer_created Status bei gespeicherter Rate (via board model)
const createdModel = buildBoardOfferCardModel(createdCards[0], createdLead);
assert.equal(createdModel.status, BOARD_OFFER_STATUS.OFFER_CREATED);
assert.ok(createdModel.primaryResult?.value);

console.log('openOfferCalculator.test.js: ok');
