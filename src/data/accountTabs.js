/** Sprint 7 – Kundenkonto-Bereiche */
export const ACCOUNT_TABS = [
  { id: 'offers', label: 'Gemerkte Angebote', key: 'offers', headline: 'Gemerkte Angebote' },
  { id: 'comparisons', label: 'Vergleiche', key: 'comparisons', headline: 'Meine Vergleiche' },
  { id: 'testDrives', label: 'Meine Anfragen', key: 'testDrives', headline: 'Meine Anfragen' },
  { id: 'documents', label: 'Dokumente', key: 'documents', headline: 'Meine Dokumente' },
  { id: 'vehicleStatus', label: 'Auslieferung', key: 'vehicleStatus', headline: 'Auslieferungsstatus' },
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
    offers: 'Noch keine gemerkten Angebote. Speichern Sie Fahrzeuge mit „Angebot merken“.',
    comparisons: 'Noch keine Vergleiche. Sie können bis zu 3 Fahrzeuge vergleichen.',
    testDrives: 'Noch keine Anfragen. Starten Sie eine Anfrage auf einer Fahrzeug- oder Angebotsseite.',
    documents: 'Noch keine Dokumente. Laden Sie Unterlagen auf Ihrer Angebotsseite hoch.',
    vehicleStatus: 'Noch kein Auslieferungsstatus. Nach Bestellung sehen Sie hier den Fortschritt.',
  };
  return messages[tabId] ?? 'Noch keine Einträge.';
}
