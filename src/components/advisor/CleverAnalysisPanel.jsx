import '../vehicle-detail/vehicle-detail.css';

export default function CleverAnalysisPanel({ fulfillment }) {
  if (!fulfillment?.total) return null;

  const { matched, total, scoreLabel, items } = fulfillment;
  const complete = matched === total;

  return (
    <section className="vd-clever-analysis" aria-label="Clever-Neuwagen Analyse">
      <p className="vd-clever-analysis__kicker">Clever-Neuwagen Analyse</p>
      <div className="vd-clever-analysis__score-row">
        <p className="vd-clever-analysis__score">
          Fahrzeug erfüllt: <strong>{scoreLabel}</strong>
        </p>
        <div
          className={`vd-clever-analysis__ring${complete ? ' is-complete' : ''}`}
          aria-hidden
        >
          <span>{matched}/{total}</span>
        </div>
      </div>
      <p className="vd-clever-analysis__lead">
        {complete
          ? 'Das Auto passt zu Ihnen – alle Wünsche sind abgedeckt.'
          : 'Wir ergänzen fehlende Wünsche automatisch über Pakete oder eine passendere Ausstattung.'}
      </p>
      <ul className="vd-clever-analysis__list">
        {items.map((item) => (
          <li
            key={item.id}
            className={`vd-clever-analysis__item vd-clever-analysis__item--${item.status}`}
          >
            <span className="vd-clever-analysis__check" aria-hidden>
              {item.status === 'standard' || item.status === 'fulfilled' ? '✓' : '○'}
            </span>
            <span className="vd-clever-analysis__label">{item.label}</span>
            <span className="vd-clever-analysis__status">{item.statusLabel}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
