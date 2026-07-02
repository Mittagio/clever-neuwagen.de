/**
 * Angebots-Arbeitsbereich – Board-Offer-Modell Tests A–N
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BOARD_OFFER_STATUS,
  buildBoardOfferCardModel,
  buildBoardOfferFromDraft,
  duplicateVehicleConfiguration,
  filterSendableVehicleCards,
  isBoardOfferSendable,
  resolveBoardOfferPrimaryAction,
  resolveBoardOfferStatus,
} from './boardOfferModel.js';
import { buildVehicleOpportunityCards } from '../customerAkte.js';
import { buildKundenakteEnrichmentFromOfferDraft } from '../dealerAiOfferCreate.js';
import { buildPortfolioItems } from '../crm/customerOfferPortfolioService.js';
import {
  buildCleverActionContext,
  CLEVER_ACTION_IDS,
  recommendCleverAction,
} from '../crm/cleverActionEngine.js';
import { getCustomerOfferInteraction, mergeCustomerOfferInteractionPatch } from '../customerOfferInteraction.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cardSource = readFileSync(
  join(__dirname, '../../components/dealer-ai/CustomerAkteVehicleCard.jsx'),
  'utf8',
);
const followUpSource = readFileSync(
  join(__dirname, '../../components/dealer-ai/DealerAiLeadFollowUp.jsx'),
  'utf8',
);
const boardSource = readFileSync(
  join(__dirname, '../../components/dealer-ai/CustomerAkteBoard.jsx'),
  'utf8',
);
const conditionsPreviewSource = readFileSync(
  join(__dirname, '../configuration/conditionsStepPreview.js'),
  'utf8',
);

const draftLead = {
  id: 'lead-draft',
  paymentType: 'leasing',
  crm: {
    reservedModels: [
      { id: 'ev6-draft', name: 'EV6', modelKey: 'ev6', trimLabel: 'Vision', isPrimary: true },
    ],
  },
  wish: { termMonths: 48, mileagePerYear: 10000, desiredRate: 399 },
};

const draftCards = buildVehicleOpportunityCards({
  lead: draftLead,
  wishFields: draftLead.wish,
  reservedModels: draftLead.crm.reservedModels,
});
const draftCard = draftCards[0];

// A) Draft ohne Rate zeigt ENTWURF
const draftModel = buildBoardOfferCardModel(draftCard, draftLead);
assert.equal(draftModel.status, BOARD_OFFER_STATUS.DRAFT);
assert.equal(draftModel.badge.label, 'ENTWURF');
assert.equal(draftModel.isDraft, true);
assert.ok(cardSource.includes('cust-akte-vcard--draft'));
assert.ok(cardSource.includes('budgetHint'));
assert.ok(conditionsPreviewSource.includes('buildConditionsFooterSummary'));

// B) Draft zeigt Aktion Angebot erstellen
assert.equal(draftModel.primaryAction?.label, 'Angebot erstellen');
assert.equal(draftModel.primaryAction?.handlerType, 'create_offer');
assert.equal(draftModel.primaryResult, null);
assert.ok(draftModel.budgetHint?.includes('399'));

const leasingOfferDraft = {
  vehicle: {
    brand: 'Kia',
    model: 'EV3',
    modelKey: 'ev3',
    trimLabel: 'Earth',
    selectedPackages: [],
    selectedEquipmentFeatures: [],
  },
  payment: {
    type: 'leasing',
    termMonths: 48,
    mileagePerYear: 10000,
    downPayment: 0,
    calculatedRate: 359,
    listPrice: 51990,
  },
  customer: { name: 'Test Kunde' },
  timing: {},
  source: { parsedFields: {}, createdFrom: 'customer_akte', originalText: '' },
};

const createdLead = {
  id: 'lead-created',
  paymentType: 'leasing',
  crm: {
    vehicleConfigurations: [{
      id: 'vc-ev3',
      modelKey: 'ev3',
      model: 'EV3',
      trimLabel: 'Earth',
      paymentType: 'leasing',
      leasingData: {
        termMonths: 48,
        mileagePerYear: 10000,
        downPayment: 0,
        calculatedRate: 359,
        listPrice: 51990,
      },
      boardOffer: buildBoardOfferFromDraft(leasingOfferDraft, { configId: 'vc-ev3' }),
    }],
    vehicleOffers: {
      'vc-ev3': {
        id: 'vo-vc-ev3',
        vehicleCardId: 'vc-ev3',
        status: 'draft',
        boardStatus: BOARD_OFFER_STATUS.OFFER_CREATED,
        boardOffer: buildBoardOfferFromDraft(leasingOfferDraft, { configId: 'vc-ev3' }),
      },
    },
  },
};

const createdCards = buildVehicleOpportunityCards({ lead: createdLead });
const leasingCard = createdCards[0];
const leasingModel = buildBoardOfferCardModel(leasingCard, createdLead);

// C) Leasing mit monthlyRate zeigt ANGEBOT ERSTELLT + Rate
assert.equal(leasingModel.status, BOARD_OFFER_STATUS.OFFER_CREATED);
assert.equal(leasingModel.badge.label, 'ANGEBOT ERSTELLT');
assert.match(leasingModel.primaryResult?.value ?? '', /359/);

// D) Leasing Chips
assert.ok(leasingModel.conditionChips.some((chip) => /48 Monate/.test(chip.label)));
assert.ok(leasingModel.conditionChips.some((chip) => /10\.000 km\/Jahr/.test(chip.label)));
assert.ok(leasingModel.conditionChips.some((chip) => /0 € Anzahlung/.test(chip.label)));

// E) Barangebot
const cashOfferDraft = {
  ...leasingOfferDraft,
  payment: {
    type: 'cash',
    listPrice: 50990,
    discountPercent: 18,
    calculatedRate: 41812,
  },
};
const cashLead = {
  id: 'lead-cash',
  crm: {
    vehicleConfigurations: [{
      id: 'vc-sportage',
      modelKey: 'sportage',
      model: 'Sportage',
      trimLabel: 'Vision',
      paymentType: 'cash',
      cashPurchaseData: {
        calculatedPrice: 41812,
        listPrice: 50990,
        discountPercent: 18,
      },
      boardOffer: buildBoardOfferFromDraft(cashOfferDraft, { configId: 'vc-sportage' }),
    }],
  },
};
const cashCard = buildVehicleOpportunityCards({ lead: cashLead })[0];
const cashModel = buildBoardOfferCardModel(cashCard, cashLead);
assert.equal(cashModel.badge.label, 'BARANGEBOT ERSTELLT');
assert.ok(cashModel.conditionChips.some((chip) => /18 % Rabatt/.test(chip.label)));
assert.match(cashModel.primaryResult?.value ?? '', /41\.812/);

// F) Finanzierung mit Schlussrate
const financeOfferDraft = {
  ...leasingOfferDraft,
  vehicle: { ...leasingOfferDraft.vehicle, model: 'EV2', modelKey: 'ev2' },
  payment: {
    type: 'financing',
    termMonths: 48,
    downPayment: 3000,
    calculatedRate: 299,
    finalRate: 17900,
  },
};
const financeLead = {
  id: 'lead-finance',
  crm: {
    vehicleConfigurations: [{
      id: 'vc-ev2',
      modelKey: 'ev2',
      model: 'EV2',
      trimLabel: 'Earth',
      paymentType: 'financing',
      financingData: {
        termMonths: 48,
        downPayment: 3000,
        calculatedRate: 299,
        finalRate: 17900,
      },
      boardOffer: buildBoardOfferFromDraft(financeOfferDraft, { configId: 'vc-ev2' }),
    }],
  },
};
const financeCard = buildVehicleOpportunityCards({ lead: financeLead })[0];
const financeModel = buildBoardOfferCardModel(financeCard, financeLead);
assert.equal(financeModel.badge.label, 'FINANZIERUNG ERSTELLT');
assert.ok(financeModel.conditionChips.some((chip) => /Schlussrate/.test(chip.label)));
assert.match(financeModel.primaryResult?.value ?? '', /299/);

// G) offer_created: primär Bearbeiten, Klick öffnet Editor
assert.equal(leasingModel.primaryAction?.label, 'Bearbeiten');
assert.equal(leasingModel.primaryAction?.handlerType, 'edit_offer');
assert.ok(leasingModel.secondaryActions.some((action) => action.label === 'Senden'));
assert.ok(cardSource.includes('onAction'));
assert.ok(cardSource.includes('handleCardClick'));
assert.ok(followUpSource.includes('navigateBoardOfferCard'));
assert.ok(followUpSource.includes('resolveBoardOfferPrimaryAction'));
assert.ok(followUpSource.includes("handler === 'view_proposal'"));
assert.ok(followUpSource.includes('onOpenOfferEdit(card)'));
assert.ok(followUpSource.includes('startProposalNavigateFlow'));
assert.ok(!followUpSource.includes('function openVehicleCard'));

// H) Speichern setzt offer_created
const enrichment = buildKundenakteEnrichmentFromOfferDraft(leasingOfferDraft, {
  configId: 'vc-ev3',
});
assert.equal(
  enrichment.crmPatch.vehicleOffers['vc-ev3'].boardStatus,
  BOARD_OFFER_STATUS.OFFER_CREATED,
);
assert.equal(enrichment.crmPatch.lastOfferStatus, BOARD_OFFER_STATUS.OFFER_CREATED);

// I) Duplizieren übernimmt Konfiguration
const duplicated = duplicateVehicleConfiguration(createdLead.crm.vehicleConfigurations[0], {
  newId: 'vc-ev3-copy',
});
assert.equal(duplicated.boardOffer.status, BOARD_OFFER_STATUS.OFFER_CREATED);
assert.equal(duplicated.leasingData.calculatedRate, 359);
assert.notEqual(duplicated.id, 'vc-ev3');

// J) Mehrere offer_created sendbar
const sendable = filterSendableVehicleCards(createdCards, createdLead);
assert.equal(sendable.length, 1);
const portfolioItems = buildPortfolioItems({
  lead: createdLead,
  offerSelectionGroups: [],
  vehicleCards: createdCards,
});
assert.equal(portfolioItems.length, 1);

// K) Drafts nicht sendbar
const mixedCards = [...draftCards, ...createdCards];
const mixedSendable = filterSendableVehicleCards(mixedCards, createdLead);
assert.equal(mixedSendable.length, 1);
const draftPortfolio = buildPortfolioItems({
  lead: draftLead,
  offerSelectionGroups: [],
  vehicleCards: draftCards,
});
assert.equal(draftPortfolio.length, 0);

// L) Frage offen zeigt Badge, Daten bleiben
const questionLead = {
  ...createdLead,
  crm: {
    ...createdLead.crm,
    customerOfferInteractions: mergeCustomerOfferInteractionPatch(createdLead, 'vc-ev3', {
      customerQuestions: [{
        id: 'q-1',
        text: 'Was ist in der Rate enthalten?',
        status: 'open',
        createdAt: new Date().toISOString(),
      }],
    }),
  },
};
const questionCard = buildVehicleOpportunityCards({ lead: questionLead })[0];
const questionModel = buildBoardOfferCardModel(questionCard, questionLead);
assert.equal(questionModel.badge.label, 'FRAGE OFFEN');
assert.match(questionModel.primaryResult?.value ?? '', /359/);
assert.equal(questionModel.questionHint, '1 Frage offen');
assert.equal(questionModel.primaryAction?.handlerType, 'answer_question');
assert.equal(questionModel.primaryAction?.label, 'Frage beantworten');
assert.ok(questionModel.secondaryActions.some((action) => action.handlerType === 'view_proposal'));

// M) Nächster guter Schritt: draft → Angebot erstellen
const draftRec = recommendCleverAction(buildCleverActionContext({
  lead: draftLead,
  vehicleCards: draftCards,
}));
assert.equal(draftRec.actionId, CLEVER_ACTION_IDS.OFFER_DRAFT_CREATE);

// N) Nächster guter Schritt: offer_created → senden
const sendRec = recommendCleverAction(buildCleverActionContext({
  lead: createdLead,
  vehicleCards: createdCards,
}));
assert.equal(sendRec.actionId, CLEVER_ACTION_IDS.OFFER_CREATED_SEND);

assert.ok(boardSource.includes('Angebots-Arbeitsbereich'));
assert.ok(boardSource.includes('+ Angebot erstellen'));
assert.equal(resolveBoardOfferStatus(draftCard, draftLead), BOARD_OFFER_STATUS.DRAFT);
assert.equal(isBoardOfferSendable(leasingCard, createdLead), true);
assert.equal(isBoardOfferSendable(draftCard, draftLead), false);

// Navigation: Draft primaryAction = create_offer, Klick → Editor nicht Vorschlag
assert.equal(resolveBoardOfferPrimaryAction(draftCard, draftLead).handlerType, 'create_offer');
assert.ok(followUpSource.includes('onCardClick={navigateBoardOfferCard}'));

// Navigation: offer_created → edit_offer
assert.equal(resolveBoardOfferPrimaryAction(leasingCard, createdLead).handlerType, 'edit_offer');

// Navigation: offer_sent → view_proposal
const sentLead = {
  ...createdLead,
  crm: {
    ...createdLead.crm,
    vehicleOffers: {
      'vc-ev3': {
        ...createdLead.crm.vehicleOffers['vc-ev3'],
        status: 'sent',
        boardStatus: BOARD_OFFER_STATUS.OFFER_SENT,
      },
    },
  },
};
const sentCard = buildVehicleOpportunityCards({ lead: sentLead })[0];
const sentModel = buildBoardOfferCardModel(sentCard, sentLead);
assert.equal(sentModel.status, BOARD_OFFER_STATUS.OFFER_SENT);
assert.equal(resolveBoardOfferPrimaryAction(sentCard, sentLead).handlerType, 'view_proposal');
assert.equal(sentModel.primaryAction?.label, 'Kundenlink ansehen');

// Navigation: interested / declined → view_proposal
const interestedLead = {
  ...sentLead,
  crm: {
    ...sentLead.crm,
    customerOfferInteractions: mergeCustomerOfferInteractionPatch(sentLead, 'vc-ev3', {
      interestStatus: 'interested',
    }),
  },
};
const interestedCard = buildVehicleOpportunityCards({ lead: interestedLead })[0];
assert.equal(resolveBoardOfferPrimaryAction(interestedCard, interestedLead).handlerType, 'view_proposal');
assert.equal(resolveBoardOfferPrimaryAction(interestedCard, interestedLead).label, 'Reaktion ansehen');

const declinedLead = {
  ...sentLead,
  crm: {
    ...sentLead.crm,
    customerOfferInteractions: mergeCustomerOfferInteractionPatch(sentLead, 'vc-ev3', {
      interestStatus: 'not_interested',
    }),
  },
};
const declinedCard = buildVehicleOpportunityCards({ lead: declinedLead })[0];
assert.equal(resolveBoardOfferPrimaryAction(declinedCard, declinedLead).handlerType, 'view_proposal');

console.log('boardOfferModel.test.js: alle Tests bestanden');
