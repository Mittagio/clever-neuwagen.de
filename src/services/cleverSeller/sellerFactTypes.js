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
  RESOLVE_CUSTOMER_CONTEXT: 'resolve_customer_context',
  RESOLVE_RELATIVE_DATETIME: 'resolve_relative_datetime',
  LOOKUP_VEHICLE_FACT: 'lookup_vehicle_fact',
  RESOLVE_VEHICLE: 'resolve_vehicle',
  LOOKUP_VEHICLE_PACKAGE: 'lookup_vehicle_package',
  LOOKUP_VEHICLE_EQUIPMENT: 'lookup_vehicle_equipment',
  GET_TODAY_OVERVIEW: 'get_today_overview',
  SEARCH_CUSTOMER_HISTORY: 'search_customer_history',
  SEARCH_CUSTOMER_MESSAGES: 'search_customer_messages',
  SEARCH_CUSTOMER_OFFERS: 'search_customer_offers',
  SEARCH_CUSTOMER_ACTIVITIES: 'search_customer_activities',
  FIND_CUSTOMER: 'find_customer',
  OPEN_CUSTOMER: 'open_customer',
  SUMMARIZE_CUSTOMER_CONTEXT: 'summarize_customer_context',
  /** @deprecated Alias – prefer FIND_CUSTOMER / OPEN_CUSTOMER */
  CUSTOMER_LOOKUP: 'customer_lookup',
  RECOMMEND_NEXT_STEP: 'recommend_next_step',
  ADD_NOTE: 'add_note',
  PREPARE_CALLBACK: 'prepare_callback',
  /** Altvertrag einlesen (Contract Memory Slice 6) */
  IMPORT_CUSTOMER_CONTRACT: 'import_customer_contract',
  /** Altvertrag nachschlagen (Contract Memory Slice 7) */
  SEARCH_CUSTOMER_CONTRACTS: 'search_customer_contracts',
  /** Altvertrag vs. Angebot vergleichen (Contract Memory Slice 9) */
  COMPARE_CONTRACT_WITH_OFFER: 'compare_contract_with_offer',
  /** Alias für Tool-/Result-Contract */
  DRAFT_CUSTOMER_MESSAGE: 'draft_customer_message',
  UNKNOWN: 'unknown',
};
