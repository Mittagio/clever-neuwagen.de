/**
 * Golden 18–20: Concept-Draft → berechnetes VehicleOffer → Portal-Versand → Öffnen → Change Request
 *
 * Kein neuer Portal-Stack. Echte Rate ist Send-Gate (Fixture, nicht Interpreter).
 *
 * node --test src/services/cleverSeller/conceptToPortalSend.golden.test.js
 */
import assert from 'node:assert/strict';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import {
  getOfferDraftById,
  buildHandoffFromOfferDraftId,
} from './cleverWorkingDraft.js';
import { magicPreparationToConfigurePatch } from '../dealer/magicOfferService.js';
import {
  buildOfferDraft,
  offerDraftToVehicleConfiguration,
  offerDraftToVehicleCard,
  finalizeLeadWithOfferDraft,
} from '../dealerAiOfferCreate.js';
import { buildConfigureDraft } from '../dealerAiVehicleConfigureFlow.js';
import { isBoardOfferSendable, countSendableBoardItems } from '../dealer/boardOfferModel.js';
import { buildVehicleOpportunityCards } from '../customerAkte.js';
import {
  prepareCustomerOfferPortfolio,
  markPortfolioSent,
  applyPortfolioEvent,
  PORTFOLIO_EVENTS,
  PORTFOLIO_STATUS,
  PORTFOLIO_REACTION_STATUS,
  PORTFOLIO_CHANGE_DIMENSIONS,
} from '../crm/customerOfferPortfolioService.js';
import {
  prepareCustomerPortalAccess,
  markCustomerPortalAccessSent,
  recordCustomerPortalAccessOpened,
  verifyCustomerPortalAccessCode,
  recordCustomerPortalAccessViewed,
  getCustomerPortalAccess,
  PORTAL_ACCESS_STATUS,
  buildCustomerPortalStatusCardModel,
} from '../crm/customerPortalAccessService.js';
import {
  resolveSourceOfferDraftId,
  getVehicleOffer,
  VEHICLE_OFFER_STATUS,
} from '../vehicleOffer.js';
import {
  __clearInboxTestMode,
  __resetInboxStoreForTests,
  INBOX_EVENT_TYPES,
} from '../crm/cleverInboxService.js';
import {
  buildInboxActionAkteUrl,
  resolveInboxReplyIntent,
} from '../crm/cleverInboxQuestionRoute.js';
import { buildComposerReplySeed } from '../crm/composerReplySeed.js';

const MAIL = `Ich interessiere mich für ein Privatleasing eines Kia EV4 Air in der Farbe Wolfsgrau Metallic, inklusive Winter-Paket P1 mit Wärmepumpe, Sitzheizung vorn und Lenkradheizung.

Meine Wunschkonditionen sind 36 Monate und 15.000 Kilometer pro Jahr. Ich plane mit einer Sonderzahlung in Höhe von 4.500 Euro und bitte um Ausweis der Konditionen auf dieser Basis, vorbehaltlich einer möglichen Förderung.

Bitte teilen Sie mir außerdem die Überführungskosten und alle weiteren Einmalkosten mit.

Falls möglich, würde ich das Fahrzeug gern direkt mit Winterreifen statt Sommerreifen übernehmen oder alternativ ein Angebot für einen passenden Winterradsatz erhalten.`;

/** Fixture-Rate aus Angebotsrechner – bewusst NICHT vom Interpreter. */
const CALCULATED_RATE_FIXTURE = 419;

function baseLead() {
  return {
    id: 'lead-g18-portal',
    name: 'Herr Müller',
    contact: {
      name: 'Herr Müller',
      email: 'mueller@example.de',
    },
    crm: {
      needProfile: createEmptyNeedProfile(),
      vehicleConfigurations: [],
      vehicleOffers: {},
      sellerInsights: [],
      reservedModels: [],
    },
    history: [],
  };
}

function runConceptCapture(lead0 = baseLead()) {
  const turn = runCleverSellerTurn({ lead: lead0, sellerInput: MAIL });
  const prepared = (turn.preparedActions || []).find((a) => (
    a.type === 'prepare_offer' && a.status === 'prepared' && a.payload?.offerDraftId
  ));
  assert.ok(prepared, 'Concept PREPARE_OFFER');
  const applied = applyAcceptedSellerTurn(lead0, {
    ...turn,
    extractedFacts: [...(turn.extractedFacts || [])].reverse(),
    sellerInput: MAIL,
  }, { postFeedCard: false });
  assert.equal(applied.ok, true);
  const offerDraftId = prepared.payload.offerDraftId;
  assert.equal(applied.lead.crm?.cleverWorkingState?.currentOfferDraftId, offerDraftId);
  const concept = getOfferDraftById(applied.lead, offerDraftId);
  assert.ok(concept);
  assert.equal(concept.rate ?? concept.monthlyRate ?? null, null);
  return { lead: applied.lead, offerDraftId, concept, turn };
}

__resetInboxStoreForTests([]);

{
  // --- Golden 18: Concept → Handoff → echte Rate → VehicleOffer → Portfolio → prepared/sent ---
  const { lead: afterCapture, offerDraftId } = runConceptCapture();

  // Concept allein: nicht sendbar
  const cardsBefore = buildVehicleOpportunityCards({
    lead: afterCapture,
    configurations: afterCapture.crm?.vehicleConfigurations || [],
    reservedModels: afterCapture.crm?.reservedModels || [],
  }) || [];
  assert.equal(
    countSendableBoardItems(cardsBefore, afterCapture),
    0,
    'Concept ohne Rate: nicht sendbar',
  );
  const noPortfolio = prepareCustomerOfferPortfolio({
    lead: afterCapture,
    vehicleCards: cardsBefore,
  });
  assert.equal(noPortfolio.ok, false, 'kein Portfolio ohne berechnetes Offer');

  // Schritt 1: Handoff hydriert denselben Concept-Draft
  const handoff = buildHandoffFromOfferDraftId(afterCapture, offerDraftId);
  assert.equal(handoff.ok, true);
  assert.equal(handoff.magic?.offerDraftId, offerDraftId);
  const patch = magicPreparationToConfigurePatch(handoff.magic);
  assert.equal(patch.offerDraftId, offerDraftId);
  assert.equal(patch.desiredRate ?? null, null);
  assert.equal(patch.modelKey, 'ev4');
  assert.equal(patch.termMonths, 36);
  assert.equal(patch.mileagePerYear, 15000);
  assert.equal(patch.downPayment, 4500);

  // Schritt 2: Angebotsrechner liefert echte Rate (Fixture)
  const configureDraft = {
    ...buildConfigureDraft({ fields: {} }, {}),
    ...patch,
    modelKey: 'ev4',
    model: 'EV4',
    brand: 'Kia',
    trimLabel: patch.trimLabel || 'Air',
    paymentType: 'leasing',
    termMonths: 36,
    mileagePerYear: 15000,
    downPayment: 4500,
    desiredRate: null,
    offerDraftId,
    vehicleIdentityDraftId: handoff.magic?.vehicleIdentityDraftId || null,
    vehicleIdentityDraft: handoff.magic?.vehicleIdentityDraft || null,
    packageLabels: patch.packageLabels || [],
  };

  let calcOfferDraft = buildOfferDraft({
    configureDraft,
    parsed: { fields: {}, rawInput: MAIL },
    conditions: {},
    lead: afterCapture,
  });
  assert.equal(resolveSourceOfferDraftId(calcOfferDraft), offerDraftId);
  // Echte Rate nur als Rechner-Ergebnis – nicht vom Capture
  calcOfferDraft = {
    ...calcOfferDraft,
    payment: {
      ...calcOfferDraft.payment,
      calculatedRate: CALCULATED_RATE_FIXTURE,
      budget: CALCULATED_RATE_FIXTURE,
    },
    offerPreview: {
      ...calcOfferDraft.offerPreview,
      monthlyRate: CALCULATED_RATE_FIXTURE,
    },
    offerDraftId,
    source: {
      ...calcOfferDraft.source,
      offerDraftId,
      createdFrom: 'dealer_ai_calculator',
    },
    meta: {
      ...(calcOfferDraft.meta || {}),
      offerDraftId,
    },
  };

  const cardId = 'vc-ev4-g18';
  const config = offerDraftToVehicleConfiguration(calcOfferDraft, cardId);
  const card = offerDraftToVehicleCard(calcOfferDraft, { configId: cardId });
  const finalized = finalizeLeadWithOfferDraft(afterCapture, calcOfferDraft, {
    config,
    card,
    enrichedParsed: { fields: {} },
    selectedModelIds: ['ev4'],
  });
  // finalizeLeadWithOfferDraft baut den Lead-Patch ohne id – Herkunft + Kontakt erhalten
  let lead = {
    ...afterCapture,
    ...finalized,
    id: afterCapture.id,
    contact: {
      ...(afterCapture.contact || {}),
      ...(finalized.contact || {}),
      name: afterCapture.contact?.name || finalized.contact?.name,
      email: afterCapture.contact?.email || finalized.contact?.email,
    },
    crm: {
      ...(afterCapture.crm || {}),
      ...(finalized.crm || {}),
      cleverWorkingState: afterCapture.crm?.cleverWorkingState,
    },
  };

  const vehicleOffer = getVehicleOffer(lead, { id: cardId });
  assert.ok(vehicleOffer, 'VehicleOffer nach Calculator');
  assert.equal(vehicleOffer.monthlyRate, CALCULATED_RATE_FIXTURE);
  assert.equal(resolveSourceOfferDraftId(vehicleOffer), offerDraftId);
  assert.equal(vehicleOffer.source?.offerDraftId, offerDraftId);
  assert.equal(vehicleOffer.termMonths, 36);
  assert.equal(vehicleOffer.mileagePerYear, 15000);
  assert.equal(vehicleOffer.downPayment, 4500);
  assert.ok(
    vehicleOffer.status === VEHICLE_OFFER_STATUS.PREPARED
    || Number.isFinite(Number(vehicleOffer.monthlyRate)),
  );

  const cards = buildVehicleOpportunityCards({
    lead,
    configurations: lead.crm?.vehicleConfigurations || [],
    reservedModels: lead.crm?.reservedModels || [],
  }) || [];
  const sendableCard = cards.find((c) => c.id === cardId || c.configurationId === cardId) || cards[0];
  assert.ok(sendableCard, 'Fahrzeugkarte vorhanden');
  assert.equal(isBoardOfferSendable(sendableCard, lead), true, 'VehicleOffer sendable');

  // Schritt 3: bestehender Versandpfad
  const preparedPf = prepareCustomerOfferPortfolio({
    lead,
    offerSelectionGroups: lead.crm?.offerSelectionGroups || [],
    vehicleCards: cards,
    origin: 'https://kia-angebote.de',
  });
  assert.equal(preparedPf.ok, true);
  assert.equal(preparedPf.portfolio.status, PORTFOLIO_STATUS.PREPARED);
  const pfItem = preparedPf.portfolio.items.find((i) => i.vehicleCardId === cardId)
    || preparedPf.portfolio.items[0];
  assert.ok(pfItem);
  assert.equal(resolveSourceOfferDraftId(pfItem), offerDraftId, 'Portfolio trägt Concept-Herkunft');

  const portalPrep = prepareCustomerPortalAccess(lead, {
    portfolioUrl: preparedPf.portfolio.url,
    email: lead.contact.email,
    accessToken: preparedPf.portfolio.token,
  });
  assert.equal(portalPrep.ok, true);
  assert.equal(portalPrep.access.status, PORTAL_ACCESS_STATUS.PREPARED);

  lead = {
    ...portalPrep.lead,
    crm: {
      ...portalPrep.lead.crm,
      customerOfferPortfolio: preparedPf.portfolio,
      customerPortalAccess: portalPrep.access,
    },
  };

  const sentPortfolio = markPortfolioSent(preparedPf.portfolio);
  const sentAccess = markCustomerPortalAccessSent(lead, { via: 'email' });
  lead = {
    ...sentAccess.lead,
    crm: {
      ...sentAccess.lead.crm,
      customerOfferPortfolio: sentPortfolio,
      customerPortalAccess: sentAccess.access,
    },
  };
  assert.equal(getCustomerPortalAccess(lead).status, PORTAL_ACCESS_STATUS.SENT);
  assert.equal(lead.crm.customerOfferPortfolio.status, PORTFOLIO_STATUS.SENT);
  assert.match(String(lead.crm.customerOfferPortfolio.url || ''), /leadId=lead-g18-portal/);
  assert.equal(resolveSourceOfferDraftId(getVehicleOffer(lead, { id: cardId })), offerDraftId);

  console.log('✓ Golden 18 – Concept→Rate→VehicleOffer→Portal-Send');

  // --- Golden 19: opened → code_verified → viewed (bestehender Access-Flow) ---
  const opened = recordCustomerPortalAccessOpened(lead);
  lead = opened.lead;
  assert.equal(getCustomerPortalAccess(lead).status, PORTAL_ACCESS_STATUS.OPENED);

  const code = getCustomerPortalAccess(lead).accessCode;
  const verified = verifyCustomerPortalAccessCode(lead, code);
  assert.equal(verified.ok, true);
  lead = verified.lead;
  assert.equal(getCustomerPortalAccess(lead).status, PORTAL_ACCESS_STATUS.CODE_VERIFIED);

  const viewed = recordCustomerPortalAccessViewed(lead);
  lead = viewed.lead;
  assert.equal(getCustomerPortalAccess(lead).status, PORTAL_ACCESS_STATUS.VIEWED);

  const statusCard = buildCustomerPortalStatusCardModel(lead);
  assert.equal(statusCard.visible, true);
  assert.ok(statusCard.steps.some((s) => s.id === PORTAL_ACCESS_STATUS.VIEWED && s.reached));

  // Portfolio-OPENED hält VehicleOffer-Tracking konsistent
  const pfOpen = applyPortfolioEvent(lead, '', PORTFOLIO_EVENTS.OPENED, {
    token: lead.crm.customerOfferPortfolio.token,
  });
  assert.equal(pfOpen.ok, true);
  lead = pfOpen.lead;
  assert.equal(lead.crm.customerOfferPortfolio.status, PORTFOLIO_STATUS.OPENED);

  console.log('✓ Golden 19 – Portal opened→code_verified→viewed');

  // --- Golden 20: Change Request 20.000 km ohne stilles Überschreiben ---
  const itemId = lead.crm.customerOfferPortfolio.items[0].id;
  const beforeMileage = getVehicleOffer(lead, { id: cardId })?.mileagePerYear;
  assert.equal(beforeMileage, 15000);

  const change = applyPortfolioEvent(
    lead,
    itemId,
    PORTFOLIO_EVENTS.OFFER_CHANGE_REQUEST,
    {
      token: lead.crm.customerOfferPortfolio.token,
      questionText: 'Gefällt mir, aber bitte mit 20.000 km.',
      changeDimension: 'mileage',
    },
  );
  assert.equal(change.ok, true);
  lead = change.lead;

  const reacted = lead.crm.customerOfferPortfolio.items.find((i) => i.id === itemId);
  assert.equal(reacted.customerReaction?.status, PORTFOLIO_REACTION_STATUS.CHANGE_REQUESTED);
  assert.equal(reacted.customerReaction?.changeDimension, 'mileage');
  assert.match(String(reacted.customerReaction?.questionText || ''), /20\.?000/);
  assert.equal(resolveSourceOfferDraftId(reacted), offerDraftId);

  // Gesendetes Angebot nicht still überschreiben
  assert.equal(getVehicleOffer(lead, { id: cardId })?.mileagePerYear, 15000);
  assert.equal(getVehicleOffer(lead, { id: cardId })?.monthlyRate, CALCULATED_RATE_FIXTURE);

  assert.equal(change.inboxItem?.type, INBOX_EVENT_TYPES.OFFER_CHANGE_REQUEST);
  assert.equal(change.inboxItem?.metadata?.changeDimension, 'mileage');
  assert.equal(change.inboxItem?.metadata?.offerDraftId, offerDraftId);
  assert.equal(resolveInboxReplyIntent(change.inboxItem), 'offer_change_request');

  const seed = buildComposerReplySeed('offer_change_request', {
    question: change.inboxItem.metadata.questionText,
    vehicleLabel: change.inboxItem.vehicleLabel,
  });
  assert.match(seed, /^Passe .+ an:/i);
  assert.match(seed, /20\.?000/);

  const changeUrl = buildInboxActionAkteUrl(lead.id, change.inboxItem);
  assert.match(changeUrl, /intentId=offer_change_request/);

  assert.ok(PORTFOLIO_CHANGE_DIMENSIONS.mileage);

  console.log('✓ Golden 20 – Change Request 20.000 km ohne Offer-Overwrite');
}

__clearInboxTestMode();
console.log('conceptToPortalSend.golden.test.js: ok');
