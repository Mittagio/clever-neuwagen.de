export default function DealerAiAnalysisCard({ parsed, onFieldEdit }) {
  if (!parsed?.ok) return null;

  return (
    <section className="dai-card">
      <header className="dai-card__head">
        <h2 className="dai-card__title">Ich habe erkannt</h2>
        <span className="dai-confidence">
          {Math.round((parsed.confidence ?? 0) * 100)} % sicher
        </span>
      </header>

      <dl className="dai-fields">
        {parsed.displayFields.map((row) => (
          <div key={row.label} className="dai-field">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>

      {onFieldEdit && (
        <p className="dai-card__hint">
          Mit „Bearbeiten“ können Sie die Eingabe anpassen und erneut analysieren.
        </p>
      )}
    </section>
  );
}
