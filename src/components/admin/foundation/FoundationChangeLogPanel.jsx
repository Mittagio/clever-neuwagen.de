import { getModelYearBundle } from '../../../data/foundation/configuratorFoundationSchema.js';

export default function FoundationChangeLogPanel({ database, modelYearId }) {
  const bundle = getModelYearBundle(database, modelYearId);
  const entries = bundle?.changeLogs ?? [];

  return (
    <section className="cf-panel">
      <h2 className="cf-panel__title">Änderungsprotokoll</h2>
      {!entries.length && <p>Noch keine Einträge für dieses Modelljahr.</p>}
      <table className="cf-table">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Änderung</th>
            <th>Quelle</th>
            <th>Autor</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>{entry.createdAt?.slice(0, 10) ?? '—'}</td>
              <td>{entry.summary}</td>
              <td>{entry.source ?? '—'}</td>
              <td>{entry.author ?? '—'}</td>
              <td>{entry.status ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
