/**
 * Sprint 17 – Digitaler Angebotsdialog
 * Event-Typen, Sonderwünsche, Status-Mapping
 */

export const OFFER_DIALOG_CHANNEL = 'offer';

export const OFFER_DIALOG_EVENTS = {
  customer_inquiry: {
    id: 'customer_inquiry',
    label: 'Anfrage gesendet',
    direction: 'inbound',
  },
  customer_question: {
    id: 'customer_question',
    label: 'Frage gestellt',
    direction: 'inbound',
  },
  customer_special_request: {
    id: 'customer_special_request',
    label: 'Sonderwunsch angegeben',
    direction: 'inbound',
  },
  customer_testdrive: {
    id: 'customer_testdrive',
    label: 'Probefahrt angefragt',
    direction: 'inbound',
  },
  customer_callback: {
    id: 'customer_callback',
    label: 'Rückruf angefordert',
    direction: 'inbound',
  },
  customer_offer_opened: {
    id: 'customer_offer_opened',
    label: 'Angebot angesehen',
    direction: 'inbound',
  },
  dealer_counter_offer: {
    id: 'dealer_counter_offer',
    label: 'Gegenangebot gesendet',
    direction: 'outbound',
  },
  customer_offer_accepted: {
    id: 'customer_offer_accepted',
    label: 'Angebot angenommen',
    direction: 'inbound',
  },
  customer_offer_declined: {
    id: 'customer_offer_declined',
    label: 'Angebot abgelehnt',
    direction: 'inbound',
  },
  documents_requested: {
    id: 'documents_requested',
    label: 'Unterlagen angefordert',
    direction: 'outbound',
  },
  selbstauskunft_completed: {
    id: 'selbstauskunft_completed',
    label: 'Selbstauskunft ausgefüllt',
    direction: 'inbound',
  },
  document_uploaded: {
    id: 'document_uploaded',
    label: 'Dokument hochgeladen',
    direction: 'inbound',
  },
};

export const SONDERWUNSCH_TOGGLES = [
  { id: 'anhaengerkupplung', label: 'Anhängerkupplung' },
  { id: 'gummifussmatten', label: 'Gummifußmatten' },
  { id: 'winterraeder', label: 'Winterräder' },
  { id: 'glasdach', label: 'Glasdach / Panorama' },
];

export const EMPTY_SONDERWUESNCHE = {
  wunschfarbe: '',
  anhaengerkupplung: false,
  gummifussmatten: false,
  winterraeder: false,
  glasdach: false,
  andereLaufzeit: '',
  andereKilometer: '',
  andereAnzahlung: '',
  sonstigerWunsch: '',
};

export const OFFER_ACTION_TO_EVENT = {
  inquiry: 'customer_inquiry',
  question: 'customer_question',
  testdrive: 'customer_testdrive',
  callback: 'customer_callback',
  accept: 'customer_offer_accepted',
  decline: 'customer_offer_declined',
  special_request: 'customer_special_request',
};

export const OFFER_ACTION_STATUS = {
  inquiry: 'neu',
  question: 'rueckfrageOffen',
  testdrive: 'probefahrt',
  callback: 'inBearbeitung',
  accept: 'bestellung',
  decline: 'verloren',
  special_request: 'neu',
};

export const COUNTER_OFFER_STATUS = {
  pending: { id: 'pending', label: 'Offen' },
  accepted: { id: 'accepted', label: 'Angenommen' },
  declined: { id: 'declined', label: 'Abgelehnt' },
  superseded: { id: 'superseded', label: 'Ersetzt' },
};

export const CUSTOMER_COUNTER_RESPONSES = {
  accept: { id: 'accept', label: 'Angebot annehmen' },
  decline: { id: 'decline', label: 'Ablehnen' },
  question: { id: 'question', label: 'Rückfrage stellen' },
};

export const SESSION_LEAD_KEY = (offerCode) => `clever-neuwagen-offer-lead-${offerCode}`;
