import { Link } from 'react-router-dom';
import './TrendComponents.css';

export function TrendPageCard({ page, categoryLabel }) {
  return (
    <article className="trend-card">
      <p className="trend-card__cat">{categoryLabel}</p>
      <h2 className="trend-card__title">
        <Link to={page.url}>{page.title}</Link>
      </h2>
      <p className="trend-card__desc">{page.metaDescription}</p>
      <div className="trend-card__footer">
        <span className="trend-card__meta">{page.readMinutes} Min.</span>
        {page.source === 'intelligence' && (
          <span className="trend-card__badge">Marktdaten</span>
        )}
        <Link to={page.url} className="trend-card__link">Trend lesen →</Link>
      </div>
    </article>
  );
}

export function TrendFeaturedCard({ page, categoryLabel }) {
  const publishedLabel = page.publishedAt
    ? new Date(page.publishedAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
    : null;

  return (
    <article className="trend-featured">
      <div className="trend-featured__badge">Neu aus Intelligence</div>
      <p className="trend-featured__cat">{categoryLabel}</p>
      <h2 className="trend-featured__title">
        <Link to={page.url}>{page.title}</Link>
      </h2>
      <p className="trend-featured__desc">{page.metaDescription ?? page.reason}</p>
      <div className="trend-featured__footer">
        {publishedLabel && (
          <span className="trend-featured__date">Veröffentlicht {publishedLabel}</span>
        )}
        <Link to={page.url} className="trend-featured__link">Jetzt lesen →</Link>
      </div>
    </article>
  );
}

export function TrendCategoryNav({ categories, activeCategory, onSelect }) {
  return (
    <nav className="trend-categories" aria-label="Trend-Kategorien">
      <button
        type="button"
        className={`trend-cat${!activeCategory ? ' is-active' : ''}`}
        onClick={() => onSelect(null)}
      >
        Alle
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          className={`trend-cat${activeCategory === cat.id ? ' is-active' : ''}`}
          onClick={() => onSelect(cat.id)}
        >
          {cat.label}
        </button>
      ))}
    </nav>
  );
}

export function TrendMarketInsights({ insights }) {
  if (!insights) return null;

  return (
    <section className="trend-market" aria-labelledby="trend-market-heading">
      <h2 id="trend-market-heading">Markt-Einordnung</h2>
      <p className="trend-market__sub">
        {insights.dataMode === 'live'
          ? 'Basierend auf echten Beratungen, Vergleichen und Angeboten der letzten 7 Tage.'
          : 'Beispielhafte Markteinordnung – starten Sie eine Beratung, um Live-Daten zu erzeugen.'}
      </p>
      <div className="trend-market__grid">
        {insights.topDesiredRate && (
          <div className="trend-market__stat">
            <p className="trend-market__label">Beliebteste Wunschrate</p>
            <p className="trend-market__value">{insights.topDesiredRate}</p>
          </div>
        )}
        {insights.topSearches?.[0] && (
          <div className="trend-market__stat">
            <p className="trend-market__label">Top-Suche</p>
            <p className="trend-market__value">{insights.topSearches[0].query}</p>
          </div>
        )}
        {insights.topComparisons?.[0] && (
          <div className="trend-market__stat">
            <p className="trend-market__label">Top-Vergleich</p>
            <p className="trend-market__value">{insights.topComparisons[0].pair}</p>
          </div>
        )}
        {insights.highlightComparison && (
          <div className="trend-market__stat">
            <p className="trend-market__label">Dieser Vergleich</p>
            <p className="trend-market__value">{insights.highlightComparison.count}×</p>
          </div>
        )}
      </div>
    </section>
  );
}

export function TrendDealsStrip({ recommendations }) {
  const deals = recommendations?.filter((r) => r.cleverScore).slice(0, 3);
  if (!deals?.length) return null;

  return (
    <section className="trend-deals" aria-labelledby="trend-deals-heading">
      <h2 id="trend-deals-heading">Clever Score Highlights</h2>
      <ul className="trend-deals__list">
        {deals.map((rec) => (
          <li key={rec.id} className="trend-deals__item">
            <span className="trend-deals__fire" aria-hidden>🔥</span>
            <div>
              <p className="trend-deals__name">{rec.fullLabel ?? rec.label}</p>
              <p className="trend-deals__meta">
                {rec.monthlyRate != null && `${rec.monthlyRate} €/Mt.`}
                {rec.cleverScore != null && ` · Score ${rec.cleverScore}/100`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
