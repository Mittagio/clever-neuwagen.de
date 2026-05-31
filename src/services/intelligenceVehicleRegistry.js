/**
 * Fahrzeug-Lookup für Clever Intelligence – Stammdaten aus advisorCatalog
 */
import { advisorCatalog } from '../data/advisorCatalog.js';

const byId = new Map();
const byLabel = new Map();

for (const vehicle of advisorCatalog) {
  byId.set(vehicle.id, vehicle);
  const full = `${vehicle.brand} ${vehicle.model} ${vehicle.variant}`.toLowerCase();
  const short = `${vehicle.model} ${vehicle.variant}`.toLowerCase();
  byLabel.set(full, vehicle);
  byLabel.set(short, vehicle);
}

export function normalizeVehicleId(vehicleId) {
  if (!vehicleId) return null;
  return String(vehicleId).replace(/-inv-.*$/, '');
}

export function parseDeliveryWeeks(text) {
  if (!text) return 6;
  if (/sofort|lager/i.test(text)) return 0;
  const nums = String(text).match(/(\d+)/g);
  if (!nums?.length) return 6;
  return nums.length >= 2
    ? Math.round((Number(nums[0]) + Number(nums[1])) / 2)
    : Number(nums[0]);
}

export function resolveIntelligenceVehicle(vehicleId, label) {
  const baseId = normalizeVehicleId(vehicleId);
  if (baseId && byId.has(baseId)) return byId.get(baseId);

  if (label) {
    const key = label.toLowerCase().trim();
    if (byLabel.has(key)) return byLabel.get(key);

    for (const vehicle of advisorCatalog) {
      const full = `${vehicle.brand} ${vehicle.model} ${vehicle.variant}`.toLowerCase();
      const short = `${vehicle.model} ${vehicle.variant}`.toLowerCase();
      if (key.includes(full) || key.includes(short) || full.includes(key)) {
        return vehicle;
      }
      if (key.includes(vehicle.model.toLowerCase()) && key.includes(vehicle.variant.split(' ')[0].toLowerCase())) {
        return vehicle;
      }
    }
  }

  return null;
}

export function vehicleDisplayLabel(catalogEntry, fallbackLabel) {
  if (fallbackLabel) return fallbackLabel;
  if (!catalogEntry) return 'Unbekannt';
  return `${catalogEntry.brand} ${catalogEntry.model} ${catalogEntry.variant}`;
}

export function isFamilyVehicle(catalogEntry) {
  if (!catalogEntry) return false;
  return (catalogEntry.familyScore ?? 0) >= 3
    || ['suv', 'kombi'].includes(catalogEntry.bodyType);
}

export function isElectroVehicle(catalogEntry) {
  return catalogEntry?.fuelCategory === 'elektro';
}

export function catalogDefaultRate(catalogEntry) {
  return catalogEntry?.mockRate ?? null;
}

export function catalogDefaultRange(catalogEntry) {
  return catalogEntry?.rangeKm ?? null;
}

export function catalogDefaultDeliveryWeeks(catalogEntry) {
  return parseDeliveryWeeks(catalogEntry?.mockDeliveryTime);
}

export function getAllCatalogVehicles() {
  return advisorCatalog;
}
