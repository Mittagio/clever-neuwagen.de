/**
 * Multi-Source Intake – öffentliche Exports.
 * Neue Vertragsarten: contractKindRegistry erweitern.
 */
export {
  CONTRACT_KIND_REGISTRY,
  enrichContractDraftByKind,
  resolveContractKind,
} from './contractKindRegistry.js';
export { resolveContractTemporalStatus } from './resolveContractTemporalStatus.js';
export {
  buildMultiSourceIntake,
  enrichFactsForMultiSource,
  extractPersonNameFromDump,
  shouldBuildMultiSourceIntake,
} from './buildMultiSourceIntake.js';
export { buildMultiSourceIntakeReviewModel } from './buildMultiSourceIntakeReview.js';
export {
  evaluateComplexSellerTurn,
  shouldRouteComplexSellerTurnToServer,
  shouldUseSemanticInterpreter,
} from './evaluateComplexSellerTurn.js';
export {
  CLEVER_MULTI_SOURCE_INTAKE_PLAN_SCHEMA,
  CLEVER_MULTI_SOURCE_PROPOSED_ACTION_TYPES,
  CLEVER_MULTI_SOURCE_VEHICLE_ROLES,
  CLEVER_MULTI_SOURCE_TEMPORAL_SCOPES,
} from './cleverMultiSourceIntakePlanSchema.js';
export { interpretMultiSourceWithOpenAi } from './interpretMultiSourceWithOpenAi.js';
export {
  mergeMultiSourceIntakePlan,
  planToIntake,
  SENSITIVE_FIELD_BLOCKLIST,
} from './mergeMultiSourceIntakePlan.js';
export {
  extractMinimalContractContext,
  extractMinimalContractContexts,
} from './extractMinimalContractContext.js';
export {
  validateMultiSourceIntakePlan,
  validateUnits,
  validateMoneyVsMileage,
  validateTermAndMileage,
  validateVehicleRoles,
  validateTradeInVsInterest,
  validateTemporalScope,
  validateContractDates,
  validateContractStatus,
  validateCurrentVsHistoricalFacts,
  validateSourcesAndEvidence,
  redactSensitiveEvidence,
} from './validateMultiSourceIntakePlan.js';
