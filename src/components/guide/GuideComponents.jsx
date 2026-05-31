import { Link } from 'react-router-dom';
import { GUIDE_CATEGORIES } from '../../data/guideCatalog.js';
import './GuideComponents.css';

export function GuideCategoryNav({ activeCategory, onSelect }) {
  return (
    <nav className="guide-categories" aria-label="Ratgeber-Kategorien">
      <button
        type="button"
        className={`guide-cat${!activeCategory ? ' is-active' : ''}`}
        onClick={() => onSelect(null)}
      >
        Alle
      </button>
      {GUIDE_CATEGORIES.map((cat) => (
        <button
          key={cat.id}
          type="button"
          className={`guide-cat${activeCategory === cat.id ? ' is-active' : ''}`}
          onClick={() => onSelect(cat.id)}
        >
          {cat.label}
        </button>
      ))}
    </nav>
  );
}

export function GuideArticleCard({ article, categoryLabel }) {
  return (
    <article className="guide-card">
      <p className="guide-card__cat">{categoryLabel}</p>
      <h2 className="guide-card__title">
        <Link to={`/ratgeber/${article.slug}`}>{article.title}</Link>
      </h2>
      <p className="guide-card__desc">{article.metaDescription}</p>
      <p className="guide-card__meta">{article.readMinutes} Min. Lesezeit</p>
      <Link to={`/ratgeber/${article.slug}`} className="guide-card__link">
        Artikel lesen →
      </Link>
    </article>
  );
}

export function GuideCompareTable({ items }) {
  if (!items?.length) return null;

  return (
    <div className="guide-compare-wrap">
      <table className="guide-compare">
        <caption className="guide-sr-only">Fahrzeugvergleich</caption>
        <thead>
          <tr>
            <th scope="col">Modell</th>
            <th scope="col">Leasingrate</th>
            <th scope="col">Lieferzeit</th>
            <th scope="col">Antrieb</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <span className="guide-compare__medal">{item.rankMedal}</span>
                {item.fullLabel ?? item.label}
              </td>
              <td><strong>{formatRate(item.monthlyRate)}</strong>/Mt.</td>
              <td>{item.deliveryTime}</td>
              <td>{item.fuelLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatRate(value) {
  if (value == null) return '–';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function GuideLeasingExamples({ examples, dealerName }) {
  if (!examples?.length) return null;

  return (
    <ul className="guide-leasing-list">
      {examples.map((ex) => (
        <li key={ex.label} className="guide-leasing-item">
          <div>
            <p className="guide-leasing-item__name">{ex.label}</p>
            <p className="guide-leasing-item__meta">
              {ex.termMonths} Monate · {ex.mileagePerYear} km/Jahr · {ex.deliveryTime}
            </p>
          </div>
          <p className="guide-leasing-item__rate">{ex.rateFormatted}<span>/Monat</span></p>
        </li>
      ))}
      <li className="guide-leasing-note">
        Beispielkonditionen von {dealerName}. Individuelle Angebote können abweichen.
      </li>
    </ul>
  );
}

export function GuideRecommendationList({ recommendations }) {
  return (
    <ol className="guide-rec-list">
      {recommendations.map((rec) => (
        <li key={rec.id} className="guide-rec-item">
          <span className="guide-rec-item__rank">{rec.rankMedal}</span>
          <div>
            <h3 className="guide-rec-item__name">{rec.fullLabel ?? rec.label}</h3>
            <p className="guide-rec-item__rate">
              ab {formatRate(rec.monthlyRate)}/Monat · {rec.deliveryTime}
            </p>
            <ul className="guide-rec-item__bullets">
              {rec.reasonBullets?.slice(0, 2).map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function GuideCtaBlock({ advisorLink, configuratorLink }) {
  return (
    <aside className="guide-cta">
      <h2 className="guide-cta__title">Persönliche Empfehlung gewünscht?</h2>
      <p className="guide-cta__text">
        Der KI-Kaufberater berücksichtigt Ihr Budget, Ihre Kilometer und Ihre Wünsche – kostenlos und unverbindlich.
      </p>
      <div className="guide-cta__actions">
        <Link to={advisorLink} className="guide-cta__btn guide-cta__btn--primary">
          🤖 KI-Beratung starten
        </Link>
        <Link to={configuratorLink} className="guide-cta__btn guide-cta__btn--secondary">
          Sportage konfigurieren
        </Link>
      </div>
    </aside>
  );
}

export function GuideFaq({ items }) {
  if (!items?.length) return null;

  return (
    <section className="guide-faq">
      <h2>Häufige Fragen</h2>
      <dl>
        {items.map((item) => (
          <div key={item.q} className="guide-faq__item">
            <dt>{item.q}</dt>
            <dd>{item.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
