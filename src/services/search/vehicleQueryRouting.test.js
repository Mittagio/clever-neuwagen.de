import assert from 'node:assert/strict';
import { analyzeVehicleQuery } from './vehicleQueryIntent.js';
import { resolveQueryRoutingLayer } from './vehicleQueryRouting.js';

const battery = analyzeVehicleQuery('Wie groß ist die Batterie vom EV9?');
assert.equal(resolveQueryRoutingLayer(battery), 'structured_fact');

const search = analyzeVehicleQuery('Elektro SUV bis 400 Euro');
assert.equal(resolveQueryRoutingLayer(search), 'vehicle_search');

const stroller = analyzeVehicleQuery('Passt Kinderwagen in EV4?');
assert.equal(resolveQueryRoutingLayer(stroller), 'structured_estimate');

console.log('vehicleQueryRouting.test.js: ok');
