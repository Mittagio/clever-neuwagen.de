/** Verkaufsberater / Smart Sales – Chip-Katalog für Bedarfsanalyse */

export const SALES_ADVISOR_CHIP_GROUPS = [
  {
    id: 'vehicleType',
    label: 'Fahrzeugtyp',
    chips: [
      { id: 'type_kleinwagen', label: 'Kleinwagen', emoji: '🚗', bodyType: 'kleinwagen' },
      { id: 'type_suv', label: 'SUV', emoji: '🚙', bodyType: 'suv', features: ['family_suv'] },
      { id: 'type_limousine', label: 'Limousine', emoji: '🚘', bodyType: 'limousine' },
      { id: 'type_familie', label: 'Familienauto', emoji: '🚐', features: ['family_suv', 'seats_7'] },
      { id: 'type_kombi', label: 'Kombi', emoji: '📦', bodyType: 'kombi' },
      { id: 'type_van', label: 'Van', emoji: '🚐', bodyType: 'van' },
    ],
  },
  {
    id: 'powertrain',
    label: 'Antrieb',
    chips: [
      { id: 'fuel_elektro', label: 'Elektro', emoji: '⚡', powertrain: 'elektro', features: ['elektro'] },
      { id: 'fuel_phev', label: 'Plug-in Hybrid', emoji: '🔋', powertrain: 'plugin-hybrid' },
      { id: 'fuel_benzin', label: 'Benziner', emoji: '⛽', powertrain: 'verbrenner', features: ['benzin'] },
      { id: 'fuel_diesel', label: 'Diesel', emoji: '🛢', powertrain: 'diesel' },
      { id: 'fuel_hybrid', label: 'Hybrid', emoji: '♻', powertrain: 'hybrid' },
    ],
  },
  {
    id: 'comfort',
    label: 'Komfort',
    chips: [
      { id: 'heated_seats', label: 'Sitzheizung', emoji: '🔥', features: ['heated_seats'] },
      { id: 'steering_heat', label: 'Lenkradheizung', emoji: '🧤', features: ['steering_heat'] },
      { id: 'ventilated_seats', label: 'Belüftete Sitze', emoji: '❄', features: ['ventilated_seats'] },
      { id: 'power_tailgate', label: 'Elektrische Heckklappe', emoji: '🚪', features: ['power_tailgate'] },
      { id: 'panorama_roof', label: 'Panoramadach', emoji: '🌞', features: ['panorama_roof'] },
      { id: 'harman_kardon', label: 'Soundsystem', emoji: '🎵', features: ['harman_kardon'] },
    ],
  },
  {
    id: 'safety',
    label: 'Sicherheit',
    chips: [
      { id: 'rear_camera', label: 'Rückfahrkamera', emoji: '📷', features: ['rear_camera'] },
      { id: 'camera_360', label: '360° Kamera', emoji: '🔄', features: ['camera_360'] },
      { id: 'parking_front', label: 'Parksensoren vorne', emoji: '📡', features: ['parking_front'] },
      { id: 'parking_rear', label: 'Parksensoren hinten', emoji: '📡', features: ['parking_rear'] },
      { id: 'blind_spot', label: 'Totwinkelassistent', emoji: '👀', features: ['blind_spot'] },
      { id: 'acc', label: 'Abstandstempomat', emoji: '🛣', features: ['blind_spot'] },
    ],
  },
  {
    id: 'daily',
    label: 'Alltag',
    chips: [
      { id: 'large_trunk', label: 'Großer Kofferraum', emoji: '🧳', features: ['large_trunk'] },
      { id: 'family_suv', label: 'Familienauto', emoji: '👨‍👩‍👧‍👦', features: ['family_suv'] },
      { id: 'dog', label: 'Hund', emoji: '🐶', features: ['large_trunk'] },
      { id: 'bike', label: 'Fahrradträger', emoji: '🚲', features: ['towbar'] },
      { id: 'towbar', label: 'Anhängerkupplung', emoji: '🚙', features: ['towbar'] },
      { id: 'daily_family', label: 'Familie', emoji: '👨‍👩‍👧‍👦', features: ['family_suv'] },
      { id: 'daily_city', label: 'Viel Stadtverkehr', emoji: '🏙', features: [] },
      { id: 'daily_long', label: 'Lange Strecken', emoji: '🛣', features: ['range_400'] },
    ],
  },
  {
    id: 'equipment',
    label: 'Ausstattung',
    chips: [
      { id: 'heated_seats', label: 'Sitzheizung', emoji: '🔥', features: ['heated_seats'] },
      { id: 'rear_camera', label: 'Rückfahrkamera', emoji: '📷', features: ['rear_camera'] },
      { id: 'camera_360', label: '360° Kamera', emoji: '🔄', features: ['camera_360'] },
      { id: 'parking_front', label: 'Parksensoren vorne', emoji: '📡', features: ['parking_front'] },
      { id: 'parking_rear', label: 'Parksensoren hinten', emoji: '📡', features: ['parking_rear'] },
      { id: 'blind_spot', label: 'Totwinkelassistent', emoji: '👀', features: ['blind_spot'] },
      { id: 'towbar', label: 'Anhängerkupplung', emoji: '🚙', features: ['towbar'] },
      { id: 'heat_pump', label: 'Wärmepumpe', emoji: '❄', features: ['heat_pump'] },
      { id: 'power_tailgate', label: 'Elektrische Heckklappe', emoji: '🚪', features: ['power_tailgate'] },
      { id: 'panorama_roof', label: 'Panoramadach', emoji: '🌞', features: ['panorama_roof'] },
    ],
  },
  {
    id: 'ev',
    label: 'Elektro',
    chips: [
      { id: 'range_400', label: 'Über 400 km Reichweite', emoji: '🔋', features: ['range_400'] },
      { id: 'fast_charge', label: 'Schnellladen', emoji: '⚡', features: ['range_400'] },
      { id: 'heat_pump', label: 'Wärmepumpe', emoji: '❄', features: ['heat_pump'] },
      { id: 'v2l', label: 'V2L', emoji: '🏠', features: ['range_400'] },
    ],
  },
  {
    id: 'mileage',
    label: 'Kilometer',
    chips: [
      { id: 'km_10000', label: '10.000 km', emoji: '📏', mileagePerYear: 10000 },
      { id: 'km_15000', label: '15.000 km', emoji: '📏', mileagePerYear: 15000 },
      { id: 'km_20000', label: '20.000 km', emoji: '📏', mileagePerYear: 20000 },
      { id: 'km_25000', label: '25.000 km', emoji: '📏', mileagePerYear: 25000 },
      { id: 'km_30000', label: '30.000 km', emoji: '📏', mileagePerYear: 30000 },
    ],
  },
  {
    id: 'budget',
    label: 'Budget',
    chips: [
      { id: 'budget_250', label: 'bis 250 €', emoji: '💰', budgetMax: 250 },
      { id: 'budget_300', label: 'bis 300 €', emoji: '💰', budgetMax: 300 },
      { id: 'budget_400', label: 'bis 400 €', emoji: '💰', budgetMax: 400 },
      { id: 'budget_500', label: 'bis 500 €', emoji: '💰', budgetMax: 500 },
      { id: 'budget_600', label: 'bis 600 €', emoji: '💰', budgetMax: 600 },
    ],
  },
  {
    id: 'availability',
    label: 'Verfügbarkeit',
    chips: [
      { id: 'avail_sofort', label: 'Sofort verfügbar', emoji: '🟢', availability: 'sofort' },
      { id: 'avail_lager', label: 'Lagerfahrzeug', emoji: '📦', availability: 'sofort' },
      { id: 'avail_any', label: 'Lieferzeit egal', emoji: '🚚', availability: null },
    ],
  },
];

export const ALL_SALES_ADVISOR_CHIPS = SALES_ADVISOR_CHIP_GROUPS.flatMap((g) => g.chips);

/** Gesprächsmodus – kompakte Chip-Gruppen */
export const CONVERSATION_CHIP_GROUPS = [
  SALES_ADVISOR_CHIP_GROUPS.find((g) => g.id === 'vehicleType'),
  SALES_ADVISOR_CHIP_GROUPS.find((g) => g.id === 'powertrain'),
  SALES_ADVISOR_CHIP_GROUPS.find((g) => g.id === 'budget'),
  SALES_ADVISOR_CHIP_GROUPS.find((g) => g.id === 'mileage'),
  SALES_ADVISOR_CHIP_GROUPS.find((g) => g.id === 'equipment'),
  SALES_ADVISOR_CHIP_GROUPS.find((g) => g.id === 'daily'),
  SALES_ADVISOR_CHIP_GROUPS.find((g) => g.id === 'availability'),
].filter(Boolean);

export function getSalesChipById(chipId) {
  return ALL_SALES_ADVISOR_CHIPS.find((c) => c.id === chipId) ?? null;
}

export function getLiveChipLabels(chipIds = []) {
  return chipIds
    .map((id) => getSalesChipById(id))
    .filter(Boolean)
    .map((c) => ({ id: c.id, label: c.emoji ? `${c.emoji} ${c.label}` : c.label }));
}
