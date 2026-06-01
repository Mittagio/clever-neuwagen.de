/** Sprint 7 – Kundenkonto-Bereiche */
export const ACCOUNT_TABS = [
  { id: 'offers', label: 'Angebote', key: 'offers', headline: 'Meine Angebote' },
  { id: 'comparisons', label: 'Vergleiche', key: 'comparisons', headline: 'Meine Vergleiche' },
  { id: 'favorites', label: 'Favoriten', key: 'favorites', headline: 'Meine Favoriten' },
  { id: 'documents', label: 'Dokumente', key: 'documents', headline: 'Meine Dokumente' },
  { id: 'vehicleStatus', label: 'Fahrzeugstatus', key: 'vehicleStatus', headline: 'Mein Fahrzeugstatus' },
];

export const VEHICLE_STATUS_STAGES = {
  angebot: { label: 'Angebot erhalten', order: 1 },
  interessiert: { label: 'Interesse bestätigt', order: 2 },
  bestellung: { label: 'Bestellung', order: 3 },
  produktion: { label: 'In Produktion', order: 4 },
  transport: { label: 'Transport', order: 5 },
  auslieferung: { label: 'Auslieferung', order: 6 },
  ausgeliefert: { label: 'Ausgeliefert', order: 7 },
};

export function getAccountEmptyMessage(tabId) {
  const messages = {
    offers: 'Noch keine Angebote. Lassen Sie sich in der KI-Beratung ein persönliches Angebot erstellen.',
    comparisons: 'Noch keine Vergleiche. Nach der Beratung können Sie bis zu 3 Fahrzeuge vergleichen.',
    favorites: 'Noch keine Favoriten. Speichern Sie Fahrzeuge in der Beratung mit dem Herz-Symbol.',
    documents: 'Noch keine Dokumente. Laden Sie Unterlagen direkt auf Ihrer Angebotsseite hoch.',
    vehicleStatus: 'Noch kein Fahrzeugstatus. Sobald Sie ein Angebot annehmen oder bestellen, sehen Sie hier den Fortschritt.',
  };
  return messages[tabId] ?? 'Noch keine Einträge.';
}
