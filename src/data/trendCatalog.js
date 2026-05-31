/**
 * Trendseiten – Vorlagen für marktbasierte Auto-Inhalte
 * Inhalte werden via trendArticleService aus Intelligence + KI-Berater generiert.
 */

const YEAR = new Date().getFullYear();

export const TREND_CATEGORIES = [
  { id: 'markt', label: 'Markttrends', description: 'Aktuelle Nachfrage und Suchverhalten.' },
  { id: 'leasing', label: 'Leasing', description: 'Die besten Raten der Woche.' },
  { id: 'elektroautos', label: 'Elektroautos', description: 'E-Modelle mit stärkster Nachfrage.' },
  { id: 'suv', label: 'SUV', description: 'Beliebte SUV nach Budget.' },
  { id: 'vergleich', label: 'Vergleich', description: 'Was Kunden am häufigsten vergleichen.' },
  { id: 'familienautos', label: 'Familienautos', description: 'Top-Modelle für Familien.' },
];

export const TREND_TEMPLATES = [
  {
    slug: 'beste-leasingangebote-der-woche',
    category: 'leasing',
    title: 'Beste Leasingangebote der Woche',
    metaDescription: `Die attraktivsten Leasingangebote dieser Woche – bewertet nach Rate, Lieferzeit und Nachfrage (${YEAR}).`,
    intro: 'Welche Fahrzeuge bieten gerade das beste Preis-Leistungs-Verhältnis? Wir werten Beratungen, Angebote und Vergleiche der letzten Tage aus und zeigen die Top-Deals mit echten Händlerbeispielen.',
    readMinutes: 4,
    profile: {
      mileage: '10k-15k',
      household: 'couple',
      desiredRate: 399,
      fuelPreference: 'egal',
      bodyType: 'suv',
      wishes: ['schnelle-lieferung'],
    },
    type: 'best-deals',
  },
  {
    slug: `beste-elektroautos-${YEAR}`,
    category: 'elektroautos',
    title: `Beste Elektroautos ${YEAR}`,
    metaDescription: `Top Elektroautos ${YEAR}: Reichweite, Leasingrate und Nachfrage im Überblick – mit aktuellen Händlerbeispielen.`,
    intro: `Elektromobilität ohne Rätselraten: Diese E-Modelle werden aktuell am häufigsten empfohlen und angefragt. Alle Angaben basieren auf realer Nachfrage und veröffentlichten Händlerkonditionen.`,
    readMinutes: 5,
    profile: {
      mileage: '10k-15k',
      household: 'couple',
      desiredRate: 400,
      fuelPreference: 'elektro',
      bodyType: 'suv',
      wishes: ['reichweite', 'niedrige-kosten'],
    },
    type: 'electro-index',
  },
  {
    slug: 'top-suv-unter-350-euro',
    category: 'suv',
    title: 'Top SUV unter 350 €',
    metaDescription: 'Die besten SUV-Leasingangebote unter 350 Euro monatlich – mit Lieferzeit und Clever Score.',
    intro: 'SUV-Nachfrage bleibt hoch – aber das Budget auch. Diese Modelle liefern Platz, Sicherheit und Alltagstauglichkeit unter 350 € monatlich, sortiert nach aktueller Marktnachfrage.',
    readMinutes: 4,
    profile: {
      mileage: '10k-15k',
      household: 'family',
      desiredRate: 350,
      fuelPreference: 'egal',
      bodyType: 'suv',
      wishes: ['viel-platz'],
    },
    type: 'budget-picks',
  },
  {
    slug: 'beste-familienautos-aktuell',
    category: 'familienautos',
    title: 'Beste Familienautos aktuell',
    metaDescription: 'Familienautos mit Top-Bewertung: Rate, Lieferzeit und Nachfrage aus echten Beratungen.',
    intro: 'Familien brauchen Platz, Planbarkeit und faire Raten. Unser Familienindex zeigt, welche Modelle gerade am stärksten nachgefragt werden – mit Leasingbeispielen und Lieferzeiten.',
    readMinutes: 5,
    profile: {
      mileage: '10k-15k',
      household: 'family',
      desiredRate: 400,
      fuelPreference: 'egal',
      bodyType: 'suv',
      wishes: ['viel-platz', 'anhaenger'],
    },
    type: 'family-index',
  },
];

export function getTrendTemplate(slug) {
  return TREND_TEMPLATES.find((t) => t.slug === slug) ?? null;
}

export function getTrendCategory(id) {
  return TREND_CATEGORIES.find((c) => c.id === id) ?? null;
}
