import { useEffect, useState } from 'react';
import { getModelYearBundle, summarizeModelYearStatus } from '../../../data/foundation/configuratorFoundationSchema.js';
import { validateModelYearData } from '../../../services/foundation/configuratorValidation.js';

export default function FoundationDataStatusPanel({ database, modelYearId }) {
  const bundle = getModelYearBundle(database, modelYearId);
  const summary = summarizeModelYearStatus(bundle);
  const [validation, setValidation] = useState(null);

  useEffect(() => {
    if (!modelYearId) return;
    setValidation(validateModelYearData(database, modelYearId));
  }, [database, modelYearId]);

  if (!bundle) return <p>Modelljahr nicht gefunden.</p>;

  return (
    <>
      <section className="cf-panel">
        <h2 className="cf-panel__title">Datenstatus</h2>
        <div className="cf-grid">
          <div className="cf-stat">
            <span className="cf-stat__label">Gesamtstatus</span>
            <span className="cf-stat__value">{summary.label}</span>
          </div>
          <div className="cf-stat">
            <span className="cf-stat__label">Live-Regeln</span>
            <span className="cf-stat__value">{summary.liveRules}</span>
          </div>
          <div className="cf-stat">
            <span className="cf-stat__label">Entwürfe</span>
            <span className="cf-stat__value">{summary.draftRules}</span>
          </div>
          <div className="cf-stat">
            <span className="cf-stat__label">Validierung</span>
            <span className="cf-stat__value">{validation?.ok ? 'OK' : 'Prüfen'}</span>
          </div>
        </div>
      </section>

      {validation && (
        <section className="cf-panel">
          <h2 className="cf-panel__title">
            Validierung – {validation.summary.errors} Fehler, {validation.summary.warnings} Warnungen
          </h2>
          {!validation.issues.length && <p>Keine Auffälligkeiten.</p>}
          <ul>
            {validation.issues.map((issue) => (
              <li key={`${issue.code}-${issue.message}`}>
                <strong>{issue.severity}</strong>: {issue.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="cf-panel">
        <h2 className="cf-panel__title">Quelldokumente</h2>
        <ul>
          {(bundle.sourceDocuments ?? []).map((doc) => (
            <li key={doc.id}>{doc.title} {doc.importedAt ? `(${doc.importedAt})` : ''}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
