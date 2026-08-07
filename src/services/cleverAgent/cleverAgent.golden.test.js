/**
 * Golden Cases – Clever Agent natürliche Verkäuferkommandos
 * node src/services/cleverAgent/cleverAgent.golden.test.js
 */
import assert from 'node:assert/strict';
import { parseMagicOfferIntent } from '../dealer/magicOfferIntentParser.js';
import { resolveSellerEquipmentMentions, resolveSellerColorMention } from './resolveSellerMentions.js';
import { executePrepareOffer } from './tools/createOffer.js';
import { executeRememberCustomerInformation } from './tools/rememberCustomerInformation.js';
import { executeCreateMessage } from './tools/createMessage.js';
import { runCleverAgent } from './cleverAgentService.js';
import { updateAgentWorkingMemory, createEmptyAgentWorkingMemory } from './cleverAgentWorkingMemory.js';
import { routeSellerRequest } from './routeSellerRequest.js';
import { applyCleverAgentMutations } from './applyCleverAgentMutations.js';

const GOLDEN = 'Clever, etstellr mir ein Angebot for Ev2 AIR mit WP in weiß';

const lead = {
  id: 'lead-golden-agent',
  contact: {
    name: 'Max Mustermann',
    salutation: 'Herr',
    firstName: 'Max',
    lastName: 'Mustermann',
    email: 'max@test.de',
  },
  paymentType: 'leasing',
  vehicle: { model: 'EV2', modelKey: 'ev2', label: 'EV2 Air' },
  wish: { termMonths: 48, mileagePerYear: 10000, downPayment: 2000, paymentType: 'leasing' },
  desiredRate: 239,
  crm: {
    needProfile: {
      annualKm: 10000,
      leaseDurationMonths: 48,
      budget: { paymentType: 'leasing', downPayment: 2000, maxMonthlyRate: 239 },
    },
    vehicleOffers: {},
    vehicleConfigurations: [],
    sellerInsights: [],
  },
};

// --- Parser / Grounding ---
const intent = parseMagicOfferIntent(GOLDEN);
assert.equal(intent.vehicleRequest.modelHint, 'ev2');
assert.equal(intent.vehicleRequest.trimHint, 'air');
assert.equal(intent.vehicleRequest.colorHint, 'white');
assert.ok(intent.vehicleRequest.equipmentKeys.includes('heat_pump'));

const color = resolveSellerColorMention(GOLDEN);
assert.equal(color.canonicalValue, 'white');

const equip = resolveSellerEquipmentMentions(GOLDEN, { modelKey: 'ev2', trimId: 'air' });
assert.ok(equip.some((e) => e.key === 'heat_pump' && e.availability === 'package'));
assert.ok(!equip.some((e) => e.availability === 'unavailable'));

// --- Golden prepare_offer: Kontext-Konditionen, keine Rate erfinden, Confirmation ---
const prepared = executePrepareOffer({
  lead,
  sellerMessage: GOLDEN,
  currentOffer: {
    monthlyRate: 239,
    termMonths: 48,
    mileagePerYear: 10000,
    downPayment: 2000,
    paymentType: 'leasing',
    modelName: 'EV2 Air',
    modelKey: 'ev2',
  },
}, { instruction: GOLDEN });

assert.equal(prepared.ok, true, prepared.message);
assert.equal(prepared.status, 'prepared');
assert.equal(prepared.confirmationRequired, true);
assert.equal(prepared.mutations?.length || 0, 0, 'keine Blind-Persistenz');
assert.equal(prepared.offer?.modelKey, 'ev2');
assert.match(prepared.offer?.modelName || '', /EV2/i);
assert.equal(prepared.offer?.mileagePerYear, 10000);
assert.equal(prepared.offer?.termMonths, 48);
assert.equal(prepared.offer?.monthlyRate, 239);
assert.ok(prepared.resolvedEquipment?.some((e) => e.key === 'heat_pump'));
assert.ok(prepared.resolvedColor?.label);
assert.doesNotMatch(prepared.message || '', /erstellt(?!.*vorbereitet)/i);
assert.match(prepared.message || '', /vorbereitet|prüfen/i);

// --- Follow-up: das gleiche mit 15.000 km ---
const follow = executePrepareOffer({
  lead,
  sellerMessage: 'das gleiche mit 15.000 km',
  currentOffer: prepared.offer,
  previousOfferPreparation: prepared.previousOfferPreparation,
  workingMemory: { previousOfferPreparation: prepared.previousOfferPreparation },
}, {
  baseOnCurrentOffer: true,
  mileagePerYear: 15000,
  monthlyRate: 239,
  instruction: 'das gleiche mit 15.000 km',
});
assert.equal(follow.ok, true, follow.message);
assert.equal(follow.offer?.mileagePerYear, 15000);
assert.equal(follow.confirmationRequired, true);

let memory = createEmptyAgentWorkingMemory();
memory = updateAgentWorkingMemory(memory, {
  toolCalls: [{ name: 'prepare_offer' }],
  previousOfferPreparation: prepared.previousOfferPreparation,
  artifacts: [{ type: 'offer_prepare', data: { offer: prepared.offer } }],
  confirmationRequired: true,
  resolvedVehicle: prepared.resolvedVehicle,
  offerSummary: prepared.offer,
}, GOLDEN);
assert.equal(memory.lastIntent, 'prepare_offer');
assert.ok(memory.previousOfferPreparation);

const routeFollow = routeSellerRequest('das gleiche mit 15.000 km', { workingMemory: memory });
assert.equal(routeFollow, 'clever_agent');

// --- Merken ---
const remembered = executeRememberCustomerInformation({ lead }, {
  note: 'merk dir 2 kinder hund blau wäre ihm lieber und ladezeit ist wichtig',
});
assert.equal(remembered.ok, true);
assert.ok(remembered.labels.some((l) => /Kinder/i.test(l)));
assert.ok(remembered.labels.some((l) => /Hund/i.test(l)));
assert.ok(remembered.labels.some((l) => /Blau|blau/i.test(l)));
assert.ok(remembered.labels.some((l) => /Ladezeit|Laden/i.test(l)));
const afterRemember = applyCleverAgentMutations(lead, remembered.mutations);
assert.ok((afterRemember.lead.crm?.sellerInsights || []).length >= 1);

// --- schreib vs schick ---
const draftOnly = executeCreateMessage({ lead, currentOffer: prepared.offer }, {
  instruction: 'schreib ihm dass der wagen im november kommen kann',
});
assert.equal(draftOnly.ok, true);
assert.equal(draftOnly.intendSend, false);
assert.equal(draftOnly.sendable, false);

const sendIntent = executeCreateMessage({ lead, currentOffer: prepared.offer }, {
  instruction: 'schick ihm dass der wagen im november kommen kann',
});
assert.equal(sendIntent.ok, true);
assert.equal(sendIntent.intendSend, true);
assert.equal(sendIntent.confirmationRequired, true);
assert.equal(sendIntent.sendable, false);

// --- Multi forced tools ---
const multi = await runCleverAgent({
  sellerMessage: 'merk dir dass ihm ladezeit wichtig ist und schreib ihm dass ich morgen nach dem EV2 schaue',
  lead,
  forcedTools: [
    { name: 'remember_customer_information', arguments: { note: 'ladezeit wichtig' } },
    { name: 'create_message', arguments: { instruction: 'schreib ihm dass ich morgen nach dem EV2 schaue' } },
  ],
});
assert.equal(multi.ok, true);
assert.ok(multi.toolCalls?.some((t) => t.name === 'remember_customer_information'));
assert.ok(multi.toolCalls?.some((t) => t.name === 'create_message'));
assert.equal(multi.agentSource, 'deterministic');

// --- Voice-ähnlich messy ---
const voice = parseMagicOfferIntent('äh mach mir den EV2 Air äh weiß mit Wärmepumpe und 15 tausend Kilometer');
assert.equal(voice.vehicleRequest.modelHint, 'ev2');
assert.equal(voice.vehicleRequest.trimHint, 'air');
assert.ok(voice.vehicleRequest.equipmentKeys.includes('heat_pump'));
assert.equal(voice.vehicleRequest.colorHint, 'white');

console.log('cleverAgent.golden.test.js: ok');
