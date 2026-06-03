/**
 * Demo-Daten & Status-Labels für Kundenbereich
 */

export const CUSTOMER_STATUS = {
  angefragt: { label: 'Angefragt', className: 'cust-status-requested' },
  verglichen: { label: 'Verglichen', className: 'cust-status-compared' },
  angebot: { label: 'Angebot erhalten', className: 'cust-status-offer' },
  gespeichert: { label: 'Gespeichert', className: 'cust-status-saved' },
  geplant: { label: 'Geplant', className: 'cust-status-planned' },
};

export const CUSTOMER_TABS = [
  { id: 'offers', label: 'Angebote', key: 'offers' },
  { id: 'comparisons', label: 'Vergleiche', key: 'comparisons' },
  { id: 'configurations', label: 'Konfigurationen', key: 'configurations' },
  { id: 'favorites', label: 'Favoriten', key: 'favorites' },
  { id: 'testDrives', label: 'Probefahrten', key: 'testDrives' },
];

export function getVehicleLabel(item) {
  if (item.label) return item.label;
  return `${item.model} ${item.variant ?? ''}`.trim();
}

export function getEmptyTabMessage(tabId) {
  const messages = {
    offers: 'Noch keine Angebote. Starten Sie eine Suche und speichern Sie passende Händlerangebote.',
    comparisons: 'Noch keine Vergleiche. Sie können bis zu 3 Fahrzeuge vergleichen.',
    configurations: 'Noch keine gespeicherten Konfigurationen.',
    favorites: 'Noch keine Favoriten. Markieren Sie Fahrzeuge in den Suchergebnissen.',
    testDrives: 'Noch keine Probefahrten angefragt.',
  };
  return messages[tabId] ?? 'Noch keine Einträge.';
}
