import { Link } from 'react-router-dom';
import { dealerListings, SYNC_LABELS } from '../../data/dealerListings.js';

export default function LandingDealerNetwork() {
  return (
    <section className="lp-section lp-dealers" aria-labelledby="lp-dealers-title">
      <div className="lp-dealer-cta">
        <h2 id="lp-dealers-title" className="lp-dealer-cta__title">Für Händler</h2>
        <p className="lp-dealer-cta__sub">Mehr Abschlüsse statt mehr Leads.</p>
        <Link to="/partner" className="lp-btn lp-btn--secondary">
          Für Händler
        </Link>
      </div>

      <div className="lp-dealers__grid">
        {dealerListings.map((dealer) => (
          <article key={dealer.slug} className="lp-dealer-card">
            <h3 className="lp-dealer-card__name">{dealer.name}</h3>
            <p className="lp-dealer-card__meta">
              {dealer.city} · {dealer.brand} {dealer.model}
            </p>
            <p className="lp-dealer-card__sync">
              {SYNC_LABELS[dealer.syncStatus] ?? dealer.syncStatus}
            </p>
            {dealer.hasDealerPage && (
              <Link to={dealer.dealerPagePath} className="lp-dealer-card__link">
                Händlerseite →
              </Link>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
