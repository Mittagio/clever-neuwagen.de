export const DEALER_SEARCH_EXAMPLES = [
  'SUV · Familie · unter 400 €',
  'Elektro bis 400 €',
  'Sofort verfügbar',
  'Sportage Hybrid',
  '7-Sitzer',
  'Anhängerkupplung',
];

export const DEALER_CURATED_GROUPS = [
  {
    id: 'families',
    label: 'Beliebt bei Familien',
    picks: [
      { label: 'EV3 Earth', query: 'Kia EV3 Earth Familie' },
      { label: 'Sportage Vision', query: 'Sportage Vision Familie SUV' },
    ],
  },
  {
    id: 'commuters',
    label: 'Beliebt bei Vielfahrern',
    picks: [
      { label: 'EV3 Long Range', query: 'EV3 Long Range Reichweite' },
      { label: 'EV6', query: 'Kia EV6 Vielfahrer' },
    ],
  },
  {
    id: 'budget',
    label: 'Unter 350 €/Monat',
    picks: [
      { label: 'EV3 Air', query: 'EV3 Air unter 350 Euro' },
      { label: 'Ceed SW', query: 'Ceed SW Leasing unter 350' },
    ],
  },
];

export const DEALER_ACTION_BANNERS = [
  { id: 'stock-sale', title: '🔥 Lagerabverkauf', text: 'Nur solange Bestand vorhanden' },
  { id: 'black-edition', title: '🔥 Black Edition', text: 'Top-Ausstattung zu Aktionsraten' },
  { id: 'corporate', title: '🔥 Corporate Benefits', text: 'Exklusive Konditionen für Mitarbeiterprogramme' },
  { id: 'daily', title: '🔥 Tageszulassungen', text: 'Sofort verfügbar mit Preisvorteil' },
];

export const KIA_DEALER_MODELS = [
  { id: 'picanto', name: 'Picanto', rateFrom: 149, type: 'kleinwagen', imageModel: 'Picanto' },
  { id: 'ev2', name: 'EV2', rateFrom: 199, type: 'elektro', imageModel: 'EV2' },
  { id: 'ev3', name: 'EV3', rateFrom: 299, type: 'elektro', imageModel: 'EV3' },
  { id: 'ev4', name: 'EV4', rateFrom: 349, type: 'elektro', imageModel: 'EV4' },
  { id: 'sportage', name: 'Sportage', rateFrom: 255, type: 'suv', imageModel: 'Sportage' },
  { id: 'sorento', name: 'Sorento', rateFrom: 499, type: 'suv', imageModel: 'Sorento' },
];
