/** DSGVO-Dokumententypen – Tresor (max. 48h Speicherung) */

export const DOCUMENT_TYPES = [
  { id: 'personalausweis', label: 'Personalausweis' },
  { id: 'fuehrerschein', label: 'Führerschein' },
  { id: 'gehaltsnachweise', label: 'Gehaltsnachweise' },
  { id: 'lohnabrechnungen', label: 'Lohnabrechnungen' },
  { id: 'schwerbehindertenausweis', label: 'Schwerbehindertenausweis' },
  { id: 'selbstauskunft', label: 'Selbstauskunft (PDF/Scan)' },
  { id: 'finanzierungsunterlagen', label: 'Finanzierungsunterlagen' },
];

export const DOCUMENT_TTL_HOURS = 48;

export function getDocumentTypeLabel(typeId) {
  return DOCUMENT_TYPES.find((t) => t.id === typeId)?.label ?? typeId;
}
