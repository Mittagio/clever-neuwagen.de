import assert from 'node:assert/strict';
import { buildDealerSmartAnswer } from './dealerSmartAnswerService.js';
import { analyzeVehicleQuery } from '../search/vehicleQueryIntent.js';
const analysis = analyzeVehicleQuery('Passt ein Kinderwagen in den EV9?');
assert.ok(analysis.estimate);
assert.equal(analysis.estimate.modelKey, 'ev9');

const answer = buildDealerSmartAnswer('Passt ein Kinderwagen in den EV9?', []);
assert.ok(answer);
assert.equal(answer.estimate, true);
assert.equal(answer.routingLayer, 'structured_estimate');
assert.ok(answer.lead?.includes('Schätzung') || answer.narrative?.some((n) => n.includes('Liter')));

console.log('vehicleEstimateAnswerService.test.js: ok');
