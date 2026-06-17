import { getKiaModelMediaEntry } from './kia/kiaModelImages.js';
import { SALES_ADVISOR_CHIP_GROUPS } from './salesAdvisorChips.js';
import {
  getBudgetChipsForPaymentType,
  getBudgetFieldLabel,
  paymentTypeFromChipId,
} from '../services/dealerAiBudget.js';

export const KIA_ASSISTANT_MODELS = [
  { id: 'ev2', name: 'EV2', tagline: 'Kompakt & elektrisch', badge: 'Neu' },
  { id: 'ev3', name: 'EV3', tagline: 'Kompakter SUV', badge: 'Elektro' },
  { id: 'ev4', name: 'EV4', tagline: 'Limousine & Langstrecke', badge: 'Elektro' },
  { id: 'ev5', name: 'EV5', tagline: 'Mittelgroßer SUV', badge: 'Elektro' },
  { id: 'ev6', name: 'EV6', tagline: 'Sportlicher Crossover', badge: 'Elektro' },
  { id: 'ev9', name: 'EV9', tagline: 'Großer 7-Sitzer', badge: 'Elektro' },
  { id: 'sportage', name: 'Sportage', tagline: 'SUV & vielseitig', badge: 'Bestseller' },
  { id: 'xceed', name: 'XCeed', tagline: 'Crossover & Stil', badge: null },
  { id: 'niro', name: 'Niro', tagline: 'Hybrid & effizient', badge: 'Hybrid' },
  { id: 'picanto', name: 'Picanto', tagline: 'Stadt & kompakt', badge: null },
  { id: 'ceed', name: 'Ceed', tagline: 'Kompakt & praktisch', badge: null },
  { id: 'stonic', name: 'Stonic', tagline: 'Urban SUV', badge: null },
];

export const VEHICLE_TYPE_IMAGE_KEYS = {
  type_kleinwagen: 'picanto',
  type_suv: 'sportage',
  type_limousine: 'ev4',
  type_familie: 'ev9',
  type_kombi: 'xceed',
  type_van: 'pv5-passenger',
};

export function getAssistantModelImage(modelId, view = 'card') {
  const media = getKiaModelMediaEntry(modelId, view);
  return media?.card ?? media?.hero ?? media?.default ?? null;
}

const group = (id) => SALES_ADVISOR_CHIP_GROUPS.find((g) => g.id === id);

function pickChips(ids) {
  const all = group('powertrain')?.chips ?? [];
  return ids.map((id) => all.find((c) => c.id === id)).filter(Boolean);
}

export const CLEVER_BERATUNG_STEPS = [
  {
    id: 'vehicleType',
    sectionLabel: 'Fahrzeugtyp',
    title: 'Welche Fahrzeugart passt?',
    hint: 'Wählen Sie die Fahrzeugart, die am besten zu Ihren Bedürfnissen passt.',
    layout: 'vehicle-cards',
    multi: false,
    chips: group('vehicleType')?.chips ?? [],
  },
  {
    id: 'powertrain',
    sectionLabel: 'Antrieb',
    sectionOptional: true,
    title: 'Welcher Antrieb?',
    hint: 'Wählen Sie den bevorzugten Antrieb.',
    layout: 'powertrain-row',
    multi: false,
    chips: [
      ...pickChips(['fuel_elektro', 'fuel_hybrid', 'fuel_phev', 'fuel_benzin', 'fuel_diesel']),
      { id: 'fuel_open', label: 'Noch offen', emoji: '❓', skip: true },
    ],
  },
  {
    id: 'paymentType',
    sectionLabel: 'Angebotsart',
    title: 'Welche Angebotsart?',
    hint: 'Leasing, Kauf oder Finanzierung – was passt zum Kunden?',
    layout: 'chips',
    multi: false,
    chips: group('paymentType')?.chips ?? [],
  },
  {
    id: 'budget',
    sectionLabel: 'Budget',
    title: 'Welches Budget?',
    hint: 'Monatliche Rate oder Kaufpreis – je nach Angebotsart.',
    layout: 'chips',
    multi: false,
    chips: [],
    dynamicBudget: true,
  },
  {
    id: 'features',
    sectionLabel: 'Ausstattung',
    sectionOptional: true,
    title: 'Was ist wichtig?',
    hint: 'Mehrfachauswahl möglich – nur was wirklich zählt.',
    layout: 'chips',
    multi: true,
    chips: [
      { id: 'heated_seats', label: 'Sitzheizung', emoji: '🔥' },
      { id: 'rear_camera', label: 'Rückfahrkamera', emoji: '📷' },
      { id: 'camera_360', label: '360° Kamera', emoji: '🔄' },
      { id: 'towbar', label: 'Anhängerkupplung', emoji: '🚙' },
      { id: 'heat_pump', label: 'Wärmepumpe', emoji: '❄' },
      { id: 'large_trunk', label: 'großer Kofferraum', emoji: '🧳' },
      { id: 'daily_family', label: 'Familie', emoji: '👨‍👩‍👧‍👦' },
      { id: 'dog', label: 'Hund', emoji: '🐶' },
      { id: 'bike', label: 'Fahrradträger', emoji: '🚲' },
      { id: 'panorama_roof', label: 'Panoramadach', emoji: '🌞' },
      { id: 'parking_rear', label: 'Parksensoren', emoji: '📡' },
      { id: 'blind_spot', label: 'Totwinkelassistent', emoji: '👀' },
    ],
  },
];

export function getModelFlowChipGroups(chipIds = []) {
  const paymentChip = chipIds.find((id) => id.startsWith('pay_'));
  const paymentType = paymentChip ? (paymentTypeFromChipId(paymentChip) ?? 'unknown') : 'unknown';

  return [
    {
      id: 'paymentType',
      label: 'Angebotsart',
      icon: '📄',
      chips: group('paymentType')?.chips ?? [],
      emptyLabel: 'Keine Angabe',
    },
    {
      id: 'budget',
      label: getBudgetFieldLabel(paymentType),
      icon: '€',
      chips: getBudgetChipsForPaymentType(paymentType),
      emptyLabel: 'Keine Angabe',
    },
    {
      id: 'delivery',
      label: 'Übergabe',
      icon: '📅',
      chips: [
        ...(group('delivery')?.chips?.filter((c) => c.id !== 'del_custom') ?? []),
        { id: 'del_open', label: 'Flexibel', emoji: '❓', skip: true },
      ],
      emptyLabel: 'Flexibel',
    },
  ];
}

/** @deprecated Nutze getModelFlowChipGroups(chipIds) für dynamisches Budget */
export const MODEL_FLOW_CHIP_GROUPS = getModelFlowChipGroups();

export function filterAssistantModels(query = '') {
  const q = query.trim().toLowerCase();
  if (!q) return KIA_ASSISTANT_MODELS;
  return KIA_ASSISTANT_MODELS.filter(
    (m) => m.name.toLowerCase().includes(q)
      || m.tagline?.toLowerCase().includes(q)
      || `kia ${m.name}`.toLowerCase().includes(q),
  );
}
