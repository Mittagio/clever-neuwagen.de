/**
 * Navigation: Auf dem Tisch → Angebotsvorschlag → Bearbeitung
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const followUp = readFileSync(join(__dirname, 'DealerAiLeadFollowUp.jsx'), 'utf8');
const dealerAiPage = readFileSync(join(__dirname, '../../pages/DealerAIPage.jsx'), 'utf8');
const backendAkte = readFileSync(join(__dirname, '../../pages/backend/BackendLeadAktePage.jsx'), 'utf8');

assert.ok(followUp.includes('onOpenOfferProposal'), 'FollowUp kennt onOpenOfferProposal');
assert.ok(followUp.includes('onOpenOfferProposal(card)'), 'Kartenklick öffnet Vorschlag');
assert.ok(dealerAiPage.includes("phase === 'offer-proposal'"), 'DealerAIPage hat offer-proposal Phase');
assert.ok(dealerAiPage.includes('CustomerOfferProposalView'), 'DealerAIPage rendert Vorschlagsansicht');
assert.ok(dealerAiPage.includes('handleOpenOfferEdit(card, { fromProposal: true })'), 'Bearbeitung aus Vorschlag');
assert.ok(backendAkte.includes('onOpenOfferProposal={handleOpenOfferProposal}'), 'Backend-Akte nutzt Vorschlag');

const editView = readFileSync(join(__dirname, 'CustomerOfferEditView.jsx'), 'utf8');
assert.ok(editView.includes('title="Angebot bearbeiten"'), 'Bearbeitungsansicht benannt');

console.log('CustomerOfferProposalNavigation.test.js: ok');
