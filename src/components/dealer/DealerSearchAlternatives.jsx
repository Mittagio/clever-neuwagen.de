import DealerSearchResults from './DealerSearchResults.jsx';
import './dealer-landing.css';

export default function DealerSearchAlternatives({
  query,
  searchProfile,
  guidanceMessage,
  exclusionHint,
  alternatives = [],
  dealerSlug,
  city = '',
  source = 'local',
  onShowAll,
}) {
  if (!alternatives.length) return null;

  return (
    <section className="dl-search-alternatives" aria-labelledby="dl-alternatives-heading">
      <div className="dl-search-alternatives__banner" role="status">
        <h2 id="dl-alternatives-heading" className="dl-section__title">
          Exakt passend: nicht im Bestand
        </h2>
        <p className="dl-search-alternatives__lead">
          {guidanceMessage}
        </p>
        {exclusionHint && exclusionHint !== guidanceMessage && (
          <p className="dl-search-alternatives__hint">{exclusionHint}</p>
        )}
      </div>

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
