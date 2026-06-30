import express from 'express';
import { orchestrateCustomerQuery } from '../src/services/clever/cleverCustomerQueryOrchestrator.js';
import { orchestrateLexiconQuery } from '../src/services/clever/cleverLexiconQueryOrchestrator.js';
import { isOpenAiConfigured } from '../src/services/clever/openAiQueryClassifier.js';

const router = express.Router();

router.get('/clever/customer-query/health', (_req, res) => {
  res.json({
    ok: true,
    openAiConfigured: isOpenAiConfigured(),
    advisorUseOpenAi: process.env.ADVISOR_USE_OPENAI === 'true',
  });
});

router.post('/clever/lexikon-query', express.json({ limit: '16kb' }), async (req, res) => {
  try {
    const { query } = req.body ?? {};
    const result = await orchestrateLexiconQuery({
      query,
      useOpenAi: req.body?.useOpenAi,
    });

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error('[clever/lexikon-query]', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.post('/clever/customer-query', express.json({ limit: '16kb' }), async (req, res) => {
  try {
    const { query, dealerId = null, leadId = null, context = {} } = req.body ?? {};
    const result = await orchestrateCustomerQuery({
      query,
      dealerId,
      leadId,
      context,
      useOpenAi: req.body?.useOpenAi,
    });

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error('[clever/customer-query]', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

export default router;
