/**
 * Ratgeber – Artikel-Definitionen (SEO + Berater-Profile)
 * Inhalte werden zur Laufzeit via guideArticleService aus dem KI-Berater generiert.
 */

export const GUIDE_CATEGORIES = [
  { id: 'familienautos', label: 'Familienautos', description: 'Platz, Sicherheit und Alltagstauglichkeit.' },
  { id: 'elektroautos', label: 'Elektroautos', description: 'Reichweite, Laden und Leasing für E-Modelle.' },
  { id: 'suv', label: 'SUV', description: 'Geländetauglich im Alltag – kompakt bis groß.' },
  { id: 'leasing', label: 'Leasing', description: 'Raten, Laufzeit und Kilometer richtig wählen.' },
  { id: 'firmenwagen', label: 'Firmenwagen', description: 'Dienstwagen, Corporate Benefits und Gewerbe.' },
  { id: 'hybrid', label: 'Hybrid', description: 'Sparsam fahren ohne Ladeinfrastruktur.' },
];

export const GUIDE_ARTICLES = [
  {
    slug: 'ev3-oder-ev4',
    category: 'elektroautos',
    title: 'EV3 oder EV4? Der ehrliche Vergleich',
    metaDescription: 'Kia EV3 vs. EV4: Reichweite, Preis, Leasingrate und für wen welches Elektroauto passt – mit aktuellen Händlerbeispielen.',
    intro: 'Zwei moderne Kia-Elektroautos, unterschiedliche Konzepte: Der EV3 ist der kompakte SUV, der EV4 die Limousine mit mehr Platz. Wir vergleichen beides anhand echter Leasingkonditionen und typischer Nutzerprofile.',
    readMinutes: 6,
    profile: {
      mileage: '10k-15k',
      household: 'couple',
      desiredRate: 380,
      fuelPreference: 'elektro',
      bodyType: 'egal',
      wishes: ['reichweite', 'niedrige-kosten'],
    },
    focusVehicleIds: ['ev3-long-range', 'ev4-earth', 'ev4-standard'],
    faq: [
      { q: 'Hat der EV4 mehr Reichweite als der EV3?', a: 'In der Long-Range-Variante ja – bis zu 580 km WLTP gegenüber 600 km beim EV3 Long Range. Für Vielfahrer lohnt der Vergleich der konkreten Motorisierung.' },
      { q: 'Welches Modell ist günstiger im Leasing?', a: 'Das hängt von Ausstattung und Händleraktion ab. Unser Vergleich zeigt aktuelle Beispielraten – individuelle Angebote können abweichen.' },
    ],
  },
  {
    slug: 'sportage-oder-tiguan',
    category: 'suv',
    title: 'Sportage oder Tiguan? SUV-Vergleich 2026',
    metaDescription: 'Kia Sportage vs. VW Tiguan: Leasingrate, Ausstattung, Lieferzeit und Empfehlung für Familien und Vielfahrer.',
    intro: 'Zwei der beliebtesten Kompakt-SUVs in Deutschland. Der Kia Sportage punktet mit Hybrid-Antrieb und Händlerkonditionen, der VW Tiguan mit Marktpräsenz und Innenraum. Hier der datenbasierte Vergleich.',
    readMinutes: 7,
    profile: {
      mileage: '15k-20k',
      household: 'family',
      desiredRate: 400,
      fuelPreference: 'hybrid',
      bodyType: 'suv',
      wishes: ['viel-platz', 'anhaenger'],
    },
    focusVehicleIds: ['sportage-hybrid-2wd-spirit', 'sportage-hybrid-2wd-vision'],
    supplementalVehicles: [
      {
        id: 'vw-tiguan-life',
        brand: 'VW',
        model: 'Tiguan',
        variant: 'Life eHybrid',
        bodyType: 'suv',
        fuelCategory: 'hybrid',
        mock: true,
        mockRate: 429,
        mockHauspreis: 48990,
        mockDeliveryTime: '6–10 Wochen',
        highlights: ['Bekanntes Markenimage', 'Großer Kofferraum', 'eHybrid optional'],
        rangeKm: null,
      },
    ],
    faq: [
      { q: 'Ist der Sportage günstiger als der Tiguan?', a: 'In vielen Konfigurationen ja – besonders bei Hybrid-Varianten und aktuellen Händleraktionen. Vergleichen Sie immer die konkrete Leasingrate, nicht nur den Listenpreis.' },
    ],
  },
  {
    slug: 'bestes-familienauto-bis-400-euro',
    category: 'familienautos',
    title: 'Bestes Familienauto bis 400 € Leasing',
    metaDescription: 'Familienautos unter 400 Euro monatlich: unsere Top-Empfehlungen mit Platz, Sicherheit und aktuellen Leasingbeispielen.',
    intro: 'Familie, Alltag, Wochenendtrip – ein gutes Familienauto muss vieles können, ohne das Budget zu sprengen. Wir haben Fahrzeuge für Haushalte mit Kindern bis 400 € monatlich zusammengestellt.',
    readMinutes: 5,
    profile: {
      mileage: '10k-15k',
      household: 'family',
      desiredRate: 400,
      fuelPreference: 'egal',
      bodyType: 'suv',
      wishes: ['viel-platz', 'anhaenger'],
    },
    faq: [
      { q: 'Reicht 400 € für ein Familien-SUV?', a: 'Ja – je nach Ausstattung und Laufleistung finden sich mehrere passende Modelle. Hybrid- und Basisausstattungen sind oft am günstigsten.' },
    ],
  },
  {
    slug: 'elektroauto-20000-km-pro-jahr',
    category: 'elektroautos',
    title: 'Elektroauto für 20.000 km pro Jahr',
    metaDescription: 'Welches Elektroauto passt zu 20.000 km Jahreslaufleistung? Reichweite, Leasing und Kosten im Überblick.',
    intro: 'Bei 20.000 km pro Jahr zählt Reichweite und Ladekomfort. Wir empfehlen Elektrofahrzeuge, die Vielfahrer ohne tägliches Ladenversagen unterstützen – mit passenden Leasingkonditionen.',
    readMinutes: 5,
    profile: {
      mileage: '15k-20k',
      household: 'couple',
      desiredRate: 420,
      fuelPreference: 'elektro',
      bodyType: 'suv',
      wishes: ['reichweite'],
    },
    faq: [
      { q: 'Lohnt sich Elektro bei 20.000 km?', a: 'Bei entsprechender Reichweite und günstigem Strom oft ja. Die Leasingrate sollte zur Nutzung passen – zu niedrige km-Vorgabe kann teurer werden.' },
    ],
  },
  {
    slug: 'bester-hybrid-suv',
    category: 'hybrid',
    title: 'Bester Hybrid-SUV: Empfehlungen 2026',
    metaDescription: 'Hybrid-SUV im Vergleich: Verbrauch, Leasingrate und Ausstattung – unsere Top-Picks für sparsames Fahren ohne Stecker.',
    intro: 'Hybrid-Antriebe verbinden Alltagstauglichkeit mit niedrigem Verbrauch – ideal, wenn keine Wallbox verfügbar ist. Diese SUV-Empfehlungen haben wir für Hybrid-Fahrer zusammengestellt.',
    readMinutes: 5,
    profile: {
      mileage: '10k-15k',
      household: 'family',
      desiredRate: 380,
      fuelPreference: 'hybrid',
      bodyType: 'suv',
      wishes: ['niedrige-kosten', 'viel-platz'],
    },
    faq: [
      { q: 'Hybrid oder Elektro für den Alltag?', a: 'Hybrid, wenn Sie selten laden können oder lange Strecken fahren. Elektro, wenn Sie überwiegend urban unterwegs sind und zuhause laden können.' },
    ],
  },
  {
    slug: 'firmenwagen-leasing-corporate',
    category: 'firmenwagen',
    title: 'Firmenwagen & Corporate Leasing',
    metaDescription: 'Dienstwagen leasen mit Corporate Benefits: günstigere Raten, steuerliche Vorteile und passende Modelle für Gewerbe und öffentlichen Dienst.',
    intro: 'Als Firmenkunde oder mit Corporate-Benefits-Programm sinken oft die effektiven Kosten deutlich. Wir zeigen Fahrzeuge, die sich für Dienstwagen und Vielfahrer eignen – inklusive Beispiel-Leasingraten.',
    readMinutes: 6,
    profile: {
      mileage: 'over-20k',
      household: 'single',
      desiredRate: 450,
      fuelPreference: 'verbrenner',
      bodyType: 'suv',
      wishes: ['gewerblich', 'reichweite'],
    },
    faq: [
      { q: 'Was sind Corporate Benefits beim Autokauf?', a: 'Sonderkonditionen über Arbeitgeber-Partnerprogramme – oft niedrigere Leasingraten oder zusätzliche Rabatte gegenüber Standardkonditionen.' },
    ],
  },
  {
    slug: 'leasing-ratgeber-laufzeit-kilometer',
    category: 'leasing',
    title: 'Leasing: Laufzeit & Kilometer richtig wählen',
    metaDescription: '48 oder 36 Monate? 10.000 oder 15.000 km? So finden Sie die optimale Leasing-Kombination – mit Fahrzeugbeispielen.',
    intro: 'Die falsche Laufzeit oder Kilometerleistung kann Leasing teuer machen. Wir erklären die wichtigsten Stellschrauben und zeigen passende Fahrzeuge für typische Profile.',
    readMinutes: 4,
    profile: {
      mileage: '10k-15k',
      household: 'couple',
      desiredRate: 350,
      fuelPreference: 'egal',
      bodyType: 'suv',
      wishes: ['schnelle-lieferung'],
    },
    faq: [
      { q: 'Was ist die übliche Leasing-Laufzeit?', a: '48 Monate ist der häufigste Standard. Kürzere Laufzeiten bedeuten oft höhere Monatsraten, längere Laufzeiten können günstiger wirken – aber an das Fahrzeug binden.' },
    ],
  },
];

export function getGuideCategory(id) {
  return GUIDE_CATEGORIES.find((c) => c.id === id) ?? null;
}

export function getGuideArticle(slug) {
  return GUIDE_ARTICLES.find((a) => a.slug === slug) ?? null;
}

export function getArticlesByCategory(categoryId) {
  return GUIDE_ARTICLES.filter((a) => a.category === categoryId);
}
