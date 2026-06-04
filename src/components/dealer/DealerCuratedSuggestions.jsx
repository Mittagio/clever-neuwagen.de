import { useNavigate } from 'react-router-dom';
import { buildWishSearchUrl } from '../../services/wish/wishUrlService.js';
import { DEALER_CURATED_GROUPS } from '../../data/dealerLandingContent.js';
import './dealer-landing.css';

export default function DealerCuratedSuggestions() {
  const navigate = useNavigate();

  function go(query) {
    navigate(buildWishSearchUrl(query));
  }

  return (
    <section className="dl-section" aria-labelledby="dl-curated-heading">
      <h3 id="dl-curated-heading" className="dl-section__title">
        Clever-Empfehlungen
      </h3>
      <p className="dl-section__sub">Was Kunden mit ähnlichen Wünschen wählen</p>
      <div className="dl-curated">
        {DEALER_CURATED_GROUPS.map((group) => (
          <article key={group.id} className="dl-curated__group card">
            <h4 className="dl-curated__label">{group.label}</h4>
            <ul className="dl-curated__picks">
              {group.picks.map((pick) => (
                <li key={pick.label}>
                  <button
                    type="button"
                    className="dl-curated__pick"
                    onClick={() => go(pick.query)}
                  >
                    {pick.label}
                  </button>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
