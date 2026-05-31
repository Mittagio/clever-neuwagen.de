/**
 * Ober-Admin Katalog – Marken & Modelle (Clever-Neuwagen zentral)
 * Händler dürfen diese Daten nicht ändern.
 */

export const BRAND_STATUS = {
  active: { label: 'Aktiv', className: 'status-active' },
  planned: { label: 'Geplant', className: 'status-planned' },
};

export const MODEL_STATUS = {
  complete: { label: 'Vollständig gepflegt', className: 'status-complete' },
  review: { label: 'Prüfung nötig', className: 'status-review' },
  outdated: { label: 'Veraltet', className: 'status-outdated' },
  draft: { label: 'Entwurf', className: 'status-draft' },
};

export const CHANGE_STATUS = {
  published: { label: 'Veröffentlicht', className: 'status-active' },
  review: { label: 'In Prüfung', className: 'status-review' },
  draft: { label: 'Entwurf', className: 'status-draft' },
};

export const brands = [
  { id: 'kia', name: 'Kia', status: 'active', modelCount: 8 },
  { id: 'hyundai', name: 'Hyundai', status: 'planned', modelCount: 0 },
  { id: 'vw', name: 'VW', status: 'planned', modelCount: 0 },
  { id: 'bmw', name: 'BMW', status: 'planned', modelCount: 0 },
  { id: 'mercedes', name: 'Mercedes-Benz', status: 'planned', modelCount: 0 },
];

export const kiaModels = [
  { id: 'sportage', name: 'Sportage', segment: 'Kompakt-SUV', status: 'complete', hasDetail: true },
  { id: 'ev3', name: 'EV3', segment: 'Elektro-SUV', status: 'review', hasDetail: false },
  { id: 'ev4', name: 'EV4', segment: 'Elektro-Limousine', status: 'draft', hasDetail: false },
  { id: 'ev5', name: 'EV5', segment: 'Elektro-SUV', status: 'draft', hasDetail: false },
  { id: 'picanto', name: 'Picanto', segment: 'Kleinwagen', status: 'outdated', hasDetail: false },
  { id: 'ceed', name: 'Ceed', segment: 'Kompakt', status: 'review', hasDetail: false },
  { id: 'sorento', name: 'Sorento', segment: 'SUV', status: 'draft', hasDetail: false },
  { id: 'niro', name: 'Niro', segment: 'Hybrid-SUV', status: 'review', hasDetail: false },
];

export const SPORTAGE_TABS = [
  { id: 'grunddaten', label: 'Grunddaten' },
  { id: 'motoren', label: 'Motoren' },
  { id: 'ausstattungen', label: 'Ausstattungen' },
  { id: 'farben', label: 'Farben' },
  { id: 'pakete', label: 'Pakete' },
  { id: 'serienausstattung', label: 'Serienausstattung' },
  { id: 'wltp', label: 'WLTP' },
  { id: 'bilder', label: 'Bilder' },
  { id: 'aenderungsverlauf', label: 'Verlauf' },
];

export const DEALER_READONLY_NOTE =
  'Händler dürfen diese Stammdaten nicht ändern. Sie dienen nur als Grundlage für Konfigurator und Angebote. Händler pflegen separat: Rabatt, Leasingfaktoren, Finanzierung, Lieferzeit, Lager/Vorlauf.';
