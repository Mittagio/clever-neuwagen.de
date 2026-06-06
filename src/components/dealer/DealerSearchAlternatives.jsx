import DealerSearchResults from './DealerSearchResults.jsx';
import './dealer-landing.css';

export default function DealerSearchAlternatives({
  query,
  searchProfile,
  guidanceMessage,
  alternatives = [],
  filters = null,
  wishes = null,
  dealerSlug,
  city = '',
  source = 'local',
  onShowAll,
}) {
  if (!alternatives.length) return null;

  return (
    <section className="dl-search-alternatives" aria-labelledby="dl-alternatives-heading">
      {guidanceMessage && (
        <p id="dl-alternatives-heading" className="dl-search-alternatives__note" role="status">
          {guidanceMessage}
        </p>
      )}

      {alternatives.map((tier) => (
        <div key={tier.id} className="dl-search-alternatives__tier">
          <header className="dl-search-alternatives__tier-head">
            <h3 className="dl-search-alternatives__tier-title">{tier.title}</h3>
            <p className="dl-search-alternatives__tier-text">{tier.explanation}</p>
          </header>
          <DealerSearchResults
            query={query}
            searchProfile={searchProfile}
            modelLineGroups={tier.modelLineGroups}
            filters={filters}
            wishes={wishes}
            dealerSlug={dealerSlug}
            city={city}
            source={source}
            onShowAll={onShowAll}
            hideHeader
            alternativeTier
          />
        </div>
      ))}
    </section>
  );
}
