/**
 * Kundenwünsche → Sportage-Daten
 * Freundliche Labels, keine Werkscodes (P4, P5 …)
 */

export const CUSTOMER_WISHES = [
  { id: 'camera360', label: '360° Kamera', emoji: '🔄' },
  { id: 'seatVent', label: 'Sitzbelüftung', emoji: '💨' },
  { id: 'glassRoof', label: 'Glasdach', emoji: '☀️' },
  { id: 'hud', label: 'Projektion ins Sichtfeld', emoji: '👁️' },
  { id: 'premiumSound', label: 'Harman Kardon', emoji: '🔊' },
];

/**
 * Verfügbarkeit je Wunsch
 * standardTrims: ab Werk enthalten
 * packageByTrim: Paket-ID aus sportage.packages, null = nicht verfügbar
 */
export const WISH_AVAILABILITY = {
  camera360: {
    standardTrims: ['gt-line', 'black-edition'],
    packageByTrim: { core: null, vision: null, spirit: null, 'black-edition': null, 'gt-line': null },
  },
  seatVent: {
    standardTrims: ['gt-line'],
    packageByTrim: { core: null, vision: null, spirit: null, 'black-edition': null, 'gt-line': null },
  },
  glassRoof: {
    standardTrims: ['black-edition'],
    packageByTrim: { core: null, vision: 'p4-panorama', spirit: 'p4-panorama', 'black-edition': null, 'gt-line': null },
  },
  hud: {
    standardTrims: ['gt-line'],
    packageByTrim: { core: null, vision: null, spirit: null, 'black-edition': null, 'gt-line': null },
  },
  premiumSound: {
    standardTrims: ['gt-line', 'black-edition'],
    packageByTrim: { core: null, vision: 'p3-sound', spirit: 'p3-sound', 'black-edition': null, 'gt-line': null },
  },
};

export const PACKAGE_FRIENDLY_NAMES = {
  'p1-comfort': 'Komfort-Paket',
  'p2-leather': 'Leder-Paket',
  'p3-sound': 'Sound-Paket',
  'p4-panorama': 'Panorama-Glasschiebedach',
  'p5-drivewise': 'DriveWise-Paket',
  'p6-drivewise-be': 'DriveWise Black Edition',
  winter: 'Winterpaket',
  assist: 'Assistenz beim Fahren',
  comfort: 'Panorama-Glasdach',
  tech: 'Erweiterte Assistenz',
};
