import './ImportAnalysisCenter.css';

export default function ImportAnalysisCenter({ importRecord, loading }) {
  if (loading) {
    return (
      <section className="import-analysis import-analysis--loading" aria-live="polite">
        <div className="import-analysis__spinner" aria-hidden />
        <h2 className="import-analysis__title">Analyse läuft…</h2>
        <p className="import-analysis__sub">
          KI erkennt Modelle, Preise, Pakete, Farben, WLTP und Reichweiten…
        </p>
      </section>
    );
  }

  if (!importRecord) return null;

  const { brand, model, modelYear, analysisSummary } = importRecord;
  const summary = analysisSummary ?? {};

  const items = [
    summary.priceChanges > 0 && `${summary.priceChanges} Preisänderung${summary.priceChanges > 1 ? 'en' : ''}`,
    summary.newEngines > 0 && `${summary.newEngines} neue Ausstattungslinie${summary.newEngines > 1 ? 'n' : ''}`,
    summary.newColors > 0 && `${summary.newColors} neue Farbe${summary.newColors > 1 ? 'n' : ''}`,
    summary.newPackages > 0 && `${summary.newPackages} Paket-Änderung${summary.newPackages > 1 ? 'en' : ''}`,
    summary.wltpUpdated && 'WLTP / Verbrauch aktualisiert',
    summary.rangeUpdates > 0 && `${summary.rangeUpdates} Reichweiten-Update`,
  ].filter(Boolean);

  return (
    <section className="import-analysis" aria-live="polite">
      <header className="import-analysis__head">
        <p className="import-analysis__kicker">Gefundene Änderungen</p>
        <h2 className="import-analysis__title">
          {brand} {model} {modelYear}
        </h2>
        <p className="import-analysis__file">{importRecord.sourceFile?.name}</p>
      </header>
      <ul className="import-analysis__list">
        {items.map((item) => (
          <li key={item} className="import-analysis__item">
            <span className="import-analysis__check" aria-hidden>✓</span>
            {item}
          </li>
        ))}
      </ul>
      {items.length === 0 && (
        <p className="import-analysis__empty">Keine Änderungen gegenüber dem aktuellen Stand.</p>
      )}
    </section>
  );
}
