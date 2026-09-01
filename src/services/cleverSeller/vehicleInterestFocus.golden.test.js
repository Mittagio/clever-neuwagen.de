/**
 * Freitext EV4 bei bestehendem EV3-Track → aktiver Track + Modell EV4.
 */
import assert from 'node:assert/strict';
import { interpretSellerInput } from './interpretSellerInput.js';
import { applyStructuredFactsToLead } from './applyAcceptedSellerTurn.js';
import { buildVehicleOpportunityCards } from '../customerAkte.js';
import {
  ensureVehicleTrack,
  focusVehicleInterestOnLead,
  listCustomerVehicleTracks,
  VEHICLE_TRACK_STATUS,
} from '../crm/vehicleTrack.js';
import { getNeedProfileFromLead } from '../consultation/needProfileService.js';

function leadWithEv3() {
  let lead = {
    id: 'lead-koenig',
    name: 'Cederic König',
    contact: { name: 'Cederic König', kind: 'private' },
    vehicle: { brand: 'Kia', model: 'EV3', modelKey: 'ev3', label: 'Kia EV3' },
    crm: {
      needProfile: { selectedModelKey: 'ev3', modelHint: 'ev3' },
      vehicleConfigurations: [],
      vehicleOffers: {},
    },
  };
  const ensured = ensureVehicleTrack(lead, {
    vehicleKey: 'kia-ev3',
    displayName: 'Kia EV3',
    model: 'EV3',
    modelKey: 'ev3',
  });
  lead = ensured.lead;
  lead = {
    ...lead,
    crm: {
      ...lead.crm,
      vehicleConfigurations: (lead.crm.vehicleConfigurations || []).map((c) => (
        c.id === ensured.trackId
          ? {
            ...c,
            vehicleTrack: {
              ...(c.vehicleTrack || {}),
              status: VEHICLE_TRACK_STATUS.ACTIVE,
            },
          }
          : c
      )),
    },
  };
  return lead;
}

{
  const interpreted = interpretSellerInput('EV4');
  const fact = interpreted.facts.find((f) => f.field === 'vehicleInterest');
  assert.ok(fact, 'EV4 erkannt');
  assert.equal(fact.needsConfirmation, false);
  assert.equal(fact.value?.modelKey, 'ev4');

  const before = leadWithEv3();
  const after = applyStructuredFactsToLead(before, [fact]);
  const profile = getNeedProfileFromLead(after);
  assert.equal(profile.selectedModelKey, 'ev4', 'Need-Profile folgt EV4');
  assert.match(String(after.vehicle?.model || ''), /EV4/i, 'lead.vehicle → EV4');

  const tracks = listCustomerVehicleTracks(after);
  const ev4 = tracks.find((t) => /ev4/i.test(t.modelLabel) || /ev4/i.test(t.vehicleKey));
  const ev3 = tracks.find((t) => /ev3/i.test(t.modelLabel) || /ev3/i.test(t.vehicleKey));
  assert.ok(ev4, 'EV4-Spur vorhanden');
  assert.equal(ev4.status, VEHICLE_TRACK_STATUS.ACTIVE, 'EV4 aktiv');
  assert.equal(after.crm?.focusedVehicleTrackId, ev4.id, 'focusedVehicleTrackId = EV4');
  assert.ok(ev3, 'EV3 bleibt erhalten');
  assert.equal(ev3.status, VEHICLE_TRACK_STATUS.OPEN, 'EV3 demoted');

  const cards = buildVehicleOpportunityCards({ lead: after });
  assert.match(String(cards[0]?.modelName || cards[0]?.modelKey || ''), /EV4/i, 'Primary Card = EV4');
  console.log('✓ Freitext EV4 wechselt aktiven Track von EV3');
}

{
  const focused = focusVehicleInterestOnLead(leadWithEv3(), {
    modelKey: 'ev4',
    model: 'EV4',
    label: 'Kia EV4',
  });
  assert.match(String(focused.lead.vehicle?.label || ''), /EV4/i);
  assert.ok(focused.trackId);
  console.log('✓ focusVehicleInterestOnLead EV4');
}

console.log('vehicleInterestFocus.golden ok');
