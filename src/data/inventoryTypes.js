/**
 * Lager- & Vorlaufsystem – Fahrzeugtypen
 */

export const INVENTORY_TYPES = {
  lager: {
    id: 'lager',
    label: 'Lagerfahrzeug',
    emoji: '🟢',
    customerLabel: 'Sofort verfügbar',
    priority: 1,
    className: 'inv-lager',
  },
  vorlauf: {
    id: 'vorlauf',
    label: 'Vorlauffahrzeug',
    emoji: '🟡',
    customerLabel: 'Verfügbar ab',
    priority: 2,
    className: 'inv-vorlauf',
  },
  bestellt: {
    id: 'bestellt',
    label: 'Bestellt',
    emoji: '🔵',
    customerLabel: 'Bereits bestellt',
    priority: 3,
    className: 'inv-bestellt',
  },
  konfigurierbar: {
    id: 'konfigurierbar',
    label: 'Konfigurierbar',
    emoji: '⚪',
    customerLabel: 'Individuell bestellbar',
    priority: 4,
    className: 'inv-konfigurierbar',
  },
};

export const INVENTORY_TYPE_OPTIONS = Object.values(INVENTORY_TYPES);

/** Legacy status → neuer Typ */
export const LEGACY_STATUS_MAP = {
  Lager: 'lager',
  Vorlauf: 'vorlauf',
  Bestellt: 'bestellt',
  Konfigurierbar: 'konfigurierbar',
};
