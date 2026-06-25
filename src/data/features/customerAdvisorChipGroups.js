/**
 * Kunden-Beratung: feste Chip-Gruppen (Wünsche sammeln, nicht verkaufen).
 */
import { resolveChipToScoringFeatureIds } from '../../services/configuration/equipmentChipBuilder.js';

/** @typedef {{ id: string, label: string, featureIds?: string[], advisorMeta?: string }} AdvisorChipDef */

/** @type {{ id: string, label: string, chips: AdvisorChipDef[] }[]} */
export const CUSTOMER_ADVISOR_CHIP_GROUPS = [
  {
    id: 'range_charge',
    label: 'Reichweite & Laden',
    chips: [
      { id: 'advisor_range_max', label: 'möglichst viel Reichweite', featureIds: ['range_400', 'reichweite_500'] },
      { id: 'reichweite_400', label: 'über 400 km', featureIds: ['range_400'] },
      { id: 'reichweite_500', label: 'über 500 km', featureIds: ['reichweite_500'] },
      { id: 'schnellladen', label: 'schnelles Laden', featureIds: ['schnellladen'] },
      { id: 'v2l', label: 'bidirektionales Laden / V2L', featureIds: ['v2l'] },
      { id: 'waermepumpe', label: 'Wärmepumpe', featureIds: ['heat_pump'] },
    ],
  },
  {
    id: 'comfort',
    label: 'Komfort',
    chips: [
      { id: 'sitzheizung_vorne', label: 'Sitzheizung', featureIds: ['heated_seats'] },
      { id: 'sitzheizung_hinten', label: 'Sitzheizung hinten', featureIds: ['heated_rear_seats'] },
      { id: 'lenkradheizung', label: 'Lenkradheizung', featureIds: ['steering_heat'] },
      { id: 'elektrische_heckklappe', label: 'elektrische Heckklappe', featureIds: ['power_tailgate'] },
      {
        id: 'advisor_electric_seats',
        label: 'elektrische Sitze',
        featureIds: ['elektrische_sitzverstellung_fahrer', 'elektrische_sitzverstellung_beifahrer'],
      },
      { id: 'memory_fahrersitz', label: 'Memory-Sitze', featureIds: ['memory_fahrersitz', 'memory_beifahrersitz'] },
    ],
  },
  {
    id: 'safety',
    label: 'Sicherheit & Assistenz',
    chips: [
      { id: 'surround_view_camera', label: '360° Kamera', featureIds: ['camera_360'] },
      { id: 'totwinkelassistent', label: 'Totwinkelassistent', featureIds: ['blind_spot'] },
      { id: 'head_up_display', label: 'Head-up Display', featureIds: ['head_up_display'] },
      { id: 'parkassistent', label: 'Parkassistent', featureIds: ['parkassistent', 'remote_parking'] },
      { id: 'autobahnassistent', label: 'Autobahnassistent', featureIds: ['autobahnassistent'] },
    ],
  },
  {
    id: 'daily_family',
    label: 'Alltag & Familie',
    chips: [
      { id: 'advisor_large_trunk', label: 'großer Kofferraum', featureIds: ['large_trunk'] },
      { id: 'advisor_stroller', label: 'Kinderwagen geeignet', featureIds: ['large_trunk', 'family_suv'] },
      { id: 'advisor_towbar', label: 'Anhängelast wichtig', featureIds: ['towbar', 'tow_capacity_2000'] },
      { id: 'advisor_dog_luggage', label: 'Hund / Gepäck', featureIds: ['large_trunk'] },
      { id: 'advisor_vacation', label: 'Urlaubsfahrten', featureIds: ['large_trunk', 'towbar'] },
    ],
  },
  {
    id: 'price_usage',
    label: 'Preis / Nutzung',
    chips: [
      { id: 'advisor_price_low', label: 'möglichst günstig', advisorMeta: 'price_low' },
      { id: 'advisor_price_value', label: 'beste Preis-Leistung', advisorMeta: 'price_value' },
      { id: 'advisor_equipment_high', label: 'viel Ausstattung', advisorMeta: 'equipment_high' },
      { id: 'advisor_premium', label: 'Premium / Design', advisorMeta: 'premium' },
    ],
  },
];

const CHIP_BY_ID = new Map(
  CUSTOMER_ADVISOR_CHIP_GROUPS.flatMap((g) => g.chips.map((c) => [c.id, { ...c, groupId: g.id }])),
);

/**
 * @param {string} chipId
 */
export function getCustomerAdvisorWishChip(chipId) {
  const chip = CHIP_BY_ID.get(chipId);
  if (!chip) return null;
  const featureIds = chip.featureIds ?? [];
  return {
    id: chip.id,
    label: chip.label,
    featureIds,
    globalFeatureId: featureIds[0] ?? chip.id,
    advisorMeta: chip.advisorMeta ?? null,
    advisorRelevant: chip.advisorMeta ? false : true,
  };
}

/**
 * Chip-Gruppen für Kunden-Journey (alle Gruppen, unabhängig von Modell-Verfügbarkeit).
 */
export function buildCustomerAdvisorChipGroups() {
  return CUSTOMER_ADVISOR_CHIP_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    chips: group.chips.map((chip) => ({
      id: chip.id,
      label: chip.label,
      featureId: chip.id,
    })),
  }));
}

/**
 * @param {string} chipId
 */
export function resolveCustomerAdvisorChipFeatureIds(chipId) {
  const chip = getCustomerAdvisorWishChip(chipId);
  if (!chip?.featureIds?.length) return resolveChipToScoringFeatureIds(chipId);
  const ids = new Set();
  for (const fid of chip.featureIds) {
    resolveChipToScoringFeatureIds(fid).forEach((id) => ids.add(id));
  }
  return [...ids];
}
