import { useMemo, useState } from 'react';
import VehicleImage from '../shared/VehicleImage.jsx';
import MobileBottomSheet from '../shared/MobileBottomSheet.jsx';
import CleverQuoteBadge, { CleverQuoteCompareCards } from '../cleverQuote/CleverQuoteBadge.jsx';
import { RecommendReasonsPanel } from '../cleverQuote/CleverQuoteWhyPanel.jsx';
import { formatCurrency } from '../../logic/marketplaceService.js';
import { buildRecommendReasons } from '../../services/cleverQuote/cleverQuoteRecommendation.js';
import './compare-mobile.css';

function formatMatchPrice(match, paymentMode) {
  if (match.bestOffer?.monthlyRate != null && paymentMode !== 'cash') {
    return `${formatCurrency(match.bestOffer.monthlyRate)}/Monat`;
  }
  if (match.vehicle?.cashPrice != null) {
    return formatCurrency(match.vehicle.cashPrice);
  }
  return '';
}

function CompareDuelCard({
  match,
  paymentMode,
  wishes,
  isWinner = false,
  onView,
}) {
  const v = match.vehicle;
  const title = `${match.model}${match.bestTrim ? ` ${match.bestTrim}` : ''}`;
  const reasons = buildRecommendReasons(match, { wishes, maxReasons: 2 });

  return (
    <article className={`compare-duel-card${isWinner ? ' compare-duel-card--winner' : ''}`}>
      {isWinner && <span className="compare-duel-card__badge">Besserer Treffer</span>}
      <div className="compare-duel-card__media">
        <VehicleImage
          brand={v.brand}
          model={v.imageModel ?? v.model}
          bodyType={v.bodyType}
          className="compare-duel-card__image-wrap"
          imageClassName="compare-duel-card__image"
        />
      </div>
      <h3 className="compare-duel-card__title">{title}</h3>
      {match.cleverQuote && (
        <div className="compare-duel-card__cq">
          <CleverQuoteBadge cleverQuote={match.cleverQuote} size="sm" showTier={false} />
        </div>
      )}
      <RecommendReasonsPanel reasons={reasons} title="Warum?" />
      <p className="compare-duel-card__price">{formatMatchPrice(match, paymentMode)}</p>
      <button type="button" className="compare-duel-card__cta" onClick={() => onView?.(match)}>
        Angebot ansehen
      </button>
    </article>
  );
}

function CompareExtraRow({ match, paymentMode, onView }) {
  const title = `${match.model}${match.bestTrim ? ` ${match.bestTrim}` : ''}`;
  return (
    <button type="button" className="compare-extra-row" onClick={() => onView?.(match)}>
      <div className="compare-extra-row__main">
        {match.cleverQuote && (
          <CleverQuoteBadge cleverQuote={match.cleverQuote} size="sm" showTier={false} />
        )}
        <span className="compare-extra-row__title">{title}</span>
      </div>
      <span className="compare-extra-row__price">{formatMatchPrice(match, paymentMode)}</span>
    </button>
  );
}

export default function CompareResultsHub({
  matches = [],
  paymentMode = 'leasing',
  wishes = [],
  onViewVehicle,
}) {
  const [extraOpen, setExtraOpen] = useState(false);

  const sorted = useMemo(() => {
    return [...matches].sort((a, b) => {
      const ap = a.cleverQuote?.percent;
      const bp = b.cleverQuote?.percent;
      if (ap != null && bp != null) return bp - ap;
      if (ap != null) return -1;
      if (bp != null) return 1;
      return (b.score ?? 0) - (a.score ?? 0);
    });
  }, [matches]);

  const topTwo = sorted.slice(0, 2);
  const rest = sorted.slice(2);

  if (!matches.length) return null;

  return (
    <div className="compare-results-hub">
      <div className="compare-results-hub__mobile">
        <div className="compare-mobile-hub">
          <div className="compare-mobile-hub__duel">
            {topTwo.map((match, index) => (
              <CompareDuelCard
                key={match.slug}
                match={match}
                paymentMode={paymentMode}
                wishes={wishes}
                isWinner={index === 0 && topTwo.length > 1}
                onView={onViewVehicle}
              />
            ))}
          </div>
          {rest.length > 0 && (
            <button
              type="button"
              className="compare-mobile-hub__more"
              onClick={() => setExtraOpen(true)}
            >
              {rest.length === 1 ? 'Weiteres Fahrzeug ansehen' : `Weitere ${rest.length} Fahrzeuge`}
            </button>
          )}
        </div>

        <MobileBottomSheet
          open={extraOpen}
          onClose={() => setExtraOpen(false)}
          title="Weitere Fahrzeuge"
          titleId="compare-extra-sheet-title"
        >
          {rest.map((match) => (
            <CompareExtraRow
              key={match.slug}
              match={match}
              paymentMode={paymentMode}
              onView={(m) => {
                setExtraOpen(false);
                onViewVehicle?.(m);
              }}
            />
          ))}
        </MobileBottomSheet>
      </div>

      <div className="compare-results-hub__desktop">
        <CleverQuoteCompareCards
          matches={sorted}
          paymentMode={paymentMode}
          onViewVehicle={onViewVehicle}
        />
      </div>
    </div>
  );
}
