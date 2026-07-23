/**
 * Ausstattungswünsche für Wunschübergabe – an mobile.de-Detailsuche angelehnt.
 * Kategorien: Komfort · Technik · Sicherheit · Alltag
 */

export const HANDOFF_EQUIPMENT_CHIPS = [
  // Komfort (Innenausstattung / Klimatisierung)
  { id: 'climateAuto', label: 'Klimaautomatik', category: 'comfort' },
  { id: 'climateAuto2Zone', label: '2-Zonen-Klima', category: 'comfort' },
  { id: 'seatHeating', label: 'Sitzheizung', category: 'comfort' },
  { id: 'rearSeatHeating', label: 'Sitzheizung hinten', category: 'comfort' },
  { id: 'seatVentilation', label: 'Sitzbelüftung', category: 'comfort' },
  { id: 'steeringWheelHeating', label: 'Lenkradheizung', category: 'comfort' },
  { id: 'auxiliaryHeating', label: 'Standheizung', category: 'comfort' },
  { id: 'heatPump', label: 'Wärmepumpe', category: 'comfort' },
  { id: 'heatedWindshield', label: 'Beheizbare Frontscheibe', category: 'comfort' },
  { id: 'powerSeats', label: 'Elektr. Sitze', category: 'comfort' },
  { id: 'memorySeats', label: 'Memory-Sitze', category: 'comfort' },
  { id: 'massageSeats', label: 'Massagesitze', category: 'comfort' },
  { id: 'leather', label: 'Leder', category: 'comfort' },
  { id: 'ambientLight', label: 'Ambientebeleuchtung', category: 'comfort' },
  { id: 'powerTailgate', label: 'Elektrische Heckklappe', category: 'comfort' },
  { id: 'panoramicRoof', label: 'Panoramadach', category: 'comfort' },
  { id: 'keyless', label: 'Keyless', category: 'comfort' },

  // Technik (Multimedia / Exterieur / Cockpit)
  { id: 'navi', label: 'Navigationssystem', category: 'tech' },
  { id: 'appleCarPlay', label: 'Apple CarPlay', category: 'tech' },
  { id: 'androidAuto', label: 'Android Auto', category: 'tech' },
  { id: 'wirelessCharging', label: 'Induktives Laden', category: 'tech' },
  { id: 'hud', label: 'Head-up-Display', category: 'tech' },
  { id: 'digitalCockpit', label: 'Digitales Cockpit', category: 'tech' },
  { id: 'soundSystem', label: 'Soundsystem', category: 'tech' },
  { id: 'voiceControl', label: 'Sprachsteuerung', category: 'tech' },
  { id: 'dabRadio', label: 'DAB-Radio', category: 'tech' },
  { id: 'wifiHotspot', label: 'WLAN-Hotspot', category: 'tech' },
  { id: 'ledHeadlights', label: 'LED-Scheinwerfer', category: 'tech' },
  { id: 'matrixLed', label: 'Matrix-LED', category: 'tech' },
  { id: 'frontParkingSensors', label: 'Parksensoren vorne', category: 'tech' },
  { id: 'rearParkingSensors', label: 'Parksensoren hinten', category: 'tech' },
  { id: 'rearCamera', label: 'Rückfahrkamera', category: 'tech' },
  { id: 'camera360', label: '360° Kamera', category: 'tech' },

  // Sicherheit (Assistenzsysteme)
  { id: 'emergencyBrake', label: 'Notbremsassistent', category: 'safety' },
  { id: 'blindSpot', label: 'Totwinkelassistent', category: 'safety' },
  { id: 'laneAssist', label: 'Spurhalteassistent', category: 'safety' },
  { id: 'cruiseControl', label: 'Tempomat', category: 'safety' },
  { id: 'adaptiveCruise', label: 'Abstandstempomat', category: 'safety' },
  { id: 'trafficSignAssist', label: 'Verkehrszeichenerkennung', category: 'safety' },
  { id: 'fatigueWarn', label: 'Müdigkeitswarner', category: 'safety' },
  { id: 'highBeamAssist', label: 'Fernlichtassistent', category: 'safety' },
  { id: 'eCall', label: 'Notrufassistent', category: 'safety' },
  { id: 'parkingAssist', label: 'Parkassistent', category: 'safety' },
  { id: 'tirePressure', label: 'Reifendruckkontrolle', category: 'safety' },
  { id: 'hillStart', label: 'Berganfahrassistent', category: 'safety' },

  // Alltag
  { id: 'towbar', label: 'Anhängerkupplung', category: 'daily' },
  { id: 'bigTrunk', label: 'Großer Kofferraum', category: 'daily' },
  { id: 'roofRails', label: 'Dachreling', category: 'daily' },
  { id: 'bikeRack', label: 'Fahrradträger', category: 'daily' },
  { id: 'isofix', label: 'Isofix', category: 'daily' },
  { id: 'foldingMirrors', label: 'Elektr. Spiegel', category: 'daily' },
];

/** Soft-UI: Komfort · Technik · Sicherheit · Alltag */
export const HANDOFF_EQUIPMENT_CATEGORIES = [
  { id: 'comfort', label: 'Komfort', icon: '💺' },
  { id: 'tech', label: 'Technik', icon: '⚙️' },
  { id: 'safety', label: 'Sicherheit', icon: '🛡️' },
  { id: 'daily', label: 'Alltag', icon: '🪝' },
];

/** Kategorie-Chips direkt unter „Ausstattung“ */
export const SOFT_EQUIPMENT_CATEGORY_CHIPS = [
  { id: 'comfort', label: 'Komfort' },
  { id: 'tech', label: 'Technik' },
  { id: 'safety', label: 'Sicherheit' },
  { id: 'daily', label: 'Alltag' },
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
 * @param {{ categoryId?: string|null }} [options]
 */
export function buildEquipmentCategoryView(selectedIds = [], existingLabels = [], options = {}) {
  const selected = new Set(selectedIds);
  const blob = (existingLabels ?? []).join(' ').toLowerCase();
  const onlyCategory = options.categoryId ?? null;

  return HANDOFF_EQUIPMENT_CATEGORIES
    .filter((category) => !onlyCategory || category.id === onlyCategory)
    .map((category) => {
      const chips = HANDOFF_EQUIPMENT_CHIPS
        .filter((chip) => chip.category === category.id)
        .filter((chip) => {
          if (blob.includes(String(chip.label).toLowerCase())) return false;
          // Kurzform Navi vs Navigationssystem
          if (chip.id === 'navi' && /\bnavi\b/.test(blob)) return false;
          return true;
        })
        .map((chip) => ({
          ...chip,
          selected: selected.has(chip.id),
        }));
      return { ...category, chips };
    })
    .filter((category) => category.chips.length > 0);
}

/**
 * Flache Feature-Liste einer Kategorie für Soft-UI.
 */
export function buildEquipmentChipsForCategory(
  categoryId,
  selectedIds = [],
  existingLabels = [],
) {
  const view = buildEquipmentCategoryView(selectedIds, existingLabels, { categoryId });
  return view[0]?.chips ?? [];
}

export function labelsFromEquipmentIds(ids = []) {
  return ids
    .map((id) => CHIP_BY_ID[id]?.label)
    .filter(Boolean);
}
