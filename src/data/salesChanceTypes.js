/** Sprint 12 – Verkaufschancen-Arbeitsplatz */

export const CURRENT_SELLER_STORAGE_KEY = 'clever-neuwagen-current-seller';

export const DEALER_SELLERS = [
  { id: 'mike-quach', name: 'Mike Quach' },
  { id: 'andreas', name: 'Andreas' },
  { id: 'lisa', name: 'Lisa' },
  { id: 'thomas', name: 'Thomas' },
];

export const SALES_CHANCE_LIST_FILTERS = [
  { id: 'all', label: 'Alle' },
  { id: 'neu', label: 'Neu' },
  { id: 'inBearbeitung', label: 'In Bearbeitung' },
  { id: 'angebotVersendet', label: 'Angebot versendet' },
  { id: 'rueckfrageOffen', label: 'Rückfrage offen' },
  { id: 'probefahrt', label: 'Probefahrt geplant' },
  { id: 'bestellung', label: 'Bestellung' },
  { id: 'ausgeliefert', label: 'Ausgeliefert' },
  { id: 'verloren', label: 'Verloren' },
];

export const ASSIGNMENT_FILTERS = [
  { id: 'all', label: 'Alle Verkaufschancen' },
  { id: 'mine', label: 'Meine Verkaufschancen' },
  { id: 'unassigned', label: 'Nicht zugewiesen' },
];

export const CUSTOMER_GROUPS = [
  { id: 'standard', label: 'Standard' },
  { id: 'gewerbe', label: 'Gewerbe' },
  { id: 'behindert', label: 'Schwerbehindert' },
  { id: 'corporate', label: 'Corporate Benefits' },
];

export const DISCOUNT_TYPES = [
  { id: 'none', label: 'Kein Sonder-Rabatt' },
  { id: 'aktion', label: 'Aktionsrabatt' },
  { id: 'bestandskunde', label: 'Bestandskunde' },
  { id: 'fleet', label: 'Flotte / Gewerbe' },
];

export const CONTACT_PREFERENCES = [
  { id: 'phone', label: 'Telefon' },
  { id: 'email', label: 'E-Mail' },
  { id: 'whatsapp', label: 'WhatsApp' },
];

export const REMINDER_TYPES = [
  { id: 'call', label: 'Anruf' },
  { id: 'email', label: 'E-Mail' },
  { id: 'probefahrt', label: 'Probefahrt' },
  { id: 'contract', label: 'Vertrag' },
  { id: 'other', label: 'Sonstiges' },
];

export const TERM_OPTIONS = [24, 36, 48, 60];
export const MILEAGE_OPTIONS = [10000, 15000, 20000, 25000, 30000];

export const DOCUMENT_SLOT_LABELS = {
  selbstauskunft: 'Selbstauskunft',
  ausweis: 'Ausweis',
  fuehrerschein: 'Führerschein',
  voucher: 'Voucher',
  other: 'Sonstige Dokumente',
};
