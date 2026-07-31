/**
 * Shared Intelligence API – Lexikon, Seller Copilot, Lexikon-Transfer.
 */
import express from 'express';
import { runCleverLexiconQuery } from '../src/services/clever/intelligence/runCleverLexiconQuery.js';
import { runCleverSellerCopilot } from '../src/services/clever/intelligence/runCleverSellerCopilot.js';
import {
  buildLexiconTransferPreview,
  applyLexiconTransferToLead,
  LEXICON_TRANSFER_MODES,
} from '../src/services/clever/intelligence/lexiconTransferService.js';
import {
  isCleverLexiconAiEnabled,
  isCleverSellerCopilotEnabled,
} from '../src/services/clever/intelligence/cleverIntelligenceConfig.js';
import { generateGroundedCleverMessage } from '../src/services/crm/magic/generateGroundedCleverMessage.js';
import { appendKnowledgeGaps } from './knowledgeGapStore.js';
import { appendQualityTurnMetric } from './cleverQualityStore.js';

const router = express.Router();

function isCleverMagicMessageEnabled(env = process.env) {
  return env.CLEVER_MAGIC_MESSAGE_ENABLED === 'true'
    || env.CLEVER_SELLER_COPILOT_ENABLED === 'true';
}

function assertSellerPermission(req) {
  const sellerId = req.headers['x-seller-id'] || req.body?.sellerId || null;
  const dealerId = req.headers['x-dealer-id'] || req.body?.dealerId || null;
  if (!sellerId && !dealerId && process.env.NODE_ENV === 'production') {
    return { ok: false, error: 'seller_permission_required' };
  }
  return { ok: true, sellerId, dealerId };
}

/** Kein Full-Lead / keine Kontaktdaten an die Interpretations-Pipeline. */
function slimLeadForSellerTurn(lead = {}) {
  return {
    id: lead.id ?? null,
    crm: {
      needProfile: lead.crm?.needProfile ?? null,
      sellerInsights: (lead.crm?.sellerInsights ?? []).slice(-8).map((insight) => ({
        text: String(insight.text ?? '').slice(0, 400),
        labels: (insight.understoodLabels ?? insight.labels ?? []).slice(0, 8),
        context: insight.context ?? null,
      })),
    },
  };
}

router.get('/clever/shared-intelligence/health', (_req, res) => {
  res.json({
    ok: true,
    lexiconAi: isCleverLexiconAiEnabled(),
    sellerCopilot: isCleverSellerCopilotEnabled(),
    magicMessage: isCleverMagicMessageEnabled(),
    sellerOpenAiInterpret: process.env.CLEVER_SELLER_OPENAI_INTERPRET_ENABLED === 'true',
  });
});

router.post('/clever/magic-message', express.json({ limit: '48kb' }), async (req, res) => {
  try {
    const permission = assertSellerPermission(req);
    if (!permission.ok) {
      return res.status(403).json(permission);
    }

    const {
      rawSellerInput = '',
      draftText = '',
      lead = null,
      customerName = '',
      recipient = '',
      tone = 'freundlich',
      workingContext = null,
      offerContext = null,
      openVehicles = [],
      allowWithoutPackageDetails = false,
      sellerFacts = [],
      akteContext = null,
      chipIntent = null,
    } = req.body ?? {};

    const input = String(rawSellerInput || draftText || '').trim();
    if (!input) {
      return res.status(400).json({ ok: false, error: 'raw_seller_input_required' });
    }

    // Datenschutz: kein Full-Lead an den Writer – Orchestrator baut Minimal Context selbst
    const slimLead = lead ? {
      id: lead.id ?? null,
      contact: lead.contact ? { name: lead.contact.name ?? null } : null,
      wish: lead.wish ? {
        model: lead.wish.model ?? null,
        trim: lead.wish.trim ?? null,
      } : null,
      vehicle: lead.vehicle ? {
        model: lead.vehicle.model ?? null,
        trim: lead.vehicle.trim ?? null,
      } : null,
      crm: {
        needProfile: {
          fuel: lead.crm?.needProfile?.fuel ?? null,
          bodyType: lead.crm?.needProfile?.bodyType ?? null,
          budget: lead.crm?.needProfile?.budget ?? null,
          selectedModelKey: lead.crm?.needProfile?.selectedModelKey ?? null,
          modelHint: lead.crm?.needProfile?.modelHint ?? null,
          towCapacityKg: lead.crm?.needProfile?.towCapacityKg ?? null,
          understoodLabels: (lead.crm?.needProfile?.understoodLabels ?? []).slice(0, 12),
        },
        sellerInsights: (lead.crm?.sellerInsights ?? []).slice(-6).map((insight) => ({
          text: String(insight.text ?? '').slice(0, 240),
          understoodLabels: (insight.understoodLabels ?? insight.labels ?? []).slice(0, 8),
        })),
        vehicleConfigurations: (lead.crm?.vehicleConfigurations ?? []).slice(0, 8).map((vc) => ({
          id: vc.id ?? null,
          model: vc.model ?? null,
          modelKey: vc.modelKey ?? null,
          trimLabel: vc.trimLabel ?? null,
          vehicleTrack: vc.vehicleTrack
            ? { status: vc.vehicleTrack.status ?? null }
            : null,
        })),
      },
    } : null;

    const result = await generateGroundedCleverMessage({
      rawSellerInput: input,
      lead: slimLead,
      customerContext: { name: customerName || recipient },
      recipient: recipient || customerName,
      tone,
      workingContext,
      offerContext,
      openVehicles,
      allowWithoutPackageDetails,
      sellerFacts,
      akteContext,
      chipIntent,
    });

    if (result.missingKnowledge?.length) {
      appendKnowledgeGaps(result.missingKnowledge.map((key) => ({
        key,
        surface: 'magic_message',
        createdAt: new Date().toISOString(),
      })));
    }

    appendQualityTurnMetric({
      createdAt: new Date().toISOString(),
      surface: 'magic_message',
      fallback: result.writer !== 'openai',
      metrics: { writer: result.writer, confidence: result.confidence },
    });

    return res.json({
      ok: true,
      ...result,
      magicEnabled: isCleverMagicMessageEnabled(),
    });
  } catch (err) {
    console.error('[clever/magic-message]', err?.message ?? err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.post('/clever/lexicon-query', express.json({ limit: '16kb' }), async (req, res) => {
  try {
    const { query, brandKey = 'kia', modelKey = null, variantKey = null, market = 'DE' } = req.body ?? {};
    const result = await runCleverLexiconQuery({
      query,
      brandKey,
      modelKey,
      variantKey,
      market,
    });

    if (result.knowledgeGaps?.length) {
      appendKnowledgeGaps(result.knowledgeGaps);
    }

    appendQualityTurnMetric({
      createdAt: new Date().toISOString(),
      surface: 'lexicon',
      fallback: result.fallback === true,
      fromCache: result.fromCache === true,
      metrics: result.metrics ?? null,
    });

    if (!result.ok && result.error === 'query_required') {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error('[clever/lexicon-query]', err?.message ?? err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.post('/clever/seller-copilot', express.json({ limit: '48kb' }), async (req, res) => {
  try {
    const permission = assertSellerPermission(req);
    if (!permission.ok) {
      return res.status(403).json(permission);
    }

    const {
      lead = null,
      needProfile = null,
      sellerInsights = null,
      userMessage = '',
      leadId = null,
      dealerId = null,
      requestedAction = null,
      forceRefresh = false,
    } = req.body ?? {};

    const leadInput = lead ?? {
      id: leadId,
      crm: {
        needProfile,
        sellerInsights: sellerInsights ?? [],
      },
    };

    const result = await runCleverSellerCopilot({
      lead: leadInput,
      userMessage,
      leadId: leadId ?? leadInput.id,
      dealerId: dealerId ?? permission.dealerId,
      requestedAction,
      forceRefresh,
    });

    if (result.knowledgeGaps?.length) {
      appendKnowledgeGaps(result.knowledgeGaps);
    }

    appendQualityTurnMetric({
      createdAt: new Date().toISOString(),
      surface: 'seller_dashboard',
      fallback: result.fallback === true,
      fromCache: result.fromCache === true,
      metrics: result.metrics ?? null,
    });

    return res.json(result);
  } catch (err) {
    console.error('[clever/seller-copilot]', err?.message ?? err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.post('/clever/seller-turn', express.json({ limit: '48kb' }), async (req, res) => {
  try {
    const permission = assertSellerPermission(req);
    if (!permission.ok) {
      return res.status(403).json(permission);
    }

    const {
      lead = null,
      sellerInput = '',
      attachments = [],
      leadId = null,
      needProfile = null,
      sellerInsights = null,
    } = req.body ?? {};

    const leadInput = slimLeadForSellerTurn(lead ?? {
      id: leadId,
      crm: {
        needProfile,
        sellerInsights: sellerInsights ?? [],
      },
    });

    const { runCleverSellerTurnAsync } = await import(
      '../src/services/cleverSeller/runCleverSellerTurn.js'
    );

    const result = await runCleverSellerTurnAsync({
      lead: leadInput,
      sellerInput,
      attachments,
      env: process.env,
    });

    appendQualityTurnMetric({
      createdAt: new Date().toISOString(),
      surface: 'seller_universal_input',
      fallback: result?.openaiEscalation?.used !== true,
      fromCache: false,
      metrics: {
        openaiEscalation: result?.openaiEscalation ?? null,
        factCount: result?.extractedFacts?.length ?? 0,
      },
    });

    return res.json(result);
  } catch (err) {
    console.error('[clever/seller-turn]', err?.message ?? err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.post('/clever/lexicon-transfer', express.json({ limit: '32kb' }), (req, res) => {
  try {
    const permission = assertSellerPermission(req);
    if (!permission.ok) {
      return res.status(403).json(permission);
    }

    const {
      lexiconResult = null,
      mode = LEXICON_TRANSFER_MODES.NOTE_ONLY,
      query = '',
      lead = null,
      confirmed = false,
      previewOnly = false,
    } = req.body ?? {};

    if (!lexiconResult) {
      return res.status(400).json({ ok: false, error: 'missing_lexicon_result' });
    }

    if (!Object.values(LEXICON_TRANSFER_MODES).includes(mode)) {
      return res.status(400).json({ ok: false, error: 'invalid_mode' });
    }

    const preview = buildLexiconTransferPreview({ lexiconResult, mode, query });

    if (previewOnly || confirmed !== true) {
      return res.json({
        ok: true,
        preview,
        requiresConfirmation: true,
        applied: false,
      });
    }

    if (!lead) {
      return res.status(400).json({ ok: false, error: 'missing_lead' });
    }

    const applied = applyLexiconTransferToLead(lead, preview, { confirmed: true });
    return res.json({
      ok: applied.ok,
      preview,
      applied: applied.ok,
      lead: applied.lead,
      error: applied.error ?? null,
      requiresConfirmation: false,
    });
  } catch (err) {
    console.error('[clever/lexicon-transfer]', err?.message ?? err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

export default router;
