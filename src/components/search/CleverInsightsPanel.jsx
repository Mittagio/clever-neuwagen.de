import './cleverInsights.css';

export default function CleverInsightsPanel({ insights, onApply, className = '' }) {
  if (!insights?.length) return null;

  return (
    <section
      className={`clever-insights${className ? ` ${className}` : ''}`}
      aria-label="Clever Insights"
    >
      {insights.map((insight) => (
        <article key={insight.id} className="clever-insight">
          <div className="clever-insight__content">
            <p className="clever-insight__label">Clever Insight</p>
            <p className="clever-insight__text">
              <span className="clever-insight__icon" aria-hidden="true">💡</span>
              {insight.headline}{' '}
              <span className="clever-insight__emphasis">{insight.body}</span>
            </p>
          </div>
          <button
            type="button"
            className="clever-insight__action"
            onClick={() => onApply?.(insight)}
          >
            {insight.actionLabel}
          </button>
        </article>
      ))}
    </section>
  );
}

/** Einzeiliger Tipp für Mobile — antippen wendet Vorschlag an. */
export function CleverInsightMobileTip({ insight, onApply, onOpenFilters }) {
  if (!insight) {
    return (
      <button
        type="button"
        className="clever-insight-tip clever-insight-tip--filters"
        onClick={onOpenFilters}
      >
        <span className="clever-insight-tip__icon" aria-hidden="true">⚙</span>
        <span className="clever-insight-tip__text">Filter &amp; Suche verfeinern</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="clever-insight-tip"
      onClick={() => onApply?.(insight)}
    >
      <span className="clever-insight-tip__icon" aria-hidden="true">💡</span>
      <span className="clever-insight-tip__text">
        {insight.headline} {insight.body}
      </span>
    </button>
  );
}
