import express from 'express';
import {
  appendChangeLog,
  deleteRule,
  getConfiguratorFoundationStatus,
  loadConfiguratorFoundation,
  saveConfiguratorFoundation,
  upsertRule,
} from './configuratorFoundationStore.js';
import { getModelYearBundle } from '../src/data/foundation/configuratorFoundationSchema.js';
import { validateModelYearData, validateConfigurationSelection } from '../src/services/foundation/configuratorValidation.js';
import { CONFIGURATOR_AUDIENCE } from '../src/data/foundation/ruleTypes.js';

const router = express.Router();

router.get('/admin/foundation/status', (_req, res) => {
  res.json({ ok: true, storage: getConfiguratorFoundationStatus() });
});

router.get('/admin/foundation', (_req, res) => {
  res.json({ ok: true, database: loadConfiguratorFoundation() });
});

router.put('/admin/foundation', (req, res) => {
  const database = req.body?.database;
  if (!database || typeof database !== 'object') {
    return res.status(400).json({ ok: false, message: 'database object required' });
  }
  saveConfiguratorFoundation(database);
  res.json({ ok: true, database: loadConfiguratorFoundation() });
});

router.get('/admin/foundation/model-years/:modelYearId', (req, res) => {
  const db = loadConfiguratorFoundation();
  const bundle = getModelYearBundle(db, req.params.modelYearId);
  if (!bundle) return res.status(404).json({ ok: false, message: 'Model year not found' });
  res.json({ ok: true, bundle });
});

router.get('/admin/foundation/model-years/:modelYearId/validate', (req, res) => {
  const db = loadConfiguratorFoundation();
  const result = validateModelYearData(db, req.params.modelYearId);
  res.json({ ok: result.ok, ...result });
});

router.post('/admin/foundation/model-years/:modelYearId/test-config', (req, res) => {
  const db = loadConfiguratorFoundation();
  const bundle = getModelYearBundle(db, req.params.modelYearId);
  if (!bundle) return res.status(404).json({ ok: false, message: 'Model year not found' });

  const selection = req.body?.selection ?? {};
  const audience = req.body?.audience === CONFIGURATOR_AUDIENCE.SELLER
    ? CONFIGURATOR_AUDIENCE.SELLER
    : CONFIGURATOR_AUDIENCE.ADMIN;

  const result = validateConfigurationSelection(bundle, {
    trimId: selection.trimId ?? null,
    powertrainId: selection.powertrainId ?? null,
    colorId: selection.colorId ?? null,
    packageIds: selection.packageIds ?? [],
  }, audience);

  res.json({ ok: result.ok, ...result });
});

router.post('/admin/foundation/rules', (req, res) => {
  const rule = req.body?.rule ?? req.body;
  if (!rule?.ruleType || !rule?.modelYearId) {
    return res.status(400).json({ ok: false, message: 'rule with ruleType and modelYearId required' });
  }
  const saved = upsertRule(rule);
  appendChangeLog({
    manufacturerId: rule.manufacturerId,
    modelId: rule.modelId,
    modelYearId: rule.modelYearId,
    summary: `Regel ${saved.ruleType} ${saved.id} gespeichert`,
    author: rule.checkedBy ?? 'admin',
    status: saved.status,
  });
  res.json({ ok: true, rule: saved });
});

router.put('/admin/foundation/rules/:ruleId', (req, res) => {
  const rule = req.body?.rule ?? req.body;
  if (!rule?.ruleType || !rule?.modelYearId) {
    return res.status(400).json({ ok: false, message: 'rule with ruleType and modelYearId required' });
  }
  rule.id = req.params.ruleId;
  const saved = upsertRule(rule);
  appendChangeLog({
    manufacturerId: rule.manufacturerId,
    modelId: rule.modelId,
    modelYearId: rule.modelYearId,
    summary: `Regel ${saved.ruleType} ${saved.id} gespeichert`,
    author: rule.checkedBy ?? 'admin',
    status: saved.status,
  });
  res.json({ ok: true, rule: saved });
});

router.delete('/admin/foundation/rules/:ruleId', (req, res) => {
  deleteRule(req.params.ruleId);
  res.json({ ok: true });
});

export default router;
