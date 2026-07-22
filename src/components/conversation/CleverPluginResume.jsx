import './clever-conversation.css';

export default function CleverPluginResume({
  labels = [],
  crossModelHint = null,
  onContinue,
  onRestart,
}) {
  return (
    <section className="cc-plugin-resume cc-turn-enter" aria-labelledby="cc-plugin-resume-title">
      <h2 id="cc-plugin-resume-title" className="cc-plugin-resume__title">
        Willkommen zurück.
      </h2>
      <p className="cc-plugin-resume__lead">
        Möchten Sie bei Ihren bisherigen Wünschen weitermachen?
      </p>

      {labels.length > 0 && (
        <ul className="cc-plugin-resume__chips" aria-label="Bisherige Wünsche">
          {labels.slice(0, 8).map((label) => (
            <li key={label} className="cc-plugin-resume__chip">{label}</li>
          ))}
        </ul>
      )}

      {crossModelHint && (
        <p className="cc-plugin-resume__cross">{crossModelHint.text}</p>
      )}

      <div className="cc-plugin-resume__actions">
        <button type="button" className="cc-plugin-resume__btn cc-plugin-resume__btn--primary" onClick={onContinue}>
          Weiter
        </button>
        <button type="button" className="cc-plugin-resume__btn" onClick={onRestart}>
          Neu starten
        </button>
      </div>
    </section>
  );
}
