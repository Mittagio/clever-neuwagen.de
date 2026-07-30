/**
 * node src/services/cleverSeller/toolRegistry.test.js
 */
import assert from 'node:assert/strict';
import {
  CLEVER_SELLER_TOOLS,
  getSellerTool,
  listSellerTools,
  runTool,
} from './toolRegistry.js';

assert.ok(getSellerTool('prepare_offer'));
assert.ok(getSellerTool('search_customer_history'));
assert.ok(getSellerTool('propose_appointment'));
assert.ok(listSellerTools().length >= 10);
assert.equal(CLEVER_SELLER_TOOLS.prepare_offer.needsSellerConfirmation, true);
assert.equal(CLEVER_SELLER_TOOLS.search_customer_history.needsSellerConfirmation, false);

const missing = runTool('prepare_offer', {});
assert.equal(missing.ok, false);
assert.match(missing.error, /missing_input/);

const unknown = runTool('nope', { lead: {} });
assert.equal(unknown.ok, false);

const tracks = runTool('list_vehicle_tracks', { lead: { id: 'x', crm: { vehicleConfigurations: [] } } });
assert.equal(tracks.ok, true);
assert.ok(Array.isArray(tracks.result));

console.log('toolRegistry.test.js: ok');
