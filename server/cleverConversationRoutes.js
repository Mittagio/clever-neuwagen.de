import express from 'express';
import { runCleverTurn, applyCleverTurnToLead } from '../src/services/clever/openai/runCleverTurn.js';
import { isCleverAiConversationEnabled } from '../src/services/clever/openai/cleverConversationConfig.js';
import { applyCleverTurnToSession } from '../src/services/clever/openai/applyCleverTurnResult.js';
import { createHappyPathSession } from '../src/services/consultation/consultationHappyPath.js';
import { submitSafeIntakeFallback } from '../src/services/consultation/safeIntakeFallback.js';
import { appendKnowledgeGaps } from './knowledgeGapStore.js';
import { appendQualityTurnMetric } from './cleverQualityStore.js';

const router = express.Router();

router.get('/clever/conversation-turn/health', (_req, res) => {
  res.json({
    ok: true,
    enabled: isCleverAiConversationEnabled(),
  });
});

router.post('/clever/conversation-turn', express.json({ limit: '32kb' }), async (req, res) => {
  try {
    const {
      customerMessage,
      conversationHistory = [],
      dealerId = null,
      brandContext = {},
      needProfile = null,
      session = null,
    } = req.body ?? {};

    const trimmed = String(customerMessage ?? '').trim();
    if (!trimmed) {
      return res.status(400).json({ ok: false, error: 'missing_message' });
    }

    const lead = {
      crm: {
        needProfile: needProfile ?? session?.needProfile ?? null,
      },
    };

    const aiResult = await runCleverTurn({
      lead,
      customerMessage: trimmed,
      conversationHistory,
      dealerId,
      brandContext,
    });

    if (!aiResult.ok) {
      appendQualityTurnMetric({
        createdAt: new Date().toISOString(),
        fallback: true,
        reason: aiResult.reason ?? 'fallback',
        metrics: aiResult.metrics ?? null,
      });

      const baseSession = session ?? createHappyPathSession(brandContext.dealerName ?? 'Autohaus');
      const fallbackSession = submitSafeIntakeFallback(baseSession, trimmed, {
        reason: aiResult.reason ?? 'fallback',
      });
      return res.json({
        ok: true,
        mode: 'fallback',
        reason: aiResult.reason ?? 'fallback',
        session: fallbackSession,
        metrics: aiResult.metrics ?? null,
      });
    }

    if (aiResult.knowledgeGaps?.length) {
      appendKnowledgeGaps(aiResult.knowledgeGaps);
    }

    appendQualityTurnMetric({
      createdAt: new Date().toISOString(),
      fallback: false,
      metrics: aiResult.metrics ?? null,
      knowledgeGapCount: aiResult.knowledgeGaps?.length ?? 0,
    });

    let nextSession;
    if (session) {
      nextSession = applyCleverTurnToSession(session, {
        customerMessage: trimmed,
        turnResult: aiResult.turnResult,
      });
    } else {
      const applied = applyCleverTurnToLead(lead, aiResult.turnResult, trimmed);
      nextSession = applyCleverTurnToSession(
        createHappyPathSession(brandContext.dealerName ?? 'Autohaus'),
        {
          customerMessage: trimmed,
          turnResult: aiResult.turnResult,
        },
      );
      nextSession.needProfile = applied.needProfile;
    }

    nextSession = {
      ...nextSession,
      conversationMode: 'ai',
      fallbackReason: null,
      aiModel: aiResult.metrics?.finalModel
        ?? aiResult.metrics?.primaryModel
        ?? null,
    };

    return res.json({
      ok: true,
      mode: 'ai',
      turnResult: aiResult.turnResult,
      session: nextSession,
      customerUnderstanding: applyCleverTurnToLead(lead, aiResult.turnResult, trimmed).customerUnderstanding,
      metrics: aiResult.metrics ?? null,
      evidence: aiResult.evidence ?? null,
      knowledgeGapCount: aiResult.knowledgeGaps?.length ?? 0,
    });
  } catch (err) {
    console.error('[clever/conversation-turn]', err?.message ?? err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

export default router;
