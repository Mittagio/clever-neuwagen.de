/**
 * Kanonische Suchbegriffe für Fuzzy-Matching & Tippfehlerkorrektur
 */

export const TYPO_REPLACEMENTS = [
  ['klleinwagen', 'kleinwagen'],
  ['kleinwagenn', 'kleinwagen'],
  ['sitzhiezug', 'sitzheizung'],
  ['sitzheizugn', 'sitzheizung'],
  ['sitzheizug', 'sitzheizung'],
  ['kamerea', 'kamera'],
  ['schalte', 'schaltgetriebe'],
  ['aautumatik', 'automatik'],
  ['automatikk', 'automatik'],
  ['automatikgetriebe', 'automatik'],
  ['sucheh', 'suche'],
  ['eien', 'ein'],
  ['ienen', 'einen'],
  ['einenen', 'einen'],
  ['unnd', 'und'],
  ['mittt', 'mit'],
  ['anhängerkupplunng', 'anhängerkupplung'],
  ['anhaengerkupplung', 'anhängerkupplung'],
  ['elektroauto', 'elektroauto'],
  ['stromer', 'elektroauto'],
  ['panoramadach', 'panoramadach'],
  ['waermepumpe', 'wärmepumpe'],
  ['totwinkel', 'totwinkel'],
  ['rundumsicht', 'rundumsicht'],
];

/** Einzelne Tokens → Ersetzungsphrase für Intent */
export const FUZZY_SEARCH_TERMS = [
  { id: 'heated_seats', term: 'sitzheizung', replace: 'sitzheizung', label: 'Sitzheizung' },
  { id: 'heated_seats', term: 'sitzheizungen', replace: 'sitzheizung', label: 'Sitzheizung' },
  { id: 'automatic', term: 'automatik', replace: 'automatik', label: 'Automatik' },
  { id: 'automatic', term: 'automatikgetriebe', replace: 'automatik', label: 'Automatik' },
  { id: 'body_kleinwagen', term: 'kleinwagen', replace: 'kleinwagen', label: 'Kleinwagen' },
  { id: 'body_kleinwagen', term: 'kleinwagen', replace: 'kleinwagen', label: 'Kleinwagen' },
  { id: 'body_kleinwagen', term: 'stadtflitzer', replace: 'kleinwagen', label: 'Kleinwagen' },
  { id: 'body_kleinwagen', term: 'city', replace: 'kleinwagen', label: 'Kleinwagen' },
  { id: 'body_suv', term: 'suv', replace: 'suv', label: 'SUV' },
  { id: 'body_kombi', term: 'kombi', replace: 'kombi', label: 'Kombi' },
  { id: 'towbar', term: 'anhängerkupplung', replace: 'anhängerkupplung', label: 'Anhängerkupplung' },
  { id: 'towbar', term: 'ahk', replace: 'anhängerkupplung', label: 'Anhängerkupplung' },
  { id: 'camera_360', term: 'rundumsicht', replace: '360 grad kamera', label: '360° Kamera' },
  { id: 'camera_360', term: '360', replace: '360 grad', label: '360° Kamera' },
  { id: 'blind_spot', term: 'totwinkel', replace: 'totwinkel', label: 'Totwinkelassistent' },
  { id: 'panorama_roof', term: 'panoramadach', replace: 'panoramadach', label: 'Panoramadach' },
  { id: 'heat_pump', term: 'wärmepumpe', replace: 'wärmepumpe', label: 'Wärmepumpe' },
  { id: 'heat_pump', term: 'waermepumpe', replace: 'wärmepumpe', label: 'Wärmepumpe' },
  { id: 'parking_front', term: 'parksensoren', replace: 'parksensoren', label: 'Parksensoren' },
  { id: 'rear_camera', term: 'rueckfahrkamera', replace: 'rückfahrkamera', label: 'Rückfahrkamera' },
  { id: 'rear_camera', term: 'rückfahrkamera', replace: 'rückfahrkamera', label: 'Rückfahrkamera' },
  { id: 'manual', term: 'schaltgetriebe', replace: 'schaltgetriebe', label: 'Schaltgetriebe' },
  { id: 'navigation', term: 'navi', replace: 'navi', label: 'Navigation' },
  { id: 'navigation', term: 'navigation', replace: 'navi', label: 'Navigation' },
];

export const POWER_PS_TOLERANCE = 15;
