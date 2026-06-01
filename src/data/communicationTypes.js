/** Sprint 11 – Sales Communication Center */

export const COMMUNICATION_CHANNELS = {
  email: { id: 'email', label: 'E-Mail', icon: '📧' },
  whatsapp: { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  offer: { id: 'offer', label: 'Angebot', icon: '📄' },
  document: { id: 'document', label: 'Dokument', icon: '📎' },
  ai: { id: 'ai', label: 'KI-Antwort', icon: '🤖' },
  system: { id: 'system', label: 'System', icon: '⚙️' },
};

export const COMMUNICATION_STATUS_FILTERS = [
  { id: 'all', label: 'Alle' },
  { id: 'neu', label: 'Neu' },
  { id: 'angebotVersendet', label: 'Angebot versendet' },
  { id: 'probefahrt', label: 'Probefahrt' },
  { id: 'bestellung', label: 'Bestellung' },
  { id: 'ausgeliefert', label: 'Ausgeliefert' },
];

export const TEMPLATE_CATEGORIES = [
  { id: 'erstkontakt', label: 'Erstkontakt' },
  { id: 'angebot', label: 'Angebot' },
  { id: 'probefahrt', label: 'Probefahrt' },
  { id: 'vertrag', label: 'Vertragsversand' },
  { id: 'eingetroffen', label: 'Fahrzeug eingetroffen' },
  { id: 'auslieferung', label: 'Auslieferung' },
  { id: 'nachfassen', label: 'Nachfassen' },
  { id: 'corporate', label: 'Corporate Benefits' },
  { id: 'schwerbehinderung', label: 'Schwerbehindertenrabatt' },
];

export const DOCUMENT_TYPES = [
  { id: 'angebot', label: 'Angebot' },
  { id: 'vertrag', label: 'Vertrag' },
  { id: 'selbstauskunft', label: 'Selbstauskunft' },
  { id: 'vollmacht', label: 'Vollmacht' },
  { id: 'zulassung', label: 'Zulassungsunterlagen' },
];

export const REMINDER_PRESETS = [
  { id: 'tomorrow', label: 'Morgen anrufen', days: 1 },
  { id: 'followup3', label: 'In 3 Tagen nachfassen', days: 3 },
  { id: 'probefahrt', label: 'Probefahrt bestätigen', days: 2 },
  { id: 'contract', label: 'Vertragsstatus prüfen', days: 5 },
];

export const AI_SCENARIOS = [
  { id: 'erstkontakt', label: 'Erstkontakt' },
  { id: 'angebot', label: 'Angebot' },
  { id: 'nachfassen', label: 'Nachfassen' },
  { id: 'eingetroffen', label: 'Fahrzeug eingetroffen' },
  { id: 'vertrag', label: 'Vertragsversand' },
  { id: 'auslieferung', label: 'Auslieferung' },
];

export const AUDIT_ACTIONS = {
  EMAIL_SENT: 'email_sent',
  WHATSAPP_CREATED: 'whatsapp_created',
  OFFER_SENT: 'offer_sent',
  DOCUMENT_SENT: 'document_sent',
  AI_GENERATED: 'ai_generated',
  REMINDER_SET: 'reminder_set',
};
