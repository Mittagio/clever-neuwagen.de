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
      expectedNextAction: { type: 'none' },
      forbiddenQuestions: [
        'Hauptauto',
        'Zweitwagen',
        'Langstrecke',
        'Wallbox',
        'Leasing',
        'Familie',
      ],
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

export const ALL_GOLDEN_CONVERSATIONS = [
  GOLDEN_CONVERSATION_SUV_7_LEASING,
  GOLDEN_CONVERSATION_EV3_RANGE,
  GOLDEN_CONVERSATION_ELECTRIC_KLEINWAGEN,
  GOLDEN_CONVERSATION_HYBRID_TOWING,
];
