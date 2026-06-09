import DiscoveryModelLineCard from './DiscoveryModelLineCard.jsx';
import { deriveAdvisorChipIds } from '../../services/sales/advisorRanking.js';
import { enrichModelLineGroupWithProfileQuote } from '../../services/cleverQuote/cleverQuoteService.js';

export default function DiscoverySearchAlternatives({
  guidanceMessage,
  alternatives = [],
  filters,
  wishes,
  searchProfile = null,
  paymentMode = 'cash',
  paymentNeutral = false,
  onViewOffer,
  onCleverQuoteWhy,
  onChangePaymentMode,
}) {
  if (!alternatives.length) return null;

  const chipIds = deriveAdvisorChipIds(filters, wishes);

  return (
    <section className="disc-search-alternatives" aria-labelledby="disc-alternatives-heading">
      {guidanceMessage && (
        <p id="disc-alternatives-heading" className="disc-search-alternatives__note" role="status">
          {guidanceMessage}
        </p>
      )}

      {alternatives.map((tier) => (
        <div key={tier.id} className="disc-search-alternatives__tier">
          <header className="disc-search-alternatives__tier-head">
            <h3 className="disc-search-alternatives__tier-title">{tier.title}</h3>
            <p className="disc-search-alternatives__tier-text">{tier.explanation}</p>
          </header>
          <div className="disc-model-line-list disc-model-line-list--tier">
            {tier.modelLineGroups.map((group) => (
              <DiscoveryModelLineCard
                key={group.modelLineKey ?? group.label}
                group={enrichModelLineGroupWithProfileQuote(group, searchProfile)}
                rank={group.rank ?? 1}
                paymentMode={paymentMode}
                paymentNeutral={paymentNeutral}
                wishes={wishes}
                chipIds={chipIds}
                searchProfile={searchProfile}
                onViewOffer={onViewOffer}
                onCleverQuoteWhy={onCleverQuoteWhy}
                onChangePaymentMode={onChangePaymentMode}
                defaultVariantsOpen={false}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
