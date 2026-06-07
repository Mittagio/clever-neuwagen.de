/**
 * Kia CleverVehicleRecords – alle Modelllinien (kia.com DE) + Trim-Overrides.
 * Quellen: buildKiaCleverRecords.js, kiaCleverRecordOverrides.js
 */
import { buildAllKiaCleverRecords } from './buildKiaCleverRecords.js';

/** @type {import('./cleverVehicleRecord.js').CleverVehicleRecord[]} */
export const KIA_CLEVER_RECORDS = buildAllKiaCleverRecords();
