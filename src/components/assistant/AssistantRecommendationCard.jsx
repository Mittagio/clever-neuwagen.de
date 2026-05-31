import { formatPrice } from '../../data/kiaSportage.js';
import { formatRecommendationRate } from '../../services/recommendationEngine.js';
import OfferQuickSend from '../offers/OfferQuickSend.jsx';
import './AssistantComponents.css';

export default function AssistantRecommendationCard({
  recommendation,
  inCompare,
  expanded,
  createdOffer,
  offerUrl,
  onCreateOffer,
  onToggleCompare,
  onToggleDetails,
  onMarkSent,
}) {
  return (
    <article className={`asst-rec-card${expanded ? ' is-expanded' : ''}${createdOffer ? ' has-offer' : ''}`}>
      <header className="asst-rec-card__head">
        <span className="asst-rec-card__medal" aria-hidden="true">{recommendation.rankMedal}</span>
        <div className="asst-rec-card__titles">
          <h3 className="asst-rec-card__vehicle">{recommendation.fullLabel}</h3>
          <p className="asst-rec-card__engine">{recommendation.engineName}</p>
        </div>
        <p className="asst-rec-card__rate">
          {formatRecommendationRate(recommendation.monthlyRate)}
          <span>/Monat</span>
        </p>
      </header>

      <dl className="asst-rec-card__facts">
        <div>
          <dt>Hauspreis</dt>
          <dd>{recommendation.hauspreis ? formatPrice(recommendation.hauspreis) : '–'}</dd>
        </div>
        <div>
          <dt>Lieferzeit</dt>
          <dd>{recommendation.deliveryTime}</dd>
        </div>
        <div>
          <dt>Verfügbarkeit</dt>
          <dd>{recommendation.availabilityLabel}</dd>
        </div>
        <div>
          <dt>Motorisierung</dt>
          <dd>{recommendation.fuelLabel}</dd>
        </div>
      </dl>

      <div className="asst-rec-card__why">
        <p className="asst-rec-card__why-title">Warum empfohlen?</p>
        <ul className="asst-rec-card__bullets">
          {recommendation.reasonBullets.map((b) => (
            <li key={b}>✓ {b}</li>
          ))}
        </ul>
        {expanded && (
          <p className="asst-rec-card__explanation">{recommendation.explanation}</p>
        )}
      </div>

      {expanded && recommendation.highlights?.length > 0 && (
        <ul className="asst-rec-card__highlights">
          {recommendation.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}

      <div className="asst-rec-card__actions">
        {!createdOffer ? (
          <button
            type="button"
            className="asst-rec-btn asst-rec-btn--primary"
            onClick={() => onCreateOffer(recommendation)}
          >
            Angebot erstellen
          </button>
        ) : (
          <>
            <p className="asst-rec-card__offer-code">Angebot {createdOffer.code}</p>
            <OfferQuickSend
              offer={createdOffer}
              url={offerUrl}
              onMarkSent={onMarkSent}
            />
            <button
              type="button"
              className="asst-rec-btn asst-rec-btn--ghost"
              onClick={() => onCreateOffer(recommendation, true)}
            >
              Kundenansicht öffnen
            </button>
          </>
        )}
        <button
          type="button"
          className={`asst-rec-btn asst-rec-btn--compare${inCompare ? ' is-active' : ''}`}
          onClick={() => onToggleCompare(recommendation.id)}
        >
          {inCompare ? '✓ Im Vergleich' : 'Zum Vergleich hinzufügen'}
        </button>
        <button
          type="button"
          className="asst-rec-btn asst-rec-btn--ghost"
          onClick={() => onToggleDetails(recommendation.id)}
        >
          {expanded ? 'Weniger' : 'Details'}
        </button>
      </div>
    </article>
  );
}

export function AssistantComparePanel({ items, onRemove }) {
  if (!items.length) return null;

  return (
    <section className="asst-compare-panel">
      <h2 className="asst-compare-panel__title">Vergleich ({items.length})</h2>
      <div className="asst-compare-panel__scroll">
        {items.map((item) => (
          <article key={item.id} className="asst-compare-card">
            <button
              type="button"
              className="asst-compare-card__remove"
              onClick={() => onRemove(item.id)}
              aria-label="Entfernen"
            >
              ✕
            </button>
            <p className="asst-compare-card__name">{item.fullLabel}</p>
            <p className="asst-compare-card__rate">{formatRecommendationRate(item.monthlyRate)}/Mt.</p>
            <p className="asst-compare-card__meta">
              {item.hauspreis ? formatPrice(item.hauspreis) : '–'} · {item.deliveryTime}
            </p>
            <ul className="asst-compare-card__highlights">
              {(item.highlights ?? []).slice(0, 3).map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
