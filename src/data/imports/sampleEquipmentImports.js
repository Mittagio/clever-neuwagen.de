/**
 * Beispiel-Importe für Preislisten / Ausstattungstabellen.
 * Abwärtskompatibilität: Re-Export aus JSON-Dateien (bevorzugter Weg).
 */
import kiaEv3Import from './equipment/kia-ev3-2026.equipment.json';
import kiaEv2Import from './equipment/kia-ev2-2026.equipment.json';
import demoModelXImport from './equipment/demo-model-x-2026.equipment.json';

/** @type {import('../features/modelEquipmentSchema.js').EquipmentImportRecord} */
export const KIA_EV3_PRICELIST_IMPORT = kiaEv3Import;

/** @type {import('../features/modelEquipmentSchema.js').EquipmentImportRecord} */
export const KIA_EV2_PRICELIST_IMPORT = kiaEv2Import;

/** @type {import('../features/modelEquipmentSchema.js').EquipmentImportRecord} */
export const GENERIC_DEMO_IMPORT = demoModelXImport;

export const SAMPLE_EQUIPMENT_IMPORTS = [
  KIA_EV3_PRICELIST_IMPORT,
  KIA_EV2_PRICELIST_IMPORT,
  GENERIC_DEMO_IMPORT,
];
