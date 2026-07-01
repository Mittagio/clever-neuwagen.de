/**
 * Qualitäts-Antworten ohne OpenAI – kein „Das weiß ich nicht“.
 */
import { QUERY_TYPES } from './customerQueryTypes.js';
import { detectCompetitorComparison } from './generalCarQueryDetector.js';
import { detectModelKeyInQuery } from '../search/modelAttributeQuestion.js';

const KIA_BRIDGE_DEFAULT = 'Bei Kia sind EV3, EV4, EV5, EV6 und EV9 interessante Alternativen – Ihr Autohaus prüft Ausstattung, Rate und Verfügbarkeit.';

function buildFacts(query, classification, routing) {
  const competitor = routing.competitor ?? detectCompetitorComparison(query);
  const topic = classification.topic ?? routing.generalCompare?.topic ?? routing.generalQ?.topic;

  if (competitor) {
    return buildCompetitorTemplate(query, competitor);
  }

  if (topic === 'diesel_vs_ev' || /diesel.*elektro|elektro.*diesel/i.test(query)) {
    return {
      kind: 'general_knowledge',
      subkind: 'diesel_vs_ev',
      headline: 'Diesel oder Elektro?',
      shortAnswer: 'Diesel punktet bei Langstrecke, Tanken und Anhänger ohne Ladeplanung. Elektro überzeugt im Alltag oft bei niedrigeren Betriebskosten, leiser Fahrt und Laden zuhause – wenn Strecke und Lademöglichkeiten passen.',
      narrative: [
        'Kurzstrecke und Laden zuhause: Elektro oft attraktiv.',
        'Sehr viele Kilometer, wenig Ladeinfrastruktur oder schwerer Anhängeralltag: Diesel oder Plug-in-Hybrid kann sinnvoller sein.',
      ],
      kiaBridge: 'Kia bietet mit EV3 bis EV9 elektrische Alternativen und mit Sorento/Sportage auch Diesel- und Hybrid-Lösungen.',
      dealerHint: 'Ihr Autohaus vergleicht anhand Ihres Fahrprofils, was wirtschaftlicher ist.',
      competitorMentions: [],
      kiaAlternatives: ['ev4', 'ev5', 'ev6', 'sorento'],
    };
  }

  if (topic === 'hybrid_vs_plugin' || classification.adviceTopicId === 'hybrid_vs_plugin_hybrid') {
    return {
      kind: 'general_knowledge',
      subkind: 'hybrid_vs_plugin',
      headline: 'Hybrid oder Plug-in-Hybrid?',
      shortAnswer: 'Ein Vollhybrid lädt sich unterwegs selbst – kein Stecker nötig, aber wenig E-Reichweite. Ein Plug-in-Hybrid erlaubt oft 40–80 km elektrisch, wenn Sie regelmäßig laden können.',
      kiaBridge: 'Kia Sportage und Sorento gibt es als Hybrid und Plug-in-Hybrid – EV3/EV4/EV5 als reine Elektro-Alternative.',
      dealerHint: 'Ihr Autohaus rechnet Verbrauch und Alltagstauglichkeit für Ihr Profil durch.',
      competitorMentions: [],
      kiaAlternatives: ['sportage-phev', 'ev4'],
    };
  }

  if (classification.adviceTopicId === 'ev_towing_range' || /wohnwagen|anhänger.*reichweite/i.test(query)) {
    return {
      kind: 'general_knowledge',
      subkind: 'towing_range',
      headline: 'Reichweite mit Anhänger oder Wohnwagen',
      shortAnswer: 'Mit Anhänger sinkt die Reichweite bei Elektroautos deutlich – oft 30–50 % und mehr. Entscheidend sind Gewicht, Luftwiderstand, Tempo, Wetter und Steigung.',
      usefulWhen: [
        'Anhängelast und Zuladung kennen',
        'Reserve bei Ladeplanung einbauen',
        'Tempo und Streckenprofil realistisch planen',
      ],
      kiaBridge: 'Kia EV6 und EV9 bieten hohe Anhängelasten – Ihr Autohaus prüft, welches Modell zu Ihrem Anhänger passt.',
      dealerHint: 'Konkrete Anhängelast und Reichweite mit Ihrem Setup prüft Ihr Autohaus.',
      competitorMentions: [],
      kiaAlternatives: ['ev6', 'ev9'],
    };
  }

  if (classification.adviceTopicId === 'heat_pump' || /wärmepumpe/i.test(query)) {
    return {
      kind: 'general_knowledge',
      subkind: 'heat_pump',
      headline: 'Was bringt eine Wärmepumpe?',
      shortAnswer: 'Eine Wärmepumpe nutzt Umgebungswärme und spart im Winter oft Reichweite gegenüber reiner Heizstab-Heizung – besonders auf längeren Strecken.',
      kiaBridge: 'Viele Kia E-Modelle bieten Wärmepumpen je nach Ausstattung – Ihr Autohaus nennt die Verfügbarkeit für Ihr Wunschmodell.',
      dealerHint: 'Serien- oder Sonderausstattung prüft Ihr Autohaus am konkreten Fahrzeug.',
      competitorMentions: [],
      kiaAlternatives: ['ev4', 'ev5', 'ev6'],
    };
  }

  if (/zeekr/i.test(query) && /lad|schnell|dc|kw/i.test(query)) {
    return {
      kind: 'general_knowledge',
      subkind: 'zeekr_charging',
      headline: 'Ladegeschwindigkeit Zeekr – Orientierung',
      shortAnswer: 'Nach allgemeinem Datenstand hängt die Ladegeschwindigkeit vom genauen Zeekr-Modell, der Akkugröße und der DC-Ladeleistung ab. Wichtig sind maximale kW-Leistung, die 10–80-%-Zeit und die reale Ladekurve unterwegs.',
      narrative: [
        'Große Akkus laden oft schneller an High-Power-Chargern, verlieren aber bei hohem Ladestand an Tempo.',
        'Im Alltag zählen verfügbare Ladeinfrastruktur und Ihre typischen Strecken.',
      ],
      kiaBridge: 'Zum Vergleich der Ladegeschwindigkeit bieten sich Kia EV6, EV9, EV5 oder EV4 an – Ihr Autohaus vergleicht Modelle anhand Ihres Fahrprofils.',
      dealerHint: 'Konkrete Ladeleistung und Ausstattung prüft Ihr Autohaus am Wunschmodell.',
      competitorMentions: ['Zeekr'],
      kiaAlternatives: ['ev6', 'ev9', 'ev5', 'ev4'],
    };
  }

  if ((classification.modelKey === 'ev4' || /ev4/i.test(query))
    && /steckdose|usb|v2l|anschluss|12v/i.test(query)) {
    return {
      kind: 'general_knowledge',
      subkind: 'ev4_power_outlets',
      headline: 'Anschlüsse und Steckdosen beim Kia EV4',
      shortAnswer: 'Beim EV4 muss man unterscheiden zwischen USB-Anschlüssen im Innenraum, 12V-Anschluss, dem Ladeanschluss außen und möglichen Funktionen wie V2L (Vehicle-to-Load). Je nach Ausstattungslinie können Anzahl und Position der Anschlüsse variieren.',
      narrative: [
        'USB-C/USB-A dienen Medien und Laden von Geräten im Innenraum.',
        'V2L erlaubt unter Umständen Strom aus dem Akku für Geräte – nicht in jeder Linie verfügbar.',
      ],
      kiaBridge: 'Ihr Autohaus zeigt Ihnen die konkrete EV4-Version mit passender Ausstattung.',
      dealerHint: 'Die genaue EV4-Ausstattung und Verfügbarkeit prüft Ihr Autohaus final.',
      competitorMentions: [],
      kiaAlternatives: ['ev4'],
      primaryModelKey: 'ev4',
    };
  }

  if (routing.reason === 'model_equipment_gap' || topic === 'equipment_gap') {
    const modelKey = classification.modelKey ?? detectModelKeyInQuery(query);
    const label = modelKey ? `Kia ${modelKey.toUpperCase()}` : 'Ihr Wunschmodell';
    return {
      kind: 'general_knowledge',
      subkind: 'model_equipment_gap',
      headline: `${label}: Ausstattung im Überblick`,
      shortAnswer: `Nach allgemeinem Datenstand variiert die Ausstattung je nach Linie und Paket. Für verbindliche Angaben zu Ihrer konkreten Version ist Ihr Autohaus die sichere Quelle.`,
      kiaBridge: `${label} können Sie direkt beim Autohaus konfigurieren und vergleichen.`,
      dealerHint: 'Ihr Autohaus prüft die genaue Ausstattung und Verfügbarkeit final.',
      competitorMentions: [],
      kiaAlternatives: modelKey ? [modelKey] : ['ev4'],
      primaryModelKey: modelKey,
    };
  }

  return {
    kind: 'general_knowledge',
    subkind: 'open_auto',
    headline: 'Clever Einschätzung',
    shortAnswer: 'Das hängt von Ihrem Fahrprofil, Budget und den konkreten Modellen ab. Im Allgemeinen lohnt sich der Vergleich von Antrieb, Reichweite, Platzbedarf und Gesamtkosten.',
    kiaBridge: KIA_BRIDGE_DEFAULT,
    dealerHint: 'Für verbindliche Ausstattung, Rate und Verfügbarkeit ist Ihr Autohaus der richtige Ansprechpartner.',
    competitorMentions: detectCompetitorComparison(query)?.competitors ?? [],
    kiaAlternatives: ['ev4', 'ev5', 'ev9'],
  };
}

/**
 * @param {string} query
 * @param {object} competitor
 */
function buildCompetitorTemplate(query, competitor) {
  const names = competitor.competitors;
  const q = query.toLowerCase();

  if (names.includes('Zeekr') && names.includes('BYD')) {
    return {
      kind: 'general_knowledge',
      subkind: 'zeekr_vs_byd',
      headline: 'Zeekr vs. BYD Seal – Reichweite im Überblick',
      shortAnswer: 'Wenn Sie maximale rein elektrische Reichweite suchen, liegt ein reines E-Auto wie der Zeekr oft im Vorteil. Der BYD Seal 6 DM-i Touring ist spannend, wenn Sie sehr hohe Gesamtreichweite und Tank-Flexibilität möchten – er kombiniert als Plug-in-Hybrid Benzin und Elektro.',
      narrative: [
        'Reine E-Reichweite im Alltag: Zeekr und vergleichbare E-Autos.',
        'Weniger Lade-Stress auf Langstrecke: Plug-in-Hybrid mit Tankreserve.',
      ],
      kiaBridge: 'Wenn Sie bei Kia vergleichen möchten, sind EV4, EV5 oder EV6 interessante Alternativen mit starker E-Reichweite.',
      dealerHint: 'Konkrete Kia-Raten und Verfügbarkeit prüft Ihr Autohaus – nicht Schätzwerte aus dem Internet.',
      competitorMentions: ['Zeekr', 'BYD'],
      kiaAlternatives: ['ev4', 'ev5', 'ev6'],
    };
  }

  if (names.some((n) => /mercedes|gle/i.test(n)) && (competitor.hasKia || /ev9|kia/i.test(q))) {
    return {
      kind: 'general_knowledge',
      subkind: 'gle_vs_ev9',
      headline: 'Mercedes GLE vs. Kia EV9',
      shortAnswer: 'Der GLE punktet als Diesel/Plug-in mit klassischer Langstrecke, schnellem Tanken, Anhänger-Flexibilität und etabliertem Premium-Image. Der EV9 fährt elektrisch, leise, mit großem Raumgefühl und weniger Wartung – dafür braucht er Ladeplanung.',
      narrative: [
        'GLE: Tanken, Langstrecke, Anhänger, gewohnte Premium-Marke.',
        'EV9: Elektro, 7 Sitze, Heimladen, niedrigere Energiekosten im Alltag.',
      ],
      kiaBridge: 'Für den Kia EV9 kann Ihr Autohaus konkrete Ausstattung, Rate und Verfügbarkeit prüfen.',
      dealerHint: 'Finale Rate, Pakete und Lieferzeit kommen vom Autohaus – nicht aus allgemeinen Vergleichen.',
      competitorMentions: ['Mercedes GLE'],
      kiaAlternatives: ['ev9'],
      primaryModelKey: 'ev9',
    };
  }

  return {
    kind: 'general_knowledge',
    subkind: 'competitor_generic',
    headline: `Vergleich: ${names.join(' vs. ')}`,
    shortAnswer: `Beide Marken haben unterschiedliche Stärken – Antrieb, Reichweite, Platzangebot und Gesamtkosten sollten Sie an Ihrem Alltag messen, nicht nur an der Werbung.`,
    kiaBridge: KIA_BRIDGE_DEFAULT,
    dealerHint: 'Ihr Autohaus hilft beim Abgleich mit passenden Kia-Modellen und echten Angeboten.',
    competitorMentions: names,
    kiaAlternatives: ['ev4', 'ev5', 'ev9'],
  };
}

/**
 * @param {object} params
 */
export function buildGeneralKnowledgeFacts({
  query = '',
  classification = {},
  routing = {},
} = {}) {
  if (routing.route === 'dealer_check' && routing.reason === 'leasing_rate') {
    const modelKey = routing.modelKey ?? detectModelKeyInQuery(query);
    return {
      kind: 'dealer_data_required',
      subkind: 'leasing_rate',
      headline: modelKey ? `${modelKey.toUpperCase()} Leasing – Händler prüft` : 'Leasingrate',
      shortAnswer: 'Konkrete Leasingraten hängen von Laufzeit, Kilometern, Ausstattung und aktuellen Händlerkonditionen ab – dafür haben wir keine verbindlichen Live-Daten ohne Ihr Autohaus.',
      dealerHint: 'Ihr Autohaus rechnet die Rate für Ihre Wunschkonfiguration durch.',
      modelKey,
      needsDealerCheck: true,
    };
  }

  return buildFacts(query, classification, routing);
}
