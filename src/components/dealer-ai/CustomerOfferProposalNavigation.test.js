/**
 * Navigation: Auf dem Tisch – statusabhängige Zielansicht
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const followUp = readFileSync(join(__dirname, 'DealerAiLeadFollowUp.jsx'), 'utf8');
const vehicleCard = readFileSync(join(__dirname, 'CustomerAkteVehicleCard.jsx'), 'utf8');
const dealerAiPage = readFileSync(join(__dirname, '../../pages/DealerAIPage.jsx'), 'utf8');
const backendAkte = readFileSync(join(__dirname, '../../pages/backend/BackendLeadAktePage.jsx'), 'utf8');
const conditionsStep = readFileSync(join(__dirname, 'DealerAiConditionsStep.jsx'), 'utf8');

assert.ok(followUp.includes('onOpenOfferProposal'), 'FollowUp kennt onOpenOfferProposal');
assert.ok(followUp.includes('navigateBoardOfferCard'), 'Kartenklick nutzt statusabhängige Navigation');
assert.ok(followUp.includes('resolveBoardOfferPrimaryAction'), 'FollowUp löst Primäraktion auf');
assert.ok(followUp.includes("handler === 'view_proposal'"), 'Vorschlag nur bei view_proposal');
assert.ok(followUp.includes('onOpenOfferEdit(card)'), 'Entwurf/erstellt öffnet Editor');
assert.ok(followUp.includes('startProposalNavigateFlow'), '+ Angebot erstellen startet Rechner');
assert.ok(vehicleCard.includes('handleCardClick'), 'Karte löst Primäraktion beim Klick aus');
assert.ok(vehicleCard.includes('budgetHint'), 'Entwurf zeigt Budget-Hinweis');
assert.ok(dealerAiPage.includes("phase === 'offer-proposal'"), 'DealerAIPage hat offer-proposal Phase');
assert.ok(dealerAiPage.includes('CustomerOfferProposalView'), 'DealerAIPage rendert Vorschlagsansicht');
assert.ok(dealerAiPage.includes('handleConditionsSave'), 'Direktes Speichern aus Konditionen');
assert.ok(dealerAiPage.includes('openProposalConditionsFlow'), 'Bearbeiten öffnet Konditionen');
assert.ok(backendAkte.includes('openOfferCalculator'), 'Backend-Akte nutzt zentralen Kalkulator');
assert.ok(followUp.includes('shouldOpenOfferProposalView'), 'Clever-Aktionen statusabhängig');
assert.ok(conditionsStep.includes('buildConditionsFooterAction'));

const editView = readFileSync(join(__dirname, 'CustomerOfferEditView.jsx'), 'utf8');
assert.ok(editView.includes('title="Angebot bearbeiten"'), 'Bearbeitungsansicht benannt');

console.log('CustomerOfferProposalNavigation.test.js: ok');
