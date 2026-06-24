import './clever-consultation.css';

/**
 * Verkäufer-Übergabe – Zusammenfassung für den Händler.
 */
export default function SellerHandoffPanel({
  handoffSummary,
  vehicleTitle,
  dealerName,
  onRequestContact,
  onConfigureClassic,
  onBack,
}) {
  const { lines = [], openQuestions = [], recognizedWishes = [] } = handoffSummary ?? {};

  return (
    <section className="dl-seller-handoff" aria-labelledby="dl-seller-handoff-title">
      <header className="dl-seller-handoff__head">
        <p className="dl-seller-handoff__eyebrow">👤 Verkäufer übernimmt</p>
        <h2 id="dl-seller-handoff-title" className="dl-seller-handoff__title">
          Ihre Beratung ist vorbereitet
        </h2>
        <p className="dl-seller-handoff__sub">
          {dealerName ?? 'Ihr Verkaufsberater'}
          {' '}
          erhält alle Antworten und kann direkt mit Ihnen ins Gespräch gehen.
        </p>
      </header>

      {vehicleTitle && (
        <p className="dl-seller-handoff__vehicle">{vehicleTitle}</p>
      )}

      {lines.length > 0 && (
        <dl className="dl-seller-handoff__summary">
          {lines.map((row) => (
            <div
              key={`${row.label}-${row.value}`}
              className={`dl-seller-handoff__row${row.highlight ? ' dl-seller-handoff__row--highlight' : ''}`}
            >
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {recognizedWishes.length > 0 && (
        <div className="dl-seller-handoff__wishes">
          <p className="dl-seller-handoff__wishes-label">Erkannte Wünsche</p>
          <ul>
            {recognizedWishes.map((wish) => (
              <li key={wish}>{wish}</li>
            ))}
          </ul>
        </div>
      )}

      {openQuestions.length > 0 && (
        <div className="dl-seller-handoff__open">
          <p className="dl-seller-handoff__open-label">Offene Fragen</p>
          <ul>
            {openQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="dl-seller-handoff__actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onRequestContact}
        >
          Kontakt aufnehmen
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onConfigureClassic}
        >
          Optional: Konfigurator öffnen
        </button>
        {onBack && (
          <button type="button" className="dl-seller-handoff__back" onClick={onBack}>
            ← Zur Empfehlung
          </button>
        )}
      </div>
    </section>
  );
}
