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
    <section className="dl-section dl-curated-section" aria-labelledby="dl-curated-heading">
      <h3 id="dl-curated-heading" className="dl-section__title">
        Kunden mit ähnlichen Wünschen wählen
      </h3>
      <div className="dl-curated-rows">
        {DEALER_CURATED_GROUPS.map((group) => (
          <div key={group.id} className="dl-curated-row">
            <p className="dl-curated-row__label">
              <span aria-hidden>{group.icon}</span>
              {group.label}
            </p>
            <div className="dl-curated-row__chips">
              {group.picks.map((pick) => (
                <button
                  key={pick.label}
                  type="button"
                  className="dl-curated-chip"
                  onClick={() => go(pick.query)}
                >
                  {pick.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
