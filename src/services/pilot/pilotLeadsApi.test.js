/**
 * node src/services/pilot/pilotLeadsApi.test.js
 */
import assert from 'node:assert/strict';
import {
  isPersistablePilotLead,
  isPilotLeadsSyncEnabled,
} from './pilotLeadsApi.js';
import { PILOT_LEAD_ID } from '../../data/demoLeads.js';

assert.equal(isPilotLeadsSyncEnabled(), true, 'Server-Sync nicht an PILOT_LIVE gebunden');
assert.equal(isPersistablePilotLead({ id: PILOT_LEAD_ID }), false);
assert.equal(isPersistablePilotLead({ id: 'lead-share-abc123' }), true);
assert.equal(isPersistablePilotLead({ id: 'lead-demo-1' }), false);

console.log('pilotLeadsApi.test.js: ok');
