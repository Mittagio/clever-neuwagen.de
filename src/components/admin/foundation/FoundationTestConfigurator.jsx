import { useMemo, useState } from 'react';
import { getModelYearBundle } from '../../../data/foundation/configuratorFoundationSchema.js';
import { CONFIGURATOR_AUDIENCE } from '../../../data/foundation/ruleTypes.js';
import { validateConfigurationSelection } from '../../../services/foundation/configuratorValidation.js';
import { REVIEW_MESSAGE } from '../../../services/foundation/configuratorRuleEngine.js';

function statusBadge(status) {
  return <span className={`cf-badge cf-badge--${status}`}>{status}</span>;
}

export default function FoundationTestConfigurator({ database, modelYearId }) {
  const bundle = getModelYearBundle(database, modelYearId);
  const [trimId, setTrimId] = useState(bundle?.trims[0]?.id ?? '');
  const [powertrainId, setPowertrainId] = useState(bundle?.powertrains[0]?.id ?? '');
  const [packageIds, setPackageIds] = useState([]);
  const [audience, setAudience] = useState(CONFIGURATOR_AUDIENCE.ADMIN);

  const selection = useMemo(() => ({
    trimId: trimId || null,
    powertrainId: powertrainId || null,
    colorId: null,
    packageIds,
  }), [trimId, powertrainId, packageIds]);

  const result = useMemo(() => {
    if (!bundle) return null;
    return validateConfigurationSelection(bundle, selection, audience);
  }, [bundle, selection, audience]);

  function togglePackage(id) {
    setPackageIds((prev) => (
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    ));
  }

  if (!bundle) return <p>Modelljahr nicht gefunden.</p>;

  return (
    <>
      <section className="cf-panel">
        <h2 className="cf-panel__title">Test-Konfiguration</h2>
        <p>Simuliert Verkäufer- oder Admin-Modus – alle Entscheidungen kommen aus Regeln in der Datenbank.</p>
        <div className="cf-form-row">
          <label>
            Linie
            <select value={trimId} onChange={(e) => setTrimId(e.target.value)}>
              {bundle.trims.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label>
            Antrieb
            <select value={powertrainId} onChange={(e) => setPowertrainId(e.target.value)}>
              {bundle.powertrains.map((pt) => (
                <option key={pt.id} value={pt.id}>{pt.name}</option>
              ))}
            </select>
          </label>
          <label>
            Modus
            <select value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value={CONFIGURATOR_AUDIENCE.ADMIN}>Admin (Test)</option>
              <option value={CONFIGURATOR_AUDIENCE.SELLER}>Verkäufer (nur live)</option>
            </select>
          </label>
        </div>
      </section>

      {result?.needsReview && (
        <div className="cf-review-banner" role="alert">{REVIEW_MESSAGE}</div>
      )}

      <section className="cf-panel">
        <h2 className="cf-panel__title">Pakete</h2>
        <table className="cf-table">
          <thead>
            <tr>
              <th>Wählen</th>
              <th>Paket</th>
              <th>Status</th>
              <th>Preis</th>
              <th>Hinweise</th>
            </tr>
          </thead>
          <tbody>
            {(result?.state?.packages ?? []).map((pkg) => {
              const clickable = pkg.status === 'available' || pkg.status === 'selected';
              return (
                <tr key={pkg.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={packageIds.includes(pkg.id)}
                      disabled={!clickable}
                      onChange={() => togglePackage(pkg.id)}
                    />
                  </td>
                  <td>{pkg.name}</td>
                  <td>{statusBadge(pkg.status)}</td>
                  <td>{pkg.priceGross != null ? `${pkg.priceGross} €` : '—'}</td>
                  <td>
                    {pkg.status === 'included' && pkg.includedInTrimLabel && (
                      <>Bereits in {pkg.includedInTrimLabel} enthalten</>
                    )}
                    {pkg.missingRequiredLabels?.length > 0 && (
                      <>Benötigt: {pkg.missingRequiredLabels.join(', ')}</>
                    )}
                    {pkg.dependencyHints?.map((h) => <div key={h}>{h}</div>)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="cf-panel">
        <h2 className="cf-panel__title">Farben ({result?.state?.colors?.length ?? 0})</h2>
        <ul>
          {(result?.state?.colors ?? []).slice(0, 12).map((c) => (
            <li key={c.id}>{c.label} – {c.priceGross ? `+ ${c.priceGross} €` : 'Serie'}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
