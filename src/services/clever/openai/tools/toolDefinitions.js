/**
 * OpenAI Function Tool Definitionen für Clever Conversation.
 */
import { PRIMARY_MODEL_KEYS } from './findMatchingVehicles.js';

export const CLEVER_CONVERSATION_TOOLS = [
  {
    type: 'function',
    name: 'find_matching_vehicles',
    description: 'Sucht Fahrzeuge anhand harter, verifizierter Kriterien. Keine Halluzinationen.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        brand: { type: 'string' },
        bodyType: { type: 'string' },
        fuelType: { type: 'string' },
        hybridPowertrain: { type: 'string' },
        minimumSeats: { type: 'integer' },
        minimumWltpRangeKm: { type: 'integer' },
        minimumTowingCapacityKg: { type: 'integer' },
        maximumListPrice: { type: 'number' },
        requiredFeatures: { type: 'array', items: { type: 'string' } },
        interestedModelKeys: { type: 'array', items: { type: 'string' } },
        excludedModelKeys: { type: 'array', items: { type: 'string' } },
      },
    },
    strict: false,
  },
  {
    type: 'function',
    name: 'get_verified_vehicle_facts',
    description: 'Liefert nur verifizierte Fakten zu einem Modell oder einer Variante.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['modelKey', 'requestedFacts'],
      properties: {
        modelKey: { type: 'string', enum: PRIMARY_MODEL_KEYS },
        variantKey: { type: ['string', 'null'] },
        requestedFacts: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'wltpRange',
              'batteryCapacity',
              'seats',
              'towingCapacity',
              'headUpDisplay',
              'charging',
              'dimensions',
              'listPrice',
              'deliveryTime',
            ],
          },
        },
      },
    },
    strict: false,
  },
  {
    type: 'function',
    name: 'get_supported_offer_parameters',
    description: 'Erlaubte Werte für Angebotsparameter (Leasing, Laufzeit, km, Sonderzahlung).',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        field: {
          type: 'string',
          enum: ['purchaseType', 'annualMileage', 'durationMonths', 'downPayment', 'neededBy'],
        },
      },
    },
    strict: false,
  },
];
