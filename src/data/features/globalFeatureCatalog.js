/**
 * Layer 1: Globaler Feature-Katalog (markenübergreifend).
 * Beschreibt WAS ein Feature ist – nicht ob es bei einem Modell verfügbar ist.
 */

/** @typedef {'high' | 'medium' | 'low'} FeatureConfidence */

/**
 * @typedef {object} GlobalFeature
 * @property {string} id
 * @property {string} label
 * @property {string} category
 * @property {string[]} synonyms
 * @property {string[]} tags
 * @property {boolean} showAsChip
 * @property {boolean} searchable
 * @property {boolean} advisorRelevant
 * @property {FeatureConfidence} confidence
 * @property {string | null} legacyFeatureId – Mapping auf featureCatalog.js / Trim-Daten
 */

/**
 * @param {string} id
 * @param {string} label
 * @param {string} category
 * @param {string[]} synonyms
 * @param {string[]} tags
 * @param {object} [opts]
 * @param {boolean} [opts.showAsChip]
 * @param {boolean} [opts.searchable]
 * @param {boolean} [opts.advisorRelevant]
 * @param {FeatureConfidence} [opts.confidence]
 * @param {string | null} [opts.legacyFeatureId]
 * @returns {GlobalFeature}
 */
function feature(id, label, category, synonyms, tags, opts = {}) {
  return {
    id,
    label,
    category,
    synonyms,
    tags,
    showAsChip: opts.showAsChip ?? false,
    searchable: opts.searchable ?? true,
    advisorRelevant: opts.advisorRelevant ?? true,
    confidence: opts.confidence ?? 'medium',
    legacyFeatureId: opts.legacyFeatureId ?? null,
  };
}

const SITZE_KOMFORT = [
  feature('sitzheizung_vorne', 'Sitzheizung vorne', 'Sitze & Komfort', [
    'sitzheizung vorne', 'sitzheizung vorn', 'beheizbare vordersitze', 'beheizbare sitze vorne',
    'warme sitze vorne', 'warme vordersitze', 'sitzheizung fahrer', 'sitzheizung beifahrer',
    'heated front seats', 'hat er sitzheizung', 'gibt es sitzheizung', 'sitzheizung',
  ], ['komfort', 'sitze', 'winter'], { showAsChip: true, confidence: 'high', legacyFeatureId: 'heated_seats' }),
  feature('sitzheizung_hinten', 'Sitzheizung hinten', 'Sitze & Komfort', [
    'sitzheizung hinten', 'sitzheizung fond', 'beheizbare rücksitze', 'beheizbare fondsitze',
    'beheizbare äußere fondsitze', 'rücksitzheizung', 'sitzheizung zweite reihe',
    'sitzheizung 2. reihe', 'fond-sitzheizung', 'warme rücksitze', 'sitzheizung im fond',
  ], ['komfort', 'sitze', 'winter', 'familie'], { showAsChip: true, confidence: 'high', legacyFeatureId: 'heated_rear_seats' }),
  feature('lenkradheizung', 'Lenkradheizung', 'Sitze & Komfort', [
    'lenkradheizung', 'beheiztes lenkrad', 'warmes lenkrad', 'lenkrad beheizbar',
    'heated steering wheel', 'ist das lenkrad beheizbar',
  ], ['komfort', 'winter'], { showAsChip: true, confidence: 'high', legacyFeatureId: 'steering_heat' }),
  feature('elektrische_sitzverstellung_fahrer', 'Elektrisch verstellbarer Fahrersitz', 'Sitze & Komfort', [
    'fahrersitz elektrisch', 'elektrischer fahrersitz', 'fahrersitz elektrisch verstellbar',
    'elektrisch verstellbarer fahrersitz', 'elektrische sitzverstellung fahrer',
    'sitz fahrer elektrisch', 'fahrerseite elektrisch verstellbar',
    '4-fach elektrisch verstellbarer fahrersitz', '6-fach elektrisch verstellbarer fahrersitz',
    '8-fach elektrisch verstellbarer fahrersitz',
  ], ['komfort', 'sitze', 'premium'], { confidence: 'medium' }),
  feature('elektrische_sitzverstellung_beifahrer', 'Elektrisch verstellbarer Beifahrersitz', 'Sitze & Komfort', [
    'beifahrersitz elektrisch', 'elektrischer beifahrersitz', 'beifahrersitz elektrisch verstellbar',
    'elektrisch verstellbarer beifahrersitz', 'elektrische sitzverstellung beifahrer',
    'sitz beifahrer elektrisch', 'beifahrerseite elektrisch verstellbar',
    '4-fach elektrisch verstellbarer beifahrersitz', '6-fach elektrisch verstellbarer beifahrersitz',
    '8-fach elektrisch verstellbarer beifahrersitz', 'hat der beifahrersitz elektrische verstellung',
  ], ['komfort', 'sitze', 'premium'], { confidence: 'medium' }),
  feature('memory_fahrersitz', 'Memory-Funktion Fahrersitz', 'Sitze & Komfort', [
    'memory fahrersitz', 'memory-funktion fahrersitz', 'fahrersitz memory', 'sitzspeicher fahrer',
    'speicherfunktion fahrersitz', 'fahrersitz mit memory',
  ], ['komfort', 'sitze', 'premium'], { confidence: 'low' }),
  feature('memory_beifahrersitz', 'Memory-Funktion Beifahrersitz', 'Sitze & Komfort', [
    'memory beifahrersitz', 'memory-funktion beifahrersitz', 'beifahrersitz memory',
    'sitzspeicher beifahrer', 'speicherfunktion beifahrersitz',
  ], ['komfort', 'sitze', 'premium'], { confidence: 'low' }),
  feature('sitzbelueftung_vorne', 'Sitzbelüftung vorne', 'Sitze & Komfort', [
    'sitzbelüftung vorne', 'belüftete sitze vorne', 'sitzbelüftung vorn', 'kühlsitze vorne',
    'ventilierte vordersitze', 'sitzventilation vorne', 'belüftete vordersitze',
  ], ['komfort', 'sitze', 'premium', 'sommer'], { showAsChip: true, confidence: 'high', legacyFeatureId: 'ventilated_seats' }),
  feature('sitzbelueftung_hinten', 'Sitzbelüftung hinten', 'Sitze & Komfort', [
    'sitzbelüftung hinten', 'belüftete rücksitze', 'sitzbelüftung fond', 'kühlsitze hinten',
    'ventilierte fondsitze',
  ], ['komfort', 'sitze', 'premium', 'sommer'], { confidence: 'medium' }),
  feature('massagefunktion', 'Massagefunktion', 'Sitze & Komfort', [
    'massagefunktion', 'massagesitze', 'massage sitze', 'sitzmassage', 'massage im sitz',
    'entspannungsprogramm sitz',
  ], ['komfort', 'sitze', 'premium'], { confidence: 'medium' }),
  feature('lordosenstuetze', 'Lordosenstütze', 'Sitze & Komfort', [
    'lordosenstütze', 'lordose', 'lendenwirbelstütze', 'einstellbare lordose', 'lumbar support',
  ], ['komfort', 'sitze'], { confidence: 'medium' }),
  feature('relax_sitz', 'Relax-Sitz / Komfortsitz', 'Sitze & Komfort', [
    'relax sitz', 'relax-sitz', 'komfortsitz', 'entspannungssitz', 'business class sitz',
    'zero gravity sitz',
  ], ['komfort', 'sitze', 'premium'], { confidence: 'low' }),
  feature('isofix', 'Isofix', 'Sitze & Komfort', [
    'isofix', 'isofix halterungen', 'kindersitz befestigung', 'isofix punkte',
    'isofix kindersitz',
  ], ['familie', 'sicherheit'], { advisorRelevant: false, confidence: 'high' }),
];

const KLIMA = [
  feature('klimaautomatik', 'Klimaautomatik', 'Klima & Komfort', [
    'klimaautomatik', 'klima automatik', 'automatische klimaanlage', 'klimaanlage automatisch',
    'air condition automatisch',
  ], ['komfort', 'klima'], { showAsChip: true, confidence: 'high' }),
  feature('mehrzonen_klima', '2-/3-Zonen-Klimaautomatik', 'Klima & Komfort', [
    'mehrzonen klima', '2 zonen klima', '3 zonen klima', 'zweizonen klima', 'dreizonen klima',
    'klima 2 zonen', 'klima 3 zonen', 'dual zone klima',
  ], ['komfort', 'klima', 'premium'], { confidence: 'medium' }),
  feature('waermepumpe', 'Wärmepumpe', 'Klima & Komfort', [
    'wärmepumpe', 'waermepumpe', 'heat pump', 'wärmepumpe im auto', 'effiziente heizung ev',
  ], ['elektro', 'klima', 'winter'], { showAsChip: true, confidence: 'high', legacyFeatureId: 'heat_pump' }),
  feature('vorklimatisierung', 'Vorklimatisierung', 'Klima & Komfort', [
    'vorklimatisierung', 'vor klimatisierung', 'standklima', 'auto vor kühlen', 'auto vorheizen per app',
    'fernvorklimatisierung', 'pre conditioning',
  ], ['elektro', 'komfort', 'klima'], { confidence: 'medium' }),
  feature('standheizung', 'Standheizung', 'Klima & Komfort', [
    'standheizung', 'zuheizer', 'parking heater', 'webasto', 'vorheizen ohne motor',
  ], ['komfort', 'winter'], { confidence: 'medium' }),
  feature('beheizbare_frontscheibe', 'Beheizbare Frontscheibe', 'Klima & Komfort', [
    'beheizbare frontscheibe', 'beheizte windschildscheibe', 'heated windshield',
    'scheibenheizung vorne', 'windschutzscheibe beheizbar', 'enteisung scheibe elektrisch',
  ], ['komfort', 'winter'], { confidence: 'low' }),
  feature('beheizbare_aussenspiegel', 'Beheizbare Außenspiegel', 'Klima & Komfort', [
    'beheizbare außenspiegel', 'beheizte spiegel', 'spiegelheizung', 'heated mirrors',
  ], ['komfort', 'winter'], { advisorRelevant: false, confidence: 'medium' }),
];

const PARKEN_KAMERA = [
  feature('rueckfahrkamera', 'Rückfahrkamera', 'Parken & Kamera', [
    'rückfahrkamera', 'rückkamera', 'heckkamera', 'kamera hinten', 'rear camera', 'reverse camera',
  ], ['parken', 'assistenz'], { showAsChip: true, confidence: 'high', legacyFeatureId: 'rear_camera' }),
  feature('surround_view_camera', '360° Kamera', 'Parken & Kamera', [
    '360 kamera', '360° kamera', '360 grad kamera', 'rundumsichtkamera', 'rundumsicht',
    'surround view monitor', 'around view monitor', 'bird view', 'kamera rundum', 'rundumkamera',
    'surround view', '360-grad-kamera',
  ], ['parken', 'assistenz'], { showAsChip: true, confidence: 'high', legacyFeatureId: 'camera_360' }),
  feature('parksensoren_vorne', 'Parksensoren vorne', 'Parken & Kamera', [
    'parksensoren vorne', 'parksensor vorne', 'pdc vorne', 'parkpiepser vorne', 'einparkhilfe vorne',
  ], ['parken', 'assistenz'], { confidence: 'high', legacyFeatureId: 'parking_front' }),
  feature('parksensoren_hinten', 'Parksensoren hinten', 'Parken & Kamera', [
    'parksensoren hinten', 'parksensor hinten', 'pdc hinten', 'parkpiepser hinten', 'einparkhilfe hinten',
  ], ['parken', 'assistenz'], { confidence: 'high', legacyFeatureId: 'parking_rear' }),
  feature('parkassistent', 'Parkassistent', 'Parken & Kamera', [
    'parkassistent', 'einparkassistent', 'park assist', 'parking assist', 'einparkhilfe automatisch',
    'selbst einparken',
  ], ['parken', 'assistenz'], { confidence: 'medium' }),
  feature('remote_parking', 'Ferngesteuertes Parken', 'Parken & Kamera', [
    'ferngesteuertes parken', 'remote park', 'remote parking', 'fernparken', 'park assist remote',
    'auto per app einparken',
  ], ['parken', 'assistenz', 'premium'], { confidence: 'medium', legacyFeatureId: 'remote_parking' }),
  feature('ausparkassistent', 'Ausparkassistent', 'Parken & Kamera', [
    'ausparkassistent', 'ausparkhilfe', 'rear cross traffic', 'ausparken assistent',
  ], ['parken', 'assistenz'], { confidence: 'medium' }),
  feature('querverkehrswarner', 'Querverkehrswarner', 'Parken & Kamera', [
    'querverkehrswarner', 'rear cross traffic alert', 'rcta', 'querverkehr hinten',
    'warnt vor querenden fahrzeugen',
  ], ['parken', 'sicherheit'], { confidence: 'medium' }),
];

const KOMFORT_ZUGANG = [
  feature('elektrische_heckklappe', 'Elektrische Heckklappe', 'Komfort & Zugang', [
    'elektrische heckklappe', 'elektr. heckklappe', 'power tailgate', 'automatische heckklappe',
    'elektrisch öffnende heckklappe',
  ], ['komfort', 'alltag'], { showAsChip: true, confidence: 'high', legacyFeatureId: 'power_tailgate' }),
  feature('sensorgesteuerte_heckklappe', 'Sensor-/Smart-Heckklappe', 'Komfort & Zugang', [
    'sensorgesteuerte heckklappe', 'smart heckklappe', 'fußgeste heckklappe', 'kick sensor heckklappe',
    'handsfree heckklappe', 'virtuelle pedal heckklappe',
  ], ['komfort', 'alltag', 'premium'], { confidence: 'medium' }),
  feature('keyless_entry', 'Keyless Entry', 'Komfort & Zugang', [
    'keyless entry', 'schlüsselloser zugang', 'tür ohne schlüssel öffnen', 'comfort access',
  ], ['komfort', 'alltag'], { confidence: 'high' }),
  feature('keyless_go', 'Keyless Go', 'Komfort & Zugang', [
    'keyless go', 'keyless start', 'start ohne schlüssel stecken', 'schlüsselloses starten',
  ], ['komfort', 'alltag'], { confidence: 'high' }),
  feature('automatische_heckklappe', 'Automatische Heckklappe', 'Komfort & Zugang', [
    'automatische heckklappe', 'heckklappe automatisch', 'auto heckklappe',
  ], ['komfort', 'alltag'], { confidence: 'medium', legacyFeatureId: 'power_tailgate' }),
];

const DIGITAL_INFOTAINMENT = [
  feature('navigation', 'Navigation', 'Digital & Infotainment', [
    'navigation', 'navi', 'navigationssystem', 'fest eingebaute navigation', 'built in navi',
  ], ['digital', 'komfort'], { showAsChip: true, confidence: 'high', legacyFeatureId: 'navigation' }),
  feature('apple_carplay', 'Apple CarPlay', 'Digital & Infotainment', [
    'apple carplay', 'carplay', 'car play', 'iphone im auto', 'apple im auto',
  ], ['digital', 'connect'], { confidence: 'high' }),
  feature('wireless_apple_carplay', 'Kabelloses Apple CarPlay', 'Digital & Infotainment', [
    'kabelloses apple carplay', 'apple carplay kabellos', 'wireless carplay', 'carplay ohne kabel',
    'drahtloses carplay',
  ], ['digital', 'connect'], { confidence: 'high' }),
  feature('android_auto', 'Android Auto', 'Digital & Infotainment', [
    'android auto', 'google android auto', 'smartphone integration android',
  ], ['digital', 'connect'], { confidence: 'high' }),
  feature('wireless_android_auto', 'Kabelloses Android Auto', 'Digital & Infotainment', [
    'kabelloses android auto', 'android auto kabellos', 'wireless android auto',
    'android auto ohne kabel', 'drahtloses android auto',
  ], ['digital', 'connect'], { confidence: 'high' }),
  feature('digital_key', 'Digital Key', 'Digital & Infotainment', [
    'digital key', 'digitaler schlüssel', 'handy als schlüssel', 'smartphone key', 'nfc schlüssel',
  ], ['digital', 'connect'], { confidence: 'medium' }),
  feature('online_dienste', 'Online-Dienste', 'Digital & Infotainment', [
    'online dienste', 'connected services', 'vernetzte dienste', 'online services', 'lte im auto',
  ], ['digital', 'connect'], { confidence: 'medium' }),
  feature('over_the_air_updates', 'Over-the-Air Updates', 'Digital & Infotainment', [
    'over the air updates', 'ota updates', 'ota update', 'software update over the air',
    'fernaktualisierung',
  ], ['digital', 'technik'], { advisorRelevant: false, confidence: 'medium' }),
  feature('grosses_display', 'Großes Display', 'Digital & Infotainment', [
    'großes display', 'grosses display', 'großer bildschirm', 'großes infotainment display',
    '12 zoll display', '12,3 zoll display', 'widescreen display',
  ], ['digital', 'komfort'], { confidence: 'medium' }),
  feature('digital_cockpit', 'Digitales Cockpit', 'Digital & Infotainment', [
    'digitales cockpit', 'digital cockpit', 'virtuelles cockpit', 'voll digital instrumente',
    'digital instrument cluster',
  ], ['digital', 'komfort'], { confidence: 'medium' }),
  feature('head_up_display', 'Head-up-Display', 'Digital & Infotainment', [
    'head-up display', 'head up display', 'headup display', 'head-up', 'head up', 'hud',
    'anzeige in der frontscheibe', 'projektion in der frontscheibe', 'projektion windschildscheibe',
    'tacho in der scheibe', 'geschwindigkeit in der frontscheibe', 'display in der scheibe',
  ], ['digital', 'komfort', 'premium'], { showAsChip: true, confidence: 'high', legacyFeatureId: 'head_up_display' }),
  feature('soundsystem', 'Soundsystem', 'Digital & Infotainment', [
    'soundsystem', 'premium sound', 'bose', 'harman kardon', 'bang olufsen', 'burmester',
    'hochwertiges soundsystem', 'premium audio',
  ], ['digital', 'audio', 'premium'], { showAsChip: true, confidence: 'medium', legacyFeatureId: 'harman_kardon' }),
  feature('induktives_laden', 'Induktives Laden', 'Digital & Infotainment', [
    'induktives laden', 'wireless charging', 'handy laden induktiv', 'qi laden', 'ladepad handy',
  ], ['digital', 'komfort'], { confidence: 'medium' }),
  feature('usb_c_hinten', 'USB-C-Anschlüsse hinten', 'Digital & Infotainment', [
    'usb c hinten', 'usb-c hinten', 'usb anschlüsse hinten', 'laden hinten usb',
  ], ['digital', 'familie'], { advisorRelevant: false, confidence: 'low' }),
  feature('steckdose_230v', '230V-Steckdose', 'Digital & Infotainment', [
    '230v steckdose', 'steckdose 230 volt', 'haushaltssteckdose im auto', '230v anschluss',
  ], ['digital', 'alltag'], { confidence: 'medium' }),
  feature('app_steuerung', 'App-Steuerung', 'Digital & Infotainment', [
    'app steuerung', 'fernsteuerung per app', 'handy app auto', 'connected app', 'mykia app',
    'fahrzeug per app steuern',
  ], ['digital', 'connect'], { confidence: 'medium' }),
  feature('sprachsteuerung', 'Sprachsteuerung', 'Digital & Infotainment', [
    'sprachsteuerung', 'sprachassistent', 'voice control', 'per sprache bedienen',
  ], ['digital', 'komfort'], { confidence: 'medium' }),
];

const ASSISTENZ = [
  feature('totwinkelassistent', 'Totwinkelassistent', 'Assistenz & Sicherheit', [
    'totwinkelassistent', 'toter winkel', 'totwinkel', 'blind spot', 'bca', 'spurwechselassistent',
    'blind spot assist',
  ], ['assistenz', 'sicherheit'], { showAsChip: true, confidence: 'high', legacyFeatureId: 'blind_spot' }),
  feature('abstandstempomat', 'Abstandstempomat', 'Assistenz & Sicherheit', [
    'abstandstempomat', 'acc', 'adaptive cruise control', 'tempomat mit abstand',
  ], ['assistenz', 'sicherheit'], { confidence: 'high' }),
  feature('adaptiver_tempomat', 'Adaptiver Tempomat', 'Assistenz & Sicherheit', [
    'adaptiver tempomat', 'adaptives cruise control', 'intelligenter tempomat', 'smart cruise control',
  ], ['assistenz', 'sicherheit'], { confidence: 'high' }),
  feature('spurhalteassistent', 'Spurhalteassistent', 'Assistenz & Sicherheit', [
    'spurhalteassistent', 'spurhalte assistent', 'lane keep assist', 'lda', 'spur halten',
  ], ['assistenz', 'sicherheit'], { confidence: 'high' }),
  feature('spurfolgeassistent', 'Spurfolgeassistent', 'Assistenz & Sicherheit', [
    'spurfolgeassistent', 'lane follow assist', 'spur zentrieren', 'mittig in der spur bleiben',
  ], ['assistenz', 'sicherheit'], { confidence: 'medium' }),
  feature('autobahnassistent', 'Autobahnassistent', 'Assistenz & Sicherheit', [
    'autobahnassistent', 'highway assist', 'highway driving assist', 'hda', 'level 2 assistenz',
  ], ['assistenz', 'sicherheit', 'premium'], { confidence: 'medium' }),
  feature('verkehrszeichenerkennung', 'Verkehrszeichenerkennung', 'Assistenz & Sicherheit', [
    'verkehrszeichenerkennung', 'tsr', 'traffic sign recognition', 'geschwindigkeitszeichen erkennung',
  ], ['assistenz', 'sicherheit'], { confidence: 'medium' }),
  feature('notbremsassistent', 'Notbremsassistent', 'Assistenz & Sicherheit', [
    'notbremsassistent', 'automatische notbremsung', 'aeb', 'emergency braking', 'front assist',
  ], ['assistenz', 'sicherheit'], { confidence: 'high' }),
  feature('frontkollisionswarner', 'Frontkollisionswarner', 'Assistenz & Sicherheit', [
    'frontkollisionswarner', 'kollisionswarnung vorne', 'forward collision warning', 'fcw',
  ], ['assistenz', 'sicherheit'], { confidence: 'medium' }),
  feature('muedigkeitswarner', 'Müdigkeitswarner', 'Assistenz & Sicherheit', [
    'müdigkeitswarner', 'muedigkeitswarner', 'driver attention warning', 'schläfrigkeitswarner',
  ], ['assistenz', 'sicherheit'], { advisorRelevant: false, confidence: 'medium' }),
  feature('ausstiegswarner', 'Ausstiegswarner', 'Assistenz & Sicherheit', [
    'ausstiegswarner', 'safe exit assist', 'tür öffnen warnung', 'aussteigen warnung',
  ], ['assistenz', 'sicherheit'], { confidence: 'low' }),
  feature('tuer_oeffnungswarner', 'Türöffnungswarner', 'Assistenz & Sicherheit', [
    'türöffnungswarner', 'door open warning', 'tür warnung beim öffnen',
  ], ['assistenz', 'sicherheit'], { confidence: 'low' }),
  feature('fernlichtassistent', 'Fernlichtassistent', 'Assistenz & Sicherheit', [
    'fernlichtassistent', 'automatic high beam', 'fernlicht automatisch', 'hba',
  ], ['assistenz', 'licht'], { confidence: 'medium' }),
];

const LICHT_DESIGN = [
  feature('led_scheinwerfer', 'LED-Scheinwerfer', 'Licht & Design', [
    'led', 'led licht', 'led scheinwerfer', 'led-scheinwerfer', 'led frontscheinwerfer',
    'voll led', 'voll-led', 'led vorne', 'led headlights',
  ], ['licht', 'design'], { confidence: 'high' }),
  feature('matrix_led', 'Matrix LED', 'Licht & Design', [
    'matrix led', 'matrix-led', 'led matrix', 'matrixlicht', 'matrix scheinwerfer',
    'adaptive led', 'adaptives led', 'adaptive scheinwerfer', 'blendfreies fernlicht',
    'intelligentes fernlicht',
  ], ['licht', 'design', 'premium'], { confidence: 'high' }),
  feature('led_rueckleuchten', 'LED-Rückleuchten', 'Licht & Design', [
    'led rückleuchten', 'led rueckleuchten', 'led heckleuchten', 'led hinten',
  ], ['licht', 'design'], { advisorRelevant: false, confidence: 'medium' }),
  feature('tagfahrlicht_led', 'LED-Tagfahrlicht', 'Licht & Design', [
    'led tagfahrlicht', 'tagfahrlicht led', 'led drl',
  ], ['licht', 'design'], { advisorRelevant: false, confidence: 'low' }),
  feature('adaptives_licht', 'Adaptives Licht', 'Licht & Design', [
    'adaptives licht', 'kurvenlicht', 'adaptive front lighting', 'schwunglicht',
  ], ['licht', 'design'], { confidence: 'medium' }),
  feature('ambientebeleuchtung', 'Ambientebeleuchtung', 'Licht & Design', [
    'ambientebeleuchtung', 'ambiente licht', 'stimmungslicht', 'interieurbeleuchtung',
    'ambient lighting', 'innenraum beleuchtung',
  ], ['licht', 'design', 'premium'], { confidence: 'medium' }),
];

const KAROSSERIE = [
  feature('panoramadach', 'Panoramadach', 'Karosserie & Design', [
    'panoramadach', 'panorama dach', 'glass roof', 'schiebe panorama dach',
  ], ['design', 'komfort'], { showAsChip: true, confidence: 'high', legacyFeatureId: 'panorama_roof' }),
  feature('schiebedach', 'Schiebedach', 'Karosserie & Design', [
    'schiebedach', 'schiebe hebedach', 'sunroof', 'glasschiebedach',
  ], ['design', 'komfort'], { confidence: 'medium' }),
  feature('grosse_felgen', 'Große Felgen', 'Karosserie & Design', [
    'große felgen', 'grosse felgen', '19 zoll felgen', '20 zoll felgen', 'große räder',
    'sportfelgen groß',
  ], ['design'], { advisorRelevant: false, confidence: 'low' }),
  feature('sportliche_optik', 'Sportliche Optik', 'Karosserie & Design', [
    'sportliche optik', 'sportpaket optik', 'sport line', 'sportliches design',
  ], ['design'], { advisorRelevant: false, confidence: 'low' }),
  feature('getoente_scheiben', 'Getönte Scheiben', 'Karosserie & Design', [
    'getönte scheiben', 'privacy glass', 'abgedunkelte scheiben', 'hinten abgedunkelt',
  ], ['design'], { advisorRelevant: false, confidence: 'low' }),
  feature('dachreling', 'Dachreling', 'Karosserie & Design', [
    'dachreling', 'dach reling', 'roof rails', 'dachträger vorbereitung',
  ], ['alltag', 'familie'], { advisorRelevant: false, confidence: 'medium' }),
  feature('zweifarblackierung', 'Zweifarblackierung', 'Karosserie & Design', [
    'zweifarblackierung', 'two tone', 'zweifarben lack', 'kontrast dach',
  ], ['design'], { advisorRelevant: false, confidence: 'low' }),
  feature('hochwertige_innenausstattung', 'Hochwertiger Innenraum', 'Karosserie & Design', [
    'hochwertiger innenraum', 'hochwertige innenausstattung', 'premium innenraum',
    'edle materialien innen',
  ], ['design', 'premium'], { advisorRelevant: false, confidence: 'low' }),
  feature('lederoptik', 'Lederoptik / Kunstleder', 'Karosserie & Design', [
    'lederoptik', 'kunstleder', 'lederimitat', 'sensatec', 'kunstledersitze',
  ], ['design', 'sitze'], { advisorRelevant: false, confidence: 'medium' }),
  feature('stoff_sitze', 'Stoffsitze', 'Karosserie & Design', [
    'stoffsitze', 'stoff sitze', 'stoffpolster', 'stoffausstattung',
  ], ['design', 'sitze'], { advisorRelevant: false, confidence: 'low' }),
  feature('alu_pedale', 'Aluminium-Pedale', 'Karosserie & Design', [
    'aluminium pedal', 'alu pedal', 'sportpedale aluminium',
  ], ['design', 'sport'], { advisorRelevant: false, confidence: 'low' }),
];

const ANTRIEB_NUTZEN = [
  feature('anhaengerkupplung', 'Anhängerkupplung', 'Antrieb & Nutzen', [
    'anhängerkupplung', 'ahk', 'anhänger kupplung', 'kupplungskugel', 'towbar', 'trailer hitch',
  ], ['alltag', 'nutzen'], { showAsChip: true, confidence: 'high', legacyFeatureId: 'towbar' }),
  feature('anhaengelast', 'Anhängelast', 'Antrieb & Nutzen', [
    'anhängelast', 'ziehen 2 tonnen', '2000 kg anhängelast', '2 tonnen ziehen', 'trailer load',
    'hohe anhängelast',
  ], ['alltag', 'nutzen'], { confidence: 'medium', legacyFeatureId: 'tow_capacity_2000' }),
  feature('allrad', 'Allradantrieb', 'Antrieb & Nutzen', [
    'allrad', 'allradantrieb', 'awd', '4wd', '4x4', 'vierradantrieb',
  ], ['antrieb'], { confidence: 'high' }),
  feature('frontantrieb', 'Frontantrieb', 'Antrieb & Nutzen', [
    'frontantrieb', 'vorderradantrieb', 'fwd',
  ], ['antrieb'], { advisorRelevant: false, confidence: 'medium' }),
  feature('heckantrieb', 'Heckantrieb', 'Antrieb & Nutzen', [
    'heckantrieb', 'hinterradantrieb', 'rwd',
  ], ['antrieb'], { advisorRelevant: false, confidence: 'medium' }),
  feature('umklappbare_ruecksitzbank', 'Umklappbare Rücksitzbank', 'Antrieb & Nutzen', [
    'umklappbare rücksitzbank', 'rücksitz umklappbar', 'geteilte rücksitzlehne', '40 20 40',
  ], ['alltag', 'familie'], { advisorRelevant: false, confidence: 'medium' }),
  feature('verschiebbare_ruecksitzbank', 'Verschiebbare Rücksitzbank', 'Antrieb & Nutzen', [
    'verschiebbare rücksitzbank', 'rücksitz verschiebbar', 'längs verschiebbare rücksitze',
  ], ['alltag', 'familie'], { confidence: 'low' }),
  feature('ebener_ladeboden', 'Ebener Ladeboden', 'Antrieb & Nutzen', [
    'ebener ladeboden', 'flacher ladeboden', 'ladeboden ebenerdig',
  ], ['alltag', 'praktisch'], { advisorRelevant: false, confidence: 'low' }),
  feature('frunk', 'Frunk / vorderer Kofferraum', 'Antrieb & Nutzen', [
    'frunk', 'front trunk', 'vorderer kofferraum', 'kofferraum vorne', 'motorhaube stauraum',
  ], ['elektro', 'praktisch'], { confidence: 'medium' }),
];

const ELEKTRO_LADEN = [
  feature('schnellladen', 'Schnellladen', 'Elektro & Laden', [
    'schnellladen', 'dc schnellladen', 'fast charging', 'schnelllader', 'ccs schnellladen',
  ], ['elektro', 'laden'], { confidence: 'high' }),
  feature('ladeleistung_dc', 'DC-Ladeleistung', 'Elektro & Laden', [
    'dc ladeleistung', 'schnellladeleistung', 'kw schnellladen', '100 kw laden', '150 kw laden',
    '200 kw laden',
  ], ['elektro', 'laden', 'technik'], { advisorRelevant: false, confidence: 'medium' }),
  feature('ladeleistung_ac', 'AC-Ladeleistung', 'Elektro & Laden', [
    'ac ladeleistung', 'wallbox leistung', '11 kw laden', '22 kw laden', 'laden zuhause',
  ], ['elektro', 'laden'], { advisorRelevant: false, confidence: 'medium' }),
  feature('batterie_vorkonditionierung', 'Batterie-Vorkonditionierung', 'Elektro & Laden', [
    'batterie vorkonditionierung', 'battery preconditioning', 'akku vorkonditionierung',
    'schnellladen vorbereitung',
  ], ['elektro', 'laden'], { confidence: 'medium' }),
  feature('ladeplanung', 'Ladeplanung', 'Elektro & Laden', [
    'ladeplanung', 'route mit laden', 'charging planner', 'lade route planen',
  ], ['elektro', 'laden', 'navigation'], { confidence: 'medium' }),
  feature('reichweite_400', 'Reichweite über 400 km', 'Elektro & Laden', [
    'reichweite über 400 km', 'über 400 km', 'mindestens 400 km', '400 km reichweite', '400 km',
  ], ['elektro', 'technik'], { confidence: 'low', legacyFeatureId: 'range_400' }),
  feature('reichweite_500', 'Reichweite über 500 km', 'Elektro & Laden', [
    'reichweite über 500 km', 'über 500 km', 'mindestens 500 km', '500 km reichweite', '500 km',
  ], ['elektro', 'technik'], { confidence: 'low' }),
  feature('achthundert_volt', '800V-Technik', 'Elektro & Laden', [
    '800v', '800 volt', '800v technik', '800-volt', 'hochvolt 800', 'ultraschnellladen 800v',
  ], ['elektro', 'laden', 'technik'], { confidence: 'low' }),
  feature('v2l', 'V2L / Vehicle-to-Load', 'Elektro & Laden', [
    'v2l', 'vehicle to load', 'vehicle-to-load', 'strom aus dem auto', 'steckdose im auto',
    'steckdose am auto', 'notstrom aus dem auto', 'lade andere geräte', 'haushaltsgerät am auto laden',
    'strom abgeben', 'bidirektional', 'bi direktional', 'bidirektionales laden',
  ], ['elektro', 'laden', 'alltag'], { showAsChip: true, confidence: 'high' }),
  feature('v2g', 'V2G / Vehicle-to-Grid', 'Elektro & Laden', [
    'v2g', 'vehicle to grid', 'vehicle-to-grid', 'energie zurück ins netz', 'netzdienlich laden',
    'bidirektionales laden ins netz', 'strom ins haus', 'strom ins netz',
  ], ['elektro', 'laden', 'technik'], { confidence: 'medium' }),
  feature('one_pedal_driving', 'One-Pedal-Driving / Rekuperation', 'Elektro & Laden', [
    'one pedal driving', 'one-pedal', 'ein pedal fahren', 'rekuperation stark',
    'i-pedal', 'e-pedal', 'starkes rekuperieren',
  ], ['elektro', 'fahren'], { confidence: 'medium' }),
];

/** Markenübergreifender Top-100-Katalog */
export const GLOBAL_FEATURE_CATALOG = [
  ...SITZE_KOMFORT,
  ...KLIMA,
  ...PARKEN_KAMERA,
  ...KOMFORT_ZUGANG,
  ...DIGITAL_INFOTAINMENT,
  ...ASSISTENZ,
  ...LICHT_DESIGN,
  ...KAROSSERIE,
  ...ANTRIEB_NUTZEN,
  ...ELEKTRO_LADEN,
];

const byId = new Map(GLOBAL_FEATURE_CATALOG.map((f) => [f.id, f]));

/** Alte Katalog-IDs → neue globale IDs (Abwärtskompatibilität) */
export const LEGACY_CATALOG_ID_ALIASES = {
  heated_seats: 'sitzheizung_vorne',
  heated_rear_seats: 'sitzheizung_hinten',
  steering_heat: 'lenkradheizung',
  electric_passenger_seat: 'elektrische_sitzverstellung_beifahrer',
  electric_driver_seat: 'elektrische_sitzverstellung_fahrer',
  ventilated_seats_front: 'sitzbelueftung_vorne',
  ventilated_seats_rear: 'sitzbelueftung_hinten',
  heat_pump: 'waermepumpe',
  rear_camera: 'rueckfahrkamera',
  camera_360: 'surround_view_camera',
  parking_front: 'parksensoren_vorne',
  parking_rear: 'parksensoren_hinten',
  blind_spot: 'totwinkelassistent',
  head_up_display: 'head_up_display',
  navigation: 'navigation',
  harman_kardon: 'soundsystem',
  towbar: 'anhaengerkupplung',
  tow_capacity_2000: 'anhaengelast',
  panorama_roof: 'panoramadach',
  power_tailgate: 'elektrische_heckklappe',
  remote_parking: 'remote_parking',
  ventilated_seats: 'sitzbelueftung_vorne',
  range_400: 'reichweite_400',
  led_headlights: 'led_scheinwerfer',
  led_taillights: 'led_rueckleuchten',
  matrix_led: 'matrix_led',
  bidirectional_charging: 'v2l',
};

export function getGlobalFeatureById(id) {
  if (!id) return null;
  const aliased = LEGACY_CATALOG_ID_ALIASES[id] ?? id;
  return byId.get(aliased) ?? null;
}

export function getSearchableGlobalFeatures() {
  return GLOBAL_FEATURE_CATALOG.filter((f) => f.searchable);
}

export function getChipEligibleGlobalFeatures() {
  return GLOBAL_FEATURE_CATALOG.filter((f) => f.showAsChip);
}

export function getAdvisorRelevantGlobalFeatures() {
  return GLOBAL_FEATURE_CATALOG.filter((f) => f.advisorRelevant);
}

export function resolveLegacyFeatureId(globalFeature) {
  if (!globalFeature) return null;
  return globalFeature.legacyFeatureId ?? null;
}
