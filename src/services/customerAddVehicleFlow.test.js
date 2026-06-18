/**
 * Tests: Flow „Auto hinzufügen“ aus Kundenakte
 */
import assert from 'node:assert/strict';
import {
  ADD_VEHICLE_SOURCE,
  appendVehicleConfigurationsToLead,
  buildAddVehicleContextFromLead,
  buildVehicleConfiguration,
  buildVehicleConfigurationsFromSelection,
  executeAddVehicleToCustomerRecord,
  findDuplicateInSelection,
  findDuplicateVehicleConfiguration,
  getContextBannerLabel,
  getReviewBarButtonLabel,
  getSuccessMessage,
  isCustomerRecordAddVehicleContext,
  vehicleConfigurationSignature,
} from './customerAddVehicleFlow.js';

const sampleLead = {
  id: 'lead-1',
  customerId: 'cust-1',
  contact: { name: 'Max Mustermann', phone: '0170', email: 'max@test.de' },
  crm: {
    reservedModels: [
      { id: 'ev3', name: 'EV3', modelKey: 'ev3', trimLabel: 'Earth' },
    ],
    vehicleConfigurations: [],
  },
};

const ctxFromLead = buildAddVehicleContextFromLead(sampleLead);
assert.ok(isCustomerRecordAddVehicleContext(ctxFromLead));
assert.equal(ctxFromLead.source, ADD_VEHICLE_SOURCE);
assert.equal(ctxFromLead.customerId, 'cust-1');
assert.equal(ctxFromLead.opportunityId, 'lead-1');
assert.equal(getReviewBarButtonLabel(ctxFromLead), 'Auto zur Kundenakte hinzufügen');
assert.equal(getReviewBarButtonLabel(null), 'Verkaufschance erstellen');
assert.equal(getContextBannerLabel(ctxFromLead), 'Für: Max Mustermann');

const parsed = {
  ok: true,
  shortForm: 'Kia Sportage Plug-in',
  suggestedModels: [
    { id: 'sportage-phev', name: 'Sportage Plug-in', modelKey: 'sportage-phev', primaryMatch: { vehicle: { brand: 'Kia', model: 'Sportage Plug-in', trim: 'Vision', trimId: 'vision' } } },
  ],
};

const fields = {
  brand: 'Kia',
  model: 'Sportage Plug-in',
  modelId: 'sportage-phev',
  trimId: 'vision',
  trimLabel: 'Vision',
  paymentType: 'leasing',
  termMonths: 48,
  mileagePerYear: 15000,
  desiredRate: 399,
  packageIds: ['premium'],
};

const config = buildVehicleConfiguration(fields, parsed, parsed.suggestedModels[0], ctxFromLead);
assert.equal(config.type, 'vehicle_configuration');
assert.equal(config.customerId, 'cust-1');
assert.equal(config.opportunityId, 'lead-1');
assert.equal(config.createdFrom, 'add_vehicle_from_customer_record');
assert.deepEqual(config.selectedPackages, ['premium']);

const configs = buildVehicleConfigurationsFromSelection(fields, parsed, ['sportage-phev'], ctxFromLead);
assert.equal(configs.length, 1);
assert.equal(configs[0].modelKey, 'sportage-phev');

const existingConfig = { ...config, id: 'vc-existing' };
assert.ok(findDuplicateVehicleConfiguration([existingConfig], configs[0]));
assert.ok(findDuplicateInSelection([existingConfig], configs));

let updatedLead = null;
const attachResult = executeAddVehicleToCustomerRecord(fields, parsed, {
  leads: [sampleLead],
  updateLead: (id, patch) => { updatedLead = { ...sampleLead, ...patch, id }; },
  addLead: () => { throw new Error('addLead darf nicht aufgerufen werden'); },
  conditions: { dealerId: 'autohaus-trinkle' },
  selectedModelIds: ['sportage-phev'],
  addVehicleContext: ctxFromLead,
  carryCustomer: { customerId: 'cust-1', contact: sampleLead.contact },
});
assert.equal(attachResult.type, 'vehicle_added');
assert.equal(attachResult.mode, 'attached_to_opportunity');
assert.equal(attachResult.message, 'Fahrzeug wurde zur bestehenden Verkaufschance hinzugefügt.');
assert.equal(attachResult.leadId, 'lead-1');
assert.ok(updatedLead);
assert.equal(updatedLead.crm.vehicleConfigurations.length, 1);
assert.equal(updatedLead.crm.reservedModels.length, 2);
assert.equal(getSuccessMessage(ctxFromLead, 'attached_to_opportunity'), attachResult.message);

const dupResult = executeAddVehicleToCustomerRecord(fields, parsed, {
  leads: [updatedLead],
  updateLead: () => {},
  addLead: () => { throw new Error('addLead darf nicht aufgerufen werden'); },
  conditions: {},
  selectedModelIds: ['sportage-phev'],
  addVehicleContext: ctxFromLead,
});
assert.equal(dupResult.type, 'duplicate');
assert.ok(dupResult.duplicate);

let newLeadAdded = null;
const ctxCustomerOnly = {
  source: ADD_VEHICLE_SOURCE,
  customerId: 'cust-1',
  opportunityId: null,
  customerName: 'Max Mustermann',
  returnPath: '/backend/kundenakte/lead-new',
};
const newOppResult = executeAddVehicleToCustomerRecord(fields, parsed, {
  leads: [],
  updateLead: () => {},
  addLead: (lead) => { newLeadAdded = lead; },
  conditions: { dealerId: 'autohaus-trinkle' },
  getExistingCodes: () => [],
  selectedModelIds: ['sportage-phev'],
  addVehicleContext: ctxCustomerOnly,
  carryCustomer: { customerId: 'cust-1', contact: sampleLead.contact },
});
assert.equal(newOppResult.type, 'vehicle_added');
assert.equal(newOppResult.mode, 'new_opportunity_for_customer');
assert.equal(newOppResult.message, 'Neue Verkaufschance für bestehenden Kunden erstellt.');
assert.ok(newLeadAdded);
assert.equal(newLeadAdded.customerId, 'cust-1');
assert.equal(newLeadAdded.crm.vehicleConfigurations.length, 1);

assert.notEqual(vehicleConfigurationSignature(config), vehicleConfigurationSignature({
  ...config,
  modelKey: 'ev3',
}));

const multiLead = {
  ...sampleLead,
  crm: {
    vehicleConfigurations: [existingConfig],
    reservedModels: sampleLead.crm.reservedModels,
  },
};
const patch = appendVehicleConfigurationsToLead(multiLead, [config], parsed, ['sportage-phev']);
assert.equal(patch.crm.vehicleConfigurations.length, 2);
assert.equal(patch.crm.reservedModels.length, 2);

assert.equal(isCustomerRecordAddVehicleContext(null), false);
assert.equal(isCustomerRecordAddVehicleContext({ source: 'other', customerId: 'x' }), false);

// Mehrere Fahrzeuge pro Kunde
const multiConfigs = buildVehicleConfigurationsFromSelection(fields, parsed, ['sportage-phev'], ctxFromLead);
const ev3Fields = { ...fields, modelId: 'ev3', model: 'EV3', trimId: 'earth', trimLabel: 'Earth', packageIds: [] };
const ev3Parsed = {
  ...parsed,
  suggestedModels: [
    { id: 'ev3', name: 'EV3', modelKey: 'ev3', primaryMatch: { vehicle: { brand: 'Kia', model: 'EV3', trim: 'Earth', trimId: 'earth' } } },
  ],
};
const ev3Config = buildVehicleConfiguration(ev3Fields, ev3Parsed, ev3Parsed.suggestedModels[0], ctxFromLead);
let multiUpdated = sampleLead;
const multiPatch = appendVehicleConfigurationsToLead(multiUpdated, [config, ev3Config], parsed, ['sportage-phev']);
multiUpdated = { ...sampleLead, ...multiPatch };
assert.equal(multiUpdated.crm.vehicleConfigurations.length, 2);
assert.equal(multiUpdated.crm.reservedModels.length, 3);

// Start ohne customerId → kein Kundenkontext
assert.equal(isCustomerRecordAddVehicleContext({ customerId: null, source: ADD_VEHICLE_SOURCE }), false);

// Rücksprung-Pfad zur Kundenakte
assert.ok(attachResult.returnPath.includes('/backend/kundenakte/lead-1'));

console.log('customerAddVehicleFlow.test.js: ok');
