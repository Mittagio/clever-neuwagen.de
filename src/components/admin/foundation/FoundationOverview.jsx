import { getModelYearBundle, summarizeModelYearStatus } from '../../../data/foundation/configuratorFoundationSchema.js';

function StatusPill({ status }) {
  const cls = `cf-badge cf-badge--${status ?? 'draft'}`;
  return <span className={cls}>{status ?? 'draft'}</span>;
}

export default function FoundationOverview({ database, selectedModelYearId, onSelectModelYear }) {
  const bundle = getModelYearBundle(database, selectedModelYearId);
  const summary = summarizeModelYearStatus(bundle);

  return (
    <>
      <section className="cf-panel">
        <h2 className="cf-panel__title">Hersteller & Modelle</h2>
        <div className="cf-grid">
          {(database.manufacturers ?? []).map((mfg) => (
            <div key={mfg.id} className="cf-stat">
              <span className="cf-stat__label">Hersteller</span>
              <span className="cf-stat__value">{mfg.name}</span>
              <StatusPill status={mfg.status} />
            </div>
          ))}
        </div>
      </section>

      <section className="cf-panel">
        <h2 className="cf-panel__title">Modelljahre</h2>
        <table className="cf-table">
          <thead>
            <tr>
              <th>Modell</th>
              <th>Jahr</th>
              <th>Status</th>
              <th>Trims</th>
              <th>Pakete</th>
              <th>Regeln live</th>
            </tr>
          </thead>
          <tbody>
            {(database.modelYears ?? []).map((my) => {
              const b = getModelYearBundle(database, my.id);
              const s = summarizeModelYearStatus(b);
              const modelName = database.models.find((m) => m.id === my.modelId)?.name ?? my.modelId;
              return (
                <tr key={my.id}>
                  <td>
                    <button
                      type="button"
                      className="cf-admin__link-btn"
                      onClick={() => onSelectModelYear(my.id)}
                    >
                      {modelName}
                    </button>
                  </td>
                  <td>{my.modelYear}</td>
                  <td><StatusPill status={s.status} /></td>
                  <td>{s.trims}</td>
                  <td>{s.packages}</td>
                  <td>{s.liveRules}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {bundle && (
        <section className="cf-panel">
          <h2 className="cf-panel__title">
            {bundle.model?.name} {bundle.modelYear?.modelYear} – Struktur
          </h2>
          <div className="cf-grid">
            <div className="cf-stat"><span className="cf-stat__label">Trims</span><span className="cf-stat__value">{summary.trims}</span></div>
            <div className="cf-stat"><span className="cf-stat__label">Antriebe</span><span className="cf-stat__value">{summary.powertrains}</span></div>
            <div className="cf-stat"><span className="cf-stat__label">Ausstattung</span><span className="cf-stat__value">{summary.equipmentItems}</span></div>
            <div className="cf-stat"><span className="cf-stat__label">Pakete</span><span className="cf-stat__value">{summary.packages}</span></div>
            <div className="cf-stat"><span className="cf-stat__label">Regeln gesamt</span><span className="cf-stat__value">{bundle.rules.length}</span></div>
            <div className="cf-stat"><span className="cf-stat__label">Quellen</span><span className="cf-stat__value">{bundle.sourceDocuments.length}</span></div>
          </div>
        </section>
      )}
    </>
  );
}
