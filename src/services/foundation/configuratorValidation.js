/**
 * Validierung des Foundation-Datenmodells und Konfigurationsauswahlen.
 */
import { RULE_TYPE, RULE_STATUS } from '../../data/foundation/ruleTypes.js';
import { getModelYearBundle } from '../../data/foundation/configuratorFoundationSchema.js';
import { evaluateConfiguratorState, canCalculatePricing } from './configuratorRuleEngine.js';

/**
 * @param {import('../../data/foundation/configuratorFoundationTypes.js').ConfiguratorFoundationDatabase} db
 * @param {string} modelYearId
 */
export function validateModelYearData(db, modelYearId) {
  const bundle = getModelYearBundle(db, modelYearId);
  const issues = [];

  if (!bundle) {
    return { ok: false, issues: [{ severity: 'error', code: 'missing_model_year', message: 'Modelljahr nicht gefunden' }] };
  }

  if (!bundle.manufacturer) {
    issues.push({ severity: 'error', code: 'missing_manufacturer', message: 'Hersteller fehlt' });
  }
  if (!bundle.model) {
    issues.push({ severity: 'error', code: 'missing_model', message: 'Modell fehlt' });
  }
  if (!bundle.trims.length) {
    issues.push({ severity: 'error', code: 'missing_trims', message: 'Keine Trims definiert' });
  }
  if (!bundle.optionPackages.length) {
    issues.push({ severity: 'warning', code: 'missing_packages', message: 'Keine Pakete definiert' });
  }

  const packageIds = new Set(bundle.optionPackages.map((p) => p.id));
  const trimIds = new Set(bundle.trims.map((t) => t.id));
  const equipmentIds = new Set(bundle.equipmentItems.map((e) => e.id));

  for (const rule of bundle.rules) {
    if (rule.packageId && !packageIds.has(rule.packageId)) {
      issues.push({
        severity: 'error',
        code: 'unknown_package_ref',
        message: `Regel ${rule.id} verweist auf unbekanntes Paket ${rule.packageId}`,
        ruleId: rule.id,
      });
    }
    if (rule.trimId && !trimIds.has(rule.trimId)) {
      issues.push({
        severity: 'error',
        code: 'unknown_trim_ref',
        message: `Regel ${rule.id} verweist auf unbekannte Linie ${rule.trimId}`,
        ruleId: rule.id,
      });
    }
    if (rule.equipmentItemId && !equipmentIds.has(rule.equipmentItemId)) {
      issues.push({
        severity: 'error',
        code: 'unknown_equipment_ref',
        message: `Regel ${rule.id} verweist auf unbekannte Ausstattung ${rule.equipmentItemId}`,
        ruleId: rule.id,
      });
    }

    if (rule.ruleType === RULE_TYPE.PACKAGE_DEPENDENCY) {
      for (const reqId of rule.value?.requiredPackageIds ?? []) {
        if (!packageIds.has(reqId)) {
          issues.push({
            severity: 'error',
            code: 'unknown_dependency',
            message: `Abhängigkeit ${rule.packageId} → ${reqId} ungültig`,
            ruleId: rule.id,
          });
        }
        if (reqId === rule.packageId) {
          issues.push({
            severity: 'error',
            code: 'self_dependency',
            message: `Paket ${rule.packageId} hängt von sich selbst ab`,
            ruleId: rule.id,
          });
        }
      }
    }

    if (rule.ruleType === RULE_TYPE.PRICE && rule.price == null) {
      issues.push({
        severity: 'error',
        code: 'missing_price',
        message: `Preisregel ${rule.id} ohne Betrag`,
        ruleId: rule.id,
      });
    }

    if (rule.status === RULE_STATUS.LIVE && !rule.checkedAt) {
      issues.push({
        severity: 'warning',
        code: 'live_without_check',
        message: `Live-Regel ${rule.id} ohne Prüfdatum`,
        ruleId: rule.id,
      });
    }
  }

  for (const pc of bundle.packageContents) {
    if (!packageIds.has(pc.packageId)) {
      issues.push({
        severity: 'error',
        code: 'orphan_package_content',
        message: `PackageContent ${pc.id} ohne Paket`,
      });
    }
    if (!equipmentIds.has(pc.equipmentItemId)) {
      issues.push({
        severity: 'error',
        code: 'orphan_package_content_eq',
        message: `PackageContent ${pc.id} ohne Ausstattung`,
      });
    }
  }

  const circular = detectCircularDependencies(bundle);
  issues.push(...circular);

  const errors = issues.filter((i) => i.severity === 'error');
  return {
    ok: errors.length === 0,
    issues,
    summary: {
      errors: errors.length,
      warnings: issues.filter((i) => i.severity === 'warning').length,
    },
  };
}

function detectCircularDependencies(bundle) {
  const graph = new Map();
  for (const rule of bundle.rules) {
    if (rule.ruleType !== RULE_TYPE.PACKAGE_DEPENDENCY || !rule.packageId) continue;
    if (!graph.has(rule.packageId)) graph.set(rule.packageId, new Set());
    for (const req of rule.value?.requiredPackageIds ?? []) {
      graph.get(rule.packageId).add(req);
    }
  }

  const issues = [];
  const visiting = new Set();
  const visited = new Set();

  function dfs(node, path) {
    if (visiting.has(node)) {
      issues.push({
        severity: 'error',
        code: 'circular_dependency',
        message: `Zirkuläre Paketabhängigkeit: ${[...path, node].join(' → ')}`,
      });
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const next of graph.get(node) ?? []) {
      dfs(next, [...path, node]);
    }
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of graph.keys()) dfs(node, []);
  return issues;
}

/**
 * @param {import('../../data/foundation/configuratorFoundationTypes.js').ModelYearBundle} bundle
 * @param {import('../../data/foundation/configuratorFoundationTypes.js').ConfigurationSelection} selection
 * @param {import('../../data/foundation/configuratorFoundationTypes.js').ConfiguratorAudience} audience
 */
export function validateConfigurationSelection(bundle, selection, audience) {
  const state = evaluateConfiguratorState(bundle, selection, audience);
  const pricing = canCalculatePricing(bundle, selection, audience);
  const issues = [...(state.issues ?? [])];

  const invalidSelected = state.packages.filter(
    (p) => selection.packageIds?.includes(p.id)
      && (p.status === 'blocked' || p.status === 'unavailable' || p.status === 'included'),
  );
  for (const pkg of invalidSelected) {
    issues.push({
      severity: 'error',
      code: 'invalid_package_selection',
      message: `Paket ${pkg.name} ist in dieser Kombination nicht wählbar`,
      packageId: pkg.id,
    });
  }

  return {
    ok: pricing.ok && invalidSelected.length === 0,
    needsReview: state.needsReview || !pricing.ok,
    reviewMessage: state.reviewMessage,
    state,
    issues,
  };
}
