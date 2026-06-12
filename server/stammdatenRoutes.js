import express from 'express';
import { VEHICLE_QUESTION_INTENT_BY_ID } from '../src/data/vehicleQuestionCatalog.js';
import {
  addOpenCustomerQuestion,
  listOpenCustomerQuestions,
  loadStammdatenOverrides,
  patchStammdatenOverride,
  saveStammdatenOverrides,
  updateOpenCustomerQuestion,
  getStammdatenStorageStatus,
} from './stammdatenStore.js';

const router = express.Router();

function uid() {
  return `ocq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

router.get('/admin/stammdaten/status', (_req, res) => {
  res.json({ ok: true, ...getStammdatenStorageStatus() });
});

router.get('/admin/stammdaten/overrides', (_req, res) => {
  res.json({
    ok: true,
    overrides: loadStammdatenOverrides(),
  });
});

router.put('/admin/stammdaten/overrides', (req, res) => {
  const overrides = req.body?.overrides;
  if (!overrides || typeof overrides !== 'object') {
    return res.status(400).json({ ok: false, message: 'overrides object required' });
  }
  saveStammdatenOverrides(overrides);
  res.json({ ok: true, overrides: loadStammdatenOverrides() });
});

router.patch('/admin/stammdaten/overrides/:modelKey', (req, res) => {
  const patch = req.body?.patch ?? req.body;
  if (!patch || typeof patch !== 'object') {
    return res.status(400).json({ ok: false, message: 'patch object required' });
  }
  const merged = patchStammdatenOverride(req.params.modelKey, patch);
  res.json({ ok: true, modelKey: req.params.modelKey, patch: merged });
});

router.get('/admin/open-questions', (req, res) => {
  const status = req.query.status ?? null;
  res.json({
    ok: true,
    items: listOpenCustomerQuestions({ status }),
  });
});

router.post('/admin/open-questions', (req, res) => {
  const body = req.body ?? {};
  const query = String(body.query ?? '').trim();
  if (!query) {
    return res.status(400).json({ ok: false, message: 'query required' });
  }

  const intentId = body.intentId ?? null;
  const field = body.field
    ?? VEHICLE_QUESTION_INTENT_BY_ID[intentId ?? '']?.factField
    ?? null;

  const entry = addOpenCustomerQuestion({
    id: body.id ?? uid(),
    query,
    modelKey: body.modelKey ?? null,
    intentId,
    category: body.category ?? null,
    field,
    status: 'open',
    createdAt: body.createdAt ?? new Date().toISOString(),
    resolvedAt: null,
    adminAnswer: null,
  });

  res.status(201).json({ ok: true, item: entry });
});

router.patch('/admin/open-questions/:id', (req, res) => {
  const updated = updateOpenCustomerQuestion(req.params.id, req.body ?? {});
  if (!updated) {
    return res.status(404).json({ ok: false, message: 'question not found' });
  }
  res.json({ ok: true, item: updated });
});

export default router;
