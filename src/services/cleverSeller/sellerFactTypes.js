/**
 * Semantische Fact-Klassen für Seller Universal Input.
 * Customer Fact ≠ Customer Need – verbindlich.
 */

export const SELLER_FACT_CLASS = {
  CUSTOMER_FACT: 'customer_fact',
  CUSTOMER_NEED: 'customer_need',
  COMMERCIAL_PREFERENCE: 'commercial_preference',
  VEHICLE_INTEREST: 'vehicle_interest',
  VEHICLE_REQUIREMENT: 'vehicle_requirement',
  EXISTING_VEHICLE: 'existing_vehicle',
  TRADE_IN_FACT: 'trade_in_fact',
  FINANCE_FACT: 'finance_fact',
  SELF_DISCLOSURE_FACT: 'self_disclosure_fact',
  CONTRACT_FACT: 'contract_fact',
  DOCUMENT_FACT: 'document_fact',
  APPOINTMENT_FACT: 'appointment_fact',
  SELLER_NOTE: 'seller_note',
  SELLER_FACT: 'seller_fact',
  VEHICLE_FACT_REQUEST: 'vehicle_fact_request',
  MESSAGE_INSTRUCTION: 'message_instruction',
  OFFER_INSTRUCTION: 'offer_instruction',
  PROCESS_INSTRUCTION: 'process_instruction',
};

export const SELLER_FACT_SOURCE = {
  CUSTOMER_MESSAGE: 'customer_message',
  SELLER_INPUT: 'seller_input',
  DOCUMENT: 'document',
  VERIFIED_VEHICLE_DATA: 'verified_vehicle_data',
  OFFER_PDF: 'offer_pdf',
  SYSTEM: 'system',
  MANUAL_EDIT: 'manual_edit',
  OPENAI_INTERPRETATION: 'openai_interpretation',
};

export const SELLER_INPUT_MODE = {
  CUSTOMER_MESSAGE: 'customer_message',
  CLEVER_WORK_INPUT: 'clever_work_input',
  AMBIGUOUS: 'ambiguous',
};

export const SELLER_TURN_INTENTS = {
  UPDATE_CUSTOMER_CONTEXT: 'update_customer_context',
  PREPARE_OFFER: 'prepare_offer',
  SEND_PORTFOLIO: 'send_portfolio',
  DRAFT_MESSAGE: 'draft_message',
  REQUEST_DOCUMENTS: 'request_documents',
  PREPARE_TRADE_IN: 'prepare_trade_in',
  PROPOSE_APPOINTMENT: 'propose_appointment',
  LOOKUP_VEHICLE_FACT: 'lookup_vehicle_fact',
  GET_TODAY_OVERVIEW: 'get_today_overview',
  SEARCH_CUSTOMER_HISTORY: 'search_customer_history',
  CUSTOMER_LOOKUP: 'customer_lookup',
  RECOMMEND_NEXT_STEP: 'recommend_next_step',
  ADD_NOTE: 'add_note',
  PREPARE_CALLBACK: 'prepare_callback',
  UNKNOWN: 'unknown',
};
