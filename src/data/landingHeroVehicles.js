/**
 * Hero-Bereich: drei Premium-Fahrzeugkarten (Kia Pressebilder)
 * Lokale Assets: public/images/manufacturers/kia/{model}/hero.jpg
 * Fallback: pressImageUrl bis JPGs hinterlegt sind
 */

/** @type {readonly { id: string, brand: string, model: string, trim: string, title: string, badge: string, badgeTone: string, profile: object, mockRate: string, mockDelivery: string, mockAvailability: { type: string, label: string }, imageKey: string, pressImageUrl: string, floatClass: string }[]} */
export const LANDING_HERO_VEHICLES = [
  {
    id: 'hero-sportage',
    brand: 'Kia',
    model: 'Sportage',
    trim: 'Spirit',
    title: 'Kia Sportage Spirit',
    badge: 'Hybrid',
    badgeTone: 'violet',
    profile: { bodyType: 'suv', fuelPreference: 'hybrid', desiredRate: 379, mileage: '10k-15k' },
    mockRate: '379 €',
    mockDelivery: '2–4 Wochen',
    mockAvailability: { type: 'lager', label: '🟢 Sofort verfügbar' },
    imageKey: 'sportage',
    pressImageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/2022_Kia_Sportage_GT-Line_HEV_AWD_Automatic_1.6_Front.jpg/1280px-2022_Kia_Sportage_GT-Line_HEV_AWD_Automatic_1.6_Front.jpg',
    floatClass: 'lp-hero-card--back-left',
  },
  {
    id: 'hero-ev3',
    brand: 'Kia',
    model: 'EV3',
    trim: 'GT-Line',
    title: 'Kia EV3 GT-Line',
    badge: 'Elektro',
    badgeTone: 'green',
    profile: { bodyType: 'suv', fuelPreference: 'elektro', desiredRate: 349, mileage: '15k-20k', wishes: ['reichweite'] },
    mockRate: '349 €',
    mockDelivery: '6–8 Wochen',
    mockAvailability: { type: 'vorlauf', label: '🟡 Verfügbar ab KW 32' },
    imageKey: 'ev3',
    pressImageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/2024_Kia_EV3_GT-Line_%28cropped%29.jpg/1280px-2024_Kia_EV3_GT-Line_%28cropped%29.jpg',
    floatClass: 'lp-hero-card--front',
  },
  {
    id: 'hero-ev4',
    brand: 'Kia',
    model: 'EV4',
    trim: 'Earth',
    title: 'Kia EV4 Earth',
    badge: 'Neu',
    badgeTone: 'blue',
    profile: { bodyType: 'limousine', fuelPreference: 'elektro', desiredRate: 309, mileage: '10k-15k' },
    mockRate: '309 €',
    mockDelivery: '8–10 Wochen',
    mockAvailability: { type: 'konfigurierbar', label: '⚪ Individuell bestellbar' },
    imageKey: 'ev4',
    pressImageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Kia_EV4_%28cropped%29.jpg/1280px-Kia_EV4_%28cropped%29.jpg',
    floatClass: 'lp-hero-card--back-right',
  },
];

export function getHeroVehicleLocalImage(imageKey) {
  return `/images/manufacturers/kia/${imageKey}/hero.jpg`;
}
