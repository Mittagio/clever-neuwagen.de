/**
 * Strict JSON Schema für CleverMultiSourceIntakePlan (OpenAI Responses / json_schema).
 * OpenAI = primäres Sprachverständnis; Clever validiert danach deterministisch.
 */

const TEMPORAL_SCOPE = ['current', 'historical', 'proposed', 'unknown'];
const VEHICLE_ROLE = [
  'desired_vehicle',
  'existing_vehicle',
  'trade_in_vehicle',
  'historical_contract_vehicle',
  'comparison_vehicle',
  'unknown',
];
const PROPOSED_ACTION_TYPES = [
  'find_customer',
  'prepare_customer_creation',
  'import_historical_contract',
  'prepare_trade_in',
  'create_vehicle_interest',
  'create_commercial_scenario',
  'update_current_customer_facts',
  'prepare_offer',
  'attach_working_context',
];

const FACT_ITEM = {
  type: 'object',
  additionalProperties: false,
  required: [
    'field',
    'value',
    'unit',
    'temporalScope',
    'role',
    'sourceType',
    'sourceId',
    'evidence',
    'confidence',
  ],
  properties: {
    field: { type: 'string' },
    value: {
      anyOf: [
        { type: 'string' },
        { type: 'number' },
        { type: 'boolean' },
        { type: 'null' },
      ],
    },
    unit: { type: ['string', 'null'] },
    temporalScope: { type: 'string', enum: TEMPORAL_SCOPE },
    role: { type: ['string', 'null'] },
    sourceType: { type: ['string', 'null'] },
    sourceId: { type: ['string', 'null'] },
    evidence: { type: ['string', 'null'] },
    confidence: { type: 'number' },
  },
};

const CUSTOMER_CANDIDATE = {
  type: 'object',
  additionalProperties: false,
  required: ['fullName', 'firstName', 'lastName', 'email', 'phone', 'sourceType', 'confidence'],
  properties: {
    fullName: { type: ['string', 'null'] },
    firstName: { type: ['string', 'null'] },
    lastName: { type: ['string', 'null'] },
    email: { type: ['string', 'null'] },
    phone: { type: ['string', 'null'] },
    sourceType: { type: ['string', 'null'] },
    confidence: { type: 'number' },
  },
};

const VEHICLE_INTEREST = {
  type: 'object',
  additionalProperties: false,
  required: [
    'make',
    'model',
    'trim',
    'color',
    'equipment',
    'role',
    'label',
    'sourceType',
    'sourceId',
    'confidence',
  ],
  properties: {
    make: { type: ['string', 'null'] },
    model: { type: ['string', 'null'] },
    trim: { type: ['string', 'null'] },
    color: { type: ['string', 'null'] },
    equipment: { type: 'array', items: { type: 'string' } },
    role: { type: 'string', enum: VEHICLE_ROLE },
    label: { type: ['string', 'null'] },
    sourceType: { type: ['string', 'null'] },
    sourceId: { type: ['string', 'null'] },
    confidence: { type: 'number' },
  },
};

const TRADE_IN = {
  type: 'object',
  additionalProperties: false,
  required: ['make', 'model', 'label', 'role', 'ambiguous', 'sourceType', 'sourceId', 'confidence'],
  properties: {
    make: { type: ['string', 'null'] },
    model: { type: ['string', 'null'] },
    label: { type: ['string', 'null'] },
    role: { type: 'string', enum: VEHICLE_ROLE },
    ambiguous: { type: 'boolean' },
    sourceType: { type: ['string', 'null'] },
    sourceId: { type: ['string', 'null'] },
    confidence: { type: 'number' },
  },
};

const COMMERCIAL = {
  type: 'object',
  additionalProperties: false,
  required: [
    'type',
    'termMonths',
    'annualMileage',
    'purchasePrice',
    'sourceType',
    'sourceId',
    'confidence',
  ],
  properties: {
    type: { type: ['string', 'null'] },
    termMonths: { type: ['number', 'null'] },
    annualMileage: { type: ['number', 'null'] },
    purchasePrice: { type: ['number', 'null'] },
    sourceType: { type: ['string', 'null'] },
    sourceId: { type: ['string', 'null'] },
    confidence: { type: 'number' },
  },
};

const HISTORICAL_CONTRACT = {
  type: 'object',
  additionalProperties: false,
  required: [
    'kind',
    'vehicleMake',
    'vehicleModel',
    'vehicleRole',
    'monthlyRate',
    'finalPayment',
    'contractEndDate',
    'contractStartDate',
    'totalMileage',
    'annualMileage',
    'excessMileageRate',
    'underMileageRate',
    'temporalStatusHint',
    'sourceType',
    'sourceId',
    'confidence',
  ],
  properties: {
    kind: {
      type: 'string',
      enum: ['leasing', 'financing', 'three_way', 'purchase', 'unknown'],
    },
    vehicleMake: { type: ['string', 'null'] },
    vehicleModel: { type: ['string', 'null'] },
    vehicleRole: { type: 'string', enum: VEHICLE_ROLE },
    monthlyRate: { type: ['number', 'null'] },
    finalPayment: { type: ['number', 'null'] },
    contractEndDate: { type: ['string', 'null'] },
    contractStartDate: { type: ['string', 'null'] },
    totalMileage: { type: ['number', 'null'] },
    annualMileage: { type: ['number', 'null'] },
    excessMileageRate: { type: ['number', 'null'] },
    underMileageRate: { type: ['number', 'null'] },
    temporalStatusHint: {
      anyOf: [
        { type: 'null' },
        {
          type: 'string',
          enum: [
            'active',
            'ended',
            'historical_or_ended',
            'status_needs_confirmation',
            'unknown',
          ],
        },
      ],
    },
    sourceType: { type: ['string', 'null'] },
    sourceId: { type: ['string', 'null'] },
    confidence: { type: 'number' },
  },
};

export const CLEVER_MULTI_SOURCE_INTAKE_PLAN_SCHEMA = {
  name: 'CleverMultiSourceIntakePlan',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'turnType',
      'customerCandidates',
      'currentCustomerFacts',
      'historicalCustomerFacts',
      'vehicleInterests',
      'commercialScenarios',
      'tradeInCandidates',
      'historicalContracts',
      'documentClassifications',
      'conflicts',
      'ambiguities',
      'missingInformation',
      'proposedActions',
      'evidence',
      'confidence',
    ],
    properties: {
      turnType: {
        type: 'string',
        enum: [
          'customer_contract_tradein_intake',
          'multi_source_intake',
          'trade_in_intake',
          'contract_intake',
          'unknown',
        ],
      },
      customerCandidates: { type: 'array', items: CUSTOMER_CANDIDATE },
      currentCustomerFacts: { type: 'array', items: FACT_ITEM },
      historicalCustomerFacts: { type: 'array', items: FACT_ITEM },
      vehicleInterests: { type: 'array', items: VEHICLE_INTEREST },
      commercialScenarios: { type: 'array', items: COMMERCIAL },
      tradeInCandidates: { type: 'array', items: TRADE_IN },
      historicalContracts: { type: 'array', items: HISTORICAL_CONTRACT },
      documentClassifications: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['kind', 'label', 'sourceId', 'confidence'],
          properties: {
            kind: { type: ['string', 'null'] },
            label: { type: ['string', 'null'] },
            sourceId: { type: ['string', 'null'] },
            confidence: { type: 'number' },
          },
        },
      },
      conflicts: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'field', 'label', 'suggestedAction'],
          properties: {
            id: { type: 'string' },
            field: { type: ['string', 'null'] },
            label: { type: 'string' },
            suggestedAction: { type: ['string', 'null'] },
          },
        },
      },
      ambiguities: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'label', 'field'],
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            field: { type: ['string', 'null'] },
          },
        },
      },
      missingInformation: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'field', 'label'],
          properties: {
            id: { type: 'string' },
            field: { type: ['string', 'null'] },
            label: { type: 'string' },
          },
        },
      },
      proposedActions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'label', 'priority'],
          properties: {
            type: { type: 'string', enum: PROPOSED_ACTION_TYPES },
            label: { type: 'string' },
            priority: { type: 'number' },
          },
        },
      },
      evidence: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'sourceType', 'sourceId', 'field', 'snippet'],
          properties: {
            id: { type: 'string' },
            sourceType: { type: ['string', 'null'] },
            sourceId: { type: ['string', 'null'] },
            field: { type: ['string', 'null'] },
            snippet: { type: ['string', 'null'] },
          },
        },
      },
      confidence: { type: 'number' },
    },
  },
};

export const CLEVER_MULTI_SOURCE_PROPOSED_ACTION_TYPES = PROPOSED_ACTION_TYPES;
export const CLEVER_MULTI_SOURCE_VEHICLE_ROLES = VEHICLE_ROLE;
export const CLEVER_MULTI_SOURCE_TEMPORAL_SCOPES = TEMPORAL_SCOPE;
