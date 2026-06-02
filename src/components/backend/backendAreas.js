/** Händler-Backend – 4 Hauptbereiche (HubSpot/Apple-Struktur) */

export const BACKEND_AREAS = [
  { id: 'verkaufen', label: 'Verkaufen', icon: '🚀' },
  { id: 'fahrzeuge', label: 'Fahrzeuge', icon: '🚗' },
  { id: 'marketing', label: 'Marketing', icon: '📢' },
  { id: 'verwaltung', label: 'Verwaltung', icon: '⚙️' },
];

export const BACKEND_AREA_SECTIONS = {
  verkaufen: [
    { id: 'home', label: 'Start' },
  ],
  fahrzeuge: [
    { id: 'overview', label: 'Showroom' },
  ],
  marketing: [
    { id: 'hub', label: 'Übersicht' },
  ],
  verwaltung: [
    { id: 'hub', label: 'Übersicht' },
    { id: 'discounts', label: 'Rabatte', icon: '💶' },
    { id: 'leasing', label: 'Leasing', icon: '📋' },
    { id: 'finance', label: 'Finanzierung', icon: '🏦' },
    { id: 'delivery', label: 'Lieferzeit', icon: '🚚' },
  ],
};

export function getDefaultSection(areaId) {
  return BACKEND_AREA_SECTIONS[areaId]?.[0]?.id ?? 'home';
}

export function areaHasSubNav(areaId) {
  return (BACKEND_AREA_SECTIONS[areaId]?.length ?? 0) > 1;
}
