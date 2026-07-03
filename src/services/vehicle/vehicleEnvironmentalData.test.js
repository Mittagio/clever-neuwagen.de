import assert from 'node:assert/strict';
import { COMPLIANCE_STATUS } from '../../data/complianceSchema.js';
import {
  isOpenAiEnvironmentalSource,
  isTrustedEnvironmentalSource,
  resolveVehicleEnvironmentalData,
  ENV_CONFIDENCE,
} from './vehicleEnvironmentalData.js';
import {
  requiresPkwEnVkv,
  VEHICLE_STATE,
  ENVKV_CHANNEL,
} from './requiresPkwEnVkv.js';
import {
  buildPkwEnVkvCompactLines,
  buildPkwEnVkvDetailLines,
} from './pkwEnVkvPresentation.js';
import {
  validatePortfolioEnVkvForSend,
  getCalculatorEnVkvStatus,
} from './pkwEnVkvPublishGate.js';

// A) Elektrofahrzeug
const ev = resolveVehicleEnvironmentalData({ engineId: 'ev3-long-range', isNewPassengerCar: true });
assert.equal(ev.fuelType, 'electric');
assert.ok(ev.electricConsumptionCombined);
assert.equal(ev.co2EmissionsCombined, '0 g/km');
assert.equal(ev.co2Class, 'A');
const evCompact = buildPkwEnVkvCompactLines(ev);
assert.ok(evCompact.some((l) => l.label === 'Verbrauch'));
assert.ok(evCompact.some((l) => l.label === 'CO₂' && l.value === '0 g/km'));
console.log('A) Elektro – OK');

// B) Verbrenner (Sportage HEV)
const ice = resolveVehicleEnvironmentalData({
  engineId: 'tgi-hybrid-2wd',
  trimId: 'spirit',
  isNewPassengerCar: true,
});
assert.ok(ice.fuelConsumptionCombined || ice.co2EmissionsCombined);
assert.ok(ice.co2Class);
const iceCompact = buildPkwEnVkvCompactLines(ice);
assert.ok(iceCompact.length >= 2);
console.log('B) Verbrenner – OK');

// C) Plug-in-Hybrid
const phev = resolveVehicleEnvironmentalData({ engineId: 'niro-phev', isNewPassengerCar: true });
assert.equal(phev.fuelType, 'plug_in_hybrid');
const phevDetail = buildPkwEnVkvDetailLines(phev);
assert.ok(phevDetail.some((l) => /gewichtet kombiniert/i.test(l.label)));
assert.ok(phevDetail.some((l) => /entladener Batterie/i.test(l.label)));
console.log('C) PHEV – OK');

// D) requiresPkwEnVkv true bei neuem Pkw
assert.equal(requiresPkwEnVkv({ isNewPassengerCar: true }, { channel: ENVKV_CHANNEL.PORTAL }), true);
assert.equal(
  requiresPkwEnVkv(
    { vehicleState: VEHICLE_STATE.STOCK, mileageKm: 50, isNewPassengerCar: true },
    { channel: ENVKV_CHANNEL.OFFER, paymentType: 'leasing' },
  ),
  true,
);
console.log('D) requiresPkwEnVkv – OK');

// E) Fehlende verified Daten → interne Warnung / nicht publishable
const missing = resolveVehicleEnvironmentalData({ engineId: 'sportage-phev-missing-demo', isNewPassengerCar: true });
assert.equal(missing.publishable, false);
assert.equal(missing.confidence, ENV_CONFIDENCE.missing);
const calcMissing = getCalculatorEnVkvStatus({ engineId: 'sportage-phev-missing-demo', isNewPassengerCar: true });
assert.equal(calcMissing.publishable, false);
assert.match(calcMissing.message, /fehlen/i);
console.log('E) Fehlende Daten – OK');

// F) Kundenportal-Angebot zeigt Pflichtangaben wenn vorhanden
const portalItem = {
  id: 'pu-1',
  title: 'Kia EV3',
  modelKey: 'ev3',
  engineId: 'ev3-long-range',
  paymentType: 'leasing',
  isNewPassengerCar: true,
  vehicleEnvironmentalData: resolveVehicleEnvironmentalData({ engineId: 'ev3-long-range', isNewPassengerCar: true }),
};
const portalLines = buildPkwEnVkvDetailLines(portalItem.vehicleEnvironmentalData);
assert.ok(portalLines.length >= 3);
console.log('F) Kundenportal – OK');

// G) Landingpage compact
const landingLines = buildPkwEnVkvCompactLines(ev);
assert.ok(landingLines.length >= 2);
console.log('G) Landingpage compact – OK');

// H) Auswahl senden blockiert bei fehlenden Pflichtdaten
const sendCheck = validatePortfolioEnVkvForSend([
  {
    id: 'x1',
    title: 'Sportage PHEV Demo',
    engineId: 'sportage-phev-missing-demo',
    paymentType: 'leasing',
    isNewPassengerCar: true,
  },
]);
assert.equal(sendCheck.ok, false);
assert.equal(sendCheck.error, 'envkv_missing');
const sendOk = validatePortfolioEnVkvForSend([
  {
    id: 'x2',
    title: 'Kia EV3',
    engineId: 'ev3-long-range',
    paymentType: 'leasing',
    isNewPassengerCar: true,
    vehicleEnvironmentalData: resolveVehicleEnvironmentalData({ engineId: 'ev3-long-range', isNewPassengerCar: true }),
  },
]);
assert.equal(sendOk.ok, true);
console.log('H) Send-Block – OK');

// I) OpenAI-Werte nicht als verified
assert.equal(isOpenAiEnvironmentalSource('OpenAI Schätzung'), true);
assert.equal(isTrustedEnvironmentalSource('OpenAI Schätzung'), false);
const openAiProfile = resolveVehicleEnvironmentalData({
  engineId: 'ev3-long-range',
  compliance: { source: 'OpenAI GPT-4', status: COMPLIANCE_STATUS.verified, verifiedAt: '2026-01-01', verifiedBy: 'AI' },
  isNewPassengerCar: true,
});
assert.notEqual(openAiProfile.confidence, ENV_CONFIDENCE.verified);
console.log('I) OpenAI abgelehnt – OK');

// J) Gebrauchtwagen markierbar
assert.equal(
  requiresPkwEnVkv({ isNewPassengerCar: false, vehicleState: VEHICLE_STATE.USED }, { channel: ENVKV_CHANNEL.PORTAL }),
  false,
);
assert.equal(
  requiresPkwEnVkv({ envkvExempt: true, isNewPassengerCar: true }, { channel: ENVKV_CHANNEL.PORTAL }),
  false,
);
console.log('J) Gebrauchtwagen exempt – OK');

console.log('\nAlle EnVKV-Tests (A–J) bestanden.');
