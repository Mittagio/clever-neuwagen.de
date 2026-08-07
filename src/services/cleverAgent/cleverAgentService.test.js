/**
 * node src/services/cleverAgent/cleverAgentService.test.js
 */
import assert from 'node:assert/strict';
import { runCleverAgent } from './cleverAgentService.js';
import { executeCleverAgentTool } from './cleverToolExecutor.js';
import { listCleverAgentToolNames } from './cleverToolRegistry.js';
import { buildCleverCustomerContext } from './cleverContextBuilder.js';
import { applyCleverAgentMutations } from './applyCleverAgentMutations.js';
import { executePrepareOffer } from './tools/createOffer.js';

const lead = {
  id: 'lead-agent-1',
  contact: { name: 'Max Mustermann', salutation: 'Herr', firstName: 'Max', lastName: 'Mustermann', email: 'max@test.de' },
  paymentType: 'leasing',
  vehicle: { model: 'EV3', modelKey: 'ev3', label: 'EV3 Air' },
  wish: { termMonths: 48, mileagePerYear: 35000, downPayment: 0, paymentType: 'leasing' },
  desiredRate: 437.26,
  crm: {
    needProfile: { annualKm: 35000, leaseDurationMonths: 48, budget: { paymentType: 'leasing', maxMonthlyRate: 437.26 } },
    vehicleOffers: {},
    vehicleConfigurations: [],
    sellerInsights: [],
  },
};

const names = listCleverAgentToolNames();
assert.ok(names.includes('prepare_offer'));
assert.ok(names.includes('create_offer'));
assert.ok(names.includes('create_message'));
assert.ok(names.includes('remember_customer_information'));
assert.ok(names.includes('summarize_customer'));
assert.ok(names.includes('get_customer_context'));
assert.equal(names.includes('send_email'), false);

const unknown = executeCleverAgentTool('hack_the_planet', {}, { lead });
assert.equal(unknown.ok, false);
assert.equal(unknown.error, 'unknown_tool');

const ctx = buildCleverCustomerContext(lead);
assert.equal(ctx.customer.lastName, 'Mustermann');
assert.equal(ctx.conditions.durationMonths, 48);

// prepare ohne confirm → keine Persistenz
const prepared = executePrepareOffer({
  lead,
  currentOffer: {
    offerId: 'cur',
    modelName: 'EV3 Air',
    modelKey: 'ev3',
    paymentType: 'leasing',
    termMonths: 48,
    mileagePerYear: 35000,
    downPayment: 0,
    monthlyRate: 437.26,
  },
}, {});
assert.equal(prepared.ok, true);
assert.equal(prepared.status, 'prepared');
assert.equal(prepared.confirmationRequired, true);
assert.equal((prepared.mutations || []).length, 0);

// confirm=true → Persist
const created = executePrepareOffer({
  lead,
  currentOffer: prepared.offer,
}, { confirm: true, monthlyRate: 437.26, mileagePerYear: 35000, durationMonths: 48 });
assert.equal(created.ok, true);
assert.equal(created.status, 'created');
assert.ok(created.mutations?.some((m) => m.type === 'apply_lead_patch'));

const applied = applyCleverAgentMutations(lead, created.mutations);
assert.ok((applied.lead.crm?.vehicleConfigurations || []).length >= 1
  || Object.keys(applied.lead.crm?.vehicleOffers || {}).length >= 1);

const listed = executeCleverAgentTool('list_offers', {}, {
  lead: applied.lead,
  currentOffer: created.offer,
});
assert.equal(listed.ok, true);

const agent = await runCleverAgent({
  sellerMessage: 'Angebot erstellen',
  lead,
  currentOffer: {
    modelName: 'EV3 Air',
    modelKey: 'ev3',
    paymentType: 'leasing',
    termMonths: 48,
    mileagePerYear: 35000,
    downPayment: 0,
    monthlyRate: 410,
  },
  forcedTools: [{ name: 'prepare_offer', arguments: { monthlyRate: 410 } }],
  debug: true,
});
assert.equal(agent.ok, true);
assert.equal(agent.agentSource, 'deterministic');
assert.ok(agent.confirmationRequired);
assert.equal((agent.mutations || []).length, 0);

const disabled = await runCleverAgent({
  sellerMessage: 'Hallo',
  lead,
}, { env: { CLEVER_AGENT_ENABLED: 'false' } });
assert.equal(disabled.ok, false);
assert.equal(disabled.fallbackReason, 'feature_disabled');
assert.equal(disabled.agentSource, 'fallback');

console.log('cleverAgentService.test.js: ok');
