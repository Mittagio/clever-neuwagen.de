/**
 * Zentraler Feature-Katalog (Kundenwünsche) – Sprint 23 erweitert
 * Hersteller-Equipment-IDs werden über featureBridge.js gemappt.
 */
export const FEATURE_CATALOG = [
  {
    id: 'camera_360',
    label: '360° Kamera',
    aliases: ['360 kamera', '360° kamera', 'rundumsichtkamera', 'surround view', '360-grad'],
    category: 'assistenz',
    customerBenefit: 'Bessere Übersicht beim Parken',
  },
  {
    id: 'parking_front',
    label: 'Parksensoren vorne',
    aliases: ['parksensor vorne', 'pdc vorne', 'parkpiepser vorne', 'parksensoren vorne'],
    category: 'assistenz',
  },
  {
    id: 'parking_rear',
    label: 'Parksensoren hinten',
    aliases: ['parksensor hinten', 'pdc hinten', 'rückfahrkamera'],
    category: 'assistenz',
  },
  {
    id: 'blind_spot',
    label: 'Totwinkelassistent',
    aliases: ['toter winkel', 'totwinkel', 'blind spot', 'bca', 'spurwechselassistent'],
    category: 'sicherheit',
  },
  {
    id: 'heated_seats',
    label: 'Sitzheizung',
    aliases: ['sitzheizung', 'sitzheizung vorne', 'warme sitze', 'sitzklima'],
    category: 'komfort',
  },
  {
    id: 'steering_heat',
    label: 'Lenkradheizung',
    aliases: ['lenkradheizung', 'beheiztes lenkrad', 'warmes lenkrad'],
    category: 'komfort',
  },
  {
    id: 'head_up_display',
    label: 'Head-Up Display',
    aliases: ['head-up', 'head up display', 'hud', 'projektionsdisplay'],
    category: 'komfort',
  },
  {
    id: 'harman_kardon',
    label: 'Harman Kardon',
    aliases: ['harman', 'harman/kardon', 'premium sound', 'soundsystem'],
    category: 'audio',
  },
  {
    id: 'towbar',
    label: 'Anhängerkupplung',
    aliases: ['ahk', 'anhänger', 'anhängerkupplung', 'kupplung', 'anhängelast'],
    category: 'zubehör',
  },
  {
    id: 'remote_parking',
    label: 'Remote Parken',
    aliases: ['remote park', 'fernparken', 'park assist remote'],
    category: 'assistenz',
  },
  {
    id: 'ventilated_seats',
    label: 'Belüftete Sitze',
    aliases: ['sitzbelüftung', 'sitzventilation', 'kühlsitze', 'relaxsitze'],
    category: 'komfort',
  },
  {
    id: 'panorama_roof',
    label: 'Panoramadach',
    aliases: ['panorama', 'panoramadach', 'schiebedach', 'glass roof'],
    category: 'komfort',
  },
  {
    id: 'power_tailgate',
    label: 'Elektrische Heckklappe',
    aliases: ['elektrische heckklappe', 'elektr. heckklappe', 'power tailgate'],
    category: 'komfort',
  },
  {
    id: 'tow_capacity_2000',
    label: 'mind. 2 Tonnen Anhängelast',
    aliases: ['2 tonnen anhängelast', '2000 kg ziehen', '2 t anhängelast'],
    category: 'technik',
  },
  {
    id: 'heat_pump',
    label: 'Wärmepumpe',
    aliases: ['wärmepumpe', 'waermepumpe', 'heat pump'],
    category: 'technik',
  },
  {
    id: 'automatic',
    label: 'Automatik',
    aliases: ['automatik', 'automatikgetriebe', 'dsg'],
    category: 'technik',
  },
  {
    id: 'large_trunk',
    label: 'großer Kofferraum',
    aliases: ['großer kofferraum', 'viel platz', 'kofferraum', 'familienauto'],
    category: 'praktisch',
  },
  {
    id: 'elektro',
    label: 'Elektro',
    aliases: ['elektro', 'elektroauto', 'ev', 'stromer'],
    category: 'antrieb',
  },
  {
    id: 'benzin',
    label: 'Benziner',
    aliases: ['benzin', 'benziner', 'verbrenner'],
    category: 'antrieb',
  },
  {
    id: 'family_suv',
    label: 'SUV / Familiengeeignet',
    aliases: ['familien-suv', 'familien suv', 'familienauto', 'suv'],
    category: 'nutzung',
  },
];

export const CONFIGURATOR_FEATURE_IDS = [
  'heat_pump',
  'blind_spot',
  'camera_360',
  'harman_kardon',
  'panorama_roof',
  'towbar',
  'head_up_display',
  'heated_seats',
  'steering_heat',
  'remote_parking',
  'ventilated_seats',
  'power_tailgate',
];

export function getFeatureById(id) {
  return FEATURE_CATALOG.find((f) => f.id === id) ?? null;
}

export function getFeatureLabel(id) {
  return getFeatureById(id)?.label ?? id;
}
