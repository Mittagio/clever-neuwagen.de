/**
 * Sanitized API-Kontext für Clever Turns.
 */
import { buildCustomerUnderstanding } from '../../dealer/customerUnderstanding.js';
import {
  CLEVER_CONVERSATION_INSTRUCTIONS,
  CLEVER_CONVERSATION_INSTRUCTIONS_VERSION,
} from './cleverConversationInstructions.js';

const MAX_HISTORY_TURNS = 8;

function redactForLog(text = '') {
  const trimmed = String(text ?? '').trim();
  if (trimmed.length <= 24) return '[redacted]';
  return `[redacted:${trimmed.length}chars]`;
}

function slimLeadForApi(lead = {}) {
  const needProfile = lead?.crm?.needProfile ?? {};
  return {
    needProfile: {
      fuel: needProfile.fuel ?? null,
      bodyType: needProfile.bodyType ?? null,
      persons: needProfile.persons ?? null,
      annualKm: needProfile.annualKm ?? null,
      leaseDurationMonths: needProfile.leaseDurationMonths ?? null,
      selectedModelKey: needProfile.selectedModelKey ?? null,
      modelHint: needProfile.modelHint ?? null,
      budget: needProfile.budget ?? null,
      timelineLabel: needProfile.timelineLabel ?? null,
      towCapacityKg: needProfile.towCapacityKg ?? null,
      understoodLabels: (needProfile.understoodLabels ?? []).slice(0, 12),
    },
  };
}

/**
 * @param {object} params
 */
export function buildCleverTurnContext({
  lead,
  customerMessage,
  conversationHistory = [],
  dealerId = null,
  brandContext = {},
}) {
  const slimLead = slimLeadForApi(lead);
  const customerUnderstanding = buildCustomerUnderstanding(slimLead) ?? {
    labels: [],
    summary: null,
    openPoints: [],
    vehicleDirections: [],
  };

  const history = conversationHistory
    .slice(-MAX_HISTORY_TURNS)
    .map((turn) => ({
      role: turn.role === 'assistant' ? 'assistant' : 'user',
      text: String(turn.text ?? '').slice(0, 1200),
    }));

  const dynamicContext = {
    instructionsVersion: CLEVER_CONVERSATION_INSTRUCTIONS_VERSION,
    brand: brandContext.brand ?? 'Kia',
    dealerName: brandContext.dealerName ?? null,
    dealerId,
    customerUnderstanding: {
      labels: customerUnderstanding.verstaendnis?.labels ?? [],
      summary: customerUnderstanding.gespraechseinstieg ?? null,
      openPoints: customerUnderstanding.verstaendnis?.openPoints ?? [],
      vehicleDirections: customerUnderstanding.verstaendnis?.vehicles ?? [],
    },
    conversationHistory: history,
    customerMessage: String(customerMessage ?? '').slice(0, 2000),
  };

  return {
    instructions: CLEVER_CONVERSATION_INSTRUCTIONS,
    input: [
      {
        role: 'user',
        content: JSON.stringify(dynamicContext),
      },
    ],
    debug: {
      messageRedacted: redactForLog(customerMessage),
      historyCount: history.length,
    },
  };
}

export { redactForLog };
