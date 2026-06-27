/**
 * Showroom Modus – Kellnerblock-Chips (mobil, ohne Pflichtfelder).
 */

export const SHOWROOM_TABS = [
  { id: 'auto', icon: '🚗', label: 'Auto' },
  { id: 'payment', icon: '€', label: 'Bezahlung' },
  { id: 'customer', icon: '👤', label: 'Kunde' },
  { id: 'note', icon: '📝', label: 'Notiz' },
];

export const SHOWROOM_AUTO_GROUPS = [
  {
    id: 'powertrain',
    label: 'Antrieb',
    chips: [
      { id: 'fuel_elektro', label: 'Elektro', emoji: '⚡' },
      { id: 'fuel_hybrid', label: 'Hybrid', emoji: '♻' },
      { id: 'fuel_benzin', label: 'Benzin', emoji: '⛽' },
      { id: 'showroom_automatic', label: 'Automatik', emoji: '⚙' },
    ],
  },
  {
    id: 'comfort',
    label: 'Komfort',
    chips: [
      { id: 'heated_seats', label: 'Sitzheizung', emoji: '🔥' },
      { id: 'steering_heat', label: 'Lenkradheizung', emoji: '🧤' },
      { id: 'panorama_roof', label: 'Panoramadach', emoji: '🌞' },
    ],
  },
  {
    id: 'safety',
    label: 'Sicherheit',
    chips: [
      { id: 'rear_camera', label: 'Rückfahrkamera', emoji: '📷' },
      { id: 'camera_360', label: '360° Kamera', emoji: '🔄' },
      { id: 'blind_spot', label: 'Totwinkelassistent', emoji: '👀' },
      { id: 'acc', label: 'Abstandstempomat', emoji: '🛣' },
    ],
  },
  {
    id: 'tech',
    label: 'Technik',
    chips: [
      { id: 'range_400', label: 'Reichweite wichtig', emoji: '🔋' },
      { id: 'fast_charge', label: 'Schnellladen', emoji: '⚡' },
      { id: 'heat_pump', label: 'Wärmepumpe', emoji: '❄' },
    ],
  },
  {
    id: 'tow',
    label: 'AHK & Transport',
    chips: [
      { id: 'towbar', label: 'AHK benötigt', emoji: '🚙' },
      { id: 'bike', label: 'Fahrradträger', emoji: '🚲' },
      { id: 'showroom_caravan', label: 'Wohnwagen', emoji: '🏕' },
      { id: 'showroom_tow_1500', label: '1.500 kg Anhängelast', emoji: '⚖' },
    ],
  },
  {
    id: 'space',
    label: 'Platz',
    chips: [
      { id: 'large_trunk', label: 'Großer Kofferraum', emoji: '🧳' },
      { id: 'showroom_high_entry', label: 'Hoher Einstieg', emoji: '🪜' },
      { id: 'type_suv', label: 'SUV', emoji: '🚙' },
      { id: 'type_kombi', label: 'Kombi', emoji: '📦' },
      { id: 'showroom_isofix', label: 'Isofix', emoji: '👶' },
    ],
  },
];

export const SHOWROOM_PAYMENT_GROUPS = [
  {
    id: 'paymentType',
    label: 'Angebotsart',
    chips: [
      { id: 'pay_cash', label: 'Barzahlung', emoji: '💶' },
      { id: 'pay_financing', label: 'Finanzierung', emoji: '🏦' },
      { id: 'pay_leasing', label: 'Leasing', emoji: '📋' },
      { id: 'showroom_priv_leasing', label: 'Privatleasing', emoji: '👤' },
      { id: 'showroom_gew_leasing', label: 'Gewerbeleasing', emoji: '🏢' },
    ],
  },
  {
    id: 'extras',
    label: 'Konditionen',
    chips: [
      { id: 'showroom_no_down', label: 'Keine Anzahlung', emoji: '0️⃣' },
      { id: 'showroom_down_ok', label: 'Anzahlung möglich', emoji: '💳' },
      { id: 'showroom_trade_in', label: 'Inzahlungnahme', emoji: '🔄' },
    ],
  },
  {
    id: 'budget',
    label: 'Budget',
    chips: [
      { id: 'budget_300', label: 'bis 300 €', emoji: '💰' },
      { id: 'budget_400', label: 'bis 400 €', emoji: '💰' },
      { id: 'budget_500', label: 'bis 500 €', emoji: '💰' },
    ],
  },
  {
    id: 'mileage',
    label: 'Kilometer',
    chips: [
      { id: 'km_10000', label: '10.000 km/Jahr', emoji: '📏' },
      { id: 'km_15000', label: '15.000 km/Jahr', emoji: '📏' },
      { id: 'km_20000', label: '20.000 km/Jahr', emoji: '📏' },
    ],
  },
  {
    id: 'term',
    label: 'Laufzeit',
    chips: [
      { id: 'term_24', label: '24 Monate', emoji: '📅' },
      { id: 'term_36', label: '36 Monate', emoji: '📅' },
      { id: 'term_48', label: '48 Monate', emoji: '📅' },
    ],
  },
  {
    id: 'availability',
    label: 'Verfügbarkeit',
    chips: [
      { id: 'avail_sofort', label: 'Sofort verfügbar', emoji: '🟢' },
      { id: 'avail_any', label: 'Lieferzeit egal', emoji: '🚚' },
    ],
  },
];

export const SHOWROOM_CUSTOMER_GROUPS = [
  {
    id: 'household',
    label: 'Haushalt',
    chips: [
      { id: 'cust_solo', label: 'Alleinfahrer', emoji: '👤' },
      { id: 'cust_family', label: 'Familie', emoji: '👨‍👩‍👧‍👦' },
      { id: 'cust_child_1', label: '1 Kind', emoji: '1️⃣' },
      { id: 'cust_child_2', label: '2 Kinder', emoji: '2️⃣' },
      { id: 'cust_child_3', label: '3+ Kinder', emoji: '3️⃣' },
      { id: 'cust_dog', label: 'Hund', emoji: '🐶' },
    ],
  },
  {
    id: 'usage',
    label: 'Nutzung',
    chips: [
      { id: 'cust_commuter', label: 'Pendler', emoji: '🚆' },
      { id: 'cust_high_mileage', label: 'Vielfahrer', emoji: '🛣' },
      { id: 'cust_city', label: 'Stadtfahrer', emoji: '🏙' },
      { id: 'cust_long_distance', label: 'Langstrecke', emoji: '🛣' },
    ],
  },
  {
    id: 'profile',
    label: 'Profil',
    chips: [
      { id: 'cust_private', label: 'Privatkunde', emoji: '👤' },
      { id: 'cust_business', label: 'Gewerbekunde', emoji: '🏢' },
      { id: 'cust_company_car', label: 'Firmenwagen', emoji: '💼' },
      { id: 'cust_retired', label: 'Rentner', emoji: '🌿' },
      { id: 'cust_beginner', label: 'Fahranfänger', emoji: '🎓' },
      { id: 'cust_urgent', label: 'Sofortbedarf', emoji: '⚡' },
    ],
  },
  {
    id: 'charging',
    label: 'Zuhause',
    chips: [
      { id: 'cust_home_owner', label: 'Eigenheim', emoji: '🏠' },
      { id: 'cust_wallbox', label: 'Wallbox vorhanden', emoji: '🔌' },
      { id: 'cust_garage', label: 'Garage / Stellplatz', emoji: '🅿' },
    ],
  },
];

const ALL_SHOWROOM_CHIPS = [
  ...SHOWROOM_AUTO_GROUPS,
  ...SHOWROOM_PAYMENT_GROUPS,
  ...SHOWROOM_CUSTOMER_GROUPS,
].flatMap((group) => group.chips.map((chip) => ({ ...chip, groupId: group.id, area: group.id })));

const CHIP_MAP = new Map(ALL_SHOWROOM_CHIPS.map((chip) => [chip.id, chip]));

export function getShowroomChipById(chipId) {
  return CHIP_MAP.get(chipId) ?? null;
}

export function getShowroomChipLabels(chipIds = []) {
  return chipIds
    .map((id) => getShowroomChipById(id))
    .filter(Boolean)
    .map((chip) => chip.label);
}

export function getShowroomGroupsForTab(tabId) {
  if (tabId === 'auto') return SHOWROOM_AUTO_GROUPS;
  if (tabId === 'payment') return SHOWROOM_PAYMENT_GROUPS;
  if (tabId === 'customer') return SHOWROOM_CUSTOMER_GROUPS;
  return [];
}
