import { useState } from 'react';
import VehicleImage from '../shared/VehicleImage.jsx';
import CleverQuoteBadge, { CleverQuoteBreakdown } from '../cleverQuote/CleverQuoteBadge.jsx';
import { RecommendReasonsPanel } from '../cleverQuote/CleverQuoteWhyPanel.jsx';
import { formatCurrency } from '../../logic/marketplaceService.js';
import { buildKiaSellerHeadline } from '../../data/kia/kiaPartnerHub.js';
import { buildRecommendReasons } from '../../services/cleverQuote/cleverQuoteRecommendation.js';

const TOP_N = 3;
const MEDALS = ['🥇', '🥈', '🥉'];
const PODIUM_MAX_REASONS = 3;

function formatDelivery(match) {
  const t = match?.bestOffer?.deliveryTime ?? match?.vehicle?.deliveryTime ?? '';
  if (!t) return null;
  if (/sofort/i.test(t) || match?.vehicle?.availability === 'sofort') return 'Sofort verfügbar';
  return t.replace(/^Lieferzeit\s*/i, '').trim() || t;
}

function formatDealerLabel(match, fallbackDealerName) {
  const dealer = match?.bestOffer?.dealer ?? match?.vehicle?.dealerName ?? fallbackDealerName;
  if (!dealer) return null;
  const distance = match?.bestOffer?.distanceKm ?? match?.vehicle?.distanceKm;
  if (Number.isFinite(distance)) {
    return `${dealer} · ${Math.round(distance)} km`;
  }
  return dealer;
}

function PodiumMatchCard({
  match,
  rank,
  wishes,
  dealerName,
  inCompare,
  showReasons = true,
  onSelect,
  onToggleCompare,
}) {
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const v = match.vehicle;
  const title = match.model ?? `${v.brand} ${v.model}`;
  const trimLabel = match.bestTrim ? ` ${match.bestTrim}` : '';
  const rate = match.bestOffer?.monthlyRate ?? v.monthlyRate;
  const delivery = formatDelivery(match);
  const dealerLabel = formatDealerLabel(match, dealerName);
  const recommendReasons = buildRecommendReasons(match, { wishes, maxReasons: PODIUM_MAX_REASONS });
  const isTop = rank != null && rank < TOP_N;

  return (
    <article
      className={`ss-podium-card${isTop ? ` ss-podium-card--top ss-podium-card--rank-${rank + 1}` : ' ss-podium-card--alt'}`}
    >
      {isTop && (
        <div className="ss-podium-card__rank" aria-hidden>
          {MEDALS[rank]}
        </div>
      )}
      <VehicleImage
        brand={v.brand}
        model={v.imageModel ?? v.model}
        className="ss-podium-card__image"
      />
      <div className="ss-podium-card__body">
        <header className="ss-podium-card__vehicle">
          <h2>{title}{trimLabel}</h2>
        </header>

        {match.cleverQuote && (
          <div className="ss-podium-card__quote">
            <CleverQuoteBadge
              cleverQuote={match.cleverQuote}
              size={isTop ? 'md' : 'sm'}
              showTier={false}
              onWhyClick={() => setBreakdownOpen(true)}
            />
          </div>
        )}

        {showReasons && (
          <RecommendReasonsPanel reasons={recommendReasons} title="Warum?" />
        )}

        <p className="ss-podium-card__rate">
          {formatCurrency(rate)}
          <span>/Monat</span>
        </p>

        {delivery && (
          <p className="ss-podium-card__delivery">{delivery}</p>
        )}

        {dealerLabel && (
          <p className="ss-podium-card__dealer">{dealerLabel}</p>
        )}

        <div className="ss-podium-card__actions">
          <button type="button" className="ss-btn ss-btn--primary" onClick={() => onSelect(match)}>
            Angebot zeigen
          </button>
          <button
            type="button"
            className={`ss-btn ss-btn--ghost${inCompare ? ' ss-btn--active' : ''}`}
            onClick={() => onToggleCompare(match.slug)}
          >
            {inCompare ? 'Im Vergleich' : 'Zum Vergleich'}
          </button>
        </div>
      </div>

      <CleverQuoteBreakdown
        cleverQuote={match.cleverQuote}
        open={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
      />
    </article>
  );
}

export default function SalesResultsPodium({
  matches = [],
  customerName = '',
  wishes = null,
  dealerName = '',
  onSelect,
  onToggleCompare,
  onOpenCompare,
  compareSlugs = [],
}) {
  const [showMore, setShowMore] = useState(false);

  if (!matches.length) {
    return (
      <div className="ss-empty">
        <p>Keine passenden Kia-Modelle gefunden. Bitte Wünsche anpassen.</p>
      </div>
    );
  }

  const topMatches = matches.slice(0, TOP_N);
  const restMatches = matches.slice(TOP_N);
  const hasMore = restMatches.length > 0;

  return (
    <div className="ss-results">
      <header className="ss-results__head">
        <h1>{buildKiaSellerHeadline(customerName)}</h1>
        <p className="ss-results__subline">
          {topMatches.length} beste Treffer · CleverQuote™
        </p>
      </header>

      <section className="ss-podium" aria-labelledby="ss-podium-top-title">
        <h2 id="ss-podium-top-title" className="ss-podium__section-label">Beste Treffer</h2>
        {topMatches.map((match, index) => (
          <PodiumMatchCard
            key={match.slug}
            match={match}
            rank={index}
            wishes={wishes}
            dealerName={dealerName}
            inCompare={compareSlugs.includes(match.slug)}
            showReasons
            onSelect={onSelect}
            onToggleCompare={onToggleCompare}
          />
        ))}
      </section>

      {hasMore && (
        <div className="ss-podium__more-wrap">
          {!showMore ? (
            <button
              type="button"
              className="ss-btn ss-btn--secondary ss-btn--block ss-podium__expand"
              onClick={() => setShowMore(true)}
            >
              Weitere passende Fahrzeuge ({restMatches.length})
            </button>
          ) : (
            <section className="ss-podium ss-podium--rest" aria-labelledby="ss-podium-rest-title">
              <h2 id="ss-podium-rest-title" className="ss-podium__section-label">
                Weitere passende Fahrzeuge
              </h2>
              {restMatches.map((match) => (
                <PodiumMatchCard
                  key={match.slug}
                  match={match}
                  wishes={wishes}
                  dealerName={dealerName}
                  inCompare={compareSlugs.includes(match.slug)}
                  showReasons={false}
                  onSelect={onSelect}
                  onToggleCompare={onToggleCompare}
                />
              ))}
              <button
                type="button"
                className="ss-btn ss-btn--ghost ss-btn--block ss-podium__collapse"
                onClick={() => setShowMore(false)}
              >
                Weniger anzeigen
              </button>
            </section>
          )}
        </div>
      )}

      {compareSlugs.length >= 2 && (
        <div className="ss-results__compare-bar">
          <button type="button" className="ss-btn ss-btn--secondary ss-btn--block" onClick={onOpenCompare}>
            Schnellvergleich ({compareSlugs.length} Fahrzeuge)
          </button>
        </div>
      )}
    </div>
  );
}
