/**
 * Ausstattungswünsche für Wunschübergabe – Kategorien, wenig Text.
 * Wiederverwendet bestehende Boost-Chips + Sicherheit.
 */

export const HANDOFF_EQUIPMENT_CHIPS = [
  // Komfort
  { id: 'seatHeating', label: 'Sitzheizung', category: 'comfort' },
  { id: 'steeringWheelHeating', label: 'Lenkradheizung', category: 'comfort' },
  { id: 'powerTailgate', label: 'Elektrische Heckklappe', category: 'comfort' },
  { id: 'panoramicRoof', label: 'Panoramadach', category: 'comfort' },
  { id: 'seatVentilation', label: 'Sitzbelüftung', category: 'comfort' },
  { id: 'memorySeats', label: 'Memory-Sitze', category: 'comfort' },
  // Technik
  { id: 'frontParkingSensors', label: 'Parksensoren vorne', category: 'tech' },
  { id: 'rearCamera', label: 'Rückfahrkamera', category: 'tech' },
  { id: 'camera360', label: '360° Kamera', category: 'tech' },
  { id: 'hud', label: 'Head-up-Display', category: 'tech' },
  { id: 'navi', label: 'Navi', category: 'tech' },
  { id: 'appleCarPlay', label: 'Apple CarPlay', category: 'tech' },
  { id: 'matrixLed', label: 'Matrix-LED', category: 'tech' },
  // Sicherheit
  { id: 'eCall', label: 'Notrufassistent', category: 'safety' },
  { id: 'blindSpot', label: 'Totwinkelassistent', category: 'safety' },
  { id: 'laneAssist', label: 'Spurhalteassistent', category: 'safety' },
  { id: 'adaptiveCruise', label: 'Abstandstempomat', category: 'safety' },
  // Alltag
  { id: 'towbar', label: 'Anhängerkupplung', category: 'daily' },
  { id: 'bigTrunk', label: 'Großer Kofferraum', category: 'daily' },
  { id: 'roofRails', label: 'Dachreling', category: 'daily' },
  { id: 'bikeRack', label: 'Fahrradträger', category: 'daily' },
];

export const HANDOFF_EQUIPMENT_CATEGORIES = [
  { id: 'tech', label: 'Technik', icon: '⚙️' },
  { id: 'comfort', label: 'Komfort', icon: '💺' },
  { id: 'safety', label: 'Sicherheit', icon: '🛡️' },
  { id: 'daily', label: 'Alltag', icon: '🪝' },
];

const CHIP_BY_ID = Object.fromEntries(HANDOFF_EQUIPMENT_CHIPS.map((c) => [c.id, c]));

export function getHandoffEquipmentChip(id) {
  return CHIP_BY_ID[id] ?? null;
}

export function handoffEquipmentLabels() {
  return HANDOFF_EQUIPMENT_CHIPS.map((c) => c.label);
}

/**
 * @param {string[]} selectedIds
 * @param {string[]} [existingLabels] – bereits im Gespräch notiert
 */
export function buildEquipmentCategoryView(selectedIds = [], existingLabels = []) {
  const selected = new Set(selectedIds);
  const blob = (existingLabels ?? []).join(' ').toLowerCase();

  return HANDOFF_EQUIPMENT_CATEGORIES.map((category) => {
    const chips = HANDOFF_EQUIPMENT_CHIPS
      .filter((chip) => chip.category === category.id)
      .filter((chip) => {
        if (blob.includes(String(chip.label).toLowerCase())) return false;
        return true;
      })
      .map((chip) => ({
        ...chip,
        selected: selected.has(chip.id),
      }));
    return { ...category, chips };
  }).filter((category) => category.chips.length > 0);
}

export function labelsFromEquipmentIds(ids = []) {
  return ids
    .map((id) => getHandoffEquipmentChip(id)?.label)
    .filter(Boolean);
}
