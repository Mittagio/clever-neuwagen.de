import './clever-conversation.css';

export default function CleverDealerPrepCard({ summary }) {
  if (!summary) return null;

  return (
    <section className="cc-dealer-prep cc-turn-enter" aria-labelledby="cc-dealer-prep-title">
      <h2 id="cc-dealer-prep-title" className="cc-dealer-prep__title">
        {summary.title}
      </h2>

      <p className="cc-dealer-prep__intro">{summary.intro}</p>

      <ul className="cc-dealer-prep__list">
        {summary.items.map((item) => (
          <li key={item} className="cc-dealer-prep__item">
            <span aria-hidden>✓</span>
            {item}
          </li>
        ))}
      </ul>

      {(summary.directionLine || summary.trimLine) && (
        <div className="cc-dealer-prep__direction">
          {summary.directionLine && <p>{summary.directionLine}</p>}
          {summary.trimLine && <p>{summary.trimLine}</p>}
        </div>
      )}

      <button type="button" className="cc-dealer-prep__cta">
        Persönliche Anfrage vorbereiten
      </button>
    </section>
  );
}
