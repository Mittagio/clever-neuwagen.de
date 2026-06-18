/**
 * Vite: alle *.equipment.json im Import-Ordner eager laden.
 * Wird in Node-Tests nicht direkt importiert (import.meta.glob ist Vite-only).
 */
import { buildEquipmentImportFileEntries } from './equipmentImportFileDiscovery.js';

const equipmentImportModules = import.meta.glob(
  '../../data/imports/equipment/*.equipment.json',
  { eager: true, import: 'default' },
);

export const EQUIPMENT_IMPORT_FILE_ENTRIES = buildEquipmentImportFileEntries(equipmentImportModules);

export const EQUIPMENT_IMPORT_FILES = EQUIPMENT_IMPORT_FILE_ENTRIES.map(
  (entry) => entry.importData,
);
