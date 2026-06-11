/**
 * Verkäufer-Wunschkatalog – Kundensprache, nicht Trim-Namen.
 * @typedef {{ id: string, label: string, features: string[], electricOnly?: boolean }} DealerWishChip
 * @typedef {{ id: string, label: string, emoji: string, chips: DealerWishChip[] }} DealerWishGroup
 */

/** @type {DealerWishGroup[]} */
export const DEALER_WISH_GROUPS = [
  {
    id: 'comfort',
    label: 'Komfort',
    emoji: '😌',
    chips: [
      { id: 'heated_seats', label: 'Sitzheizung', features: ['heated_seats'] },
      { id: 'steering_heat', label: 'Lenkradheizung', features: ['steering_heat'] },
      { id: 'power_tailgate', label: 'Elektrische Heckklappe', features: ['power_tailgate'] },
      { id: 'memory_seats', label: 'Memory-Sitze', features: ['heated_seats'] },
      { id: 'ventilated_seats', label: 'Belüftete Sitze', features: ['ventilated_seats'] },
      { id: 'panorama_roof', label: 'Panoramadach', features: ['panorama_roof'] },
    ],
  },
  {
    id: 'safety',
    label: 'Sicherheit',
    emoji: '🛡️',
    chips: [
      { id: 'camera_360', label: '360° Kamera', features: ['camera_360'] },
      { id: 'blind_spot', label: 'Totwinkelassistent', features: ['blind_spot'] },
      { id: 'head_up_display', label: 'Head-Up Display', features: ['head_up_display'] },
      { id: 'park_assist', label: 'Parkassistent', features: ['parking_front', 'parking_rear', 'remote_parking'] },
      { id: 'cross_traffic', label: 'Querverkehrswarner', features: ['blind_spot'] },
      { id: 'highway_assist', label: 'Autobahnassistent', features: ['blind_spot'] },
    ],
  },
  {
    id: 'electro',
    label: 'Elektro & Reichweite',
    emoji: '⚡',
    chips: [
      { id: 'heat_pump', label: 'Wärmepumpe', features: ['heat_pump'], electricOnly: true },
      { id: 'v2l', label: 'V2L', features: ['range_400'], electricOnly: true },
      { id: 'fast_charge', label: 'Schnellladen', features: ['range_400'], electricOnly: true },
      { id: 'charge_800v', label: '800V Technik', features: ['range_400'], electricOnly: true },
      { id: 'range_400', label: 'Reichweite über 400 km', features: ['range_400'], electricOnly: true },
      { id: 'range_500', label: 'Reichweite über 500 km', features: ['range_400'], electricOnly: true },
    ],
  },
  {
    id: 'family',
    label: 'Familie',
    emoji: '👨‍👩‍👧‍👦',
    chips: [
      { id: 'isofix_3', label: '3 Isofix', features: ['family_suv', 'seats_7'] },
      { id: 'seats_7', label: '7 Sitze', features: ['seats_7'] },
      { id: 'large_trunk', label: 'Großer Kofferraum', features: ['large_trunk'] },
      { id: 'stroller', label: 'Kinderwagen geeignet', features: ['large_trunk', 'family_suv'] },
    ],
  },
  {
    id: 'transport',
    label: 'Transport',
    emoji: '🚚',
    chips: [
      { id: 'towbar', label: 'Anhängerkupplung', features: ['towbar'] },
      { id: 'tow_1500', label: 'Anhängelast über 1,5 t', features: ['towbar'] },
      { id: 'tow_capacity_2000', label: 'Anhängelast über 2 t', features: ['tow_capacity_2000', 'towbar'] },
      { id: 'roof_rails', label: 'Dachreling', features: ['towbar'] },
    ],
  },
  {
    id: 'business',
    label: 'Business',
    emoji: '✨',
    chips: [
      { id: 'leather', label: 'Leder', features: ['heated_seats'] },
      { id: 'matrix_led', label: 'Matrix LED', features: ['head_up_display'] },
      { id: 'harman_kardon', label: 'Soundsystem', features: ['harman_kardon'] },
      { id: 'navigation', label: 'Navigation', features: ['camera_360'] },
      { id: 'digital_key', label: 'Digital Key', features: ['power_tailgate'] },
    ],
  },
];

/** Häufig gewählte Wünsche pro Modell – Verkäufer-Shortcut. */
export const MODEL_POPULAR_WISH_CHIP_IDS = {
  ev9: ['towbar', 'seats_7', 'heat_pump', 'camera_360'],
  'ev9-gt': ['towbar', 'seats_7', 'heat_pump', 'camera_360'],
  ev4: ['heat_pump', 'camera_360', 'heated_seats', 'blind_spot'],
  'ev4-fastback': ['heat_pump', 'camera_360', 'heated_seats'],
  ev5: ['heat_pump', 'towbar', 'camera_360', 'heated_seats'],
  sportage: ['towbar', 'heated_seats', 'camera_360', 'blind_spot'],
  sorento: ['seats_7', 'towbar', 'heated_seats', 'camera_360'],
};

const CHIP_BY_ID = new Map(
  DEALER_WISH_GROUPS.flatMap((g) => g.chips.map((c) => [c.id, c])),
);

const GROUP_BY_ID = Object.fromEntries(DEALER_WISH_GROUPS.map((g) => [g.id, g]));

export function findDealerWishChip(chipId) {
  return CHIP_BY_ID.get(chipId) ?? null;
}

export function getDealerWishGroupMeta(groupId) {
  return GROUP_BY_ID[groupId] ?? null;
}

export function toggleWishChipIds(current, chipId) {
  const set = new Set(current ?? []);
  if (set.has(chipId)) set.delete(chipId);
  else set.add(chipId);
  return [...set];
}

export function resolveWishFeaturesFromChips(chipIds = []) {
  const features = new Set();
  for (const chipId of chipIds) {
    const chip = findDealerWishChip(chipId);
    if (chip?.features?.length) {
      chip.features.forEach((f) => features.add(f));
    } else {
      features.add(chipId);
    }
  }
  return [...features];
}

export function getSelectedWishLabels(chipIds = []) {
  return chipIds
    .map((id) => findDealerWishChip(id)?.label ?? id)
    .filter(Boolean);
}
