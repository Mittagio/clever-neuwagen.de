/**
 * Golden Conversations – synthetische Erwartungen (keine Live-API).
 */

export const GOLDEN_CONVERSATION_SUV_7_LEASING = {
  id: 'suv-7-seats-leasing',
  initialUnderstanding: { labels: [] },
  conversation: [
    {
      customer: 'Ich suche einen SUV mit 7 Sitzen bei Kia.',
      expectedNeedProfile: { bodyType: 'suv', persons: 7 },
      expectedLabels: ['SUV', '7 Sitze'],
      expectedVehicleDirections: ['sorento', 'ev9'],
      forbiddenVehicleDirections: ['sportage', 'ev3'],
      expectedNextAction: { type: 'ask_vehicle_disambiguation' },
      forbiddenQuestions: ['Hauptauto', 'Zweitwagen', 'Wallbox', 'Langstrecke'],
    },
    {
      customer: 'Elektrisch.',
      expectedNeedProfile: { fuel: 'electric' },
      expectedVehicleDirections: ['ev9'],
      forbiddenVehicleDirections: ['sorento'],
      forbiddenQuestions: ['Hauptauto', 'Wallbox', 'Langstrecke'],
    },
    {
      customer: 'Leasen.',
      expectedNeedProfile: { budget: { paymentType: 'leasing' } },
      expectedNextAction: { type: 'ask_offer_parameter', targetField: 'annualMileage' },
    },
    {
      customer: '15.000 km.',
      expectedNeedProfile: { annualKm: 15000 },
      expectedNextAction: { type: 'ask_offer_parameter', targetField: 'durationMonths' },
    },
    {
      customer: '48 Monate Angebot.',
      expectedNeedProfile: { leaseDurationMonths: 48 },
      expectedNextAction: { type: 'ask_offer_parameter', targetField: 'downPayment' },
    },
    {
      customer: '0 Euro.',
      expectedNeedProfile: { budget: { downPayment: 0 } },
      expectedNextAction: { type: 'ask_offer_parameter', targetField: 'neededBy' },
    },
    {
      customer: 'In ein bis drei Monaten.',
      expectedNeedProfile: { timelineLabel: 'Bedarf in 1–3 Monaten' },
      expectedHandoff: { ready: true },
      forbiddenQuestions: ['Was ist Ihnen wichtig'],
    },
  ],
};

export const GOLDEN_CONVERSATION_EV3_RANGE = {
  id: 'ev3-range-knowledge',
  conversation: [
    {
      customer: 'Wie weit kommt der EV3?',
      expectedIntent: 'knowledge_question',
      expectedModel: 'ev3',
      // Zielgerichtet: themenbezogene Anschlussfrage erlaubt; generische Verkaufsfragen verboten.
      forbiddenQuestions: [
        'Hauptauto',
        'Zweitwagen',
        'Langstrecke',
        'Wallbox',
        'Leasing',
        'Familie',
        'Was ist Ihnen am wichtigsten',
      ],
      forbidsNeedFromFactAlone: true,
      requiresUsedFactIds: true,
    },
  ],
};

export const GOLDEN_CONVERSATION_ELECTRIC_KLEINWAGEN = {
  id: 'electric-kleinwagen',
  conversation: [
    {
      customer: 'Ich suche einen Elektro-Kleinwagen bei Kia.',
      expectedNeedProfile: { fuel: 'electric', bodyType: 'kleinwagen' },
      expectedVehicleDirections: ['ev2'],
      forbiddenVehicleDirections: ['ev3'],
      expectedNextAction: { type: 'none' },
    },
  ],
};

export const GOLDEN_CONVERSATION_HYBRID_TOWING = {
  id: 'hybrid-towing-1500',
  conversation: [
    {
      customer: 'Ich suche einen Hybrid mit mindestens 1.500 kg Anhängelast.',
      expectedNeedProfile: { fuel: 'hybrid', towCapacityKg: 1500 },
      forbiddenVehicleDirections: ['niro'],
      expectedNextAction: { type: 'none' },
      forbiddenQuestions: ['Langstrecke'],
    },
  ],
};

export const GOLDEN_CONVERSATION_EV9_TOWING_INTERNAL = {
  id: 'ev9-towing-internal',
  conversation: [
    {
      customer: 'Wie viel Anhängelast hat der EV9?',
      expectedIntent: 'knowledge_question',
      expectedModel: 'ev9',
      forbidsNeedFromFactAlone: true,
      requiresUsedFactIds: true,
      forbidsWebSearch: true,
      forbiddenQuestions: ['Hauptauto', 'Zweitwagen', 'Wallbox'],
    },
  ],
};

export const GOLDEN_CONVERSATION_EV9_CARGO_GOAL_DRIVEN = {
  id: 'ev9-cargo-goal-driven',
  conversation: [
    {
      customer: 'Wie lang ist der Laderaum beim EV9?',
      expectedIntent: 'knowledge_question',
      expectedModel: 'ev9',
      forbidsNeedFromFactAlone: true,
      expectedLabelsAbsent: ['ca. 2 m Ladelänge'],
      expectedNextAction: { type: 'ask_vehicle_disambiguation' },
      expectedNextActionReason: 'need_clarification',
      forbiddenQuestions: [
        'Hauptauto',
        'Zweitwagen',
        'Wallbox',
        'Wie nutzen Sie',
        'Was ist Ihnen am wichtigsten',
      ],
      expectedQuestionTopics: ['sitz', 'lade', 'umgelegt', 'dritte'],
    },
    {
      customer: 'Die dritte Sitzreihe brauche ich nur gelegentlich. Ich möchte aber zwei Meter lange Gegenstände transportieren.',
      expectedLabels: ['7 Sitze gelegentlich', 'ca. 2 m Ladelänge'],
      expectedNeedProfileHints: { persons: 7 },
      forbiddenQuestions: ['Hauptauto', 'Zweitwagen', 'Wallbox'],
      expectedProgressToward: ['vehicle_compare', 'offer', 'handoff'],
    },
  ],
};

export const GOLDEN_CONVERSATION_UNKNOWN_BRAND_OFFICIAL = {
  id: 'unknown-brand-official-source',
  conversation: [
    {
      customer: 'Hat der neue BYD Seal ein Head-up-Display?',
      expectedIntent: 'knowledge_question',
      allowsProvisionalOfficial: true,
      expectedNextAction: { type: 'none' },
    },
  ],
};

export const GOLDEN_CONVERSATION_OFFICIAL_NOT_FOUND = {
  id: 'official-source-not-found',
  conversation: [
    {
      customer: 'Wie hoch ist die Anhängelast des BYD Dolphin?',
      expectedIntent: 'knowledge_question',
      expectsSellerVerification: true,
      expectedNextAction: { type: 'none' },
    },
  ],
};

export const GOLDEN_CONVERSATION_DATA_CONFLICT = {
  id: 'data-conflict-towing',
  conversation: [
    {
      customer: 'Stimmt die Anhängelast vom EV9?',
      expectedIntent: 'knowledge_question',
      expectsConflictHandling: true,
      expectedNextAction: { type: 'none' },
    },
  ],
};

export const GOLDEN_CONVERSATION_UNNECESSARY_QUESTION_FEEDBACK = {
  id: 'unnecessary-question-feedback',
  conversation: [
    {
      customer: 'Elektro-Kleinwagen bei Kia?',
      sellerFeedbackCategory: 'unnecessary_question',
      sellerCorrection: 'Zuerst passendes Modell zeigen, nicht nach Hauptauto fragen.',
      expectedNextAction: { type: 'none' },
    },
  ],
};

export const GOLDEN_CONVERSATION_MISSED_NEED_FEEDBACK = {
  id: 'missed-customer-need-feedback',
  conversation: [
    {
      customer: 'Ich brauche 7 Sitze und Leasing.',
      sellerFeedbackCategory: 'missed_customer_need',
      sellerCorrection: '7 Sitze und Leasing im Kundenbild sichern.',
    },
  ],
};

export const GOLDEN_LEXICON_SEVEN_SEATS = {
  id: 'lexicon-seven-seats',
  surface: 'lexicon',
  conversation: [
    {
      customer: 'Welche Kia haben sieben Sitze?',
      expectedIntent: 'model_discovery',
      expectedModels: ['ev9', 'sorento'],
      forbidsNeedProfileChange: true,
      forbidsSalesQuestions: true,
      requiresEvidence: true,
    },
  ],
};

export const GOLDEN_LEXICON_800V = {
  id: 'lexicon-800v-tech',
  surface: 'lexicon',
  conversation: [
    {
      customer: 'Was ist 800-Volt-Technik?',
      expectedIntent: 'technology_explanation',
      forbidsNeedProfileChange: true,
      forbidsSalesQuestions: true,
    },
  ],
};

export const GOLDEN_SELLER_EV9_SUMMARY = {
  id: 'seller-ev9-leasing-summary',
  surface: 'seller_dashboard',
  conversation: [
    {
      customer: 'Was sucht der Kunde genau?',
      expectedIntent: 'customer_summary',
      expectedLabels: ['SUV', '7 Sitze', 'Elektro', 'Leasing', '15.000', '48', '0'],
    },
  ],
};

export const GOLDEN_SELLER_WHATSAPP_DRAFT = {
  id: 'seller-whatsapp-draft',
  surface: 'seller_dashboard',
  conversation: [
    {
      customer: 'Schreibe eine kurze WhatsApp zum Angebot.',
      expectedIntent: 'message_draft',
      requiresSellerConfirmation: true,
      forbidsAutoSend: true,
    },
  ],
};

/** Intake v1.0 – Pflichtfälle A–H (deterministisch in customerIntakeGolden.test.js) */
export const GOLDEN_INTAKE_A_ELECTRO_HUD_TOW = {
  id: 'intake-a-electro-hud-tow',
  productLaw: 'customer_intake',
  conversation: [
    {
      customer: 'Ich suche einen Elektro mit Head-up-Display und Anhängerkupplung.',
      expectedLabels: ['Elektro', 'Head-up-Display', 'Anhängerkupplung'],
      forbidsRecommendationLanguage: true,
      expectsPermanentExits: true,
    },
  ],
};

export const GOLDEN_INTAKE_B_TOW_RANGE = {
  id: 'intake-b-tow-range',
  productLaw: 'customer_intake',
  conversation: [
    {
      customer: 'Anhänger zwischen 500 kg und 2 Tonnen.',
      expectedLabelsMatch: [/Anhängelast:\s*ca\./i],
      forbidsExactTowKg: 2000,
    },
  ],
};

export const GOLDEN_INTAKE_C_COLOR_ALT = {
  id: 'intake-c-color-alt',
  productLaw: 'customer_intake',
  conversation: [
    {
      customer: 'Rot wäre schön, meine Frau will Blau.',
      expectedLabelsMatch: [/Rot\s*\/\s*Blau|Blau\s*\/\s*Rot/i],
      forbidsSingleColorDecision: true,
    },
  ],
};

export const GOLDEN_INTAKE_D_EV3_OR_EV6 = {
  id: 'intake-d-ev3-or-ev6',
  productLaw: 'customer_intake',
  conversation: [
    {
      customer: 'EV3 oder EV6.',
      expectedLabels: ['EV3', 'EV6'],
      forbidsSelectedModelWinner: true,
    },
  ],
};

export const GOLDEN_INTAKE_E_HUD_CORRECTION = {
  id: 'intake-e-hud-correction',
  productLaw: 'customer_intake',
  conversation: [
    {
      customer: 'HUD brauche ich doch nicht.',
      removesLabelsMatch: [/Head-up|HUD/i],
    },
  ],
};

export const GOLDEN_INTAKE_F_EARLY_OFFER = {
  id: 'intake-f-early-offer',
  productLaw: 'customer_intake',
  conversation: [
    {
      customer: 'Schicken Sie mir jetzt ein Angebot.',
      expectedHandoff: { ready: true },
      allowsIncompleteProfile: true,
    },
  ],
};

export const GOLDEN_INTAKE_G_SELLER_CONTACT = {
  id: 'intake-g-seller-contact',
  productLaw: 'customer_intake',
  conversation: [
    {
      customer: 'Ich möchte mit einem Verkäufer sprechen.',
      expectedHandoff: { ready: true },
      expectedNextAction: { type: 'none' },
    },
  ],
};

export const GOLDEN_INTAKE_H_FACTS_NOT_WISHES = {
  id: 'intake-h-facts-not-wishes',
  productLaw: 'customer_intake',
  conversation: [
    {
      customer: 'Wie lang ist der Laderaum des EV9?',
      expectedIntent: 'knowledge_question',
      forbidsNeedFromFactAlone: true,
      expectedLabelsAbsent: ['ca. 2 m Ladelänge'],
      expectsPermanentExits: true,
    },
  ],
};

export const ALL_GOLDEN_CONVERSATIONS = [
  GOLDEN_CONVERSATION_SUV_7_LEASING,
  GOLDEN_CONVERSATION_EV3_RANGE,
  GOLDEN_CONVERSATION_ELECTRIC_KLEINWAGEN,
  GOLDEN_CONVERSATION_HYBRID_TOWING,
  GOLDEN_CONVERSATION_EV9_TOWING_INTERNAL,
  GOLDEN_CONVERSATION_EV9_CARGO_GOAL_DRIVEN,
  GOLDEN_CONVERSATION_UNKNOWN_BRAND_OFFICIAL,
  GOLDEN_CONVERSATION_OFFICIAL_NOT_FOUND,
  GOLDEN_CONVERSATION_DATA_CONFLICT,
  GOLDEN_CONVERSATION_UNNECESSARY_QUESTION_FEEDBACK,
  GOLDEN_CONVERSATION_MISSED_NEED_FEEDBACK,
  GOLDEN_LEXICON_SEVEN_SEATS,
  GOLDEN_LEXICON_800V,
  GOLDEN_SELLER_EV9_SUMMARY,
  GOLDEN_SELLER_WHATSAPP_DRAFT,
  GOLDEN_INTAKE_A_ELECTRO_HUD_TOW,
  GOLDEN_INTAKE_B_TOW_RANGE,
  GOLDEN_INTAKE_C_COLOR_ALT,
  GOLDEN_INTAKE_D_EV3_OR_EV6,
  GOLDEN_INTAKE_E_HUD_CORRECTION,
  GOLDEN_INTAKE_F_EARLY_OFFER,
  GOLDEN_INTAKE_G_SELLER_CONTACT,
  GOLDEN_INTAKE_H_FACTS_NOT_WISHES,
];
