export const OFFER_STATUS = {
  entwurf: { id: 'entwurf', label: 'Entwurf', color: '#64748b', bg: '#f1f5f9' },
  versendet: { id: 'versendet', label: 'Versendet', color: '#2563eb', bg: '#dbeafe' },
  geoeffnet: { id: 'geoeffnet', label: 'Geöffnet', color: '#7c3aed', bg: '#ede9fe' },
  interessiert: { id: 'interessiert', label: 'Interessiert', color: '#0d9488', bg: '#ccfbf1' },
  verhandlung: { id: 'verhandlung', label: 'Verhandlung', color: '#d97706', bg: '#fef3c7' },
  bestellung: { id: 'bestellung', label: 'Bestellung', color: '#16a34a', bg: '#dcfce7' },
  ausgeliefert: { id: 'ausgeliefert', label: 'Ausgeliefert', color: '#15803d', bg: '#bbf7d0' },
  verloren: { id: 'verloren', label: 'Verloren', color: '#94a3b8', bg: '#e2e8f0' },
};

export const OFFER_STATUS_ORDER = [
  'entwurf',
  'versendet',
  'geoeffnet',
  'interessiert',
  'verhandlung',
  'bestellung',
  'ausgeliefert',
  'verloren',
];

export const OFFER_SOURCES = {
  manual: 'Manuell',
  configurator: 'Konfigurator',
  sales: 'Verkäufermodus',
  advisor: 'KI-Kaufberater',
  equipment: 'Ausstattungsberater',
  dealerPage: 'Händlerseite',
  offers: 'Angebotszentrum',
  dealerAi: 'Dealer AI',
};

export const CUSTOMER_OFFER_ACTIONS = {
  inquiry: { id: 'inquiry', label: 'Anfrage starten' },
  testdrive: { id: 'testdrive', label: 'Probefahrt anfragen' },
  callback: { id: 'callback', label: 'Händler kontaktieren' },
  question: { id: 'question', label: 'Frage stellen' },
  special_request: { id: 'special_request', label: 'Sonderwunsch angeben' },
  accept: { id: 'accept', label: 'Anfrage starten' },
};
