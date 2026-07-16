/**
 * Clever Qualität – API (Feedback, Wissenslücken, Admin-Review).
 */
import express from 'express';
import { CLEVER_CONVERSATION_INSTRUCTIONS_VERSION } from '../src/services/clever/openai/cleverConversationInstructions.js';
import { getCleverAiConfig } from '../src/services/clever/openai/cleverConversationConfig.js';
import { processAcceptedSellerFeedback } from '../src/services/clever/learning/feedbackReviewService.js';
import { KNOWLEDGE_GAP_STATUSES } from '../src/services/clever/knowledge/knowledgeGapService.js';
import { GOLDEN_CANDIDATE_STATUSES } from '../src/services/clever/learning/feedbackReviewService.js';
import {
  appendGoldenCandidate,
  appendSellerFeedback,
  buildQualitySummary,
  listSellerFeedback,
  patchGoldenCandidate,
  patchSellerFeedback,
  loadGoldenCandidates,
} from './cleverQualityStore.js';
import {
  appendKnowledgeGaps,
  listKnowledgeGaps,
  patchKnowledgeGap,
} from './knowledgeGapStore.js';

const router = express.Router();

router.post('/clever/seller-feedback', express.json({ limit: '32kb' }), (req, res) => {
  try {
    const body = req.body ?? {};
    if (!body.category) {
      return res.status(400).json({ ok: false, error: 'missing_category' });
    }

    const config = getCleverAiConfig();
    const item = appendSellerFeedback({
      ...body,
      model: body.model ?? config.model,
      promptVersion: body.promptVersion ?? CLEVER_CONVERSATION_INSTRUCTIONS_VERSION,
    });

    return res.json({ ok: true, feedback: item });
  } catch (err) {
    console.error('[clever/seller-feedback]', err?.message ?? err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

router.get('/admin/clever/knowledge-gaps', (req, res) => {
  const gaps = listKnowledgeGaps({
    status: req.query.status ?? undefined,
    brandKey: req.query.brandKey ?? undefined,
    modelKey: req.query.modelKey ?? undefined,
  });
  res.json({ ok: true, gaps });
});

router.patch('/admin/clever/knowledge-gaps/:id', express.json(), (req, res) => {
  const { status, resolution, reviewedBy } = req.body ?? {};
  const gap = patchKnowledgeGap(req.params.id, {
    status,
    resolution,
    reviewedBy,
    reviewedAt: new Date().toISOString(),
  });
  if (!gap) return res.status(404).json({ ok: false, error: 'not_found' });
  res.json({ ok: true, gap });
});

router.get('/admin/clever/quality/summary', (req, res) => {
  const gaps = listKnowledgeGaps({ status: KNOWLEDGE_GAP_STATUSES.NEW });
  const summary = {
    ...buildQualitySummary(),
    openKnowledgeGaps: gaps.length,
    newKnowledgeGaps: gaps,
    sellerFeedback: listSellerFeedback({ status: 'new' }),
    goldenCandidates: (loadGoldenCandidates().items ?? []).filter((g) => g.status === 'new'),
  };
  res.json({ ok: true, summary });
});

router.patch('/admin/clever/feedback/:id/review', express.json(), (req, res) => {
  const { status, reviewerNote } = req.body ?? {};
  const feedback = patchSellerFeedback(req.params.id, {
    status,
    reviewerNote,
    reviewedAt: new Date().toISOString(),
  });
  if (!feedback) return res.status(404).json({ ok: false, error: 'not_found' });

  let artifacts = null;
  if (status === 'accepted') {
    artifacts = processAcceptedSellerFeedback(feedback);
    if (artifacts.goldenCandidate) {
      appendGoldenCandidate(artifacts.goldenCandidate);
    }
    if (artifacts.knowledgeGap) {
      appendKnowledgeGaps([artifacts.knowledgeGap]);
    }
  }

  res.json({ ok: true, feedback, artifacts });
});

router.patch('/admin/clever/golden-candidates/:id/accept', express.json(), (req, res) => {
  const candidate = patchGoldenCandidate(req.params.id, {
    status: GOLDEN_CANDIDATE_STATUSES.ACCEPTED,
    acceptedAt: new Date().toISOString(),
    reviewerNote: req.body?.reviewerNote ?? null,
  });
  if (!candidate) return res.status(404).json({ ok: false, error: 'not_found' });
  res.json({ ok: true, candidate, fixtureReady: true });
});

export default router;
