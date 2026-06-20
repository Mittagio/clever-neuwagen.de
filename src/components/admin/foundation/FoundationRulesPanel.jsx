import { useMemo, useState } from 'react';
import { getModelYearBundle, createRule } from '../../../data/foundation/configuratorFoundationSchema.js';
import { RULE_TYPE, RULE_STATUS } from '../../../data/foundation/ruleTypes.js';
import { upsertFoundationRule } from '../../../services/foundation/configuratorFoundationApi.js';

const RULE_TYPE_LABELS = {
  [RULE_TYPE.PACKAGE_AVAILABILITY]: 'Verfügbarkeit',
  [RULE_TYPE.PACKAGE_DEPENDENCY]: 'Abhängigkeit',
  [RULE_TYPE.PACKAGE_EXCLUSION]: 'Ausschluss',
  [RULE_TYPE.PACKAGE_INCLUDED]: 'Serie/enthalten',
  [RULE_TYPE.PRICE]: 'Preis',
  [RULE_TYPE.COLOR]: 'Farbe',
  [RULE_TYPE.TRIM_STANDARD_EQUIPMENT]: 'Serienausstattung',
};

function ruleSummary(rule) {
  if (rule.ruleType === RULE_TYPE.PACKAGE_DEPENDENCY) {
    return (rule.value?.requiredPackageIds ?? []).join(', ') || '—';
  }
  if (rule.ruleType === RULE_TYPE.PACKAGE_EXCLUSION) {
    return (rule.value?.excludedPackageIds ?? []).join(', ') || '—';
  }
  if (rule.ruleType === RULE_TYPE.PRICE) {
    return rule.price != null ? `${rule.price} €` : '—';
  }
  if (rule.ruleType === RULE_TYPE.COLOR) {
    return rule.value?.label ?? rule.colorId ?? '—';
  }
  return JSON.stringify(rule.value ?? {});
}

export default function FoundationRulesPanel({ database, modelYearId, onDatabaseChange }) {
  const bundle = getModelYearBundle(database, modelYearId);
  const [filterType, setFilterType] = useState('all');
  const [message, setMessage] = useState('');

  const rules = useMemo(() => {
    const list = bundle?.rules ?? [];
    if (filterType === 'all') return list;
    return list.filter((r) => r.ruleType === filterType);
  }, [bundle, filterType]);

  async function handleQuickDependency(e) {
    e.preventDefault();
    const form = e.target;
    const packageId = form.packageId.value;
    const required = form.requiredPackageIds.value.split(',').map((s) => s.trim()).filter(Boolean);
    if (!packageId || !required.length || !bundle?.scope) return;

    const rule = createRule({
      ...bundle.scope,
      packageId,
      ruleType: RULE_TYPE.PACKAGE_DEPENDENCY,
      value: { requiredPackageIds: required },
      source: bundle.sourceDocuments[0]?.fileName ?? null,
      status: RULE_STATUS.DRAFT,
      checkedBy: 'admin-ui',
      checkedAt: new Date().toISOString(),
    });

    try {
      await upsertFoundationRule(rule);
      onDatabaseChange({
        ...database,
        rules: [...database.rules, rule],
      });
      setMessage('Abhängigkeitsregel als Entwurf gespeichert.');
      form.reset();
    } catch (err) {
      setMessage(err.message ?? 'Speichern fehlgeschlagen');
    }
  }

  if (!bundle) return <p>Modelljahr nicht gefunden.</p>;

  return (
    <>
      <section className="cf-panel">
        <h2 className="cf-panel__title">Regeln filtern</h2>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="all">Alle Typen</option>
          {Object.entries(RULE_TYPE_LABELS).map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </section>

      <section className="cf-panel">
        <h2 className="cf-panel__title">Paketabhängigkeit anlegen</h2>
        <form onSubmit={handleQuickDependency}>
          <div className="cf-form-row">
            <label>
              Paket
              <select name="packageId" required>
                <option value="">—</option>
                {bundle.optionPackages.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label>
              Benötigt (IDs, kommagetrennt)
              <input name="requiredPackageIds" placeholder="p5-drivewise, p3-sound" required />
            </label>
          </div>
          <button type="submit" className="cf-btn">Als Entwurf speichern</button>
        </form>
        {message && <p className="cf-admin__notice" role="status">{message}</p>}
      </section>

      <section className="cf-panel">
        <h2 className="cf-panel__title">Regeln ({rules.length})</h2>
        <table className="cf-table">
          <thead>
            <tr>
              <th>Typ</th>
              <th>Paket/Objekt</th>
              <th>Trim</th>
              <th>Wert</th>
              <th>Status</th>
              <th>Quelle</th>
            </tr>
          </thead>
          <tbody>
            {rules.slice(0, 100).map((rule) => (
              <tr key={rule.id}>
                <td>{RULE_TYPE_LABELS[rule.ruleType] ?? rule.ruleType}</td>
                <td>{rule.packageId ?? rule.colorId ?? rule.equipmentItemId ?? '—'}</td>
                <td>{rule.trimId ?? '—'}</td>
                <td>{ruleSummary(rule)}</td>
                <td><span className={`cf-badge cf-badge--${rule.status}`}>{rule.status}</span></td>
                <td>{rule.source ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rules.length > 100 && <p>… {rules.length - 100} weitere Regeln</p>}
      </section>
    </>
  );
}
