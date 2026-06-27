export const LEAD_STATUS = {
  neu: { id: 'neu', label: 'Neu', color: '#2563eb', bg: '#dbeafe' },
  inBearbeitung: { id: 'inBearbeitung', label: 'In Bearbeitung', color: '#d97706', bg: '#fef3c7' },
  angebotVersendet: { id: 'angebotVersendet', label: 'Angebot versendet', color: '#7c3aed', bg: '#ede9fe' },
  rueckfrageOffen: { id: 'rueckfrageOffen', label: 'Rückfrage offen', color: '#ea580c', bg: '#ffedd5' },
  probefahrt: { id: 'probefahrt', label: 'Probefahrt geplant', color: '#0d9488', bg: '#ccfbf1' },
  bestellung: { id: 'bestellung', label: 'Bestellung', color: '#16a34a', bg: '#dcfce7' },
  ausgeliefert: { id: 'ausgeliefert', label: 'Ausgeliefert', color: '#15803d', bg: '#bbf7d0' },
  auslieferung_bestaetigt: { id: 'auslieferung_bestaetigt', label: 'Auslieferung bestätigt', color: '#059669', bg: '#a7f3d0' },
  verloren: { id: 'verloren', label: 'Verloren', color: '#64748b', bg: '#f1f5f9' },
};

export const LEAD_STATUS_ORDER = [
  'neu',
  'inBearbeitung',
  'angebotVersendet',
  'rueckfrageOffen',
  'probefahrt',
  'bestellung',
  'ausgeliefert',
  'auslieferung_bestaetigt',
  'verloren',
];

export const PAYMENT_TYPES = {
  leasing: { id: 'leasing', label: 'Leasing' },
  finance: { id: 'finance', label: 'Finanzierung' },
  cash: { id: 'cash', label: 'Kauf' },
};

export const LEAD_SOURCES = {
  sales: 'Verkäufermodus',
  configurator: 'Konfigurator',
  berater: 'Ausstattungsberater',
  advisor: 'KI-Kaufberater',
  landing: 'Landingpage',
  pilot: 'Pilot Trinkle',
  gespraech: 'Gesprächsmodus',
  manual: 'Manuell',
  dealerJourney: 'Clever Journey',
  dealerSearch: 'Händler-Suche',
  marketplace: 'Fahrzeugseite',
  offer: 'Angebotslink',
  equipment: 'Ausstattungsberater',
  customerAdvisor: 'Kunden-Beratung',
  showroomMode: 'Showroom Modus',
};
