/**
 * Clever Agent API – serverseitig, OpenAI Responses + Tool-Loop.
 */
import express from 'express';
import {
  getCleverAgentConfig,
  isCleverAgentEnabled,
  runCleverAgent,
} from '../src/services/cleverAgent/cleverAgentService.js';
import { buildCleverCustomerContext } from '../src/services/cleverAgent/cleverContextBuilder.js';
import { listCleverAgentToolNames } from '../src/services/cleverAgent/cleverToolRegistry.js';

const router = express.Router();

function assertSellerPermission(req) {
  const sellerId = req.headers['x-seller-id'] || req.body?.sellerId || null;
  const dealerId = req.headers['x-dealer-id'] || req.body?.dealerId || null;
  if (!sellerId && !dealerId && process.env.NODE_ENV === 'production') {
    return { ok: false, error: 'seller_permission_required' };
  }
  return { ok: true, sellerId, dealerId };
}

/** Lead für Agent: genug Business-Daten, kein unnötiger Ballast. */
function slimLeadForAgent(lead = {}) {
  if (!lead || typeof lead !== 'object') return {};
  return {
    id: lead.id ?? null,
    customerId: lead.customerId ?? null,
    name: lead.name ?? null,
    contact: lead.contact
      ? {
        name: lead.contact.name ?? null,
        salutation: lead.contact.salutation ?? null,
        firstName: lead.contact.firstName ?? null,
        lastName: lead.contact.lastName ?? null,
        kind: lead.contact.kind ?? null,
        companyName: lead.contact.companyName ?? null,
        phone: lead.contact.phone || '',
        email: lead.contact.email || '',
      }
      : null,
    vehicle: lead.vehicle
      ? {
        brand: lead.vehicle.brand ?? null,
        model: lead.vehicle.model ?? null,
        modelKey: lead.vehicle.modelKey ?? null,
        trim: lead.vehicle.trim ?? null,
        label: lead.vehicle.label ?? null,
      }
      : null,
    paymentType: lead.paymentType ?? null,
    desiredRate: lead.desiredRate ?? null,
    wish: lead.wish
      ? {
        termMonths: lead.wish.termMonths ?? null,
        mileagePerYear: lead.wish.mileagePerYear ?? null,
        downPayment: lead.wish.downPayment ?? null,
        paymentType: lead.wish.paymentType ?? null,
        desiredRate: lead.wish.desiredRate ?? null,
      }
      : null,
    crm: {
      needProfile: lead.crm?.needProfile ?? null,
      vehicleOffers: lead.crm?.vehicleOffers ?? {},
      vehicleConfigurations: Array.isArray(lead.crm?.vehicleConfigurations)
        ? lead.crm.vehicleConfigurations.slice(0, 12)
        : [],
      reservedModels: Array.isArray(lead.crm?.reservedModels)
        ? lead.crm.reservedModels.slice(0, 12)
        : [],
      offers: Array.isArray(lead.crm?.offers) ? lead.crm.offers.slice(0, 12) : [],
      offerSelectionGroups: lead.crm?.offerSelectionGroups ?? [],
      customerOfferPortfolio: lead.crm?.customerOfferPortfolio
        ? {
          status: lead.crm.customerOfferPortfolio.status,
          url: lead.crm.customerOfferPortfolio.url,
          token: lead.crm.customerOfferPortfolio.token,
          items: lead.crm.customerOfferPortfolio.items,
        }
        : null,
      nextStepId: lead.crm?.nextStepId ?? null,
      pipelineStatusId: lead.crm?.pipelineStatusId ?? null,
      sellerInsights: Array.isArray(lead.crm?.sellerInsights)
        ? lead.crm.sellerInsights.slice(-6).map((i) => ({
          text: String(i.text || '').slice(0, 240),
          labels: (i.understoodLabels || i.labels || []).slice(0, 6),
        }))
        : [],
      vehicleTracks: lead.crm?.vehicleTracks ?? null,
    },
  };
}

function hydrateContactSecrets(lead = {}) {
  return lead;
}

router.get('/clever-agent/health', (_req, res) => {
  const cfg = getCleverAgentConfig();
  res.json({
    ok: true,
    enabled: isCleverAgentEnabled(),
    openaiConfigured: Boolean(cfg.apiKey),
    model: cfg.model,
    tools: listCleverAgentToolNames(),
  });
});

router.post('/clever-agent', express.json({ limit: '512kb' }), async (req, res) => {
  try {
    const permission = assertSellerPermission(req);
    if (!permission.ok) {
      return res.status(403).json(permission);
    }

    const {
      sellerMessage = '',
      message = '',
      lead = null,
      conversationHistory = [],
      workingContext = null,
      currentOffer = null,
      previousOfferPreparation = null,
      workingMemory = null,
      leadsSnapshot = [],
      attachments = [],
      debug = false,
      forcedTools = null,
    } = req.body ?? {};

    const slim = hydrateContactSecrets(slimLeadForAgent(lead || {}));
    // Snapshot für find/open/today – gekappt, kein Full-CRM-Dump
    const slimSnapshot = (Array.isArray(leadsSnapshot) ? leadsSnapshot : [])
      .slice(0, 40)
      .map((entry) => slimLeadForAgent(entry));

    const result = await runCleverAgent({
      sellerMessage: sellerMessage || message,
      lead: slim,
      conversationHistory,
      workingContext,
      currentOffer,
      previousOfferPreparation: previousOfferPreparation
        || workingMemory?.previousOfferPreparation
        || null,
      workingMemory,
      leadsSnapshot: slimSnapshot,
      attachments: Array.isArray(attachments) ? attachments.slice(0, 4) : [],
      debug: debug || getCleverAgentConfig().debug,
      forcedTools: Array.isArray(forcedTools) ? forcedTools : null,
    });

    // Client braucht Mutationen; Debug nur in Dev
    const payload = {
      ok: result.ok,
      message: result.message,
      artifacts: result.artifacts || [],
      suggestedActions: result.suggestedActions || [],
      mutations: result.mutations || [],
      pendingAction: result.pendingAction || null,
      confirmationRequired: Boolean(result.confirmationRequired),
      resolvedVehicle: result.resolvedVehicle || null,
      offerSummary: result.offerSummary || null,
      intendSend: Boolean(result.intendSend),
      preparedAppointment: result.preparedAppointment || null,
      extractedFacts: result.extractedFacts || [],
      knowledgeResult: result.knowledgeResult || null,
      todayOverview: result.todayOverview || null,
      toolCalls: result.toolCalls || [],
      previousOfferPreparation: result.previousOfferPreparation || null,
      lead: result.lead || null,
      agentSource: result.agentSource || null,
      model: result.model || null,
      error: result.error || null,
      fallbackReason: result.fallbackReason || null,
      responseId: result.responseId || null,
      contextPreview: buildCleverCustomerContext(slim, { workingContext, currentOffer }),
    };

    if (result.debug && (process.env.NODE_ENV !== 'production' || getCleverAgentConfig().debug)) {
      payload.debug = result.debug;
    }

    return res.json(payload);
  } catch (err) {
    console.error('[clever-agent]', err?.message ?? err);
    return res.status(500).json({
      ok: false,
      message: 'Clever ist gerade nicht erreichbar. Bitte erneut versuchen.',
      error: 'internal_error',
      fallbackReason: 'agent_error',
      artifacts: [],
      suggestedActions: [],
      mutations: [],
    });
  }
});

export default router;
